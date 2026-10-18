const fs = require("node:fs");
const path = require("node:path");
const pino = require("pino");
const QRCode = require("qrcode");

const SESSION_DIR = path.join(__dirname, ".whatsapp-session");
const USYNC_SUBBATCH_SIZE = 50;

let baileysModulePromise = null;
let sock = null;
let connectionStatus = "disconnected"; // disconnected | connecting | qr_ready | pairing_code_ready | connected
let qrDataUrl = null;
let rawQr = null;
let pairingCode = null;
let pairingPhone = null;
let connectedPhone = null;
let connectedName = null;
let lastError = null;
let reconnectTimer = null;
let isInitializing = false;

function loadBaileys() {
  if (!baileysModulePromise) {
    baileysModulePromise = import("@whiskeysockets/baileys");
  }
  return baileysModulePromise;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
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
      rawQr = null;
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
      // Fallback to default version if offline/rate-limited
    }

    const currentSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["ContactoCheck", "Chrome", "122.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
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
        } catch (err) {
          lastError = "Não foi possível gerar o código para este número. Verifique o indicativo do país ou use o QR Code.";
        }
      }, 2200);
    }

    currentSock.ev.on("connection.update", async (update) => {
      if (sock !== currentSock) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        rawQr = qr;
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
          // Ignore QR generation error
        }
      }

      if (connection === "open") {
        connectionStatus = "connected";
        qrDataUrl = null;
        rawQr = null;
        pairingCode = null;
        lastError = null;
        connectedPhone = formatJidPhone(currentSock.user?.id) || pairingPhone || "Conectado";
        connectedName = currentSock.user?.name || currentSock.user?.verifiedName || null;
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode
          ?? lastDisconnect?.error?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        if (loggedOut) {
          cleanupSocket();
          clearSessionDirectory();
          connectionStatus = "disconnected";
          qrDataUrl = null;
          rawQr = null;
          pairingCode = null;
          connectedPhone = null;
          connectedName = null;
          lastError = "A sessão do WhatsApp foi desconectada no telemóvel. Conecte novamente.";
          return;
        }

        // Reconnect automatically on stream restart (e.g. 515 after pairing) or temporary disconnect
        connectionStatus = "connecting";
        reconnectTimer = setTimeout(() => {
          void startWhatsAppEngine({ resetSession: false });
        }, 2000);
      }
    });
  } catch (error) {
    connectionStatus = "disconnected";
    lastError = error?.message || "Erro ao iniciar o motor WhatsApp.";
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
      // Ignore logout errors when already disconnected
    }
  }
  cleanupSocket();
  clearSessionDirectory();
  connectionStatus = "disconnected";
  qrDataUrl = null;
  rawQr = null;
  pairingCode = null;
  pairingPhone = null;
  connectedPhone = null;
  connectedName = null;
  lastError = null;
  return getEngineState();
}

function getEngineState() {
  return {
    status: connectionStatus,
    connected: connectionStatus === "connected",
    qrDataUrl: connectionStatus === "connected" ? null : qrDataUrl,
    pairingCode: connectionStatus === "connected" ? null : pairingCode,
    pairingPhone,
    connectedPhone,
    connectedName,
    lastError,
  };
}

function buildPhoneMatchVariants(phoneDigits) {
  const variants = new Set([phoneDigits]);
  // Brazil (+55): WhatsApp JIDs sometimes omit or include the 9th digit after 2-digit DDD
  if (phoneDigits.startsWith("55")) {
    if (phoneDigits.length === 13 && phoneDigits[4] === "9") {
      variants.add(phoneDigits.slice(0, 4) + phoneDigits.slice(5));
    } else if (phoneDigits.length === 12) {
      variants.add(phoneDigits.slice(0, 4) + "9" + phoneDigits.slice(4));
    }
  }
  return variants;
}

async function checkNumbersOnOwnWhatsApp(phones) {
  if (!sock || connectionStatus !== "connected") {
    const error = new Error(
      "O motor próprio do WhatsApp não está conectado. Leia o QR Code ou conecte com código no topo da página.",
    );
    error.code = "engine_not_connected";
    throw error;
  }

  const verifiedDigitsSet = new Set();

  for (let offset = 0; offset < phones.length; offset += USYNC_SUBBATCH_SIZE) {
    const slice = phones.slice(offset, offset + USYNC_SUBBATCH_SIZE);
    const formattedSlice = slice.map((phone) => `+${digitsOnly(phone)}`);

    let response;
    try {
      response = await sock.onWhatsApp(...formattedSlice);
    } catch (err) {
      throw new Error(
        "Falha temporária na consulta direta ao WhatsApp. Verifique se o aparelho permanece conectado.",
      );
    }

    if (Array.isArray(response)) {
      for (const item of response) {
        if (item && item.exists) {
          const jidDigits = digitsOnly(String(item.jid || "").split("@")[0].split(":")[0]);
          if (jidDigits) {
            for (const variant of buildPhoneMatchVariants(jidDigits)) {
              verifiedDigitsSet.add(variant);
            }
          }
        }
      }
    }
  }

  return phones.map((phone) => {
    const cleanDigits = digitsOnly(phone);
    const variants = buildPhoneMatchVariants(cleanDigits);
    let exists = false;
    for (const v of variants) {
      if (verifiedDigitsSet.has(v)) {
        exists = true;
        break;
      }
    }
    return {
      phone,
      status: exists ? "valid" : "invalid",
    };
  });
}

// Auto-resume saved session on boot if credentials exist
if (hasSavedCredentials()) {
  setImmediate(() => {
    void startWhatsAppEngine({ resetSession: false });
  });
}

module.exports = {
  startWhatsAppEngine,
  disconnectWhatsAppEngine,
  getEngineState,
  checkNumbersOnOwnWhatsApp,
};
