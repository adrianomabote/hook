const MAX_UNIQUE_PER_RUN = 50_000;
const PROVIDER_BATCH_SIZE = 50_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 12;
let xlsxLibraryPromise = null;

const elements = {
  singleTab: document.querySelector("#singleTab"),
  batchTab: document.querySelector("#batchTab"),
  singlePanel: document.querySelector("#singlePanel"),
  batchPanel: document.querySelector("#batchPanel"),
  singleForm: document.querySelector("#singleForm"),
  singlePhone: document.querySelector("#singlePhone"),
  singleCountry: document.querySelector("#singleCountry"),
  singleCustomDial: document.querySelector("#singleCustomDial"),
  singleCheckButton: document.querySelector("#singleCheckButton"),
  singleResult: document.querySelector("#singleResult"),
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  chooseFileButton: document.querySelector("#chooseFileButton"),
  fileSummary: document.querySelector("#fileSummary"),
  fileIcon: document.querySelector("#fileIcon"),
  fileName: document.querySelector("#fileName"),
  fileCount: document.querySelector("#fileCount"),
  removeFileButton: document.querySelector("#removeFileButton"),
  pasteInput: document.querySelector("#pasteInput"),
  loadPasteButton: document.querySelector("#loadPasteButton"),
  importSettings: document.querySelector("#importSettings"),
  phoneColumn: document.querySelector("#phoneColumn"),
  batchCountry: document.querySelector("#batchCountry"),
  batchCustomDial: document.querySelector("#batchCustomDial"),
  hasHeader: document.querySelector("#hasHeader"),
  headerSetting: document.querySelector("#headerSetting"),
  importPreview: document.querySelector("#importPreview"),
  previewTitle: document.querySelector("#previewTitle"),
  previewDetails: document.querySelector("#previewDetails"),
  batchCheckButton: document.querySelector("#batchCheckButton"),
  batchButtonHint: document.querySelector("#batchButtonHint"),
  batchAlert: document.querySelector("#batchAlert"),
  progressWrap: document.querySelector("#progressWrap"),
  progressLabel: document.querySelector("#progressLabel"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  resultsSection: document.querySelector("#resultsSection"),
  batchSessionHint: document.querySelector("#batchSessionHint"),
  validCount: document.querySelector("#validCount"),
  invalidCount: document.querySelector("#invalidCount"),
  formatCount: document.querySelector("#formatCount"),
  unknownCount: document.querySelector("#unknownCount"),
  resultsBody: document.querySelector("#resultsBody"),
  resultFilter: document.querySelector("#resultFilter"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  tableFootnote: document.querySelector("#tableFootnote"),
  exportFormat: document.querySelector("#exportFormat"),
  exportValidButton: document.querySelector("#exportValidButton"),
  copyValidButton: document.querySelector("#copyValidButton"),
  exportInvalidButton: document.querySelector("#exportInvalidButton"),
  exportAllButton: document.querySelector("#exportAllButton"),
  sessionControls: document.querySelector("#sessionControls"),
  sessionStatus: document.querySelector("#sessionStatus"),
  concludeSessionButton: document.querySelector("#concludeSessionButton"),
  newSessionButton: document.querySelector("#newSessionButton"),
  historyStatus: document.querySelector("#historyStatus"),
  historyList: document.querySelector("#historyList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
};

const EXPORT_HISTORY_DB = "contactocheck-export-history";
const EXPORT_HISTORY_STORE = "verified-files";
let exportHistoryDbPromise = null;

const state = {
  tokenConfigured: false,
  checking: false,
  imported: null,
  results: [],
  filter: "all",
  session: {
    started: false,
    concluded: false,
    checkedPhones: new Set(),
  },
};

function getDialDigits(select, customInput) {
  let value = select.value;
  if (value === "custom") value = customInput.value.trim();
  const digits = String(value).replace(/\D/g, "");
  if (!/^[1-9]\d{0,2}$/.test(digits)) return null;
  return digits;
}

function normalizePhone(value, select, customInput) {
  const raw = String(value ?? "").trim();
  if (!raw) return { phone: null, reason: "Número vazio" };

  const internationalPlus = raw.startsWith("+");
  const international00 = raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");

  if (!digits) return { phone: null, reason: "Não contém números" };

  if (international00) {
    digits = digits.slice(2);
  } else if (!internationalPlus) {
    const dialDigits = getDialDigits(select, customInput);
    if (!dialDigits) {
      return { phone: null, reason: "Informe o indicativo do país" };
    }

    if (!(digits.startsWith(dialDigits) && digits.length > dialDigits.length + 7)) {
      const nationalDigits = digits.startsWith("0") ? digits.slice(1) : digits;
      digits = dialDigits + nationalDigits;
    }
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return { phone: null, reason: "Número fora do formato internacional" };
  }

  return { phone: `+${digits}`, reason: null };
}

function parseDelimitedText(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = cleaned.split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiter = [",", ";", "\t"].map((character) => ({
    character,
    count: firstLine.split(character).length - 1,
  })).sort((a, b) => b.count - a.count)[0];
  const separator = delimiter && delimiter.count > 0 ? delimiter.character : ",";

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < cleaned.length; index += 1) {
    const character = cleaned[index];

    if (character === '"') {
      if (quoted && cleaned[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === separator) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && cleaned[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return { rows, delimiter: separator };
}

function parsePastedContacts(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = cleaned.split(/\r\n?|\n/).find((line) => line.trim()) || "";
  if (!/[,;\t]/.test(firstLine)) {
    const rows = [];
    for (const line of cleaned.split(/\r\n?|\n/)) {
      const phone = line.trim();
      if (phone) rows.push([phone]);
    }
    return { rows, delimiter: ",", simple: true };
  }

  const parsed = parseDelimitedText(cleaned);
  const cells = parsed.rows.flatMap((row) => row.filter((cell) => cell.trim()));
  const isPhoneLike = (value) => (
    /\d/.test(value) && /^[+\d\s()./-]+$/.test(value.trim())
  );

  if (parsed.rows.length === 1 && cells.length > 1 && cells.every(isPhoneLike)) {
    return {
      rows: cells.map((phone) => [phone]),
      delimiter: parsed.delimiter,
      simple: true,
    };
  }

  return { ...parsed, simple: false };
}

function loadSpreadsheetLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibraryPromise) return xlsxLibraryPromise;

  xlsxLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/xlsx.full.min.js";
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        xlsxLibraryPromise = null;
        reject(new Error("O leitor de ficheiros Excel não está disponível."));
      }
    };
    script.onerror = () => {
      xlsxLibraryPromise = null;
      reject(new Error("Não foi possível carregar o leitor de ficheiros Excel."));
    };
    document.head.append(script);
  });

  return xlsxLibraryPromise;
}

