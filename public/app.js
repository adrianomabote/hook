const MAX_UNIQUE_PER_RUN = 100_000;
const PROVIDER_BATCH_SIZE = 250;
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
  progressContinueWrap: document.querySelector("#progressContinue"),
  progressContinueHint: document.querySelector("#progressContinueHint"),
  continueDivisionButton: document.querySelector("#continueDivisionButton"),
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
  engineBadge: document.querySelector("#engineBadge"),
  engineBadgeText: document.querySelector("#engineBadgeText"),
  engineSubtitle: document.querySelector("#engineSubtitle"),
  engineConnectQrButton: document.querySelector("#engineConnectQrButton"),
  engineTogglePairButton: document.querySelector("#engineTogglePairButton"),
  engineDisconnectButton: document.querySelector("#engineDisconnectButton"),
  enginePairBox: document.querySelector("#enginePairBox"),
  enginePairForm: document.querySelector("#enginePairForm"),
  enginePairPhone: document.querySelector("#enginePairPhone"),
  engineRequestCodeButton: document.querySelector("#engineRequestCodeButton"),
  engineAuthDisplay: document.querySelector("#engineAuthDisplay"),
  engineQrWrap: document.querySelector("#engineQrWrap"),
  engineQrImage: document.querySelector("#engineQrImage"),
  engineCodeWrap: document.querySelector("#engineCodeWrap"),
  enginePairingCode: document.querySelector("#enginePairingCode"),
  engineProtectionSelect: document.querySelector("#engineProtectionSelect"),
  toggleManualConfigButton: document.querySelector("#toggleManualConfigButton"),
  manualConfigPanel: document.querySelector("#manualConfigPanel"),
  manualBlockSize: document.querySelector("#manualBlockSize"),
  manualPauseSeconds: document.querySelector("#manualPauseSeconds"),
  manualMicroBatch: document.querySelector("#manualMicroBatch"),
  manualDelaySeconds: document.querySelector("#manualDelaySeconds"),
  applyManualConfigButton: document.querySelector("#applyManualConfigButton"),
  manualConfigSummary: document.querySelector("#manualConfigSummary"),
  engineStatsText: document.querySelector("#engineStatsText"),
  engineClearCacheButton: document.querySelector("#engineClearCacheButton"),
  engineAlert: document.querySelector("#engineAlert"),
  checkRunningStatusButton: document.querySelector("#checkRunningStatusButton"),
  clearRunningQueueButton: document.querySelector("#clearRunningQueueButton"),
  activeJobBanner: document.querySelector("#activeJobBanner"),
  activeJobBadge: document.querySelector("#activeJobBadge"),
  activeJobTitle: document.querySelector("#activeJobTitle"),
  activeJobDetails: document.querySelector("#activeJobDetails"),
  attachActiveJobButton: document.querySelector("#attachActiveJobButton"),
  clearActiveJobButton: document.querySelector("#clearActiveJobButton"),
  forceRestartJobButton: document.querySelector("#forceRestartJobButton"),
  stopActiveCheckButton: document.querySelector("#stopActiveCheckButton"),
};

const EXPORT_HISTORY_DB = "contactocheck-export-history";
const EXPORT_HISTORY_STORE = "verified-files";
let exportHistoryDbPromise = null;

const state = {
  tokenConfigured: false,
  checking: false,
  abortPolling: false,
  activeJobId: null,
  serverActiveJob: null,
  continueAction: null,
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
  const columnCount = state.imported.rawRows.reduce(
    (largest, row) => Math.max(largest, row.length),
    1,
  );
  const headerRow = state.imported.hasHeader ? state.imported.rawRows[0] : [];
  const sourceHeaders = Array.from({ length: columnCount }, (_, index) => (
    String(headerRow[index] || "").trim() || `Coluna ${index + 1}`
  ));
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
    elements.batchButtonHint.textContent = "Conecte o Motor Próprio do WhatsApp acima (via QR Code ou código) para verificar os números.";
  } else if (!hasData) {
    elements.batchButtonHint.textContent = "Importe CSV, TXT ou Excel, ou cole uma lista de números.";
  } else {
    elements.batchButtonHint.textContent = state.session.started
      ? `Até ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")} números novos por lista. O sistema faz pausas longas Anti-Ban e continua sozinho automaticamente até terminar.`
      : `Até ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")} números únicos por lista. O sistema faz pausas longas Anti-Ban e continua sozinho automaticamente até terminar.`;
  }

  elements.batchSessionHint.hidden = !state.session.started || state.session.concluded;
  elements.batchSessionHint.textContent = state.session.started && !state.session.concluded
    ? "Sessão aberta: importe outra lista ou cole mais números para os juntar aos resultados atuais."
    : "";
  updateSessionControls();
}

