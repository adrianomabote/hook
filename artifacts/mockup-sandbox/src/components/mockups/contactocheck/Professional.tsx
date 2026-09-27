import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  LockKeyhole,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import "./Professional.css";

type Mode = "single" | "batch";
type FilePreview = { name: string; extension: string; count: number | null };

const countries = [
  ["+55", "Brasil (+55)"],
  ["+351", "Portugal (+351)"],
  ["+244", "Angola (+244)"],
  ["+258", "Moçambique (+258)"],
  ["+1", "EUA / Canadá (+1)"],
  ["+44", "Reino Unido (+44)"],
  ["custom", "Outro indicativo"],
];

const demoRows = [
  { number: "+258 84 123 4567", status: "Exemplo de estado", type: "good", code: "+258" },
  { number: "+351 912 345 678", status: "Exemplo de estado", type: "muted", code: "+351" },
  { number: "+244 923 456 789", status: "Rever formato", type: "attention", code: "+244" },
];

function BrandMark() {
  return (
    <span className="cc-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.508-5.26c.002-5.45 4.437-9.884 9.89-9.884 2.64.001 5.122 1.03 7.004 2.914a9.825 9.825 0 0 1 2.9 7.001c-.003 5.45-4.437 9.885-9.886 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.87 11.87 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413Z"/>
      </svg>
    </span>
  );
}

function CountrySelect({ value, onChange, labelId }: { value: string; onChange: (value: string) => void; labelId: string }) {
  return (
    <select id={labelId} className="cc-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {countries.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
    </select>
  );
}