async function parseSpreadsheet(buffer) {
  const XLSX = await loadSpreadsheetLibrary();
  if (!XLSX) {
    throw new Error("O leitor de ficheiros Excel não está disponível.");
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("O ficheiro Excel não contém folhas.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  return {
    rows: rows.map((row) => row.map((cell) => String(cell ?? ""))),
    sheetName: firstSheetName,
  };
}

function normalizedHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findPhoneHeader(row) {
  const headerTerms = [
    "telefone",
    "phone",
    "phonenumber",
    "celular",
    "telemovel",
    "mobile",
    "whatsapp",
    "fone",
    "numero",
    "number",
  ];
  return row.findIndex((cell) => headerTerms.some((term) => normalizedHeader(cell).includes(term)));
}

function choosePhoneColumn(rows, hasHeader, select, customInput) {
  const startAt = hasHeader ? 1 : 0;
  const columnCount = rows.reduce((largest, row) => Math.max(largest, row.length), 1);
  let bestColumn = 0;
  let bestScore = -1;

  for (let column = 0; column < columnCount; column += 1) {
    const sample = rows.slice(startAt, Math.min(rows.length, startAt + 100));
    const score = sample.reduce((total, row) => (
      normalizePhone(row[column] || "", select, customInput).phone ? total + 1 : total
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }

  return bestColumn;
}

function createImport(rows, fileName, options = {}) {
  if (state.session.concluded) {
    showBatchAlert("Esta sessão foi concluída. Inicie uma nova sessão antes de importar outra lista.", true);
    return;
  }
  if (state.checking) {
    showBatchAlert("Aguarde que o lote atual termine antes de importar outra lista.", true);
    return;
  }
  if (!rows.length) {
    showBatchAlert("Não encontrei linhas com dados nesse ficheiro.", true);
    return;
  }

  const detectedPhoneColumn = findPhoneHeader(rows[0]);
  const hasHeader = detectedPhoneColumn !== -1;
  const headers = hasHeader
    ? rows[0].map((cell, index) => cell.trim() || `Coluna ${index + 1}`)
    : rows[0].map((_, index) => `Coluna ${index + 1}`);
  const importState = {
    fileName,
    fileType: options.fileType || (fileName.match(/\.([^.]+)$/)?.[1] || "csv").toLowerCase(),
    delimiter: options.delimiter || ",",
    sheetName: options.sheetName || "Contactos",
    rawRows: rows,
    headers,
    fastSimplePaste: Boolean(options.fastSimplePaste),
    headerDetected: hasHeader,
    hasHeader,
    detectedPhoneColumn: hasHeader ? detectedPhoneColumn : 0,
    phoneColumn: options.fastSimplePaste
      ? 0
      : hasHeader
        ? detectedPhoneColumn
        : choosePhoneColumn(rows, false, elements.batchCountry, elements.batchCustomDial),
  };

  state.imported = importState;
  elements.hasHeader.checked = hasHeader;
  elements.fileName.textContent = fileName;
  elements.fileIcon.textContent = fileName === "Lista colada"
    ? "TXT"
    : (fileName.split(".").pop() || "FILE").slice(0, 4).toUpperCase();
  elements.fileSummary.hidden = false;
  elements.importSettings.hidden = false;
  elements.importPreview.hidden = false;
  elements.headerSetting.hidden = false;
  elements.phoneColumn.replaceChildren();

  headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = header;
    elements.phoneColumn.append(option);
  });

  elements.phoneColumn.value = String(importState.phoneColumn);
  elements.batchAlert.hidden = true;
  updateImportPreview();
  updateBatchButton();
}

function activeRows() {
  if (!state.imported) return [];
  return state.imported.hasHeader
    ? state.imported.rawRows.slice(1)
    : state.imported.rawRows;
}

function buildRecords() {
  if (!state.imported) return [];
  const rows = activeRows();
  const sourceHeaders = state.imported.hasHeader
    ? state.imported.rawRows[0].map((cell, index) => cell.trim() || `Coluna ${index + 1}`)
    : state.imported.headers;
  return rows.map((cells, index) => {
    const raw = String(cells[state.imported.phoneColumn] || "").trim();
    const normalized = normalizePhone(raw, elements.batchCountry, elements.batchCustomDial);
    return {
      cells,
      index,
      raw,
      sourceHeaders: [...sourceHeaders],
      sourceName: state.imported.fileName,
      sourceSheetName: state.imported.sheetName,
      phone: normalized.phone,
      reason: normalized.reason,
      status: normalized.phone ? "unknown" : "invalid_format",
    };
  });
}

function updateImportPreview() {
  if (!state.imported) return;
  if (state.imported.fastSimplePaste) {
    const pastedCount = activeRows().length;
    elements.fileCount.textContent = `${pastedCount.toLocaleString("pt-PT")} contactos`;
    elements.previewTitle.textContent = `${pastedCount.toLocaleString("pt-PT")} contactos colados`;
    elements.previewDetails.textContent = "Lista pronta. O formato dos números será confirmado ao iniciar a consulta.";
    updateBatchButton();
    return;
  }

  const records = buildRecords();
  const readyCount = records.filter((record) => record.phone).length;
  const invalidCount = records.length - readyCount;
  elements.fileCount.textContent = `${records.length.toLocaleString("pt-PT")} linhas`;
  elements.previewTitle.textContent = `${readyCount.toLocaleString("pt-PT")} números prontos para consultar`;
  elements.previewDetails.textContent = invalidCount
    ? `${invalidCount.toLocaleString("pt-PT")} linhas precisam de revisão.`
    : `Coluna selecionada: ${state.imported.headers[state.imported.phoneColumn]}.`;
  updateBatchButton();
}

function updateBatchButton() {
  const hasData = Boolean(state.imported && activeRows().length);
  const enabled = state.tokenConfigured && hasData && !state.checking && !state.session.concluded;
  elements.batchCheckButton.disabled = !enabled;
  elements.batchCheckButton.querySelector("span").textContent = state.checking
    ? "A consultar…"
    : state.session.started && !state.session.concluded
      ? "Verificar e adicionar lote"
      : "Verificar lista";

  const importDisabled = state.checking || state.session.concluded;
  elements.chooseFileButton.disabled = importDisabled;
  elements.fileInput.disabled = importDisabled;
  elements.loadPasteButton.disabled = importDisabled;
  elements.pasteInput.disabled = importDisabled;
  elements.dropzone.classList.toggle("is-disabled", importDisabled);

  if (state.session.concluded) {
    elements.batchButtonHint.textContent = "A sessão foi concluída. Inicie uma nova sessão para verificar outra lista.";
  } else if (!state.tokenConfigured) {
    elements.batchButtonHint.textContent = "Adicione os secrets ZAPI_INSTANCE_ID e ZAPI_TOKEN para ativar.";
  } else if (!hasData) {
    elements.batchButtonHint.textContent = "Importe CSV, TXT ou Excel, ou cole uma lista de números.";
  } else {
    elements.batchButtonHint.textContent = state.session.started
      ? `Até ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")} números novos por lote. Números já incluídos nesta sessão não são consultados novamente.`
      : `Até ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")} números únicos. Acima de 1.500, a consulta continua em segundo plano; não são enviadas mensagens.`;
  }

  elements.batchSessionHint.hidden = !state.session.started || state.session.concluded;
  elements.batchSessionHint.textContent = state.session.started && !state.session.concluded
    ? "Sessão aberta: importe outra lista ou cole mais números para os juntar aos resultados atuais."
    : "";
  updateSessionControls();
}

function showBatchAlert(message, isError = false) {
  elements.batchAlert.textContent = message;
  elements.batchAlert.classList.toggle("is-error", isError);
  elements.batchAlert.hidden = !message;
}

function setMode(mode) {
  const single = mode === "single";
  elements.singleTab.classList.toggle("is-active", single);
  elements.batchTab.classList.toggle("is-active", !single);
  elements.singleTab.setAttribute("aria-selected", String(single));
  elements.batchTab.setAttribute("aria-selected", String(!single));
  elements.singlePanel.hidden = !single;
  elements.batchPanel.hidden = single;
}

function setConnectionState(configured) {
  state.tokenConfigured = Boolean(configured);
  elements.singleCheckButton.disabled = !state.tokenConfigured || state.checking;
  updateBatchButton();
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const health = await response.json();
    setConnectionState(response.ok && health.tokenConfigured);
  } catch {
    setConnectionState(false);
  }
}

