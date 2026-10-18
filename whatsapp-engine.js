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
    minDelayMs: 5500,
    maxDelayMs: 9500,
    shortPauseEvery: 40,
    shortPauseMinMs: 60000,   // 1 min a 1m30s a cada 40 números
    shortPauseMaxMs: 90000,
    longPauseEvery: 160,
    longPauseMinMs: 180000,   // 3 min a 4m30s a cada 160 números
    longPauseMaxMs: 270000,
  },
  safe: {
    id: "safe",
    label: "Seguro Anti-Ban (Recomendado)",
    minBatch: 3,
    maxBatch: 6,
    minDelayMs: 3500,
    maxDelayMs: 6500,
    shortPauseEvery: 50,
    shortPauseMinMs: 45000,   // 45s a 75s a cada 50 números
    shortPauseMaxMs: 75000,
    longPauseEvery: 200,
    longPauseMinMs: 120000,   // 2 min a 3m30s a cada 200 números
    longPauseMaxMs: 210000,
  },
  moderate: {
    id: "moderate",
    label: "Equilibrado (Contas antigas)",
    minBatch: 6,
    maxBatch: 10,
    minDelayMs: 2200,
    maxDelayMs: 4200,
    shortPauseEvery: 80,
    shortPauseMinMs: 30000,   // 30s a 50s a cada 80 números
    shortPauseMaxMs: 50000,
    longPauseEvery: 250,
    longPauseMinMs: 75000,    // 1m15s a 2 min a cada 250 números
    longPauseMaxMs: 120000,
  },
  batch100: {
    id: "batch100",
    label: "Agressivo Controlado (100 números · pausa curta)",
    minBatch: 25,
    maxBatch: 35,
    minDelayMs: 350,
    maxDelayMs: 750,
    exactPauseBoundary: true,
    shortPauseEvery: 100,
    shortPauseMinMs: 6000,    // Pausa curta de apenas 6s a 12s a cada 100 números
    shortPauseMaxMs: 12000,
    longPauseEvery: 500,
    longPauseMinMs: 15000,    // Pausa de 15s a 25s a cada 500 números
    longPauseMaxMs: 25000,
  },
  batch10_13: {
    id: "batch10_13",
    label: "Cadência 10–13 por pausa (Pausa de 10–15s)",
    minBatch: 10,
    maxBatch: 13,
    minDelayMs: 10000,        // Pausa de 10s a 15s a cada 10 a 13 números
    maxDelayMs: 15000,
    shortPauseEvery: 120,
    shortPauseMinMs: 20000,   // Descanso de 20s a 30s a cada ~120 números
    shortPauseMaxMs: 30000,
    longPauseEvery: 360,
    longPauseMinMs: 40000,    // Descanso de 40s a 60s a cada ~360 números
    longPauseMaxMs: 60000,
  },
  batch500_600: {
    id: "batch500_600",
    label: "Bloco 500–600 números (Pausa de 4–5 min)",
    minBatch: 45,
    maxBatch: 55,
    minDelayMs: 250,
    maxDelayMs: 500,
    exactPauseBoundary: true,
    shortPauseEveryMin: 500,
    shortPauseEveryMax: 600,
    shortPauseEvery: 550,
    shortPauseMinMs: 240000,  // Pausa única de 4 a 5 minutos a cada 500–600 números
    shortPauseMaxMs: 300000,
    longPauseEvery: 9999999,  // Sem outras pausas intermediárias ("só isso")
    longPauseMinMs: 240000,
    longPauseMaxMs: 300000,
  },
};

let currentProtectionMode = "batch500_600";
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

// Fila exclusiva para nunca disparar consultas paralelas ao WhatsApp
let activeQueryLock = Promise.resolve();
const recentQueryTimestamps = [];
const verifiedCache = new Map();

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

