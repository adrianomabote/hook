const fs = require("node:fs");
const path = require("node:path");
const pino = require("pino");
const QRCode = require("qrcode");

const SESSION_DIR = path.join(__dirname, ".whatsapp-session");
const CACHE_FILE = path.join(__dirname, ".whatsapp-cache.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias de cache para evitar reconsultar números

const PROTECTION_PROFILES = {
  ultra: {
    id: "ultra",
    label: "Ultra-Blindado (Contas novas)",
    minBatch: 2,
    maxBatch: 4,
    minDelayMs: 4200,
    maxDelayMs: 7500,
    cooldownEvery: 40,
    cooldownMinMs: 22000,
    cooldownMaxMs: 35000,
  },
  safe: {
    id: "safe",
    label: "Seguro Anti-Ban (Recomendado)",
    minBatch: 4,
    maxBatch: 8,
    minDelayMs: 2400,
    maxDelayMs: 4800,
    cooldownEvery: 70,
    cooldownMinMs: 14000,
    cooldownMaxMs: 24000,
  },
  moderate: {
    id: "moderate",
    label: "Equilibrado (Contas antigas)",
    minBatch: 8,
    maxBatch: 14,
    minDelayMs: 1500,
    maxDelayMs: 3000,
    cooldownEvery: 110,
    cooldownMinMs: 10000,
    cooldownMaxMs: 16000,
  },
};

let currentProtectionMode = "safe";
let baileysModulePromise = null;
let sock = null;
let connectionStatus = "disconnected"; // disconnected | connecting | qr_ready | pairing_code_ready | connected
let qrDataUrl = null;
let pairingCode = null;
let pairingPhone = null;
let connectedPhone = null;
let connectedName = null;
let lastError = null;
let reconnectTimer = null;
let isInitializing = false;

// Controlo de fadiga e fila exclusiva para nunca disparar consultas paralelas ao WhatsApp
let activeQueryLock = Promise.resolve();
const recentQueryTimestamps = []; // timestamps de cada número realmente enviado ao WhatsApp
const verifiedCache = new Map(); // digits -> { status: "valid" | "invalid", updatedAt: number }

function loadCacheFromDisk() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    const now = Date.now();
    if (raw && typeof raw === "object") {
      for (const [digits, entry] of Object.entries(raw)) {
        if (
          entry &&
          (entry.status === "valid" || entry.status === "invalid") &&
          typeof entry.updatedAt === "number" &&
          now - entry.updatedAt < CACHE_TTL_MS
        ) {
          verifiedCache.set(digits, entry);
        }
      }
    }
  } catch {
    // Ignore cache read errors
  }
}

