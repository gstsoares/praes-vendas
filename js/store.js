// Camada de dados: Firebase (Auth + Firestore) ou MODO DEMONSTRAÇÃO (localStorage).
import { firebaseConfig } from './firebase-config.js';
import { acessoDaVenda, slug } from './calc.js?v=9';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const COLS = ['vendas', 'pessoas', 'regras', 'empreendimentos', 'agendamentos', 'users', 'config'];
export const ADMIN = ['admin', 'master', 'diretor'];

export const store = {
  demo: !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('COLE'),
  uid: null, me: null,
  data: Object.fromEntries(COLS.map(c => [c, []])),
  _subs: [], _cb: () => {}, _authCb: () => {},
  isAdmin() { return ADMIN.includes(this.me?.papel); },
  isMaster() { return ['admin', 'master'].includes(this.me?.papel); },
  // administrador do sistema (dono): libera usuários e altera o imposto
  isDono() { return this.me?.papel === 'admin'; },
  config() { return this.data.config.find(c => c.id === 'geral') || {}; },
  authMsg: '',
  // empreendimentos liberados: null = todos
  empsLiberados() { if (this.isMaster() || this.me?.empTodos) return null; return new Set(this.me?.emps || []); },
  onData(cb) { this._cb = cb; },
  onAuth(cb) { this._authCb = cb; },
};
// ---------- bloqueio por falta de pagamento (administrador) ----------
export function msgBloqueio() { const c = store.data.config.find(x => x.id === 'geral') || {}; return 'Acesso bloqueado por falta de pagamento. Para liberar, faça o PIX para o administrador do sistema: ' + (c.pix || '62019887000117 - Banco Inter') + ' e avise-o.'; }
export function estaBloqueado(u, cfg) { return !!u && u.papel !== 'admin' && (u.bloqueado === true || (cfg || {}).bloqueioGeral === true); }
let saindo = false;
function checarBloqueio() {
  if (!store.me || saindo) return;
  const u = store.data.users.find(x => x.id === store.uid) || store.me;
  if (!estaBloqueado(u, store.config())) return;
  saindo = true; store.authMsg = msgBloqueio(); store.bloqueioMsg = true;
  logout().finally(() => { saindo = false; });
}
const emit = () => { store._cb(); checarBloqueio(); };
const toEmail = (u) => String(u || '').trim().toLowerCase();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ======================= MODO DEMONSTRAÇÃO =======================
const DKEY = 'praes_demo_v3';
const demoSenhas = 'praes_demo_senhas_v3';
function demoLoad() {
  let db = null;
  try { db = JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) { }
  if (!db) db = demoSeed();
  return db;
}
function demoSave() { try { localStorage.setItem(DKEY, JSON.stringify(store.data)); } catch (e) { } }
function demoSeed() {
  const S = window.PRAES_SEED || { vendas: [], pessoas: [], regras: [], empreendimentos: [] };
  const vendas = S.vendas.map(v => ({ ...v, acesso: acessoDaVenda(v), empSlug: slug(v.empreendimento) }));
  const hoje = new Date();
  const d = (n) => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const agendamentos = [
    { id: newId(), data: d(0), hora: '10:00', cliente: 'Cliente exemplo 1', telefone: '', empreendimento: 'UNNIA VERDÁ', corretor: 'SELENNA', gerente: 'SERVANTES', diretor: 'TOM', tipo: 'Visita ao decorado', status: 'AGENDADO', obs: '' },
    { id: newId(), data: d(1), hora: '14:30', cliente: 'Cliente exemplo 2', telefone: '', empreendimento: 'MASKAN IPIRANGA', corretor: 'PINHEIRO', gerente: 'TOM', diretor: 'JOTA', tipo: 'Assinatura', status: 'AGENDADO', obs: '' },
    { id: newId(), data: d(-1), hora: '11:00', cliente: 'Cliente exemplo 3', telefone: '', empreendimento: 'NATURY', corretor: 'DENIS', gerente: 'DENIS', diretor: 'JOTA', tipo: 'Visita ao decorado', status: 'REALIZADO', obs: '' },
  ].map(a => ({ ...a, acesso: acessoDaVenda(a), empSlug: slug(a.empreendimento) }));
  const users = [
    { id: 'u-fag', email: 'fag@exemplo.com', nome: 'FAG', papel: 'admin', pessoa: '', empTodos: true, emps: [], ativo: true, foto: '' },
    { id: 'u-guigao', email: 'guigao@exemplo.com', nome: 'Guigão Guilherme Cunha', papel: 'master', pessoa: 'GUIGÃO', empTodos: true, emps: [], ativo: true, foto: 'img/guigao.jpg' },
    { id: 'u-servantes', email: 'servantes@exemplo.com', nome: 'Servantes', papel: 'gerente', pessoa: 'SERVANTES', empTodos: false, emps: ['unnia-verda'], ativo: true, foto: '' },
    { id: 'u-selenna', email: 'selenna@exemplo.com', nome: 'Selenna', papel: 'corretor', pessoa: 'SELENNA', empTodos: false, emps: ['unnia-verda'], ativo: true, foto: '' },
  ].map(u => ({ ...u, usuario: u.email, pessoaSlug: slug(u.pessoa) }));
  try { localStorage.setItem(demoSenhas, JSON.stringify(Object.fromEntries(users.map(u => [u.email, '123456'])))); } catch (e) { }
  users.push({ id: 'u-pinheiro', email: 'pinheiro@exemplo.com', usuario: 'pinheiro@exemplo.com', nome: 'Pinheiro', papel: 'corretor', pessoa: 'PINHEIRO', pessoaSlug: 'pinheiro', empTodos: false, emps: ['unnia-verda'], ativo: false, pendente: true, solicitadoPor: 'Guigão Guilherme Cunha', solicitadoEm: new Date().toISOString(), foto: '' });
  try { const s0 = JSON.parse(localStorage.getItem(demoSenhas) || '{}'); s0['pinheiro@exemplo.com'] = '123456'; localStorage.setItem(demoSenhas, JSON.stringify(s0)); } catch (e) { }
  // ---- vendas de EXEMPLO para demonstrar corpo de vendas, parcelas e pagamentos ----
  const H = hoje.toISOString().slice(0, 10), mes1 = (n) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() + n, 10); return x.toISOString().slice(0, 10); };
  const corpo = (cor, ger) => [['corretor', cor, 3], ['gerente', ger, .8], ['dirVendas', 'TOM', .35], ['coordenador', 'COORDENADOR EXEMPLO', .4], ['coordGeral', 'COORD. GERAL EXEMPLO', .12], ['comercial', 'COMERCIAL EXEMPLO', .1], ['secretaria', 'SECRETARIA EXEMPLO', .1], ['dirGeral', 'GUIGÃO', .3], ['imob', 'PRAES', 1.09], ['fabio', 'FÁBIO', .74]]
    .map(([cargo, pessoa, pct], i) => ({ id: 'e' + i, cargo, pessoa, pct }));
  const ex = [
    { id: 'exemplo-ato', data: d(-12), empreendimento: 'UNNIA VERDÁ', unidade: '00', torre: 'ÚNICA', incorporadora: 'UNNIA', cadastro: 'EXEMPLO-1', cliente: 'Comprador Exemplo (ato)', corretor: 'SELENNA', gerente: 'SERVANTES', diretor: 'TOM',
      vgv: 199000, status: 'VENDIDO', dataStatus: d(-10), dataVenda: d(-10), regra: 'verda-premio', taxa: 7, participantes: corpo('SELENNA', 'SERVANTES'), formaPagamento: 'avista', obs: 'Venda de exemplo da demonstração (pagamento no ato)',
      parcelas: [{ id: 'pa1', serie: 'Ato', descricao: 'Ato (à vista)', valor: 13930, vencimento: d(-5), recebido: true, dataRecebimento: d(-3) }], pagamentos: {} },
    { id: 'exemplo-parc', data: d(-20), empreendimento: 'UNNIA VERDÁ', unidade: '01', torre: 'ÚNICA', incorporadora: 'UNNIA', cadastro: 'EXEMPLO-2', cliente: 'Comprador Exemplo (parcelado)', corretor: 'MAESTRO', gerente: 'SERVANTES', diretor: 'TOM',
      vgv: 250000, status: 'CONTRATO ASSINADO', dataStatus: d(-18), dataVenda: d(-18), regra: 'verda-premio', taxa: 7, participantes: corpo('MAESTRO', 'SERVANTES'), formaPagamento: 'ato', obs: 'Venda de exemplo: ato + 3 mensais',
      parcelas: [{ id: 'pb1', serie: 'Ato', descricao: 'Ato', valor: 5500, vencimento: d(-15), recebido: true, dataRecebimento: d(-14) },
        ...[1, 2, 3].map(i => ({ id: 'pb' + (i + 1), serie: 'Mensal', descricao: `Parcela ${i}/3`, valor: 4000, vencimento: mes1(i), recebido: false, dataRecebimento: '' }))], pagamentos: {} },
    { id: 'exemplo-rep', data: d(-25), empreendimento: 'UNNIA VERDÁ', unidade: '02', torre: 'ÚNICA', incorporadora: 'UNNIA', cadastro: 'EXEMPLO-3', cliente: 'Comprador Exemplo (repasse)', corretor: 'PINHEIRO', gerente: 'ELISETE', diretor: 'TOM',
      vgv: 300000, status: 'CONTRATO ASSINADO', dataStatus: d(-22), dataVenda: d(-22), regra: 'verda-premio', taxa: 7, participantes: corpo('PINHEIRO', 'ELISETE'), formaPagamento: 'repasse', obs: 'Venda de exemplo: repasse Caixa',
      parcelas: [{ id: 'pc1', serie: 'Repasse', descricao: 'Repasse Caixa/banco', valor: 21000, vencimento: d(20), recebido: false, dataRecebimento: '' }], pagamentos: {} },
  ].map(v => ({ ...v, acesso: acessoDaVenda(v), empSlug: slug(v.empreendimento) }));
  return { vendas: [...ex, ...vendas], pessoas: S.pessoas, regras: S.regras, empreendimentos: S.empreendimentos, agendamentos, users, config: [{ id: 'geral', imposto: 14.8 }] };
}
function demoSenhasGet() { try { return JSON.parse(localStorage.getItem(demoSenhas) || '{}'); } catch (e) { return {}; } }
function demoSenhasSet(o) { try { localStorage.setItem(demoSenhas, JSON.stringify(o)); } catch (e) { } }