function updateSessionControls() {
  const hasSessionResults = state.session.started && state.results.length > 0;
  const validCount = state.results.filter((record) => record.status === "valid").length;
  elements.sessionControls.hidden = !hasSessionResults;
  elements.concludeSessionButton.hidden = state.session.concluded;
  elements.concludeSessionButton.disabled = state.checking || validCount === 0;
  elements.newSessionButton.hidden = !state.session.concluded;
  elements.newSessionButton.disabled = state.checking;

  if (!hasSessionResults) {
    elements.sessionStatus.textContent = "";
    return;
  }

  const validText = validCount.toLocaleString("pt-PT");
  elements.sessionStatus.textContent = state.session.concluded
    ? `Sessão concluída: ${validText} números com WhatsApp confirmados.`
    : `Sessão aberta: ${validText} números com WhatsApp confirmados até agora. Pode adicionar mais lotes antes de concluir.`;
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

let enginePollTimer = null;

function showEngineAlert(message, isError = false) {
  if (!elements.engineAlert) return;
  elements.engineAlert.textContent = message || "";
  elements.engineAlert.classList.toggle("is-error", Boolean(isError));
  elements.engineAlert.hidden = !message;
}

function formatCustomSummaryText(cfg) {
  if (!cfg) return "Modo manual pronto para aplicar.";
  const pauseText = Number(cfg.pauseSeconds) <= 0
    ? "sem pausa entre blocos"
    : `pausa de ${cfg.pauseSeconds}s a cada ${cfg.blockSize} números`;
  return `Configuração manual: ${pauseText} · lote de ${cfg.microBatchSize} números · intervalo de ${cfg.delaySeconds}s.`;
}

function renderEngineState(engine) {
  if (!elements.engineBadge || !engine) return;

  const isConnected = Boolean(engine.connected);
  const status = engine.status || "disconnected";
  const isPending = ["connecting", "qr_ready", "pairing_code_ready"].includes(status);

  elements.engineBadge.classList.toggle("is-connected", isConnected);
  elements.engineBadge.classList.toggle("is-pending", !isConnected && isPending);
  elements.engineBadge.classList.toggle("is-disconnected", !isConnected && !isPending);

  if (engine.customConfig) {
    const cfg = engine.customConfig;
    if (elements.manualBlockSize && document.activeElement !== elements.manualBlockSize) {
      elements.manualBlockSize.value = String(cfg.blockSize ?? 200);
    }
    if (elements.manualPauseSeconds && document.activeElement !== elements.manualPauseSeconds) {
      elements.manualPauseSeconds.value = String(cfg.pauseSeconds ?? 30);
    }
    if (elements.manualMicroBatch && document.activeElement !== elements.manualMicroBatch) {
      elements.manualMicroBatch.value = String(cfg.microBatchSize ?? 25);
    }
    if (elements.manualDelaySeconds && document.activeElement !== elements.manualDelaySeconds) {
      elements.manualDelaySeconds.value = String(cfg.delaySeconds ?? 0.5);
    }
    if (elements.manualConfigSummary) {
      elements.manualConfigSummary.textContent = formatCustomSummaryText(cfg);
    }
    const customOption = elements.engineProtectionSelect?.querySelector('option[value="custom"]');
    if (customOption && engine.protectionMode === "custom" && engine.protectionLabel) {
      customOption.textContent = `Personalizado · ${engine.protectionLabel}`;
    }
  }

  if (elements.engineProtectionSelect && engine.protectionMode) {
    elements.engineProtectionSelect.value = engine.protectionMode;
    if (engine.protectionMode === "custom" && elements.manualConfigPanel) {
      elements.manualConfigPanel.hidden = false;
    }
  }

  if (elements.engineStatsText && engine.stats) {
    const cacheSize = Number(engine.stats.cacheSize || 0).toLocaleString("pt-PT");
    const last60Min = Number(engine.stats.last60Min || 0).toLocaleString("pt-PT");
    elements.engineStatsText.textContent = `Cache Anti-Ban: ${cacheSize} números guardados · ${last60Min} consultas na última hora`;
  }

  if (isConnected) {
    const label = engine.connectedPhone
      ? `Motor ativo · ${engine.connectedPhone}`
      : "Motor próprio conectado";
    elements.engineBadgeText.textContent = label;
    elements.engineSubtitle.textContent = engine.connectedName
      ? `Conectado diretamente ao WhatsApp (${engine.connectedName}). Proteção Anti-Banimento ativa.`
      : "Conectado diretamente ao WhatsApp. Proteção Anti-Banimento ativa.";
    elements.engineConnectQrButton.hidden = true;
    elements.engineTogglePairButton.hidden = true;
    elements.engineDisconnectButton.hidden = false;
    elements.enginePairBox.hidden = true;
    elements.engineAuthDisplay.hidden = true;
    elements.engineQrWrap.hidden = true;
    elements.engineCodeWrap.hidden = true;
  } else {
    elements.engineConnectQrButton.hidden = false;
    elements.engineTogglePairButton.hidden = false;
    elements.engineDisconnectButton.hidden = !isPending;

    if (status === "qr_ready" && engine.qrDataUrl) {
      elements.engineBadgeText.textContent = "Aguardando leitura do QR Code";
      elements.engineQrImage.src = engine.qrDataUrl;
      elements.engineAuthDisplay.hidden = false;
      elements.engineQrWrap.hidden = false;
      elements.engineCodeWrap.hidden = true;
    } else if (status === "pairing_code_ready" && engine.pairingCode) {
      elements.engineBadgeText.textContent = "Aguardando código no telemóvel";
      elements.enginePairingCode.textContent = engine.pairingCode;
      elements.engineAuthDisplay.hidden = false;
      elements.engineQrWrap.hidden = true;
      elements.engineCodeWrap.hidden = false;
    } else if (status === "connecting") {
      elements.engineBadgeText.textContent = "A iniciar conexão…";
    } else {
      elements.engineBadgeText.textContent = "Desconectado";
      elements.engineAuthDisplay.hidden = true;
      elements.engineQrWrap.hidden = true;
      elements.engineCodeWrap.hidden = true;
    }
  }

  if (engine.lastError) {
    showEngineAlert(engine.lastError, true);
  } else if (isConnected) {
    showEngineAlert("", false);
  }

  setConnectionState(isConnected);

  if (isPending && !enginePollTimer) {
    enginePollTimer = window.setInterval(() => {
      void refreshHealth();
    }, 2500);
  } else if (!isPending && enginePollTimer) {
    window.clearInterval(enginePollTimer);
    enginePollTimer = null;
  }
}

function renderActiveJobBanner(activeJob) {
  state.serverActiveJob = activeJob || null;
  if (!elements.activeJobBanner) return;

  if (!activeJob) {
    elements.activeJobBanner.hidden = true;
    return;
  }

  const total = Number(activeJob.total) || 0;
  const completed = Number(activeJob.completed) || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const validCount = Number(activeJob.validCount) || 0;
  const invalidCount = Number(activeJob.invalidCount) || 0;
  const statusLabelText = activeJob.status === "paused"
    ? "Verificação em pausa"
    : "Verificação em andamento";

  elements.activeJobBadge.textContent = `${statusLabelText} (${pct}%)`;
  elements.activeJobTitle.textContent = `${completed.toLocaleString("pt-PT")} de ${total.toLocaleString("pt-PT")} números processados`;
  elements.activeJobDetails.textContent = `${validCount.toLocaleString("pt-PT")} com WhatsApp · ${invalidCount.toLocaleString("pt-PT")} sem WhatsApp · ${activeJob.phaseMessage || "Consulta ativa em segundo plano."}`;
  if (elements.forceRestartJobButton) {
    elements.forceRestartJobButton.hidden = !Boolean(state.imported && activeRows().length);
  }
  elements.activeJobBanner.hidden = false;
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const health = await response.json();
    if (response.ok && health.engine) {
      renderEngineState(health.engine);
      if (health.activeJob) {
        renderActiveJobBanner(health.activeJob);
      } else if (!state.checking) {
        renderActiveJobBanner(null);
      }
    } else {
      setConnectionState(response.ok && health.tokenConfigured);
    }
  } catch {
    setConnectionState(false);
  }
}