function showSingleResult(status, title, detail) {
  elements.singleResult.className = `inline-result is-${status}`;
  const symbol = status === "valid" ? "✓" : status === "invalid" ? "×" : "!";
  elements.singleResult.innerHTML = `
    <span class="result-symbol" aria-hidden="true">${symbol}</span>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
  `;
  elements.singleResult.hidden = false;
}

async function requestCheck(phones, onProgress) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phones }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor devolveu uma resposta inválida.");
  }
  if (!response.ok) throw new Error(data.error || "Não foi possível consultar os números.");
  if (Array.isArray(data.results)) return data.results;
  if (!data.jobId) throw new Error("A resposta não contém resultados.");

  let completed = 0;
  let pollingErrors = 0;
  onProgress?.(completed, data.total || phones.length);

  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    let statusResponse;
    try {
      statusResponse = await fetch(`/api/check/${encodeURIComponent(data.jobId)}`, {
        cache: "no-store",
      });
    } catch {
      pollingErrors += 1;
      if (pollingErrors >= 10) {
        throw new Error("A ligação foi interrompida. Consulte novamente o estado da verificação.");
      }
      continue;
    }

    let statusData;
    try {
      statusData = await statusResponse.json();
    } catch {
      throw new Error("O servidor devolveu o estado da verificação num formato inválido.");
    }
    if (!statusResponse.ok) {
      throw new Error(statusData.error || "Não foi possível obter o estado da verificação.");
    }

    pollingErrors = 0;
    completed = Number(statusData.completed) || 0;
    onProgress?.(completed, Number(statusData.total) || phones.length);

    if (statusData.status === "completed") {
      if (!Array.isArray(statusData.results)) {
        throw new Error("A verificação terminou sem devolver os resultados.");
      }
      return statusData.results;
    }
    if (statusData.status === "failed") {
      const error = new Error(statusData.error || "A verificação foi interrompida pelo serviço.");
      error.results = Array.isArray(statusData.results) ? statusData.results : [];
      throw error;
    }
    if (!["queued", "running"].includes(statusData.status)) {
      throw new Error("O estado da verificação não é reconhecido.");
    }
  }
}

