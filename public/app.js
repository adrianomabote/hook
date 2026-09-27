const API_BATCH_SIZE = 50;
const MAX_UNIQUE_PER_RUN = 1500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 12;

const elements = {
  connectionStatus: document.querySelector("#connectionStatus"),
  connectionLabel: document.querySelector("#connectionLabel"),
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
  validCount: document.querySelector("#validCount"),
  invalidCount: document.querySelector("#invalidCount"),
  formatCount: document.querySelector("#formatCount"),
  unknownCount: document.querySelector("#unknownCount"),
  resultsBody: document.querySelector("#resultsBody"),
  resultFilter: document.querySelector("#resultFilter"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  tableFootnote: document.querySelector("#tableFootnote"),
  exportValidButton: document.querySelector("#exportValidButton"),
  exportInvalidButton: document.querySelector("#exportInvalidButton"),
  exportAllButton: document.querySelector("#exportAllButton"),
};

const state = {
  tokenConfigured: false,
  checking: false,
  imported: null,
  results: [],
  filter: "all",
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
  return rows;
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
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
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

function createImport(rows, fileName) {
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
    rawRows: rows,
    headers,
    headerDetected: hasHeader,
    hasHeader,
    detectedPhoneColumn: hasHeader ? detectedPhoneColumn : 0,
    phoneColumn: hasHeader
      ? detectedPhoneColumn
      : choosePhoneColumn(rows, false, elements.batchCountry, elements.batchCustomDial),
  };

  state.imported = importState;
  state.results = [];
  elements.hasHeader.checked = hasHeader;
  elements.fileName.textContent = fileName;
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
  elements.resultsSection.hidden = true;
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
  return rows.map((cells, index) => {
    const raw = String(cells[state.imported.phoneColumn] || "").trim();
    const normalized = normalizePhone(raw, elements.batchCountry, elements.batchCustomDial);
    return {
      cells,
      index,
      raw,
      phone: normalized.phone,
      reason: normalized.reason,
      status: normalized.phone ? "unknown" : "invalid_format",
    };
  });
}

function updateImportPreview() {
  if (!state.imported) return;
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
  const enabled = state.tokenConfigured && hasData && !state.checking;
  elements.batchCheckButton.disabled = !enabled;
  elements.batchCheckButton.querySelector("span").textContent = state.checking
    ? "A consultar…"
    : "Verificar lista";

  if (!state.tokenConfigured) {
    elements.batchButtonHint.textContent = "Adicione o Secret WHAPI_TOKEN para ativar.";
  } else if (!hasData) {
    elements.batchButtonHint.textContent = "Importe um CSV ou cole uma lista de números.";
  } else {
    elements.batchButtonHint.textContent = `Até ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")} números únicos por consulta; sem envio de mensagens.`;
  }
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
  elements.connectionStatus.classList.toggle("is-configured", state.tokenConfigured);
  elements.connectionStatus.classList.toggle("is-missing", !state.tokenConfigured);
  elements.connectionLabel.textContent = state.tokenConfigured
    ? "Token configurado"
    : "Token necessário";
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
    elements.connectionLabel.textContent = "Servidor indisponível";
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

async function requestCheck(phones) {
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
  if (!Array.isArray(data.results)) throw new Error("A resposta não contém resultados.");
  return data.results;
}

function statusTitle(status) {
  if (status === "valid") return "Tem WhatsApp";
  if (status === "invalid") return "Não tem WhatsApp";
  if (status === "invalid_format") return "Formato inválido";
  if (status === "pending") return "A consultar";
  return "Não confirmado";
}

function statusDescription(status) {
  if (status === "valid") return "O Whapi.Cloud encontrou uma conta para este número.";
  if (status === "invalid") return "O Whapi.Cloud não encontrou uma conta para este número.";
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

function importRows(rows, fileName) {
  createImport(rows, fileName);
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showBatchAlert("O ficheiro excede 5 MB. Divida-o em ficheiros mais pequenos.", true);
    return;
  }

  try {
    const rows = parseDelimitedText(await file.text());
    importRows(rows, file.name);
  } catch {
    showBatchAlert("Não consegui ler o ficheiro. Use um CSV ou TXT em texto simples.", true);
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
  const rows = elements.pasteInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => [line]);
  if (!rows.length) {
    showBatchAlert("Cole pelo menos um número, um por linha.", true);
    return;
  }
  importRows(rows, "Lista colada");
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
      `Este ficheiro tem ${uniquePhones.length.toLocaleString("pt-PT")} números únicos. O limite desta consulta é ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")}; divida a lista para evitar bloqueios do serviço.`,
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

  if (uniquePhones.length === 0) {
    renderBatchResults();
    elements.progressWrap.hidden = true;
    elements.batchAlert.hidden = false;
    elements.batchAlert.classList.add("is-error");
    elements.batchAlert.textContent = "Não encontrei números com um formato válido para consultar.";
    state.checking = false;
    updateBatchButton();
    return;
  }

  const resultByPhone = new Map();
  let completed = 0;
  const batches = [];
  for (let index = 0; index < uniquePhones.length; index += API_BATCH_SIZE) {
    batches.push(uniquePhones.slice(index, index + API_BATCH_SIZE));
  }

  renderProgress(0, uniquePhones.length, "A preparar a consulta…");

  try {
    for (const [batchIndex, batch] of batches.entries()) {
      renderProgress(completed, uniquePhones.length, `A consultar lote ${batchIndex + 1} de ${batches.length}…`);
      const results = await requestCheck(batch);
      results.forEach((result) => resultByPhone.set(result.phone, result.status));
      completed += batch.length;

      state.results = records.map((record) => ({
        ...record,
        status: record.phone ? (resultByPhone.get(record.phone) || "unknown") : "invalid_format",
      }));
      renderBatchResults();
      renderProgress(completed, uniquePhones.length, `${completed.toLocaleString("pt-PT")} de ${uniquePhones.length.toLocaleString("pt-PT")} números consultados`);

      if (completed < uniquePhones.length) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    showBatchAlert("Consulta concluída. Pode exportar os números com e sem WhatsApp em ficheiros separados.");
  } catch (error) {
    state.results = records.map((record) => ({
      ...record,
      status: record.phone ? (resultByPhone.get(record.phone) || "unknown") : "invalid_format",
    }));
    renderBatchResults();
    showBatchAlert(`${error.message} Os resultados já recebidos continuam disponíveis para exportação.`, true);
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
  elements.exportValidButton.disabled = counts.valid === 0 || state.checking;
  elements.exportInvalidButton.disabled = counts.invalid === 0 || state.checking;
  elements.exportAllButton.disabled = rows.length === 0 || state.checking;

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
    ? `A mostrar ${MAX_PREVIEW_ROWS} de ${filtered.length.toLocaleString("pt-PT")} linhas. Exporte o CSV para ver todos os resultados.`
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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
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
  anchor.href = url;
  anchor.download = `${baseName}-${suffix}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

elements.exportValidButton.addEventListener("click", () => downloadCsv("valid"));
elements.exportInvalidButton.addEventListener("click", () => downloadCsv("invalid"));
elements.exportAllButton.addEventListener("click", () => downloadCsv("all"));

refreshHealth();