export function Professional() {
  const [mode, setMode] = useState<Mode>("single");
  const [phone, setPhone] = useState("");
  const [singleCountry, setSingleCountry] = useState("+258");
  const [batchCountry, setBatchCountry] = useState("+258");
  const [customSingle, setCustomSingle] = useState("");
  const [customBatch, setCustomBatch] = useState("");
  const [pasted, setPasted] = useState("");
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [toast, setToast] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [headerRow, setHeaderRow] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 4400);
  };

  const previewAction = (kind: "single" | "batch") => {
    setShowResults(true);
    const subject = kind === "single" ? "O número" : "A lista";
    notify(`${subject} foi usado apenas para demonstrar a interface. Não foi feita qualquer consulta.`);
    window.setTimeout(() => document.getElementById("cc-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const extension = (file.name.split(".").pop() || "ficheiro").toLowerCase();
    const supported = ["csv", "txt", "xlsx", "xls"].includes(extension);
    if (!supported) {
      notify("Formato não suportado nesta pré-visualização. Use CSV, TXT, XLSX ou XLS.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("O limite de demonstração é 5 MB. Nenhum ficheiro foi enviado.");
      return;
    }
    let count: number | null = null;
    if (extension === "csv" || extension === "txt") {
      const text = await file.text();
      count = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    }
    setFilePreview({ name: file.name, extension, count });
    setShowResults(false);
    notify("Ficheiro selecionado localmente. Esta pré-visualização não envia nem verifica dados.");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragging");
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const loadPasted = () => {
    const count = pasted.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    if (!count) {
      notify("Cole pelo menos um número para preparar a pré-visualização.");
      return;
    }
    setFilePreview({ name: "Lista colada", extension: "txt", count });
    setShowResults(false);
    notify(`${count.toLocaleString("pt-PT")} linhas preparadas apenas para demonstração. Nenhuma consulta foi feita.`);
  };

  const submitSingle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone.trim()) {
      notify("Introduza um número para ver a pré-visualização da interação.");
      return;
    }
    previewAction("single");
  };

  const exportPreview = (label: string) => notify(`${label}: exportação disponível apenas na experiência real. Esta pré-visualização não cria ficheiros.`);

  return (
    <div className="cc-page">
      <div className="cc-shell">
        <header className="cc-header">
          <a href="#inicio" className="cc-brand" aria-label="ContactoCheck — início">
            <BrandMark />
            <span className="cc-brand-name">contacto<span>check</span></span>
          </a>
          <nav className="cc-header-right" aria-label="Navegação principal">
            <a className="cc-header-link" href="#como-funciona">Como funciona</a>
            <a className="cc-header-cta" href="#verificador">Começar agora <ArrowUpRight /></a>
          </nav>
        </header>

        <main id="inicio">
          <section className="cc-hero" aria-labelledby="cc-title">
            <div className="cc-hero-copy">
              <p className="cc-eyebrow">Verificação de contactos</p>
              <h1 id="cc-title">Saiba quem está no <span>WhatsApp.</span></h1>
              <p className="cc-hero-description">
                Consulte um número ou organize uma lista inteira. Obtenha clareza sobre os seus contactos — sem enviar mensagens.
              </p>
              <div className="cc-hero-proof">
                <span className="cc-proof-item"><ShieldCheck /> Sem mensagens enviadas</span>
                <span className="cc-proof-item"><Fingerprint /> Consulta individual ou em lote</span>
              </div>
            </div>

            <div className="cc-hero-art" aria-label="Exemplo ilustrativo de um relatório de contactos">
              <div className="cc-orbit"><span className="cc-orbit-dot" /></div>
              <div className="cc-preview-card">
                <div className="cc-preview-top">
                  <div className="cc-preview-heading">
                    <span className="cc-preview-icon"><FileSpreadsheet /></span>
                    <div><strong>Resumo da lista</strong><span>Pré-visualização demonstrativa</span></div>
                  </div>
                  <span className="cc-preview-label">Lista</span>
                </div>
                <div className="cc-preview-rule" />
                {[1, 2, 3].map((item) => (
                  <div className="cc-preview-row" key={item}>
                    <span className="cc-mini-avatar">{String(item).padStart(2, "0")}</span>
                    <span className="cc-mini-lines"><span className="cc-mini-line" /><span className="cc-mini-line short" /></span>
                    <span className="cc-mini-status">Exemplo</span>
                  </div>
                ))}
                <div className="cc-preview-bottom"><span>Sem mensagens aos contactos</span><strong>Ver detalhes <ArrowRight size={11} /></strong></div>
              </div>
              <div className="cc-floating-note"><LockKeyhole /> A consulta não inicia conversas</div>
            </div>
          </section>

          <section className="cc-workspace" id="verificador" aria-labelledby="cc-tool-title">
            <aside className="cc-work-aside">
              <p className="cc-aside-kicker">FEITO PARA SER CLARO</p>
              <h2 className="cc-aside-title">Uma tarefa simples.<br />Sem surpresas.</h2>
              <p className="cc-aside-copy">Escolha como preparar os números. A consulta real é feita pelo fornecedor conectado.</p>
              <div className="cc-aside-divider" />
              <div className="cc-capacity">
                <span className="cc-capacity-label">Máximo por consulta</span>
                <span className="cc-capacity-value">1.500 únicos</span>
              </div>
              <div className="cc-aside-foot"><BadgeCheck /> Duplicados são considerados uma única vez na consulta.</div>
            </aside>

            <div className="cc-work-main">
              <div className="cc-card-heading">
                <div>
                  <h2 id="cc-tool-title">Prepare a sua consulta</h2>
                  <p>Comece com um número ou adicione uma lista.</p>
                </div>
                <span className="cc-demo-badge">Modo de demonstração</span>
              </div>
              <div className="cc-mode-tabs" role="tablist" aria-label="Modo de consulta">
                <button className={`cc-mode-tab ${mode === "single" ? "active" : ""}`} type="button" role="tab" aria-selected={mode === "single"} onClick={() => setMode("single")}>
                  <Search /> Um número
                </button>
                <button className={`cc-mode-tab ${mode === "batch" ? "active" : ""}`} type="button" role="tab" aria-selected={mode === "batch"} onClick={() => setMode("batch")}>
                  <FileText /> Lista em lote
                </button>
              </div>

              {mode === "single" ? (
                <section className="cc-panel" role="tabpanel" aria-label="Consulta de um número">
                  <form onSubmit={submitSingle}>
                    <label className="cc-label" htmlFor="cc-phone">Número de telefone</label>
                    <div className="cc-fieldrow">
                      <input
                        className="cc-input"
                        id="cc-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+258 84 123 4567"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                      <button className="cc-primary-button" type="submit">Pré-visualizar <ArrowRight /></button>
                    </div>
                    <p className="cc-hint">Exemplo de Moçambique: +258 84 123 4567.</p>
                    <div className="cc-country-row">
                      <div className="cc-country-control">
                        <label className="cc-label" htmlFor="cc-single-country">País para números sem indicativo</label>
                        <div className="cc-fieldrow">
                          <CountrySelect value={singleCountry} onChange={setSingleCountry} labelId="cc-single-country" />
                          {singleCountry === "custom" && <input className="cc-input cc-custom-dial" aria-label="Indicativo personalizado" placeholder="+ código" value={customSingle} onChange={(event) => setCustomSingle(event.target.value)} />}
                        </div>
                      </div>
                      <span className="cc-local-note"><Check /> Pode alterar o indicativo a qualquer momento</span>
                    </div>
                    <div className="cc-inline-notice"><LockKeyhole /> Os números são enviados ao serviço conectado para lookup. Esta demonstração não envia números nem mensagens.</div>
                  </form>
                </section>
              ) : (
                <section className="cc-panel" role="tabpanel" aria-label="Preparação de uma lista">
                  <label className="cc-label" htmlFor="cc-file">Importar uma lista</label>
                  <div
                    className="cc-dropzone"
                    onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("dragging"); }}
                    onDragLeave={(event) => event.currentTarget.classList.remove("dragging")}
                    onDrop={onDrop}
                  >
                    <input ref={fileInput} id="cc-file" type="file" accept=".csv,.txt,.xlsx,.xls" hidden onChange={onFileChange} />
                    <span className="cc-upload-icon"><Upload /></span>
                    <span className="cc-drop-copy"><strong>Arraste um ficheiro para aqui</strong><span>CSV, TXT ou Excel (.xlsx/.xls), até 5 MB</span></span>
                    <button type="button" className="cc-quiet-button" onClick={() => fileInput.current?.click()}>Escolher ficheiro</button>
                  </div>
                  {filePreview && (
                    <div className="cc-file-pill">
                      <span className="cc-filetype">{filePreview.extension.toUpperCase()}</span>
                      <span className="cc-filename">{filePreview.name}</span>
                      <span className="cc-filecount">{filePreview.count === null ? "leitura local demonstrativa" : `${filePreview.count} linhas`}</span>
                      <button className="cc-remove" type="button" aria-label="Remover ficheiro selecionado" onClick={() => { setFilePreview(null); setShowResults(false); if (fileInput.current) fileInput.current.value = ""; }}><X /></button>
                    </div>
                  )}
                  <div className="cc-or"><span>ou cole números, um por linha</span></div>
                  <label className="sr-only" htmlFor="cc-paste">Cole números de telefone, um por linha</label>
                  <textarea id="cc-paste" className="cc-textarea" rows={3} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={"+258 84 123 4567\n+258 87 123 4567\n841234568"} />
                  <div className="cc-paste-foot">
                    <span className="cc-hint">Aceita números com ou sem separadores.</span>
                    <button type="button" className="cc-text-button" onClick={loadPasted}>Preparar lista colada</button>
                  </div>
                  <div className="cc-batch-settings">
                    <div>
                      <label className="cc-label" htmlFor="cc-batch-country">País dos números sem indicativo</label>
                      <div className="cc-fieldrow">
                        <CountrySelect value={batchCountry} onChange={setBatchCountry} labelId="cc-batch-country" />
                        {batchCountry === "custom" && <input className="cc-input cc-custom-dial" aria-label="Indicativo personalizado para a lista" placeholder="+ código" value={customBatch} onChange={(event) => setCustomBatch(event.target.value)} />}
                      </div>
                    </div>
                    <div>
                      <label className="cc-label" htmlFor="cc-column">Coluna dos números</label>
                      <select className="cc-select" id="cc-column" defaultValue="auto">
                        <option value="auto">Detetar automaticamente</option>
                        <option value="first">Primeira coluna</option>
                        <option value="second">Segunda coluna</option>
                      </select>
                    </div>
                    <label className="cc-checkline"><input type="checkbox" checked={headerRow} onChange={(event) => setHeaderRow(event.target.checked)} /> A primeira linha tem títulos de coluna</label>
                  </div>
                  <div className="cc-batch-run">
                    <button className="cc-primary-button" type="button" onClick={() => {
                      if (!filePreview) {
                        notify("Adicione um ficheiro ou cole uma lista para preparar a demonstração.");
                        return;
                      }
                      previewAction("batch");
                    }}>Pré-visualizar resultados <ArrowRight /></button>
                    <p className="cc-hint">Até 1.500 números únicos por consulta, numa única chamada ao serviço.</p>
                  </div>
                </section>
              )}
              <div className="cc-bottom-strip"><ShieldCheck /> O serviço conectado recebe os números para lookup. O ContactoCheck não envia mensagens aos contactos.</div>
            </div>
          </section>

          {showResults && (
            <section className="cc-result-preview" id="cc-results" aria-labelledby="cc-results-title">
              <div className="cc-results-top">
                <div>
                  <h2 className="cc-results-title" id="cc-results-title">Relatório de demonstração</h2>
                  <p className="cc-results-copy">Estrutura de resultados e opções de exportação — sem consultar números reais.</p>
                </div>
                <div className="cc-result-actions">
                  <button type="button" onClick={() => exportPreview("Baixar só os contactos com WhatsApp")}><Download /> Baixar só com WhatsApp</button>
                  <button type="button" onClick={() => exportPreview("Exportar sem WhatsApp")}><Download /> Sem WhatsApp</button>
                  <button type="button" onClick={() => exportPreview("Exportar tudo")}><Download /> Exportar tudo</button>
                </div>
              </div>
              <div className="cc-results-disclaimer"><LockKeyhole /> Os estados abaixo são exemplos de interface e não correspondem a qualquer contacto ou consulta feita.</div>
              <div className="cc-results-grid">
                <div className="cc-result-stat"><span className="cc-stat-label"><i className="cc-stat-dot" /> Tem WhatsApp</span><strong className="cc-stat-value">—</strong></div>
                <div className="cc-result-stat"><span className="cc-stat-label"><i className="cc-stat-dot red" /> Não tem WhatsApp</span><strong className="cc-stat-value">—</strong></div>
                <div className="cc-result-stat"><span className="cc-stat-label"><i className="cc-stat-dot gold" /> Formato inválido</span><strong className="cc-stat-value">—</strong></div>
                <div className="cc-result-stat"><span className="cc-stat-label"><i className="cc-stat-dot gray" /> Não confirmado</span><strong className="cc-stat-value">—</strong></div>
              </div>
              <div className="cc-table-card">
                <div className="cc-table-head"><strong>Exemplo de segmentação</strong><span>Pré-visualização de 3 linhas</span></div>
                <div className="cc-table-wrap">
                  <table className="cc-table">
                    <thead><tr><th>Número de exemplo</th><th>Estado demonstrativo</th><th>Indicativo</th></tr></thead>
                    <tbody>
                      {demoRows.map((row) => (
                        <tr key={row.number}>
                          <td>{row.number}</td>
                          <td><span className={`cc-status-pill ${row.type === "good" ? "" : row.type}`}>{row.status}</span></td>
                          <td>{row.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cc-table-foot">Exemplos fictícios para apresentar filtros, estados e exportação.</div>
              </div>
            </section>
          )}

          <section className="cc-how" id="como-funciona" aria-labelledby="cc-how-title">
            <div className="cc-how-copy">
              <p className="cc-eyebrow">Simples de preparar</p>
              <h2 id="cc-how-title">Clareza antes de começar.</h2>
              <p>O ContactoCheck organiza a entrada e a leitura dos resultados. Para uma consulta real, os números são encaminhados ao fornecedor conectado, de acordo com a respetiva política de privacidade.</p>
            </div>
            <div className="cc-steps">
              <article className="cc-step"><span className="cc-step-num">01 / ENTRADA</span><strong>Escolha um modo</strong><p>Introduza um número ou prepare a sua lista.</p></article>
              <article className="cc-step"><span className="cc-step-num">02 / REVISÃO</span><strong>Defina o país</strong><p>Escolha o indicativo para números nacionais.</p></article>
              <article className="cc-step"><span className="cc-step-num">03 / RESULTADOS</span><strong>Separe e exporte</strong><p>Organize os estados em grupos úteis.</p></article>
            </div>
          </section>

          <aside className="cc-privacy">
            <span className="cc-privacy-icon"><LockKeyhole /></span>
            <div>
              <strong>Uma nota importante sobre os seus dados</strong>
              <p>Não são enviadas mensagens. Numa utilização real, os números introduzidos são enviados ao serviço conectado para lookup; consulte a política do fornecedor antes de processar dados pessoais.</p>
            </div>
            <span className="cc-privacy-mark">SEM ENVIO DE MENSAGENS</span>
          </aside>
        </main>
        <footer className="cc-footer">
          <span className="cc-footer-brand">contacto<span>check</span></span>
        </footer>
      </div>
      {toast && <div className="cc-toast" role="status"><LockKeyhole />{toast}</div>}
    </div>
  );
}