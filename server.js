const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

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
const MAX_ACTIVE_JOBS_PER_ADDRESS = 1;
const JOB_RETENTION_MS = 30 * 60 * 1000;
const requestCounts = new Map();
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

    if (!Array.isArray(data)) {
      throw new Error("A resposta da Z-API não contém a lista de resultados esperada.");
    }

    const resultByNumber = new Map();
    for (const contact of data) {
      const inputPhone = contact?.inputPhone ?? contact?.phone ?? contact?.outputPhone;
      if (typeof inputPhone !== "string" || !digitsOnly(inputPhone)) continue;
      const status = typeof contact?.exists === "boolean"
        ? contact.exists ? "valid" : "invalid"
        : "unknown";
      resultByNumber.set(digitsOnly(inputPhone), status);
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