function statusTitle(status) {
  if (status === "valid") return "Tem WhatsApp";
  if (status === "invalid") return "Não tem WhatsApp";
  if (status === "invalid_format") return "Formato inválido";
  if (status === "pending") return "A consultar";
  return "Não confirmado";
}

function statusDescription(status) {
  if (status === "valid") return "O serviço encontrou uma conta para este número.";
  if (status === "invalid") return "O serviço não encontrou uma conta para este número.";
  if (status === "invalid_format") return "Confira o número e o indicativo do país.";
  if (status === "pending") return "A consulta está em curso.";
  return "O serviço não devolveu uma resposta conclusiva.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

elements.singleTab.addEventListener("click", () => setMode("single"));
elements.batchTab.addEventListener("click", () => setMode("batch"));

elements.singleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.tokenConfigured || state.checking) return;

  const parsed = normalizePhone(
    elements.singlePhone.value,
    elements.singleCountry,
    elements.singleCustomDial,
  );
  if (!parsed.phone) {
    showSingleResult("unknown", "Número não reconhecido", parsed.reason || "Confira o número informado.");
    return;
  }

  state.checking = true;
  elements.singleCheckButton.disabled = true;
  elements.singleCheckButton.querySelector("span").textContent = "A consultar…";
  showSingleResult("unknown", "A consultar número", parsed.phone);

  try {
    const [result] = await requestCheck([parsed.phone]);
    showSingleResult(result.status, statusTitle(result.status), statusDescription(result.status));
  } catch (error) {
    showSingleResult("unknown", "Consulta não concluída", error.message);
  } finally {
    state.checking = false;
    elements.singleCheckButton.querySelector("span").textContent = "Verificar";
    elements.singleCheckButton.disabled = !state.tokenConfigured;
    updateBatchButton();
  }
});

function setCustomDialVisibility(select, input) {
  const isCustom = select.value === "custom";
  input.hidden = !isCustom;
  if (isCustom) input.focus();
}

elements.singleCountry.addEventListener("change", () => {
  setCustomDialVisibility(elements.singleCountry, elements.singleCustomDial);
});
elements.batchCountry.addEventListener("change", () => {
  setCustomDialVisibility(elements.batchCountry, elements.batchCustomDial);
  if (state.imported) updateImportPreview();
});
elements.batchCustomDial.addEventListener("input", updateImportPreview);
elements.singleCustomDial.addEventListener("input", () => {
  elements.singleCheckButton.disabled = !state.tokenConfigured || state.checking;
});

function chooseAutoColumn() {
  if (!state.imported) return;
  state.imported.phoneColumn = state.imported.headerDetected
    ? state.imported.detectedPhoneColumn
    : choosePhoneColumn(
      state.imported.rawRows,
      state.imported.hasHeader,
      elements.batchCountry,
      elements.batchCustomDial,
    );
  elements.phoneColumn.value = String(state.imported.phoneColumn);
}

elements.batchCountry.addEventListener("change", chooseAutoColumn);
elements.batchCustomDial.addEventListener("input", chooseAutoColumn);

elements.phoneColumn.addEventListener("change", () => {
  if (!state.imported) return;
  state.imported.phoneColumn = Number(elements.phoneColumn.value);
  updateImportPreview();
});

elements.hasHeader.addEventListener("change", () => {
  if (!state.imported) return;
  state.imported.hasHeader = elements.hasHeader.checked;
  updateImportPreview();
});

