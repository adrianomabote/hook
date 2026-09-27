const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5000);
const HOST = "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const XLSX_BUNDLE_PATH = path.join(
  path.dirname(require.resolve("xlsx")),
  "dist",
  "xlsx.full.min.js",
);
const WHAPI_URL = "https://gate.whapi.cloud/contacts";
const MAX_PHONES_PER_REQUEST = 50;
const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map();

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

function providerErrorMessage(statusCode) {
  if (statusCode === 401) {
    return "O token foi recusado ou o canal WhatsApp ainda não está autorizado.";
  }
  if (statusCode === 402) {
    return "O limite de consultas do plano atual foi atingido.";
  }
  if (statusCode === 429) {
    return "O serviço limitou temporariamente as consultas. Aguarde e tente novamente.";
  }
  if (statusCode === 400) {
    return "O serviço rejeitou os parâmetros enviados. Confira o formato internacional dos números.";
  }
  return `O serviço não concluiu a consulta (HTTP ${statusCode}).`;
}

async function checkPhones(request, response) {
  const token = process.env.WHAPI_TOKEN;
  if (!token) {
    sendJson(response, 503, {
      code: "missing_token",
      error: "Adicione o secret WHAPI_TOKEN para ativar as consultas.",
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

  if (body.phones.length > MAX_PHONES_PER_REQUEST) {
    sendJson(response, 413, {
      code: "batch_too_large",
      error: `Consulte no máximo ${MAX_PHONES_PER_REQUEST} números por lote.`,
    });
    return;
  }

  const phones = body.phones.map(normalizePhone);
  if (phones.some((phone) => !phone)) {
    sendJson(response, 400, {
      code: "invalid_phone",
      error: "Todos os números devem estar no formato internacional, por exemplo +351912345678.",
    });
    return;
  }

  try {
    const providerResponse = await fetch(WHAPI_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contacts: phones }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!providerResponse.ok) {
      sendJson(response, 502, {
        code: "provider_error",
        providerStatus: providerResponse.status,
        error: providerErrorMessage(providerResponse.status),
      });
      return;
    }

    let data;
    try {
      data = await providerResponse.json();
    } catch {
      sendJson(response, 502, {
        code: "invalid_provider_response",
      error: "O serviço devolveu uma resposta que não pôde ser interpretada.",
      });
      return;
    }

    if (!Array.isArray(data.contacts)) {
      sendJson(response, 502, {
        code: "invalid_provider_response",
      error: "A resposta do serviço não contém a lista de resultados esperada.",
      });
      return;
    }

    const resultByNumber = new Map(
      data.contacts.map((contact) => [
        digitsOnly(contact.input),
        contact.status === "valid" || contact.status === "invalid"
          ? contact.status
          : "unknown",
      ]),
    );

    const results = phones.map((phone) => ({
      phone,
      status: resultByNumber.get(digitsOnly(phone)) || "unknown",
    }));

    sendJson(response, 200, { results });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    sendJson(response, 502, {
      code: timedOut ? "provider_timeout" : "provider_unavailable",
      error: timedOut
        ? "A consulta demorou demais. Tente novamente."
        : "Não foi possível conectar ao serviço. Tente novamente mais tarde.",
    });
  }
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
      provider: "Whapi.Cloud",
      tokenConfigured: Boolean(process.env.WHAPI_TOKEN),
      maxPhonesPerRequest: MAX_PHONES_PER_REQUEST,
    });
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