elements.engineConnectQrButton?.addEventListener("click", async () => {
  elements.engineConnectQrButton.disabled = true;
  elements.enginePairBox.hidden = true;
  showEngineAlert("A gerar QR Code de conexão direta com o WhatsApp…", false);
  try {
    const response = await fetch("/api/whatsapp/connect", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível iniciar o motor.");
    renderEngineState(data);
    window.setTimeout(() => void refreshHealth(), 1500);
  } catch (error) {
    showEngineAlert(error.message, true);
  } finally {
    elements.engineConnectQrButton.disabled = false;
  }
});

elements.engineTogglePairButton?.addEventListener("click", () => {
  elements.enginePairBox.hidden = !elements.enginePairBox.hidden;
  if (!elements.enginePairBox.hidden) {
    elements.enginePairPhone?.focus();
  }
});

elements.enginePairForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = elements.enginePairPhone.value.trim();
  if (!phone) {
    showEngineAlert("Informe o seu número de WhatsApp com o indicativo do país (ex.: +258 84 123 4567).", true);
    return;
  }
  elements.engineRequestCodeButton.disabled = true;
  showEngineAlert("A solicitar código de 8 dígitos ao WhatsApp… aguarde cerca de 3 segundos.", false);
  try {
    const response = await fetch("/api/whatsapp/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível gerar o código.");
    renderEngineState(data);
    window.setTimeout(() => void refreshHealth(), 2500);
  } catch (error) {
    showEngineAlert(error.message, true);
  } finally {
    elements.engineRequestCodeButton.disabled = false;
  }
});