function importRows(rows, fileName, options) {
  createImport(rows, fileName, options);
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showBatchAlert("O ficheiro excede 5 MB. Divida-o em ficheiros mais pequenos.", true);
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  if (!["csv", "txt", "xlsx", "xls"].includes(extension)) {
    showBatchAlert("Formato não suportado. Use CSV, TXT, XLSX ou XLS.", true);
    return;
  }

  try {
    const parsed = ["xlsx", "xls"].includes(extension)
      ? await parseSpreadsheet(await file.arrayBuffer())
      : parseDelimitedText(await file.text());
    const rows = Array.isArray(parsed) ? parsed : parsed.rows;
    importRows(rows, file.name, {
      fileType: extension,
      delimiter: parsed.delimiter,
      sheetName: parsed.sheetName,
    });
  } catch {
    showBatchAlert("Não consegui ler o ficheiro. Confirme se é um CSV, TXT ou ficheiro Excel válido.", true);
  }
}

elements.chooseFileButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));

elements.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("is-dragging");
});
elements.dropzone.addEventListener("dragleave", () => {
  elements.dropzone.classList.remove("is-dragging");
});
elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("is-dragging");
  loadFile(event.dataTransfer.files[0]);
});

elements.loadPasteButton.addEventListener("click", () => {
  const pasted = parsePastedContacts(elements.pasteInput.value);
  if (!pasted.rows.length) {
    showBatchAlert("Cole pelo menos um número, um por linha.", true);
    return;
  }
  importRows(pasted.rows, "Lista colada", {
    fileType: "txt",
    delimiter: pasted.delimiter,
    fastSimplePaste: pasted.simple,
  });
});

elements.removeFileButton.addEventListener("click", () => {
  state.imported = null;
  state.results = [];
  elements.fileInput.value = "";
  elements.fileSummary.hidden = true;
  elements.importSettings.hidden = true;
  elements.importPreview.hidden = true;
  elements.resultsSection.hidden = true;
  elements.batchAlert.hidden = true;
  updateBatchButton();
});

elements.batchCheckButton.addEventListener("click", runBatchCheck);

function renderProgress(done, total, label) {
  const percentage = total ? Math.round((done / total) * 100) : 100;
  elements.progressWrap.hidden = false;
  elements.progressLabel.textContent = label;
  elements.progressPercent.textContent = `${percentage}%`;
  elements.progressBar.style.width = `${percentage}%`;
}

async function runBatchCheck() {
  if (!state.imported || !state.tokenConfigured || state.checking) return;
  const records = buildRecords();
  const uniquePhones = [...new Set(records.map((record) => record.phone).filter(Boolean))];

  if (!records.length) {
    showBatchAlert("Não encontrei números na coluna selecionada.", true);
    return;
  }
  if (uniquePhones.length > MAX_UNIQUE_PER_RUN) {
    showBatchAlert(
      `Esta lista tem ${uniquePhones.length.toLocaleString("pt-PT")} números únicos. O limite por verificação é ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")}. Divida a lista em partes menores.`,
      true,
    );
    return;
  }

  state.checking = true;
  state.results = records;
  elements.resultsSection.hidden = false;
  elements.batchAlert.hidden = true;
  elements.batchCheckButton.disabled = true;
  updateBatchButton();
  renderBatchResults();

  if (uniquePhones.length === 0) {
    renderBatchResults();
    elements.progressWrap.hidden = true;
    showBatchAlert("Não encontrei números com um formato válido para consultar.", true);
    state.checking = false;
    updateBatchButton();
    return;
  }

  const resultByPhone = new Map();
  let completed = 0;

  renderProgress(0, uniquePhones.length, "A preparar a consulta…");

  try {
    renderProgress(0, uniquePhones.length, "A iniciar a verificação…");
    const results = await requestCheck(uniquePhones, (done, total) => {
      completed = done;
      renderProgress(
        done,
        total,
        `${done.toLocaleString("pt-PT")} de ${total.toLocaleString("pt-PT")} números verificados…`,
      );
    });
    results.forEach((result) => resultByPhone.set(result.phone, result.status));
    completed = uniquePhones.length;

    state.results = records.map((record) => ({
      ...record,
      status: record.phone ? (resultByPhone.get(record.phone) || "unknown") : "invalid_format",
    }));
    renderBatchResults();
    renderProgress(completed, uniquePhones.length, `${completed.toLocaleString("pt-PT")} de ${uniquePhones.length.toLocaleString("pt-PT")} números consultados`);
    const validCount = state.results.filter((record) => record.status === "valid").length;
    if (validCount) {
      showBatchAlert(`Consulta concluída: ${validCount.toLocaleString("pt-PT")} contactos confirmados. Pode copiá-los ou escolher um formato para descarregar.`);
    } else {
      showBatchAlert("Consulta concluída. Não foram encontrados contactos com WhatsApp para exportar.");
    }
  } catch (error) {
    (Array.isArray(error.results) ? error.results : []).forEach((result) => {
      resultByPhone.set(result.phone, result.status);
    });
    state.results = records.map((record) => ({
      ...record,
      status: record.phone ? (resultByPhone.get(record.phone) || "unknown") : "invalid_format",
    }));
    renderBatchResults();
    const progressMessage = completed
      ? `${completed.toLocaleString("pt-PT")} de ${uniquePhones.length.toLocaleString("pt-PT")} números foram verificados. `
      : "";
    showBatchAlert(
      `${progressMessage}${error.message} Os números sem resposta continuam como não confirmados; “Baixar contactos” e “Copiar contactos” só incluem resultados confirmados.`,
      true,
    );
  } finally {
    state.checking = false;
    renderBatchResults();
    updateBatchButton();
  }
}