let saveCacheTimer = null;
function scheduleSaveCache() {
  if (saveCacheTimer) return;
  saveCacheTimer = setTimeout(() => {
    saveCacheTimer = null;
    try {
      const now = Date.now();
      const serialized = {};
      for (const [digits, entry] of verifiedCache.entries()) {
        if (now - entry.updatedAt < CACHE_TTL_MS) {
          serialized[digits] = entry;
        } else {
          verifiedCache.delete(digits);
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(serialized), "utf8");
    } catch {
      // Ignore disk write errors
    }
  }, 2000);
  saveCacheTimer.unref?.();
}

loadCacheFromDisk();

function clearVerifiedCache() {
  verifiedCache.clear();
  try {
    fs.rmSync(CACHE_FILE, { force: true });
  } catch {
    // Ignore
  }
}

function loadBaileys() {
  if (!baileysModulePromise) {
    baileysModulePromise = import("@whiskeysockets/baileys");
  }
  return baileysModulePromise;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneRecentQueries() {
  const cutoff = Date.now() - 60 * 60 * 1000; // última 1 hora
  while (recentQueryTimestamps.length > 0 && recentQueryTimestamps[0] < cutoff) {
    recentQueryTimestamps.shift();
  }
}

function getRecentQueryStats() {
  pruneRecentQueries();
  const now = Date.now();
  const last15Min = recentQueryTimestamps.filter((t) => now - t < 15 * 60 * 1000).length;
  const last60Min = recentQueryTimestamps.length;
  return {
    last15Min,
    last60Min,
    cacheSize: verifiedCache.size,
  };
}

function setProtectionMode(mode) {
  if (PROTECTION_PROFILES[mode]) {
    currentProtectionMode = mode;
  }
  return getEngineState();
}

// Pré-filtro local para não enviar números estruturalmente impossíveis ao WhatsApp
// (Consultar muitos números inexistentes seguidos é o principal gatilho de banimento da Meta)
function isPlausibleWhatsAppNumber(phoneDigits) {
  if (!phoneDigits || phoneDigits.length < 8 || phoneDigits.length > 15) return false;
  if (/^(\d)\1{6,}$/.test(phoneDigits.slice(-8))) return false; // ex: 99999999, 00000000
  if (phoneDigits.endsWith("12345678") || phoneDigits.endsWith("87654321")) return false;

  // Moçambique (+258): 258 + 9 dígitos (móveis 82, 83, 84, 85, 86, 87 ou fixo 2)
  if (phoneDigits.startsWith("258")) {
    return /^258(8[2-7]\d{7}|2\d{7,8})$/.test(phoneDigits);
  }
  // Angola (+244): 244 + 9 dígitos (móveis 91-99 ou fixo 22)
  if (phoneDigits.startsWith("244")) {
    return /^244(9[1-9]\d{7}|2\d{8})$/.test(phoneDigits);
  }
  // Portugal (+351): 351 + 9 dígitos (91, 92, 93, 96 ou fixo 2/3)
  if (phoneDigits.startsWith("351")) {
    return /^351(9[1236]\d{7}|[23]\d{8})$/.test(phoneDigits);
  }
  // Brasil (+55): 55 + 2 dígitos DDD (11-99) + 8 ou 9 dígitos
  if (phoneDigits.startsWith("55")) {
    return /^55[1-9][1-9](\d{8}|9\d{8})$/.test(phoneDigits);
  }

  return true;
}

function formatJidPhone(jid) {
  if (!jid || typeof jid !== "string") return null;
  const raw = jid.split("@")[0].split(":")[0];
  const digits = digitsOnly(raw);
  return digits ? `+${digits}` : null;
}

function clearSessionDirectory() {
  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function hasSavedCredentials() {
  try {
    return fs.existsSync(path.join(SESSION_DIR, "creds.json"));
  } catch {
    return false;
  }
}

function cleanupSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      sock.end(undefined);
    } catch {
      // Ignore socket close errors
    }
    sock = null;
  }
}