async function saveAndApplyManualConfig() {
  const blockSize = Math.max(1, Number(elements.manualBlockSize?.value || 200));
  const pauseSeconds = Math.max(0, Number(elements.manualPauseSeconds?.value || 30));
  const microBatchSize = Math.max(1, Number(elements.manualMicroBatch?.value || 25));
  const delaySeconds = Math.max(0, Number(elements.manualDelaySeconds?.value || 0.5));

  if (elements.applyManualConfigButton) {
    elements.applyManualConfigButton.disabled = true;
  }
  try {
    const response = await fetch("/api/whatsapp/custom-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockSize,
        pauseSeconds,
        microBatchSize,
        delaySeconds,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível guardar o ajuste manual.");
    renderEngineState(data);
    showEngineAlert(`Ajuste manual aplicado: ${data.protectionLabel}.`, false);
  } catch (error) {
    showEngineAlert(error.message, true);
  } finally {
    if (elements.applyManualConfigButton) {
      elements.applyManualConfigButton.disabled = false;
    }
  }
}

elements.toggleManualConfigButton?.addEventListener("click", () => {
  if (!elements.manualConfigPanel) return;
  elements.manualConfigPanel.hidden = !elements.manualConfigPanel.hidden;
  if (!elements.manualConfigPanel.hidden) {
    elements.manualBlockSize?.focus();
  }
});

elements.applyManualConfigButton?.addEventListener("click", () => {
  void saveAndApplyManualConfig();
});

elements.engineProtectionSelect?.addEventListener("change", async () => {
  const mode = elements.engineProtectionSelect.value;
  if (mode === "custom") {
    if (elements.manualConfigPanel) {
      elements.manualConfigPanel.hidden = false;
    }
    await saveAndApplyManualConfig();
    return;
  }
  try {
    const response = await fetch("/api/whatsapp/protection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await response.json();
    if (response.ok) {
      renderEngineState(data);
      showEngineAlert(`Modo de proteção alterado para: ${data.protectionLabel}.`, false);
    }
  } catch {
    // Ignore
  }
});

elements.engineClearCacheButton?.addEventListener("click", async () => {
  elements.engineClearCacheButton.disabled = true;
  try {
    const response = await fetch("/api/whatsapp/clear-cache", { method: "POST" });
    const data = await response.json();
    if (response.ok) {
      renderEngineState(data);
      showEngineAlert("Cache Anti-Ban limpo com sucesso.", false);
    }
  } catch {
    // Ignore
  } finally {
    elements.engineClearCacheButton.disabled = false;
  }
});

elements.engineDisconnectButton?.addEventListener("click", async () => {
  elements.engineDisconnectButton.disabled = true;
  try {
    const response = await fetch("/api/whatsapp/disconnect", { method: "POST" });
    const data = await response.json();
    renderEngineState(data);
    showEngineAlert("Sessão do motor próprio desconectada.", false);
  } catch (error) {
    showEngineAlert(error.message, true);
  } finally {
    elements.engineDisconnectButton.disabled = false;
  }
});

function showSingleResult(status, title, detail) {
  elements.singleResult.className = `inline-result is-${status}`;
  const symbol = status === "valid" ? "✓" : status === "invalid" ? "×" : "!";
  elements.singleResult.innerHTML = `
    <span class="result-symbol" aria-hidden="true">${symbol}</span>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
  `;
  elements.singleResult.hidden = false;
}

async function pollJobUntilCompletion(jobId, totalHint, onProgress, onPaused) {
  state.activeJobId = jobId;
  state.abortPolling = false;
  let completed = 0;
  let pollingErrors = 0;

  while (!state.abortPolling) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    if (state.abortPolling) {
      const abortErr = new Error("A verificação foi parada e limpa manualmente.");
      abortErr.cancelledByUser = true;
      throw abortErr;
    }

    let statusResponse;
    try {
      statusResponse = await fetch(`/api/check/${encodeURIComponent(jobId)}`, {
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
      if (statusResponse.status === 404 && state.abortPolling) {
        const abortErr = new Error("A verificação foi parada e limpa manualmente.");
        abortErr.cancelledByUser = true;
        throw abortErr;
      }
      throw new Error(statusData.error || "Não foi possível obter o estado da verificação.");
    }

    pollingErrors = 0;
    completed = Number(statusData.completed) || 0;
    const total = Number(statusData.total) || totalHint || 1;
    const partialResults = Array.isArray(statusData.partialResults) ? statusData.partialResults : null;

    if (["queued", "running", "paused"].includes(statusData.status)) {
      let validCount = 0;
      let invalidCount = 0;
      if (partialResults) {
        for (const item of partialResults) {
          if (item?.status === "valid") validCount += 1;
          else if (item?.status === "invalid") invalidCount += 1;
        }
      }
      renderActiveJobBanner({
        jobId,
        status: statusData.status,
        total,
        completed,
        validCount,
        invalidCount,
        phaseMessage: statusData.phaseMessage || null,
      });
    } else {
      renderActiveJobBanner(null);
    }

    onProgress?.(
      completed,
      total,
      statusData.phaseMessage || null,
      partialResults,
    );

    if (statusData.status === "completed") {
      if (!Array.isArray(statusData.results)) {
        throw new Error("A verificação terminou sem devolver os resultados.");
      }
      return statusData.results;
    }
    if (statusData.status === "cancelled") {
      const abortErr = new Error("A verificação em andamento foi limpa.");
      abortErr.cancelledByUser = true;
      abortErr.results = Array.isArray(statusData.results) ? statusData.results : (partialResults || []);
      throw abortErr;
    }
    if (statusData.status === "failed") {
      const error = new Error(statusData.error || "A verificação foi interrompida pelo serviço.");
      error.results = Array.isArray(statusData.results) ? statusData.results : (partialResults || []);
      throw error;
    }
    if (statusData.status === "paused") {
      if (!onPaused) {
        throw new Error("A verificação aguarda confirmação antes de continuar.");
      }
      await onPaused(jobId, completed, total);
      continue;
    }
    if (!["queued", "running"].includes(statusData.status)) {
      throw new Error("O estado da verificação não é reconhecido.");
    }
  }

  const abortErr = new Error("A verificação foi parada pelo utilizador.");
  abortErr.cancelledByUser = true;
  throw abortErr;
}

async function requestCheck(phones, onProgress, onPaused, options = {}) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phones,
      forceReplace: Boolean(options.forceReplace),
    }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor devolveu uma resposta inválida.");
  }
  if (!response.ok) {
    const err = new Error(data.error || "Não foi possível consultar os números.");
    err.code = data.code || null;
    err.activeJob = data.activeJob || null;
    throw err;
  }
  if (Array.isArray(data.results)) return data.results;
  if (!data.jobId) throw new Error("A resposta não contém resultados.");

  onProgress?.(0, data.total || phones.length, data.phaseMessage || null);
  return pollJobUntilCompletion(data.jobId, data.total || phones.length, onProgress, onPaused);
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
  elements.fileInput.value = "";
  elements.fileSummary.hidden = true;
  elements.importSettings.hidden = true;
  elements.importPreview.hidden = true;
  elements.batchAlert.hidden = true;
  renderBatchResults();
  updateBatchButton();
});

elements.batchCheckButton.addEventListener("click", () => {
  void runBatchCheck({ forceReplace: false });
});
elements.continueDivisionButton.addEventListener("click", () => {
  if (state.continueAction) void state.continueAction();
});

function mergePartialResultsIntoSession(partialResults, sourceLabel = "Verificação em curso") {
  if (!Array.isArray(partialResults) || partialResults.length === 0) return;
  state.session.started = true;
  const existingByPhone = new Map();
  state.results.forEach((rec, idx) => {
    if (rec.phone) existingByPhone.set(rec.phone, idx);
  });

  for (const item of partialResults) {
    if (!item || !item.phone || !item.status) continue;
    state.session.checkedPhones.add(item.phone);
    if (existingByPhone.has(item.phone)) {
      const idx = existingByPhone.get(item.phone);
      state.results[idx].status = item.status;
    } else {
      existingByPhone.set(item.phone, state.results.length);
      state.results.push({
        cells: [item.phone],
        index: state.results.length,
        raw: item.phone,
        sourceHeaders: ["Telefone"],
        sourceName: sourceLabel,
        sourceSheetName: "Contactos",
        phone: item.phone,
        reason: null,
        status: item.status,
      });
    }
  }
}

