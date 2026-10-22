// Regras de negócio: comissões, venda válida, períodos, recebimentos.

export const CARGOS = [
  { key: 'corretor',       label: 'Corretor' },
  { key: 'gerente',        label: 'Gerente' },
  { key: 'dirVendas',      label: 'Diretor de vendas' },
  { key: 'coordenador',    label: 'Coordenador' },
  { key: 'coordGeral',     label: 'Coordena Geral' },
  { key: 'comercial',      label: 'Comercial' },
  { key: 'secretaria',     label: 'Secretaria de vendas' },
  { key: 'dirGeral',       label: 'Diretor Geral' },
  { key: 'dirOperacional', label: 'Diretor Operacional' },
  { key: 'imob',           label: 'Praes Imob.' },
  { key: 'fabio',          label: 'Fábio Incorp.' },
];
export const cargoLabel = (k) => CARGOS.find(c => c.key === k)?.label || k;
export const IMPOSTO_PADRAO = 14.8;   // % descontado de cada pagamento

export const STATUS = [
  { nome: 'NOVA PASTA',        grupo: 'Cadastro',   cor: '#64748b' },
  { nome: 'EM ANALISE',        grupo: 'Análise',    cor: '#0ea5e9' },
  { nome: 'PENDENTE',          grupo: 'Análise',    cor: '#f59e0b' },
  { nome: 'AJUSTES',           grupo: 'Análise',    cor: '#f59e0b' },
  { nome: 'NOVA AVALIAÇÃO',    grupo: 'Análise',    cor: '#f59e0b' },
  { nome: 'APROVADO COND.',    grupo: 'Aprovado',   cor: '#84cc16' },
  { nome: 'APROVADO',          grupo: 'Aprovado',   cor: '#22c55e' },
  { nome: 'REPROVADO',         grupo: 'Perdido',    cor: '#ef4444' },
  { nome: 'EM RESERVA',        grupo: 'Reserva',    cor: '#a855f7' },
  { nome: 'EM ASSINATURA',     grupo: 'Assinatura', cor: '#6366f1' },
  { nome: 'CONTRATO ASSINADO', grupo: 'Vendido',    cor: '#c9a24a' },
  { nome: 'VENDIDO',           grupo: 'Vendido',    cor: '#c9a24a' },
  { nome: 'CAIU',              grupo: 'Perdido',    cor: '#ef4444' },
  { nome: 'CANCELADO',         grupo: 'Perdido',    cor: '#ef4444' },
];
export const STATUS_VENDA = ['CONTRATO ASSINADO', 'VENDIDO'];
export const GRUPOS_FUNIL = ['Cadastro', 'Análise', 'Aprovado', 'Reserva', 'Assinatura', 'Vendido', 'Perdido'];
export const statusInfo = (s) => STATUS.find(x => x.nome === s) || { nome: s, grupo: 'Cadastro', cor: '#64748b' };

export const FORMAS = [
  { key: 'avista',  label: 'Ato (à vista)' },
  { key: 'ato',     label: 'Ato + parcelas mensais' },
  { key: 'repasse', label: 'Repasse Caixa/banco' },
  { key: 'atorep',  label: 'Ato + repasse Caixa/banco' },
];
export const SERIES = ['Ato', 'Mensal', 'Repasse', 'Outro'];
export const PRAZO_REPASSE_DIAS = 45;

export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const isVenda = (v) => STATUS_VENDA.includes(v.status) && Number(v.vgv) > 0;
export const dataRef = (v) => v.dataVenda || v.dataStatus || v.data || '';

// Quem ocupa cada cargo numa venda. Corretor/gerente/diretor vêm das colunas
// principais; os demais vêm do "corpo de vendas" preenchido na venda.
export function titular(v, key) {
  if (v.corpo && v.corpo[key]) return v.corpo[key];
  if (key === 'corretor') return v.corretor || v.gerente || '';
  if (key === 'gerente') return v.gerente || '';
  if (key === 'dirVendas') return v.diretor || '';
  if (key === 'imob') return 'PRAES';
  return '';
}