// ======================= FIREBASE =======================
let fb = null; // módulos carregados
async function loadFirebase() {
  const [app, auth, fs] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const a = app.initializeApp(firebaseConfig);
  fb = { app, authM: auth, fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  fb.auth.languageCode = 'pt-BR';
  // app secundário para criar usuários sem deslogar o master
  fb.app2 = app.initializeApp(firebaseConfig, 'secundario');
  fb.auth2 = auth.getAuth(fb.app2);
}

function unsubscribeAll() { store._subs.forEach(u => u()); store._subs = []; COLS.forEach(c => store.data[c] = []); }

function subscribe() {
  const { fs, db } = fb;
  const me = store.me;
  const pid = me.pessoaSlug || slug(me.pessoa || '');
  const parts = {}; // col -> { chave: docs[] } (várias consultas juntadas)
  const sub = (col, q, key = 'all') => store._subs.push(fs.onSnapshot(q, snap => {
    (parts[col] = parts[col] || {})[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const m = new Map(); Object.values(parts[col]).flat().forEach(d => m.set(d.id, d));
    store.data[col] = [...m.values()];
    emit();
  }, err => console.error(col, err)));
  ['pessoas', 'regras', 'empreendimentos', 'config'].forEach(c => sub(c, fs.collection(db, c)));
  if (store.isMaster()) sub('users', fs.collection(db, 'users'));
  else sub('users', fs.query(fs.collection(db, 'users'), fs.where('ativo', '==', true)));
  const lib = store.empsLiberados();           // null = todos
  const verTudo = store.isMaster() || me.papel === 'diretor';
  ['vendas', 'agendamentos'].forEach(c => {
    const col = fs.collection(db, c);
    if (lib === null) {
      if (verTudo) sub(c, col);
      else if (pid) sub(c, fs.query(col, fs.where('acesso', 'array-contains', pid)));
    } else {
      [...lib].forEach(e => {
        if (verTudo) sub(c, fs.query(col, fs.where('empSlug', '==', e)), e);
        else if (pid) sub(c, fs.query(col, fs.where('empSlug', '==', e), fs.where('acesso', 'array-contains', pid)), e);
      });
    }
  });
}

// ======================= API PÚBLICA =======================
export async function init() {
  if (store.demo) {
    store.data = demoLoad();
    let sess = null; try { sess = sessionStorage.getItem('praes_demo_sess'); } catch (e) { }
    const u = sess && store.data.users.find(x => x.id === sess && x.ativo !== false);
    if (u) { store.uid = u.id; store.me = u; }
    store._authCb(!!u);
    return;
  }
  await loadFirebase();
  fb.authM.onAuthStateChanged(fb.auth, async (user) => {
    unsubscribeAll();
    if (!user) { store.uid = null; store.me = null; store._authCb(false); return; }
    store.uid = user.uid;
    const ref = fb.fs.doc(fb.db, 'users', user.uid);
    let snap = await fb.fs.getDoc(ref);
    if (!snap.exists()) {
      // Primeiro acesso do sistema: o primeiro login vira MASTER (só se ainda não existir config/app)
      const cfg = await fb.fs.getDoc(fb.fs.doc(fb.db, 'config', 'app')).catch(() => null);
      if (cfg && !cfg.exists()) {
        const b = fb.fs.writeBatch(fb.db);
        const email = (user.email || '').toLowerCase();
        b.set(ref, { email, usuario: email, nome: email.split('@')[0].toUpperCase(), papel: 'admin', pessoa: '', pessoaSlug: '', empTodos: true, emps: [], ativo: true, foto: '' });
        b.set(fb.fs.doc(fb.db, 'config', 'app'), { criadoEm: new Date().toISOString(), criadoPor: user.uid });
        await b.commit();
        snap = await fb.fs.getDoc(ref);
      } else {
        store.authMsg = 'Seu usuário não está cadastrado no sistema. Fale com o administrador.';
        await fb.authM.signOut(fb.auth); return;
      }
    }
    store.me = { id: user.uid, ...snap.data() };
    if (store.me.ativo === false) { store.authMsg = store.me.pendente ? 'Seu cadastro está aguardando liberação do administrador do sistema.' : 'Usuário desativado.'; store.me = null; await fb.authM.signOut(fb.auth); return; }
    if (store.me.papel !== 'admin') {
      const g = await fb.fs.getDoc(fb.fs.doc(fb.db, 'config', 'geral')).catch(() => null);
      const cfg = g && g.exists() ? { id: 'geral', ...g.data() } : {};
      if (estaBloqueado(store.me, cfg)) { store.data.config = [cfg]; store.authMsg = msgBloqueio(); store.bloqueioMsg = true; store.me = null; await fb.authM.signOut(fb.auth); return; }
    }
    subscribe();
    store._authCb(true);
  });
}

export async function login(email, senha) {
  email = toEmail(email);
  if (store.demo) {
    const u = store.data.users.find(x => (x.email || '').toLowerCase() === email);
    const senhas = demoSenhasGet();
    if (!u || senhas[u.email] !== senha) throw new Error('E-mail ou senha inválidos.');
    if (u.ativo === false) throw new Error(u.pendente ? 'Seu cadastro está aguardando liberação do administrador do sistema.' : 'Usuário desativado.');
    if (estaBloqueado(u, store.config())) throw new Error(msgBloqueio());
    store.uid = u.id; store.me = u;
    try { sessionStorage.setItem('praes_demo_sess', u.id); } catch (e) { }
    store._authCb(true); return;
  }
  try { await fb.authM.signInWithEmailAndPassword(fb.auth, email, senha); }
  catch (e) { throw new Error(e.code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde alguns minutos ou use "Esqueci minha senha".' : 'E-mail ou senha inválidos.'); }
}

// Envia o link de redefinição de senha para o e-mail
export async function resetSenha(email) {
  email = toEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  if (store.demo) return 'demo';
  try { await fb.authM.sendPasswordResetEmail(fb.auth, email); }
  catch (e) { if (e.code === 'auth/user-not-found') return 'ok'; throw new Error('Não foi possível enviar: ' + (e.code || e.message)); }
  return 'ok';
}

export async function logout() {
  if (store.demo) { try { sessionStorage.removeItem('praes_demo_sess'); } catch (e) { } store.me = null; store._authCb(false); return; }
  await fb.authM.signOut(fb.auth);
}

// ---------- histórico de alterações das vendas ----------
const HIST_CAMPOS = [['status', 'Status'], ['dataStatus', 'Data do status'], ['vgv', 'VGV'], ['cliente', 'Cliente'], ['cadastro', 'Nº cadastro'], ['empreendimento', 'Empreendimento'], ['unidade', 'Unidade'], ['torre', 'Torre'],
  ['dataVenda', 'Data da venda'], ['corretor', 'Corretor'], ['gerente', 'Gerente'], ['diretor', 'Diretoria'], ['financeiro', 'Financeiro'], ['regra', 'Regra de comissão'], ['taxa', 'Taxa (%)'], ['formaPagamento', 'Forma de recebimento'], ['obs', 'Observação']];
const fmtR = (x) => (Number(x) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const resumoCorpo = (l) => (l || []).filter(p => p.pessoa || Number(p.pct)).map(p => `${p.pessoa || p.label || '?'} ${String(Number(p.pct) || 0).replace('.', ',')}%`).join('; ');
const resumoParc = (l) => { l = l || []; if (!l.length) return ''; const t = l.reduce((a, p) => a + (Number(p.valor) || 0), 0); const r = l.filter(p => p.recebido).length; return `${l.length} parcela(s) · ${fmtR(t)} · ${r} recebida(s)`; };
const resumoPag = (m) => { const v = Object.values(m || {}); return v.length ? `${v.filter(x => x && x.pago).length} pagamento(s) marcado(s) como pago` : ''; };
function historicoVenda(obj) {
  const old = obj.id ? store.data.vendas.find(x => x.id === obj.id) : null;
  const base = ((old ? old.historico : obj.historico) || []).map(h => ({ ...h, alt: (h.alt || []).map(x => Array.isArray(x) ? { c: x[0], de: x[1], para: x[2] } : x) }));
  const alt = [];
  if (!old) alt.push({ c: 'Venda', de: '', para: 'cadastrada' });
  else {
    const val = (k, x) => k === 'vgv' ? (x == null || x === '' ? '' : fmtR(x)) : String(x ?? '').trim();
    HIST_CAMPOS.forEach(([k, l]) => { const a = val(k, old[k]), b = val(k, obj[k]); if (a !== b) alt.push({ c: l, de: k === 'obs' ? (a ? '(texto anterior)' : '') : a, para: k === 'obs' ? (b ? '(texto alterado)' : '') : b }); });
    [['Corpo de vendas (comissões)', resumoCorpo], ['Parcelas de recebimento', resumoParc, 'parcelas'], ['Pagamentos', resumoPag, 'pagamentos']].forEach(([l, f, k]) => { const a = f(old[k || 'participantes']), b = f(obj[k || 'participantes']); if (a !== b) alt.push({ c: l, de: a, para: b }); });
  }
  if (!alt.length) return base;
  return [...base, { em: new Date().toISOString(), por: store.me?.nome || store.me?.email || '', alt }].slice(-80);
}

function prep(col, obj) {
  const o = { ...obj };
  if (col === 'vendas') o.historico = historicoVenda(obj);
  delete o.id;
  if (col === 'vendas' || col === 'agendamentos') { o.acesso = acessoDaVenda(o); o.empSlug = slug(o.empreendimento || ''); }
  o.atualizadoEm = new Date().toISOString();
  o.atualizadoPor = store.me?.email || store.me?.usuario || '';
  Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
  return o;
}

export async function save(col, obj) {
  const id = obj.id || (col === 'pessoas' || col === 'empreendimentos' || col === 'regras' ? (slug(obj.nome) || newId()) : newId());
  const o = prep(col, obj);
  if (store.demo) {
    const arr = store.data[col]; const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = { id, ...o }; else arr.push({ id, ...o });
    demoSave(); emit(); return id;
  }
  await fb.fs.setDoc(fb.fs.doc(fb.db, col, id), o);
  return id;
}

export async function saveMany(col, list, onProgress) {
  if (store.demo) { for (const o of list) { const id = o.id || newId(); const p = prep(col, o); const arr = store.data[col]; const i = arr.findIndex(x => x.id === id); if (i >= 0) arr[i] = { id, ...p }; else arr.push({ id, ...p }); } demoSave(); emit(); return; }
  for (let i = 0; i < list.length; i += 400) {
    const b = fb.fs.writeBatch(fb.db);
    list.slice(i, i + 400).forEach(o => b.set(fb.fs.doc(fb.db, col, o.id || (col === 'vendas' ? newId() : slug(o.nome) || newId())), prep(col, o)));
    await b.commit(); onProgress && onProgress(Math.min(i + 400, list.length), list.length);
  }
}

export async function remove(col, id) {
  if (store.demo) { store.data[col] = store.data[col].filter(x => x.id !== id); demoSave(); emit(); return; }
  await fb.fs.deleteDoc(fb.fs.doc(fb.db, col, id));
}

// ---- usuários ----
// senha vazia = gera uma senha aleatória e envia e-mail para o usuário criar a dele
export async function createUser({ email, senha, nome, papel, pessoa, foto, empTodos, emps }) {
  email = toEmail(email);
  if (store.data.users.some(u => (u.email || '') === email)) throw new Error('Já existe um usuário com esse e-mail.');
  const enviarLink = !senha;
  if (!senha) senha = Math.random().toString(36).slice(2) + 'A9!' + Math.random().toString(36).slice(2);
  const dono = store.isDono();
  if (!dono && papel === 'admin') throw new Error('Só o administrador do sistema cria outro administrador.');
  const doc = { email, usuario: email, nome, papel, pessoa: pessoa || '', pessoaSlug: slug(pessoa || ''), foto: foto || '', empTodos: !!empTodos, emps: emps || [],
    ativo: dono, pendente: !dono, solicitadoPor: store.me?.nome || '', solicitadoEm: new Date().toISOString(), enviarLink, criadoEm: new Date().toISOString() };
  if (store.demo) {
    const s = demoSenhasGet(); s[email] = enviarLink ? '123456' : senha; demoSenhasSet(s);
    await save('users', { id: 'u-' + slug(email), ...doc }); return { enviarLink, pendente: !dono };
  }
  const cred = await fb.authM.createUserWithEmailAndPassword(fb.auth2, email, senha);
  await fb.authM.signOut(fb.auth2);
  await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', cred.user.uid), doc);
  if (enviarLink && dono) await fb.authM.sendPasswordResetEmail(fb.auth, email);
  return { enviarLink, pendente: !dono };
}

export async function updateUser(id, campos) {
  if (campos.pessoa !== undefined) campos = { ...campos, pessoaSlug: slug(campos.pessoa || '') };
  const atual = store.data.users.find(u => u.id === id) || {};
  const novo = { ...atual, ...campos, id };
  if (store.demo) { await save('users', novo); if (id === store.uid) store.me = store.data.users.find(u => u.id === id); return; }
  const o = { ...campos }; delete o.id;
  await fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', id), o);
  if (id === store.uid) store.me = { ...store.me, ...o };
}

export async function changePassword(atual, nova) {
  if (store.demo) {
    const s = demoSenhasGet();
    if (s[store.me.email] !== atual) throw new Error('Senha atual incorreta.');
    s[store.me.email] = nova; demoSenhasSet(s); return;
  }
  const u = fb.auth.currentUser;
  const cred = fb.authM.EmailAuthProvider.credential(u.email, atual);
  await fb.authM.reauthenticateWithCredential(u, cred).catch(() => { throw new Error('Senha atual incorreta.'); });
  await fb.authM.updatePassword(u, nova);
}

// Administrador libera (ou recusa) um cadastro pendente
export async function liberarUsuario(id, aprovar) {
  if (!store.isDono()) throw new Error('Somente o administrador do sistema.');
  const u = store.data.users.find(x => x.id === id); if (!u) return;
  if (!aprovar) { await updateUser(id, { ativo: false, pendente: false, recusado: true, liberadoPor: store.me.nome, liberadoEm: new Date().toISOString() }); return; }
  await updateUser(id, { ativo: true, pendente: false, recusado: false, liberadoPor: store.me.nome, liberadoEm: new Date().toISOString() });
  if (u.enviarLink && !store.demo) await fb.authM.sendPasswordResetEmail(fb.auth, u.email);
}

// Apaga TODOS os documentos das coleções escolhidas (somente master)
export async function limparColecoes(cols, onProgress) {
  if (!store.isMaster()) throw new Error('Somente master.');
  if (store.demo) { cols.forEach(c => store.data[c] = []); demoSave(); emit(); return; }
  for (const c of cols) {
    const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, c));
    const ids = snap.docs.map(d => d.id);
    for (let i = 0; i < ids.length; i += 400) {
      const b = fb.fs.writeBatch(fb.db);
      ids.slice(i, i + 400).forEach(id => b.delete(fb.fs.doc(fb.db, c, id)));
      await b.commit(); onProgress && onProgress(c, Math.min(i + 400, ids.length), ids.length);
    }
  }
}

export function resetDemo() { try { localStorage.removeItem(DKEY); localStorage.removeItem(demoSenhas); sessionStorage.removeItem('praes_demo_sess'); } catch (e) { } location.reload(); }