async function inspectRunningVerification() {
  setMode("batch");
  try {
    const response = await fetch("/api/check/active?includeResults=1", { cache: "no-store" });
    const data = await response.json();
    if (data.engine) {
      renderEngineState(data.engine);
    }
    if (data.activeJob) {
      renderActiveJobBanner(data.activeJob);
      if (Array.isArray(data.activeJob.partialResults) && data.activeJob.partialResults.length > 0) {
        mergePartialResultsIntoSession(data.activeJob.partialResults);
        renderBatchResults();
      }
      const j = data.activeJob;
      showBatchAlert(
        `Em andamento: ${Number(j.completed).toLocaleString("pt-PT")} de ${Number(j.total).toLocaleString("pt-PT")} números processados (${Number(j.validCount || 0).toLocaleString("pt-PT")} confirmados com WhatsApp). Pode clicar em “Acompanhar em andamento” ou “Parar e limpar verificação”.`,
        false,
      );
    } else {
      renderActiveJobBanner(null);
      if (state.checking) {
        state.abortPolling = true;
        state.checking = false;
        updateBatchButton();
      }
      showBatchAlert(
        "Não existe nenhuma verificação em andamento no servidor neste momento. O sistema está livre para iniciar uma nova consulta.",
        false,
      );
    }
  } catch (error) {
    showBatchAlert(`Não foi possível consultar o estado atual: ${error.message}`, true);
  }
}

async function clearRunningVerification() {
  state.abortPolling = true;
  if (elements.clearRunningQueueButton) elements.clearRunningQueueButton.disabled = true;
  if (elements.clearActiveJobButton) elements.clearActiveJobButton.disabled = true;
  if (elements.stopActiveCheckButton) elements.stopActiveCheckButton.disabled = true;

  try {
    const response = await fetch("/api/check/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: state.activeJobId || state.serverActiveJob?.jobId || null }),
    });
    const data = await response.json();
    if (data.engine) {
      renderEngineState(data.engine);
    }
    if (Array.isArray(data.partialResults) && data.partialResults.length > 0) {
      mergePartialResultsIntoSession(data.partialResults);
    }
    state.results.forEach((rec) => {
      if (rec.status === "pending") {
        rec.status = "unknown";
      }
    });
    state.checking = false;
    state.activeJobId = null;
    state.continueAction = null;
    elements.progressContinueWrap.hidden = true;
    renderActiveJobBanner(null);
    renderBatchResults();
    updateBatchButton();

    const validCount = state.results.filter((r) => r.status === "valid").length;
    showBatchAlert(
      validCount > 0
        ? `Verificação em andamento limpa e destravada! Os ${validCount.toLocaleString("pt-PT")} contactos já confirmados foram mantidos na tabela e já pode iniciar uma nova verificação.`
        : "Verificação em andamento parada e limpa com sucesso! Já pode iniciar uma nova consulta.",
      false,
    );
  } catch (error) {
    showBatchAlert(`Erro ao limpar verificação: ${error.message}`, true);
  } finally {
    if (elements.clearRunningQueueButton) elements.clearRunningQueueButton.disabled = false;
    if (elements.clearActiveJobButton) elements.clearActiveJobButton.disabled = false;
    if (elements.stopActiveCheckButton) elements.stopActiveCheckButton.disabled = false;
  }
}

async function attachToRunningVerification() {
  const jobId = state.serverActiveJob?.jobId || state.activeJobId;
  if (!jobId) {
    await inspectRunningVerification();
    return;
  }
  if (state.checking) return;

  setMode("batch");
  state.checking = true;
  state.abortPolling = false;
  state.session.started = true;
  elements.batchAlert.hidden = true;
  updateBatchButton();

  const totalHint = Number(state.serverActiveJob?.total) || 1;
  renderProgress(
    Number(state.serverActiveJob?.completed) || 0,
    totalHint,
    state.serverActiveJob?.phaseMessage || "A acompanhar verificação em andamento…",
  );

  try {
    const finalResults = await pollJobUntilCompletion(
      jobId,
      totalHint,
      (done, total, phaseMessage, partialResults) => {
        renderProgress(done, total, phaseMessage || divisionProgressLabel(done, total));
        if (Array.isArray(partialResults) && partialResults.length > 0) {
          mergePartialResultsIntoSession(partialResults);
          renderBatchResults();
        }
      },
      (pausedJobId, done, total) => waitForManualContinue(pausedJobId, done, total),
    );
    if (Array.isArray(finalResults) && finalResults.length > 0) {
      mergePartialResultsIntoSession(finalResults);
    }
    renderActiveJobBanner(null);
    renderBatchResults();
    const validCount = state.results.filter((r) => r.status === "valid").length;
    showBatchAlert(
      `Verificação concluída: ${validCount.toLocaleString("pt-PT")} contactos confirmados com WhatsApp.`,
      false,
    );
  } catch (error) {
    if (Array.isArray(error.results) && error.results.length > 0) {
      mergePartialResultsIntoSession(error.results);
    }
    renderBatchResults();
    if (!error.cancelledByUser) {
      showBatchAlert(`A verificação foi interrompida: ${error.message}`, true);
    }
  } finally {
    state.checking = false;
    state.continueAction = null;
    elements.progressContinueWrap.hidden = true;
    renderBatchResults();
    updateBatchButton();
  }
}

elements.checkRunningStatusButton?.addEventListener("click", () => {
  void inspectRunningVerification();
});

elements.clearRunningQueueButton?.addEventListener("click", () => {
  void clearRunningVerification();
});