// Participantes da venda: se a venda tem o corpo de vendas próprio (participantes),
// usa ele; senão monta a partir da regra do quadro de taxas.
export function participantesDaVenda(v, regras) {
  if (v.participantes && v.participantes.length) return v.participantes.map((p, i) => ({ id: p.id || 'p' + i, cargo: p.cargo || 'outro', label: p.label || cargoLabel(p.cargo), pessoa: p.pessoa || '', pct: Number(p.pct) || 0 }));
  const r = regras.find(x => x.id === v.regra);
  if (!r) return [];
  return CARGOS.map(c => ({ id: c.key, cargo: c.key, label: c.label, pessoa: titular(v, c.key), pct: Number(r.cargos?.[c.key]) || 0 })).filter(l => l.pct > 0);
}
export const taxaDaVenda = (v, regras) => {
  if (v.participantes && v.participantes.length && Number(v.taxa) > 0) return Number(v.taxa);
  const r = regras.find(x => x.id === v.regra); return r ? Number(r.taxa) || 0 : (Number(v.taxa) || 0);
};

export function comissoes(v, regras) {
  const r0 = regras.find(x => x.id === v.regra);
  const proprio = !!(v.participantes && v.participantes.length);
  const r = r0 || (proprio ? { id: '', nome: 'Personalizada', taxa: Number(v.taxa) || 0, obs: '' } : null);
  const vgv = Number(v.vgv) || 0;
  const taxa = taxaDaVenda(v, regras);
  if (!r || !vgv) return { regra: r || null, linhas: [], total: 0, receita: 0, sobra: 0, taxa, proprio };
  const linhas = participantesDaVenda(v, regras).map(l => ({ ...l, valor: vgv * l.pct / 100, ref: taxa ? l.pct / taxa : 0 }));
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const receita = vgv * taxa / 100;   // taxa total paga pela incorporadora
  return { regra: r, linhas, total, receita, sobra: receita - total, taxa, proprio };
}

export function pendencias(v) {
  const p = [];
  if (STATUS_VENDA.includes(v.status)) {
    if (!(Number(v.vgv) > 0)) p.push('Falta VGV');
    if (!v.dataVenda) p.push('Falta data da venda');
    if (!v.regra && !(v.participantes && v.participantes.length)) p.push('Falta regra de comissão');
    if (v.participantes && v.participantes.length) { const soma = v.participantes.reduce((a, x) => a + (Number(x.pct) || 0), 0); if (Math.abs(soma - (Number(v.taxa) || 0)) > 0.0001) p.push('Corpo de vendas não fecha a taxa'); }
    if (v.parcelas && v.parcelas.length && Number(v.vgv) > 0) { const tp = v.parcelas.reduce((a, x) => a + (Number(x.valor) || 0), 0); const tot = (Number(v.vgv) || 0) * (Number(v.taxa) || 0) / 100; if (v.participantes?.length && Math.abs(tp - tot) > 0.05) p.push('Parcelas não fecham o total'); }
  }
  return p;
}

// ---------- Datas e períodos ----------
export const toDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => { const d = toDate(s); d.setMonth(d.getMonth() + n); return iso(d); };

export function periodo(tipo, ini, fim) {
  const h = new Date(); const hoje = iso(h);
  switch (tipo) {
    case 'hoje': return [hoje, hoje];
    case 'semana': { const d = new Date(h); const dw = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dw); const f = new Date(d); f.setDate(d.getDate() + 6); return [iso(d), iso(f)]; }
    case 'mes': return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(new Date(h.getFullYear(), h.getMonth() + 1, 0))];
    case 'mesant': return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
    case 'tri': { const q = Math.floor(h.getMonth() / 3) * 3; return [iso(new Date(h.getFullYear(), q, 1)), iso(new Date(h.getFullYear(), q + 3, 0))]; }
    case 'ano': return [`${h.getFullYear()}-01-01`, `${h.getFullYear()}-12-31`];
    case 'tudo': return ['2000-01-01', '2100-12-31'];
    default: return [ini || '2000-01-01', fim || '2100-12-31'];
  }
}
export const noPeriodo = (s, [a, b]) => !!s && s >= a && s <= b;