function statusLabel(status) {
  if (status === "valid") return "Tem WhatsApp";
  if (status === "invalid") return "Não tem WhatsApp";
  if (status === "invalid_format") return "Formato inválido";
  if (status === "pending") return "A consultar";
  return "Não confirmado";
}

function statusClass(status) {
  if (status === "valid") return "";
  if (status === "invalid") return "is-invalid";
  if (status === "invalid_format") return "is-format";
  return "is-unknown";
}

function callingCode(phone) {
  const codes = ["351", "244", "258", "1", "44", "55"];
  const match = codes.find((code) => phone.startsWith(`+${code}`));
  return match ? `+${match}` : "—";
}

function renderBatchResults() {
  const rows = state.results;
  if (!rows.length) {
    elements.resultsSection.hidden = true;
    return;
  }

  elements.resultsSection.hidden = false;
  const counts = {
    valid: rows.filter((row) => row.status === "valid").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    invalid_format: rows.filter((row) => row.status === "invalid_format").length,
    unknown: rows.filter((row) => !["valid", "invalid", "invalid_format"].includes(row.status)).length,
  };

  elements.validCount.textContent = counts.valid.toLocaleString("pt-PT");
  elements.invalidCount.textContent = counts.invalid.toLocaleString("pt-PT");
  elements.formatCount.textContent = counts.invalid_format.toLocaleString("pt-PT");
  elements.unknownCount.textContent = counts.unknown.toLocaleString("pt-PT");
  elements.tableSubtitle.textContent = `${rows.length.toLocaleString("pt-PT")} linhas • as consultas não enviam mensagens`;
  const hasValidContacts = counts.valid > 0 && !state.checking;
  elements.exportValidButton.disabled = !hasValidContacts;
  elements.copyValidButton.disabled = !hasValidContacts;
  elements.exportFormat.disabled = !hasValidContacts;
  elements.exportInvalidButton.disabled = counts.invalid === 0 || state.checking;
  elements.exportAllButton.disabled = rows.length === 0 || state.checking || counts.unknown > 0;
  elements.exportAllButton.title = counts.unknown > 0
    ? "Conclua a verificação antes de exportar resultados não confirmados."
    : "";

  const filtered = state.filter === "all"
    ? rows
    : rows.filter((row) => row.status === state.filter);
  const visible = filtered.slice(0, MAX_PREVIEW_ROWS);
  elements.resultsBody.replaceChildren();

  visible.forEach((row) => {
    const tableRow = document.createElement("tr");
    const phoneCell = document.createElement("td");
    const statusCell = document.createElement("td");
    const codeCell = document.createElement("td");
    const label = document.createElement("span");

    phoneCell.textContent = row.phone || row.raw || "—";
    label.className = `table-status ${statusClass(row.status)}`;
    label.textContent = statusLabel(row.status);
    statusCell.append(label);
    codeCell.textContent = row.phone ? callingCode(row.phone) : "—";
    tableRow.append(phoneCell, statusCell, codeCell);
    elements.resultsBody.append(tableRow);
  });

  if (!filtered.length) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Não há números nesta categoria.";
    emptyRow.append(cell);
    elements.resultsBody.append(emptyRow);
  }

  elements.tableFootnote.textContent = filtered.length > MAX_PREVIEW_ROWS
    ? `A mostrar ${MAX_PREVIEW_ROWS} de ${filtered.length.toLocaleString("pt-PT")} linhas. Copie ou descarregue os contactos para obter a lista completa.`
    : `${filtered.length.toLocaleString("pt-PT")} linhas nesta vista.`;
}

elements.resultFilter.addEventListener("change", () => {
  state.filter = elements.resultFilter.value;
  renderBatchResults();
});

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function statusForExport(status) {
  if (status === "valid") return "tem_whatsapp";
  if (status === "invalid") return "nao_tem_whatsapp";
  if (status === "invalid_format") return "formato_invalido";
  return "nao_confirmado";
}

