const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} = require("node:crypto");
const {
  startWhatsAppEngine,
  disconnectWhatsAppEngine,
  getEngineState,
  setProtectionMode,
  clearVerifiedCache,
  checkNumbersOnOwnWhatsApp,
} = require("./whatsapp-engine");

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const XLSX_BUNDLE_PATH = path.join(
  path.dirname(require.resolve("xlsx")),
  "dist",
  "xlsx.full.min.js",
);

const DIVISION_BATCH_SIZE = 200;
const MAX_SYNCHRONOUS_NUMBERS = 1;
const MAX_NUMBERS_PER_CONSULTATION = 100_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const AUTH_SESSION_MS = 12 * 60 * 60 * 1000;
const AUTH_COOKIE_NAME = "contactocheck_session";
const JOB_RETENTION_MS = 6 * 60 * 60 * 1000;

const requestCounts = new Map();
const loginAttempts = new Map();
const checkJobs = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function clientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function isSiteAuthConfigured() {
  return Boolean(process.env.SITE_PASSWORD);
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "contactocheck-internal-session-secret";
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

function sessionSignature(expiresAt) {
  const passwordFingerprint = createHash("sha256")
    .update(process.env.SITE_PASSWORD, "utf8")
    .digest("hex");
  return createHmac("sha256", getSessionSecret())
    .update(`contactocheck:${expiresAt}:${passwordFingerprint}`, "utf8")
    .digest("base64url");
}

function hasValidAuthSession(request) {
  if (!isSiteAuthConfigured()) return true;

  const value = readCookie(request, AUTH_COOKIE_NAME);
  const [expiresAtValue, signature, extra] = value.split(".");
  if (extra !== undefined || !/^\d+$/.test(expiresAtValue || "") || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  const now = Date.now();
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + AUTH_SESSION_MS) {
    return false;
  }

  const expected = Buffer.from(sessionSignature(expiresAtValue), "base64url");
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secureCookieAttribute(request) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const isHttps = request.socket.encrypted
    || (typeof forwardedProtocol === "string"
      && forwardedProtocol.split(",")[0].trim().toLowerCase() === "https");
  return isHttps ? "; SameSite=None; Secure; Partitioned" : "; SameSite=Lax";
}

function sendLoginPage(request, response, status = 200, message = "") {
  const configured = isSiteAuthConfigured();
  const notice = message
    ? `<p class="notice" role="alert">${message}</p>`
    : "";
  const content = configured
    ? `<p class="description">Introduza a palavra-passe para continuar.</p>
       ${notice}
       <form action="/api/auth/login" method="post">
         <input type="hidden" name="username" value="contactocheck" autocomplete="username">
         <label for="password">Palavra-passe</label>
         <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
         <button type="submit">Entrar</button>
       </form>`
    : `<p class="notice" role="alert">O acesso ainda não está configurado. Configure <strong>SITE_PASSWORD</strong> nas variáveis de ambiente do serviço e reinicie-o.</p>`;
  const page = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Acesso privado — ContactoCheck</title>
    <style>
      :root { color-scheme: light; font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #142620; background: #f5f8f6; }
      * { box-sizing: border-box; }
      body { min-width: 320px; min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: radial-gradient(ellipse at 85% 5%, #e4f1e9, transparent 34rem), #f5f8f6; }
      main { width: min(100%, 420px); }
      .brand { margin: 0 0 24px; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: -0.8px; }
      .brand span { color: #1d8062; }
      .card { padding: 34px; border: 1px solid #e4ebe7; border-radius: 18px; background: #fff; box-shadow: 0 15px 40px rgba(24, 59, 44, .06); }
      .eyebrow { margin: 0 0 8px; color: #1d8062; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
      h1 { margin: 0; font-size: 26px; letter-spacing: -1px; }
      .description { margin: 10px 0 24px; color: #65746c; line-height: 1.6; }
      label { display: block; margin: 0 0 8px; font-size: 13px; font-weight: 700; }
      input { width: 100%; min-height: 48px; padding: 0 13px; border: 1px solid #d8e2dc; border-radius: 9px; color: #142620; font: inherit; }
      input:focus { outline: 3px solid rgba(29, 128, 98, .18); border-color: #1d8062; }
      button { width: 100%; min-height: 48px; margin-top: 16px; border: 0; border-radius: 9px; color: #fff; background: #1d8062; font: inherit; font-weight: 700; }
      button:hover { background: #176b52; }
      .notice { margin: 16px 0 0; padding: 12px 14px; border-radius: 9px; color: #7b332b; background: #fff0ed; font-size: 13px; line-height: 1.5; }
      .notice strong { overflow-wrap: anywhere; }
      @media (max-width: 480px) { .card { padding: 26px 22px; } }
    </style>
  </head>
  <body>
    <main>
      <p class="brand">contacto<span>check</span></p>
      <section class="card" aria-labelledby="login-title">
        <p class="eyebrow">Acesso privado</p>
        <h1 id="login-title">Entrar no site</h1>
        ${content}
      </section>
    </main>
  </body>
</html>`;

  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : page);
}

function isLoginRateLimited(address) {
  const now = Date.now();
  const attempt = loginAttempts.get(address);
  if (!attempt || now - attempt.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(address, { startedAt: now, count: 0 });
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(address) {
  const now = Date.now();
  let attempt = loginAttempts.get(address);
  if (!attempt || now - attempt.startedAt >= LOGIN_WINDOW_MS) {
    attempt = { startedAt: now, count: 0 };
    loginAttempts.set(address, attempt);
  }
  attempt.count += 1;

  if (loginAttempts.size > 1000) {
    for (const [key, value] of loginAttempts) {
      if (now - value.startedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(key);
    }
  }
}

async function readLoginForm(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    const error = new Error("Form submission is required.");
    error.statusCode = 415;
    throw error;
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) {
      const error = new Error("Form submission is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function handleLogin(request, response) {
  if (!isSiteAuthConfigured()) {
    sendLoginPage(request, response, 503);
    return;
  }

  const address = clientAddress(request);
  if (isLoginRateLimited(address)) {
    sendLoginPage(request, response, 429, "Demasiadas tentativas. Aguarde 15 minutos antes de tentar novamente.");
    return;
  }

  let form;
  try {
    form = await readLoginForm(request);
  } catch {
    sendLoginPage(request, response, 400, "Não foi possível processar o formulário. Tente novamente.");
    return;
  }

  const password = form.get("password");
  const suppliedDigest = createHash("sha256").update(password || "", "utf8").digest();
  const expectedDigest = createHash("sha256").update(process.env.SITE_PASSWORD, "utf8").digest();
  if (typeof password !== "string" || !password || password.length > 1024
    || !timingSafeEqual(suppliedDigest, expectedDigest)) {
    recordFailedLogin(address);
    sendLoginPage(request, response, 401, "Palavra-passe incorrecta.");
    return;
  }

  loginAttempts.delete(address);
  const expiresAt = String(Date.now() + AUTH_SESSION_MS);
  const sessionValue = `${expiresAt}.${sessionSignature(expiresAt)}`;
  const maxAge = Math.floor(AUTH_SESSION_MS / 1000);
  response.writeHead(303, {
    "Cache-Control": "no-store",
    "Location": "/",
    "Set-Cookie": `${AUTH_COOKIE_NAME}=${sessionValue}; HttpOnly; Path=/; Max-Age=${maxAge}${secureCookieAttribute(request)}`,
    "X-Content-Type-Options": "nosniff",
  });
  response.end();
}

function handleLogout(request, response) {
  response.writeHead(303, {
    "Cache-Control": "no-store",
    "Location": "/",
    "Set-Cookie": `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0${secureCookieAttribute(request)}`,
    "X-Content-Type-Options": "nosniff",
  });
  response.end();
}

function isWithinRateLimit(address) {
  const now = Date.now();
  const entry = requestCounts.get(address);

  if (!entry || now - entry.startedAt >= RATE_WINDOW_MS) {
    requestCounts.set(address, { startedAt: now, count: 1 });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

async function readJson(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return phone;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function removeExpiredCheckJobs() {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [jobId, job] of checkJobs) {
    const completedJobExpired = job.finishedAt && job.finishedAt < cutoff;
    const pausedJobExpired = job.status === "paused" && job.pausedAt && job.pausedAt < cutoff;
    if (completedJobExpired || pausedJobExpired) {
      checkJobs.delete(jobId);
      job.phones = null;
      job.resultByNumber = null;
    }
  }
}

async function processCheckJob(job) {
  job.status = "running";
  job.pausedAt = null;

  try {
    const results = await checkNumbersOnOwnWhatsApp(job.phones, {
      onProgress: (progress) => {
        job.completed = progress.completed;
        job.phaseMessage = progress.phaseMessage || null;
        if (Array.isArray(progress.latestBatchResults)) {
          for (const item of progress.latestBatchResults) {
            job.resultByNumber.set(digitsOnly(item.phone), item.status);
            job.partialResults.push(item);
          }
        }
      },
    });
    results.forEach((result) => {
      job.resultByNumber.set(digitsOnly(result.phone), result.status);
    });
    job.completed = job.phones.length;
    job.phaseMessage = null;
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.phaseMessage = null;
  }

  job.results = job.phones.map((phone) => ({
    phone,
    status: job.resultByNumber.get(digitsOnly(phone)) || "unknown",
  }));
  job.phones = null;
  job.resultByNumber = null;
  job.finishedAt = Date.now();
  if (job.status !== "failed") job.status = "completed";
  const cleanupTimer = setTimeout(() => checkJobs.delete(job.id), JOB_RETENTION_MS);
  cleanupTimer.unref?.();
}

async function checkPhones(request, response) {
  const engineState = getEngineState();
  if (!engineState.connected) {
    sendJson(response, 503, {
      code: "missing_credentials",
      error: "Conecte o Motor Próprio do WhatsApp no topo da página (via QR Code ou código de 8 dígitos) para verificar os números.",
    });
    return;
  }

  if (!isWithinRateLimit(clientAddress(request))) {
    sendJson(response, 429, {
      code: "local_rate_limit",
      error: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente.",
    });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, error.statusCode || 400, {
      code: "invalid_request",
      error: error.message,
    });
    return;
  }

  if (!Array.isArray(body.phones) || body.phones.length === 0) {
    sendJson(response, 400, {
      code: "invalid_request",
      error: "Envie uma lista de números para consultar.",
    });
    return;
  }

  const normalizedPhones = body.phones.map(normalizePhone);
  if (normalizedPhones.some((phone) => !phone)) {
    sendJson(response, 400, {
      code: "invalid_phone",
      error: "Todos os números devem estar no formato internacional, por exemplo +258841234567.",
    });
    return;
  }

  const phones = [...new Set(normalizedPhones)];
  if (phones.length > MAX_NUMBERS_PER_CONSULTATION) {
    sendJson(response, 413, {
      code: "consultation_too_large",
      error: `O limite é ${MAX_NUMBERS_PER_CONSULTATION.toLocaleString("pt-PT")} números únicos por lista.`,
    });
    return;
  }

  if (phones.length > MAX_SYNCHRONOUS_NUMBERS) {
    removeExpiredCheckJobs();
    const address = clientAddress(request);
    const hasActiveJob = [...checkJobs.values()].some((job) => (
      job.address === address && ["queued", "running", "paused"].includes(job.status)
    ));
    if (hasActiveJob) {
      sendJson(response, 429, {
        code: "check_already_running",
        error: "Já existe uma verificação em curso. Aguarde que termine antes de iniciar outra.",
      });
      return;
    }

    const job = {
      id: randomUUID(),
      address,
      phones,
      total: phones.length,
      completed: 0,
      status: "queued",
      phaseMessage: "A preparar verificação automática com proteção Anti-Banimento…",
      resultByNumber: new Map(),
      partialResults: [],
      results: null,
      error: null,
      finishedAt: null,
      pausedAt: null,
      pauseVersion: 0,
    };
    checkJobs.set(job.id, job);
    setImmediate(() => {
      void processCheckJob(job);
    });
    sendJson(response, 202, {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      phaseMessage: job.phaseMessage,
    });
    return;
  }

  try {
    const results = await checkNumbersOnOwnWhatsApp(phones);
    sendJson(response, 200, { results });
  } catch (error) {
    sendJson(response, 502, {
      code: "engine_error",
      error: error.message,
    });
  }
}

function getCheckJob(request, response, jobId) {
  removeExpiredCheckJobs();
  const job = checkJobs.get(jobId);
  if (!job || job.address !== clientAddress(request)) {
    sendJson(response, 404, {
      code: "check_not_found",
      error: "A verificação não foi encontrada ou já expirou.",
    });
    return;
  }

  sendJson(response, 200, {
    jobId: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    phaseMessage: job.phaseMessage || null,
    partialResults: job.partialResults || [],
    results: job.results,
    error: job.error,
  });
}

function continueCheckJob(request, response, jobId) {
  removeExpiredCheckJobs();
  const job = checkJobs.get(jobId);
  if (!job || job.address !== clientAddress(request)) {
    sendJson(response, 404, {
      code: "check_not_found",
      error: "A verificação não foi encontrada ou já expirou.",
    });
    return;
  }

  if (job.status === "paused") {
    job.pausedAt = null;
    job.status = "queued";
    job.phaseMessage = "A retomar a próxima divisão em modo seguro…";
    setImmediate(() => {
      void processCheckJob(job);
    });
    sendJson(response, 202, {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      phaseMessage: job.phaseMessage,
    });
    return;
  }

  if (["queued", "running"].includes(job.status)) {
    sendJson(response, 202, {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      phaseMessage: job.phaseMessage,
    });
    return;
  }

  if (["completed", "failed"].includes(job.status)) {
    sendJson(response, 200, {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      phaseMessage: null,
      results: job.results,
      error: job.error,
    });
    return;
  }

  sendJson(response, 409, {
    code: "check_not_paused",
    error: "Esta verificação já terminou ou foi interrompida.",
  });
}

function serveStatic(request, response, pathname) {
  const route = pathname === "/" ? "/index.html" : pathname;
  let decodedRoute;

  try {
    decodedRoute = decodeURIComponent(route);
  } catch {
    sendJson(response, 400, { error: "Caminho inválido." });
    return;
  }

  const isXlsxBundle = decodedRoute === "/vendor/xlsx.full.min.js";
  const filePath = isXlsxBundle
    ? XLSX_BUNDLE_PATH
    : path.resolve(PUBLIC_DIR, `.${decodedRoute}`);
  if (!isXlsxBundle && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendJson(response, 403, { error: "Acesso negado." });
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(response, 404, { error: "Arquivo não encontrado." });
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",
      "Content-Type": contentType,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/healthz" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/auth/login") {
    if (request.method === "POST") {
      void handleLogin(request, response);
    } else {
      sendJson(response, 405, { error: "Método não permitido." });
    }
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    if (request.method === "POST") {
      handleLogout(request, response);
    } else {
      sendJson(response, 405, { error: "Método não permitido." });
    }
    return;
  }

  if (!hasValidAuthSession(request)) {
    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 401, {
        code: "authentication_required",
        error: isSiteAuthConfigured()
          ? "Introduza a palavra-passe para continuar."
          : "O acesso ainda não está configurado. Configure SITE_PASSWORD nas variáveis de ambiente do serviço e reinicie-o.",
      });
    } else if (request.method === "GET" || request.method === "HEAD") {
      sendLoginPage(request, response);
    } else {
      sendJson(response, 401, {
        code: "authentication_required",
        error: "Introduza a palavra-passe para continuar.",
      });
    }
    return;
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    const engineState = getEngineState();
    sendJson(response, 200, {
      provider: "Motor Próprio",
      tokenConfigured: engineState.connected,
      ownEngineConnected: engineState.connected,
      engine: engineState,
      maxNumbersPerConsultation: MAX_NUMBERS_PER_CONSULTATION,
      providerBatchSize: DIVISION_BATCH_SIZE,
    });
    return;
  }

  if (url.pathname === "/api/whatsapp/status" && request.method === "GET") {
    sendJson(response, 200, getEngineState());
    return;
  }

  if (url.pathname === "/api/whatsapp/connect" && request.method === "POST") {
    void startWhatsAppEngine({ resetSession: true })
      .then((state) => sendJson(response, 200, state))
      .catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }

  if (url.pathname === "/api/whatsapp/pair" && request.method === "POST") {
    void (async () => {
      try {
        const body = await readJson(request);
        const rawPhone = String(body?.phone || "").trim();
        const cleanDigits = digitsOnly(rawPhone);
        if (cleanDigits.length < 8 || cleanDigits.length > 15) {
          sendJson(response, 400, {
            error: "Informe o número com indicativo do país (ex.: +258 84 123 4567).",
          });
          return;
        }
        const state = await startWhatsAppEngine({
          resetSession: true,
          requestPairingForPhone: `+${cleanDigits}`,
        });
        sendJson(response, 200, state);
      } catch (error) {
        sendJson(response, error.statusCode || 500, { error: error.message });
      }
    })();
    return;
  }

  if (url.pathname === "/api/whatsapp/protection" && request.method === "POST") {
    void (async () => {
      try {
        const body = await readJson(request);
        const state = setProtectionMode(String(body?.mode || "safe"));
        sendJson(response, 200, state);
      } catch (error) {
        sendJson(response, error.statusCode || 400, { error: error.message });
      }
    })();
    return;
  }

  if (url.pathname === "/api/whatsapp/clear-cache" && request.method === "POST") {
    clearVerifiedCache();
    sendJson(response, 200, getEngineState());
    return;
  }

  if (url.pathname === "/api/whatsapp/disconnect" && request.method === "POST") {
    void disconnectWhatsAppEngine()
      .then((state) => sendJson(response, 200, state))
      .catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }

  const checkJobMatch = url.pathname.match(/^\/api\/check\/([a-f0-9-]{36})$/i);
  if (checkJobMatch && request.method === "GET") {
    getCheckJob(request, response, checkJobMatch[1]);
    return;
  }

  const continueJobMatch = url.pathname.match(/^\/api\/check\/([a-f0-9-]{36})\/continue$/i);
  if (continueJobMatch && request.method === "POST") {
    continueCheckJob(request, response, continueJobMatch[1]);
    return;
  }

  if (url.pathname === "/api/check" && request.method === "POST") {
    void checkPhones(request, response);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Rota da API não encontrada." });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }

  serveStatic(request, response, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`ContactoCheck listening on ${HOST}:${PORT}`);
});