function formatRemainingTime(seconds) {
  const sec = Math.max(1, Math.ceil(seconds));
  if (sec < 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const remSec = sec % 60;
  return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes}m`;
}

async function waitWithCountdown(totalMs, onTick, shouldAbort) {
  const endAt = Date.now() + totalMs;
  while (Date.now() < endAt) {
    if (shouldAbort?.()) return;
    const remainingMs = endAt - Date.now();
    const remainingSec = Math.ceil(remainingMs / 1000);
    onTick?.(formatRemainingTime(remainingSec), remainingSec);
    await wait(Math.min(1000, remainingMs));
  }
}

function pruneRecentQueries() {
  const cutoff = Date.now() - 60 * 60 * 1000;
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

function isPlausibleWhatsAppNumber(phoneDigits) {
  if (!phoneDigits || phoneDigits.length < 8 || phoneDigits.length > 15) return false;
  if (/^(\d)\1{6,}$/.test(phoneDigits.slice(-8))) return false;
  if (phoneDigits.endsWith("12345678") || phoneDigits.endsWith("87654321")) return false;

  if (phoneDigits.startsWith("258")) {
    return /^258(8[2-7]\d{7}|2\d{7,8})$/.test(phoneDigits);
  }
  if (phoneDigits.startsWith("244")) {
    return /^244(9[1-9]\d{7}|2\d{8})$/.test(phoneDigits);
  }
  if (phoneDigits.startsWith("351")) {
    return /^351(9[1236]\d{7}|[23]\d{8})$/.test(phoneDigits);
  }
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

async function waitForConnectionRecovery(maxWaitMs = 45000, onProgressCallback = null) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (sock && connectionStatus === "connected") return true;
    const remSec = Math.ceil((maxWaitMs - (Date.now() - start)) / 1000);
    onProgressCallback?.(`A aguardar reconexão automática do WhatsApp (${remSec}s)…`);
    await wait(1000);
  }
  return Boolean(sock && connectionStatus === "connected");
}

async function queryMicroBatchWithRetry(formattedSlice, onWaitStatus) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!sock || connectionStatus !== "connected") {
      const recovered = await waitForConnectionRecovery(45000, onWaitStatus);
      if (!recovered) {
        throw new Error("A conexão com o WhatsApp foi interrompida. Verifique se o aparelho permanece conectado.");
      }
    }
    try {
      const response = await sock.onWhatsApp(...formattedSlice);
      return Array.isArray(response) ? response : [];
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("429") || msg.includes("timeout") || msg.includes("timed out")) {
        if (attempt + 1 < maxAttempts) {
          const emergencyMs = 90000; // 1m30s de pausa automática de emergência antes de continuar sozinho
          await waitWithCountdown(emergencyMs, (timeText) => {
            onWaitStatus?.(
              `Pausa de segurança Anti-Ban (WhatsApp pediu abrandamento) · retoma automaticamente em ${timeText}…`,
            );
          });
          continue;
        }
        throw new Error(
          "O WhatsApp sinalizou limite de ritmo. A verificação foi interrompida para proteger o seu número.",
        );
      }
      if (attempt + 1 < maxAttempts) {
        await waitWithCountdown(15000, (timeText) => {
          onWaitStatus?.(`Pausa de estabilização da ligação · retoma automaticamente em ${timeText}…`);
        });
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
 * Verifica números usando o Motor Próprio com Blindagem Anti-Banimento e Continuação 100% Automática:
 * - Quando atinge o limite de cada bloco, faz uma pausa longa com contagem decrescente ao vivo
 *   e depois CONTINUA AUTOMATICAMENTE sem precisar de clique manual!
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

    const emitProgress = (phaseMessage, latestBatchResults = null) => {
      onProgress?.({
        completed: completedCount,
        total: phones.length,
        cachedHits,
        preFiltered,
        phaseMessage,
        latestBatchResults,
      });
    };

    if (completedCount > 0) {
      const initialResolved = phones
        .filter((p) => resultByDigits.has(digitsOnly(p)))
        .map((p) => ({ phone: p, status: resultByDigits.get(digitsOnly(p)) }));
      emitProgress(
        `${completedCount} de ${phones.length} resolvidos instantaneamente (${cachedHits} em cache anti-ban)…`,
        initialResolved,
      );
    }

    // 2. Se o utilizador acabou de verificar outro ficheiro recentemente, faz uma pausa automática proporcional ao modo
    const isExactBoundary = Boolean(profile.exactPauseBoundary);
    const getNextShortPauseStep = () => (
      profile.shortPauseEveryMin && profile.shortPauseEveryMax
        ? randomInt(profile.shortPauseEveryMin, profile.shortPauseEveryMax)
        : isExactBoundary
          ? profile.shortPauseEvery
          : profile.shortPauseEvery + randomInt(-5, 6)
    );

    if (phonesToQuery.length > 0) {
      const stats = getRecentQueryStats();
      if (profile.id === "batch500_600") {
        const last5Min = recentQueryTimestamps.filter((t) => Date.now() - t < 5 * 60 * 1000).length;
        if (last5Min >= 500 && phonesToQuery.length > 5) {
          const preCooldownMs = randomInt(profile.shortPauseMinMs, profile.shortPauseMaxMs);
          await waitWithCountdown(
            preCooldownMs,
            (timeText) => {
              emitProgress(
                `Pausa Anti-Ban de 4–5 min (${last5Min} números recentes) · Retoma sozinho em ${timeText}…`,
              );
            },
            shouldAbort,
          );
        }
      } else if (stats.last15Min >= 180 && phonesToQuery.length > 5) {
        const preCooldownMs = isExactBoundary
          ? randomInt(6000, 12000) // apenas 6s a 12s no modo agressivo
          : stats.last15Min >= 500
            ? randomInt(120000, 180000)
            : randomInt(60000, 100000);
        await waitWithCountdown(
          preCooldownMs,
          (timeText) => {
            emitProgress(
              `Proteção entre ficheiros (${stats.last15Min} números recentes) · Retoma sozinho em ${timeText}…`,
            );
          },
          shouldAbort,
        );
      }
    }

    // 3. Processar toda a lista continuamente com pausas automáticas (sem pedir clique!)
    let cursor = 0;
    let queriedInThisRun = 0;
    let currentPauseBlockSize = getNextShortPauseStep();
    let nextShortPauseAt = currentPauseBlockSize;
    let nextLongPauseAt = isExactBoundary
      ? profile.longPauseEvery
      : profile.longPauseEvery + randomInt(-15, 15);

    while (cursor < phonesToQuery.length) {
      if (shouldAbort?.()) {
        break;
      }

      const remainingUntilPause = Math.max(1, nextShortPauseAt - queriedInThisRun);
      const rawBatchSize = phonesToQuery.length === 1
        ? 1
        : randomInt(profile.minBatch, profile.maxBatch);
      const batchSize = isExactBoundary
        ? Math.min(rawBatchSize, remainingUntilPause)
        : rawBatchSize;
      const slice = phonesToQuery.slice(cursor, cursor + batchSize);
      cursor += slice.length;

      const formattedSlice = slice.map((phone) => `+${digitsOnly(phone)}`);
      const response = await queryMicroBatchWithRetry(formattedSlice, (waitMsg) => {
        emitProgress(waitMsg);
      });

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
      const sliceResults = [];
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
        sliceResults.push({ phone, status });
      }

      completedCount += slice.length;
      queriedInThisRun += slice.length;

      emitProgress(
        `A verificar automaticamente (${profile.label}) · ${completedCount.toLocaleString("pt-PT")} de ${phones.length.toLocaleString("pt-PT")} números concluídos…`,
        sliceResults,
      );

      // Se ainda faltam números na lista, aplica a pausa adequada e continua sozinho automaticamente!
      if (cursor < phonesToQuery.length) {
        if (queriedInThisRun >= nextLongPauseAt) {
          const longPauseMs = randomInt(profile.longPauseMinMs, profile.longPauseMaxMs);
          nextLongPauseAt = isExactBoundary
            ? queriedInThisRun + profile.longPauseEvery
            : queriedInThisRun + profile.longPauseEvery + randomInt(-15, 15);
          currentPauseBlockSize = getNextShortPauseStep();
          nextShortPauseAt = queriedInThisRun + currentPauseBlockSize;

          await waitWithCountdown(
            longPauseMs,
            (timeText) => {
              emitProgress(
                `Pausa longa Anti-Ban (${completedCount.toLocaleString("pt-PT")}/${phones.length.toLocaleString("pt-PT")} verificados) · Continua automaticamente em ${timeText}…`,
              );
            },
            shouldAbort,
          );
        } else if (queriedInThisRun >= nextShortPauseAt) {
          const shortPauseMs = randomInt(profile.shortPauseMinMs, profile.shortPauseMaxMs);
          const finishedBlockSize = currentPauseBlockSize;
          currentPauseBlockSize = getNextShortPauseStep();
          nextShortPauseAt = queriedInThisRun + currentPauseBlockSize;

          await waitWithCountdown(
            shortPauseMs,
            (timeText) => {
              emitProgress(
                `Pausa Anti-Ban após ${finishedBlockSize} números (${completedCount.toLocaleString("pt-PT")}/${phones.length.toLocaleString("pt-PT")} verificados) · Continua sozinho em ${timeText}…`,
              );
            },
            shouldAbort,
          );
        } else {
          const fatigueMultiplier = !isExactBoundary && recentQueryTimestamps.length > 400 ? 1.45 : 1.0;
          const jitterMs = Math.round(
            randomInt(profile.minDelayMs, profile.maxDelayMs) * fatigueMultiplier,
          );
          if (jitterMs >= 1200) {
            await waitWithCountdown(
              jitterMs,
              (timeText) => {
                emitProgress(
                  profile.id === "batch10_13"
                    ? `Pausa Anti-Ban após ${slice.length} números (${completedCount.toLocaleString("pt-PT")}/${phones.length.toLocaleString("pt-PT")} verificados) · Continua sozinho em ${timeText}…`
                    : `Cadência segura Anti-Ban (${completedCount.toLocaleString("pt-PT")}/${phones.length.toLocaleString("pt-PT")}) · próximo micro-lote em ${timeText}…`,
                );
              },
              shouldAbort,
            );
          } else {
            await wait(jitterMs);
          }
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