elements.clearActiveJobButton?.addEventListener("click", () => {
  void clearRunningVerification();
});

elements.stopActiveCheckButton?.addEventListener("click", () => {
  void clearRunningVerification();
});

elements.attachActiveJobButton?.addEventListener("click", () => {
  void attachToRunningVerification();
});

elements.forceRestartJobButton?.addEventListener("click", () => {
  void runBatchCheck({ forceReplace: true });
});

function renderProgress(done, total, label) {
  const percentage = total ? Math.round((done / total) * 100) : 100;
  elements.progressWrap.hidden = false;
  elements.progressLabel.textContent = label;
  elements.progressPercent.textContent = `${percentage}%`;
  elements.progressBar.style.width = `${percentage}%`;
}

function divisionProgressLabel(done, total) {
  const divisionCount = Math.ceil(total / PROVIDER_BATCH_SIZE);
  if (done >= total) {
    return `${divisionCount.toLocaleString("pt-PT")} de ${divisionCount.toLocaleString("pt-PT")} divisões concluídas · ${total.toLocaleString("pt-PT")} números verificados`;
  }

  const currentDivision = Math.min(
    Math.floor(done / PROVIDER_BATCH_SIZE) + 1,
    divisionCount,
  );
  return `A verificar divisão ${currentDivision.toLocaleString("pt-PT")} de ${divisionCount.toLocaleString("pt-PT")} · ${done.toLocaleString("pt-PT")} de ${total.toLocaleString("pt-PT")} números`;
}

function waitForManualContinue(jobId, done, total) {
  const totalDivisions = Math.ceil(total / PROVIDER_BATCH_SIZE);
  const completedDivisions = Math.ceil(done / PROVIDER_BATCH_SIZE);
  const nextDivision = completedDivisions + 1;

  renderProgress(
    done,
    total,
    `Pausada após a divisão ${completedDivisions.toLocaleString("pt-PT")} de ${totalDivisions.toLocaleString("pt-PT")}`,
  );
  elements.progressContinueWrap.hidden = false;
  elements.progressContinueHint.textContent = `A divisão ${completedDivisions.toLocaleString("pt-PT")} terminou. A próxima divisão só começa depois do seu clique.`;
  elements.continueDivisionButton.textContent = `Iniciar divisão ${nextDivision.toLocaleString("pt-PT")} de ${totalDivisions.toLocaleString("pt-PT")}`;
  elements.continueDivisionButton.disabled = false;

  return new Promise((resolve, reject) => {
    let requesting = false;
    state.continueAction = async () => {
      if (requesting) return;
      requesting = true;
      elements.continueDivisionButton.disabled = true;
      elements.progressContinueHint.textContent = `A preparar a divisão ${nextDivision.toLocaleString("pt-PT")} de ${totalDivisions.toLocaleString("pt-PT")}…`;

      try {
        const response = await fetch(`/api/check/${encodeURIComponent(jobId)}/continue`, {
          method: "POST",
          cache: "no-store",
        });
        let data;
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        if (!response.ok) {
          const error = new Error(data.error || "Não foi possível continuar a verificação.");
          error.status = response.status;
          throw error;
        }

        state.continueAction = null;
        elements.progressContinueWrap.hidden = true;
        elements.batchAlert.hidden = true;
        renderProgress(done, total, divisionProgressLabel(done, total));
        resolve();
      } catch (error) {
        if (error.status === 404 || error.status === 409) {
          state.continueAction = null;
          elements.progressContinueWrap.hidden = true;
          reject(error);
          return;
        }
        requesting = false;
        elements.continueDivisionButton.disabled = false;
        elements.progressContinueHint.textContent = `${error.message} Clique novamente para tentar.`;
      }
    };
    elements.continueDivisionButton.focus?.();
  });
}

function replaceSessionBatchResults(start, records, statusForRecord) {
  records.forEach((record, index) => {
    state.results[start + index] = {
      ...record,
      status: statusForRecord(record),
    };
  });
}