// ---------- Recebimentos ----------
const pid = () => Math.random().toString(36).slice(2, 9);
// Se a venda não tem parcelas lançadas, gera uma previsão automática:
// valor total da taxa em (data venda + 45 dias).
export function parcelasDaVenda(v, regras) {
  if (!isVenda(v)) return [];
  if (v.parcelas && v.parcelas.length) return v.parcelas.map((p, i) => ({ ...p, id: p.id || 'x' + i, idx: i, auto: false }));
  const c = comissoes(v, regras);
  if (!c.receita) return [];
  const base = dataRef(v);
  if (!base) return [];
  return [{ id: 'auto', idx: 0, serie: 'Repasse', descricao: 'Previsão automática', valor: c.receita, vencimento: addDays(base, PRAZO_REPASSE_DIAS), recebido: false, auto: true }];
}

// Monta as parcelas da comissão conforme a condição de recebimento
export function gerarParcelas(v, regras, { forma, qtd = 1, primeira, dias = PRAZO_REPASSE_DIAS, valorAto = 0, dataAto }) {
  const total = comissoes(v, regras).receita || 0;
  const base = dataAto || dataRef(v) || iso(new Date());
  const P = (serie, descricao, valor, vencimento) => ({ id: pid(), serie, descricao, valor: round2(valor), vencimento, recebido: false, dataRecebimento: '' });
  if (forma === 'avista') return [P('Ato', 'Ato (à vista)', total, base)];
  if (forma === 'repasse') return [P('Repasse', 'Repasse Caixa/banco', total, addDays(base, Number(dias) || 0))];
  const vAto = Math.min(Number(valorAto) || 0, total);
  const resto = total - vAto;
  const parc = [];
  if (vAto > 0) parc.push(P('Ato', 'Ato', vAto, base));
  if (forma === 'atorep') { if (resto > 0.004) parc.push(P('Repasse', 'Repasse Caixa/banco', resto, addDays(base, Number(dias) || 0))); return parc; }
  const n = Math.max(1, Number(qtd) || 1);
  let acum = 0;
  for (let i = 0; i < n; i++) { const val = i === n - 1 ? resto - acum : round2(resto / n); acum += val; parc.push(P('Mensal', `Parcela ${i + 1}/${n}`, val, addMonths(primeira || base, vAto > 0 && !primeira ? i + 1 : i))); }
  return parc;
}

// ---------- Pagamentos ----------
// Cada parcela RECEBIDA é dividida entre os participantes pela referência (pct ÷ taxa).
// Bruto - imposto = líquido. A chave do pagamento é parcela|participante.
export function pagamentosDaVenda(v, regras, imposto = IMPOSTO_PADRAO, incluirPrevistos = false) {
  if (!isVenda(v)) return [];
  const c = comissoes(v, regras);
  if (!c.linhas.length || !c.taxa) return [];
  const pagos = v.pagamentos || {};
  const out = [];
  parcelasDaVenda(v, regras).forEach(p => {
    if (!p.recebido && !incluirPrevistos) return;
    c.linhas.forEach(l => {
      const bruto = round2((Number(p.valor) || 0) * l.ref);
      const imp = round2(bruto * imposto / 100);
      const key = `${p.id}|${l.id}`;
      out.push({ key, venda: v, parcela: p, participante: l, pessoa: l.pessoa || '(sem nome)', cargo: l.label, ref: l.ref, bruto, imposto: imp, liquido: round2(bruto - imp),
        competencia: (p.recebido ? (p.dataRecebimento || p.vencimento) : p.vencimento) || '', recebido: !!p.recebido, pago: !!pagos[key]?.pago, dataPago: pagos[key]?.data || '' });
    });
  });
  return out;
}

export const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// Lista de pessoas que podem ver a venda (usado nas regras de segurança)
export function acessoDaVenda(v) {
  const s = new Set([v.corretor, v.gerente, v.diretor, ...Object.values(v.corpo || {}), ...(v.participantes || []).map(p => p.pessoa)].filter(Boolean).map(slug));
  return [...s];
}