function delimitedCell(value, delimiter) {
  const text = String(value ?? "");
  if (text.includes(delimiter) || /["\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function verifiedContacts() {
  return state.results
    .filter((record) => record.status === "valid")
    .map((record, index) => ({
      ...record,
      contactName: `Número de WhatsApp ${index + 1}`,
    }));
}

function sourceRowsForValidContacts(validContacts) {
  const imported = state.imported;
  const columnCount = imported.rawRows.reduce(
    (largest, row) => Math.max(largest, row.length),
    1,
  );
  const sourceHeaders = imported.hasHeader
    ? [...imported.rawRows[0]]
    : imported.headers.slice(0, columnCount);
  while (sourceHeaders.length < columnCount) sourceHeaders.push("");
  const rows = [[...sourceHeaders, "Nome de WhatsApp", "Número de WhatsApp"]];

  validContacts.forEach((record) => {
    const source = [...record.cells];
    while (source.length < columnCount) source.push("");
    rows.push([
      ...source.slice(0, columnCount),
      record.contactName,
      record.phone,
    ]);
  });

  return rows;
}

async function prepareWhatsAppFile(format = elements.exportFormat.value) {
  const imported = state.imported;
  const validContacts = verifiedContacts();
  if (!imported || !validContacts.length) return null;

  const rows = sourceRowsForValidContacts(validContacts);
  const baseName = imported.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "numeros";

  if (format === "xlsx") {
    const XLSX = await loadSpreadsheetLibrary();
    const workbook = XLSX.utils.book_new();
    const sheetName = imported.sheetName.replace(/[\\/?*:\[\]]/g, " ").slice(0, 31) || "Contactos";
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
    const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return {
      blob: new Blob([content], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      fileName: `${baseName}-com-whatsapp.xlsx`,
    };
  }

  const isText = format === "txt";
  const delimiter = isText ? "\t" : ",";
  const content = rows
    .map((row) => row.map((cell) => delimitedCell(cell, delimiter)).join(delimiter))
    .join("\r\n");
  return {
    blob: new Blob([isText ? content : `\uFEFF${content}`], {
      type: isText ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8",
    }),
    fileName: `${baseName}-com-whatsapp.${isText ? "txt" : "csv"}`,
  };
}

async function downloadWhatsAppFile() {
  try {
    const file = await prepareWhatsAppFile();
    if (!file) return;
    const contacts = verifiedContacts();
    triggerBlobDownload(file.fileName, file.blob);

    try {
      await saveExportHistory(file, contacts.length, state.imported.fileName);
      await renderExportHistory(`${file.fileName} foi guardado no histórico deste navegador.`);
      showBatchAlert(`${contacts.length.toLocaleString("pt-PT")} contactos confirmados descarregados e guardados no histórico local.`);
    } catch {
      showBatchAlert(
        "O ficheiro foi descarregado, mas não foi possível guardá-lo no histórico deste navegador.",
        true,
      );
    }
  } catch (error) {
    showBatchAlert(`Não foi possível preparar o ficheiro: ${error.message}`, true);
  }
}

async function copyWhatsAppContacts() {
  const contacts = verifiedContacts();
  if (!contacts.length) return;

  const content = contacts.map((contact) => contact.phone).join("\n");

  try {
    let copied = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand?.("copy");
      textarea.remove();
      if (!copied) throw new Error("A área de transferência não está disponível.");
    }
    showBatchAlert(`${contacts.length.toLocaleString("pt-PT")} números copiados, sem nomes.`);
  } catch {
    showBatchAlert("Não foi possível copiar automaticamente. Permita o acesso à área de transferência e tente novamente.", true);
  }
}

function openExportHistoryDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não suporta o histórico local de ficheiros."));
  }
  if (exportHistoryDbPromise) return exportHistoryDbPromise;

  exportHistoryDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EXPORT_HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EXPORT_HISTORY_STORE)) {
        database.createObjectStore(EXPORT_HISTORY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      exportHistoryDbPromise = null;
      reject(request.error || new Error("Não foi possível abrir o histórico local."));
    };
    request.onblocked = () => {
      exportHistoryDbPromise = null;
      reject(new Error("Feche outras páginas do ContactoCheck e tente novamente."));
    };
  });

  return exportHistoryDbPromise;
}

function historyId() {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function saveExportHistory(file, contactCount, sourceName) {
  const database = await openExportHistoryDatabase();
  const record = {
    id: historyId(),
    fileName: file.fileName,
    sourceName,
    format: file.fileName.split(".").pop().toLowerCase(),
    contactCount,
    createdAt: Date.now(),
    blob: file.blob,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPORT_HISTORY_STORE, "readwrite");
    transaction.objectStore(EXPORT_HISTORY_STORE).add(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o ficheiro."));
    transaction.onabort = () => reject(transaction.error || new Error("A gravação do ficheiro foi interrompida."));
  });
}

async function getExportHistory() {
  const database = await openExportHistoryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPORT_HISTORY_STORE, "readonly");
    const request = transaction.objectStore(EXPORT_HISTORY_STORE).getAll();
    let files = [];
    request.onsuccess = () => {
      files = Array.isArray(request.result) ? request.result : [];
    };
    transaction.oncomplete = () => {
      files.sort((left, right) => right.createdAt - left.createdAt);
      resolve(files);
    };
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível ler o histórico local."));
    request.onerror = () => reject(request.error || new Error("Não foi possível ler o histórico local."));
  });
}

async function deleteExportHistoryFile(id) {
  const database = await openExportHistoryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPORT_HISTORY_STORE, "readwrite");
    transaction.objectStore(EXPORT_HISTORY_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível apagar o ficheiro."));
    transaction.onabort = () => reject(transaction.error || new Error("A eliminação do ficheiro foi interrompida."));
  });
}