async function runBatchCheck(options = {}) {
  const { forceReplace = false } = options;
  if (!state.imported || !state.tokenConfigured || (state.checking && !forceReplace) || state.session.concluded) return;
  const records = buildRecords();
  const uniquePhones = [...new Set(records.map((record) => record.phone).filter(Boolean))];

  if (!records.length) {
    showBatchAlert("Não encontrei números na coluna selecionada.", true);
    return;
  }
  if (uniquePhones.length > MAX_UNIQUE_PER_RUN) {
    showBatchAlert(
      `Esta lista tem ${uniquePhones.length.toLocaleString("pt-PT")} números únicos. O limite por lista é ${MAX_UNIQUE_PER_RUN.toLocaleString("pt-PT")}.`,
      true,
    );
    return;
  }

  if (forceReplace) {
    state.session.checkedPhones.clear();
    state.results = [];
  }

  const previousStatusByPhone = new Map(
    state.results
      .filter((record) => record.phone)
      .map((record) => [record.phone, record.status]),
  );
  const newPhones = uniquePhones.filter((phone) => !state.session.checkedPhones.has(phone));
  const batchStart = state.results.length;

  state.checking = true;
  state.abortPolling = false;
  state.continueAction = null;
  state.session.started = true;
  newPhones.forEach((phone) => state.session.checkedPhones.add(phone));
  state.results = state.results.concat(records.map((record) => ({
    ...record,
    status: record.phone
      ? (previousStatusByPhone.get(record.phone) || "pending")
      : "invalid_format",
  })));
  elements.resultsSection.hidden = false;
  elements.batchAlert.hidden = true;
  updateBatchButton();
  renderBatchResults();

  if (newPhones.length === 0) {
    elements.progressContinueWrap.hidden = true;
    replaceSessionBatchResults(batchStart, records, (record) => (
      record.phone
        ? (previousStatusByPhone.get(record.phone) || "unknown")
        : "invalid_format"
    ));
    renderBatchResults();
    elements.progressWrap.hidden = true;
    showBatchAlert(uniquePhones.length
      ? "Esta lista não contém números novos. Os números repetidos mantêm o estado já conhecido."
      : "Não encontrei números com um formato válido para consultar.", uniquePhones.length === 0);
    state.checking = false;
    renderBatchResults();
    updateBatchButton();
    return;
  }

  const resultByPhone = new Map();
  let completed = 0;

  renderProgress(0, newPhones.length, divisionProgressLabel(0, newPhones.length));

  try {
    renderProgress(0, newPhones.length, divisionProgressLabel(0, newPhones.length));
    const results = await requestCheck(
      newPhones,
      (done, total, phaseMessage, partialResults) => {
        completed = done;
        renderProgress(done, total, phaseMessage || divisionProgressLabel(done, total));
        if (Array.isArray(partialResults) && partialResults.length > 0) {
          partialResults.forEach((item) => {
            if (item && item.phone && item.status) {
              resultByPhone.set(item.phone, item.status);
            }
          });
          replaceSessionBatchResults(batchStart, records, (record) => (
            record.phone
              ? (resultByPhone.get(record.phone) || previousStatusByPhone.get(record.phone) || "pending")
              : "invalid_format"
          ));
          renderBatchResults();
        }
      },
      (jobId, done, total) => waitForManualContinue(jobId, done, total),
      { forceReplace },
    );
    results.forEach((result) => resultByPhone.set(result.phone, result.status));
    completed = newPhones.length;

    replaceSessionBatchResults(batchStart, records, (record) => (
      record.phone
        ? (resultByPhone.get(record.phone) || previousStatusByPhone.get(record.phone) || "unknown")
        : "invalid_format"
    ));
    renderActiveJobBanner(null);
    renderBatchResults();
    renderProgress(completed, newPhones.length, `${completed.toLocaleString("pt-PT")} de ${newPhones.length.toLocaleString("pt-PT")} números verificados com sucesso`);
    void refreshHealth();
    const validCount = state.results.filter((record) => record.status === "valid").length;
    showBatchAlert(validCount
      ? `Verificação automática concluída: ${newPhones.length.toLocaleString("pt-PT")} números processados. ${validCount.toLocaleString("pt-PT")} contactos confirmados na sessão. “Baixar contactos” já inclui apenas os confirmados.`
      : `Verificação automática concluída: ${newPhones.length.toLocaleString("pt-PT")} números processados. Não foram encontrados contactos confirmados para descarregar.`);
  } catch (error) {
    void refreshHealth();
    if (error.cancelledByUser) {
      return;
    }
    if (error.code === "check_already_running") {
      // Remove os registos pendentes desta tentativa bloqueada para que o utilizador possa acompanhar ou limpar e tentar de novo
      newPhones.forEach((phone) => state.session.checkedPhones.delete(phone));
      state.results.splice(batchStart, records.length);
      if (error.activeJob) {
        renderActiveJobBanner(error.activeJob);
      } else {
        void inspectRunningVerification();
      }
      elements.progressWrap.hidden = true;
      showBatchAlert(
        "Já existe uma verificação em andamento no servidor. Use os botões acima para “Acompanhar em andamento”, “Parar e limpar verificação” ou “Limpar e iniciar esta lista agora”.",
        true,
      );
      return;
    }
    (Array.isArray(error.results) ? error.results : []).forEach((result) => {
      resultByPhone.set(result.phone, result.status);
    });
    replaceSessionBatchResults(batchStart, records, (record) => (
      record.phone
        ? (resultByPhone.get(record.phone) || previousStatusByPhone.get(record.phone) || "unknown")
        : "invalid_format"
    ));
    renderBatchResults();
    const totalDivisions = Math.ceil(newPhones.length / PROVIDER_BATCH_SIZE);
    const completedDivisions = Math.floor(completed / PROVIDER_BATCH_SIZE);
    const currentDivision = Math.min(completedDivisions + 1, totalDivisions);
    renderProgress(
      completed,
      newPhones.length,
      `Interrompida na divisão ${currentDivision.toLocaleString("pt-PT")} de ${totalDivisions.toLocaleString("pt-PT")}`,
    );
    const progressMessage = `${completedDivisions.toLocaleString("pt-PT")} divisões concluídas; `;
    showBatchAlert(
      `A verificação foi interrompida. ${progressMessage}${error.message} Os números sem resposta ficam como não confirmados; “Baixar contactos” só inclui os confirmados.`,
      true,
    );
  } finally {
    state.continueAction = null;
    elements.progressContinueWrap.hidden = true;
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
  const hasValidContacts = counts.valid > 0;
  elements.exportValidButton.disabled = !hasValidContacts;
  elements.copyValidButton.disabled = !hasValidContacts;
  elements.exportFormat.disabled = !hasValidContacts;
  elements.exportInvalidButton.disabled = counts.invalid === 0;
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

function sourceColumnsFor(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const label = String(header || "").trim() || `Coluna ${index + 1}`;
    const baseKey = normalizedHeader(label) || `coluna${index + 1}`;
    const occurrence = (seen.get(baseKey) || 0) + 1;
    seen.set(baseKey, occurrence);
    return {
      key: `${baseKey}#${occurrence}`,
      label: occurrence === 1 ? label : `${label} (${occurrence})`,
      index,
    };
  });
}