async function startWhatsAppEngine(options = {}) {
  const { resetSession = false, requestPairingForPhone = null } = options;

  if (isInitializing) {
    return getEngineState();
  }

  isInitializing = true;
  try {
    cleanupSocket();

    if (resetSession) {
      clearSessionDirectory();
      qrDataUrl = null;
      pairingCode = null;
      pairingPhone = null;
      connectedPhone = null;
      connectedName = null;
    }

    fs.mkdirSync(SESSION_DIR, { recursive: true });
    connectionStatus = "connecting";
    lastError = null;

    const baileys = await loadBaileys();
    const makeWASocket = baileys.makeWASocket || baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) {
        version = latest.version;
      }
    } catch {
      // Fallback version
    }

    const currentSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "124.0.6367.207"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 45000,
    });

    sock = currentSock;

    currentSock.ev.on("creds.update", saveCreds);

    if (requestPairingForPhone) {
      const cleanPhone = digitsOnly(requestPairingForPhone);
      pairingPhone = `+${cleanPhone}`;
      setTimeout(async () => {
        if (sock !== currentSock || state.creds.registered) return;
        try {
          const code = await currentSock.requestPairingCode(cleanPhone);
          const formatted = typeof code === "string" && code.length === 8
            ? `${code.slice(0, 4)}-${code.slice(4)}`
            : String(code || "");
          pairingCode = formatted;
          connectionStatus = "pairing_code_ready";
        } catch {
          lastError = "Não foi possível gerar o código para este número. Verifique o indicativo do país ou use o QR Code.";
        }
      }, 2200);
    }

    currentSock.ev.on("connection.update", async (update) => {
      if (sock !== currentSock) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr, {
            width: 260,
            margin: 1,
            color: {
              dark: "#142620",
              light: "#ffffff",
            },
          });
          if (connectionStatus !== "pairing_code_ready") {
            connectionStatus = "qr_ready";
          }
        } catch {
          // Ignore QR error
        }
      }

      if (connection === "open") {
        connectionStatus = "connected";
        qrDataUrl = null;
        pairingCode = null;
        lastError = null;
        connectedPhone = formatJidPhone(currentSock.user?.id) || pairingPhone || "Conectado";
        connectedName = currentSock.user?.name || currentSock.user?.verifiedName || null;
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode
          ?? lastDisconnect?.error?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;

        if (loggedOut) {
          cleanupSocket();
          clearSessionDirectory();
          connectionStatus = "disconnected";
          qrDataUrl = null;
          pairingCode = null;
          connectedPhone = null;
          connectedName = null;
          lastError = statusCode === 403
            ? "O WhatsApp restringiu ou desconectou temporariamente esta sessão. Aguarde antes de reconectar e use o modo Ultra-Blindado."
            : "A sessão do WhatsApp foi desconectada no telemóvel. Conecte novamente.";
          return;
        }

        connectionStatus = "connecting";
        reconnectTimer = setTimeout(() => {
          void startWhatsAppEngine({ resetSession: false });
        }, 2500);
      }
    });
  } catch (error) {
    connectionStatus = "disconnected";
    lastError = error?.message || "Erro ao iniciar o motor próprio do WhatsApp.";
  } finally {
    isInitializing = false;
  }

  return getEngineState();
}

async function disconnectWhatsAppEngine() {
  if (sock) {
    try {
      await sock.logout();
    } catch {
      // Ignore logout errors
    }
  }
  cleanupSocket();
  clearSessionDirectory();
  connectionStatus = "disconnected";
  qrDataUrl = null;
  pairingCode = null;
  pairingPhone = null;
  connectedPhone = null;
  connectedName = null;
  lastError = null;
  return getEngineState();
}

function getEngineState() {
  const stats = getRecentQueryStats();
  const profile = PROTECTION_PROFILES[currentProtectionMode] || PROTECTION_PROFILES.safe;
  return {
    status: connectionStatus,
    connected: connectionStatus === "connected",
    qrDataUrl: connectionStatus === "connected" ? null : qrDataUrl,
    pairingCode: connectionStatus === "connected" ? null : pairingCode,
    pairingPhone,
    connectedPhone,
    connectedName,
    lastError,
    protectionMode: profile.id,
    protectionLabel: profile.label,
    stats,
  };
}

function buildPhoneMatchVariants(phoneDigits) {
  const variants = new Set([phoneDigits]);
  if (phoneDigits.startsWith("55")) {
    if (phoneDigits.length === 13 && phoneDigits[4] === "9") {
      variants.add(phoneDigits.slice(0, 4) + phoneDigits.slice(5));
    } else if (phoneDigits.length === 12) {
      variants.add(phoneDigits.slice(0, 4) + "9" + phoneDigits.slice(4));
    }
  }
  return variants;
}

function getCachedStatus(phoneDigits) {
  const now = Date.now();
  for (const variant of buildPhoneMatchVariants(phoneDigits)) {
    const cached = verifiedCache.get(variant);
    if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
      return cached.status;
    }
  }
  return null;
}

function setCachedStatus(phoneDigits, status) {
  const now = Date.now();
  for (const variant of buildPhoneMatchVariants(phoneDigits)) {
    verifiedCache.set(variant, { status, updatedAt: now });
  }
  scheduleSaveCache();
}

