import{j as n}from"./index-D9T-0DrC.js";const e=`<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f5f8f6">
    <meta name="description" content="Consulte números WhatsApp individualmente ou em lote, sem enviar mensagens.">
    <title>Verificador WhatsApp — Contacto</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
    <script src="/app.js" defer><\/script>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/" aria-label="Contacto, início">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 3.5a12.1 12.1 0 0 0-10.3 18.4L4 28l6.4-1.7A12.2 12.2 0 1 0 16 3.5Z" fill="currentColor" opacity=".16"/>
            <path d="M16 5.8a9.8 9.8 0 0 0-8.4 14.9l.4.7-.8 3.1 3.2-.8.7.4A9.8 9.8 0 1 0 16 5.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12.2 11.2c-.3-.6-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.2 1.2-1.2 2.8s1.2 3.1 1.4 3.3c.2.2 2.3 3.7 5.7 5 2.8 1.1 3.4.9 4 .8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.4-.2-.8-.4l-2.4-1.2c-.3-.1-.6-.2-.8.2l-1 1.3c-.2.3-.5.3-.8.1-.4-.2-1.6-.6-3.1-2-1.1-1-1.8-2.2-2-2.6-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.3-.4.4-.6.1-.2.1-.4 0-.6l-1.1-2.6Z" fill="currentColor" transform="translate(1.7 1.1) scale(.76)"/>
          </svg>
        </span>
        <span class="brand-word">contacto<span>check</span></span>
      </a>
    </header>

    <main class="page-shell">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> VERIFICAÇÃO DE CONTACTOS</p>
          <h1>Saiba quem está no <span>WhatsApp.</span></h1>
          <p class="hero-description">Consulte um número ou uma lista inteira. Separe os resultados sem enviar mensagens aos contactos.</p>
        </div>
        <div class="hero-stamp" aria-label="Consulta individual e em lote">
          <div class="stamp-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M7.5 5.5h17a2 2 0 0 1 2 2v17a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7"/>
              <path d="m10 12 2 2 3.5-4M17.5 12h5M10 20l2 2 3.5-4M17.5 20h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div><strong>Dois modos</strong><span>Individual e lista em lote</span></div>
        </div>
      </section>

      <div class="workspace-grid">
        <section class="work-card" aria-labelledby="toolTitle">
          <div class="card-heading">
            <div>
              <p class="section-kicker">O VERIFICADOR</p>
              <h2 id="toolTitle">Escolha como começar</h2>
            </div>
          </div>

          <div class="mode-tabs" role="tablist" aria-label="Modo de verificação">
            <button class="mode-tab is-active" id="singleTab" type="button" role="tab" aria-selected="true" aria-controls="singlePanel">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" stroke-width="1.6"/><path d="m13.2 13.2 4.1 4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              Um número
            </button>
            <button class="mode-tab" id="batchTab" type="button" role="tab" aria-selected="false" aria-controls="batchPanel">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 3.5h7l3 3v10a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 16.5v-11A2 2 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 3.8v3h3M7 10h6M7 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Lista em lote
              <span class="tab-count">até 100 por chamada</span>
            </button>
          </div>

          <section class="mode-panel" id="singlePanel" role="tabpanel" aria-labelledby="singleTab">
            <form id="singleForm" novalidate>
              <label class="field-label" for="singlePhone">Número de telefone</label>
              <div class="phone-input-row">
                <input id="singlePhone" name="phone" type="tel" autocomplete="tel" placeholder="+258 84 123 4567" aria-describedby="singleHint">
                <button class="button button-primary" id="singleCheckButton" type="submit" disabled>
                  <span>Verificar</span>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
              <p class="field-hint" id="singleHint">Exemplo de Moçambique: +258 84 123 4567.</p>
              <div class="country-settings">
                <label class="field-label" for="singleCountry">País dos números sem indicativo</label>
                <div class="country-controls">
                  <select id="singleCountry" class="select-control">
                    <option value="+55">Brasil (+55)</option>
                    <option value="+351">Portugal (+351)</option>
                    <option value="+244">Angola (+244)</option>
                    <option value="+258" selected>Moçambique (+258)</option>
                    <option value="+1">EUA / Canadá (+1)</option>
                    <option value="+44">Reino Unido (+44)</option>
                    <option value="custom">Outro indicativo</option>
                  </select>
                  <input id="singleCustomDial" class="custom-dial" type="text" inputmode="numeric" placeholder="+ código" aria-label="Indicativo do país" hidden>
                </div>
              </div>
              <div class="inline-result" id="singleResult" aria-live="polite" hidden></div>
            </form>
          </section>

          <section class="mode-panel" id="batchPanel" role="tabpanel" aria-labelledby="batchTab" hidden>
            <div class="upload-area">
              <label class="field-label" for="fileInput">Importar uma lista</label>
              <div class="dropzone" id="dropzone">
                <input id="fileInput" type="file" accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden>
                <span class="drop-icon" aria-hidden="true">
                  <svg viewBox="0 0 28 28" fill="none"><path d="M14 18V4m0 0L9 9m5-5 5 5M5 17v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div class="drop-copy">
                  <strong>Arraste um ficheiro para aqui</strong>
                  <span>CSV, TXT ou Excel (.xlsx/.xls), até 5 MB</span>
                </div>
                <button class="button button-quiet" id="chooseFileButton" type="button">Escolher ficheiro</button>
              </div>
              <div class="file-summary" id="fileSummary" hidden>
                <span class="file-icon" id="fileIcon" aria-hidden="true">CSV</span>
                <span class="file-name" id="fileName"></span>
                <span class="file-count" id="fileCount"></span>
                <button type="button" class="icon-button" id="removeFileButton" aria-label="Remover ficheiro" title="Remover ficheiro">×</button>
              </div>

              <div class="or-divider"><span>ou cole os números, um por linha</span></div>
              <label class="sr-only" for="pasteInput">Cole números de telefone, um por linha</label>
              <textarea id="pasteInput" class="paste-input" rows="3" placeholder="+258 84 123 4567&#10;+258 87 123 4567&#10;841234568"></textarea>
              <div class="paste-actions">
                <span class="field-hint">Aceita números com ou sem separadores.</span>
                <button class="text-button" id="loadPasteButton" type="button">Usar lista colada</button>
              </div>
            </div>

            <div class="import-settings" id="importSettings" hidden>
              <div class="import-setting">
                <label class="field-label" for="phoneColumn">Coluna dos números</label>
                <select id="phoneColumn" class="select-control"></select>
              </div>
              <div class="import-setting">
                <label class="field-label" for="batchCountry">País dos números sem indicativo</label>
                <div class="country-controls">
                  <select id="batchCountry" class="select-control">
                    <option value="+55">Brasil (+55)</option>
                    <option value="+351">Portugal (+351)</option>
                    <option value="+244">Angola (+244)</option>
                    <option value="+258" selected>Moçambique (+258)</option>
                    <option value="+1">EUA / Canadá (+1)</option>
                    <option value="+44">Reino Unido (+44)</option>
                    <option value="custom">Outro indicativo</option>
                  </select>
                  <input id="batchCustomDial" class="custom-dial" type="text" inputmode="numeric" placeholder="+ código" aria-label="Indicativo do país para o ficheiro" hidden>
                </div>
              </div>
              <label class="checkbox-label" id="headerSetting">
                <input id="hasHeader" type="checkbox">
                <span class="checkbox-box" aria-hidden="true"></span>
                <span>A primeira linha tem títulos de coluna</span>
              </label>
            </div>

            <div class="import-preview" id="importPreview" hidden>
              <div class="preview-icon" aria-hidden="true">↳</div>
              <div><strong id="previewTitle">Lista pronta</strong><span id="previewDetails"></span></div>
            </div>

            <div class="batch-actions">
              <button class="button button-primary button-wide" id="batchCheckButton" type="button" disabled>
                <span>Verificar lista</span>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <p class="field-hint" id="batchButtonHint">Adicione o Secret WHAPI_TOKEN para ativar.</p>
            </div>
            <div class="progress-wrap" id="progressWrap" hidden aria-live="polite">
              <div class="progress-top"><span id="progressLabel">A preparar a consulta…</span><span id="progressPercent">0%</span></div>
              <div class="progress-track"><span id="progressBar"></span></div>
            </div>
            <div class="inline-alert" id="batchAlert" role="status" hidden></div>
          </section>

          <div class="card-footnote">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 2.2 3 4.5v4.2c0 3.5 2.4 5.8 6 7.1 3.6-1.3 6-3.6 6-7.1V4.5L9 2.2Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m6.5 8.9 1.7 1.7 3.4-3.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Esta ferramenta consulta o serviço conectado; não envia mensagens aos contactos.</span>
          </div>
        </section>

      </div>

      <section class="results-section" id="resultsSection" hidden aria-labelledby="resultsTitle">
        <div class="results-heading">
          <div><p class="section-kicker">RESULTADOS</p><h2 id="resultsTitle">Resumo da consulta</h2></div>
          <div class="export-actions">
            <button class="button button-outline" id="exportValidButton" type="button">↓ Com WhatsApp</button>
            <button class="button button-outline" id="exportInvalidButton" type="button">↓ Sem WhatsApp</button>
            <button class="button button-quiet" id="exportAllButton" type="button">Exportar tudo</button>
          </div>
        </div>
        <div class="summary-grid">
          <article class="summary-card summary-valid"><span class="summary-label"><span class="summary-dot"></span> Tem WhatsApp</span><strong id="validCount">0</strong><span class="summary-sub">números confirmados</span></article>
          <article class="summary-card summary-invalid"><span class="summary-label"><span class="summary-dot"></span> Não tem WhatsApp</span><strong id="invalidCount">0</strong><span class="summary-sub">números não encontrados</span></article>
          <article class="summary-card summary-format"><span class="summary-label"><span class="summary-dot"></span> Formato inválido</span><strong id="formatCount">0</strong><span class="summary-sub">revise o indicativo</span></article>
          <article class="summary-card summary-unknown"><span class="summary-label"><span class="summary-dot"></span> Não confirmado</span><strong id="unknownCount">0</strong><span class="summary-sub">consulta inconclusiva</span></article>
        </div>
        <div class="table-card">
          <div class="table-heading">
            <div><h3>Números consultados</h3><span id="tableSubtitle">As consultas não enviam mensagens.</span></div>
            <label class="filter-control"><span>Mostrar</span><select id="resultFilter" class="select-control select-small"><option value="all">Todos</option><option value="valid">Tem WhatsApp</option><option value="invalid">Não tem</option><option value="invalid_format">Formato inválido</option><option value="unknown">Não confirmado</option></select></label>
          </div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Número</th><th>Estado</th><th>Indicativo</th></tr></thead>
              <tbody id="resultsBody"></tbody>
            </table>
          </div>
          <p class="table-footnote" id="tableFootnote"></p>
        </div>
      </section>

      <footer class="page-footer">
        <span>contacto<span class="footer-accent">check</span></span>
        <span>Os números introduzidos são enviados ao serviço conectado para consulta. Consulte a política do fornecedor antes de processar dados pessoais.</span>
      </footer>
    </main>
  </body>
</html>`,t=`:root {
  color-scheme: light;
  --ink: #142620;
  --muted: #74817b;
  --soft-ink: #47574f;
  --green: #1d8062;
  --green-dark: #176b52;
  --green-pale: #eaf5f0;
  --line: #e4ebe7;
  --surface: #ffffff;
  --page: #f5f8f6;
  --shadow: 0 15px 40px rgba(24, 59, 44, 0.045);
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background:
    radial-gradient(ellipse at 88% 2%, rgba(213, 236, 224, 0.45), transparent 30rem),
    var(--page);
  color: var(--ink);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}

a {
  color: inherit;
}

[hidden] {
  display: none !important;
}

.topbar {
  width: min(1180px, calc(100% - 64px));
  min-height: 76px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(218, 229, 222, 0.78);
}

.brand {
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
}

.brand-mark {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  color: var(--green);
}

.brand-mark svg {
  width: 31px;
  height: 31px;
}

.brand-word {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.75px;
}

.brand-word > span {
  color: var(--green);
}

.page-shell {
  width: min(1180px, calc(100% - 64px));
  margin: 0 auto;
}

.hero {
  padding: 54px 0 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.hero-copy {
  width: 100%;
}

.eyebrow,
.section-kicker {
  margin: 0;
  color: #728179;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
}

.eyebrow-line {
  width: 19px;
  height: 1px;
  background: var(--green);
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin: 17px 0 12px;
  color: #142720;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: clamp(38px, 4.6vw, 55px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -2.7px;
}

h1 span {
  color: var(--green);
}

.hero-description {
  max-width: 515px;
  margin: 0 auto;
  color: #68776f;
  font-size: 15px;
  line-height: 1.7;
}

.hero-stamp {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  margin: 0;
  border: 1px solid #dfebe4;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
}

.stamp-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  color: var(--green);
  border-radius: 11px;
  background: var(--green-pale);
}

.stamp-icon svg {
  width: 24px;
  height: 24px;
}

.hero-stamp strong,
.hero-stamp span {
  display: block;
}

.hero-stamp strong {
  margin-bottom: 3px;
  font-size: 12px;
  font-weight: 700;
}

.hero-stamp div:last-child > span {
  color: #7b8982;
  font-size: 11px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 19px;
}

.work-card,
.table-card {
  border: 1px solid #e6ece8;
  border-radius: 17px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.work-card {
  width: 100%;
  max-width: 1180px;
  min-height: 425px;
  margin: 0 auto;
  padding: 25px 27px 0;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 0 20px;
  text-align: center;
}

.card-heading h2,
.side-card h2,
.results-heading h2 {
  margin: 7px 0 0;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.55px;
}

.mode-tabs {
  display: flex;
  justify-content: center;
  gap: 22px;
  border-bottom: 1px solid var(--line);
}

.mode-tab {
  min-height: 43px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px 11px;
  color: #87928d;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  transition: color 140ms ease, border-color 140ms ease;
}

.mode-tab:hover {
  color: #52655b;
}

.mode-tab.is-active {
  color: var(--green);
  border-bottom-color: var(--green);
}

.mode-tab svg {
  width: 17px;
  height: 17px;
}

.tab-count {
  margin-left: 1px;
  color: #9ca7a1;
  font-size: 10px;
  font-weight: 500;
}

.mode-panel {
  max-width: 1040px;
  margin: 0 auto;
  padding: 22px 0 19px;
}

.field-label {
  display: block;
  margin: 0 0 8px;
  color: #394c43;
  font-size: 11px;
  font-weight: 700;
}

.phone-input-row {
  display: flex;
  gap: 9px;
}

.phone-input-row input,
.select-control,
.custom-dial,
.paste-input {
  color: var(--ink);
  border: 1px solid #dfe7e2;
  border-radius: 9px;
  background: #fff;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.phone-input-row input {
  width: 100%;
  min-width: 0;
  height: 45px;
  padding: 0 13px;
  font-size: 14px;
  letter-spacing: 0.02em;
}

.phone-input-row input::placeholder,
.paste-input::placeholder,
.custom-dial::placeholder {
  color: #a3aea8;
}

.phone-input-row input:focus,
.select-control:focus,
.custom-dial:focus,
.paste-input:focus {
  border-color: #6eb193;
  box-shadow: 0 0 0 3px rgba(64, 150, 110, 0.1);
}

.button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}

.button:not(:disabled):active {
  transform: translateY(1px);
}

.button svg {
  width: 16px;
  height: 16px;
}

.button-primary {
  padding: 0 15px;
  color: white;
  background: var(--green);
  box-shadow: 0 5px 11px rgba(29, 128, 98, 0.13);
}

.button-primary:not(:disabled):hover {
  background: var(--green-dark);
  box-shadow: 0 7px 16px rgba(29, 128, 98, 0.2);
}

.button-primary:disabled {
  color: #fff;
  background: #a7cbb9;
  box-shadow: none;
}

.button-quiet {
  min-height: 34px;
  padding: 0 11px;
  color: #3d5d4e;
  border-color: #dce9e1;
  background: #fff;
}

.button-quiet:not(:disabled):hover {
  color: var(--green-dark);
  border-color: #b6d2c2;
  background: #f5faf7;
}

.button-outline {
  min-height: 34px;
  padding: 0 10px;
  color: #456256;
  border-color: #dce7e1;
  background: white;
}

.button-outline:not(:disabled):hover {
  border-color: #a8cbb8;
  background: #f5faf7;
}

.field-hint {
  margin: 7px 0 0;
  color: #88958e;
  font-size: 11px;
  line-height: 1.5;
}

.country-settings {
  margin-top: 24px;
}

.country-controls {
  display: flex;
  gap: 8px;
}

.select-control {
  width: 100%;
  height: 39px;
  padding: 0 32px 0 11px;
  color: #46584e;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='m3 4.5 3 3 3-3' stroke='%2377867d' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  font-size: 12px;
}

.custom-dial {
  width: 95px;
  flex: 0 0 95px;
  height: 39px;
  padding: 0 10px;
  font-size: 12px;
}

.inline-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  padding: 12px 13px;
  border: 1px solid #e5ece8;
  border-radius: 10px;
  background: #fbfdfb;
}

.inline-result.is-valid {
  border-color: #d1e9db;
  background: #f3faf6;
}

.inline-result.is-invalid {
  border-color: #f0dbd6;
  background: #fff8f6;
}

.inline-result.is-unknown {
  border-color: #eadfc9;
  background: #fffbf3;
}

.result-symbol {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--green);
  border-radius: 50%;
  background: #e1f2e8;
  font-size: 12px;
  font-weight: 700;
}

.is-invalid .result-symbol {
  color: #b85d4b;
  background: #fbe6e1;
}

.is-unknown .result-symbol {
  color: #9b7b40;
  background: #f5ecd8;
}

.inline-result strong,
.inline-result span {
  display: block;
}

.inline-result strong {
  margin: 1px 0 3px;
  font-size: 12px;
}

.inline-result span {
  color: #78867e;
  font-size: 11px;
  line-height: 1.45;
}

.upload-area > .field-label {
  margin-bottom: 9px;
}

.dropzone {
  min-height: 107px;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px;
  border: 1px dashed #b6cfc0;
  border-radius: 12px;
  background: #f9fcfa;
  transition: border-color 140ms ease, background 140ms ease;
}

.dropzone.is-dragging {
  border-color: var(--green);
  background: #eef8f2;
}

.drop-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--green);
  border-radius: 11px;
  background: #e9f5ee;
}

.drop-icon svg {
  width: 25px;
  height: 25px;
}

.drop-copy {
  min-width: 0;
  flex: 1;
}

.drop-copy strong,
.drop-copy span {
  display: block;
}

.drop-copy strong {
  margin-bottom: 5px;
  color: #344940;
  font-size: 12px;
}

.drop-copy span {
  color: #89968e;
  font-size: 10px;
  line-height: 1.45;
}

.file-summary {
  min-height: 45px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  margin-top: 10px;
  border: 1px solid #e1e9e4;
  border-radius: 9px;
  background: #fbfdfb;
}

.file-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  color: #4c8068;
  border-radius: 7px;
  background: #eaf5ef;
  font-size: 8px;
  font-weight: 800;
}

.file-name {
  min-width: 0;
  overflow: hidden;
  color: #42554a;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-count {
  margin-left: auto;
  color: #7e8c83;
  font-size: 10px;
  white-space: nowrap;
}

.icon-button {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  color: #7c8a81;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 19px;
}

.icon-button:hover {
  color: #b25548;
  background: #fdf0ed;
}

.or-divider {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 14px 0 10px;
  color: #96a19b;
  font-size: 10px;
}

.or-divider::before,
.or-divider::after {
  height: 1px;
  flex: 1;
  background: #edf1ee;
  content: "";
}

.paste-input {
  width: 100%;
  min-height: 74px;
  resize: vertical;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
}

.paste-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.text-button {
  padding: 4px 0;
  color: var(--green);
  border: 0;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
}

.text-button:hover {
  color: var(--green-dark);
  text-decoration: underline;
}

.import-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid #edf1ee;
}

.import-setting {
  min-width: 0;
}

.checkbox-label {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  color: #65746b;
  font-size: 11px;
  cursor: pointer;
}

.checkbox-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.checkbox-box {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: 1px solid #bdcbc2;
  border-radius: 4px;
  background: white;
}

.checkbox-label input:checked + .checkbox-box {
  border-color: var(--green);
  background: var(--green);
}

.checkbox-label input:checked + .checkbox-box::after {
  width: 8px;
  height: 4px;
  border-bottom: 1.5px solid white;
  border-left: 1.5px solid white;
  content: "";
  transform: translateY(-1px) rotate(-45deg);
}

.checkbox-label input:focus-visible + .checkbox-box {
  outline: 3px solid rgba(64, 150, 110, 0.2);
}

.import-preview {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 11px;
  margin-top: 14px;
  border-radius: 9px;
  background: #f4f9f6;
}

.preview-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--green);
  border-radius: 50%;
  background: #e0f0e7;
  font-weight: 700;
}

.import-preview strong,
.import-preview span {
  display: block;
}

.import-preview strong {
  margin: 1px 0 3px;
  color: #3b5949;
  font-size: 11px;
}

.import-preview span {
  color: #7b8b80;
  font-size: 10px;
  line-height: 1.4;
}

.batch-actions {
  margin-top: 15px;
}

.button-wide {
  width: 100%;
  min-height: 43px;
}

.batch-actions .field-hint {
  text-align: center;
}

.progress-wrap {
  margin-top: 16px;
}

.progress-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  color: #65756b;
  font-size: 10px;
}

.progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #eaf0ec;
}

.progress-track span {
  width: 0;
  height: 100%;
  display: block;
  border-radius: inherit;
  background: var(--green);
  transition: width 200ms ease;
}

.inline-alert {
  padding: 10px 12px;
  margin-top: 13px;
  color: #86613c;
  border: 1px solid #eee0ca;
  border-radius: 8px;
  background: #fffbf3;
  font-size: 11px;
  line-height: 1.5;
}

.inline-alert.is-error {
  color: #9b4d41;
  border-color: #efd9d3;
  background: #fff8f6;
}

.card-footnote {
  min-height: 45px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 -27px;
  padding: 0 27px;
  color: #74847b;
  border-top: 1px solid #edf1ee;
  background: #fbfdfb;
  font-size: 10px;
}

.card-footnote svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #5d9a76;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.side-card {
  padding: 20px 20px 18px;
}

.setup-card {
  flex: 1;
  background:
    radial-gradient(ellipse at 100% 0%, rgba(222, 242, 229, 0.5), transparent 14rem),
    white;
}

.side-card-title {
  display: flex;
  align-items: center;
  gap: 11px;
}

.side-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 11px;
}

.side-icon svg {
  width: 22px;
  height: 22px;
}

.side-icon-green {
  color: var(--green);
  background: #eaf5ee;
}

.side-card-title .section-kicker {
  font-size: 9px;
}

.side-card h2 {
  margin-top: 4px;
  font-size: 16px;
}

.setup-steps {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 0;
  margin: 22px 0 18px;
  list-style: none;
}

.setup-steps li {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.setup-steps li > span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #59816b;
  border: 1px solid #dbe9e0;
  border-radius: 8px;
  background: #f8fbf9;
  font-size: 9px;
  font-weight: 700;
}

.setup-steps p {
  margin: 3px 0 0;
  color: #627269;
  font-size: 11px;
  line-height: 1.55;
}

.setup-steps a {
  color: var(--green);
  font-weight: 700;
  text-decoration: none;
}

.setup-steps a:hover {
  text-decoration: underline;
}

.setup-steps code {
  padding: 2px 5px;
  color: #416451;
  border-radius: 4px;
  background: #edf5f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.secure-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 11px;
  color: #7a866f;
  border: 1px solid #eee9d9;
  border-radius: 8px;
  background: #fffdf7;
  font-size: 10px;
  line-height: 1.45;
}

.secure-note svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: #9c895b;
}

.notes-card {
  padding-bottom: 17px;
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 13px;
}

.note-check {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #4f9870;
  border-radius: 50%;
  background: #eaf5ee;
  font-size: 10px;
  font-weight: 700;
}

.note-item p {
  margin: 0;
  color: #75837a;
  font-size: 10px;
  line-height: 1.5;
}

.learn-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 15px;
  color: #34805f;
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
}

.learn-link:hover {
  text-decoration: underline;
}

.learn-link svg {
  width: 13px;
  height: 13px;
}

.results-section {
  max-width: 1180px;
  margin: 0 auto;
  padding-top: 31px;
}

.results-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-bottom: 16px;
  text-align: center;
}

.results-heading h2 {
  font-size: 21px;
}

.export-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.summary-card {
  min-height: 102px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 15px 16px 12px;
  border: 1px solid #e5ece8;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(24, 59, 44, 0.025);
  text-align: center;
}

.summary-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #65746c;
  font-size: 10px;
  font-weight: 600;
}

.summary-dot {
  width: 7px;
  height: 7px;
  display: inline-block;
  border-radius: 50%;
  background: #58a478;
}

.summary-invalid .summary-dot {
  background: #d07b6c;
}

.summary-format .summary-dot {
  background: #d1a052;
}

.summary-unknown .summary-dot {
  background: #9b9fa0;
}

.summary-card strong {
  color: #21342b;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 25px;
  line-height: 1;
  letter-spacing: -1px;
}

.summary-sub {
  margin: 0;
  color: #9aa49e;
  font-size: 9px;
}

.table-card {
  overflow: hidden;
}

.table-heading {
  min-height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 17px;
  border-bottom: 1px solid #edf1ee;
  text-align: center;
}

.table-heading h3 {
  margin: 0 0 4px;
  color: #33463c;
  font-size: 12px;
  font-weight: 700;
}

.table-heading > div > span {
  color: #89958e;
  font-size: 10px;
}

.filter-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #758279;
  font-size: 10px;
}

.select-small {
  width: auto;
  min-width: 138px;
  height: 32px;
  font-size: 10px;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

thead {
  background: #fbfcfb;
}

th,
td {
  padding: 11px 17px;
  border-bottom: 1px solid #f0f3f1;
  font-size: 11px;
}

th {
  color: #86928b;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

td {
  color: #53635a;
}

tbody tr:last-child td {
  border-bottom: 0;
}

td:first-child {
  color: #30443a;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.table-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #eef7f1;
  color: #47755a;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.table-status::before {
  width: 5px;
  height: 5px;
  display: inline-block;
  border-radius: 50%;
  background: currentColor;
  content: "";
}

.table-status.is-invalid {
  color: #ac6255;
  background: #fcf0ed;
}

.table-status.is-format,
.table-status.is-unknown {
  color: #927344;
  background: #fbf5e9;
}

.table-status.is-unknown {
  color: #727b78;
  background: #f0f2f1;
}

.table-footnote {
  min-height: 31px;
  margin: 0;
  padding: 8px 17px 9px;
  color: #909b94;
  border-top: 1px solid #f0f3f1;
  font-size: 9px;
}

.page-footer {
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
  margin-top: 25px;
  color: #8a9890;
  border-top: 1px solid #e3ebe6;
  font-size: 9px;
}

.page-footer > span:first-child {
  color: #64776c;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.4px;
  white-space: nowrap;
}

.footer-accent {
  color: var(--green);
}

.page-footer > span:last-child {
  text-align: center;
  line-height: 1.5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .topbar,
  .page-shell {
    width: min(100% - 40px, 720px);
  }

  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .work-card {
    min-height: auto;
  }

  .hero {
    padding-top: 43px;
  }
}

@media (max-width: 620px) {
  .topbar,
  .page-shell {
    width: calc(100% - 32px);
  }

  .topbar {
    min-height: 66px;
  }

  .brand-word {
    font-size: 15px;
  }

  .hero {
    padding: 36px 0 24px;
  }

  h1 {
    font-size: 40px;
    letter-spacing: -2px;
  }

  .hero-description {
    max-width: 390px;
    font-size: 13px;
  }

  .work-card {
    padding: 20px 17px 0;
    border-radius: 14px;
  }

  .card-heading h2 {
    font-size: 17px;
  }

  .mode-tabs {
    gap: 17px;
  }

  .mode-tab {
    gap: 6px;
    font-size: 11px;
  }

  .tab-count {
    display: none;
  }

  .mode-panel {
    padding: 19px 0 17px;
  }

  .phone-input-row {
    align-items: stretch;
  }

  .phone-input-row input {
    font-size: 12px;
  }

  .phone-input-row .button {
    padding: 0 11px;
    font-size: 11px;
  }

  .dropzone {
    flex-wrap: wrap;
    padding: 13px;
  }

  .drop-copy {
    flex: 1 1 calc(100% - 55px);
  }

  .dropzone .button {
    width: 100%;
  }

  .import-settings {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .checkbox-label {
    grid-column: auto;
  }

  .card-footnote {
    min-height: 48px;
    margin: 0 -17px;
    padding: 7px 17px;
    font-size: 9px;
  }

  .side-column {
    grid-template-columns: 1fr;
  }

  .side-card {
    padding: 18px;
  }

  .results-heading {
    align-items: center;
  }

  .results-heading h2 {
    font-size: 19px;
  }

  .export-actions {
    width: 100%;
  }

  .export-actions .button {
    flex: 1;
    padding: 0 7px;
    font-size: 9px;
  }

  .summary-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .summary-card {
    min-height: 91px;
    padding: 12px;
  }

  .summary-label {
    font-size: 9px;
  }

  .summary-card strong {
    font-size: 22px;
  }

  .table-heading {
    align-items: center;
  }

  .filter-control {
    width: 100%;
    justify-content: center;
  }

  .select-small {
    flex: 1;
  }

  th,
  td {
    padding: 10px 12px;
  }

  .page-footer {
    align-items: center;
  }
}
`,o=e.replace(/<link rel="icon"[^>]*>\s*/i,"").replace(/<link rel="stylesheet" href="\/styles\.css">\s*/i,"").replace(/<script src="\/app\.js" defer><\/script>\s*/i,"").replace("</head>",`<style>${t}</style>
  </head>`);function a(){return n.jsx("iframe",{title:"ContactoCheck — página atual",srcDoc:o,style:{display:"block",width:"100%",height:"100vh",border:0}})}export{a as Current};