function combinedSourceColumns(records) {
  const columns = new Map();
  records.forEach((record) => {
    const headers = Array.isArray(record.sourceHeaders)
      ? record.sourceHeaders
      : record.cells.map((_, index) => `Coluna ${index + 1}`);
    sourceColumnsFor(headers).forEach((column) => {
      if (!columns.has(column.key)) columns.set(column.key, { key: column.key, label: column.label });
    });
  });
  return [...columns.values()];
}

function sourceValuesForRecord(record, columns) {
  const headers = Array.isArray(record.sourceHeaders)
    ? record.sourceHeaders
    : record.cells.map((_, index) => `Coluna ${index + 1}`);
  const values = new Map(sourceColumnsFor(headers).map((column) => [
    column.key,
    record.cells[column.index] ?? "",
  ]));
  return columns.map((column) => values.get(column.key) ?? "");
}

function sourceRowsForValidContacts(validContacts, allRecords = validContacts) {
  const sourceColumns = combinedSourceColumns(allRecords);
  const headers = [
    ...sourceColumns.map((column) => column.label),
    "Ficheiro de origem",
    "Nome de WhatsApp",
    "Número de WhatsApp",
  ];
  const rows = [headers];
  validContacts.forEach((record) => {
    rows.push([
      ...sourceValuesForRecord(record, sourceColumns),
      record.sourceName || "",
      record.contactName,
      record.phone,
    ]);
  });
  return rows;
}

function sessionSourceName() {
  const names = [...new Set(state.results.map((record) => record.sourceName).filter(Boolean))];
  return names.length ? names.join(", ").slice(0, 300) : "Sessão cumulativa";
}

function sessionBaseName() {
  const names = [...new Set(state.results.map((record) => record.sourceName).filter(Boolean))];
  if (names.length !== 1) return "sessao-contactos";
  return names[0]
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "numeros";
}

async function prepareWhatsAppFile(format = elements.exportFormat.value) {
  const validContacts = verifiedContacts();
  if (!validContacts.length) return null;

  const rows = sourceRowsForValidContacts(validContacts, state.results);
  const baseName = sessionBaseName();

  if (format === "xlsx") {
    const XLSX = await loadSpreadsheetLibrary();
    const workbook = XLSX.utils.book_new();
    const sheetName = "Contactos com WhatsApp";
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
      await saveExportHistory(file, contacts.length, sessionSourceName());
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

function downloadCsv(filter, options = {}) {
  const rows = state.results.filter((row) => filter === "all" || row.status === filter);
  if (!rows.length) return false;
  if (
    filter === "all"
    && !options.includeUnknown
    && rows.some((row) => !["valid", "invalid", "invalid_format"].includes(row.status))
  ) {
    return false;
  }

  const sourceColumns = combinedSourceColumns(rows);
  const headers = [
    ...sourceColumns.map((column) => column.label),
    "ficheiro_origem",
    "telefone_normalizado",
    "status_whatsapp",
  ];
  const dataRows = rows.map((row) => {
    return [
      ...sourceValuesForRecord(row, sourceColumns),
      row.sourceName || "",
      row.phone || "",
      statusForExport(row.status),
    ];
  });
  const content = `\uFEFF${[headers, ...dataRows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const baseName = sessionBaseName();
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
    void saveExportHistory({ fileName, blob }, confirmedCount, sessionSourceName())
      .then(() => renderExportHistory(`${fileName} foi guardado no histórico deste navegador.`))
      .catch(() => setHistoryStatus(
        "O ficheiro foi descarregado, mas não foi possível guardá-lo no histórico local.",
        true,
      ));
  }
  return true;
}

elements.exportValidButton.addEventListener("click", downloadWhatsAppFile);
elements.copyValidButton.addEventListener("click", copyWhatsAppContacts);
elements.exportInvalidButton.addEventListener("click", () => downloadCsv("invalid"));
elements.exportAllButton.addEventListener("click", () => downloadCsv("all"));
elements.concludeSessionButton.addEventListener("click", async () => {
  if (!state.session.started || state.session.concluded || state.checking) return;
  try {
    const file = await prepareWhatsAppFile();
    if (!file) {
      showBatchAlert("Não existem números confirmados com WhatsApp nesta sessão para descarregar.", true);
      return;
    }
    const contacts = verifiedContacts();
    triggerBlobDownload(file.fileName, file.blob);

    state.session.concluded = true;
    updateBatchButton();
    renderBatchResults();

    try {
      await saveExportHistory(file, contacts.length, sessionSourceName());
      await renderExportHistory(`${file.fileName} foi guardado no histórico deste navegador.`);
      showBatchAlert(`Sessão concluída. O ficheiro apenas com os ${contacts.length.toLocaleString("pt-PT")} números que têm WhatsApp foi descarregado.`);
    } catch {
      showBatchAlert(`Sessão concluída. O ficheiro apenas com os ${contacts.length.toLocaleString("pt-PT")} números que têm WhatsApp foi descarregado.`);
    }
  } catch (error) {
    showBatchAlert(`Não foi possível descarregar os contactos com WhatsApp: ${error.message}`, true);
  }
});
elements.newSessionButton.addEventListener("click", () => {
  if (!state.session.concluded || state.checking) return;
  if (!window.confirm("Iniciar uma nova sessão? Os resultados atuais serão removidos desta vista. Confirme que já guardou o ficheiro final.")) return;

  state.session = {
    started: false,
    concluded: false,
    checkedPhones: new Set(),
  };
  state.imported = null;
  state.results = [];
  state.filter = "all";
  elements.fileInput.value = "";
  elements.pasteInput.value = "";
  elements.resultFilter.value = "all";
  elements.fileSummary.hidden = true;
  elements.importSettings.hidden = true;
  elements.importPreview.hidden = true;
  elements.resultsSection.hidden = true;
  elements.progressWrap.hidden = true;
  elements.batchAlert.hidden = true;
  updateBatchButton();
});
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