async function queryMicroBatchWithRetry(formattedSlice) {
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("A conexão com o WhatsApp foi interrompida. Aguarde a reconexão automática ou conecte novamente.");
    }
    try {
      const response = await sock.onWhatsApp(...formattedSlice);
      return Array.isArray(response) ? response : [];
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("429") || msg.includes("timeout") || msg.includes("timed out")) {
        // Arrefecimento de emergência se o WhatsApp sinalizar lentidão/rate-limit
        if (attempt + 1 < maxAttempts) {
          await wait(25000);
          continue;
        }
        throw new Error(
          "O WhatsApp sinalizou limite de ritmo (proteção anti-banimento ativada). A verificação foi pausada para proteger o seu número; aguarde alguns minutos antes de continuar.",
        );
      }
      if (attempt + 1 < maxAttempts) {
        await wait(4000);
        continue;
      }
      throw new Error(
        "Falha temporária na consulta ao WhatsApp. A verificação parou preventivamente para proteger a conta.",
      );
    }
  }
  return [];
}

/**
 * Verifica números usando o Motor Próprio com Blindagem Anti-Banimento:
 * - Cache persistente de 7 dias (não consulta números repetidos entre ficheiros)
 * - Pré-validação estrutural local por país (não envia números impossíveis ao WhatsApp)
 * - Micro-lotes aleatórios + Jitter humano + Pausas de arrefecimento periódicas
 * - Arrefecimento automático quando outro ficheiro foi verificado recentemente
 */
