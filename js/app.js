import {
  CARGOS, STATUS, STATUS_VENDA, GRUPOS_FUNIL, FORMAS, statusInfo, slug, isVenda, dataRef, titular, comissoes,
  pendencias, periodo, noPeriodo, iso, addDays, toDate, parcelasDaVenda, gerarParcelas, round2, PRAZO_REPASSE_DIAS,
  participantesDaVenda, taxaDaVenda, cargoLabel, SERIES, IMPOSTO_PADRAO, pagamentosDaVenda
} from './calc.js?v=9';
import { store, init, login, logout, save, saveMany, remove, createUser, updateUser, changePassword, resetDemo, resetSenha, limparColecoes, liberarUsuario } from './store.js?v=9';
import { EMPRESA } from './firebase-config.js';

// ============================ HELPERS ============================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlc = (n) => { n = Number(n) || 0; if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi'; if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'; return brl(n); };
const pctf = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const num = (n) => (Number(n) || 0).toLocaleString('pt-BR');
const fd = (s) => s ? s.split('-').reverse().join('/') : '';
const hoje = () => iso(new Date());
const up = (s) => String(s || '').trim().toUpperCase();
const parseNum = (s) => { if (s === '' || s == null) return null; if (typeof s === 'number') return s; const t = String(s).replace(/[R$\s]/g, ''); const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t); return isNaN(n) ? null : n; };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PAPEIS = { admin: 'Administrador do sistema', master: 'Master', diretor: 'Diretor', gerente: 'Gerente', corretor: 'Corretor' };
const TIPOS_AG = ['Visita ao decorado', 'Visita ao imóvel', 'Atendimento / reunião', 'Assinatura', 'Plantão', 'Ligação / retorno'];
const STATUS_AG = ['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'NÃO COMPARECEU', 'CANCELADO'];

// Download que funciona no navegador normal e também dentro do visualizador do Claude
let _dl;
async function salvarArquivo(nome, blob) {
  try {
    if (window.claude?.use) { _dl = _dl ?? await window.claude.use('downloads'); if (_dl) { await _dl.save({ filename: nome, data: blob }); toast('Arquivo salvo: ' + nome); return true; } }
  } catch (e) { if (e?.code === 'declined') return false; console.warn(e); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return true;
}
// Confirmação dentro da página (não usa o confirm() do navegador)
function confirmar(msg, ok = 'Confirmar') {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'confirm-wrap';
    w.innerHTML = `<div class="confirm-box"><p>${esc(msg).replace(/\n/g, '<br>')}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-n>Cancelar</button><button class="btn gold" data-y>${esc(ok)}</button></div></div>`;
    document.body.appendChild(w);
    const fim = (v) => { w.remove(); res(v); };
    w.querySelector('[data-n]').onclick = () => fim(false); w.querySelector('[data-y]').onclick = () => fim(true);
    w.querySelector('[data-y]').focus();
  });
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
window.addEventListener('unhandledrejection', (e) => { const m = String(e.reason?.code || e.reason?.message || e.reason || ''); console.error(e.reason); toast(/permission/i.test(m) ? 'Sem permissão para salvar isso' : 'Erro ao salvar: ' + m.slice(0, 120)); });
const store_get = (k, d) => { try { return JSON.parse(localStorage.getItem('praes_ui_' + k)) ?? d; } catch (e) { return d; } };
const store_set = (k, v) => { try { localStorage.setItem('praes_ui_' + k, JSON.stringify(v)); } catch (e) { } };

const D = () => store.data;
const pessoaPorNome = (n) => D().pessoas.find(p => up(p.nome) === up(n));
const canon = (n) => { const u = up(n); if (!u) return ''; const p = D().pessoas.find(x => up(x.nome) === u || (x.aliases || []).map(up).includes(u)); return p ? p.nome : u; };
const IGNORAR = ['TESTE', 'PROVIS.', '?'];
const userDaPessoa = (n) => n && D().users.find(u => up(u.pessoa) === up(n));
const COLORS = ['#8b5cf6', '#0ea5e9', '#f97316', '#10b981', '#ec4899', '#6366f1', '#84cc16', '#14b8a6', '#e11d48', '#a16207'];
function avatar(ref, size = 'md') {
  let foto = '', nome = '';
  if (ref && typeof ref === 'object') { foto = ref.foto; nome = ref.nome || ref.usuario; }
  else { nome = ref || '?'; foto = userDaPessoa(ref)?.foto; }
  const ini = String(nome).trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';
  const cor = COLORS[[...String(nome)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return foto ? `<span class="avatar ${size}"><img src="${esc(foto)}" alt=""></span>` : `<span class="avatar ${size}" style="background:${cor}">${esc(ini)}</span>`;
}
const pill = (s) => { const i = statusInfo(s); return `<span class="pill" style="background:${i.cor}">${esc(s || '—')}</span>`; };

// ---------- escopo de acesso ----------
const myP = () => up(store.me?.pessoa);
const empOk = (v) => { const l = store.empsLiberados(); return !l || l.has(v.empSlug || slug(v.empreendimento)); };
function escopo(arr) { const base = arr.filter(empOk); if (store.isAdmin()) return base; const p = slug(myP()); return p ? base.filter(v => (v.acesso || []).includes(p)) : []; }
const vendasVis = () => escopo(D().vendas);
const agVis = () => escopo(D().agendamentos);
function escopoPessoas() { // null = todos
  if (store.isAdmin()) return null;
  const me = myP(); const s = new Set([me]);
  D().pessoas.forEach(p => { if (up(p.gerente) === me || up(p.diretor) === me) s.add(up(p.nome)); });
  return s;
}
function pessoasVisiveis() { // null = todas
  if (!store.empsLiberados() && store.isAdmin()) return null;
  const s = new Set(escopoPessoas() || []);
  [...vendasVis(), ...agVis()].forEach(v => [v.corretor, v.gerente, v.diretor, ...Object.values(v.corpo || {})].forEach(n => n && s.add(up(n))));
  return s;
}
function regrasVisiveis() {
  if (!store.empsLiberados()) return D().regras;
  const ids = new Set(vendasVis().map(v => v.regra).filter(Boolean));
  D().empreendimentos.filter(e => empOk({ empreendimento: e.nome })).forEach(e => e.regraPadrao && ids.add(e.regraPadrao));
  return D().regras.filter(r => ids.has(r.id));
}
const podeEditar = () => ['admin', 'master', 'diretor', 'gerente', 'corretor'].includes(store.me?.papel);

// ---------- modal ----------
function openModal(html, cls = '') {
  const m = $('#modal'), b = $('#modalBox'); b.className = 'modal-box ' + cls; b.innerHTML = html; m.classList.remove('hidden');
  $$('[data-close]', b).forEach(x => x.onclick = closeModal);
  return b;
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function datalists() {
  const ps = [...new Set(D().pessoas.filter(p => p.ativo !== false).map(p => p.nome))].sort();
  const es = [...new Set([...D().empreendimentos.map(e => e.nome), ...D().vendas.map(v => v.empreendimento)].filter(Boolean))].filter(n => empOk({ empreendimento: n })).sort();
  const inc = [...new Set([...D().empreendimentos.map(e => e.incorporadora), ...D().vendas.map(v => v.incorporadora)].filter(Boolean))].sort();
  const as = [...new Set(D().vendas.map(v => v.assessoria).filter(Boolean))].sort();
  const o = (a) => a.map(x => `<option value="${esc(x)}">`).join('');
  return `<datalist id="dl-p">${o(ps)}</datalist><datalist id="dl-e">${o(es)}</datalist><datalist id="dl-i">${o(inc)}</datalist><datalist id="dl-a">${o(as)}</datalist>`;
}

async function fotoDeArquivo(file, size = 256) {
  const img = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
  const c = document.createElement('canvas'); c.width = c.height = size;
  const s = Math.min(img.width, img.height);
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

function exportXlsx(rows, nome) {
  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados'); salvarArquivo(nome + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// ---------- PDF ----------
// cols: [chave, rótulo, tipo('brl'|'n'|'pct'|'txt'), alinhamento opcional]
function gerarPDF({ titulo, sub = '', cols, rows, resumo = [], nome, totais = null, orient = 'landscape' }) {
  if (!window.jspdf) return toast('Biblioteca de PDF não carregou. Verifique a internet.');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: orient, unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const fmt = (t, x) => x === '' || x == null ? '' : t === 'brl' ? brl(x) : t === 'n' ? num(x) : t === 'pct' ? pctf(x) : String(x);
  const header = () => {
    doc.setFillColor(22, 22, 22); doc.rect(0, 0, W, 54, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255); doc.text('PRAES', 32, 33);
    doc.setTextColor(201, 162, 74); doc.text('Imóveis', 32 + doc.getTextWidth('PRAES '), 33);
    doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.text(titulo, W - 32, 26, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(200, 194, 176);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${store.me?.nome || ''}`, W - 32, 41, { align: 'right' });
  };
  header();
  let y = 74;
  if (sub) { doc.setFontSize(10); doc.setTextColor(90, 90, 95); doc.text(sub, 32, y); y += 14; }
  if (resumo.length) {
    const bw = Math.min(170, (W - 64 - (resumo.length - 1) * 8) / resumo.length);
    resumo.forEach(([l, v], i) => {
      const x = 32 + i * (bw + 8);
      doc.setFillColor(i === 0 ? 28 : 250, i === 0 ? 28 : 249, i === 0 ? 30 : 246); doc.setDrawColor(230, 227, 220); doc.roundedRect(x, y, bw, 42, 4, 4, i === 0 ? 'F' : 'FD');
      doc.setFontSize(7); doc.setTextColor(i === 0 ? 200 : 110, i === 0 ? 194 : 110, i === 0 ? 176 : 115); doc.text(String(l).toUpperCase(), x + 8, y + 13);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(i === 0 ? 224 : 28, i === 0 ? 191 : 28, i === 0 ? 114 : 30); doc.text(String(v), x + 8, y + 32); doc.setFont('helvetica', 'normal');
    });
    y += 56;
  }
  const right = (t) => ['brl', 'n', 'pct'].includes(t);
  const tabelas = arguments[0].tabelas || [{ cols, rows, totais }];
  tabelas.forEach((tb, ti) => {
  const cols = tb.cols, rows = tb.rows, totais = tb.totais || tb.totaisLinha;
  if (tb.titulo) { if (ti > 0) y = doc.lastAutoTable.finalY + 26; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(28, 28, 30); doc.text(tb.titulo, 32, y); doc.setFont('helvetica', 'normal'); y += 8; }
  doc.autoTable({
    startY: y, margin: { left: 32, right: 32, top: 70 },
    head: [cols.map(c => c[1])],
    body: rows.map(r => cols.map(([k, , t]) => fmt(t, r[k]))),
    foot: totais ? [cols.map(([k, , t], i) => i === 0 ? 'TOTAL' : (totais[k] != null ? fmt(t, totais[k]) : ''))] : undefined,
    showFoot: 'lastPage',
    styles: { fontSize: cols.length > 10 ? 6.8 : 8, cellPadding: 4, lineColor: [235, 232, 225], lineWidth: .4, textColor: [30, 30, 32] },
    headStyles: { fillColor: [28, 28, 30], textColor: [224, 191, 114], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 243, 239], textColor: [20, 20, 20], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 250, 247] },
    columnStyles: Object.fromEntries(cols.map(([, , t], i) => [i, { halign: right(t) ? 'right' : 'left' }])),
    didDrawPage: () => { header(); const n = doc.internal.getNumberOfPages(); doc.setFontSize(8); doc.setTextColor(140); doc.text(`Página ${n}`, W - 32, doc.internal.pageSize.getHeight() - 16, { align: 'right' }); doc.text('PRAES Imóveis · Controle Comercial', 32, doc.internal.pageSize.getHeight() - 16); },
  });
  });
  return salvarArquivo((nome || titulo).replace(/[^\w\-]+/g, '_') + '.pdf', doc.output('blob'));
}
const somar = (rows, ks) => Object.fromEntries(ks.map(k => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)]));

// ---------- componente período ----------
const PER_OPTS = [['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['mesant', 'Mês anterior'], ['tri', 'Este trimestre'], ['ano', 'Este ano'], ['tudo', 'Tudo'], ['custom', 'Personalizado']];
function perHTML(F) {
  return `<label>Período<select class="in" data-per="tipo">${PER_OPTS.map(([k, l]) => `<option value="${k}" ${F.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="${F.tipo === 'custom' ? '' : 'hidden'}" data-perc>De<input type="date" class="in" data-per="ini" value="${F.ini || ''}"></label>
  <label class="${F.tipo === 'custom' ? '' : 'hidden'}" data-perc>Até<input type="date" class="in" data-per="fim" value="${F.fim || ''}"></label>`;
}
function bindPer(el, F, cb) {
  $$('[data-per]', el).forEach(i => i.onchange = () => {
    F[i.dataset.per] = i.value;
    $$('[data-perc]', el).forEach(x => x.classList.toggle('hidden', F.tipo !== 'custom'));
    cb();
  });
}
const perRange = (F) => periodo(F.tipo, F.ini, F.fim);
const perLabel = (F) => { const [a, b] = perRange(F); return F.tipo === 'tudo' ? 'todo o histórico' : `${fd(a)} a ${fd(b)}`; };

// ---------- charts ----------
let charts = [];
function chart(canvas, cfg) { const c = new Chart(canvas, cfg); charts.push(c); return c; }
function killCharts() { charts.forEach(c => c.destroy()); charts = []; }
if (window.Chart) { Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.plugins.legend.labels.boxWidth = 12; }
// ---------- tema claro / escuro ----------
const corEscura = () => temaAtual() === 'dark' ? '#e4e4e7' : '#1c1c1e';
const corGrid = () => temaAtual() === 'dark' ? 'rgba(255,255,255,.07)' : '#f0ede6';
const temaAtual = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('praes_tema', t); } catch (e) { }
  if (window.Chart) { Chart.defaults.color = t === 'dark' ? '#a1a1aa' : '#6b6b70'; Chart.defaults.borderColor = t === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'; }
  const bt = $('#temaBtn'); if (bt) { bt.textContent = t === 'dark' ? '☀' : '☾'; bt.title = t === 'dark' ? 'Modo claro' : 'Modo escuro'; }
  const mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.content = t === 'dark' ? '#111113' : '#161616';
}
aplicarTema(temaAtual());
$('#temaBtn') && ($('#temaBtn').onclick = () => { aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark'); if (store.me) render(); });

// ---------- tabelas viram cartões no celular ----------
function cardify(root) {
  $$('.tbl-wrap > table', root).forEach(t => {
    if (t.classList.contains('nocards')) return;
    t.classList.add('cards');
    const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.replace(/[▲▼↑↓⇅]/g, '').trim());
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => { let i = 0; [...tr.children].forEach(td => { if (!td.hasAttribute('data-label') && !td.hasAttribute('colspan')) td.setAttribute('data-label', hs[i] || ''); i += Number(td.getAttribute('colspan')) || 1; }); });
  });
}
let cfRaf = 0; new MutationObserver(() => { cancelAnimationFrame(cfRaf); cfRaf = requestAnimationFrame(() => cardify($('#view'))); }).observe($('#view'), { childList: true, subtree: true });

// ============================ ROTAS ============================
const ROUTES = [
  { id: 'painel', label: 'Painel', ic: '◧', view: vPainel },
  { id: 'vendas', label: 'Vendas', ic: '▤', view: vVendas },
  { id: 'funil', label: 'Funil / Pipeline', ic: '⫶', view: vFunil },
  { id: 'agenda', label: 'Agendamentos', ic: '◷', view: vAgenda },
  { id: 'espelho', label: 'Espelho de vendas', ic: '▦', view: vEspelho, admin: true },
  { id: 'comissoes', label: 'Comissões', ic: '％', view: vComissoes },
  { id: 'receb', label: 'Recebimentos', ic: '⇣', view: vReceb, admin: true },
  { id: 'pagamentos', label: 'Pagamentos', ic: '⇡', view: vPagamentos, master: true },
  { sep: 'Cadastros' },
  { id: 'equipe', label: 'Corretores / Equipe', ic: '☺', view: vEquipe },
  { id: 'emps', label: 'Empreendimentos', ic: '⌂', view: vEmps },
  { id: 'taxas', label: 'Quadro de Taxas', ic: '≡', view: vTaxas },
  { sep: 'Administração', master: true },
  { id: 'liberacoes', label: 'Liberações', ic: '✓', view: vLiberacoes, dono: true },
  { id: 'usuarios', label: 'Usuários', ic: '⚿', view: vUsuarios, master: true },
  { id: 'importar', label: 'Dados (importar / zerar)', ic: '⇅', view: vImportar, master: true },
  { sep: 'Conta' },
  { id: 'perfil', label: 'Meu perfil', ic: '◉', view: vPerfil },
];
let route = 'painel', refresh = null;
const allowed = (r) => !(r.master && !store.isMaster()) && !(r.admin && !store.isAdmin()) && !(r.dono && !store.isDono());

function renderShell() {
  const me = store.me;
  $('#sideAvatar').outerHTML = `<div id="sideAvatar">${avatar(me, 'xl')}</div>`;
  $('#sideName').textContent = me.nome || me.email;
  $('#sideRole').textContent = PAPEIS[me.papel] || me.papel;
  $('#nav').innerHTML = ROUTES.filter(allowed).map(r => r.sep ? `<div class="sep">${r.sep}</div>` : `<a data-r="${r.id}" class="${route === r.id ? 'on' : ''}"><span class="ic">${r.ic}</span>${r.label}${(r.id === 'liberacoes' || (r.id === 'usuarios' && !store.isDono())) && D().users.some(u => u.pendente) ? `<span class="nbadge">${D().users.filter(u => u.pendente).length}</span>` : ''}</a>`).join('');
  $$('#nav a').forEach(a => a.onclick = () => go(a.dataset.r));
  const bn = [['painel', '◧', 'Painel'], ['vendas', '▤', 'Vendas'], ['agenda', '◷', 'Agenda'], ['funil', '⫶', 'Funil']];
  $('#bnav').innerHTML = bn.map(([id, ic, l]) => `<a data-b="${id}" class="${route === id ? 'on' : ''}"><span class="i">${ic}</span>${l}</a>`).join('') + `<a data-b="menu" class="${bn.some(x => x[0] === route) ? '' : 'on'}"><span class="i">☰</span>Mais</a>`;
  $$('#bnav a').forEach(a => a.onclick = () => a.dataset.b === 'menu' ? $('#side').classList.toggle('open') : go(a.dataset.b));
  $('#demoTag').classList.toggle('hidden', !store.demo);
}
// ---------- avisos do administrador (cobrança) ----------
const PIX_PADRAO = '62019887000117 - Banco Inter';
const avisoCfg = () => { const c = store.config(); return { usuario: !!c.avisoUsuario, bloqueio: !!c.avisoBloqueio, pix: c.pix || PIX_PADRAO, valor: c.valorUsuario || '50,00' }; };
const pixChave = () => (avisoCfg().pix.match(/[\d.\-\/]{11,}/) || [avisoCfg().pix])[0].replace(/\D/g, '') || avisoCfg().pix;
function copiarPix() { const k = pixChave(); (navigator.clipboard?.writeText(k) || Promise.reject()).then(() => toast('Chave PIX copiada'), () => toast('PIX: ' + k)); }
function htmlAvisoUsuario() {
  const a = avisoCfg(); if (!a.usuario) return '';
  return `<div class="aviso-cob"><b>Atenção:</b> cada novo usuário cadastrado tem custo de <b>R$ ${esc(a.valor)}</b>, pago via PIX ao administrador do sistema.<br>PIX: <b>${esc(a.pix)}</b> <button class="btn sm" type="button" data-pix>Copiar chave</button></div>`;
}
let avisoVisto = false;
function checarAviso() {
  const ov = $('#avisoOv'); const a = avisoCfg();
  const deve = store.me && store.me.papel === 'master' && a.bloqueio;
  if (!deve) { ov && ov.remove(); return; }
  if (avisoVisto || ov) return;
  avisoVisto = true;
  const d = document.createElement('div'); d.id = 'avisoOv'; d.className = 'aviso-ov';
  d.innerHTML = `<div class="aviso-box" role="alertdialog" aria-modal="true"><div class="aviso-ic">!</div><h2>Aviso de bloqueio</h2>
    <p>O sistema será <b>bloqueado por falta de pagamento</b>.</p><p>Para evitar o bloqueio, regularize o pagamento via PIX:</p>
    <div class="aviso-pix">${esc(a.pix)}</div><div class="row" style="justify-content:center;gap:10px"><button class="btn" type="button" data-pix>Copiar chave PIX</button><button class="btn gold" type="button" id="avisoFechar">Fechar</button></div>
    <p class="muted small mt">Se o pagamento já foi feito, avise o administrador do sistema.</p></div>`;
  document.body.appendChild(d);
  $('[data-pix]', d).onclick = copiarPix; $('#avisoFechar', d).onclick = () => d.remove();
}
document.addEventListener('click', e => { if (e.target.closest('[data-pix]') && !e.target.closest('#avisoOv')) copiarPix(); });
function go(r) { route = r; location.hash = r; $('#side').classList.remove('open'); render(); }
function render() {
  const r = ROUTES.find(x => x.id === route && allowed(x)) || ROUTES[0];
  route = r.id; renderShell();
  $('#pageTitle').textContent = r.label; $('#topActions').innerHTML = '';
  killCharts();
  const el = $('#view'); el.innerHTML = '';
  refresh = r.view(el) || null;
  window.scrollTo(0, 0);
  $('#avisoOv')?.remove(); avisoVisto = false; checarAviso();
}
let rt; store.onData(() => { clearTimeout(rt); rt = setTimeout(() => { if (!store.me) return; renderShell(); if (refresh) { killCharts(); refresh(); } checarAviso(); }, 60); });

// ============================ PAINEL ============================
function vPainel(el) {
  const F = store_get('fPainel', { tipo: 'mes' });
  el.innerHTML = `<div class="filters">${perHTML(F)}<span class="space"></span><span class="muted small" id="perLbl"></span></div><div id="res"></div>`;
  bindPer(el, F, () => { store_set('fPainel', F); upd(); });
  el.addEventListener('click', e => { const it = e.target.closest('[data-av]'); if (it) { const v = D().vendas.find(x => x.id === it.dataset.av); v && abrirVenda(v); } });
  function upd() {
    killCharts();
    $('#perLbl', el).textContent = 'Período: ' + perLabel(F);
    const R = perRange(F), vs = vendasVis(), regras = D().regras;
    const vend = vs.filter(v => isVenda(v) && noPeriodo(dataRef(v), R));
    let vgv = 0, com = 0, rec = 0, praes = 0;
    vend.forEach(v => { vgv += +v.vgv; const c = comissoes(v, regras); com += c.total; rec += c.receita; praes += c.linhas.filter(l => l.cargo === 'imob').reduce((s, l) => s + l.valor, 0); });
    const pipe = vs.filter(v => ['Aprovado', 'Reserva', 'Assinatura'].includes(statusInfo(v.status).grupo));
    const pipeVgv = pipe.reduce((s, v) => s + (Number(v.vgv) || 0), 0);
    const novos = vs.filter(v => noPeriodo(v.data, R)).length;
    const pend = vs.filter(v => pendencias(v).length).length;
    const semRegra = vend.filter(v => !v.regra).length;
    // ranking
    const rk = {}; vend.forEach(v => { const k = v.corretor || v.gerente || '—'; rk[k] = rk[k] || { n: 0, vgv: 0 }; rk[k].n++; rk[k].vgv += +v.vgv; });
    const rank = Object.entries(rk).sort((a, b) => b[1].vgv - a[1].vgv).slice(0, 8);
    const maxR = rank[0]?.[1].vgv || 1;
    const pe = {}; vend.forEach(v => { pe[v.empreendimento] = (pe[v.empreendimento] || 0) + (+v.vgv); });
    const pEmp = Object.entries(pe).sort((a, b) => b[1] - a[1]);
    // agenda
    const ag = agVis().filter(a => a.data >= hoje() && a.data <= addDays(hoje(), 7) && !['CANCELADO'].includes(a.status)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).slice(0, 6);
    // recebimentos
    let rAberto = 0, rAtras = 0;
    if (store.isAdmin()) vs.forEach(v => parcelasDaVenda(v, regras).forEach(p => { if (!p.recebido) { if (p.vencimento < hoje()) rAtras += p.valor; else if (p.vencimento <= addDays(hoje(), 30)) rAberto += p.valor; } }));

    // alertas de parcelas (só parcelas cadastradas; previsões automáticas ficam de fora)
    const alertas = [];
    if (store.isAdmin()) vs.forEach(v => parcelasDaVenda(v, regras).forEach(p => { if (!p.auto && !p.recebido && p.vencimento && p.vencimento <= addDays(hoje(), 7)) alertas.push({ v, p, atras: p.vencimento < hoje() }); }));
    alertas.sort((a, b) => a.p.vencimento.localeCompare(b.p.vencimento));
    const nAt = alertas.filter(x => x.atras), nPx = alertas.filter(x => !x.atras);
    const itemAl = (x) => `<div class="it" data-av="${x.v.id}"><span><b>${fd(x.p.vencimento)}</b> · ${esc(x.v.empreendimento)} ${esc(x.v.unidade || '')} · ${esc(x.v.cliente || '')} <span class="muted small">(${esc(x.p.serie || '')}${x.p.descricao ? ' – ' + esc(x.p.descricao) : ''})</span></span><span class="v">${brl(x.p.valor)}</span></div>`;
    const htmlAl = alertas.length ? `<div class="card alerta-parc ${nAt.length ? 'bad' : ''}" style="margin-bottom:14px"><h3>⚠ Parcelas para cobrar ${nAt.length ? `<span class="tag bad">${nAt.length} atrasada(s) · ${brl(nAt.reduce((a, x) => a + x.p.valor, 0))}</span>` : ''}${nPx.length ? `<span class="tag warn">${nPx.length} vence(m) em até 7 dias · ${brl(nPx.reduce((a, x) => a + x.p.valor, 0))}</span>` : ''}</h3>
      <div class="lst">${alertas.slice(0, 12).map(itemAl).join('')}</div>${alertas.length > 12 ? `<div class="muted small mt">+ ${alertas.length - 12} parcela(s). Veja todas em Recebimentos.</div>` : ''}</div>` : '';
    $('#res', el).innerHTML = htmlAl + `
    <div class="kpis">
      <div class="kpi hl"><div class="l">VGV vendido</div><div class="v">${brlc(vgv)}</div><div class="s">${num(vend.length)} venda(s)</div></div>
      <div class="kpi"><div class="l">Ticket médio</div><div class="v">${brlc(vend.length ? vgv / vend.length : 0)}</div><div class="s">VGV ÷ vendas</div></div>
      <div class="kpi"><div class="l">Receita (taxa incorporadora)</div><div class="v">${brlc(rec)}</div><div class="s">${semRegra ? `<span class="tag warn">${semRegra} sem regra</span>` : 'todas com regra'}</div></div>
      <div class="kpi"><div class="l">Comissões do corpo de vendas</div><div class="v">${brlc(com)}</div><div class="s">Parte PRAES: ${brlc(praes)}</div></div>
      <div class="kpi"><div class="l">Pipeline (aprov./reserva/assin.)</div><div class="v">${brlc(pipeVgv)}</div><div class="s">${num(pipe.length)} em andamento</div></div>
      <div class="kpi"><div class="l">Novos cadastros</div><div class="v">${num(novos)}</div><div class="s">no período</div></div>
    </div>
    <div class="cols2">
      <div class="card"><h3>Vendas por mês <small>· últimos 12 meses (VGV e quantidade)</small></h3><div class="chart-box"><canvas id="chM"></canvas></div></div>
      <div class="card"><h3>Vendas por semana <small>· últimas 10</small></h3><div class="chart-box"><canvas id="chW"></canvas></div></div>
    </div>
    <div class="cols2 mt">
      <div class="card"><h3>Ranking de corretores <small>· ${perLabel(F)}</small></h3>
        ${rank.length ? rank.map(([n, x], i) => `<div class="list-person">${avatar(n, 'sm')}<div style="flex:1"><div class="row"><b>${i + 1}. ${esc(n)}</b><span class="space"></span><span class="muted small">${x.n} venda(s)</span><b>${brlc(x.vgv)}</b></div><div class="bar"><i style="width:${x.vgv / maxR * 100}%"></i></div></div></div>`).join('') : '<div class="empty">Nenhuma venda no período</div>'}
      </div>
      <div class="grid">
        <div class="card"><h3>Atenção</h3>
          <div class="list-person"><span class="tag warn">${pend}</span> vendas com pendência (data, VGV ou regra) <span class="space"></span><button class="btn sm" id="goPend">Ver</button></div>
          ${store.isAdmin() ? `<div class="list-person"><span class="tag bad">${brlc(rAtras)}</span> a receber em atraso<span class="space"></span><button class="btn sm" data-go="receb">Ver</button></div>
          <div class="list-person"><span class="tag ok">${brlc(rAberto)}</span> a receber em 30 dias</div>` : ''}
        </div>
        <div class="card"><h3>Próximos agendamentos</h3>
          ${ag.length ? ag.map(a => `<div class="list-person">${avatar(a.corretor, 'sm')}<div><b>${fd(a.data)} ${esc(a.hora || '')}</b> · ${esc(a.cliente)}<div class="muted small">${esc(a.tipo)} · ${esc(a.empreendimento)} · ${esc(a.corretor)}</div></div></div>`).join('') : '<div class="muted">Nada nos próximos 7 dias</div>'}
        </div>
      </div>
    </div>
    <div class="card mt"><h3>VGV por empreendimento <small>· ${perLabel(F)}</small></h3>
      ${pEmp.length ? `<div class="tbl-wrap"><table><thead><tr><th>Empreendimento</th><th class="n">VGV</th><th class="n">%</th></tr></thead><tbody>${pEmp.map(([e, x]) => `<tr><td>${esc(e)}</td><td class="n">${brl(x)}</td><td class="n">${pctf(x / vgv * 100, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">—</div>'}
    </div>`;
    $('#goPend', el).onclick = () => { const f = store_get('fVendas', {}); f.sit = 'pend'; store_set('fVendas', f); go('vendas'); };
    $$('[data-go]', el).forEach(b => b.onclick = () => go(b.dataset.go));
    // charts
    const now = new Date(); const ms = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); ms.push([d.getFullYear(), d.getMonth()]); }
    const all = vs.filter(isVenda);
    const mV = ms.map(([y, m]) => all.filter(v => { const d = toDate(dataRef(v)); return d && d.getFullYear() === y && d.getMonth() === m; }));
    chart($('#chM', el), { type: 'bar', data: { labels: ms.map(([y, m]) => MESES[m] + '/' + String(y).slice(2)), datasets: [
      { label: 'VGV', data: mV.map(a => a.reduce((s, v) => s + +v.vgv, 0)), backgroundColor: '#c9a24a', borderRadius: 6, yAxisID: 'y' },
      { label: 'Vendas', data: mV.map(a => a.length), type: 'line', borderColor: corEscura(), backgroundColor: corEscura(), tension: .3, yAxisID: 'y1' }] },
      options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: c => c.dataset.label === 'VGV' ? ' ' + brl(c.raw) : ' ' + c.raw + ' venda(s)' } } },
        scales: { y: { ticks: { callback: v => brlc(v) }, grid: { color: corGrid() } }, y1: { position: 'right', grid: { display: false }, beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } } });
    const ws = []; const seg = new Date(); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    for (let i = 9; i >= 0; i--) { const a = new Date(seg); a.setDate(a.getDate() - 7 * i); const b = new Date(a); b.setDate(a.getDate() + 6); ws.push([iso(a), iso(b)]); }
    const wV = ws.map(R2 => all.filter(v => noPeriodo(dataRef(v), R2)));
    chart($('#chW', el), { type: 'bar', data: { labels: ws.map(([a]) => fd(a).slice(0, 5)), datasets: [{ label: 'Vendas', data: wV.map(a => a.length), backgroundColor: corEscura(), borderRadius: 6 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: c => brl(wV[c.dataIndex].reduce((s, v) => s + +v.vgv, 0)) } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: corGrid() } }, x: { grid: { display: false } } } } });
  }
  upd(); return upd;
}

// ============================ VENDAS ============================
function vVendas(el) {
  const F = Object.assign({ tipo: 'tudo', q: '', st: '', emp: '', dir: '', ger: '', cor: '', sit: '', campo: 'data', sort: 'data', desc: true }, store_get('fVendas', {}));
  const vs0 = vendasVis();
  const opts = (arr, sel) => '<option value="">Todos</option>' + [...new Set(arr.filter(Boolean))].sort().map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('#topActions').innerHTML = `${podeEditar() ? '<button class="btn gold" id="bNova">+ Nova venda</button>' : ''}<button class="btn" id="bExp">Excel</button><button class="btn" id="bPdf">PDF</button>${store.isAdmin() ? '<button class="btn" id="bRegra">Aplicar regra em lote</button>' : ''}`;
  el.innerHTML = `<div class="filters">
    <label>Buscar<input class="in" data-f="q" value="${esc(F.q)}" placeholder="cliente, unidade, cadastro…"></label>
    <label>Situação<select class="in" data-f="sit"><option value="">Todas</option><option value="venda" ${F.sit === 'venda' ? 'selected' : ''}>Só vendas</option><option value="pipe" ${F.sit === 'pipe' ? 'selected' : ''}>Em andamento</option><option value="perd" ${F.sit === 'perd' ? 'selected' : ''}>Perdidas</option><option value="pend" ${F.sit === 'pend' ? 'selected' : ''}>Com pendência</option></select></label>
    <label>Status<select class="in" data-f="st"><option value="">Todos</option>${STATUS.map(s => `<option ${s.nome === F.st ? 'selected' : ''}>${s.nome}</option>`).join('')}</select></label>
    <label>Empreendimento<select class="in" data-f="emp">${opts(vs0.map(v => v.empreendimento), F.emp)}</select></label>
    <label>Diretoria<select class="in" data-f="dir">${opts(vs0.map(v => v.diretor), F.dir)}</select></label>
    <label>Gerente/Equipe<select class="in" data-f="ger">${opts(vs0.map(v => v.gerente), F.ger)}</select></label>
    <label>Corretor<select class="in" data-f="cor">${opts(vs0.map(v => v.corretor), F.cor)}</select></label>
    <label>Data por<select class="in" data-f="campo"><option value="data" ${F.campo === 'data' ? 'selected' : ''}>Cadastro</option><option value="ref" ${F.campo === 'ref' ? 'selected' : ''}>Venda</option></select></label>
    ${perHTML(F)}
    <button class="btn sm" id="bLimpar">Limpar</button>
  </div><div id="res"></div>`;
  const persist = () => store_set('fVendas', F);
  $$('[data-f]', el).forEach(i => i.oninput = () => { F[i.dataset.f] = i.value; persist(); upd(); });
  bindPer(el, F, () => { persist(); upd(); });
  $('#bLimpar', el).onclick = () => { store_set('fVendas', {}); render(); };
  let lista = [];
  function filtrar() {
    const R = perRange(F), q = F.q.trim().toLowerCase();
    return vendasVis().filter(v => {
      if (F.st && v.status !== F.st) return false;
      if (F.emp && v.empreendimento !== F.emp) return false;
      if (F.dir && v.diretor !== F.dir) return false;
      if (F.ger && v.gerente !== F.ger) return false;
      if (F.cor && v.corretor !== F.cor) return false;
      const g = statusInfo(v.status).grupo;
      if (F.sit === 'venda' && !isVenda(v)) return false;
      if (F.sit === 'pipe' && ['Vendido', 'Perdido'].includes(g)) return false;
      if (F.sit === 'perd' && g !== 'Perdido') return false;
      if (F.sit === 'pend' && !pendencias(v).length) return false;
      if (F.tipo !== 'tudo' && !noPeriodo(F.campo === 'ref' ? dataRef(v) : v.data, R)) return false;
      if (q && ![v.cliente, v.unidade, v.cadastro, v.empreendimento, v.corretor, v.gerente, v.obs].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  const COLS = [['data', 'Cadastro'], ['empreendimento', 'Empreend.'], ['unidade', 'Unid.'], ['cadastro', 'Nº CV'], ['cliente', 'Cliente'], ['corretor', 'Corretor'], ['gerente', 'Gerente'], ['diretor', 'Diretoria'], ['vgv', 'VGV', 'n'], ['status', 'Status'], ['dataVenda', 'Data venda'], ['regra', 'Regra'], ['_com', 'Comissão total', 'n'], ['_pend', 'Pendências']];
  function upd() {
    const regras = D().regras;
    lista = filtrar().map(v => ({ v, c: comissoes(v, regras), p: pendencias(v) }));
    const k = F.sort; const dir = F.desc ? -1 : 1;
    lista.sort((a, b) => { const x = k === '_com' ? a.c.total : k === 'vgv' ? (+a.v.vgv || 0) : (a.v[k] || ''); const y = k === '_com' ? b.c.total : k === 'vgv' ? (+b.v.vgv || 0) : (b.v[k] || ''); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    const tv = lista.reduce((s, x) => s + (Number(x.v.vgv) || 0), 0), tc = lista.reduce((s, x) => s + x.c.total, 0);
    const rn = (id) => regras.find(r => r.id === id)?.nome || '';
    $('#res', el).innerHTML = `<div class="row" style="margin-bottom:8px"><b>${num(lista.length)}</b> registro(s) · VGV ${brl(tv)} · comissões ${brl(tc)}</div>
    <div class="tbl-wrap" style="max-height:68vh"><table><thead><tr>${COLS.map(([k2, l, c]) => `<th class="${c || ''}" data-s="${k2}">${l}${F.sort === k2 ? (F.desc ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${lista.slice(0, 1500).map(({ v, c, p }) => `<tr class="click" data-id="${v.id}"><td>${fd(v.data)}</td><td>${esc(v.empreendimento)}</td><td>${esc(v.unidade)}</td><td>${esc(v.cadastro)}</td><td>${esc(v.cliente)}</td>
      <td>${esc(v.corretor)}</td><td>${esc(v.gerente)}</td><td>${esc(v.diretor)}</td><td class="n">${v.vgv ? brl(v.vgv) : '<span class="muted">—</span>'}</td><td>${pill(v.status)}</td><td>${fd(v.dataVenda)}</td><td>${esc(c.regra?.nome || '')}</td>
      <td class="n">${c.total ? brl(c.total) : ''}</td><td>${p.map(x => `<span class="tag warn">${x}</span>`).join('')}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="8">Total</td><td class="n">${brl(tv)}</td><td colspan="3"></td><td class="n">${brl(tc)}</td><td></td></tr></tfoot></table></div>`;
    $$('th[data-s]', el).forEach(th => th.onclick = () => { if (F.sort === th.dataset.s) F.desc = !F.desc; else { F.sort = th.dataset.s; F.desc = false; } persist(); upd(); });
    $$('tr[data-id]', el).forEach(tr => tr.onclick = () => abrirVenda(D().vendas.find(v => v.id === tr.dataset.id)));
  }
  $('#bNova') && ($('#bNova').onclick = () => abrirVenda(null));
  $('#bPdf').onclick = () => {
    const rows = lista.map(({ v, c, p }) => ({ data: fd(v.data), emp: v.empreendimento, un: v.unidade, cli: v.cliente, cor: v.corretor, ger: v.gerente, dir: v.diretor, vgv: Number(v.vgv) || '', st: v.status, dv: fd(v.dataVenda), regra: c.regra?.nome || '', com: c.total || '', pend: p.join(', ') }));
    const t = somar(rows, ['vgv', 'com']);
    gerarPDF({ titulo: 'Relatório de Vendas', nome: 'vendas_' + hoje(), sub: `Filtro: ${F.sit ? { venda: 'só vendas', pipe: 'em andamento', perd: 'perdidas', pend: 'com pendência' }[F.sit] : 'todas'}${F.emp ? ' · ' + F.emp : ''}${F.dir ? ' · Diretoria ' + F.dir : ''}${F.ger ? ' · Equipe ' + F.ger : ''}${F.cor ? ' · Corretor ' + F.cor : ''} · Período: ${perLabel(F)}`,
      resumo: [['VGV', brlc(t.vgv)], ['Registros', num(rows.length)], ['Vendas válidas', num(lista.filter(x => isVenda(x.v)).length)], ['Comissões', brlc(t.com)]],
      cols: [['data', 'Cadastro'], ['emp', 'Empreend.'], ['un', 'Unid.'], ['cli', 'Cliente'], ['cor', 'Corretor'], ['ger', 'Gerente'], ['dir', 'Diretoria'], ['vgv', 'VGV', 'brl'], ['st', 'Status'], ['dv', 'Data venda'], ['regra', 'Regra'], ['com', 'Comissão', 'brl'], ['pend', 'Pendências']],
      rows, totais: t });
  };
  $('#bExp').onclick = () => exportXlsx(lista.map(({ v, c, p }) => ({
    'DATA': fd(v.data), 'EMPREEND.': v.empreendimento, 'UNID.': v.unidade, 'TORRE': v.torre, 'INCORP.': v.incorporadora, 'CADASTRO': v.cadastro, 'CLIENTE': v.cliente,
    'CORRETOR': v.corretor, 'EQUIPE': v.gerente, 'DIRETORIA': v.diretor, 'VGV': Number(v.vgv) || null, 'ASSESSORIA RESP.': v.assessoria, 'STATUS': v.status,
    'DATA STATUS': fd(v.dataStatus), 'DATA VENDA': fd(v.dataVenda), 'FINANCEIRO': v.financeiro, 'OBSERVAÇÃO': v.obs, 'REGRA DE TAXAS': c.regra?.nome || '',
    'RECEITA (TAXA)': round2(c.receita) || null, 'COMISSÃO CORPO': round2(c.total) || null, ...Object.fromEntries(CARGOS.map(cg => [cg.label, round2(c.linhas.find(l => l.cargo === cg.key)?.valor) || null])),
    'PENDÊNCIAS': p.join('; ') })), 'vendas_' + hoje());
  $('#bRegra') && ($('#bRegra').onclick = () => {
    const alvo = lista.filter(x => !x.v.regra).map(x => x.v);
    const b = openModal(`<div class="mh"><h2>Aplicar regra em lote</h2><button class="x" data-close>×</button></div><div class="mb">
      <p>Aplica a regra escolhida às <b>${alvo.length}</b> venda(s) <b>sem regra</b> que estão no filtro atual. Confira o filtro antes (ex.: filtre o empreendimento).</p>
      <select class="in" id="rg" style="width:100%">${D().regras.map(r => `<option value="${r.id}">${esc(r.nome)} — ${esc(r.projeto)} (${pctf(r.taxa)})</option>`).join('')}</select></div>
      <div class="mf"><button class="btn" data-close>Cancelar</button><button class="btn gold" id="ok" ${alvo.length ? '' : 'disabled'}>Aplicar</button></div>`, 'sm');
    $('#ok', b).onclick = async () => { const id = $('#rg', b).value; await saveMany('vendas', alvo.map(v => ({ ...v, regra: id }))); closeModal(); toast(`Regra aplicada em ${alvo.length} venda(s)`); };
  });
  upd(); return upd;
}

// ---------- modal de venda ----------
function abrirVenda(v0, preset = {}) {
  const novo = !v0;
  const v = v0 ? JSON.parse(JSON.stringify(v0)) : { data: hoje(), status: 'NOVA PASTA', dataStatus: hoje(), torre: 'ÚNICA', corpo: {}, parcelas: [], participantes: [], ...preset };
  if (novo && store.me.papel === 'corretor' && !v.corretor) { v.corretor = myP(); const p = pessoaPorNome(v.corretor); v.gerente = p?.gerente || ''; v.diretor = p?.diretor || ''; }
  v.corpo = v.corpo || {}; v.parcelas = (v.parcelas || []).map((p, i) => ({ ...p, id: p.id || 'x' + i })); v.pagamentos = v.pagamentos || {};
  // corpo de vendas editável: se a venda ainda não tem, nasce da regra do quadro de taxas
  if (!v.participantes || !v.participantes.length) { v.participantes = participantesDaVenda(v, D().regras).map(l => ({ id: l.id, cargo: l.cargo, label: l.label, pessoa: l.pessoa, pct: l.pct })); if (v.participantes.length && !v.taxa) v.taxa = taxaDaVenda(v, D().regras); }
  const adm = store.isAdmin(); const ed = podeEditar(); const mst = store.isMaster();
  const inp = (f, l, t = 'text', cls = '', extra = '') => `<label class="${cls}">${l}<input class="in" data-v="${f}" type="${t}" value="${esc(v[f] ?? '')}" ${extra} ${ed ? '' : 'disabled'}></label>`;
  const nid = () => Math.random().toString(36).slice(2, 9);
  const b = openModal(`<div class="mh"><h2>${novo ? 'Nova venda / cadastro' : `${esc(v.empreendimento)} · Unid. ${esc(v.unidade || '—')}`}</h2>${novo ? '' : pill(v.status)}<button class="x" data-close>×</button></div>
  <div class="mb">${datalists()}
    <div class="form">
      <h4 style="border:0;padding:0;margin:0">Dados da venda</h4>
      ${inp('data', 'Data cadastro', 'date')}${inp('cadastro', 'Nº cadastro (CV)')}${inp('cliente', 'Comprador / cliente', 'text', 's2')}
      ${inp('empreendimento', 'Empreendimento', 'text', 's2', 'list="dl-e"')}${inp('unidade', 'Unidade')}${inp('torre', 'Torre / bloco')}
      ${inp('incorporadora', 'Incorporadora', 'text', '', 'list="dl-i"')}${inp('assessoria', 'Assessoria resp.', 'text', '', 'list="dl-a"')}
      <label>Status<select class="in" data-v="status" ${ed ? '' : 'disabled'}>${STATUS.map(s => `<option ${s.nome === v.status ? 'selected' : ''}>${s.nome}</option>`).join('')}</select></label>
      ${inp('dataStatus', 'Data do status', 'date')}
      <label>VGV (R$)<input class="in" data-v="vgv" inputmode="decimal" value="${v.vgv != null ? String(v.vgv).replace('.', ',') : ''}" ${ed ? '' : 'disabled'}></label>
      ${inp('dataVenda', 'Data da venda', 'date')}
      <label>Financeiro<select class="in" data-v="financeiro" ${adm ? '' : 'disabled'}>${['', 'PENDENTE', 'PARCIAL', 'PAGO', 'OK'].map(x => `<option ${x === v.financeiro ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      ${inp('corretor', 'Corretor (hierarquia)', 'text', '', 'list="dl-p"')}
      ${inp('gerente', 'Gerente / equipe', 'text', '', 'list="dl-p"')}${inp('diretor', 'Diretoria', 'text', '', 'list="dl-p"')}
      <label class="s2">Observação<textarea class="in" data-v="obs" rows="1" ${ed ? '' : 'disabled'}>${esc(v.obs || '')}</textarea></label>
    </div>
    <div class="card mt" style="box-shadow:none" id="corpoBox"></div>
    <div class="mt" id="parcBox"></div>
    ${!novo && (v.historico || []).length ? `<details class="card mt" style="box-shadow:none"><summary style="cursor:pointer;font-weight:700">Histórico de alterações (${v.historico.length})</summary><div class="hist mt">${v.historico.slice().reverse().map(h => `<div class="h"><div class="q">${esc(new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))} · <b>${esc(h.por || '—')}</b></div><ul>${(h.alt || []).map(x => Array.isArray(x) ? { c: x[0], de: x[1], para: x[2] } : x).map(({ c, de, para: pa }) => `<li><b>${esc(c)}</b>: ${de ? `<span class="de">${esc(de)}</span> → ` : ''}<span class="para">${esc(pa || '(vazio)')}</span></li>`).join('')}</ul></div>`).join('')}</div></details>` : ''}
  </div>
  <div class="mf">${!novo && adm ? '<button class="btn danger" id="bDel">Excluir</button>' : ''}${!novo ? '<button class="btn" id="bDup">Duplicar</button>' : ''}${mst ? '<button class="btn" id="bDemo">Demonstrativo PDF</button>' : ''}<span class="space"></span><button class="btn" data-close>Fechar</button>${ed ? '<button class="btn gold" id="bSave">Salvar</button>' : ''}</div>`);

  function ler() {
    const o = { ...v, corpo: { ...v.corpo } };
    $$('[data-v]', b).forEach(i => { o[i.dataset.v] = i.dataset.v === 'vgv' ? parseNum(i.value) : (['data', 'dataStatus', 'dataVenda', 'formaPagamento', 'regra', 'obs', 'cliente', 'cadastro', 'unidade'].includes(i.dataset.v) ? i.value.trim() : up(i.value)); });
    o.participantes = v.participantes.map(p => ({ ...p })); o.taxa = v.taxa; o.regra = v.regra || ''; o.formaPagamento = v.formaPagamento || '';
    return o;
  }

  // ---------- CORPO DE VENDAS ----------
  function corpo() {
    const o = ler(); const vgv = Number(o.vgv) || 0; const taxa = Number(v.taxa) || 0;
    const soma = v.participantes.reduce((a, p) => a + (Number(p.pct) || 0), 0);
    const dif = taxa - soma;
    const cargoSel = (p, i) => `<select class="in" data-pp="${i}" data-k="cargo" ${ed ? '' : 'disabled'}>${CARGOS.map(c => `<option value="${c.key}" ${c.key === p.cargo ? 'selected' : ''}>${c.label}</option>`).join('')}<option value="outro" ${p.cargo === 'outro' ? 'selected' : ''}>Outro…</option></select>${p.cargo === 'outro' ? `<input class="in mt" data-pp="${i}" data-k="label" value="${esc(p.label || '')}" placeholder="nome do cargo" ${ed ? '' : 'disabled'}>` : ''}`;
    $('#corpoBox', b).innerHTML = `<h3>Corpo de vendas e comissão</h3>
      <div class="row small" style="margin-bottom:10px;align-items:end">
        <label class="lbl">Modelo (quadro de taxas)<select class="in" id="cRegra" ${ed ? '' : 'disabled'}><option value="">— personalizado —</option>${D().regras.map(r => `<option value="${r.id}" ${r.id === v.regra ? 'selected' : ''}>${esc(r.nome)} (${pctf(r.taxa)})</option>`).join('')}</select></label>
        ${ed ? '<button class="btn sm" id="cAplicar" type="button">Preencher com o modelo</button>' : ''}
        <label class="lbl">Taxa total da venda (%)<input class="in right" id="cTaxa" style="width:110px" value="${taxa ? String(taxa).replace('.', ',') : ''}" ${ed ? '' : 'disabled'}></label>
        <div class="space"></div>
        <div class="tot-box"><span class="muted">Total da comissão</span><b>${brl(vgv * taxa / 100)}</b></div>
      </div>
      <div class="tbl-wrap"><table class="corpo"><thead><tr><th>Cargo</th><th>Quem recebe</th><th class="n">% sobre VGV</th><th class="n">Valor</th><th class="n">Referência</th><th></th></tr></thead><tbody>
      ${v.participantes.map((p, i) => { const val = vgv * (Number(p.pct) || 0) / 100; return `<tr><td style="min-width:170px">${cargoSel(p, i)}</td>
        <td style="min-width:190px"><input class="in" data-pp="${i}" data-k="pessoa" list="dl-p" value="${esc(p.pessoa || '')}" placeholder="nome" ${ed ? '' : 'disabled'} style="width:100%"></td>
        <td class="n"><input class="in right" data-pp="${i}" data-k="pct" value="${String(p.pct ?? '').replace('.', ',')}" style="width:80px" ${ed ? '' : 'disabled'}></td>
        <td class="n">${brl(val)}</td><td class="n">${taxa ? pctf((Number(p.pct) || 0) / taxa * 100) : '—'}</td>
        <td>${ed ? `<button class="btn sm danger" data-prm="${i}" type="button">×</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Nenhum participante. Escolha um modelo e clique em "Preencher com o modelo", ou adicione manualmente.</td></tr>'}
      </tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${pctf(soma)}</td><td class="n">${brl(vgv * soma / 100)}</td><td class="n">${taxa ? pctf(soma / taxa * 100) : '—'}</td><td></td></tr>
      <tr><td colspan="2">Diferença (taxa − soma)</td><td class="n" style="color:${Math.abs(dif) > 1e-6 ? 'var(--bad)' : 'var(--ok)'}">${pctf(dif)}</td><td class="n" style="color:${Math.abs(dif) > 1e-6 ? 'var(--bad)' : 'var(--ok)'}">${brl(vgv * dif / 100)}</td><td colspan="2">${Math.abs(dif) > 1e-6 ? '<span class="tag bad">não fecha 100%</span>' : (taxa ? '<span class="tag ok">fecha 100%</span>' : '')}</td></tr></tfoot></table></div>
      ${ed ? '<div class="row mt"><button class="btn sm" id="cAdd" type="button">+ Adicionar participante</button></div>' : ''}`;
    if (!ed) return;
    $('#cRegra', b).onchange = (e) => { v.regra = e.target.value; };
    $('#cAplicar', b).onclick = () => {
      const r = D().regras.find(x => x.id === $('#cRegra', b).value); if (!r) return toast('Escolha um modelo do quadro de taxas');
      const o = ler(); v.regra = r.id; v.taxa = Number(r.taxa) || 0;
      v.participantes = CARGOS.filter(c => Number(r.cargos?.[c.key]) > 0).map(c => ({ id: nid(), cargo: c.key, label: c.label, pessoa: titular(o, c.key), pct: Number(r.cargos[c.key]) }));
      corpo(); parcelas();
    };
    $('#cTaxa', b).onchange = (e) => { v.taxa = parseNum(e.target.value) || 0; corpo(); parcelas(); };
    $('#cAdd', b).onclick = () => { v.participantes.push({ id: nid(), cargo: 'corretor', label: 'Corretor', pessoa: '', pct: 0 }); corpo(); };
    $$('[data-prm]', b).forEach(x => x.onclick = () => { v.participantes.splice(+x.dataset.prm, 1); corpo(); });
    $$('[data-pp]', b).forEach(x => x.onchange = () => {
      const p = v.participantes[+x.dataset.pp], k = x.dataset.k;
      if (k === 'pct') p.pct = parseNum(x.value) || 0;
      else if (k === 'cargo') { p.cargo = x.value; p.label = x.value === 'outro' ? '' : cargoLabel(x.value); }
      else if (k === 'pessoa') p.pessoa = up(x.value);
      else p[k] = x.value;
      corpo(); if (k === 'pct') parcelas();
    });
  }

  // ---------- CONDIÇÃO DE RECEBIMENTO ----------
  function parcelas() {
    const o = ler(); const ps = v.parcelas;
    const total = (Number(o.vgv) || 0) * (Number(v.taxa) || 0) / 100;
    const tot = ps.reduce((s, p) => s + (Number(p.valor) || 0), 0), recb = ps.filter(p => p.recebido).reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const dif = total - tot; const dis = adm ? '' : 'disabled';
    const F = v.formaPagamento || '';
    $('#parcBox', b).innerHTML = `<div class="card" style="box-shadow:none"><h3>Condição de recebimento da comissão <small>· incorporadora → imobiliária</small></h3>
      ${adm ? `<div class="form f6" style="margin-bottom:10px">
        <label class="s2">Condição<select class="in" id="gForma">${FORMAS.map(f => `<option value="${f.key}" ${f.key === F ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
        <label>Data do ato / 1º receb.<input type="date" class="in" id="gData" value="${o.dataVenda || hoje()}"></label>
        <label data-g="ato">Valor do ato (R$)<input class="in" id="gAtoV" placeholder="0,00"></label>
        <label data-g="mensal">Nº parcelas mensais<input class="in" id="gQtd" value="3"></label>
        <label data-g="mensal">1ª mensal em<input type="date" class="in" id="gPrim"></label>
        <label data-g="rep">Repasse em (dias)<input class="in" id="gDias" value="${PRAZO_REPASSE_DIAS}"></label>
        <div class="row" style="align-items:end"><button class="btn sm gold" id="gGerar" type="button">Gerar parcelas</button><button class="btn sm" id="gAdd" type="button">+ Parcela</button></div>
      </div>` : ''}
      ${ps.length ? `<div class="tbl-wrap"><table><thead><tr><th>Série</th><th>Descrição</th><th class="n">Valor</th><th>Vencimento</th><th>Recebido</th><th>Data receb.</th><th></th></tr></thead><tbody>
      ${ps.map((p, i) => `<tr><td><select class="in" data-p="${i}" data-k="serie" ${dis}>${SERIES.map(s => `<option ${s === (p.serie || 'Outro') ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><input class="in" data-p="${i}" data-k="descricao" value="${esc(p.descricao || '')}" ${dis}></td><td><input class="in right" style="width:120px" data-p="${i}" data-k="valor" value="${String(p.valor ?? '').replace('.', ',')}" ${dis}></td>
        <td><input type="date" class="in" data-p="${i}" data-k="vencimento" value="${p.vencimento || ''}" ${dis}></td><td><input type="checkbox" data-p="${i}" data-k="recebido" ${p.recebido ? 'checked' : ''} ${dis}></td>
        <td><input type="date" class="in" data-p="${i}" data-k="dataRecebimento" value="${p.dataRecebimento || ''}" ${dis}></td><td>${adm ? `<button class="btn sm danger" data-rm="${i}" type="button">×</button>` : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">Total das parcelas</td><td class="n">${brl(tot)}</td><td colspan="4">Recebido ${brl(recb)} · em aberto ${brl(tot - recb)} ${Math.abs(dif) > 0.05 ? `<span class="tag bad">diferença de ${brl(dif)} para o total da comissão (${brl(total)})</span>` : '<span class="tag ok">fecha com o total da comissão</span>'}</td></tr></tfoot></table></div>
      <p class="muted small">Cada parcela marcada como <b>recebida</b> gera os pagamentos de cada participante (pela referência) na tela Pagamentos, no mês do recebimento.</p>`
        : `<div class="muted small">Sem parcelas lançadas. ${total ? `Escolha a condição e clique em "Gerar parcelas". Sem parcelas, o sistema usa a previsão automática de ${brl(total)} em ${fd(addDays(dataRef(o) || hoje(), PRAZO_REPASSE_DIAS))}.` : 'Informe o VGV e a taxa para calcular.'}</div>`}</div>`;
    if (!adm) return;
    const syncG = () => { const f = $('#gForma', b).value; $$('[data-g="ato"]', b).forEach(x => x.classList.toggle('hidden', !['ato', 'atorep'].includes(f))); $$('[data-g="mensal"]', b).forEach(x => x.classList.toggle('hidden', f !== 'ato')); $$('[data-g="rep"]', b).forEach(x => x.classList.toggle('hidden', !['repasse', 'atorep'].includes(f))); };
    $('#gForma', b).onchange = () => { v.formaPagamento = $('#gForma', b).value; syncG(); }; syncG();
    $('#gGerar', b).onclick = async () => {
      if (v.parcelas.some(p => p.recebido) && !(await confirmar('Já existem parcelas marcadas como recebidas. Gerar de novo substitui todas as parcelas. Continuar?'))) return;
      const f = $('#gForma', b).value; v.formaPagamento = f;
      v.parcelas = gerarParcelas(ler(), D().regras, { forma: f, valorAto: parseNum($('#gAtoV', b).value), qtd: $('#gQtd', b).value, primeira: $('#gPrim', b).value || '', dias: $('#gDias', b).value, dataAto: $('#gData', b).value });
      parcelas();
    };
    $('#gAdd', b).onclick = () => { v.parcelas.push({ id: nid(), serie: 'Mensal', descricao: 'Parcela', valor: 0, vencimento: hoje(), recebido: false, dataRecebimento: '' }); parcelas(); };
    $$('[data-rm]', b).forEach(x => x.onclick = () => { v.parcelas.splice(+x.dataset.rm, 1); parcelas(); });
    $$('[data-p]', b).forEach(x => x.onchange = () => {
      const p = v.parcelas[+x.dataset.p], k = x.dataset.k;
      p[k] = k === 'recebido' ? x.checked : k === 'valor' ? (parseNum(x.value) || 0) : x.value;
      if (k === 'recebido' && x.checked && !p.dataRecebimento) p.dataRecebimento = hoje();
      if (k === 'recebido' && !x.checked) p.dataRecebimento = '';
      parcelas();
    });
  }
  // auto-preenchimento
  const sel = (f) => $(`[data-v="${f}"]`, b);
  const preencheTitular = (cargo, nome) => { let ch = false; v.participantes.forEach(p => { if (p.cargo === cargo && !p.pessoa && nome) { p.pessoa = up(nome); ch = true; } }); if (ch) corpo(); };
  sel('corretor')?.addEventListener('change', () => { const p = pessoaPorNome(sel('corretor').value); if (p) { if (p.gerente && !sel('gerente').value) sel('gerente').value = p.gerente; if (p.diretor && !sel('diretor').value) sel('diretor').value = p.diretor; } preencheTitular('corretor', sel('corretor').value); preencheTitular('gerente', sel('gerente').value); preencheTitular('dirVendas', sel('diretor').value); });
  sel('gerente')?.addEventListener('change', () => { const p = pessoaPorNome(sel('gerente').value); if (p?.diretor && !sel('diretor').value) sel('diretor').value = p.diretor; preencheTitular('gerente', sel('gerente').value); });
  sel('diretor')?.addEventListener('change', () => preencheTitular('dirVendas', sel('diretor').value));
  sel('empreendimento')?.addEventListener('change', () => { const e = D().empreendimentos.find(x => up(x.nome) === up(sel('empreendimento').value)); if (e) { if (!sel('incorporadora').value) sel('incorporadora').value = e.incorporadora || ''; if (e.regraPadrao && !v.regra) { v.regra = e.regraPadrao; corpo(); } } });
  sel('status')?.addEventListener('change', () => { sel('dataStatus').value = hoje(); if (STATUS_VENDA.includes(sel('status').value) && !sel('dataVenda').value) sel('dataVenda').value = hoje(); });
  sel('vgv')?.addEventListener('change', () => { corpo(); parcelas(); });
  corpo(); parcelas();

  $('#bSave', b) && ($('#bSave', b).onclick = async () => {
    const o = ler();
    o.participantes = v.participantes.filter(p => p.pessoa || Number(p.pct)).map(p => ({ id: p.id || nid(), cargo: p.cargo, label: p.label || cargoLabel(p.cargo), pessoa: up(p.pessoa), pct: Number(p.pct) || 0 }));
    o.parcelas = v.parcelas.map(p => ({ id: p.id || nid(), serie: p.serie || 'Outro', descricao: p.descricao || '', valor: round2(p.valor), vencimento: p.vencimento || '', recebido: !!p.recebido, dataRecebimento: p.dataRecebimento || '' }));
    if (!o.empreendimento) return toast('Informe o empreendimento');
    if (!empOk({ empreendimento: o.empreendimento })) return toast('Você não tem acesso a este empreendimento');
    if (o.participantes.length) { const soma = o.participantes.reduce((a, p) => a + p.pct, 0); if (Math.abs(soma - (Number(o.taxa) || 0)) > 1e-6 && !(await confirmar(`O corpo de vendas soma ${pctf(soma)} e a taxa da venda é ${pctf(o.taxa || 0)}. Salvar mesmo assim? (a venda fica com pendência)`))) return; }
    const semNome = o.participantes.filter(p => !p.pessoa).map(p => p.label);
    if (semNome.length && !(await confirmar(`Sem nome no corpo de vendas: ${semNome.join(', ')}. Esses valores aparecerão como "(sem nome)" em Pagamentos. Salvar mesmo assim?`))) return;
    if (o.parcelas.length && o.parcelas.every(p => p.recebido) && !o.financeiro) o.financeiro = 'PAGO';
    try {
      await save('vendas', o);
      if (store.isAdmin()) {
        if (!D().empreendimentos.some(e => up(e.nome) === o.empreendimento)) await save('empreendimentos', { nome: o.empreendimento, incorporadora: o.incorporadora, regraPadrao: o.regra || '', ativo: true });
        for (const [n, cargo] of [[o.corretor, 'CORRETOR'], [o.gerente, 'GERENTE'], [o.diretor, 'DIRETOR']]) if (n && !pessoaPorNome(n)) await save('pessoas', { nome: n, apelido: n, cargo, gerente: cargo === 'CORRETOR' ? o.gerente : '', diretor: cargo !== 'DIRETOR' ? o.diretor : '', ativo: true, tipo: 'PF' });
      }
      closeModal(); toast('Venda salva');
    } catch (e) { console.error(e); toast('Erro ao salvar: ' + (e.message || e)); }
  });
  $('#bDel', b) && ($('#bDel', b).onclick = async () => { if (!(await confirmar('Excluir este registro definitivamente?'))) return; await remove('vendas', v.id); closeModal(); toast('Excluído'); });
  $('#bDup', b) && ($('#bDup', b).onclick = () => { const o = ler(); delete o.id; o.unidade = ''; o.cliente = ''; o.cadastro = ''; o.parcelas = []; o.pagamentos = {}; o.participantes = o.participantes.map(p => ({ ...p, id: nid() })); closeModal(); abrirVenda(null, o); });
  $('#bDemo', b) && ($('#bDemo', b).onclick = () => { const o = ler(); o.parcelas = v.parcelas; demonstrativoPDF(o); });
}

// Demonstrativo da venda (como a planilha): corpo de vendas, referência e parcelas com imposto descontado
function demonstrativoPDF(v) {
  const c = comissoes(v, D().regras); const imp = impostoPct();
  if (!c.linhas.length) return toast('Preencha o corpo de vendas antes');
  const ps = parcelasDaVenda(v, D().regras);
  const rows1 = c.linhas.map(l => ({ cargo: l.label, nome: l.pessoa, ref: l.ref * 100, pct: l.pct, val: l.valor }));
  const t1 = { cargo: 'TOTAL', ref: c.linhas.reduce((a, l) => a + l.ref * 100, 0), pct: c.linhas.reduce((a, l) => a + l.pct, 0), val: c.total };
  const cols2 = [['cargo', 'Cargo'], ['nome', 'Nome']];
  const rows2 = c.linhas.map(l => ({ cargo: l.label, nome: l.pessoa }));
  const tot2 = { cargo: 'TOTAL' };
  ps.forEach((p, i) => {
    const kb = 'b' + i, kl = 'l' + i;
    cols2.push([kb, `P${i + 1} ${p.serie || ''} ${fd(p.vencimento)}`.trim(), 'brl'], [kl, `Líquido P${i + 1}${p.recebido ? ' ✓' : ''}`.replace(' ✓', ' (receb.)'), 'brl']);
    c.linhas.forEach((l, j) => { const br = round2((Number(p.valor) || 0) * l.ref); rows2[j][kb] = br; rows2[j][kl] = round2(br - round2(br * imp / 100)); });
    tot2[kb] = rows2.reduce((a, r) => a + r[kb], 0); tot2[kl] = rows2.reduce((a, r) => a + r[kl], 0);
  });
  gerarPDF({ titulo: 'Demonstrativo de comissão', nome: `demonstrativo_${slug(v.empreendimento)}_${v.unidade || ''}`, orient: ps.length > 2 ? 'landscape' : 'portrait',
    sub: `${v.empreendimento} · Unid. ${v.unidade || '—'} · Comprador: ${v.cliente || '—'} · Venda em ${fd(dataRef(v))}`,
    resumo: [['VGV', brl(v.vgv)], ['Taxa', pctf(c.taxa)], ['Total comissão', brl(c.receita)], ['Imposto a descontar', pctf(imp)]],
    tabelas: [
      { titulo: 'Corpo de vendas', cols: [['cargo', 'Cargo'], ['nome', 'Nome'], ['ref', 'Referência', 'pct'], ['pct', '% sobre VGV', 'pct'], ['val', 'Valor total', 'brl']], rows: rows1, totaisLinha: t1 },
      { titulo: `Parcelas e valores a pagar (líquido já com ${pctf(imp)} de imposto descontado)`, cols: cols2, rows: rows2, totaisLinha: tot2 },
    ] });
}

// ============================ FUNIL ============================
function vFunil(el) {
  const F = Object.assign({ emp: '', dir: '', perd: false }, store_get('fFunil', {}));
  const vs0 = vendasVis();
  const opts = (arr, sel) => '<option value="">Todos</option>' + [...new Set(arr.filter(Boolean))].sort().map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  el.innerHTML = `<div class="filters"><label>Empreendimento<select class="in" data-f="emp">${opts(vs0.map(v => v.empreendimento), F.emp)}</select></label>
  <label>Diretoria<select class="in" data-f="dir">${opts(vs0.map(v => v.diretor), F.dir)}</select></label>
  <label class="row" style="display:flex;gap:6px"><input type="checkbox" data-f="perd" ${F.perd ? 'checked' : ''}> Mostrar perdidas</label>
  <span class="space"></span><span class="muted small">Arraste o card para outra coluna para mudar o status.</span></div><div id="res"></div>`;
  $$('[data-f]', el).forEach(i => i.onchange = () => { F[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; store_set('fFunil', F); upd(); });
  const ALVO = { 'Cadastro': 'NOVA PASTA', 'Análise': 'EM ANALISE', 'Aprovado': 'APROVADO', 'Reserva': 'EM RESERVA', 'Assinatura': 'EM ASSINATURA', 'Vendido': 'CONTRATO ASSINADO', 'Perdido': 'CANCELADO' };
  function upd() {
    const vs = vendasVis().filter(v => (!F.emp || v.empreendimento === F.emp) && (!F.dir || v.diretor === F.dir));
    const gs = GRUPOS_FUNIL.filter(g => F.perd || g !== 'Perdido');
    $('#res', el).innerHTML = `<div class="kanban">${gs.map(g => {
      const it = vs.filter(v => statusInfo(v.status).grupo === g).sort((a, b) => (b.dataStatus || b.data || '').localeCompare(a.dataStatus || a.data || ''));
      const tv = it.reduce((s, v) => s + (Number(v.vgv) || 0), 0);
      return `<div class="kcol" data-g="${g}"><h4><span>${g}</span><span>${it.length}</span></h4><div class="muted small" style="margin:-6px 4px 8px">${brlc(tv)}</div>
        ${it.slice(0, 80).map(v => `<div class="kcard" draggable="${podeEditar()}" data-id="${v.id}" style="border-left-color:${statusInfo(v.status).cor}"><b>${esc(v.empreendimento)} · ${esc(v.unidade || 's/ unid.')}</b>
          <div class="m">${esc(v.cliente || v.cadastro || '')} ${v.vgv ? '· ' + brlc(v.vgv) : ''}</div><div class="m row">${avatar(v.corretor || v.gerente, 'sm')} ${esc(v.corretor || v.gerente)} <span class="space"></span><span class="tag">${esc(v.status)}</span></div></div>`).join('')}
        ${it.length > 80 ? `<div class="muted small">+ ${it.length - 80} — use a tela Vendas</div>` : ''}</div>`;
    }).join('')}</div>`;
    $$('.kcard', el).forEach(c => { c.onclick = () => abrirVenda(D().vendas.find(v => v.id === c.dataset.id)); c.ondragstart = e => e.dataTransfer.setData('text', c.dataset.id); });
    $$('.kcol', el).forEach(col => { col.ondragover = e => e.preventDefault(); col.ondrop = async e => {
      e.preventDefault(); const v = D().vendas.find(x => x.id === e.dataTransfer.getData('text')); if (!v) return;
      const st = ALVO[col.dataset.g]; if (statusInfo(v.status).grupo === col.dataset.g) return;
      const o = { ...v, status: st, dataStatus: hoje() }; if (STATUS_VENDA.includes(st) && !o.dataVenda) o.dataVenda = hoje();
      await save('vendas', o); toast(`Status alterado para ${st}`);
    }; });
  }
  upd(); return upd;
}

// ============================ COMISSÕES ============================
function vComissoes(el) {
  const F = Object.assign({ tipo: 'mes', aba: 'pessoa', q: '' }, store_get('fCom', {}));
  $('#topActions').innerHTML = '<button class="btn" id="bExp">Excel</button><button class="btn" id="bPdf">PDF</button>';
  el.innerHTML = `<div class="filters">${perHTML(F)}
    <label>Visão<select class="in" data-f="aba"><option value="pessoa" ${F.aba === 'pessoa' ? 'selected' : ''}>Por pessoa</option><option value="hier" ${F.aba === 'hier' ? 'selected' : ''}>Hierarquia (diretor › gerente › corretor)</option><option value="venda" ${F.aba === 'venda' ? 'selected' : ''}>Por venda (detalhado)</option><option value="emp" ${F.aba === 'emp' ? 'selected' : ''}>Imobiliária por empreendimento</option></select></label>
    <label>Buscar pessoa<input class="in" data-f="q" value="${esc(F.q)}"></label><span class="space"></span><span class="muted small" id="lbl"></span></div><div id="res"></div>`;
  bindPer(el, F, () => { store_set('fCom', F); upd(); });
  $$('[data-f]', el).forEach(i => i.oninput = () => { F[i.dataset.f] = i.value; store_set('fCom', F); upd(); });
  let exportRows = [], pdfSpec = null;
  function upd() {
    const R = perRange(F), regras = D().regras, esc0 = escopoPessoas(), q = F.q.trim().toUpperCase();
    $('#lbl', el).textContent = 'Vendas válidas (contrato assinado/vendido com VGV) · ' + perLabel(F);
    const vend = vendasVis().filter(v => isVenda(v) && noPeriodo(dataRef(v), R));
    const calc = vend.map(v => ({ v, c: comissoes(v, regras) }));
    const semRegra = calc.filter(x => !x.c.regra).length;
    let vgv = 0, rec = 0, tot = 0, praes = 0; calc.forEach(({ v, c }) => { vgv += +v.vgv; rec += c.receita; tot += c.total; praes += c.linhas.filter(l => l.cargo === 'imob').reduce((s, l) => s + l.valor, 0); });
    const kpis = `<div class="kpis">
      <div class="kpi hl"><div class="l">VGV</div><div class="v">${brlc(vgv)}</div><div class="s">${calc.length} venda(s)</div></div>
      ${esc0 ? '' : `<div class="kpi"><div class="l">Receita (taxa incorporadora)</div><div class="v">${brlc(rec)}</div></div>
      <div class="kpi"><div class="l">Distribuído ao corpo de vendas</div><div class="v">${brlc(tot)}</div><div class="s">__SEMTIT__</div></div>
      <div class="kpi"><div class="l">Parte PRAES Imobiliária</div><div class="v">${brlc(praes)}</div><div class="s">diferença taxa−cargos: ${brlc(rec - tot)}</div></div>`}
      <div class="kpi"><div class="l">Vendas sem regra</div><div class="v" style="color:${semRegra ? 'var(--warn)' : 'inherit'}">${semRegra}</div><div class="s">não entram na comissão</div></div></div>`;
    // agregação por pessoa
    const P = {}; let semTit = 0;
    const get = (n) => P[n] = P[n] || { nome: n, vendas: 0, vgv: 0, vEq: 0, vgvEq: 0, com: 0, porCargo: {} };
    calc.forEach(({ v, c }) => {
      const cor = v.corretor || v.gerente; if (cor) { const p = get(cor); p.vendas++; p.vgv += +v.vgv; }
      new Set([v.gerente, v.diretor].filter(x => x && x !== cor)).forEach(n => { const p = get(n); p.vEq++; p.vgvEq += +v.vgv; });
      c.linhas.forEach(l => { if (!l.pessoa) { semTit += l.valor; return; } const p = get(l.pessoa); p.com += l.valor; p.porCargo[l.label] = (p.porCargo[l.label] || 0) + l.valor; });
    });
    let pessoas = Object.values(P).filter(p => (!esc0 || esc0.has(up(p.nome))) && (!q || p.nome.includes(q)));
    pessoas.sort((a, b) => b.com - a.com || b.vgv - a.vgv);
    let html = '';
    if (F.aba === 'pessoa') {
      html = `<div class="tbl-wrap"><table><thead><tr><th>Pessoa</th><th>Cargo</th><th class="n">Vendas próprias</th><th class="n">VGV próprio</th><th class="n">Vendas da equipe</th><th class="n">VGV equipe</th><th class="n">Comissão no período</th><th>Composição</th><th class="n">Meta VGV</th><th class="n">Ating.</th><th></th></tr></thead><tbody>
      ${pessoas.map(p => { const pp = pessoaPorNome(p.nome); const meta = Number(pp?.metaVgv) || 0; const base = p.vgv + p.vgvEq; return `<tr><td><span class="row">${avatar(p.nome, 'sm')} <b>${esc(p.nome)}</b></span></td><td>${esc(pp?.cargo || '')}</td>
        <td class="n">${p.vendas || ''}</td><td class="n">${p.vgv ? brl(p.vgv) : ''}</td><td class="n">${p.vEq || ''}</td><td class="n">${p.vgvEq ? brl(p.vgvEq) : ''}</td><td class="n"><b>${brl(p.com)}</b></td>
        <td>${Object.entries(p.porCargo).map(([k, x]) => `<span class="tag">${esc(k)}: ${brlc(x)}</span>`).join('')}</td><td class="n">${meta ? brlc(meta) : ''}</td><td class="n">${meta ? pctf(base / meta * 100, 0) : ''}</td><td><button class="btn sm" data-ext="${esc(p.nome)}" title="Extrato individual em PDF">Extrato PDF</button></td></tr>`; }).join('') || '<tr><td colspan="11" class="empty">Nenhuma venda no período</td></tr>'}
      </tbody><tfoot><tr><td colspan="6">Total</td><td class="n">${brl(pessoas.reduce((s, p) => s + p.com, 0))}</td><td colspan="4"></td></tr></tfoot></table></div>`;
      const pr = pessoas.map(p => ({ nome: p.nome, cargo: pessoaPorNome(p.nome)?.cargo || '', vp: p.vendas || '', vgvp: p.vgv || '', ve: p.vEq || '', vgve: p.vgvEq || '', com: p.com, comp: Object.entries(p.porCargo).map(([k, x]) => `${k}: ${brl(x)}`).join(' | ') }));
      pdfSpec = { titulo: 'Comissões por pessoa', cols: [['nome', 'Pessoa'], ['cargo', 'Cargo'], ['vp', 'Vendas próprias', 'n'], ['vgvp', 'VGV próprio', 'brl'], ['ve', 'Vendas equipe', 'n'], ['vgve', 'VGV equipe', 'brl'], ['com', 'Comissão', 'brl'], ['comp', 'Composição']], rows: pr, totais: somar(pr, ['com']) };
      exportRows = pessoas.map(p => ({ PESSOA: p.nome, CARGO: pessoaPorNome(p.nome)?.cargo || '', 'VENDAS PRÓPRIAS': p.vendas, 'VGV PRÓPRIO': round2(p.vgv), 'VENDAS EQUIPE': p.vEq, 'VGV EQUIPE': round2(p.vgvEq), 'COMISSÃO': round2(p.com), ...Object.fromEntries(Object.entries(p.porCargo).map(([k, x]) => [k, round2(x)])) }));
    } else if (F.aba === 'hier') {
      const T = {};
      calc.forEach(({ v, c }) => {
        const d = v.diretor || '(sem diretoria)', g = v.gerente || '(sem gerente)', co = v.corretor || `${g} (venda própria)`;
        const nd = T[d] = T[d] || { n: 0, vgv: 0, g: {} }; const ng = nd.g[g] = nd.g[g] || { n: 0, vgv: 0, c: {} }; const nc = ng.c[co] = ng.c[co] || { n: 0, vgv: 0 };
        [nd, ng, nc].forEach(x => { x.n++; x.vgv += +v.vgv; });
      });
      const comDe = (n) => P[n.replace(' (venda própria)', '')]?.com || 0;
      const visD = Object.entries(T).filter(([d, nd]) => !esc0 || esc0.has(d) || Object.keys(nd.g).some(g => esc0.has(g)) || Object.values(nd.g).some(ng => Object.keys(ng.c).some(c => esc0.has(c))));
      html = `<div class="card tree">${visD.sort((a, b) => b[1].vgv - a[1].vgv).map(([d, nd]) => `<details open class="lvl0"><summary>${avatar(d, 'sm')} <b>${esc(d)}</b> <span class="muted small" style="color:#bbb">Diretoria</span><span class="nums"><span>${nd.n} vendas</span><span>VGV <b>${brl(nd.vgv)}</b></span><span>Comissão <b>${brl(comDe(d))}</b></span></span></summary>
        ${Object.entries(nd.g).sort((a, b) => b[1].vgv - a[1].vgv).map(([g, ng]) => `<details><summary>${avatar(g, 'sm')} <b>${esc(g)}</b> <span class="muted small">Gerente</span><span class="nums"><span>${ng.n} vendas</span><span>VGV <b>${brl(ng.vgv)}</b></span><span>Comissão <b>${brl(comDe(g))}</b></span></span></summary>
          ${Object.entries(ng.c).sort((a, b) => b[1].vgv - a[1].vgv).map(([co, nc]) => `<div class="leaf">${avatar(co, 'sm')} ${esc(co)}<span class="nums" style="margin-left:auto"><span>${nc.n} vendas</span><span>VGV <b>${brl(nc.vgv)}</b></span><span>Comissão <b>${brl(comDe(co))}</b></span></span></div>`).join('')}
        </details>`).join('')}</details>`).join('') || '<div class="empty">Nenhuma venda no período</div>'}</div>
        <p class="muted small">Comissão mostrada = tudo que a pessoa recebe no período, somando todos os cargos que ocupa nas vendas.</p>`;
      const hr = []; visD.forEach(([d, nd]) => Object.entries(nd.g).sort((a, b) => b[1].vgv - a[1].vgv).forEach(([g, ng]) => { hr.push({ d, g, c: '— total da equipe', n: ng.n, vgv: ng.vgv, com: comDe(g) }); Object.entries(ng.c).sort((a, b) => b[1].vgv - a[1].vgv).forEach(([co, nc]) => hr.push({ d, g, c: co, n: nc.n, vgv: nc.vgv, com: comDe(co) })); }));
      pdfSpec = { titulo: 'Comissões por hierarquia', orient: 'portrait', cols: [['d', 'Diretoria'], ['g', 'Gerente'], ['c', 'Corretor'], ['n', 'Vendas', 'n'], ['vgv', 'VGV', 'brl'], ['com', 'Comissão da pessoa', 'brl']], rows: hr };
      exportRows = []; Object.entries(T).forEach(([d, nd]) => Object.entries(nd.g).forEach(([g, ng]) => Object.entries(ng.c).forEach(([co, nc]) => exportRows.push({ DIRETORIA: d, GERENTE: g, CORRETOR: co, VENDAS: nc.n, VGV: round2(nc.vgv), 'COMISSÃO CORRETOR': round2(comDe(co)) }))));
    } else if (F.aba === 'venda') {
      const lst = calc.filter(({ v }) => !esc0 || (v.acesso || []).some(a => [...esc0].map(slug).includes(a)));
      const cg = CARGOS.filter(c => lst.some(({ c: cc }) => cc.linhas.some(l => l.cargo === c.key)));
      html = `<div class="tbl-wrap" style="max-height:68vh"><table><thead><tr><th>Data</th><th>Empreend.</th><th>Unid.</th><th>Corretor</th><th class="n">VGV</th><th>Regra</th>${cg.map(c => `<th class="n">${c.label}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>
      ${lst.sort((a, b) => dataRef(b.v).localeCompare(dataRef(a.v))).map(({ v, c }) => `<tr class="click" data-id="${v.id}"><td>${fd(dataRef(v))}</td><td>${esc(v.empreendimento)}</td><td>${esc(v.unidade)}</td><td>${esc(v.corretor || v.gerente)}</td><td class="n">${brl(v.vgv)}</td><td>${c.regra ? esc(c.regra.nome) : '<span class="tag warn">sem regra</span>'}</td>
        ${cg.map(k => { const l = c.linhas.find(x => x.cargo === k.key); return `<td class="n" title="${esc(l?.pessoa || '')}">${l ? brl(l.valor) + `<div class="muted small">${esc(l.pessoa || '—')}</div>` : ''}</td>`; }).join('')}<td class="n"><b>${brl(c.total)}</b></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhuma venda no período</td></tr>'}</tbody></table></div>`;
      const vr = lst.map(({ v, c }) => { const val = (k) => c.linhas.find(l => l.cargo === k)?.valor || ''; return { data: fd(dataRef(v)), emp: v.empreendimento, un: v.unidade, cor: v.corretor || v.gerente, vgv: +v.vgv, regra: c.regra?.nome || 'SEM REGRA', c1: val('corretor'), c2: val('gerente'), c3: val('dirVendas'), c4: val('imob'), out: c.total - (Number(val('corretor')) || 0) - (Number(val('gerente')) || 0) - (Number(val('dirVendas')) || 0) - (Number(val('imob')) || 0) || '', tot: c.total }; });
      pdfSpec = { titulo: 'Comissões por venda', cols: [['data', 'Data'], ['emp', 'Empreend.'], ['un', 'Unid.'], ['cor', 'Corretor'], ['vgv', 'VGV', 'brl'], ['regra', 'Regra'], ['c1', 'Corretor', 'brl'], ['c2', 'Gerente', 'brl'], ['c3', 'Dir. vendas', 'brl'], ['c4', 'PRAES', 'brl'], ['out', 'Outros cargos', 'brl'], ['tot', 'Total', 'brl']], rows: vr, totais: somar(vr, ['vgv', 'c1', 'c2', 'c3', 'c4', 'out', 'tot']) };
      exportRows = lst.map(({ v, c }) => ({ DATA: fd(dataRef(v)), EMPREEND: v.empreendimento, UNID: v.unidade, CORRETOR: v.corretor, GERENTE: v.gerente, DIRETORIA: v.diretor, VGV: Number(v.vgv), REGRA: c.regra?.nome || '', ...Object.fromEntries(c.linhas.flatMap(l => [[l.label, round2(l.valor)], [l.label + ' - quem', l.pessoa]])), TOTAL: round2(c.total), 'RECEITA TAXA': round2(c.receita) }));
    } else {
      const E = {};
      calc.forEach(({ v, c }) => { const e = E[v.empreendimento] = E[v.empreendimento] || { n: 0, vgv: 0, rec: 0, tot: 0, praes: 0, sr: 0 }; e.n++; e.vgv += +v.vgv; e.rec += c.receita; e.tot += c.total; e.praes += c.linhas.filter(l => l.cargo === 'imob').reduce((s, l) => s + l.valor, 0); if (!c.regra) e.sr++; });
      const ent = Object.entries(E).sort((a, b) => b[1].vgv - a[1].vgv);
      html = esc0 ? '<div class="empty">Visão disponível para diretoria/master.</div>' : `<div class="tbl-wrap"><table><thead><tr><th>Empreendimento</th><th class="n">Vendas</th><th class="n">VGV</th><th class="n">Receita (taxa)</th><th class="n">Corpo de vendas</th><th class="n">Parte PRAES</th><th class="n">Diferença</th><th class="n">Sem regra</th></tr></thead><tbody>
        ${ent.map(([n, e]) => `<tr><td>${esc(n)}</td><td class="n">${e.n}</td><td class="n">${brl(e.vgv)}</td><td class="n">${brl(e.rec)}</td><td class="n">${brl(e.tot)}</td><td class="n">${brl(e.praes)}</td><td class="n">${brl(e.rec - e.tot)}</td><td class="n">${e.sr ? `<span class="tag warn">${e.sr}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      const er = ent.map(([n, e]) => ({ n, q: e.n, vgv: e.vgv, rec: e.rec, tot: e.tot, praes: e.praes, dif: e.rec - e.tot, sr: e.sr || '' }));
      pdfSpec = { titulo: 'Imobiliária por empreendimento', cols: [['n', 'Empreendimento'], ['q', 'Vendas', 'n'], ['vgv', 'VGV', 'brl'], ['rec', 'Receita (taxa)', 'brl'], ['tot', 'Corpo de vendas', 'brl'], ['praes', 'Parte PRAES', 'brl'], ['dif', 'Diferença', 'brl'], ['sr', 'Sem regra', 'n']], rows: er, totais: somar(er, ['q', 'vgv', 'rec', 'tot', 'praes', 'dif']) };
      exportRows = ent.map(([n, e]) => ({ EMPREENDIMENTO: n, VENDAS: e.n, VGV: round2(e.vgv), RECEITA: round2(e.rec), CORPO: round2(e.tot), PRAES: round2(e.praes), DIFERENCA: round2(e.rec - e.tot), 'SEM REGRA': e.sr }));
    }
    pdfSpec && (pdfSpec.resumo = [['VGV', brlc(vgv)], ['Vendas', num(calc.length)], ...(esc0 ? [] : [['Receita (taxa)', brlc(rec)], ['Corpo de vendas', brlc(tot)], ['Parte PRAES', brlc(praes)]]), ['Sem regra', num(semRegra)]]);
    pdfSpec && (pdfSpec.sub = 'Vendas válidas (contrato assinado/vendido com VGV) · Período: ' + perLabel(F));
    window.__extrato = (nome) => {
      const ls = []; calc.forEach(({ v, c }) => c.linhas.filter(l => up(l.pessoa) === up(nome)).forEach(l => ls.push({ data: fd(dataRef(v)), emp: v.empreendimento, un: v.unidade, cli: v.cliente, vgv: +v.vgv, regra: c.regra?.nome || '', cargo: l.label, pct: l.pct, val: l.valor })));
      const p = pessoaPorNome(nome);
      gerarPDF({ titulo: 'Extrato de comissões', orient: 'portrait', nome: 'extrato_' + nome + '_' + hoje(), sub: `${nome}${p?.cargo ? ' · ' + p.cargo : ''}${p?.nomeCompleto ? ' · ' + p.nomeCompleto : ''}${p?.pix ? ' · PIX ' + p.pix : ''} · Período: ${perLabel(F)}`,
        resumo: [['Total a receber', brl(ls.reduce((a, x) => a + x.val, 0))], ['Lançamentos', num(ls.length)]],
        cols: [['data', 'Data'], ['emp', 'Empreend.'], ['un', 'Unid.'], ['cli', 'Cliente'], ['vgv', 'VGV', 'brl'], ['regra', 'Regra'], ['cargo', 'Cargo'], ['pct', '%', 'pct'], ['val', 'Valor', 'brl']], rows: ls, totais: somar(ls, ['vgv', 'val']) });
    };
    $('#res', el).innerHTML = kpis.replace('__SEMTIT__', semTit > 0.005 ? `<span class="tag warn">${brlc(semTit)} sem titular</span> (coord., Fábio etc.)` : 'todos os cargos com titular') + html;
    $$('tr[data-id]', el).forEach(tr => tr.onclick = () => abrirVenda(D().vendas.find(v => v.id === tr.dataset.id)));
    $$('[data-ext]', el).forEach(bt => bt.onclick = () => window.__extrato(bt.dataset.ext));
  }
  $('#bExp').onclick = () => exportXlsx(exportRows, 'comissoes_' + F.aba + '_' + hoje());
  $('#bPdf').onclick = () => pdfSpec && gerarPDF({ ...pdfSpec, nome: 'comissoes_' + F.aba + '_' + hoje() });
  upd(); return upd;
}

// ============================ RECEBIMENTOS ============================
function vReceb(el) {
  const F = Object.assign({ tipo: 'tudo', sit: 'aberto' }, store_get('fRec', {}));
  el.innerHTML = `<div class="filters">${perHTML(F)}<label>Situação<select class="in" data-f="sit">${[['', 'Todas'], ['aberto', 'Em aberto'], ['atraso', 'Em atraso'], ['recebido', 'Recebidas']].map(([k, l]) => `<option value="${k}" ${F.sit === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <span class="space"></span><span class="muted small">Período filtra pelo vencimento. Vendas sem parcelas usam previsão automática (data da venda + ${PRAZO_REPASSE_DIAS} dias).</span></div><div id="res"></div>`;
  bindPer(el, F, () => { store_set('fRec', F); upd(); });
  $$('[data-f]', el).forEach(i => i.onchange = () => { F[i.dataset.f] = i.value; store_set('fRec', F); upd(); });
  $('#topActions').innerHTML = '<button class="btn" id="bPdf">PDF</button>';
  let pdfR = null;
  $('#bPdf').onclick = () => pdfR && gerarPDF(pdfR);
  function upd() {
    killCharts();
    const R = perRange(F), H = hoje();
    const all = []; vendasVis().forEach(v => parcelasDaVenda(v, D().regras).forEach(p => all.push({ v, p })));
    const sit = ({ p }) => p.recebido ? 'recebido' : p.vencimento < H ? 'atraso' : 'aberto';
    const inPer = all.filter(x => F.tipo === 'tudo' || noPeriodo(x.p.vencimento, R));
    const lst = inPer.filter(x => !F.sit || (F.sit === 'aberto' ? !x.p.recebido : sit(x) === F.sit)).sort((a, b) => a.p.vencimento.localeCompare(b.p.vencimento));
    const sum = (a) => a.reduce((s, x) => s + (Number(x.p.valor) || 0), 0);
    const rr = lst.map(({ v, p }) => ({ venc: fd(p.vencimento), venda: `${v.empreendimento} · ${v.unidade || ''}`, cli: v.cliente, cor: v.corretor || v.gerente, desc: p.descricao + (p.auto ? ' (previsão)' : ''), val: p.valor, sit: p.recebido ? 'Recebido ' + fd(p.dataRecebimento) : p.vencimento < H ? 'ATRASADO' : 'A receber' }));
    pdfR = { titulo: 'Recebimentos', nome: 'recebimentos_' + H, orient: 'portrait', sub: `Situação: ${{ '': 'todas', aberto: 'em aberto', atraso: 'em atraso', recebido: 'recebidas' }[F.sit]} · Vencimento: ${perLabel(F)}`,
      resumo: [['Previsto', brlc(sum(inPer))], ['Recebido', brlc(sum(inPer.filter(x => x.p.recebido)))], ['A receber', brlc(sum(inPer.filter(x => sit(x) === 'aberto')))], ['Em atraso', brlc(sum(inPer.filter(x => sit(x) === 'atraso')))]],
      cols: [['venc', 'Vencimento'], ['venda', 'Venda'], ['cli', 'Cliente'], ['cor', 'Corretor'], ['desc', 'Descrição'], ['val', 'Valor', 'brl'], ['sit', 'Situação']], rows: rr, totais: somar(rr, ['val']) };
    $('#res', el).innerHTML = `<div class="kpis">
      <div class="kpi hl"><div class="l">Previsto no período</div><div class="v">${brlc(sum(inPer))}</div><div class="s">${inPer.length} parcela(s)</div></div>
      <div class="kpi"><div class="l">Recebido</div><div class="v" style="color:var(--ok)">${brlc(sum(inPer.filter(x => x.p.recebido)))}</div></div>
      <div class="kpi"><div class="l">A receber</div><div class="v">${brlc(sum(inPer.filter(x => sit(x) === 'aberto')))}</div></div>
      <div class="kpi"><div class="l">Em atraso</div><div class="v" style="color:var(--bad)">${brlc(sum(inPer.filter(x => sit(x) === 'atraso')))}</div></div></div>
    <div class="card"><h3>Previsão de recebimento por mês <small>· próximos 6 meses + atrasados</small></h3><div class="chart-box" style="height:220px"><canvas id="chR"></canvas></div></div>
    <div class="tbl-wrap mt"><table><thead><tr><th>Vencimento</th><th>Venda</th><th>Cliente</th><th>Corretor</th><th>Descrição</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
    ${lst.map(({ v, p }, i) => { const s = sit({ p }); return `<tr><td>${fd(p.vencimento)}</td><td class="click" data-id="${v.id}" style="cursor:pointer"><b>${esc(v.empreendimento)}</b> · ${esc(v.unidade)}</td><td>${esc(v.cliente)}</td><td>${esc(v.corretor || v.gerente)}</td><td>${esc(p.descricao)} ${p.auto ? '<span class="tag">previsão</span>' : ''}</td>
      <td class="n">${brl(p.valor)}</td><td>${s === 'recebido' ? `<span class="tag ok">Recebido ${fd(p.dataRecebimento)}</span>` : s === 'atraso' ? '<span class="tag bad">Atrasado</span>' : '<span class="tag">A receber</span>'}</td>
      <td>${p.recebido ? '' : `<button class="btn sm" data-rc="${i}">Marcar recebido</button>`}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Nada por aqui</td></tr>'}
    </tbody><tfoot><tr><td colspan="5">Total</td><td class="n">${brl(sum(lst))}</td><td colspan="2"></td></tr></tfoot></table></div>`;
    $$('[data-id]', el).forEach(t => t.onclick = () => abrirVenda(D().vendas.find(v => v.id === t.dataset.id)));
    $$('[data-rc]', el).forEach(bt => bt.onclick = async () => {
      const { v, p } = lst[+bt.dataset.rc];
      const ps = (v.parcelas && v.parcelas.length) ? v.parcelas.map((x, i) => ({ ...x, id: x.id || 'x' + i })) : [{ id: Math.random().toString(36).slice(2, 9), serie: 'Repasse', descricao: 'Repasse', valor: round2(p.valor), vencimento: p.vencimento, recebido: false, dataRecebimento: '' }];
      ps[p.idx].recebido = true; ps[p.idx].dataRecebimento = hoje();
      await save('vendas', { ...v, parcelas: ps, financeiro: ps.every(x => x.recebido) ? 'PAGO' : 'PARCIAL' }); toast('Recebimento registrado');
    });
    const ms = []; const n = new Date(); for (let i = 0; i < 6; i++) { const d = new Date(n.getFullYear(), n.getMonth() + i, 1); ms.push(iso(d).slice(0, 7)); }
    const ab = all.filter(x => !x.p.recebido);
    chart($('#chR', el), { type: 'bar', data: { labels: ['Atrasado', ...ms.map(m => MESES[+m.slice(5) - 1] + '/' + m.slice(2, 4))], datasets: [{ label: 'A receber', data: [sum(ab.filter(x => x.p.vencimento < H)), ...ms.map(m => sum(ab.filter(x => x.p.vencimento >= H && x.p.vencimento.startsWith(m))))], backgroundColor: ['#dc2626', ...ms.map(() => '#c9a24a')], borderRadius: 6 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + brl(c.raw) } } }, scales: { y: { ticks: { callback: v => brlc(v) }, grid: { color: corGrid() } }, x: { grid: { display: false } } } } });
  }
  upd(); return upd;
}

// ============================ AGENDAMENTOS ============================
function vAgenda(el) {
  const F = Object.assign({ modo: 'cal', mes: hoje().slice(0, 7), cor: '', st: '' }, store_get('fAg', {}));
  $('#topActions').innerHTML = (podeEditar() ? '<button class="btn gold" id="bNovo">+ Novo agendamento</button>' : '') + '<button class="btn" id="bPdf">PDF do mês</button>';
  el.innerHTML = `<div class="filters"><label>Visão<select class="in" data-f="modo"><option value="cal" ${F.modo === 'cal' ? 'selected' : ''}>Calendário</option><option value="lista" ${F.modo === 'lista' ? 'selected' : ''}>Lista</option></select></label>
  <label>Mês<input type="month" class="in" data-f="mes" value="${F.mes}"></label>
  <label>Corretor<select class="in" data-f="cor"><option value="">Todos</option>${[...new Set(agVis().map(a => a.corretor).filter(Boolean))].sort().map(x => `<option ${x === F.cor ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
  <label>Status<select class="in" data-f="st"><option value="">Todos</option>${STATUS_AG.map(s => `<option ${s === F.st ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div><div id="res"></div>`;
  $$('[data-f]', el).forEach(i => i.onchange = () => { F[i.dataset.f] = i.value; store_set('fAg', F); upd(); });
  $('#bNovo') && ($('#bNovo').onclick = () => abrirAg(null));
  function upd() {
    const ags = agVis().filter(a => (!F.cor || a.corretor === F.cor) && (!F.st || a.status === F.st));
    const doMes = ags.filter(a => (a.data || '').startsWith(F.mes));
    $('#bPdf').onclick = () => { const [yy, mm] = F.mes.split('-'); gerarPDF({ titulo: 'Agendamentos', nome: 'agendamentos_' + F.mes, sub: `${MESES[+mm - 1]}/${yy}${F.cor ? ' · ' + F.cor : ''}${F.st ? ' · ' + F.st : ''}`,
      resumo: [['Agendamentos', num(doMes.length)], ['Realizados', num(doMes.filter(a => a.status === 'REALIZADO').length)], ['Não compareceu', num(doMes.filter(a => a.status === 'NÃO COMPARECEU').length)]],
      cols: [['d', 'Data'], ['hora', 'Hora'], ['cliente', 'Cliente'], ['telefone', 'Telefone'], ['tipo', 'Tipo'], ['empreendimento', 'Empreendimento'], ['corretor', 'Corretor'], ['status', 'Status'], ['obs', 'Obs.']],
      rows: doMes.slice().sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).map(a => ({ ...a, d: fd(a.data) })) }); };
    const real = doMes.filter(a => a.status === 'REALIZADO').length, falt = doMes.filter(a => a.status === 'NÃO COMPARECEU').length;
    const kp = `<div class="kpis"><div class="kpi hl"><div class="l">Agendamentos no mês</div><div class="v">${doMes.length}</div></div>
      <div class="kpi"><div class="l">Hoje</div><div class="v">${ags.filter(a => a.data === hoje()).length}</div></div>
      <div class="kpi"><div class="l">Realizados</div><div class="v">${real}</div></div>
      <div class="kpi"><div class="l">Comparecimento</div><div class="v">${real + falt ? pctf(real / (real + falt) * 100, 0) : '—'}</div><div class="s">realizados ÷ (realizados + faltas)</div></div></div>`;
    const cls = (a) => a.status === 'REALIZADO' ? 'done' : ['NÃO COMPARECEU', 'CANCELADO'].includes(a.status) ? 'miss' : '';
    if (F.modo === 'cal') {
      const [y, m] = F.mes.split('-').map(Number); const first = new Date(y, m - 1, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
      const days = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
      $('#res', el).innerHTML = kp + `<div class="cal">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => `<div class="dh">${d}</div>`).join('')}
        ${days.map(d => { const s = iso(d); const evs = ags.filter(a => a.data === s).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')); return `<div class="d ${d.getMonth() !== m - 1 ? 'out' : ''} ${s === hoje() ? 'today' : ''}" data-d="${s}"><div class="num">${d.getDate()}</div>${evs.slice(0, 4).map(a => `<div class="ev ${cls(a)}" data-a="${a.id}" title="${esc(a.cliente)} · ${esc(a.corretor)}">${esc(a.hora || '')} ${esc(a.cliente)}</div>`).join('')}${evs.length > 4 ? `<div class="muted small">+${evs.length - 4}</div>` : ''}</div>`; }).join('')}</div>`;
      $$('.d', el).forEach(d => d.onclick = (e) => { const a = e.target.closest('[data-a]'); if (a) abrirAg(D().agendamentos.find(x => x.id === a.dataset.a)); else if (podeEditar()) abrirAg(null, { data: d.dataset.d }); });
    } else {
      const lst = doMes.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
      $('#res', el).innerHTML = kp + `<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Telefone</th><th>Tipo</th><th>Empreendimento</th><th>Corretor</th><th>Status</th></tr></thead><tbody>
        ${lst.map(a => `<tr class="click" data-a="${a.id}"><td>${fd(a.data)}</td><td>${esc(a.hora)}</td><td>${esc(a.cliente)}</td><td>${esc(a.telefone)}${linkZap(a) ? ` <a href="${linkZap(a)}" target="_blank" rel="noopener" class="tag ok" onclick="event.stopPropagation()" title="Abrir WhatsApp">WhatsApp</a>` : ''}</td><td>${esc(a.tipo)}</td><td>${esc(a.empreendimento)}</td><td>${esc(a.corretor)}</td><td><span class="tag ${cls(a) === 'done' ? 'ok' : cls(a) === 'miss' ? 'bad' : ''}">${esc(a.status)}</span></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhum agendamento</td></tr>'}</tbody></table></div>`;
      $$('[data-a]', el).forEach(t => t.onclick = () => abrirAg(D().agendamentos.find(x => x.id === t.dataset.a)));
    }
  }
  upd(); return upd;
}
function linkZap(a) {
  let n = String(a.telefone || '').replace(/\D/g, ''); if (n.length < 10) return '';
  if (n.length <= 11) n = '55' + n.replace(/^0+/, '');
  const dia = a.data === hoje() ? 'hoje' : a.data === addDays(hoje(), 1) ? 'amanhã' : `no dia ${fd(a.data)}`;
  const nome = String(a.cliente || '').trim().split(/\s+/)[0] || '';
  const quem = (store.me?.nome || '').split(/\s+/)[0];
  const txt = `Olá${nome ? ' ' + nome.charAt(0) + nome.slice(1).toLowerCase() : ''}, tudo bem? Aqui é ${quem ? quem + ', ' : ''}da PRAES Imóveis. Passando para confirmar ${String(a.tipo || 'o atendimento').toLowerCase().startsWith('visita') ? 'sua ' + String(a.tipo).toLowerCase() : 'nosso agendamento (' + String(a.tipo || '').toLowerCase() + ')'} ${dia}${a.hora ? ' às ' + a.hora : ''}${a.empreendimento ? ' – ' + a.empreendimento : ''}. Posso confirmar?`;
  return `https://wa.me/${n}?text=${encodeURIComponent(txt)}`;
}
function abrirAg(a0, preset = {}) {
  const a = a0 ? { ...a0 } : { data: hoje(), hora: '10:00', status: 'AGENDADO', tipo: TIPOS_AG[0], ...preset };
  if (!a0 && store.me.papel === 'corretor') a.corretor = myP();
  const ed = podeEditar();
  const inp = (f, l, t = 'text', cls = '', extra = '') => `<label class="${cls}">${l}<input class="in" data-v="${f}" type="${t}" value="${esc(a[f] ?? '')}" ${extra} ${ed ? '' : 'disabled'}></label>`;
  const b = openModal(`<div class="mh"><h2>${a0 ? 'Agendamento' : 'Novo agendamento'}</h2><button class="x" data-close>×</button></div><div class="mb">${datalists()}<div class="form">
    ${inp('data', 'Data', 'date')}${inp('hora', 'Hora', 'time')}${inp('cliente', 'Cliente', 'text', 's2')}${inp('telefone', 'Telefone')}
    <label>Tipo<select class="in" data-v="tipo">${TIPOS_AG.map(t => `<option ${t === a.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    ${inp('empreendimento', 'Empreendimento', 'text', 's2', 'list="dl-e"')}${inp('corretor', 'Corretor', 'text', '', 'list="dl-p"')}${inp('gerente', 'Gerente', 'text', '', 'list="dl-p"')}${inp('diretor', 'Diretoria', 'text', '', 'list="dl-p"')}
    <label>Status<select class="in" data-v="status">${STATUS_AG.map(t => `<option ${t === a.status ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="s4">Observação<textarea class="in" rows="2" data-v="obs">${esc(a.obs || '')}</textarea></label></div></div>
    <div class="mf">${a0 && store.isAdmin() ? '<button class="btn danger" id="bDel">Excluir</button>' : ''}${a0 ? '<button class="btn" id="bConv">Virou cadastro/venda →</button>' : ''}<button class="btn zap" id="bZap" type="button">WhatsApp</button><span class="space"></span><button class="btn" data-close>Fechar</button>${ed ? '<button class="btn gold" id="bSave">Salvar</button>' : ''}</div>`);
  const ler = () => { const o = { ...a }; $$('[data-v]', b).forEach(i => o[i.dataset.v] = ['corretor', 'gerente', 'diretor', 'empreendimento'].includes(i.dataset.v) ? up(i.value) : i.value.trim()); return o; };
  $('[data-v="corretor"]', b).addEventListener('change', e => { const p = pessoaPorNome(e.target.value); if (p) { $('[data-v="gerente"]', b).value = p.gerente || ''; $('[data-v="diretor"]', b).value = p.diretor || ''; } });
  $('#bSave', b) && ($('#bSave', b).onclick = async () => { const o = ler(); if (!o.cliente) return toast('Informe o cliente'); if (o.empreendimento && !empOk({ empreendimento: o.empreendimento })) return toast('Você não tem acesso a este empreendimento'); await save('agendamentos', o); closeModal(); toast('Agendamento salvo'); });
  $('#bDel', b) && ($('#bDel', b).onclick = async () => { if (await confirmar('Excluir agendamento?')) { await remove('agendamentos', a.id); closeModal(); } });
  $('#bZap', b).onclick = () => { const o = ler(); const u = linkZap(o); if (!u) return toast('Informe o telefone do cliente (com DDD)'); window.open(u, '_blank'); };
  $('#bConv', b) && ($('#bConv', b).onclick = () => { const o = ler(); closeModal(); abrirVenda(null, { cliente: o.cliente, empreendimento: o.empreendimento, corretor: o.corretor, gerente: o.gerente, diretor: o.diretor, obs: `Origem: agendamento ${fd(o.data)} ${o.hora}` }); });
}

// ============================ EQUIPE ============================
function vEquipe(el) {
  const F = Object.assign({ q: '', cargo: '', modo: 'lista', inativos: false }, store_get('fEq', {}));
  const adm = store.isAdmin();
  $('#topActions').innerHTML = adm ? '<button class="btn gold" id="bNovo">+ Nova pessoa</button>' : '';
  el.innerHTML = `<div class="filters"><label>Buscar<input class="in" data-f="q" value="${esc(F.q)}"></label>
  <label>Cargo<select class="in" data-f="cargo"><option value="">Todos</option>${['DIRETOR', 'GERENTE', 'COORDENADOR', 'CORRETOR', 'IMOBILIÁRIA', 'PARCEIRO'].map(c => `<option ${c === F.cargo ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label>Visão<select class="in" data-f="modo"><option value="lista" ${F.modo === 'lista' ? 'selected' : ''}>Lista</option><option value="org" ${F.modo === 'org' ? 'selected' : ''}>Organograma</option></select></label>
  <label class="row" style="display:flex;gap:6px"><input type="checkbox" data-f="inativos" ${F.inativos ? 'checked' : ''}> Mostrar inativos</label></div><div id="res"></div>`;
  $$('[data-f]', el).forEach(i => i.oninput = () => { F[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; store_set('fEq', F); upd(); });
  $('#bNovo') && ($('#bNovo').onclick = () => abrirPessoa(null));
  function upd() {
    const vs = vendasVis().filter(isVenda);
    const visiveis = pessoasVisiveis();
    const ps = D().pessoas.filter(p => (!visiveis || visiveis.has(up(p.nome))) && (F.inativos || p.ativo !== false) && (!F.cargo || p.cargo === F.cargo) && (!F.q || p.nome.includes(up(F.q)))).sort((a, b) => a.nome.localeCompare(b.nome));
    if (F.modo === 'org') {
      const dirs = D().pessoas.filter(p => p.cargo === 'DIRETOR' && p.ativo !== false);
      const gers = (d) => D().pessoas.filter(p => p.cargo === 'GERENTE' && up(p.diretor) === up(d.nome) && p.ativo !== false);
      const cors = (g) => D().pessoas.filter(p => p.cargo !== 'DIRETOR' && p.cargo !== 'GERENTE' && up(p.gerente) === up(g.nome) && p.ativo !== false);
      $('#res', el).innerHTML = `<div class="card tree">${dirs.map(d => `<details open class="lvl0"><summary>${avatar(d.nome, 'sm')} <b>${esc(d.nome)}</b><span class="nums"><span>${gers(d).length} gerente(s)</span></span></summary>
        ${gers(d).map(g => `<details><summary>${avatar(g.nome, 'sm')} <b>${esc(g.nome)}</b> <span class="muted small">Gerente</span><span class="nums"><span>${cors(g).length} corretor(es)</span></span></summary>${cors(g).map(c => `<div class="leaf">${avatar(c.nome, 'sm')} ${esc(c.nome)}</div>`).join('')}</details>`).join('')}
        ${cors(d).length ? `<details><summary><b>Corretores diretos</b><span class="nums"><span>${cors(d).length}</span></span></summary>${cors(d).map(c => `<div class="leaf">${avatar(c.nome, 'sm')} ${esc(c.nome)}</div>`).join('')}</details>` : ''}
        </details>`).join('')}</div><p class="muted small">O organograma usa os campos "Gerente" e "Diretor" do cadastro de cada pessoa.</p>`;
      return;
    }
    $('#res', el).innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Pessoa</th><th>Cargo</th><th>Gerente</th><th>Diretor</th><th>Tipo</th><th>Telefone</th><th>CRECI</th><th class="n">Vendas (total)</th><th class="n">VGV (total)</th><th>Login</th><th>Ativo</th></tr></thead><tbody>
    ${ps.map(p => { const mv = vs.filter(v => (v.corretor || v.gerente) === p.nome); const u = userDaPessoa(p.nome); return `<tr class="click" data-id="${p.id}"><td><span class="row">${avatar(p.nome, 'sm')} <b>${esc(p.nome)}</b></span></td><td>${esc(p.cargo)}</td><td>${esc(p.gerente)}</td><td>${esc(p.diretor)}</td><td>${esc(p.tipo)}</td><td>${esc(p.telefone)}</td><td>${esc(p.creci)}</td>
      <td class="n">${mv.length || ''}</td><td class="n">${mv.length ? brl(mv.reduce((s, v) => s + +v.vgv, 0)) : ''}</td><td>${u ? `<span class="tag ok">${esc(u.email || u.usuario)}</span>` : ''}</td><td>${p.ativo === false ? '<span class="tag bad">Inativo</span>' : '<span class="tag ok">Ativo</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
    $$('tr[data-id]', el).forEach(t => t.onclick = () => abrirPessoa(D().pessoas.find(p => p.id === t.dataset.id)));
  }
  upd(); return upd;
}
function abrirPessoa(p0) {
  const p = p0 ? { ...p0 } : { cargo: 'CORRETOR', tipo: 'PF', ativo: true };
  const adm = store.isAdmin(); const dis = adm ? '' : 'disabled';
  const inp = (f, l, t = 'text', extra = '') => `<label>${l}<input class="in" data-v="${f}" type="${t}" value="${esc(p[f] ?? '')}" ${extra} ${dis}></label>`;
  const b = openModal(`<div class="mh">${avatar(p.nome || '?', 'md')}<h2>${p0 ? esc(p.nome) : 'Nova pessoa'}</h2><button class="x" data-close>×</button></div><div class="mb">${datalists()}<div class="form">
    ${inp('nome', 'Nome / apelido (como aparece na planilha)', 'text', p0 ? 'readonly' : '')}
    <label>Cargo<select class="in" data-v="cargo" ${dis}>${['DIRETOR', 'GERENTE', 'COORDENADOR', 'CORRETOR', 'IMOBILIÁRIA', 'PARCEIRO'].map(c => `<option ${c === p.cargo ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    ${inp('gerente', 'Gerente (equipe)', 'text', 'list="dl-p"')}${inp('diretor', 'Diretor', 'text', 'list="dl-p"')}
    <label>Tipo<select class="in" data-v="tipo" ${dis}>${['PF', 'PJ', 'PARCEIRO'].map(c => `<option ${c === p.tipo ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    ${inp('nomeCompleto', 'Nome completo')}${inp('telefone', 'Telefone')}${inp('creci', 'CRECI')}${inp('pix', 'Chave PIX')}
    ${inp('metaVendas', 'Meta mensal (nº vendas)', 'number')}${inp('metaVgv', 'Meta mensal VGV (R$)', 'number')}
    <label>Situação<select class="in" data-v="ativo" ${dis}><option value="true" ${p.ativo !== false ? 'selected' : ''}>Ativo</option><option value="false" ${p.ativo === false ? 'selected' : ''}>Inativo</option></select></label>
  </div>${p0 ? '<p class="muted small">O nome não pode ser alterado aqui porque é a ligação com as vendas. Para renomear, use "Importar/Exportar".</p>' : ''}</div>
  <div class="mf">${p0 && adm ? '<button class="btn danger" id="bDel">Excluir</button>' : ''}<span class="space"></span><button class="btn" data-close>Fechar</button>${adm ? '<button class="btn gold" id="bSave">Salvar</button>' : ''}</div>`);
  $('#bSave', b) && ($('#bSave', b).onclick = async () => {
    const o = { ...p }; $$('[data-v]', b).forEach(i => { const k = i.dataset.v; o[k] = k === 'ativo' ? i.value === 'true' : ['metaVendas', 'metaVgv'].includes(k) ? parseNum(i.value) : ['nome', 'gerente', 'diretor'].includes(k) ? up(i.value) : i.value.trim(); });
    if (!o.nome) return toast('Informe o nome'); if (!p0 && pessoaPorNome(o.nome)) return toast('Já existe uma pessoa com esse nome');
    o.apelido = o.apelido || o.nome; await save('pessoas', o); closeModal(); toast('Salvo');
  });
  $('#bDel', b) && ($('#bDel', b).onclick = async () => { if (await confirmar('Excluir pessoa do cadastro? (as vendas não são apagadas)')) { await remove('pessoas', p.id); closeModal(); } });
}

// ============================ EMPREENDIMENTOS ============================
function vEmps(el) {
  const adm = store.isAdmin();
  $('#topActions').innerHTML = adm ? '<button class="btn gold" id="bNovo">+ Novo empreendimento</button>' : '';
  el.innerHTML = '<div id="res"></div>';
  function abrir(e0) {
    const e = e0 ? { ...e0 } : { ativo: true }; const dis = adm ? '' : 'disabled';
    const b = openModal(`<div class="mh"><h2>${e0 ? esc(e.nome) : 'Novo empreendimento'}</h2><button class="x" data-close>×</button></div><div class="mb">${datalists()}<div class="form">
      <label class="s2">Nome<input class="in" data-v="nome" value="${esc(e.nome || '')}" ${e0 ? 'readonly' : ''} ${dis}></label>
      <label>Incorporadora<input class="in" data-v="incorporadora" list="dl-i" value="${esc(e.incorporadora || '')}" ${dis}></label>
      <label>Bairro / região<input class="in" data-v="bairro" value="${esc(e.bairro || '')}" ${dis}></label>
      <label class="s2">Regra padrão de comissão<select class="in" data-v="regraPadrao" ${dis}><option value="">—</option>${D().regras.map(r => `<option value="${r.id}" ${r.id === e.regraPadrao ? 'selected' : ''}>${esc(r.nome)} — ${esc(r.projeto)} (${pctf(r.taxa)})</option>`).join('')}</select></label>
      <label>Situação<select class="in" data-v="ativo" ${dis}><option value="true">Ativo</option><option value="false" ${e.ativo === false ? 'selected' : ''}>Inativo</option></select></label>
      <label class="s4">Unidades (espelho de vendas)<textarea class="in" data-v="unidades" rows="4" placeholder="Ex.: TORRE A: 101-110, 201-210&#10;TORRE B: 101-110&#10;ou só: 1-120" ${dis}>${esc(e.unidades || '')}</textarea></label></div>
      <p class="muted small">A regra padrão é sugerida automaticamente nas novas vendas deste empreendimento. Em <b>Unidades</b>, escreva uma torre/bloco por linha; use "101-110" para sequências e vírgula para separar.</p></div>
      <div class="mf">${e0 && adm ? '<button class="btn danger" id="bDel">Excluir</button>' : ''}<span class="space"></span><button class="btn" data-close>Fechar</button>${adm ? '<button class="btn gold" id="bSave">Salvar</button>' : ''}</div>`);
    $('#bSave', b) && ($('#bSave', b).onclick = async () => { const o = { ...e }; $$('[data-v]', b).forEach(i => o[i.dataset.v] = i.dataset.v === 'ativo' ? i.value === 'true' : ['nome', 'incorporadora'].includes(i.dataset.v) ? up(i.value) : i.value); if (!o.nome) return; await save('empreendimentos', o); closeModal(); toast('Salvo'); });
    $('#bDel', b) && ($('#bDel', b).onclick = async () => { if (await confirmar('Excluir empreendimento?')) { await remove('empreendimentos', e.id); closeModal(); } });
  }
  $('#bNovo') && ($('#bNovo').onclick = () => abrir(null));
  function upd() {
    const vs = vendasVis();
    $('#res', el).innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Empreendimento</th><th>Incorporadora</th><th>Regra padrão</th><th class="n">Cadastros</th><th class="n">Vendas</th><th class="n">VGV vendido</th><th>Situação</th></tr></thead><tbody>
    ${D().empreendimentos.filter(e => empOk({ empreendimento: e.nome })).sort((a, b) => a.nome.localeCompare(b.nome)).map(e => { const m = vs.filter(v => v.empreendimento === e.nome); const mv = m.filter(isVenda); return `<tr class="click" data-id="${e.id}"><td><b>${esc(e.nome)}</b></td><td>${esc(e.incorporadora)}</td><td>${esc(D().regras.find(r => r.id === e.regraPadrao)?.nome || '')}</td><td class="n">${m.length}</td><td class="n">${mv.length}</td><td class="n">${brl(mv.reduce((s, v) => s + +v.vgv, 0))}</td><td>${e.ativo === false ? '<span class="tag bad">Inativo</span>' : '<span class="tag ok">Ativo</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
    $$('tr[data-id]', el).forEach(t => t.onclick = () => abrir(D().empreendimentos.find(x => x.id === t.dataset.id)));
  }
  upd(); return upd;
}

// ============================ ESPELHO DE VENDAS ============================
function parseUnidades(txt) {
  const blocos = [];
  String(txt || '').split(/\n+/).map(l => l.trim()).filter(Boolean).forEach(l => {
    let nome = '', resto = l; const m = l.match(/^([^:]+):(.*)$/); if (m) { nome = up(m[1]); resto = m[2]; }
    const us = [];
    resto.split(/[,;]+|\s{2,}/).map(t => t.trim()).filter(Boolean).forEach(t => {
      const r = t.match(/^(\d+)\s*(?:-|a|até)\s*(\d+)$/i);
      if (r) { const a = +r[1], b = +r[2], w = r[1].length; if (b >= a && b - a <= 2000) for (let i = a; i <= b; i++) us.push(String(i).padStart(w, '0')); }
      else t.split(/\s+/).forEach(x => x && us.push(up(x)));
    });
    if (us.length) blocos.push({ nome, us });
  });
  return blocos;
}
const espClasse = (v) => { if (!v) return 'disp'; const g = statusInfo(v.status).grupo; return g === 'Vendido' ? 'vend' : g === 'Perdido' ? 'disp' : 'res'; };
const espPeso = { vend: 3, res: 2, disp: 1 };
function vEspelho(el) {
  const F = Object.assign({ emp: '' }, store_get('fEsp', {}));
  const emps = () => { const nomes = new Set(D().empreendimentos.filter(e => e.ativo !== false).map(e => e.nome)); vendasVis().forEach(v => v.empreendimento && nomes.add(v.empreendimento)); return [...nomes].filter(n => empOk({ empreendimento: n })).sort(); };
  function upd() {
    const lista = emps(); if (!F.emp || !lista.includes(F.emp)) F.emp = lista[0] || '';
    const emp = D().empreendimentos.find(e => e.nome === F.emp);
    const vs = vendasVis().filter(v => v.empreendimento === F.emp);
    const blocos = parseUnidades(emp?.unidades);
    const norm = (x) => up(x).replace(/^0+(?=\d)/, '');
    const usados = new Set();
    const achar = (bloco, u) => {
      let c = vs.filter(v => norm(v.unidade) === norm(u));
      if (bloco && blocos.length > 1) { const cb = c.filter(v => up(v.torre) === bloco); c = cb.length ? cb : c.filter(v => !v.torre || ['ÚNICA', 'UNICA', ''].includes(up(v.torre))); }
      c.forEach(v => usados.add(v.id));
      return c.sort((a, b) => espPeso[espClasse(b)] - espPeso[espClasse(a)] || String(b.dataStatus || b.data || '').localeCompare(String(a.dataStatus || a.data || '')))[0] || null;
    };
    const cel = (bloco, u, v) => { const c = espClasse(v); const ativo = v && c !== 'disp';
      return `<div class="esp-u ${c}" data-u="${esc(u)}" data-b="${esc(bloco)}" ${ativo ? `data-id="${v.id}"` : ''} title="${ativo ? esc(`${v.status} · ${v.cliente || ''} · ${v.corretor || ''}`) : 'Disponível'}">${esc(u)}<small>${ativo ? esc((v.cliente || '').split(' ')[0] || (c === 'vend' ? 'vendida' : statusInfo(v.status).grupo.toLowerCase())) : c === 'disp' && v ? 'caiu/canc.' : 'livre'}</small></div>`; };
    const partes = blocos.map(b => ({ nome: b.nome, cels: b.us.map(u => [u, achar(b.nome, u)]) }));
    const extras = vs.filter(v => v.unidade && !usados.has(v.id));
    const exMap = new Map(); extras.forEach(v => { const k = up(v.torre && !['ÚNICA', 'UNICA'].includes(up(v.torre)) ? v.torre + ' ' : '') + up(v.unidade); const cur = exMap.get(k); if (!cur || espPeso[espClasse(v)] > espPeso[espClasse(cur)]) exMap.set(k, v); });
    if (exMap.size) partes.push({ nome: blocos.length ? 'Unidades com venda fora da lista cadastrada' : 'Unidades com cadastro/venda', cels: [...exMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true })).map(([k, v]) => [k, v]), extra: true });
    const todas = partes.flatMap(p => p.cels); const cnt = { disp: 0, res: 0, vend: 0 }; todas.forEach(([, v]) => cnt[espClasse(v)]++);
    el.innerHTML = `<div class="filters"><label>Empreendimento<select class="in" id="eEmp">${lista.map(n => `<option ${n === F.emp ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><span class="space"></span>${store.isAdmin() && emp ? '<button class="btn" id="eEdit">Cadastrar / editar unidades</button>' : ''}</div>
      <div class="kpis"><div class="kpi"><div class="l">Disponíveis</div><div class="v" style="color:var(--ok)">${num(cnt.disp)}</div></div><div class="kpi"><div class="l">Em negociação / reserva</div><div class="v" style="color:var(--warn)">${num(cnt.res)}</div></div><div class="kpi"><div class="l">Vendidas</div><div class="v" style="color:var(--bad)">${num(cnt.vend)}</div></div><div class="kpi"><div class="l">Total</div><div class="v">${num(todas.length)}</div></div></div>
      <div class="esp-leg"><span><i style="background:#22c55e"></i>Disponível</span><span><i style="background:#f59e0b"></i>Em negociação (análise, aprovado, reserva, assinatura)</span><span><i style="background:#ef4444"></i>Vendida (contrato assinado / vendido)</span></div>
      ${!blocos.length ? `<div class="aviso-cob">As unidades deste empreendimento ainda não foram cadastradas, então aparecem só as que já têm cadastro ou venda. ${store.isAdmin() && emp ? 'Clique em <b>Cadastrar / editar unidades</b> para montar o espelho completo, com as disponíveis.' : ''}</div>` : ''}
      <div class="card">${partes.map(p => `<div class="esp-bloco"><h4>${esc(p.nome || (blocos.length > 1 ? '' : 'Unidades'))}</h4><div class="esp-grid">${p.cels.map(([u, v]) => cel(p.extra ? '' : p.nome, u, v)).join('')}</div></div>`).join('') || '<div class="empty">Nenhuma unidade</div>'}</div>
      <p class="muted small">Clique numa unidade vendida ou em negociação para abrir a venda${podeEditar() ? '; numa disponível, para cadastrar uma nova venda nela' : ''}.</p>`;
    $('#eEmp', el).onchange = (e) => { F.emp = e.target.value; store_set('fEsp', F); upd(); };
    $('#eEdit', el) && ($('#eEdit', el).onclick = () => {
      const b = openModal(`<div class="mh"><h2>Unidades · ${esc(emp.nome)}</h2><button class="x" data-close>×</button></div><div class="mb">
        <p class="muted">Uma torre/bloco por linha. Use <b>101-110</b> para sequências e vírgula para separar. Ex.:</p><pre class="muted small" style="background:var(--card2);padding:8px 10px;border-radius:8px">TORRE A: 101-104, 201-204, 301-304\nTORRE B: 101-104, 201-204\nCASAS: 1-30</pre>
        <textarea class="in" id="uTxt" rows="8" style="width:100%">${esc(emp.unidades || '')}</textarea><div class="muted small mt" id="uPrev"></div></div>
        <div class="mf"><span class="space"></span><button class="btn" data-close>Fechar</button><button class="btn gold" id="uSave">Salvar</button></div>`);
      const prev = () => { const bl = parseUnidades($('#uTxt', b).value); $('#uPrev', b).textContent = bl.length ? bl.map(x => `${x.nome || 'Unidades'}: ${x.us.length}`).join(' · ') + ` · total ${bl.reduce((a, x) => a + x.us.length, 0)} unidade(s)` : 'Nenhuma unidade reconhecida ainda'; };
      $('#uTxt', b).oninput = prev; prev();
      $('#uSave', b).onclick = async () => { await save('empreendimentos', { ...emp, unidades: $('#uTxt', b).value.trim() }); closeModal(); toast('Unidades salvas'); };
    });
    $$('.esp-u', el).forEach(c => c.onclick = () => {
      if (c.dataset.id) { const v = D().vendas.find(x => x.id === c.dataset.id); if (v) abrirVenda(v); return; }
      if (!podeEditar()) return toast('Unidade disponível');
      abrirVenda(null, { empreendimento: F.emp, unidade: c.dataset.u, torre: c.dataset.b || 'ÚNICA', incorporadora: emp?.incorporadora || '', regra: emp?.regraPadrao || '' });
    });
  }
  upd(); return upd;
}

// ============================ TAXAS ============================
function vTaxas(el) {
  const adm = store.isAdmin();
  $('#topActions').innerHTML = adm ? '<button class="btn gold" id="bNovo">+ Nova regra</button>' : '';
  el.innerHTML = `<p class="muted">Quadro de taxas por projeto/modalidade. Cada venda escolhe uma regra; a comissão de cada cargo = VGV × %. A coluna <b>Diferença</b> compara a taxa anunciada com a soma dos cargos — valide antes de pagar.</p><div id="res"></div>`;
  function abrir(r0) {
    const r = r0 ? JSON.parse(JSON.stringify(r0)) : { cargos: {} }; const dis = adm ? '' : 'disabled';
    const b = openModal(`<div class="mh"><h2>${r0 ? esc(r.nome) : 'Nova regra'}</h2><button class="x" data-close>×</button></div><div class="mb"><div class="form">
      <label>Nome da regra<input class="in" data-v="nome" value="${esc(r.nome || '')}" ${dis}></label><label>Projeto<input class="in" data-v="projeto" value="${esc(r.projeto || '')}" ${dis}></label>
      <label>Modalidade<input class="in" data-v="modalidade" value="${esc(r.modalidade || '')}" ${dis}></label><label>Taxa anunciada (%)<input class="in" data-v="taxa" value="${String(r.taxa ?? '').replace('.', ',')}" ${dis}></label>
      <h4>% por cargo (sobre o VGV)</h4>${CARGOS.map(c => `<label>${c.label}<input class="in" data-c="${c.key}" value="${String(r.cargos[c.key] ?? '').replace('.', ',')}" ${dis}></label>`).join('')}
      <label class="s4">Observações<input class="in" data-v="obs" value="${esc(r.obs || '')}" ${dis}></label></div><div id="soma" class="mt"></div></div>
      <div class="mf">${r0 && adm ? '<button class="btn danger" id="bDel">Excluir</button>' : ''}<span class="space"></span><button class="btn" data-close>Fechar</button>${adm ? '<button class="btn gold" id="bSave">Salvar</button>' : ''}</div>`);
    const ler = () => { const o = { ...r, cargos: {} }; $$('[data-v]', b).forEach(i => o[i.dataset.v] = i.dataset.v === 'taxa' ? parseNum(i.value) || 0 : i.value.trim()); $$('[data-c]', b).forEach(i => o.cargos[i.dataset.c] = parseNum(i.value) || 0); return o; };
    const soma = () => { const o = ler(); const s = Object.values(o.cargos).reduce((a, x) => a + x, 0); $('#soma', b).innerHTML = `Soma dos cargos: <b>${pctf(s, 4)}</b> · Taxa: <b>${pctf(o.taxa, 4)}</b> · Diferença: <b style="color:${Math.abs(o.taxa - s) > 1e-6 ? 'var(--warn)' : 'var(--ok)'}">${pctf(o.taxa - s, 4)}</b>`; };
    b.oninput = soma; soma();
    $('#bSave', b) && ($('#bSave', b).onclick = async () => { const o = ler(); if (!o.nome) return toast('Informe o nome'); await save('regras', o); closeModal(); toast('Regra salva'); });
    $('#bDel', b) && ($('#bDel', b).onclick = async () => { if (D().vendas.some(v => v.regra === r.id)) return toast('Há vendas usando esta regra.'); if (await confirmar('Excluir regra?')) { await remove('regras', r.id); closeModal(); } });
  }
  $('#bNovo') && ($('#bNovo').onclick = () => abrir(null));
  function upd() {
    $('#res', el).innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Regra</th><th>Projeto</th><th>Modalidade</th><th class="n">Taxa</th>${CARGOS.map(c => `<th class="n">${c.label}</th>`).join('')}<th class="n">Soma</th><th class="n">Diferença</th><th class="n">Vendas</th></tr></thead><tbody>
    ${regrasVisiveis().map(r => { const s = CARGOS.reduce((a, c) => a + (Number(r.cargos?.[c.key]) || 0), 0); const dif = r.taxa - s; return `<tr class="click" data-id="${r.id}"><td><b>${esc(r.nome)}</b></td><td>${esc(r.projeto)}</td><td>${esc(r.modalidade)}</td><td class="n"><b>${pctf(r.taxa)}</b></td>${CARGOS.map(c => `<td class="n">${r.cargos?.[c.key] ? pctf(r.cargos[c.key]) : '<span class="muted">—</span>'}</td>`).join('')}<td class="n">${pctf(s)}</td><td class="n" style="color:${Math.abs(dif) > 1e-6 ? 'var(--warn)' : 'var(--ok)'}">${pctf(dif)}</td><td class="n">${vendasVis().filter(v => v.regra === r.id).length}</td></tr>`; }).join('')}</tbody></table></div>`;
    $$('tr[data-id]', el).forEach(t => t.onclick = () => abrir(D().regras.find(x => x.id === t.dataset.id)));
  }
  upd(); return upd;
}

// ============================ PAGAMENTOS ============================
const impostoPct = () => { const x = Number(store.config().imposto); return isNaN(x) || store.config().imposto == null ? IMPOSTO_PADRAO : x; };
function todosPagamentos(incluirPrevistos = false) {
  const imp = impostoPct(); const out = [];
  vendasVis().forEach(v => pagamentosDaVenda(v, D().regras, imp, incluirPrevistos).forEach(x => out.push(x)));
  return out;
}
function vPagamentos(el) {
  const F = Object.assign({ tipo: 'mes', sit: 'apagar', modo: 'pessoa', q: '', emp: '' }, store_get('fPag', {}));
  $('#topActions').innerHTML = '<button class="btn" id="bPdf">PDF</button><button class="btn" id="bExp">Excel</button>';
  el.innerHTML = `<div class="filters">${perHTML(F)}
    <label>Situação<select class="in" data-f="sit">${[['apagar', 'A pagar'], ['pago', 'Pagos'], ['todos', 'Todos (recebidos)'], ['previsto', 'Previstos (dinheiro ainda não entrou)']].map(([k, l]) => `<option value="${k}" ${F.sit === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Visão<select class="in" data-f="modo"><option value="pessoa" ${F.modo === 'pessoa' ? 'selected' : ''}>Por pessoa</option><option value="det" ${F.modo === 'det' ? 'selected' : ''}>Detalhado</option></select></label>
    <label>Empreendimento<select class="in" data-f="emp"><option value="">Todos</option>${[...new Set(vendasVis().filter(isVenda).map(v => v.empreendimento))].sort().map(x => `<option ${x === F.emp ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label>Pessoa<input class="in" data-f="q" value="${esc(F.q)}" list="dl-p" placeholder="todas"></label>${datalists()}
    <span class="space"></span>
    <div class="imp-box">Imposto descontado: <b id="impV">${pctf(impostoPct())}</b> ${store.isDono() ? '<button class="btn sm" id="bImp" type="button">Alterar</button>' : ''}</div>
  </div>
  <p class="muted small" style="margin-top:-4px">O pagamento de cada pessoa é liberado quando a parcela da comissão é marcada como <b>recebida</b> (na venda ou em Recebimentos). O período filtra pela data do recebimento.</p>
  <div id="res"></div>`;
  bindPer(el, F, () => { store_set('fPag', F); upd(); });
  $$('[data-f]', el).forEach(i => i.oninput = () => { F[i.dataset.f] = i.value; store_set('fPag', F); upd(); });
  $('#bImp', el) && ($('#bImp', el).onclick = () => {
    const b = openModal(`<div class="mh"><h2>Imposto descontado dos pagamentos</h2><button class="x" data-close>×</button></div><div class="mb"><p class="muted">Percentual único, aplicado a todos os participantes de todas as vendas.</p>
      <label class="lbl">Imposto (%)<input class="in" id="iv" value="${String(impostoPct()).replace('.', ',')}"></label></div><div class="mf"><button class="btn" data-close>Cancelar</button><button class="btn gold" id="ok">Salvar</button></div>`, 'sm');
    $('#ok', b).onclick = async () => { const x = parseNum($('#iv', b).value); if (x == null || x < 0 || x >= 100) return toast('Percentual inválido'); await save('config', { ...store.config(), id: 'geral', imposto: x }); closeModal(); toast('Imposto atualizado'); render(); };
  });
  let spec = null, linhas = [];
  async function marcar(lst, pago) {
    const porVenda = new Map(); lst.forEach(x => { if (!porVenda.has(x.venda.id)) porVenda.set(x.venda.id, []); porVenda.get(x.venda.id).push(x); });
    const upds = [...porVenda.entries()].map(([id, xs]) => { const v = D().vendas.find(z => z.id === id); const pg = { ...(v.pagamentos || {}) }; xs.forEach(x => { pg[x.key] = pago ? { pago: true, data: hoje(), por: store.me.nome, liquido: x.liquido } : undefined; if (!pago) delete pg[x.key]; }); return { ...v, pagamentos: pg, parcelas: (v.parcelas || []).map((p, i) => ({ ...p, id: p.id || 'x' + i })) }; });
    await saveMany('vendas', upds); toast(pago ? `${lst.length} pagamento(s) marcados como pagos` : 'Pagamento desfeito');
  }
  function upd() {
    const R = perRange(F), q = up(F.q);
    let all = todosPagamentos(F.sit === 'previsto');
    all = all.filter(x => (!F.emp || x.venda.empreendimento === F.emp) && (!q || up(x.pessoa).includes(q)) && (F.tipo === 'tudo' || noPeriodo(x.competencia, R)));
    const rec = all.filter(x => x.recebido);
    linhas = F.sit === 'apagar' ? rec.filter(x => !x.pago) : F.sit === 'pago' ? rec.filter(x => x.pago) : F.sit === 'previsto' ? all.filter(x => !x.recebido) : rec;
    linhas.sort((a, b) => (a.competencia + a.pessoa).localeCompare(b.competencia + b.pessoa));
    const S = (a, k) => a.reduce((s, x) => s + x[k], 0);
    const kp = `<div class="kpis">
      <div class="kpi hl"><div class="l">Líquido a pagar</div><div class="v">${brlc(S(rec.filter(x => !x.pago), 'liquido'))}</div><div class="s">${rec.filter(x => !x.pago).length} lançamento(s)</div></div>
      <div class="kpi"><div class="l">Comissão recebida (bruto)</div><div class="v">${brlc(S(rec, 'bruto'))}</div><div class="s">${perLabel(F)}</div></div>
      <div class="kpi"><div class="l">Imposto (${pctf(impostoPct())})</div><div class="v">${brlc(S(rec, 'imposto'))}</div></div>
      <div class="kpi"><div class="l">Já pago</div><div class="v" style="color:var(--ok)">${brlc(S(rec.filter(x => x.pago), 'liquido'))}</div></div>
      ${F.sit === 'previsto' ? `<div class="kpi"><div class="l">Previsto (não recebido)</div><div class="v">${brlc(S(all.filter(x => !x.recebido), 'liquido'))}</div><div class="s">líquido</div></div>` : ''}</div>`;
    const stTag = (x) => !x.recebido ? '<span class="tag">aguardando recebimento</span>' : x.pago ? `<span class="tag ok">pago ${fd(x.dataPago)}</span>` : '<span class="tag warn">a pagar</span>';
    if (F.modo === 'pessoa') {
      const P = {}; linhas.forEach(x => { const p = P[x.pessoa] = P[x.pessoa] || { nome: x.pessoa, n: 0, bruto: 0, imposto: 0, liquido: 0, pago: 0, apagar: 0, itens: [] }; p.n++; p.bruto += x.bruto; p.imposto += x.imposto; p.liquido += x.liquido; if (x.pago) p.pago += x.liquido; else if (x.recebido) p.apagar += x.liquido; p.itens.push(x); });
      const ps = Object.values(P).sort((a, b) => b.liquido - a.liquido);
      $('#res', el).innerHTML = kp + `<div class="tbl-wrap"><table><thead><tr><th>Pessoa</th><th class="n">Lançamentos</th><th class="n">Bruto</th><th class="n">Imposto</th><th class="n">Líquido</th><th class="n">Pago</th><th class="n">A pagar</th><th></th></tr></thead><tbody>
        ${ps.map((p, i) => `<tr><td><span class="row">${avatar(p.nome, 'sm')} <b>${esc(p.nome)}</b></span></td><td class="n">${p.n}</td><td class="n">${brl(p.bruto)}</td><td class="n">${brl(p.imposto)}</td><td class="n"><b>${brl(p.liquido)}</b></td><td class="n">${p.pago ? brl(p.pago) : ''}</td><td class="n">${p.apagar ? `<b style="color:var(--warn)">${brl(p.apagar)}</b>` : ''}</td>
          <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-ext="${i}">Extrato PDF</button>${p.apagar ? `<button class="btn sm gold" data-pg="${i}">Marcar pago</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nada neste período/situação</td></tr>'}
        </tbody><tfoot><tr><td>Total</td><td class="n">${linhas.length}</td><td class="n">${brl(S(linhas, 'bruto'))}</td><td class="n">${brl(S(linhas, 'imposto'))}</td><td class="n">${brl(S(linhas, 'liquido'))}</td><td colspan="3"></td></tr></tfoot></table></div>`;
      $$('[data-ext]', el).forEach(bt => bt.onclick = () => extratoPag(ps[+bt.dataset.ext]));
      $$('[data-pg]', el).forEach(bt => bt.onclick = async () => { const p = ps[+bt.dataset.pg]; const lst = p.itens.filter(x => x.recebido && !x.pago); if (await confirmar(`Marcar ${lst.length} lançamento(s) de ${p.nome} como pagos (líquido ${brl(S(lst, 'liquido'))})?`)) marcar(lst, true); });
      spec = { titulo: 'Pagamentos por pessoa', cols: [['nome', 'Pessoa'], ['n', 'Lançamentos', 'n'], ['bruto', 'Bruto', 'brl'], ['imposto', 'Imposto', 'brl'], ['liquido', 'Líquido', 'brl'], ['pago', 'Pago', 'brl'], ['apagar', 'A pagar', 'brl']], rows: ps, totais: somar(ps, ['n', 'bruto', 'imposto', 'liquido', 'pago', 'apagar']), orient: 'portrait' };
    } else {
      $('#res', el).innerHTML = kp + `<div class="tbl-wrap" style="max-height:66vh"><table><thead><tr><th>${F.sit === 'previsto' ? 'Previsão' : 'Recebido em'}</th><th>Venda</th><th>Comprador</th><th>Parcela</th><th>Pessoa</th><th>Cargo</th><th class="n">Ref.</th><th class="n">Bruto</th><th class="n">Imposto</th><th class="n">Líquido</th><th>Situação</th><th></th></tr></thead><tbody>
        ${linhas.map((x, i) => `<tr><td>${fd(x.competencia)}</td><td class="click" data-vid="${x.venda.id}" style="cursor:pointer"><b>${esc(x.venda.empreendimento)}</b> · ${esc(x.venda.unidade)}</td><td>${esc(x.venda.cliente)}</td><td>${esc(x.parcela.serie || '')} ${esc(x.parcela.descricao || '')}</td><td>${esc(x.pessoa)}</td><td>${esc(x.cargo)}</td>
          <td class="n">${pctf(x.ref * 100)}</td><td class="n">${brl(x.bruto)}</td><td class="n">${brl(x.imposto)}</td><td class="n"><b>${brl(x.liquido)}</b></td><td>${stTag(x)}</td>
          <td>${x.recebido ? (x.pago ? `<button class="btn sm" data-un="${i}">Desfazer</button>` : `<button class="btn sm gold" data-p1="${i}">Pagar</button>`) : ''}</td></tr>`).join('') || '<tr><td colspan="12" class="empty">Nada neste período/situação</td></tr>'}
        </tbody><tfoot><tr><td colspan="7">Total</td><td class="n">${brl(S(linhas, 'bruto'))}</td><td class="n">${brl(S(linhas, 'imposto'))}</td><td class="n">${brl(S(linhas, 'liquido'))}</td><td colspan="2"></td></tr></tfoot></table></div>`;
      $$('[data-vid]', el).forEach(t => t.onclick = () => abrirVenda(D().vendas.find(v => v.id === t.dataset.vid)));
      $$('[data-p1]', el).forEach(bt => bt.onclick = () => marcar([linhas[+bt.dataset.p1]], true));
      $$('[data-un]', el).forEach(bt => bt.onclick = () => marcar([linhas[+bt.dataset.un]], false));
      spec = { titulo: 'Pagamentos detalhados', cols: [['d', F.sit === 'previsto' ? 'Previsão' : 'Recebido'], ['venda', 'Venda'], ['cli', 'Comprador'], ['parc', 'Parcela'], ['pessoa', 'Pessoa'], ['cargo', 'Cargo'], ['ref', 'Ref.', 'pct'], ['bruto', 'Bruto', 'brl'], ['imposto', 'Imposto', 'brl'], ['liquido', 'Líquido', 'brl'], ['st', 'Situação']],
        rows: linhas.map(x => ({ d: fd(x.competencia), venda: `${x.venda.empreendimento} · ${x.venda.unidade || ''}`, cli: x.venda.cliente, parc: `${x.parcela.serie || ''} ${x.parcela.descricao || ''}`, pessoa: x.pessoa, cargo: x.cargo, ref: x.ref * 100, bruto: x.bruto, imposto: x.imposto, liquido: x.liquido, st: !x.recebido ? 'Aguardando' : x.pago ? 'Pago ' + fd(x.dataPago) : 'A pagar' })) };
      spec.totais = somar(spec.rows, ['bruto', 'imposto', 'liquido']);
    }
    spec.sub = `Situação: ${{ apagar: 'a pagar', pago: 'pagos', todos: 'todos recebidos', previsto: 'previstos' }[F.sit]} · Período: ${perLabel(F)} · Imposto ${pctf(impostoPct())}${F.emp ? ' · ' + F.emp : ''}`;
    spec.resumo = [['Líquido a pagar', brlc(S(rec.filter(x => !x.pago), 'liquido'))], ['Bruto recebido', brlc(S(rec, 'bruto'))], ['Imposto', brlc(S(rec, 'imposto'))], ['Já pago', brlc(S(rec.filter(x => x.pago), 'liquido'))]];
  }
  function extratoPag(p) {
    const rows = p.itens.map(x => ({ d: fd(x.competencia), venda: `${x.venda.empreendimento} · ${x.venda.unidade || ''}`, cli: x.venda.cliente, parc: `${x.parcela.serie || ''} ${x.parcela.descricao || ''}`, cargo: x.cargo, ref: x.ref * 100, bruto: x.bruto, imposto: x.imposto, liquido: x.liquido, st: !x.recebido ? 'Aguardando' : x.pago ? 'Pago ' + fd(x.dataPago) : 'A pagar' }));
    const pp = pessoaPorNome(p.nome);
    gerarPDF({ titulo: 'Extrato de pagamento', orient: 'landscape', nome: `pagamento_${p.nome}_${hoje()}`,
      sub: `${p.nome}${pp?.nomeCompleto ? ' · ' + pp.nomeCompleto : ''}${pp?.pix ? ' · PIX ' + pp.pix : ''} · Período: ${perLabel(F)} · Imposto ${pctf(impostoPct())}`,
      resumo: [['Líquido', brl(p.liquido)], ['Bruto', brl(p.bruto)], ['Imposto', brl(p.imposto)], ['A pagar', brl(p.apagar)]],
      cols: [['d', 'Recebido'], ['venda', 'Venda'], ['cli', 'Comprador'], ['parc', 'Parcela'], ['cargo', 'Cargo'], ['ref', 'Ref.', 'pct'], ['bruto', 'Bruto', 'brl'], ['imposto', 'Imposto', 'brl'], ['liquido', 'Líquido', 'brl'], ['st', 'Situação']], rows, totais: somar(rows, ['bruto', 'imposto', 'liquido']) });
  }
  $('#bPdf').onclick = () => spec && gerarPDF({ ...spec, nome: 'pagamentos_' + hoje() });
  $('#bExp').onclick = () => exportXlsx(linhas.map(x => ({ COMPETENCIA: fd(x.competencia), EMPREENDIMENTO: x.venda.empreendimento, UNIDADE: x.venda.unidade, COMPRADOR: x.venda.cliente, SERIE: x.parcela.serie, PARCELA: x.parcela.descricao, VALOR_PARCELA: x.parcela.valor, PESSOA: x.pessoa, CARGO: x.cargo, REFERENCIA: round2(x.ref * 100), BRUTO: x.bruto, IMPOSTO: x.imposto, LIQUIDO: x.liquido, SITUACAO: !x.recebido ? 'AGUARDANDO' : x.pago ? 'PAGO' : 'A PAGAR', DATA_PAGO: fd(x.dataPago) })), 'pagamentos_' + hoje());
  upd(); return upd;
}

// ============================ LIBERAÇÕES (administrador) ============================
function vLiberacoes(el) {
  el.innerHTML = '<div id="res"></div>';
  function upd() {
    const us = D().users; const pend = us.filter(u => u.pendente); const ativos = us.filter(u => u.ativo !== false);
    const porPapel = Object.entries(PAPEIS).map(([k, l]) => [l, ativos.filter(u => u.papel === k).length]).filter(x => x[1]);
    $('#res', el).innerHTML = `<div class="kpis"><div class="kpi hl"><div class="l">Usuários ativos</div><div class="v">${ativos.length}</div><div class="s">base para cobrança</div></div>
      <div class="kpi"><div class="l">Aguardando liberação</div><div class="v" style="color:${pend.length ? 'var(--warn)' : 'inherit'}">${pend.length}</div></div>
      ${porPapel.map(([l, n]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${n}</div></div>`).join('')}</div>
      <div class="card"><h3>Pedidos de cadastro</h3>
      ${pend.length ? pend.map(u => `<div class="list-person">${avatar(u, 'md')}<div style="flex:1"><b>${esc(u.nome)}</b> · ${esc(u.email)}<div class="muted small">${PAPEIS[u.papel] || u.papel}${u.pessoa ? ' · ' + esc(u.pessoa) : ''} · ${empsTexto(u)} · solicitado por ${esc(u.solicitadoPor || '—')} em ${u.solicitadoEm ? new Date(u.solicitadoEm).toLocaleString('pt-BR') : '—'}</div></div>
        <button class="btn danger sm" data-rec="${u.id}">Recusar</button><button class="btn gold sm" data-lib="${u.id}">Liberar</button></div>`).join('') : '<div class="muted">Nenhum pedido pendente.</div>'}</div>
      <div class="card mt"><h3>Usuários ativos</h3><div class="tbl-wrap"><table><thead><tr><th>Usuário</th><th>E-mail</th><th>Papel</th><th>Liberado por</th><th>Em</th></tr></thead><tbody>
      ${ativos.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(u => `<tr><td><span class="row">${avatar(u, 'sm')} ${esc(u.nome)}</span></td><td>${esc(u.email)}</td><td>${PAPEIS[u.papel] || u.papel}</td><td>${esc(u.liberadoPor || '')}</td><td>${u.liberadoEm ? fd(u.liberadoEm.slice(0, 10)) : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-lib]', el).forEach(bt => bt.onclick = async () => { await liberarUsuario(bt.dataset.lib, true); toast('Usuário liberado'); renderShell(); });
    $$('[data-rec]', el).forEach(bt => bt.onclick = async () => { if (await confirmar('Recusar este cadastro? O usuário não terá acesso.')) { await liberarUsuario(bt.dataset.rec, false); toast('Cadastro recusado'); renderShell(); } });
  }
  upd(); return upd;
}

// ============================ USUÁRIOS ============================
function listaEmps() { return [...new Map([...D().empreendimentos.map(e => [slug(e.nome), e.nome]), ...D().vendas.map(v => [slug(v.empreendimento), v.empreendimento])].filter(x => x[0])).entries()].sort((a, b) => a[1].localeCompare(b[1])); }
function empsTexto(u) {
  if (['admin', 'master'].includes(u.papel) || u.empTodos) return '<span class="tag ok">Todos</span>';
  const m = new Map(listaEmps()); const l = (u.emps || []).map(e => m.get(e) || e);
  return l.length ? l.map(x => `<span class="tag">${esc(x)}</span>`).join('') : '<span class="tag bad">Nenhum</span>';
}
function vUsuarios(el) {
  $('#topActions').innerHTML = '<button class="btn gold" id="bNovo">+ Novo usuário</button>';
  el.innerHTML = `<div id="avUsr">${htmlAvisoUsuario()}</div><p class="muted">Papéis: <b>Administrador do sistema</b> libera novos cadastros e altera o imposto · <b>Master</b> vê e administra tudo (novos usuários precisam de liberação) · <b>Diretor</b> vê todas as vendas <i>dos empreendimentos liberados</i> · <b>Gerente</b> vê as vendas da equipe dele · <b>Corretor</b> vê só as próprias vendas e comissões.<br>
  Para cada usuário (menos master) escolha os <b>empreendimentos/projetos</b> que ele pode acessar — vendas, funil, agenda, comissões e recebimentos de outros projetos ficam invisíveis para ele.</p><div id="res"></div>`;
  function abrir(u0) {
    const u = u0 ? { ...u0, emps: [...(u0.emps || [])] } : { papel: 'corretor', ativo: true, foto: '', empTodos: false, emps: [] };
    const emps = listaEmps();
    const b = openModal(`<div class="mh"><h2>${u0 ? 'Editar usuário' : 'Novo usuário'}</h2><button class="x" data-close>×</button></div><div class="mb">${u0 ? '' : htmlAvisoUsuario()}
      <div class="photo-pick"><span id="ph">${avatar(u, 'xl')}</span><div><input type="file" accept="image/*" id="fFoto"><div class="muted small">A foto é recortada em círculo e reduzida automaticamente.</div>${u.foto ? '<button class="btn sm mt" id="rmFoto">Remover foto</button>' : ''}</div></div>
      <div class="form mt"><label class="s2">Nome<input class="in" data-v="nome" value="${esc(u.nome || '')}"></label>
      <label class="s2">E-mail (login)<input class="in" data-v="email" type="email" value="${esc(u.email || '')}" ${u0 ? 'readonly' : ''} autocomplete="off"></label>
      ${u0 ? '<label class="s2">Senha<button class="btn" id="bReset" type="button">Enviar link para redefinir a senha</button></label>' : '<label class="s2">Senha inicial (opcional)<input class="in" data-v="senha" type="text" autocomplete="off" placeholder="em branco = o usuário recebe e-mail para criar a senha"></label>'}
      <label>Papel<select class="in" data-v="papel" ${u.papel === 'admin' && !store.isDono() ? 'disabled' : ''}>${Object.entries(PAPEIS).filter(([k]) => k !== 'admin' || store.isDono() || u.papel === 'admin').map(([k, l]) => `<option value="${k}" ${k === u.papel ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="s2">Pessoa vinculada (cadastro)<select class="in" data-v="pessoa"><option value="">—</option>${D().pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(p => `<option ${up(p.nome) === up(u.pessoa) ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      <label>Situação${u.pendente ? '<span class="tag warn" style="margin-top:6px">Aguardando liberação do administrador</span><input type="hidden" data-v="ativo" value="false">' : `<select class="in" data-v="ativo"><option value="true">Ativo</option><option value="false" ${u.ativo === false ? 'selected' : ''}>Inativo (bloqueado)</option></select>`}</label>
      ${!store.isDono() && !u0 ? '<div class="s4 tag warn" style="padding:8px">Este cadastro será enviado para <b>liberação do administrador do sistema</b> antes de o usuário conseguir entrar.</div>' : ''}
      <h4>Empreendimentos / projetos que pode acessar</h4>
      <div class="s4" id="empBox">
        <label class="chk-all"><input type="checkbox" id="empTodos" ${u.empTodos ? 'checked' : ''}> <b>Todos os empreendimentos</b> (inclusive os que forem cadastrados no futuro)</label>
        <div id="empList" class="emp-grid mt">${emps.map(([k, n]) => `<label class="emp-chk"><input type="checkbox" value="${k}" ${u.emps.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>
        <div class="row mt small"><button class="btn sm" type="button" id="mAll">Marcar todos</button><button class="btn sm" type="button" id="mNone">Desmarcar</button></div>
      </div>
      <div class="s4 muted small" id="empMaster">Usuário master sempre acessa todos os empreendimentos.</div>
      </div></div>
      <div class="mf">${u0 && u0.id !== store.uid ? '<button class="btn danger" id="bDelU">Excluir</button>' : ''}<span class="space"></span><button class="btn" data-close>Fechar</button><button class="btn gold" id="bSave">Salvar</button></div>`);
    const sync = () => { const master = $('[data-v="papel"]', b).value === 'master'; $('#empBox', b).classList.toggle('hidden', master); $('#empMaster', b).classList.toggle('hidden', !master); const t = $('#empTodos', b).checked; $('#empList', b).style.opacity = t ? .4 : 1; $$('#empList input', b).forEach(i => i.disabled = t); };
    $('[data-v="papel"]', b).onchange = sync; $('#empTodos', b).onchange = sync; sync();
    $('#mAll', b).onclick = () => $$('#empList input', b).forEach(i => i.checked = true);
    $('#mNone', b).onclick = () => $$('#empList input', b).forEach(i => i.checked = false);
    $('#bReset', b) && ($('#bReset', b).onclick = async () => { try { const r = await resetSenha(u.email); toast(r === 'demo' ? 'Demonstração: na versão real o link vai para ' + u.email : 'Link de redefinição enviado para ' + u.email); } catch (e) { toast(e.message); } });
    $('#bDelU', b) && ($('#bDelU', b).onclick = async () => { if (!(await confirmar('Excluir o cadastro deste usuário no sistema? (No Firebase, apague também em Authentication › Usuários)'))) return; await remove('users', u0.id); closeModal(); toast('Usuário excluído'); });
    $('#fFoto', b).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; u.foto = await fotoDeArquivo(f); $('#ph', b).innerHTML = avatar(u, 'xl'); };
    $('#rmFoto', b) && ($('#rmFoto', b).onclick = () => { u.foto = ''; $('#ph', b).innerHTML = avatar({ nome: u.nome }, 'xl'); });
    $('#bSave', b).onclick = async () => {
      const o = {}; $$('[data-v]', b).forEach(i => o[i.dataset.v] = i.dataset.v === 'ativo' ? i.value === 'true' : i.value.trim());
      o.empTodos = ['admin', 'master'].includes(o.papel) || $('#empTodos', b).checked;
      o.emps = o.empTodos ? [] : $$('#empList input:checked', b).map(i => i.value);
      if (!o.nome) return toast('Informe o nome');
      if (!o.empTodos && !o.emps.length && !(await confirmar('Nenhum empreendimento marcado: o usuário não verá nenhuma venda. Salvar assim mesmo?'))) return;
      try {
        if (u0) {
          if (u0.id === store.uid && (o.papel !== 'master' || !o.ativo)) return toast('Você não pode rebaixar/desativar o próprio usuário master');
          if (u0.papel === 'admin' && !store.isDono()) return toast('Só o administrador do sistema altera este usuário');
          const campos = { nome: o.nome, papel: o.papel, pessoa: o.pessoa, ativo: o.ativo, foto: u.foto || '', empTodos: o.empTodos, emps: o.emps };
          let msg = 'Usuário salvo';
          if (!store.isDono() && o.ativo && u0.ativo === false && !u0.pendente) { campos.ativo = false; campos.pendente = true; campos.solicitadoPor = store.me.nome; campos.solicitadoEm = new Date().toISOString(); msg = 'Reativação enviada para liberação do administrador'; }
          if (u0.pendente) { campos.ativo = false; delete campos.ativo; }
          await updateUser(u0.id, campos);
          closeModal(); toast(msg);
        } else {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)) return toast('Informe um e-mail válido');
          if (o.senha && o.senha.length < 6) return toast('Senha com no mínimo 6 caracteres');
          const r = await createUser({ ...o, foto: u.foto || (/guig/i.test(o.nome) ? 'img/guigao.jpg' : '') });
          closeModal(); toast(r.pendente ? 'Cadastro enviado para liberação do administrador do sistema' : r.enviarLink ? `Usuário criado. Enviamos um e-mail para ${o.email} criar a senha.` : 'Usuário criado');
        }
        renderShell();
      } catch (e) { toast(e.code === 'auth/email-already-in-use' ? 'Esse e-mail já existe no Firebase' : (e.message || 'Erro')); }
    };
  }
  $('#bNovo').onclick = () => abrir(null);
  function upd() {
    $('#res', el).innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Usuário</th><th>E-mail</th><th>Papel</th><th>Pessoa vinculada</th><th>Empreendimentos</th><th>Situação</th>${store.isDono() ? '<th>Acesso</th>' : ''}</tr></thead><tbody>
    ${D().users.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(u => `<tr class="click" data-id="${u.id}"><td><span class="row">${avatar(u, 'md')} <b>${esc(u.nome)}</b></span></td><td>${esc(u.email || u.usuario)}</td><td>${PAPEIS[u.papel] || u.papel}</td><td>${esc(u.pessoa)}</td><td style="white-space:normal;max-width:340px">${empsTexto(u)}</td><td>${u.pendente ? '<span class="tag warn">Aguardando liberação</span>' : u.recusado ? '<span class="tag bad">Recusado</span>' : u.ativo === false ? '<span class="tag bad">Inativo</span>' : '<span class="tag ok">Ativo</span>'}${u.bloqueado ? ' <span class="tag bad">Bloqueado</span>' : ''}</td>${store.isDono() ? `<td>${u.papel === 'admin' ? '<span class="muted small">—</span>' : `<button class="btn sm ${u.bloqueado ? 'gold' : 'danger'}" data-bloq="${u.id}" type="button">${u.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    $$('tr[data-id]', el).forEach(t => t.onclick = (e) => { if (e.target.closest('[data-bloq]')) return; abrir(D().users.find(x => x.id === t.dataset.id)); });
    $$('[data-bloq]', el).forEach(bt => bt.onclick = async (e) => { e.stopPropagation(); const u = D().users.find(x => x.id === bt.dataset.bloq); if (!u) return; const novo = !u.bloqueado;
      if (novo && !(await confirmar(`Bloquear o acesso de ${u.nome} por falta de pagamento? Ele será desconectado e não conseguirá entrar até você desbloquear.`))) return;
      await updateUser(u.id, { bloqueado: novo, bloqueadoEm: novo ? new Date().toISOString() : '', bloqueadoPor: novo ? store.me.nome : '' }); toast(novo ? `${u.nome} bloqueado` : `${u.nome} desbloqueado`); });
  }
  upd(); return () => { const av = $('#avUsr', el); if (av) av.innerHTML = htmlAvisoUsuario(); upd(); };
}

// ============================ PERFIL ============================
function vPerfil(el) {
  const me = store.me;
  el.innerHTML = `<div class="cols2e"><div class="card"><h3>Minha foto e nome</h3>
    <div class="photo-pick"><span id="ph">${avatar(me, 'xl')}</span><div><input type="file" accept="image/*" id="fFoto"><div class="muted small">Aparece no menu lateral e nos relatórios.</div></div></div>
    <div class="form mt" style="grid-template-columns:1fr"><label>Nome exibido<input class="in" id="pNome" value="${esc(me.nome || '')}"></label>
    <div class="muted small">E-mail: <b>${esc(me.email || me.usuario)}</b> · Papel: <b>${PAPEIS[me.papel]}</b> ${me.pessoa ? `· Pessoa: <b>${esc(me.pessoa)}</b>` : ''}</div></div>
    <div class="row mt"><button class="btn gold" id="bSaveP">Salvar</button></div></div>
    <div class="card"><h3>Trocar senha</h3><div class="form" style="grid-template-columns:1fr">
      <label>Senha atual<input class="in" type="password" id="s0" autocomplete="current-password"></label><label>Nova senha<input class="in" type="password" id="s1" autocomplete="new-password"></label><label>Repetir nova senha<input class="in" type="password" id="s2" autocomplete="new-password"></label></div>
      <div class="row mt"><button class="btn dark" id="bSenha">Alterar senha</button></div></div></div>
    ${store.isDono() ? `<div class="card mt"><h3>Cobrança e bloqueio (só administrador)</h3>
      <label class="chk"><input type="checkbox" id="avU" ${avisoCfg().usuario ? 'checked' : ''}><span>Mostrar aviso de custo por usuário na tela <b>Usuários</b> (cadastro de usuário)</span></label>
      <label class="chk mt"><input type="checkbox" id="avB" ${avisoCfg().bloqueio ? 'checked' : ''}><span>Mostrar pop-up de <b>bloqueio por falta de pagamento</b> para o master (aparece em toda tela e a cada atualização)</span></label>
      <label class="chk mt"><input type="checkbox" id="avG" ${store.config().bloqueioGeral ? 'checked' : ''}><span><b style="color:#b3261e">BLOQUEAR O ACESSO DE TODOS</b> por falta de pagamento (menos o administrador). Para bloquear só uma pessoa, use o botão <b>Bloquear</b> na tela Usuários.</span></label>
      <div class="form mt"><label>Chave PIX / banco<input class="in" id="avPix" value="${esc(avisoCfg().pix)}"></label><label>Valor por usuário (R$)<input class="in" id="avVal" value="${esc(avisoCfg().valor)}"></label></div>
      <div class="row mt"><button class="btn gold" id="bAvisos">Salvar avisos</button></div></div>` : ''}
    ${store.demo ? '<div class="card mt"><h3>Modo demonstração</h3><p class="muted">Os dados estão só neste navegador. Configure o Firebase (veja o README) para usar de verdade.</p><button class="btn danger" id="bReset">Restaurar dados de demonstração</button></div>' : ''}`;
  let foto = me.foto || '';
  $('#fFoto', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; foto = await fotoDeArquivo(f); $('#ph', el).innerHTML = avatar({ nome: me.nome, foto }, 'xl'); };
  $('#bSaveP', el).onclick = async () => { await updateUser(store.uid, { nome: $('#pNome', el).value.trim() || me.nome, foto }); renderShell(); toast('Perfil atualizado'); };
  $('#bSenha', el).onclick = async () => { const a = $('#s0', el).value, n = $('#s1', el).value; if (n.length < 6) return toast('Mínimo 6 caracteres'); if (n !== $('#s2', el).value) return toast('As senhas não conferem'); try { await changePassword(a, n); toast('Senha alterada'); $$('input[type=password]', el).forEach(i => i.value = ''); } catch (e) { toast(e.message); } };
  $('#bAvisos', el) && ($('#bAvisos', el).onclick = async () => { const g = $('#avG', el).checked; if (g && !store.config().bloqueioGeral && !(await confirmar('Bloquear o acesso de TODOS os usuários (menos você)? Todos serão desconectados até você desmarcar.'))) return; await save('config', { ...store.config(), id: 'geral', bloqueioGeral: g, avisoUsuario: $('#avU', el).checked, avisoBloqueio: $('#avB', el).checked, pix: $('#avPix', el).value.trim() || PIX_PADRAO, valorUsuario: $('#avVal', el).value.trim() || '50,00' }); toast('Avisos salvos'); });
  $('#bReset', el) && ($('#bReset', el).onclick = async () => (await confirmar('Apagar tudo e voltar aos dados de demonstração?')) && resetDemo());
  let mexeu = false; ['#avU', '#avB', '#avG', '#avPix', '#avVal'].forEach(q => { const i = $(q, el); if (i) i.addEventListener('input', () => mexeu = true); });
  return () => { if (mexeu || !$('#avU', el)) return; const a = avisoCfg(); $('#avU', el).checked = a.usuario; $('#avB', el).checked = a.bloqueio; $('#avG', el).checked = !!store.config().bloqueioGeral; $('#avPix', el).value = a.pix; $('#avVal', el).value = a.valor; };
}

// ============================ IMPORTAR ============================
function baixarBackup(sufixo = '') {
  const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), ...Object.fromEntries(['vendas', 'pessoas', 'regras', 'empreendimentos', 'agendamentos'].map(c => [c, D()[c]])) }, null, 1)], { type: 'application/json' });
  return salvarArquivo(`praes_backup_${hoje()}${sufixo ? '_' + sufixo : ''}.json`, blob);
}
function vImportar(el) {
  el.innerHTML = `<div class="cols2e">
  <div class="card"><h3>1. Base inicial (planilhas recebidas)</h3><p class="muted">Carrega as ${window.PRAES_SEED?.vendas.length || 0} vendas, ${window.PRAES_SEED?.pessoas.length || 0} pessoas, ${window.PRAES_SEED?.regras.length || 0} regras do quadro de taxas e ${window.PRAES_SEED?.empreendimentos.length || 0} empreendimentos já tratados a partir das planilhas <i>A3 GERAL</i> e <i>Central Controle Comercial 2026</i>. Use uma única vez, no início.</p>
    <button class="btn gold" id="bSeed">Carregar base inicial</button><div id="seedMsg" class="muted small mt"></div></div>
  <div class="card"><h3>2. Importar planilha Excel</h3><p class="muted">Mesmo layout da aba BASE / LANÇAMENTOS: <code>DATA, EMPREEND., UNID., TORRE, INCORP., CADASTRO, CORRETOR, EQUIPE, DIRETORIA, VGV, ASSESSORIA RESP., STATUS, DATA STATUS, DATA VENDA, FINANCEIRO, OBSERVAÇÃO</code> (+ opcional <code>REGRA DE TAXAS</code>, <code>CLIENTE</code>). Registros com o mesmo CADASTRO + EMPREEND. + UNID. são atualizados; os demais são criados.</p>
    <input type="file" id="fx" accept=".xlsx,.xls,.csv"> <select class="in hidden" id="fxSheet"></select><div id="fxMsg" class="mt"></div></div>
  <div class="card"><h3>3. Exportar / backup</h3><p class="muted">Baixe uma cópia completa dos dados.</p><div class="row"><button class="btn" id="bJson">Backup completo (JSON)</button><button class="btn" id="bX">Vendas (Excel)</button></div></div>
  <div class="card"><h3>4. Renomear / juntar pessoa</h3><p class="muted">Corrige nomes duplicados (ex.: JACYNTO → JACINTHO) em todas as vendas e agendamentos.</p>${datalists()}
    <div class="row"><input class="in" id="rnDe" list="dl-p" placeholder="de"><span>→</span><input class="in" id="rnPara" list="dl-p" placeholder="para"><button class="btn" id="bRn">Aplicar</button></div></div></div>
  <div class="card mt danger-card"><h3>5. Zerar o banco de dados <small>· começar do zero</small></h3>
    <p class="muted">Apaga definitivamente os registros escolhidos para começar a lançar tudo do zero. <b>Os usuários e logins não são apagados.</b> Antes de apagar, o sistema baixa automaticamente um backup completo (JSON).</p>
    <div class="emp-grid">${[['vendas', 'Vendas / cadastros CV', true], ['agendamentos', 'Agendamentos', true], ['pessoas', 'Corretores / equipe', false], ['empreendimentos', 'Empreendimentos', false], ['regras', 'Quadro de taxas', false]].map(([k, l, c]) => `<label class="emp-chk"><input type="checkbox" data-zc="${k}" ${c ? 'checked' : ''}> ${l} <span class="muted small">(${(D()[k] || []).length})</span></label>`).join('')}</div>
    <div class="row mt"><label class="small muted">Para confirmar, digite <b>APAGAR</b>: <input class="in" id="zConf" style="width:120px"></label><button class="btn danger" id="bZerar">Apagar dados selecionados</button><span id="zMsg" class="muted small"></span></div></div>`;
  $('#bZerar', el).onclick = async () => {
    const cols = $$('[data-zc]', el).filter(i => i.checked).map(i => i.dataset.zc);
    if (!cols.length) return toast('Marque o que deseja apagar');
    if ($('#zConf', el).value.trim().toUpperCase() !== 'APAGAR') return toast('Digite APAGAR para confirmar');
    if (!(await confirmar(`ATENÇÃO: isso apaga definitivamente: ${cols.join(', ')}.\nUm backup será baixado antes. Continuar?`))) return;
    await baixarBackup('antes_de_zerar');
    const m = $('#zMsg', el); m.textContent = 'Apagando…';
    try { await limparColecoes(cols, (c, a, t) => m.textContent = `${c}: ${a}/${t}…`); m.textContent = ''; toast('Dados apagados. Sistema pronto para começar do zero.'); render(); }
    catch (e) { m.textContent = 'Erro: ' + e.message; }
  };
  $('#bSeed', el).onclick = async () => {
    const S = window.PRAES_SEED; if (!S) return;
    if (D().vendas.length && !(await confirmar(`Já existem ${D().vendas.length} vendas. Carregar a base inicial vai sobrescrever registros com o mesmo código. Continuar?`))) return;
    const m = $('#seedMsg', el); m.textContent = 'Gravando…';
    try {
      await saveMany('regras', S.regras); await saveMany('empreendimentos', S.empreendimentos); await saveMany('pessoas', S.pessoas);
      await saveMany('vendas', S.vendas, (a, t) => m.textContent = `Vendas ${a}/${t}…`);
      m.textContent = 'Base inicial carregada ✔'; toast('Base carregada');
    } catch (e) { m.textContent = 'Erro: ' + e.message; }
  };
  let wb = null;
  $('#fx', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; wb = XLSX.read(await f.arrayBuffer(), { cellDates: true }); const s = $('#fxSheet', el); s.innerHTML = wb.SheetNames.map(n => `<option ${/BASE|LANÇ/i.test(n) ? 'selected' : ''}>${esc(n)}</option>`).join(''); s.classList.remove('hidden'); s.onchange = analisar; analisar(); };
  function analisar() {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[$('#fxSheet', el).value], { defval: '', raw: true }).map(r => Object.fromEntries(Object.entries(r).map(([k, x]) => [k.trim().toUpperCase(), x])));
    const ST = { 'APROVADA': 'APROVADO', 'APROV. COND.': 'APROVADO COND.', 'REPROVADA': 'REPROVADO' };
    const dt = (x) => x instanceof Date ? iso(new Date(x.getTime() + 12 * 3600e3)) : (typeof x === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(x.trim()) ? x.trim().split('/').reverse().join('-') : (typeof x === 'number' && x > 30000 ? iso(new Date(Math.round((x - 25569) * 864e5) + 12 * 3600e3)) : ''));
    const cl = (x) => { const s = String(x ?? '').trim(); return ['?', '-'].includes(s) ? '' : s; };
    const rg = (n) => D().regras.find(r => up(r.nome) === up(n))?.id || '';
    const g = (r, ...ks) => { for (const k of ks) if (r[k] !== undefined) return r[k]; return ''; };
    const vs = rows.filter(r => cl(g(r, 'EMPREEND.', 'EMPREENDIMENTO'))).map(r => {
      let st = up(cl(r['STATUS'])); st = ST[st] || st; const vr = g(r, 'VGV'); let vgv = typeof vr === 'number' ? vr : parseNum(cl(vr)); let obs = cl(g(r, 'OBSERVAÇÃO', 'OBSERVACAO'));
      if (up(vr) === 'CAIU') { st = 'CAIU'; vgv = null; }
      const fin = up(cl(r['FINANCEIRO'])); const un = String(cl(g(r, 'UNID.', 'UNIDADE'))).replace(/\.0$/, '');
      return { data: dt(r['DATA']), empreendimento: up(cl(g(r, 'EMPREEND.', 'EMPREENDIMENTO'))), unidade: un, torre: up(cl(r['TORRE'])).replace('ÙNICA', 'ÚNICA'), incorporadora: up(cl(g(r, 'INCORP.', 'INCORPORADORA'))), cadastro: cl(r['CADASTRO']), cliente: cl(r['CLIENTE']),
        corretor: canon(cl(r['CORRETOR'])), gerente: canon(cl(g(r, 'EQUIPE', 'GERENTE'))), diretor: canon(cl(r['DIRETORIA'])), vgv: vgv ?? null, assessoria: up(cl(g(r, 'ASSESSORIA RESP.', 'ASSESSORIA'))), status: st,
        dataStatus: dt(r['DATA STATUS']), dataVenda: dt(r['DATA VENDA']), financeiro: { PG: 'PAGO', 'PAGO': 'PAGO' }[fin] || fin, obs, regra: rg(cl(g(r, 'REGRA DE TAXAS', 'REGRA'))) };
    });
    const key = (v) => [v.cadastro, v.empreendimento, v.unidade].join('|');
    const ex = new Map(D().vendas.map(v => [key(v), v]));
    const upd = vs.filter(v => ex.has(key(v))).length;
    const novasP = [...new Set(vs.flatMap(v => [v.corretor, v.gerente, v.diretor]).filter(n => n && !IGNORAR.includes(n) && !pessoaPorNome(n)))];
    $('#fxMsg', el).innerHTML = `<div class="tag ok">${vs.length} linhas lidas</div> <span class="tag">${vs.length - upd} novas</span> <span class="tag">${upd} atualizações</span> <span class="tag warn">${novasP.length} pessoas novas</span>
      <div class="row mt"><button class="btn gold" id="bImp">Importar agora</button></div>`;
    $('#bImp', el).onclick = async () => {
      const lst = vs.map(v => { const o = ex.get(key(v)); return o ? { ...o, ...v, regra: v.regra || o.regra, cliente: v.cliente || o.cliente, corpo: o.corpo || {}, parcelas: o.parcelas || [] } : { ...v, corpo: {}, parcelas: [] }; });
      await saveMany('pessoas', novasP.map(n => ({ nome: n, apelido: n, cargo: vs.some(v => v.diretor === n) ? 'DIRETOR' : vs.some(v => v.gerente === n) ? 'GERENTE' : 'CORRETOR', gerente: '', diretor: '', tipo: 'PF', ativo: true })));
      const ne = [...new Set(vs.map(v => v.empreendimento))].filter(n => !D().empreendimentos.some(e => e.nome === n));
      await saveMany('empreendimentos', ne.map(n => ({ nome: n, incorporadora: vs.find(v => v.empreendimento === n)?.incorporadora || '', regraPadrao: '', ativo: true })));
      await saveMany('vendas', lst, (a, t) => $('#fxMsg', el).textContent = `Gravando ${a}/${t}…`);
      $('#fxMsg', el).innerHTML = '<span class="tag ok">Importação concluída ✔</span>'; toast('Importado');
    };
  }
  $('#bJson', el).onclick = () => baixarBackup();
  $('#bX', el).onclick = () => exportXlsx(D().vendas.map(v => ({ DATA: fd(v.data), 'EMPREEND.': v.empreendimento, 'UNID.': v.unidade, TORRE: v.torre, 'INCORP.': v.incorporadora, CADASTRO: v.cadastro, CLIENTE: v.cliente, CORRETOR: v.corretor, EQUIPE: v.gerente, DIRETORIA: v.diretor, VGV: Number(v.vgv) || null, 'ASSESSORIA RESP.': v.assessoria, STATUS: v.status, 'DATA STATUS': fd(v.dataStatus), 'DATA VENDA': fd(v.dataVenda), FINANCEIRO: v.financeiro, 'OBSERVAÇÃO': v.obs, 'REGRA DE TAXAS': D().regras.find(r => r.id === v.regra)?.nome || '' })), 'vendas_completo_' + hoje());
  $('#bRn', el).onclick = async () => {
    const de = up($('#rnDe', el).value), para = up($('#rnPara', el).value); if (!de || !para || de === para) return;
    const fix = (o) => { let ch = false; for (const k of ['corretor', 'gerente', 'diretor']) if (o[k] === de) { o[k] = para; ch = true; } for (const k in (o.corpo || {})) if (o.corpo[k] === de) { o.corpo[k] = para; ch = true; } return ch; };
    const vs = D().vendas.map(v => ({ ...v, corpo: { ...(v.corpo || {}) } })).filter(fix); const ags = D().agendamentos.map(a => ({ ...a })).filter(fix);
    const ps = D().pessoas.map(p => ({ ...p })).filter(p => { let ch = false; if (p.gerente === de) { p.gerente = para; ch = true; } if (p.diretor === de) { p.diretor = para; ch = true; } return ch; });
    if (!(await confirmar(`Alterar ${de} → ${para} em ${vs.length} venda(s), ${ags.length} agendamento(s) e ${ps.length} cadastro(s)?`))) return;
    await saveMany('vendas', vs); await saveMany('agendamentos', ags); await saveMany('pessoas', ps);
    const old = pessoaPorNome(de), alvo = pessoaPorNome(para);
    if (alvo) await save('pessoas', { ...alvo, aliases: [...new Set([...(alvo.aliases || []), de, ...((old && old.aliases) || [])])] });
    if (old && alvo) await remove('pessoas', old.id); else if (old) { await save('pessoas', { ...old, id: undefined, nome: para, apelido: para, aliases: [...new Set([...(old.aliases || []), de])] }); await remove('pessoas', old.id); }
    toast('Nome atualizado');
  };
  return null;
}

// ============================ BOOT ============================
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault(); $('#lgErr').textContent = '';
  const btn = e.submitter || $('#loginForm button'); btn.disabled = true; btn.textContent = 'Entrando…';
  try { await login($('#lgUser').value, $('#lgPass').value); } catch (er) { $('#lgErr').textContent = er.message; $('#lgErr').classList.toggle('bloq', /bloqueado/i.test(er.message)); }
  btn.disabled = false; btn.textContent = 'Entrar';
};
$('#btnSair').onclick = () => logout();
$('#lgEsqueci').onclick = async () => {
  $('#lgErr').textContent = ''; $('#lgOk').textContent = '';
  const email = $('#lgUser').value.trim();
  if (!email) { $('#lgErr').textContent = 'Digite seu e-mail no campo acima e clique de novo em "Esqueci minha senha".'; $('#lgUser').focus(); return; }
  try { const r = await resetSenha(email); $('#lgOk').textContent = r === 'demo' ? 'Demonstração: na versão real enviamos um link para ' + email + ' criar uma nova senha.' : 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também o spam.'; }
  catch (e) { $('#lgErr').textContent = e.message; }
};
$('#hamb').onclick = () => $('#side').classList.toggle('open');
document.addEventListener('click', e => { if (window.innerWidth <= 760 && !e.target.closest('#side') && !e.target.closest('#hamb') && !e.target.closest('[data-b="menu"]')) $('#side').classList.remove('open'); });

store.onAuth((ok) => {
  $('#login').classList.toggle('hidden', ok); $('#app').classList.toggle('hidden', !ok);
  $('#demoHint').classList.toggle('hidden', !store.demo);
  if (ok) { route = (location.hash || '#painel').slice(1); render(); } else { $('#lgPass').value = ''; if (store.authMsg) { $('#lgErr').textContent = store.authMsg; $('#lgErr').classList.toggle('bloq', !!store.bloqueioMsg); store.authMsg = ''; store.bloqueioMsg = false; } }
});
document.title = `${EMPRESA} · Controle de Vendas`;
// ---------- atualização automática: se saiu versão nova, recarrega ----------
const APP_V = 9;
const APP_DATA = '29/10/2026';
const DEV = { nome: 'Gustavo Soares', email: 'gstsoares27@gmail.com', zap: '(11) 95448-5216', zapLink: 'https://wa.me/5511954485216' };
function rodape(versaoServidor) {
  const nova = versaoServidor && Number(versaoServidor) > APP_V;
  const html = `<span>Sistema desenvolvido por <b>${DEV.nome}</b> · <a href="mailto:${DEV.email}">${DEV.email}</a> · <a href="${DEV.zapLink}" target="_blank" rel="noopener">WhatsApp ${DEV.zap}</a></span><span class="ver ${nova ? 'old' : ''}" title="${nova ? 'Existe uma versão mais nova: atualize a página' : 'Versão em uso'}">Versão ${APP_V} · atualizada em ${APP_DATA}${nova ? ` · <b>nova versão ${versaoServidor} disponível — atualize a página</b>` : ''}</span>`;
  ['#rodape', '#rodapeLogin'].forEach(q => { const el = document.querySelector(q); if (el) el.innerHTML = html; });
}
rodape();
async function checarVersao() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const { v } = await r.json(); rodape(v);
    if (Number(v) > APP_V) { const k = 'praes_reload_' + v; let ja = false; try { ja = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch (e) { } if (!ja) location.reload(); }
  } catch (e) { }
}
checarVersao(); setInterval(checarVersao, 5 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checarVersao(); });
init().catch(e => { console.error(e); alert('Erro ao iniciar: ' + e.message); });
