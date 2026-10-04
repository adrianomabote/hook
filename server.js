const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} = require("node:crypto");

const PORT = Number(process.env.PORT || 5000);
const HOST = "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const XLSX_BUNDLE_PATH = path.join(
  path.dirname(require.resolve("xlsx")),
  "dist",
  "xlsx.full.min.js",
);
const ZAPI_BASE_URL = "https://api.z-api.io/instances";
const PROVIDER_BATCH_SIZE = 50_000;
const MAX_SYNCHRONOUS_NUMBERS = 1500;
const MAX_NUMBERS_PER_CONSULTATION = 250_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const AUTH_SESSION_MS = 12 * 60 * 60 * 1000;
const AUTH_COOKIE_NAME = "contactocheck_session";
const MAX_ACTIVE_JOBS_PER_ADDRESS = 1;
const JOB_RETENTION_MS = 30 * 60 * 1000;
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
  return Boolean(process.env.SITE_PASSWORD && process.env.SESSION_SECRET);
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
  return createHmac("sha256", process.env.SESSION_SECRET)
    .update(`contactocheck:${expiresAt}:${passwordFingerprint}`, "utf8")
    .digest("base64url");
}

function hasValidAuthSession(request) {
  if (!isSiteAuthConfigured()) return false;

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
  return isHttps ? "; Secure" : "";
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
         <label for="password">Palavra-passe</label>
         <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
         <button type="submit">Entrar</button>
       </form>`
    : `<p class="notice" role="alert">O acesso ainda não está configurado. Adicione o secret <strong>SITE_PASSWORD</strong> nas variáveis secretas do projecto.</p>`;
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
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
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
    "Set-Cookie": `${AUTH_COOKIE_NAME}=${sessionValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookieAttribute(request)}`,
    "X-Content-Type-Options": "nosniff",
  });
  response.end();
}

function handleLogout(request, response) {
  response.writeHead(303, {
    "Cache-Control": "no-store",
    "Location": "/",
    "Set-Cookie": `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookieAttribute(request)}`,
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

function safeProviderMessage(message) {
  let safeMessage = typeof message === "string" ? message.replace(/\s+/g, " ").trim() : "";
  if (!safeMessage) return "";

  for (const secret of [
    process.env.ZAPI_INSTANCE_ID,
    process.env.ZAPI_TOKEN,
    process.env.ZAPI_CLIENT_TOKEN,
  ]) {
    if (typeof secret === "string" && secret) {
      safeMessage = safeMessage.split(secret).join("[valor oculto]");
    }
  }

  return safeMessage
    .replace(/https?:\/\/\S+/gi, "[URL oculto]")
    .replace(/\+?\d(?:[\s().-]*\d){7,14}/g, "[número oculto]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[valor oculto]")
    .slice(0, 240);
}

function extractProviderMessage(errorBody) {
  if (typeof errorBody === "string") return errorBody;
  if (!errorBody || typeof errorBody !== "object") return "";

  const fields = [
    errorBody.message,
    errorBody.error,
    errorBody.detail,
    errorBody.error_description,
    errorBody.description,
    errorBody.code,
  ];
  return fields.find((value) => typeof value === "string" && value.trim()) || "";
}

function providerErrorMessage(statusCode, providerMessage = "") {
  const safeMessage = safeProviderMessage(providerMessage);
  const normalizedMessage = safeMessage.toLowerCase();
  if (statusCode === 401) {
    return "A Z-API recusou as credenciais. Confira o ID e o token da instância e, se estiver ativo, o token de segurança da conta.";
  }
  if (statusCode === 402) {
    return "A Z-API recusou a consulta por quota ou limite do plano. Verifique o limite da conta; números sem resposta continuam não confirmados.";
  }
  if (statusCode === 403) {
    return "A Z-API não autorizou esta consulta. Confira o estado e as permissões da instância.";
  }
  if (statusCode === 404) {
    return "A instância ou rota da Z-API não foi encontrada. Confira o ID da instância.";
  }
  if (statusCode === 429) {
    return "A Z-API limitou temporariamente as consultas. Aguarde e tente novamente.";
  }
  if (statusCode === 400) {
    if (/client-token.*not configured/.test(normalizedMessage)) {
      return "A Z-API informa que o Token de Segurança da Conta não está configurado. Confirme a activação no painel e que ZAPI_CLIENT_TOKEN corresponde ao token activo.";
    }
    if (/instance not found/.test(normalizedMessage)) {
      return "A Z-API não encontrou a instância. Confirme que o ID e o token actuais pertencem à mesma instância activa e que ambos foram guardados no Replit.";
    }
    if (normalizedMessage.includes("null not allowed")) {
      return "A Z-API exige o token de segurança da conta. Confira o secret ZAPI_CLIENT_TOKEN.";
    }
    if (/phone|number|telefone|número/.test(normalizedMessage)) {
      return "A Z-API rejeitou o formato do número enviado.";
    }
    if (safeMessage) {
      return `A Z-API rejeitou a requisição: ${safeMessage}`;
    }
    return "A Z-API rejeitou a requisição. Confira o ID e token da instância e o token de segurança da conta.";
  }
  return `O serviço não concluiu a consulta (HTTP ${statusCode}).`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestProviderContacts(phones) {
  const maxAttempts = 3;
  const instanceId = encodeURIComponent(process.env.ZAPI_INSTANCE_ID);
  const token = encodeURIComponent(process.env.ZAPI_TOKEN);
  const isSinglePhone = phones.length === 1;
  const phonePath = isSinglePhone
    ? `/phone-exists/${encodeURIComponent(digitsOnly(phones[0]))}`
    : "/phone-exists-batch";
  const endpoint = `${ZAPI_BASE_URL}/${instanceId}/token/${token}${phonePath}`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (process.env.ZAPI_CLIENT_TOKEN) {
    headers["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let providerResponse;

    try {
      providerResponse = await fetch(endpoint, {
        method: isSinglePhone ? "GET" : "POST",
        headers,
        ...(isSinglePhone ? {} : { body: JSON.stringify({ phones: phones.map(digitsOnly) }) }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt + 1 === maxAttempts) {
        throw new Error(
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "A consulta demorou demais. Tente novamente."
            : "Não foi possível conectar ao serviço. Tente novamente mais tarde.",
        );
      }
      await wait(1000 * (attempt + 1));
      continue;
    }

    if (providerResponse.status === 429 && attempt + 1 < maxAttempts) {
      const retryAfter = Number(providerResponse.headers?.get?.("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 60) * 1000
        : 1000 * (attempt + 1);
      await wait(delay);
      continue;
    }

    if (!providerResponse.ok) {
      let providerMessage = "";
      try {
        const responseText = await providerResponse.clone().text();
        let errorBody = responseText;
        try {
          errorBody = JSON.parse(responseText);
        } catch {
          // Keep a plain-text provider error available for safe sanitization.
        }
        providerMessage = extractProviderMessage(errorBody);
      } catch {
        // Keep upstream error bodies out of logs and user-facing responses.
      }
      const error = new Error(providerErrorMessage(providerResponse.status, providerMessage));
      error.providerStatus = providerResponse.status;
      throw error;
    }

    let data;
    try {
      data = await providerResponse.json();
    } catch {
      throw new Error("O serviço devolveu uma resposta que não pôde ser interpretada.");
    }

    if (
      isSinglePhone &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.exists === "boolean"
    ) {
      data = [data];
    }

    if (!Array.isArray(data)) {
      throw new Error("A resposta da Z-API não contém a lista de resultados esperada.");
    }

    const resultByNumber = new Map();
    for (const contact of data) {
      const inputPhone = contact?.inputPhone ?? contact?.phone ?? contact?.outputPhone;
      const resultPhone = typeof inputPhone === "string" && digitsOnly(inputPhone)
        ? digitsOnly(inputPhone)
        : isSinglePhone && typeof contact?.exists === "boolean"
          ? digitsOnly(phones[0])
          : "";
      if (!resultPhone) continue;
      const status = typeof contact?.exists === "boolean"
        ? contact.exists ? "valid" : "invalid"
        : "unknown";
      resultByNumber.set(resultPhone, status);
    }

    return phones.map((phone) => ({
      phone,
      status: resultByNumber.get(digitsOnly(phone)) || "unknown",
    }));
  }

  throw new Error("O serviço não concluiu a consulta. Tente novamente.");
}

function removeExpiredCheckJobs() {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [jobId, job] of checkJobs) {
    if (job.finishedAt && job.finishedAt < cutoff) checkJobs.delete(jobId);
  }
}

async function processCheckJob(job) {
  job.status = "running";
  const resultByNumber = new Map();

  for (let offset = 0; offset < job.phones.length; offset += PROVIDER_BATCH_SIZE) {
    const batch = job.phones.slice(offset, offset + PROVIDER_BATCH_SIZE);
    try {
      const results = await requestProviderContacts(batch);
      results.forEach((result) => {
        resultByNumber.set(digitsOnly(result.phone), result.status);
      });
      job.completed += batch.length;
    } catch (error) {
      job.status = "failed";
      job.error = error.message;
      break;
    }
  }

  job.results = job.phones.map((phone) => ({
    phone,
    status: resultByNumber.get(digitsOnly(phone)) || "unknown",
  }));
  job.phones = null;
  job.finishedAt = Date.now();
  if (job.status !== "failed") job.status = "completed";
  const cleanupTimer = setTimeout(() => checkJobs.delete(job.id), JOB_RETENTION_MS);
  cleanupTimer.unref?.();
}

async function checkPhones(request, response) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  if (!instanceId || !token) {
    sendJson(response, 503, {
      code: "missing_credentials",
      error: "Adicione os secrets ZAPI_INSTANCE_ID e ZAPI_TOKEN para ativar as consultas.",
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
      error: "Todos os números devem estar no formato internacional, por exemplo +351912345678.",
    });
    return;
  }

  const phones = [...new Set(normalizedPhones)];
  if (phones.length > MAX_NUMBERS_PER_CONSULTATION) {
    sendJson(response, 413, {
      code: "consultation_too_large",
      error: `Consulte no máximo ${MAX_NUMBERS_PER_CONSULTATION.toLocaleString("pt-PT")} números únicos por verificação.`,
    });
    return;
  }

  if (phones.length > MAX_SYNCHRONOUS_NUMBERS) {
    removeExpiredCheckJobs();
    const address = clientAddress(request);
    const hasActiveJob = [...checkJobs.values()].some((job) => (
      job.address === address && ["queued", "running"].includes(job.status)
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
      results: null,
      error: null,
      finishedAt: null,
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
    });
    return;
  }

  try {
    const results = await requestProviderContacts(phones);
    sendJson(response, 200, { results });
  } catch (error) {
    sendJson(response, 502, {
      code: error.providerStatus ? "provider_error" : "provider_unavailable",
      providerStatus: error.providerStatus,
      error: error.message,
    });
  }
}

function getCheckJob(request, response, jobId) {
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
    results: job.results,
    error: job.error,
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
          : "O acesso ainda não está configurado. Adicione o secret SITE_PASSWORD.",
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
    sendJson(response, 200, {
      provider: "Z-API",
      tokenConfigured: Boolean(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN),
      maxNumbersPerConsultation: MAX_NUMBERS_PER_CONSULTATION,
      providerBatchSize: PROVIDER_BATCH_SIZE,
    });
    return;
  }

  const checkJobMatch = url.pathname.match(/^\/api\/check\/([a-f0-9-]{36})$/i);
  if (checkJobMatch && request.method === "GET") {
    getCheckJob(request, response, checkJobMatch[1]);
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
  console.log(`WhatsApp number checker listening on ${HOST}:${PORT}`);
});