async function checkNumbersOnOwnWhatsApp(phones, options = {}) {
  const { onProgress = null, shouldAbort = null } = options;

  if (!sock || connectionStatus !== "connected") {
    const error = new Error(
      "O motor próprio do WhatsApp não está conectado. Leia o QR Code ou conecte com código no topo da página.",
    );
    error.code = "engine_not_connected";
    throw error;
  }

  // Garante execução estritamente sequencial (nunca envia 2 listas em simultâneo na mesma conta)
  let releaseLock;
  const previousLock = activeQueryLock;
  activeQueryLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    const profile = PROTECTION_PROFILES[currentProtectionMode] || PROTECTION_PROFILES.safe;
    const resultByDigits = new Map();
    const phonesToQuery = [];
    let completedCount = 0;
    let cachedHits = 0;
    let preFiltered = 0;

    // 1. Verificar Cache Persistente e Pré-Validação Estrutural
    for (const phone of phones) {
      const cleanDigits = digitsOnly(phone);
      const cachedStatus = getCachedStatus(cleanDigits);
      if (cachedStatus) {
        resultByDigits.set(cleanDigits, cachedStatus);
        completedCount += 1;
        cachedHits += 1;
        continue;
      }

      if (!isPlausibleWhatsAppNumber(cleanDigits)) {
        resultByDigits.set(cleanDigits, "invalid");
        setCachedStatus(cleanDigits, "invalid");
        completedCount += 1;
        preFiltered += 1;
        continue;
      }

      phonesToQuery.push(phone);
    }

    if (onProgress && completedCount > 0) {
      onProgress({
        completed: completedCount,
        total: phones.length,
        cachedHits,
        preFiltered,
        phaseMessage: `${completedCount} de ${phones.length} resolvidos instantaneamente (${cachedHits} em cache anti-ban)…`,
      });
    }

    // 2. Se existem números novos para consultar no WhatsApp, verificar fadiga recente da conta
    if (phonesToQuery.length > 0) {
      const stats = getRecentQueryStats();
      // Se já verificou muitos números nos últimos 15 minutos (ex.: segundo ficheiro consecutivo),
      // faz um arrefecimento preventivo antes de começar a nova remessa!
      if (stats.last15Min >= 300 && phonesToQuery.length > 10) {
        const preCooldownSec = stats.last15Min >= 700 ? 30 : 18;
        onProgress?.({
          completed: completedCount,
          total: phones.length,
          cachedHits,
          preFiltered,
          phaseMessage: `Proteção Anti-Ban: a conta verificou ${stats.last15Min} números recentemente. A aguardar ${preCooldownSec}s de arrefecimento antes deste lote…`,
        });
        await wait(preCooldownSec * 1000);
      }
    }

    // 3. Processar em micro-lotes variáveis com Jitter Humano e Pausas de Respiração
    let cursor = 0;
    let queriedInThisRun = 0;
    let nextCooldownThreshold = profile.cooldownEvery + randomInt(-8, 10);

    while (cursor < phonesToQuery.length) {
      if (shouldAbort?.()) {
        break;
      }

      // Tamanho variável de micro-lote (nunca fixo)
      const batchSize = phonesToQuery.length === 1
        ? 1
        : randomInt(profile.minBatch, profile.maxBatch);
      const slice = phonesToQuery.slice(cursor, cursor + batchSize);
      cursor += slice.length;

      const formattedSlice = slice.map((phone) => `+${digitsOnly(phone)}`);
      const response = await queryMicroBatchWithRetry(formattedSlice);

      const verifiedInSlice = new Set();
      for (const item of response) {
        if (item && item.exists) {
          const jidDigits = digitsOnly(String(item.jid || "").split("@")[0].split(":")[0]);
          if (jidDigits) {
            for (const variant of buildPhoneMatchVariants(jidDigits)) {
              verifiedInSlice.add(variant);
            }
          }
        }
      }

      const now = Date.now();
      for (const phone of slice) {
        const cleanDigits = digitsOnly(phone);
        const variants = buildPhoneMatchVariants(cleanDigits);
        let exists = false;
        for (const v of variants) {
          if (verifiedInSlice.has(v)) {
            exists = true;
            break;
          }
        }
        const status = exists ? "valid" : "invalid";
        resultByDigits.set(cleanDigits, status);
        setCachedStatus(cleanDigits, status);
        recentQueryTimestamps.push(now);
      }

      completedCount += slice.length;
      queriedInThisRun += slice.length;

      onProgress?.({
        completed: completedCount,
        total: phones.length,
        cachedHits,
        preFiltered,
        phaseMessage: `Modo ${profile.label}: ${completedCount} de ${phones.length} verificados com cadência segura…`,
      });

      // Se ainda faltam números neste lote, aplicar pausa humana ou arrefecimento periódico
      if (cursor < phonesToQuery.length) {
        if (queriedInThisRun >= nextCooldownThreshold) {
          const cooldownMs = randomInt(profile.cooldownMinMs, profile.cooldownMaxMs);
          const cooldownSec = Math.round(cooldownMs / 1000);
          nextCooldownThreshold = queriedInThisRun + profile.cooldownEvery + randomInt(-8, 10);

          onProgress?.({
            completed: completedCount,
            total: phones.length,
            cachedHits,
            preFiltered,
            phaseMessage: `Pausa Anti-Ban de ${cooldownSec}s após ${queriedInThisRun} consultas para proteger o seu WhatsApp (${completedCount}/${phones.length})…`,
          });
          await wait(cooldownMs);
        } else {
          // Se a conta já tem mais de 500 consultas na última hora, aumenta o atraso automaticamente em 40%
          const fatigueMultiplier = recentQueryTimestamps.length > 500 ? 1.4 : 1.0;
          const jitterMs = Math.round(
            randomInt(profile.minDelayMs, profile.maxDelayMs) * fatigueMultiplier,
          );
          await wait(jitterMs);
        }
      }
    }

    return phones.map((phone) => ({
      phone,
      status: resultByDigits.get(digitsOnly(phone)) || "unknown",
    }));
  } finally {
    releaseLock();
  }
}

if (hasSavedCredentials()) {
  setImmediate(() => {
    void startWhatsAppEngine({ resetSession: false });
  });
}

module.exports = {
  startWhatsAppEngine,
  disconnectWhatsAppEngine,
  getEngineState,
  setProtectionMode,
  clearVerifiedCache,
  checkNumbersOnOwnWhatsApp,
};