async function clearExportHistory() {
  const database = await openExportHistoryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPORT_HISTORY_STORE, "readwrite");
    transaction.objectStore(EXPORT_HISTORY_STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível apagar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A eliminação do histórico foi interrompida."));
  });
}

function setHistoryStatus(message, isError = false) {
  elements.historyStatus.textContent = message;
  elements.historyStatus.classList.toggle("is-error", isError);
}

function triggerBlobDownload(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderExportHistory(announcement = "") {
  elements.historyList.replaceChildren();
  try {
    const files = await getExportHistory();
    elements.clearHistoryButton.disabled = files.length === 0;
    setHistoryStatus(announcement || (
      files.length
        ? `${files.length.toLocaleString("pt-PT")} ficheiros com WhatsApp guardados neste navegador.`
        : "Ainda não foram gerados ficheiros com contactos confirmados."
    ));

    files.forEach((file) => {
      const item = document.createElement("article");
      item.className = "history-item";
      const info = document.createElement("div");
      info.className = "history-file-info";
      const name = document.createElement("strong");
      name.className = "history-file-name";
      name.textContent = file.fileName;
      const details = document.createElement("span");
      details.className = "history-file-details";
      details.textContent = `${Number(file.contactCount).toLocaleString("pt-PT")} números com WhatsApp · ${String(file.format).toUpperCase()} · ${new Date(file.createdAt).toLocaleString("pt-PT")}`;
      info.append(name, details);

      if (file.sourceName) {
        const source = document.createElement("span");
        source.className = "history-file-source";
        source.textContent = `Origem: ${file.sourceName}`;
        info.append(source);
      }

      const actions = document.createElement("div");
      actions.className = "history-item-actions";
      const downloadButton = document.createElement("button");
      downloadButton.className = "button button-outline history-action";
      downloadButton.type = "button";
      downloadButton.textContent = "Baixar novamente";
      downloadButton.addEventListener("click", () => {
        try {
          triggerBlobDownload(file.fileName, file.blob);
        } catch {
          setHistoryStatus("Não foi possível descarregar este ficheiro do histórico.", true);
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "button button-quiet history-action history-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "Apagar";
      deleteButton.setAttribute("aria-label", `Apagar ${file.fileName}`);
      deleteButton.addEventListener("click", async () => {
        deleteButton.disabled = true;
        try {
          await deleteExportHistoryFile(file.id);
          await renderExportHistory(`${file.fileName} foi removido do histórico.`);
        } catch {
          deleteButton.disabled = false;
          setHistoryStatus("Não foi possível apagar este ficheiro do histórico.", true);
        }
      });
      actions.append(downloadButton, deleteButton);
      item.append(info, actions);
      elements.historyList.append(item);
    });
  } catch (error) {
    elements.clearHistoryButton.disabled = true;
    setHistoryStatus(
      `O histórico local não está disponível. ${error.message}`,
      true,
    );
  }
}

function downloadCsv(filter) {
  const rows = state.results.filter((row) => filter === "all" || row.status === filter);
  if (!rows.length || !state.imported) return;

  const hasHeader = state.imported.hasHeader;
  const sourceHeaders = hasHeader
    ? state.imported.rawRows[0].map((value) => value.trim())
    : state.imported.headers;
  const headers = [...sourceHeaders, "telefone_normalizado", "status_whatsapp"];
  const dataRows = rows.map((row) => {
    const source = [...row.cells];
    while (source.length < sourceHeaders.length) source.push("");
    return [
      ...source.slice(0, sourceHeaders.length),
      row.phone || "",
      statusForExport(row.status),
    ];
  });
  const content = `\uFEFF${[headers, ...dataRows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const baseName = state.imported.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "numeros";
  const suffix = filter === "valid"
    ? "com-whatsapp"
    : filter === "invalid"
      ? "sem-whatsapp"
      : filter === "all"
        ? "resultados"
        : "nao-confirmados";
  const fileName = `${baseName}-${suffix}.csv`;
  triggerBlobDownload(fileName, blob);

  const confirmedCount = rows.filter((row) => row.status === "valid").length;
  if (confirmedCount > 0) {
    void saveExportHistory({ fileName, blob }, confirmedCount, state.imported.fileName)
      .then(() => renderExportHistory(`${fileName} foi guardado no histórico deste navegador.`))
      .catch(() => setHistoryStatus(
        "O ficheiro foi descarregado, mas não foi possível guardá-lo no histórico local.",
        true,
      ));
  }
}

elements.exportValidButton.addEventListener("click", downloadWhatsAppFile);
elements.copyValidButton.addEventListener("click", copyWhatsAppContacts);
elements.exportInvalidButton.addEventListener("click", () => downloadCsv("invalid"));
elements.exportAllButton.addEventListener("click", () => downloadCsv("all"));
elements.clearHistoryButton.addEventListener("click", async () => {
  if (!window.confirm("Apagar todos os ficheiros guardados neste navegador?")) return;
  elements.clearHistoryButton.disabled = true;
  try {
    await clearExportHistory();
    await renderExportHistory("O histórico local foi apagado.");
  } catch {
    elements.clearHistoryButton.disabled = false;
    setHistoryStatus("Não foi possível apagar o histórico local.", true);
  }
});

void renderExportHistory();
refreshHealth();