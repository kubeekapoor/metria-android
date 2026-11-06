/* Metría — interfaz y reglas de negocio (extraído de app.html del escritorio).
   Se ejecuta dentro de un IIFE: no expone nada salvo window.MetriaApp. */
(function () {
const CATEGORIES = [
  { id:'ingreso',      label:'Ingresos',       detailLabel:'Categoría',     color:'var(--c-ingreso)',      icon:'↑', sign:1  },
  { id:'gasto',        label:'Gastos',          detailLabel:'Categoría',     color:'var(--c-gasto)',        icon:'↓', sign:-1 },
  { id:'cajachica',    label:'Caja chica',      detailLabel:'Motivo',        color:'var(--c-cajachica)',    icon:'◈', sign:-1 },
  { id:'deuda',        label:'Deuda',           detailLabel:'Acreedor',      color:'var(--c-deuda)',        icon:'!', sign:0  },
  { id:'abono',        label:'Abonos',          detailLabel:'A cuenta de',   color:'var(--c-abono)',        icon:'✓', sign:-1 },
  { id:'transferencia',label:'Transferencias',  detailLabel:'Cuentas',       color:'var(--c-transferencia)',icon:'⇄', sign:0  },
  /* Capital inicial: lo genera la app al abrir una cuenta con saldo. Suma al saldo de la cuenta y al
     balance global, pero NO cuenta como Ingreso. No se captura a mano. */
  { id:'capital',      label:'Capital inicial', detailLabel:'Concepto',      color:'var(--c-capital)',      icon:'◆', sign:1  },
];
const catById = id => CATEGORIES.find(c => c.id === id);
const CAPTURE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'deuda' && c.id !== 'abono' && c.id !== 'transferencia' && c.id !== 'capital');

const PM_COLORS = ['#4C6FFF','#18B47A','#F5A524','#F2555A','#8B5CF6','#14B8A6','#0EA5E9','#EC4899','#FFCC00','#64748B'];
const PM_ICONS = [
  { id:'tarjeta', label:'Tarjeta', glyph:'▭' },
  { id:'billete', label:'Billete', glyph:'$' },
  { id:'cripto',  label:'Cripto',  glyph:'₿' },
  { id:'none',    label:'Sin ícono', glyph:'' },
];
const pmColor = m => m.color || '#636366';
const pmGlyph = m => { const ic = PM_ICONS.find(i => i.id === m.icon); return ic ? ic.glyph : ''; };

/* Categorías de ingreso y de gasto que el usuario administra. Cada movimiento guarda el NOMBRE de su
   categoría en el campo "detail" (así los reportes y los datos antiguos siguen funcionando). */
const DEFAULT_CATEGORIES = {
  ingreso: ['Nómina','Pago','Aporte','Donación','Préstamo','Otros'],
  gasto:   ['Alimento','Vivienda','Transporte','Salud','Social','Aporte','Comunicación','Tecnología','Ropa','Estética','Barbería'],
};
/* Ideas rápidas (un toque para agregarlas) que no vienen por defecto. */
const SUGGESTED_CATEGORIES = {
  ingreso: ['Ventas','Reembolso','Intereses','Regalo'],
  gasto:   ['Educación','Entretenimiento','Servicios','Hogar','Mascotas','Suscripciones','Otros'],
};
const CAT_NAME_MAX = 40;
function seedCategories(){
  const out = [];
  ['ingreso','gasto'].forEach(kind => DEFAULT_CATEGORIES[kind].forEach(name => out.push({ id: uid(), name, kind })));
  return out;
}

const state = {
  page: 'home',
  entries: [],
  categories: [],
  catAdminKind: 'ingreso',
  editingCatId: null,
  debts: [],
  paymentMethods: [],
  theme: 'dark',
  uiScale: 1,
  loaded: false,
  activeCategory: 'ingreso',
  soloTotal: false,
  isLoan: false,
  granularity: 'mes',
  refDate: new Date(),
  newPmName: '',
  newPmCapital: '',
  newPmColor: PM_COLORS[0],
  newPmIcon: 'none',
  editingPmId: null,
  editPmColor: PM_COLORS[0],
  editPmIcon: 'none',
  editingEntryId: null,
  editingTransferId: null,
  editingDebtId: null,
  pmCloseModal: null,
  wipeModalOpen: false,
  confirmModal: null,
  pwModal: null,
  sheet: false,
  flowRange: 'mes',
  flowStyle: 'linea',
  flowSel: null,
  hideBalance: false,
  catKind: 'gasto',
  reportType: 'global',
  cifra: null,
  loadError: false,
};

function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'e'+Date.now()+Math.random().toString(16).slice(2)); }

function fmt(n){
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtDate(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
}
function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
/* Escapa cualquier texto que venga del usuario (nombres de cuentas/deudas,
   detalle, descripción, etc.) antes de insertarlo en el HTML. Se usa en TODO
   punto de la UI donde se interpola texto libre, tanto en contenido como en
   atributos value="", para evitar HTML/JS embebido (persistent XSS) vía
   captura manual o vía "Importar respaldo". */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- categorías: ayudas ---------- */
const normName = t => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function categoriesOf(kind){ return state.categories.filter(c => c.kind === kind); }
function categoryNameTaken(kind, name, exceptId){
  const k = normName(name);
  return state.categories.some(c => c.kind === kind && c.id !== exceptId && normName(c.name) === k);
}
/* Opciones de <select>: las categorías de la lista + (si hace falta) el valor actual del movimiento,
   para no perder categorías antiguas escritas a mano ni cambiarlas sin querer al editar. */
function categoryOptions(kind, current){
  const cur = String(current || '').trim();
  const list = categoriesOf(kind);
  const inList = cur && list.some(c => normName(c.name) === normName(cur));
  const sel = c => (cur && normName(c.name) === normName(cur)) ? 'selected' : '';
  return `<option value="" ${cur ? '' : 'selected'}>Sin categoría</option>`
    + list.map(c => `<option value="${esc(c.name)}" ${sel(c)}>${esc(c.name)}</option>`).join('')
    + (cur && !inList ? `<option value="${esc(cur)}" selected>${esc(cur)} · fuera de tu lista</option>` : '');
}
function categoryUsage(kind){
  const map = new Map();
  state.entries.forEach(e => { if(e.type === kind){ const k = normName(e.detail); map.set(k, (map.get(k) || 0) + 1); } });
  return map;
}
function sanitizeCategories(arr){
  const out = [], seen = new Set(), ids = new Set();
  (Array.isArray(arr) ? arr : []).forEach(c => {
    if(!c || typeof c !== 'object') return;
    const name = typeof c.name === 'string' ? c.name.trim().slice(0, CAT_NAME_MAX) : '';
    const kind = c.kind === 'ingreso' || c.kind === 'gasto' ? c.kind : '';
    const key = kind + '|' + normName(name);
    if(!name || !kind || seen.has(key)) return;
    seen.add(key);
    let id = typeof c.id === 'string' && c.id && !ids.has(c.id) ? c.id : uid();
    ids.add(id);
    out.push({ id, name, kind });
  });
  return out;
}

/* ---------- dinero ---------- */
/* Todo monto se redondea a centavos: evita errores de coma flotante
   (0.1 + 0.2 = 0.30000000000000004) que rompían comparaciones exactas. */
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
function parseMoney(v){
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  if(!isFinite(n) || n < 0 || n > 999999999999.99) return 0;
  return r2(n);
}
function pmRawName(id){
  const m = state.paymentMethods.find(x => x.id === id);
  return m ? m.name : '';
}
/* Los nombres de cuenta se guardan SIN escapar y se escapan al pintar.
   Esto repara datos antiguos de transferencias que guardaban el nombre ya escapado. */
function normalizeTransfers(){
  state.entries.forEach(e => {
    if(e.type !== 'transferencia') return;
    const o = pmRawName(e.origen), d = pmRawName(e.destino);
    if(!o || !d) return;
    const suffix = /\(cierre de cuenta\)\s*$/.test(e.detail || '') ? ' (cierre de cuenta)' : '';
    e.detail = o + ' → ' + d + suffix;
    if(e.comisionEntryId){
      const c = state.entries.find(x => x.id === e.comisionEntryId);
      if(c) c.description = o + ' → ' + d;
    }
  });
}

/* ---------- integridad de saldos ---------- */
function balancesMap(entries, methods = state.paymentMethods){
  const map = {};
  methods.forEach(m => { map[m.id] = 0; });
  entries.forEach(e => {
    if(e.type === 'transferencia'){
      if(e.origen in map) map[e.origen] -= e.amount;
      if(e.destino in map) map[e.destino] += e.amount;
      return;
    }
    if(!(e.paymentMethod in map)) return;
    if(e.type === 'ingreso' || e.type === 'capital') map[e.paymentMethod] += e.amount;
    else if(e.type === 'gasto' || e.type === 'abono' || e.type === 'cajachica') map[e.paymentMethod] -= e.amount;
  });
  Object.keys(map).forEach(k => { map[k] = r2(map[k]); });
  return map;
}
/* Compara los saldos actuales contra los que quedarían si se aplicara un cambio.
   Devuelve un mensaje en español si el cambio dejaría una cuenta en negativo
   o alteraría una cuenta ya cerrada; null si el cambio es seguro. */
function balanceProblem(nextEntries){
  const before = balancesMap(state.entries);
  const after = balancesMap(nextEntries);
  for(const m of state.paymentMethods){
    const b = before[m.id], a = after[m.id];
    if(a === b) continue;
    if(m.status === 'archived') return `La cuenta "${m.name}" está cerrada y su saldo no puede cambiar. Este movimiento está ligado a ella.`;
    if(a < 0 && a < b) return `Este cambio dejaría la cuenta "${m.name}" con saldo negativo (${fmt(a)}). Primero ajusta los gastos o transferencias que dependen de ese dinero.`;
  }
  return null;
}

/* ---------- avisos y confirmaciones ---------- */
function askConfirm(opts){ state.confirmModal = opts; render(); }
function showNotice(title, text){ state.confirmModal = { title, text, alertOnly: true }; render(); }
function closeConfirm(){ state.confirmModal = null; render(); }
function runConfirm(){
  const m = state.confirmModal;
  state.confirmModal = null;
  if(m && typeof m.onConfirm === 'function') m.onConfirm(); else render();
}
function renderConfirmModal(){
  const m = state.confirmModal;
  if(!m) return '';
  const body = esc(m.text || '').replace(/\n/g, '<br>');
  const actions = m.alertOnly
    ? `<button type="button" class="btn-save" style="--chip-color:#636366;" data-confirm-cancel>Entendido</button>`
    : `<button type="button" class="btn-save" style="--chip-color:${m.safe ? 'var(--c-transferencia)' : 'var(--c-gasto)'};" data-confirm-ok>${esc(m.confirmLabel || 'Confirmar')}</button>
       <button type="button" class="btn-save" style="--chip-color:#636366;" data-confirm-cancel>Cancelar</button>`;
  return `
  <div class="pm-modal-overlay">
    <div class="pm-modal-box">
      <p class="pm-modal-title">${esc(m.title)}</p>
      <p class="pm-modal-text">${body}</p>
      <div class="pm-modal-actions">${actions}</div>
    </div>
  </div>`;
}
function describeEntry(e){
  const c = catById(e.type);
  return `${c ? c.label : 'Movimiento'} · ${fmt(e.amount)} · ${fmtDate(e.date)}${e.detail ? ' · ' + e.detail : ''}`;
}

/* ---------- validación de respaldos importados ---------- */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/* Datos de la fase anterior: el capital inicial se guardaba como un ingreso. Se reconoce por su
   detalle y descripción exactos, para no tocar ingresos que el usuario haya capturado a mano. */
function migrateLegacyCapital(entries){
  entries.forEach(e => {
    if(e && e.type === 'ingreso' && e.detail === 'Capital inicial' && typeof e.description === 'string' && e.description.startsWith('Balance inicial de ')) e.type = 'capital';
  });
}
const strOf = (v, max) => (typeof v === 'string' ? v.slice(0, max || 300) : '');
function sanitizeBackup(p){
  if(!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if(!Array.isArray(p.entries) && !Array.isArray(p.debts) && !Array.isArray(p.paymentMethods)) return null;
  const REMOVED_TYPES = new Set(['inversion','impuesto','ajuste_cierre']);
  if(Array.isArray(p.entries)) migrateLegacyCapital(p.entries);
  const unsupported = (Array.isArray(p.entries) ? p.entries : []).filter(e => e && REMOVED_TYPES.has(e.type)).length;
  if(unsupported) return { unsupported };
  let dropped = 0;
  const validTypes = new Set(CATEGORIES.map(c => c.id));

  const paymentMethods = [], pmIds = new Set();
  (Array.isArray(p.paymentMethods) ? p.paymentMethods : []).forEach(m => {
    const name = m && typeof m === 'object' ? strOf(m.name, 60).trim() : '';
    if(!name || typeof m.id !== 'string' || !m.id || pmIds.has(m.id)){ dropped++; return; }
    pmIds.add(m.id);
    paymentMethods.push({
      id: m.id, name,
      color: HEX_COLOR.test(m.color) ? m.color : '#636366',
      icon: PM_ICONS.some(i => i.id === m.icon) ? m.icon : 'none',
      status: m.status === 'archived' ? 'archived' : 'active',
    });
  });

  const debts = [], debtIds = new Set();
  (Array.isArray(p.debts) ? p.debts : []).forEach(d => {
    const name = d && typeof d === 'object' ? strOf(d.name, 100).trim() : '';
    const amount = d ? r2(d.amount) : NaN;
    if(!name || typeof d.id !== 'string' || !d.id || debtIds.has(d.id) || !isFinite(amount) || amount <= 0 || !ISO_DATE.test(d.date)){ dropped++; return; }
    debtIds.add(d.id);
    debts.push({ id: d.id, name, amount, date: d.date });
  });

  const entries = [], entryIds = new Set();
  (Array.isArray(p.entries) ? p.entries : []).forEach(e => {
    const amount = e && typeof e === 'object' ? r2(e.amount) : NaN;
    if(!e || typeof e.id !== 'string' || !e.id || entryIds.has(e.id) || !validTypes.has(e.type) || !isFinite(amount) || amount <= 0 || !ISO_DATE.test(e.date)){ dropped++; return; }
    entryIds.add(e.id);
    const clean = { id: e.id, type: e.type, amount, date: e.date, detail: strOf(e.detail), description: strOf(e.description, 500) };
    if(typeof e.paymentMethod === 'string') clean.paymentMethod = e.paymentMethod;
    if(typeof e.debtId === 'string') clean.debtId = e.debtId;
    if(typeof e.origen === 'string') clean.origen = e.origen;
    if(typeof e.destino === 'string') clean.destino = e.destino;
    if(typeof e.comisionEntryId === 'string') clean.comisionEntryId = e.comisionEntryId;
    if(e.locked === true) clean.locked = true;
    entries.push(clean);
  });
  /* Respaldos antiguos sin categorías: se crean las predeterminadas. */
  const categories = Array.isArray(p.categories) ? sanitizeCategories(p.categories) : seedCategories();
  return { entries, debts, paymentMethods, categories, dropped };
}

/* ---------- persistencia ---------- */
/* window.storage lo expone preload.js vía IPC hacia main.js, que cifra y
   guarda en disco. Siempre existe en esta app de escritorio (Electron). */
async function storageGet(key){
  try{ const res = await window.storage.get(key, false); return res ? res.value : null; }
  catch(e){ console.error('storageGet falló:', e); return null; }
}
async function storageSet(key, value){
  try{ await window.storage.set(key, value, false); return true; }
  catch(e){ console.error('storageSet falló:', e); return false; }
}

async function loadAll(){
  const raw = await storageGet('data');
  let parsed = {};
  if(raw){
    try{
      parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('formato inesperado');
    }catch(e){
      /* Hay datos guardados pero no se pueden leer: NO se debe sobrescribir el archivo. */
      console.error('Datos guardados ilegibles:', e);
      state.loadError = true;
      parsed = {};
    }
  }
  const onlyObjects = a => (Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object');
  state.entries = onlyObjects(parsed.entries);
  migrateLegacyCapital(state.entries);
  state.debts = onlyObjects(parsed.debts);
  state.paymentMethods = onlyObjects(parsed.paymentMethods).map(m => ({ ...m, status: m.status || 'active' }));
  /* Datos de versiones anteriores no traen categorías: se crean las predeterminadas. */
  state.categories = Array.isArray(parsed.categories) ? sanitizeCategories(parsed.categories) : seedCategories();
  normalizeTransfers();
}
/* Los guardados se encolan para que nunca se pisen entre sí. Si falla, el aviso
   aparece después del mensaje de éxito y permanece más tiempo. Como cada guardado
   escribe TODO el estado, el siguiente guardado exitoso recupera lo pendiente. */
let saveChain = Promise.resolve(true);
function saveAll(){
  if(state.loadError){
    showToast('No se guardó: tus datos guardados no se pudieron leer. Reinicia la app o importa un respaldo.', 7000);
    return Promise.resolve(false);
  }
  const payload = JSON.stringify({ entries: state.entries, debts: state.debts, paymentMethods: state.paymentMethods, categories: state.categories });
  /* Si un guardado anterior falló, la cadena queda rechazada: se recupera para
     que el siguiente guardado vuelva a intentarlo (cada uno escribe todo). */
  saveChain = saveChain.catch(() => false).then(async () => {
    const ok = await storageSet('data', payload);
    if(!ok) showToast('No se pudo guardar. Tus cambios siguen en pantalla: exporta un respaldo desde Inicio.', 7000);
    return ok;
  });
  return saveChain;
}
async function loadTheme(){
  const raw = await storageGet('theme');
  /* La identidad de Metría es oscura; el tema claro sigue disponible. */
  state.theme = raw === 'light' ? 'light' : 'dark';
  state.hideBalance = (await storageGet('hidebalance')) === '1';
  state.flowStyle = (await storageGet('flowstyle')) === 'barras' ? 'barras' : 'linea';
  const sc = parseFloat(await storageGet('uiscale'));
  state.uiScale = UI_SCALES.includes(sc) ? sc : 1;
  applyTheme();
  applyUiScale();
}
async function saveFlowStyle(){ await storageSet('flowstyle', state.flowStyle); }
async function saveHideBalance(){ await storageSet('hidebalance', state.hideBalance ? '1' : '0'); }
async function saveTheme(){ await storageSet('theme', state.theme); }
function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.theme);
  /* Los íconos de la barra de estado deben contrastar con el tema de la app. */
  if(window.systemBars) window.systemBars.setTheme(state.theme);
}
/* Tamaño de la vista: 1x es el tamaño original; escala textos, elementos y secciones. */
const UI_SCALES = [0.6, 0.85, 1, 1.15, 1.3];
const uiScaleLabel = v => (v === 1 ? '1' : v.toFixed(2)) + 'x';
async function saveUiScale(){ await storageSet('uiscale', String(state.uiScale)); }
function applyUiScale(){
  const z = document.documentElement.style;
  z.zoom = state.uiScale === 1 ? '' : String(state.uiScale);
  z.setProperty('--ui-zoom', String(state.uiScale));
}
function setUiScale(v){
  const n = parseFloat(v);
  if(!UI_SCALES.includes(n)) return;
  state.uiScale = n;
  applyUiScale();
  saveUiScale();
  render();
}

/* ---------- respaldo manual ---------- */
function triggerDownload(text, filename){
  /* En Android el <a download> del WebView no guarda archivos: la capa de plataforma
     abre la hoja de compartir para que el usuario lo guarde en Archivos/Drive. */
  if (window.MetriaPlatform && typeof window.MetriaPlatform.saveFile === 'function') {
    window.MetriaPlatform.saveFile(text, filename).catch(e => console.error('No se pudo exportar:', e));
    return;
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function backupPayload(){ return JSON.stringify({ entries: state.entries, debts: state.debts, paymentMethods: state.paymentMethods, categories: state.categories }); }

/* El respaldo se cifra en el proceso principal con una contraseña propia del respaldo.
   Ya no se exporta nada en texto plano. Los respaldos antiguos sin cifrar siguen pudiendo importarse. */
function exportBackup(){ state.pwModal = { mode: 'export', error: '' }; render(); }

function renderPwModal(){
  const m = state.pwModal;
  if(!m) return '';
  const isExp = m.mode === 'export';
  return `
  <div class="pm-modal-overlay">
    <div class="pm-modal-box">
      <p class="pm-modal-title">${isExp ? 'Proteger el respaldo' : 'Respaldo cifrado'}</p>
      <p class="pm-modal-text">${isExp
        ? 'Elige una contraseña para este archivo (mínimo 8 caracteres). <b>Sin ella no se podrá restaurar</b> y no se puede recuperar. Puede ser distinta a la de acceso a la app.'
        : 'Este respaldo está cifrado. Escribe la contraseña que le pusiste al exportarlo.'}</p>
      <form id="pw-form" autocomplete="off">
        <div class="field"><label>Contraseña del respaldo</label><input type="password" id="pw-main" autocomplete="off" required></div>
        ${isExp ? '<div class="field"><label>Confirmar contraseña</label><input type="password" id="pw-confirm" autocomplete="off" required></div>' : ''}
        <p class="pm-modal-text" style="color:var(--c-gasto);min-height:18px;">${esc(m.error || '')}</p>
        <div class="pm-modal-actions">
          <button type="submit" class="btn-save" style="--chip-color:var(--c-transferencia);">${isExp ? 'Exportar' : 'Descifrar'}</button>
          <button type="button" class="btn-save" style="--chip-color:#636366;" data-pw-cancel>Cancelar</button>
        </div>
      </form>
    </div>
  </div>`;
}
async function submitPwModal(ev){
  ev.preventDefault();
  const m = state.pwModal;
  if(!m || m.busy) return;
  const pw = document.getElementById('pw-main').value;
  m.busy = true;
  try{
    if(m.mode === 'export'){
      if(pw !== document.getElementById('pw-confirm').value){ m.error = 'Las contraseñas no coinciden.'; m.busy = false; render(); return; }
      const res = await window.backup.encrypt(backupPayload(), pw);
      if(!res || !res.ok){ m.error = (res && res.error) || 'No se pudo cifrar el respaldo.'; m.busy = false; render(); return; }
      state.pwModal = null;
      triggerDownload(res.file, 'metria-respaldo-' + todayISO() + '.json');
      showToast('Respaldo cifrado exportado.');
      render();
    } else {
      const res = await window.backup.decrypt(m.fileText, pw);
      if(!res || !res.ok){ m.error = (res && res.error) || 'No se pudo descifrar el respaldo.'; m.busy = false; render(); return; }
      let obj = null;
      try{ obj = JSON.parse(res.payload); }catch(e){ obj = null; }
      state.pwModal = null;
      processImport(obj);
    }
  }catch(e){
    console.error(e);
    m.error = 'No se pudo completar la operación.'; m.busy = false; render();
  }
}

function importBackup(ev){
  const input = ev.target;
  const file = input.files[0];
  if(!file) return;
  if(file.size > 20 * 1024 * 1024){
    input.value = '';
    showNotice('Archivo demasiado grande', 'Ese archivo no parece un respaldo de Metría.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    input.value = '';
    let obj = null;
    try{ obj = JSON.parse(reader.result); }catch(e){ obj = null; }
    if(obj && obj.format === 'metria-backup'){
      state.pwModal = { mode: 'import', fileText: reader.result, error: '' };
      render();
      return;
    }
    processImport(obj);   // respaldo antiguo sin cifrar
  };
  reader.onerror = () => { input.value = ''; showNotice('No se pudo leer el archivo', 'Intenta de nuevo con otro archivo.'); };
  reader.readAsText(file);
}
function processImport(obj){
  let clean = null;
  try{ clean = sanitizeBackup(obj); }catch(e){ clean = null; }
  if(!clean){
    showNotice('Archivo no válido', 'Ese archivo no es un respaldo de Metría. Tus datos actuales no se tocaron.');
    return;
  }
  if(clean.unsupported){
    showNotice('Respaldo no compatible', `Este respaldo tiene ${clean.unsupported} movimiento${clean.unsupported===1?'':'s'} de tipos que Metría ya no admite (Inversión, Impuestos o ajustes de cierre). No se importó nada y tus datos actuales no se tocaron.`);
    return;
  }
  const bal = balancesMap(clean.entries, clean.paymentMethods);
  const negativa = clean.paymentMethods.find(m => bal[m.id] < 0);
  if(negativa){
    showNotice('Respaldo no válido', `En este respaldo la cuenta "${negativa.name}" quedaría con saldo negativo (${fmt(bal[negativa.id])}). Metría no admite cuentas en negativo, así que no se importó nada y tus datos actuales no se tocaron.`);
    return;
  }
  const hasCurrent = state.entries.length || state.debts.length || state.paymentMethods.length;
  let text = `El respaldo contiene ${clean.entries.length} movimiento${clean.entries.length===1?'':'s'}, ${clean.debts.length} deuda${clean.debts.length===1?'':'s'} y ${clean.paymentMethods.length} cuenta${clean.paymentMethods.length===1?'':'s'}.`;
  if(clean.dropped) text += `\nSe omitieron ${clean.dropped} registro${clean.dropped===1?'':'s'} dañado${clean.dropped===1?'':'s'}.`;
  text += `\nTus datos actuales serán reemplazados por completo.`;
  if(hasCurrent) text += `\nAntes se guardará una copia cifrada de tus datos actuales en tu carpeta de respaldos automáticos.`;
  askConfirm({ title: '¿Restaurar este respaldo?', text, confirmLabel: 'Restaurar', onConfirm: () => applyImport(clean) });
}
async function applyImport(clean){
  if(state.entries.length || state.debts.length || state.paymentMethods.length){
    let snap = null;
    try{ snap = await window.backup.snapshot(); }catch(e){ console.error(e); }
    if(!snap || !snap.ok){
      showNotice('No se pudo crear la copia de seguridad', 'Por seguridad no se importó nada y tus datos actuales no se tocaron.');
      return;
    }
  }
  state.entries = clean.entries;
  state.debts = clean.debts;
  state.paymentMethods = clean.paymentMethods;
  state.categories = clean.categories;
  state.editingCatId = null;
  state.loadError = false;
  state.editingEntryId = null; state.editingTransferId = null; state.editingDebtId = null;
  state.editingPmId = null; state.pmCloseModal = null;
  normalizeTransfers();
  saveAll();
  showToast('Respaldo restaurado.');
  render();
}
function toggleTheme(){
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveTheme();
  render();
}

function showToast(msg, ms){
  /* El aviso vive fuera de #app, pero se crea si falta para que un fallo de la
     interfaz nunca interrumpa la acción que lo muestra (por ejemplo, guardar). */
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._h);
  showToast._h = setTimeout(()=>t.classList.remove('show'), ms || 1800);
}

/* ---------- periodos ---------- */
/* Número de semana ISO 8601 (semanas de lunes a domingo; la semana 1 es la que contiene el primer jueves del año). */
function isoWeek(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay()+6)%7) + 3);
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - jan4)/86400000 - 3 + ((jan4.getUTCDay()+6)%7)) / 7);
}
function getPeriodRange(gran, ref){
  const d = new Date(ref);
  if(gran === 'dia'){
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
    return { start, end, label: cap(d.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long'})) };
  }
  if(gran === 'semana'){
    const dow = (d.getDay()+6)%7;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()-dow);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate()+6, 23,59,59,999);
    const label = 'Semana ' + isoWeek(start) + ' · ' + start.toLocaleDateString('es-ES',{day:'numeric',month:'short'}) + ' – ' + end.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
    return { start, end, label };
  }
  if(gran === 'quincena'){
    const isFirst = d.getDate() <= 15;
    const start = new Date(d.getFullYear(), d.getMonth(), isFirst ? 1 : 16);
    const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    const end = new Date(d.getFullYear(), d.getMonth(), isFirst ? 15 : lastDay, 23,59,59,999);
    const label = (isFirst ? '1ª' : '2ª') + ' quincena · ' + cap(d.toLocaleDateString('es-ES',{month:'long',year:'numeric'}));
    return { start, end, label };
  }
  if(gran === 'año'){
    const start = new Date(d.getFullYear(),0,1);
    const end = new Date(d.getFullYear(),11,31,23,59,59,999);
    return { start, end, label: String(d.getFullYear()) };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
  return { start, end, label: cap(d.toLocaleDateString('es-ES',{month:'long',year:'numeric'})) };
}
function shiftRef(gran, ref, dir){
  const d = new Date(ref);
  if(gran==='dia') d.setDate(d.getDate()+dir);
  else if(gran==='semana') d.setDate(d.getDate()+7*dir);
  else if(gran==='quincena'){
    if(dir>0){ if(d.getDate()<=15) d.setDate(16); else { d.setMonth(d.getMonth()+1); d.setDate(1); } }
    else{ if(d.getDate()>15) d.setDate(15); else { d.setMonth(d.getMonth()-1); d.setDate(16); } }
  }
  else if(gran==='mes') d.setMonth(d.getMonth()+dir);
  else if(gran==='año') d.setFullYear(d.getFullYear()+dir);
  return d;
}
function entriesInRange(start, end){
  return state.entries.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d >= start && d <= end;
  });
}
function monthRange(ref){
  const d = new Date(ref);
  return { start:new Date(d.getFullYear(),d.getMonth(),1), end:new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999) };
}
function debtBalance(debtId, excludeEntryId){
  const debt = state.debts.find(d => d.id === debtId);
  if(!debt) return 0;
  const paid = state.entries.filter(e => e.type==='abono' && e.debtId===debtId && e.id!==excludeEntryId).reduce((s,e)=>s+e.amount,0);
  return r2(debt.amount - paid);
}
/* Balance global: flujo neto acumulado desde el primer movimiento capturado hasta el
   cierre del mes actual. Ingresos − gastos − caja chica − abonos; deudas y transferencias valen 0. */
/* DEFINICIÓN ÚNICA (todas las pantallas):
   entra = Ingreso · sale = Gasto + Caja chica + Abono · Transferencias y Deudas no mueven dinero
   (la comisión de una transferencia es un Gasto aparte) · Capital inicial = saldo de apertura. */
function flowSplit(items){
  const t = { ingreso:0, gasto:0, cajachica:0, abono:0 };
  items.forEach(e => { if(e.type in t) t[e.type] += e.amount; });
  const ingresos = r2(t.ingreso), gastos = r2(t.gasto), cajachica = r2(t.cajachica), abonos = r2(t.abono);
  const salidas = r2(gastos + cajachica + abonos);
  return { ingresos, gastos, cajachica, abonos, salidas, neto: r2(ingresos - salidas) };
}
/* Balance actual: todo lo registrado HASTA HOY. Lo de fecha posterior se muestra aparte como programado. */
function globalBalanceInfo(){
  const hoy = todayISO();
  const t = { capital:0, ingreso:0, gasto:0, cajachica:0, abono:0 };
  let total = 0, programado = 0;
  state.entries.forEach(e => {
    const c = catById(e.type); if(!c) return;
    if(e.date > hoy){ programado += c.sign * e.amount; return; }
    total += c.sign * e.amount;
    if(e.type in t) t[e.type] += e.amount;
  });
  const first = state.entries.reduce((m, e) => (!m || e.date < m) ? e.date : m, null);
  return { total: r2(total), first, capital: r2(t.capital), ingresos: r2(t.ingreso), gastos: r2(t.gasto), cajachica: r2(t.cajachica), abonos: r2(t.abono), programado: r2(programado) };
}
function totalDebtPending(){
  return r2(state.debts.reduce((s,d) => s + debtBalance(d.id), 0));
}

/* ---------- cuentas disponibles ---------- */
function addPaymentMethod(ev){
  ev.preventDefault();
  const form = ev.target;
  const name = form.name.value.trim();
  if(!name){ return; }
  if(state.paymentMethods.some(m => m.name.toLowerCase() === name.toLowerCase())){
    showToast('Ese método ya existe.');
    return;
  }
  const capitalRaw = String(form.capital.value ?? '').trim().replace(',', '.');
  const capital = Number(capitalRaw);
  if(capitalRaw === '' || !isFinite(capital) || capital < 0 || capital > 999999999999.99){
    showToast('Indica el balance actual de la cuenta (puede ser 0).');
    return;
  }
  const pmId = uid();
  state.paymentMethods.push({ id: pmId, name, color: state.newPmColor, icon: state.newPmIcon, status: 'active' });
  if(r2(capital) > 0){
    state.entries.unshift({ id: uid(), type:'capital', amount: r2(capital), paymentMethod: pmId, date: todayISO(), detail:'Capital inicial', description: `Balance inicial de "${name}"` });
  }
  saveAll();
  form.reset();
  state.newPmName = '';
  state.newPmCapital = '';
  state.newPmColor = PM_COLORS[0];
  state.newPmIcon = 'none';
  showToast('Cuenta disponible agregada.');
  render();
}
function selectNewPmColor(c){ state.newPmColor = c; render(); }
function selectNewPmIcon(i){ state.newPmIcon = i; render(); }

/* ---------- cierre / archivado de cuentas disponibles ----------
   Nunca se eliminan movimientos históricos ni se borra la cuenta disponible
   del arreglo: solo se marca como "archived" una vez que su saldo llega a $0
   mediante una transferencia o un movimiento de ajuste de cierre. */
function activePaymentMethods(){
  return state.paymentMethods.filter(m => m.status !== 'archived');
}
function requestClosePaymentMethod(id){
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m) return;
  const balance = pmAvailableBalance(id);
  if(balance === 0) state.pmCloseModal = { id, step:'zero', balance };
  else if(balance > 0) state.pmCloseModal = { id, step:'positive', balance };
  else state.pmCloseModal = { id, step:'negative', balance };
  render();
}
function closePmCloseModal(){ state.pmCloseModal = null; render(); }
function pmCloseModalShowTransfer(){
  if(!state.pmCloseModal) return;
  state.pmCloseModal.step = 'transfer';
  render();
}
function pmCloseModalShowRemove(){
  if(!state.pmCloseModal) return;
  state.pmCloseModal.step = 'removeConfirm';
  render();
}
function pmCloseModalBack(){
  if(!state.pmCloseModal) return;
  state.pmCloseModal.step = 'positive';
  render();
}
function confirmArchiveZeroBalance(){
  if(!state.pmCloseModal) return;
  const id = state.pmCloseModal.id;
  archivePaymentMethod(id);
}
function handleTransferCloseSubmit(ev){
  ev.preventDefault();
  if(!state.pmCloseModal) return;
  const form = ev.target;
  const sourceId = state.pmCloseModal.id;
  const destinationId = form.destino.value;
  if(!destinationId){ showToast('Selecciona una cuenta destino.'); return; }
  transferAndArchivePaymentMethod(sourceId, destinationId);
}
/* Cada función de cierre recalcula el saldo por su cuenta y valida todo de nuevo:
   ninguna confía en un saldo calculado previamente por otra función (el estado
   pudo cambiar mientras el modal estaba abierto). */
function transferAndArchivePaymentMethod(sourceId, destinationId){
  if(!sourceId || !destinationId){ showToast('Selecciona una cuenta destino.'); return; }
  if(destinationId === sourceId){ showToast('Origen y destino deben ser distintos.'); return; }
  const origen = state.paymentMethods.find(x => x.id === sourceId);
  const destino = state.paymentMethods.find(x => x.id === destinationId);
  if(!origen || !destino){ showToast('Cuenta no encontrada.'); state.pmCloseModal = null; render(); return; }
  if(destino.status === 'archived'){ showToast('La cuenta destino está cerrada. Selecciona otra.'); return; }
  const balance = pmAvailableBalance(sourceId);
  if(balance <= 0){
    showToast('Esta cuenta ya no tiene saldo por transferir.');
    state.pmCloseModal = null;
    render();
    return;
  }
  const date = todayISO();
  const origenName = pmRawName(sourceId);
  const destinoName = pmRawName(destinationId);
  state.entries.unshift({ id: uid(), type:'transferencia', amount: balance, origen: sourceId, destino: destinationId, date, detail: origenName + ' → ' + destinoName + ' (cierre de cuenta)', comisionEntryId: null });
  archivePaymentMethod(sourceId);
}
function confirmRemoveBalance(){
  if(!state.pmCloseModal) return;
  removeBalanceAndArchivePaymentMethod(state.pmCloseModal.id);
}
function removeBalanceAndArchivePaymentMethod(id){
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m){ state.pmCloseModal = null; render(); return; }
  const balance = pmAvailableBalance(id); /* recalculado aquí mismo, no se recibe como parámetro */
  if(balance <= 0){
    showToast('Esta cuenta ya no tiene saldo por eliminar.');
    state.pmCloseModal = null;
    render();
    return;
  }
  const date = todayISO();
  /* Se registra como un gasto real (no como un ajuste invisible): así el monto
     eliminado queda visible en Resumen y en el historial de Gastos, cargado
     a la cuenta que se está archivando. locked:true impide que se edite o se
     borre después, para que no se pueda "revivir" saldo en una cuenta cerrada. */
  state.entries.unshift({ id: uid(), type:'gasto', amount: balance, paymentMethod: id, date, detail:'Saldo descontado por cuenta eliminada', description: `Saldo eliminado al cerrar "${m.name}"`, locked: true });
  archivePaymentMethod(id);
}
function archivePaymentMethod(id){
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m) return;
  const balance = pmAvailableBalance(id); /* nunca cerrar con saldo distinto de cero, recalculado aquí también */
  if(balance !== 0){
    showToast('No se puede cerrar esta cuenta porque todavía tiene un saldo pendiente.');
    state.pmCloseModal = null;
    render();
    return;
  }
  m.status = 'archived';
  state.editingPmId = null;
  state.pmCloseModal = null;
  saveAll();
  showToast('Cuenta cerrada. Tu historial se conserva.');
  render();
}
function renderPmCloseModal(){
  const modal = state.pmCloseModal;
  if(!modal) return '';
  const m = state.paymentMethods.find(x => x.id === modal.id);
  if(!m){ return ''; }
  const balance = pmAvailableBalance(modal.id);

  let inner = '';
  if(modal.step === 'zero'){
    inner = `
      <p class="pm-modal-title">¿Cerrar "${esc(m.name)}"?</p>
      <p class="pm-modal-text">Esta cuenta tiene un saldo de ${fmt(0)}.<br><b>Los movimientos históricos no se eliminarán.</b></p>
      <div class="pm-modal-actions">
        <button type="button" class="btn-save" style="--chip-color:var(--c-gasto);" data-pmclose-confirmzero>Cerrar cuenta</button>
        <button type="button" class="btn-save" style="--chip-color:#636366;" data-pmclose-cancel>Cancelar</button>
      </div>`;
  } else if(modal.step === 'positive'){
    inner = `
      <p class="pm-modal-title">¿Qué deseas hacer con "${esc(m.name)}"?</p>
      <p class="pm-modal-text">Esta cuenta tiene actualmente:</p>
      <p class="pm-modal-figure">${fmt(balance)}</p>
      <p class="pm-modal-text"><b>Tus movimientos históricos no se eliminarán.</b><br>Si <b>transfieres</b> el saldo, se mueve completo a otra cuenta activa y lo conservas.<br>Si lo <b>eliminas</b>, ese monto se elimina junto con la cuenta: se registrará como un gasto llamado "Saldo descontado por cuenta eliminada" y saldrá permanentemente de tu balance total.</p>
      <div class="pm-modal-actions">
        <button type="button" class="btn-save" style="--chip-color:var(--c-transferencia);" data-pmclose-transfer>Transferir saldo</button>
        <button type="button" class="btn-save" style="--chip-color:var(--c-gasto);" data-pmclose-remove>Eliminar saldo y cerrar</button>
        <button type="button" class="btn-save" style="--chip-color:#636366;" data-pmclose-cancel>Cancelar</button>
      </div>`;
  } else if(modal.step === 'transfer'){
    const destOptions = activePaymentMethods().filter(x => x.id !== modal.id).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    inner = `
      <p class="pm-modal-title">Transferir saldo de "${esc(m.name)}"</p>
      <p class="pm-modal-text">Saldo disponible:</p>
      <p class="pm-modal-figure">${fmt(balance)}</p>
      <form id="pm-close-transfer-form">
        <div class="field"><label>Selecciona la cuenta destino</label><select name="destino" required><option value="" disabled selected>Selecciona una cuenta</option>${destOptions}</select></div>
        <div class="pm-modal-actions">
          <button type="submit" class="btn-save" style="--chip-color:var(--c-transferencia);">Transferir y cerrar</button>
          <button type="button" class="btn-save" style="--chip-color:#636366;" data-pmclose-back>Cancelar</button>
        </div>
      </form>`;
  } else if(modal.step === 'removeConfirm'){
    inner = `
      <p class="pm-modal-title">Eliminar saldo de "${esc(m.name)}"</p>
      <p class="pm-modal-text">Saldo actual:</p>
      <p class="pm-modal-figure">${fmt(balance)}</p>
      <p class="pm-modal-text">Este monto se eliminará junto con la cuenta: se registrará un gasto llamado <b>"Saldo descontado por cuenta eliminada"</b> por ${fmt(balance)}, cargado a "${esc(m.name)}".<br><b>Tus movimientos históricos no se eliminarán</b>, pero este dinero saldrá permanentemente de tu balance total.<br>Esta acción no se puede deshacer automáticamente.</p>
      <div class="pm-modal-actions">
        <button type="button" class="btn-save" style="--chip-color:var(--c-gasto);" data-pmclose-confirmremove>Confirmar y cerrar cuenta</button>
        <button type="button" class="btn-save" style="--chip-color:#636366;" data-pmclose-back>Cancelar</button>
      </div>`;
  } else if(modal.step === 'negative'){
    inner = `
      <p class="pm-modal-title">"${esc(m.name)}" tiene saldo negativo</p>
      <p class="pm-modal-text">Esta cuenta tiene un saldo negativo de ${fmt(balance)}.<br>Para cerrar la cuenta primero debes resolver el saldo pendiente.</p>
      <div class="pm-modal-actions">
        <button type="button" class="btn-save" style="--chip-color:#636366;" data-pmclose-cancel>Cancelar</button>
      </div>`;
  }

  return `
  <div class="pm-modal-overlay">
    <div class="pm-modal-box">${inner}</div>
  </div>`;
}
function startEditPm(id){
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m) return;
  state.editingPmId = id;
  state.editPmColor = m.color || PM_COLORS[0];
  state.editPmIcon = m.icon || 'none';
  render();
}
function cancelEditPm(){ state.editingPmId = null; render(); }
function selectEditPmColor(c){ state.editPmColor = c; render(); }
function selectEditPmIcon(i){ state.editPmIcon = i; render(); }
function savePmEdit(ev, id){
  ev.preventDefault();
  const form = ev.target;
  const name = form.name.value.trim();
  if(!name){ showToast('El nombre no puede estar vacío.'); return; }
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m) return;
  m.name = name;
  m.color = state.editPmColor;
  m.icon = state.editPmIcon;
  state.editingPmId = null;
  saveAll();
  showToast('Cuenta disponible actualizada.');
  render();
}
function paymentMethodOptions(){
  return activePaymentMethods().map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
}
function paymentMethodName(id){
  const m = state.paymentMethods.find(x => x.id === id);
  if(!m) return '';
  return m.status === 'archived' ? esc(m.name) + ' · Cuenta archivada' : esc(m.name);
}
function paymentMethodBalances(asOf){
  /* Calcula el saldo histórico de TODAS las cuentas, activas y archivadas:
     los movimientos históricos siguen apuntando al id original y no deben perderse. */
  return state.paymentMethods.map(m => {
    const bal = state.entries.reduce((sum, e) => {
      if(asOf && e.date > asOf) return sum;
      if(e.type === 'transferencia'){
        if(e.origen === m.id) sum -= e.amount;
        if(e.destino === m.id) sum += e.amount;
        return sum;
      }
      if(e.paymentMethod !== m.id) return sum;
      if(e.type === 'ingreso' || e.type === 'capital') return sum + e.amount;
      if(e.type === 'gasto' || e.type === 'abono' || e.type === 'cajachica') return sum - e.amount;
      return sum;
    }, 0);
    return { id: m.id, name: m.name, color: pmColor(m), icon: m.icon || 'none', status: m.status || 'active', balance: r2(bal) };
  });
}
function paymentMethodPercentages(){
  const balances = paymentMethodBalances();
  const positiveSum = balances.reduce((s,m) => s + Math.max(0, m.balance), 0);
  return balances.map(m => ({
    ...m,
    pct: (m.balance <= 0 || positiveSum <= 0) ? 0 : (m.balance / positiveSum * 100),
  }));
}
function totalBalanceAllAccounts(){
  return paymentMethodBalances().reduce((s,m) => s + m.balance, 0);
}
/* Saldo de una cuenta disponible, opcionalmente ignorando ciertos movimientos
   (se usa al editar, para no contar el movimiento que se está reemplazando). */
function pmAvailableBalance(pmId, excludeEntryIds){
  return r2(pmAvailableBalanceRaw(pmId, excludeEntryIds));
}
function pmAvailableBalanceRaw(pmId, excludeEntryIds){
  const exclude = new Set(excludeEntryIds || []);
  return state.entries.reduce((sum, e) => {
    if(exclude.has(e.id)) return sum;
    if(e.type === 'transferencia'){
      if(e.origen === pmId) sum -= e.amount;
      if(e.destino === pmId) sum += e.amount;
      return sum;
    }
    if(e.paymentMethod !== pmId) return sum;
    if(e.type === 'ingreso' || e.type === 'capital') return sum + e.amount;
    if(e.type === 'gasto' || e.type === 'abono' || e.type === 'cajachica') return sum - e.amount;
    return sum;
  }, 0);
}
const SALDO_INSUFICIENTE = 'No cuentas con suficiente saldo en esa cuenta.';
function pmColorPicker(selectedColor, onSelectFnName){
  return `<div class="pm-color-picker">${PM_COLORS.map(c => `
    <button type="button" class="pm-swatch ${c===selectedColor?'active':''}" style="background:${c}" data-pmcolor="${c}" data-pmcolor-fn="${onSelectFnName}" title="${c}"></button>`).join('')}</div>`;
}
function pmIconPicker(selectedIcon, onSelectFnName){
  return `<div class="pm-icon-picker">${PM_ICONS.map(i => `
    <button type="button" class="pm-icon-opt ${i.id===selectedIcon?'active':''}" data-pmicon="${i.id}" data-pmicon-fn="${onSelectFnName}">
      <span class="glyph">${i.glyph || '—'}</span><span class="lbl">${i.label}</span>
    </button>`).join('')}</div>`;
}

/* ---------- ajustes: borrar todos los datos ---------- */
function requestWipeData(){ state.wipeModalOpen = true; render(); }
function cancelWipeData(){ state.wipeModalOpen = false; render(); }
function confirmWipeData(){
  /* Reinicia la app a cero: movimientos, deudas y cuentas
     (activas y archivadas). El tema (claro/oscuro) y el tamaño de la vista se conservan
     a propósito, ya que son preferencias de apariencia, no datos financieros. */
  state.entries = [];
  state.debts = [];
  
  state.paymentMethods = [];
  state.categories = seedCategories();
  state.editingCatId = null;
  state.activeCategory = 'ingreso';
  state.soloTotal = false;
  state.isLoan = false;
  state.granularity = 'mes';
  state.refDate = new Date();
  state.newPmName = '';
  state.newPmCapital = '';
  state.newPmColor = PM_COLORS[0];
  state.newPmIcon = 'none';
  state.editingPmId = null;
  state.editPmColor = PM_COLORS[0];
  state.editPmIcon = 'none';
  state.editingEntryId = null;
  state.editingTransferId = null;
  state.editingDebtId = null;
  state.pmCloseModal = null;
  state.wipeModalOpen = false;
  state.confirmModal = null;
  state.loadError = false;
  state.page = 'home';
  saveAll();
  showToast('Todos tus datos fueron eliminados.');
  render();
}
function renderWipeModal(){
  if(!state.wipeModalOpen) return '';
  return `
  <div class="pm-modal-overlay">
    <div class="pm-modal-box">
      <p class="pm-modal-title">¿Borrar todos tus datos?</p>
      <p class="pm-modal-text">Esta acción es <b>permanente y no se puede deshacer</b>.<br>Se eliminarán todos tus movimientos, deudas y cuentas (activas y archivadas). La app quedará como si iniciara de cero.<br>Si quieres conservar algo, cancela y exporta un respaldo primero desde Inicio → Respaldo.</p>
      <div class="pm-modal-actions">
        <button type="button" class="btn-save" style="--chip-color:var(--c-gasto);" data-wipe-confirm>Borrar</button>
        <button type="button" class="btn-save" style="--chip-color:#636366;" data-wipe-cancel>Cancelar</button>
      </div>
    </div>
  </div>`;
}

/* ---------- eventos ---------- */
function goHome(){ state.page = 'home'; render(); }
function setPage(p){ if(p !== 'catadmin') state.editingCatId = null; state.page = p; render(); }
function selectCategory(id){ state.activeCategory = id; render(); }
function toggleSolo(){ state.soloTotal = !state.soloTotal; render(); }
function toggleLoan(){ state.isLoan = !state.isLoan; render(); }
function setGran(g){ state.granularity = g; render(); }
function navPeriod(dir){ state.refDate = shiftRef(state.granularity, state.refDate, dir); render(); }

/* ---------- Atrás y gestos de navegación ---------- */
const TAB_PAGES = ['home', 'resumen', 'categorias', 'ajustes'];

function hasOpenLayer(){
  return !!(state.confirmModal || state.pwModal || state.wipeModalOpen
    || state.pmCloseModal || state.sheet || state.cifra);
}

/* Cierra primero lo que esté encima (avisos, modales, hoja o desglose). */
function closeTopLayer(){
  if(state.confirmModal){ state.confirmModal = null; render(); return true; }
  if(state.pwModal){ state.pwModal = null; render(); return true; }
  if(state.wipeModalOpen){ state.wipeModalOpen = false; render(); return true; }
  if(state.pmCloseModal){ state.pmCloseModal = null; render(); return true; }
  if(state.sheet){ state.sheet = false; render(); return true; }
  if(state.cifra){ state.cifra = null; render(); return true; }
  return false;
}

/* Gesto/botón Atrás de Android. Devuelve false en Inicio para que la capa
   nativa minimice la app en vez de cerrarla de golpe. */
function handleBack(){
  if(closeTopLayer()) return true;
  if(state.page === 'home') return false;
  if(state.page === 'catadmin'){
    state.editingCatId = null;
    state.page = 'categorias';
  } else {
    state.page = 'home';
  }
  render();
  window.scrollTo(0, 0);
  return true;
}

/* Deslizar horizontalmente: entre las pestañas principales y, desde una
   subpágina, hacia la derecha para volver. Se ignora en controles, en la
   barra inferior, en las gráficas y en los bordes (los usa el sistema). */
let swipeStart = null;
function swipeIgnored(target){
  return !!(target && target.closest
    && target.closest('input, textarea, select, .pm-color-picker, .pm-icon-picker, .tabbar, .fc'));
}
function onSwipeStart(e){
  if(e.touches.length !== 1 || hasOpenLayer()){ swipeStart = null; return; }
  const t = e.touches[0];
  if(t.clientX < 32 || t.clientX > window.innerWidth - 32){ swipeStart = null; return; }
  if(swipeIgnored(e.target)){ swipeStart = null; return; }
  swipeStart = { x: t.clientX, y: t.clientY, at: Date.now() };
}
function onSwipeEnd(e){
  if(!swipeStart) return;
  const start = swipeStart;
  swipeStart = null;
  const t = e.changedTouches && e.changedTouches[0];
  if(!t || Date.now() - start.at > 800) return;
  const dx = t.clientX - start.x;
  const dy = t.clientY - start.y;
  if(Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
  if(hasOpenLayer()) return;
  const tab = TAB_PAGES.indexOf(state.page);
  if(tab !== -1){
    const next = TAB_PAGES[tab + (dx < 0 ? 1 : -1)];
    if(next){ setPage(next); window.scrollTo(0, 0); }
    return;
  }
  if(dx > 0) handleBack();
}
document.addEventListener('touchstart', onSwipeStart, { passive: true });
document.addEventListener('touchend', onSwipeEnd, { passive: true });

function handleSave(ev){
  ev.preventDefault();
  const form = ev.target;
  const monto = parseMoney(form.monto.value);
  if(!monto || monto <= 0){ showToast('Ingresa un monto válido.'); return; }
  const needsPaymentMethod = state.activeCategory === 'ingreso' || state.activeCategory === 'gasto' || state.activeCategory === 'cajachica';
  if(needsPaymentMethod){
    if(!state.paymentMethods.length){ showToast('Agrega una cuenta disponible antes de guardar.'); return; }
    if(!form.paymentMethod || !form.paymentMethod.value){ showToast('Selecciona una cuenta disponible.'); return; }
    if(state.activeCategory === 'gasto' || state.activeCategory === 'cajachica'){
      const disponible = pmAvailableBalance(form.paymentMethod.value);
      if(monto > disponible){ showToast(SALDO_INSUFICIENTE); return; }
    }
  }
  const isLoan = state.activeCategory === 'ingreso' && state.isLoan;
  const acreedor = isLoan && form.acreedor ? form.acreedor.value.trim() : '';
  if(isLoan && !acreedor){ showToast('Indica quién te prestó el dinero.'); return; }
  const date = form.fecha.value || todayISO();
  const entry = {
    id: uid(),
    type: state.activeCategory,
    amount: monto,
    date,
    detail: state.soloTotal ? 'Total del periodo' : (form.detail ? form.detail.value.trim() : ''),
    description: state.soloTotal ? '' : (form.description ? form.description.value.trim() : ''),
    paymentMethod: form.paymentMethod ? form.paymentMethod.value : '',
  };
  guardDuplicate(entry, () => {
    state.entries.unshift(entry);
    if(isLoan){
      const debt = { id: uid(), name: acreedor, amount: monto, date };
      state.debts.unshift(debt);
      state.entries.unshift({ id: uid(), type:'deuda', amount: monto, date, detail:acreedor, description:'Préstamo recibido', debtId: debt.id });
      state.isLoan = false;
    }
    saveAll();
    showToast('Movimiento guardado.');
    render();
  });
}
/* ---------- edición de movimientos ---------- */
function startEditEntry(id){
  const entry = state.entries.find(e => e.id === id);
  if(entry && entry.locked){ showToast('Este movimiento no se puede modificar.'); return; }
  state.editingEntryId = id;
  render();
}
function cancelEditEntry(){ state.editingEntryId = null; render(); }
function renderEntryEditForm(entry){
  const cat = catById(entry.type);
  if(entry.type === 'abono'){
    const selectable = debtsWithBalance().filter(d => d.balance > 0 || d.id === entry.debtId);
    const options = selectable.map(d => `<option value="${d.id}" ${d.id===entry.debtId?'selected':''}>${esc(d.name)}</option>`).join('');
    return `
    <form class="entry-edit-form" data-entryedit="${entry.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
      <div class="field"><label>¿A quién le debes?</label><select name="debtId" required>${options}</select></div>
      <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" value="${entry.amount}"></div>
      <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${entry.date}"></div>
      <div class="field"><label>Cuenta disponible</label><select name="paymentMethod" required>${state.paymentMethods.map(m=>`<option value="${m.id}" ${m.id===entry.paymentMethod?'selected':''} ${m.status==='archived' && m.id!==entry.paymentMethod?'disabled':''}>${paymentMethodName(m.id)}</option>`).join('')}</select></div>
      <div style="display:flex;gap:10px;">
        <button type="submit" class="btn-save" style="--chip-color:var(--c-abono)">Guardar</button>
        <button type="button" class="btn-save" data-entrycancel style="--chip-color:#636366;">Cancelar</button>
      </div>
    </form>`;
  }
  const showPM = entry.type === 'ingreso' || entry.type === 'gasto' || entry.type === 'cajachica';
  return `
  <form class="entry-edit-form" data-entryedit="${entry.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
    <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" value="${entry.amount}"></div>
    <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${entry.date}"></div>
    <div class="field"><label>${cat.detailLabel}</label>${(entry.type === 'ingreso' || entry.type === 'gasto') ? `<select name="detail">${categoryOptions(entry.type, entry.detail)}</select>` : `<input type="text" name="detail" value="${esc(entry.detail||'')}">`}</div>
    <div class="field"><label>Descripción</label><input type="text" name="description" value="${esc(entry.description||'')}"></div>
    ${showPM ? `<div class="field"><label>Cuenta disponible</label><select name="paymentMethod" required>${state.paymentMethods.map(m=>`<option value="${m.id}" ${m.id===entry.paymentMethod?'selected':''} ${m.status==='archived' && m.id!==entry.paymentMethod?'disabled':''}>${paymentMethodName(m.id)}</option>`).join('')}</select></div>` : ''}
    <div style="display:flex;gap:10px;">
      <button type="submit" class="btn-save" style="--chip-color:${cat.color}">Guardar</button>
      <button type="button" class="btn-save" data-entrycancel style="--chip-color:#636366;">Cancelar</button>
    </div>
  </form>`;
}
function saveEntryEdit(ev, id){
  ev.preventDefault();
  const form = ev.target;
  const entry = state.entries.find(e => e.id === id);
  if(!entry) return;
  const monto = parseMoney(form.monto.value);
  if(!monto || monto <= 0){ showToast('Ingresa un monto válido.'); return; }
  if(form.paymentMethod && !form.paymentMethod.value){ showToast('Selecciona una cuenta disponible.'); return; }
  if(form.debtId && !form.debtId.value){ showToast('Selecciona una deuda.'); return; }
  if(entry.type === 'gasto' || entry.type === 'cajachica' || entry.type === 'abono'){
    const pmId = form.paymentMethod ? form.paymentMethod.value : entry.paymentMethod;
    const disponible = pmAvailableBalance(pmId, [entry.id]);
    if(monto > disponible){ showToast(SALDO_INSUFICIENTE); return; }
  }
  if(entry.type === 'abono' && form.debtId){
    const pendienteEdit = debtBalance(form.debtId.value, entry.id);
    if(monto > pendienteEdit){ showToast('El abono no puede ser mayor a lo que debes.'); return; }
  }
  {
    const candidate = { ...entry, amount: monto, date: form.fecha.value || entry.date, paymentMethod: form.paymentMethod ? form.paymentMethod.value : entry.paymentMethod };
    const problem = balanceProblem(state.entries.map(e => e.id === entry.id ? candidate : e));
    if(problem){ showToast(problem, 7000); return; }
  }
  entry.amount = monto;
  entry.date = form.fecha.value || entry.date;
  if(form.paymentMethod) entry.paymentMethod = form.paymentMethod.value;
  if(form.debtId){
    entry.debtId = form.debtId.value;
    const d = state.debts.find(x => x.id === entry.debtId);
    entry.detail = d ? d.name : '';
  } else {
    if(form.detail) entry.detail = form.detail.value.trim();
    if(form.description) entry.description = form.description.value.trim();
  }
  state.editingEntryId = null;
  saveAll();
  showToast('Movimiento actualizado.');
  render();
}

/* ---------- edición de deudas / préstamos ---------- */
function startEditDebt(id){ state.editingDebtId = id; render(); }
function cancelEditDebt(){ state.editingDebtId = null; render(); }
function saveDebtEdit(ev, id){
  ev.preventDefault();
  const form = ev.target;
  const debt = state.debts.find(d => d.id === id);
  if(!debt) return;
  const name = form.name.value.trim();
  const monto = parseMoney(form.monto.value);
  if(!name || !monto || monto <= 0){ showToast('Completa a quién debes y el monto.'); return; }
  const alreadyPaid = r2(state.entries.filter(e => e.type === 'abono' && e.debtId === id).reduce((s,e) => s + e.amount, 0));
  if(monto < alreadyPaid){ showToast(`El monto no puede ser menor a lo que ya abonaste (${fmt(alreadyPaid)}).`, 6000); return; }
  debt.name = name;
  debt.amount = monto;
  debt.date = form.fecha.value || debt.date;
  const linkedEntry = state.entries.find(e => e.type === 'deuda' && e.debtId === id);
  if(linkedEntry){ linkedEntry.amount = monto; linkedEntry.detail = name; linkedEntry.date = debt.date; }
  state.editingDebtId = null;
  saveAll();
  showToast('Deuda actualizada. Si este préstamo también generó un ingreso, revísalo por separado en Capturar → Ingresos.');
  render();
}

/* ---------- edición de transferencias ---------- */
function startEditTransfer(id){ state.editingTransferId = id; render(); }
function cancelEditTransfer(){ state.editingTransferId = null; render(); }
function renderTransferEditForm(entry){
  const optionsFor = (currentId) => state.paymentMethods.map(m => `<option value="${m.id}" ${m.id===currentId?'selected':''} ${m.status==='archived' && m.id!==currentId?'disabled':''}>${paymentMethodName(m.id)}</option>`).join('');
  const comEntry = entry.comisionEntryId ? state.entries.find(e => e.id === entry.comisionEntryId) : null;
  return `
  <form class="transfer-edit-form" data-transferedit="${entry.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
    <div class="field"><label>Origen</label><select name="origen" required>${optionsFor(entry.origen)}</select></div>
    <div class="field"><label>Destino</label><select name="destino" required>${optionsFor(entry.destino)}</select></div>
    <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" value="${entry.amount}"></div>
    <div class="field"><label>Comisión por servicio (opcional)</label><input type="number" name="comision" step="0.01" min="0" inputmode="decimal" value="${comEntry ? comEntry.amount : ''}"></div>
    <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${entry.date}"></div>
    <div style="display:flex;gap:10px;">
      <button type="submit" class="btn-save" style="--chip-color:var(--c-transferencia)">Guardar</button>
      <button type="button" class="btn-save" data-transfercancel style="--chip-color:#636366;">Cancelar</button>
    </div>
  </form>`;
}
function saveTransferEdit(ev, id){
  ev.preventDefault();
  const form = ev.target;
  const entry = state.entries.find(e => e.id === id && e.type === 'transferencia');
  if(!entry) return;
  const origen = form.origen.value;
  const destino = form.destino.value;
  const monto = parseMoney(form.monto.value);
  const comision = parseMoney(form.comision.value);
  if(!origen || !destino){ showToast('Selecciona cuenta de origen y destino.'); return; }
  if(origen === destino){ showToast('Origen y destino deben ser distintos.'); return; }
  if(!monto || monto <= 0){ showToast('Ingresa un monto válido.'); return; }
  const excludeIds = [entry.id]; if(entry.comisionEntryId) excludeIds.push(entry.comisionEntryId);
  const disponibleOrigenEdit = pmAvailableBalance(origen, excludeIds);
  if((monto + comision) > disponibleOrigenEdit){ showToast(SALDO_INSUFICIENTE); return; }
  {
    const oldCom = entry.comisionEntryId ? state.entries.find(e => e.id === entry.comisionEntryId) : null;
    const next = state.entries.map(e => {
      if(e.id === entry.id) return { ...e, origen, destino, amount: monto };
      if(oldCom && e.id === oldCom.id) return comision > 0 ? { ...e, amount: comision, paymentMethod: origen } : null;
      return e;
    }).filter(Boolean);
    if(comision > 0 && !oldCom) next.push({ id: 'tmp-com', type: 'gasto', amount: comision, paymentMethod: origen });
    const problem = balanceProblem(next);
    if(problem){ showToast(problem, 7000); return; }
  }
  const date = form.fecha.value || entry.date;
  const origenName = pmRawName(origen);
  const destinoName = pmRawName(destino);

  entry.origen = origen;
  entry.destino = destino;
  entry.amount = monto;
  entry.date = date;
  entry.detail = origenName + ' → ' + destinoName;

  if(comision > 0){
    if(entry.comisionEntryId){
      const comEntry = state.entries.find(e => e.id === entry.comisionEntryId);
      if(comEntry){
        comEntry.amount = comision;
        comEntry.date = date;
        comEntry.description = origenName + ' → ' + destinoName;
        comEntry.paymentMethod = origen;
      }
    } else {
      const comisionEntryId = uid();
      state.entries.unshift({ id: comisionEntryId, type:'gasto', amount: comision, date, detail:'Comisión por transferencia entre cuentas', locked: true, description: origenName + ' → ' + destinoName, paymentMethod: origen });
      entry.comisionEntryId = comisionEntryId;
    }
  } else if(entry.comisionEntryId){
    state.entries = state.entries.filter(e => e.id !== entry.comisionEntryId);
    entry.comisionEntryId = null;
  }

  state.editingTransferId = null;
  saveAll();
  showToast('Transferencia actualizada.');
  render();
}

/* ---------- aviso de movimiento duplicado ---------- */
/* Un movimiento es "igual" si coincide en tipo, monto, fecha y cuenta, y además en el detalle
   (ingresos, gastos, caja chica), en la deuda (abonos) o en origen y destino (transferencias). */
function findDuplicateEntry(c){
  const norm = x => String(x || '').trim().toLowerCase();
  return state.entries.find(e => {
    if(e.locked || e.type !== c.type || e.amount !== c.amount || e.date !== c.date) return false;
    if(c.type === 'transferencia') return e.origen === c.origen && e.destino === c.destino;
    if(c.type === 'abono') return e.debtId === c.debtId && e.paymentMethod === c.paymentMethod;
    return e.paymentMethod === c.paymentMethod && norm(e.detail) === norm(c.detail);
  });
}
/* Si ya existe uno igual, pide confirmación antes de guardar; si no, guarda directo. */
function guardDuplicate(candidate, commit){
  const dup = findDuplicateEntry(candidate);
  if(!dup){ commit(); return; }
  askConfirm({ title: 'Posible movimiento duplicado', text: `Ya tienes uno igual registrado:\n${describeEntry(dup)}\n¿Registrar este también?`, confirmLabel: 'Sí, registrarlo', safe: true, onConfirm: commit });
}

function deleteEntry(id){
  const entry = state.entries.find(e => e.id === id);
  if(!entry) return;
  if(entry.locked){ showToast('Este movimiento no se puede eliminar.'); return; }
  let text = describeEntry(entry);
  if(entry.type === 'transferencia' && entry.comisionEntryId) text += '\nTambién se eliminará su comisión.';
  if(entry.type === 'abono') text += '\nLa deuda volverá a mostrar este monto como pendiente.';
  text += '\nEsta acción no se puede deshacer.';
  askConfirm({ title: '¿Eliminar este movimiento?', text, confirmLabel: 'Eliminar', onConfirm: () => doDeleteEntry(id) });
}
function doDeleteEntry(id){
  const entry = state.entries.find(e => e.id === id);
  if(!entry || entry.locked){ render(); return; }
  const remove = new Set([id]);
  if(entry.type === 'transferencia' && entry.comisionEntryId) remove.add(entry.comisionEntryId);
  const next = state.entries.filter(e => !remove.has(e.id));
  const problem = balanceProblem(next);
  if(problem){ showNotice('No se puede eliminar', problem); return; }
  state.entries = next;
  saveAll();
  showToast('Movimiento eliminado.');
  render();
}
function handleTransferSave(ev){
  ev.preventDefault();
  const form = ev.target;
  const origen = form.origen.value;
  const destino = form.destino.value;
  const monto = parseMoney(form.monto.value);
  const comision = parseMoney(form.comision.value);
  if(!origen || !destino){ showToast('Selecciona cuenta de origen y destino.'); return; }
  if(origen === destino){ showToast('Origen y destino deben ser distintos.'); return; }
  if(!monto || monto <= 0){ showToast('Ingresa un monto válido.'); return; }
  const disponibleOrigen = pmAvailableBalance(origen);
  if((monto + comision) > disponibleOrigen){ showToast(SALDO_INSUFICIENTE); return; }
  const date = form.fecha.value || todayISO();
  const origenName = pmRawName(origen);
  const destinoName = pmRawName(destino);
  guardDuplicate({ type:'transferencia', amount: monto, date, origen, destino }, () => {
    let comisionEntryId = null;
    if(comision > 0){
      comisionEntryId = uid();
      state.entries.unshift({ id: comisionEntryId, type:'gasto', amount: comision, date, detail:'Comisión por transferencia entre cuentas', locked: true, description: origenName + ' → ' + destinoName, paymentMethod: origen });
    }
    state.entries.unshift({ id: uid(), type:'transferencia', amount: monto, date, origen, destino, detail: origenName + ' → ' + destinoName, comisionEntryId });
    saveAll();
    showToast('Transferencia registrada.');
    render();
  });
}
function handleDebtSave(ev){
  ev.preventDefault();
  const form = ev.target;
  const name = form.name.value.trim();
  const monto = parseMoney(form.monto.value);
  if(!name || !monto || monto<=0){ showToast('Completa a quién debes y el monto.'); return; }
  const date = form.fecha.value || todayISO();
  const debt = { id: uid(), name, amount: monto, date };
  state.debts.unshift(debt);
  state.entries.unshift({ id: uid(), type:'deuda', amount: monto, date, detail:name, description:'', debtId: debt.id });
  saveAll();
  showToast('Deuda registrada.');
  render();
}
function deleteDebt(id){
  const debt = state.debts.find(d => d.id === id);
  if(!debt){ return; }
  const abonos = state.entries.filter(e => e.type === 'abono' && e.debtId === id);
  const totalAbonos = r2(abonos.reduce((s,e) => s + e.amount, 0));
  /* Con abonos se usa el aviso aprobado por el usuario; sin abonos no hay balances que modificar. */
  let text;
  if(abonos.length){
    text = 'Al eliminar esta deuda eliminarías también tus abonos, modificando tus balances.\n¿Deseas continuar?';
  } else {
    text = `Se eliminará la deuda con "${debt.name}" (${fmt(debt.amount)}).`;
    text += `\nSi esta deuda fue un préstamo que registraste como ingreso, ese ingreso NO se borra: elimínalo aparte si ya no aplica.`;
    text += `\nEsta acción no se puede deshacer.`;
  }
  askConfirm({ title: '¿Eliminar esta deuda?', text, confirmLabel: 'Eliminar', onConfirm: () => doDeleteDebt(id) });
}
function doDeleteDebt(id){
  const next = state.entries.filter(e => e.debtId !== id);
  const problem = balanceProblem(next);
  if(problem){ showNotice('No se puede eliminar esta deuda', problem); return; }
  state.debts = state.debts.filter(d => d.id !== id);
  state.entries = next;
  saveAll();
  showToast('Deuda eliminada.');
  render();
}
function handleAbonoSave(ev){
  ev.preventDefault();
  const form = ev.target;
  const debtId = form.debtId.value;
  const monto = parseMoney(form.monto.value);
  if(!debtId || !monto || monto<=0){ showToast('Selecciona la deuda e ingresa un monto.'); return; }
  if(!form.paymentMethod || !form.paymentMethod.value){ showToast('Selecciona una cuenta disponible.'); return; }
  const pendienteAbono = debtBalance(debtId);
  if(monto > pendienteAbono){ showToast('El abono no puede ser mayor a lo que debes.'); return; }
  const disponibleAbono = pmAvailableBalance(form.paymentMethod.value);
  if(monto > disponibleAbono){ showToast(SALDO_INSUFICIENTE); return; }
  const date = form.fecha.value || todayISO();
  const debt = state.debts.find(d => d.id === debtId);
  const abono = { id: uid(), type:'abono', amount: monto, date, detail: debt?debt.name:'', description:'', debtId, paymentMethod: form.paymentMethod.value };
  guardDuplicate(abono, () => {
    state.entries.unshift(abono);
    saveAll();
    showToast('Abono registrado.');
    render();
  });
}

/* ---------- topbar ---------- */
function renderTopbar(title, showBack, backPage, backLabel){
  if(['resumen','ajustes','categorias'].includes(state.page)) showBack = false;
  return `
    <div class="navbar">
      ${showBack ? `<button class="back" data-page="${backPage || 'home'}">‹ ${backLabel || 'Inicio'}</button>` : ''}
      <span class="title">${title}</span>
      <button class="theme-toggle" id="theme-toggle" title="Cambiar apariencia">${ic(state.theme==='dark'?'sun':'moon')}</button>
    </div>`;
}

/* ---------- íconos (Lucide, licencia ISC, https://lucide.dev) ---------- */
const ICONS = {"home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"></path><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path>", "pie": "<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\"></path><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\"></path>", "bars": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"M18 17V9\"></path><path d=\"M13 17V5\"></path><path d=\"M8 17v-3\"></path>", "gear": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>", "plus": "<path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path>", "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>", "eyeoff": "<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"></path><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"></path><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"></path><path d=\"m2 2 20 20\"></path>", "wallet": "<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"></path><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"></path>", "down": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 8v8\"></path><path d=\"m8 12 4 4 4-4\"></path>", "up": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 12-4-4-4 4\"></path><path d=\"M12 16V8\"></path>", "swap": "<path d=\"M8 3 4 7l4 4\"></path><path d=\"M4 7h16\"></path><path d=\"m16 21 4-4-4-4\"></path><path d=\"M20 17H4\"></path>", "coins": "<circle cx=\"8\" cy=\"8\" r=\"6\"></circle><path d=\"M18.09 10.37A6 6 0 1 1 10.34 18\"></path><path d=\"M7 6h1v4\"></path><path d=\"m16.71 13.88.7.71-2.82 2.82\"></path>", "hand": "<path d=\"M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17\"></path><path d=\"m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9\"></path><path d=\"m2 16 6 6\"></path><circle cx=\"16\" cy=\"9\" r=\"2.9\"></circle><circle cx=\"6\" cy=\"5\" r=\"3\"></circle>", "bank": "<line x1=\"3\" x2=\"21\" y1=\"22\" y2=\"22\"></line><line x1=\"6\" x2=\"6\" y1=\"18\" y2=\"11\"></line><line x1=\"10\" x2=\"10\" y1=\"18\" y2=\"11\"></line><line x1=\"14\" x2=\"14\" y1=\"18\" y2=\"11\"></line><line x1=\"18\" x2=\"18\" y1=\"18\" y2=\"11\"></line><polygon points=\"12 2 20 7 4 7\"></polygon>", "chev": "<path d=\"m9 18 6-6-6-6\"></path>", "chevd": "<path d=\"m6 9 6 6 6-6\"></path>", "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2\"></path><path d=\"M12 20v2\"></path><path d=\"m4.93 4.93 1.41 1.41\"></path><path d=\"m17.66 17.66 1.41 1.41\"></path><path d=\"M2 12h2\"></path><path d=\"M20 12h2\"></path><path d=\"m6.34 17.66-1.41 1.41\"></path><path d=\"m19.07 4.93-1.41 1.41\"></path>", "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"></path>", "x": "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>", "trend": "<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"></polyline><polyline points=\"16 7 22 7 22 13\"></polyline>", "cal": "<path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path>", "receipt": "<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"></path><path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\"></path><path d=\"M12 17.5v-11\"></path>"};
function ic(name){ return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
/* Monograma M plegado: la misma marca del ícono de la app. */
function logoMark(cls){
  return `<svg class="${cls || 'brand-mark'}" viewBox="0 0 64 64" aria-hidden="true">
    <polygon points="0,7.7 9,2.6 9,58.9 0,64" fill="var(--accent)" opacity=".72"/>
    <polygon points="9,2.6 32,28.2 32,35.8 9,10.2" fill="var(--accent)"/>
    <polygon points="32,28.2 55,2.6 55,10.2 32,35.8" fill="var(--accent)" opacity=".86"/>
    <polygon points="55,2.6 64,7.7 64,64 55,58.9" fill="var(--accent)" opacity=".62"/>
  </svg>`;
}
const ENTRY_ICON = { ingreso:'down', capital:'wallet', gasto:'up', cajachica:'coins', abono:'hand', deuda:'bank', transferencia:'swap' };
const mny = n => state.hideBalance ? '$ ••••••' : fmt(n);
const sgn = n => (n > 0 ? '+' : '') + fmt(n);

/* ---------- cálculos de Inicio y Categorías (una sola fuente para las vistas) ---------- */
function isoOf(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
/* Ingresos = tipo 'ingreso' (el capital inicial no cuenta). Gastos = gasto + caja chica. */
function flowData(range){
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  let labels = [], keys = [], keyOf, show = () => true;
  if(range === 'semana'){
    const dow = (now.getDay()+6)%7;
    for(let i=0;i<7;i++){ keys.push(isoOf(new Date(y, mo, now.getDate()-dow+i))); }
    labels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']; keyOf = d => d;
  } else if(range === 'año'){
    for(let i=0;i<12;i++) keys.push(y + '-' + String(i+1).padStart(2,'0'));
    labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; keyOf = d => d.slice(0,7);
  } else {
    const last = new Date(y, mo+1, 0).getDate();
    for(let i=1;i<=last;i++){ keys.push(y + '-' + String(mo+1).padStart(2,'0') + '-' + String(i).padStart(2,'0')); labels.push(String(i)); }
    keyOf = d => d; show = i => i === 0 || (i+1) % 5 === 0;
  }
  const idx = {}; keys.forEach((k,i) => idx[k] = i);
  const inc = keys.map(() => 0), exp = keys.map(() => 0);
  state.entries.forEach(e => {
    const i = idx[keyOf(e.date)];
    if(i === undefined) return;
    if(e.type === 'ingreso') inc[i] += e.amount;
    else if(e.type === 'gasto' || e.type === 'cajachica' || e.type === 'abono') exp[i] += e.amount;
  });
  const fullLabel = k => {
    if(range === 'año'){ const d = new Date(k + '-01T12:00:00'); return { tag:'Mes', text: cap(d.toLocaleDateString('es-MX', { month:'long', year:'numeric' })) }; }
    const d = new Date(k + 'T12:00:00');
    return { tag:'Día', text: cap(d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' })) };
  };
  return { labels, keys, keyOf, fullLabel, inc: inc.map(r2), exp: exp.map(r2), show };
}
function axisNum(v){ return v >= 1000 ? (+(v/1000).toFixed(1)) + 'k' : String(+v.toFixed(1)); }
function flowChart(fd, mode, sel){
  const W=340, H=200, L=36, R=8, T=10, B=26, iw=W-L-R, ih=H-T-B, n=fd.labels.length;
  const bars = mode === 'barras';
  const max = Math.max(0, ...fd.inc, ...fd.exp);
  const raw = max > 0 ? max/4 : 250, pw = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1,2,2.5,5,10].find(m => m*pw >= raw) * pw, top = step*4;
  const slot = bars ? iw/n : (n === 1 ? iw : iw/(n-1));
  const x = i => bars ? L + (i+0.5)*iw/n : (n === 1 ? L + iw/2 : L + i*iw/(n-1)), y = v => T + ih - v/top*ih;
  const path = a => a.map((v,i) => (i?'L':'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = a => path(a) + ` L${x(n-1).toFixed(1)} ${T+ih} L${x(0).toFixed(1)} ${T+ih} Z`;
  let grid = '';
  for(let k=0;k<=4;k++){ const v = step*k, yy = y(v).toFixed(1); grid += `<line class="fc-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="fc-t" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${axisNum(v)}</text>`; }
  let xl = '';
  fd.labels.forEach((lb,i) => { if(fd.show(i)) xl += `<text class="fc-t" x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle">${lb}</text>`; });
  /* resaltado del punto elegido */
  let hi = '';
  if(sel !== null && sel >= 0 && sel < n){
    const x0 = Math.max(L, x(sel) - slot/2), x1 = Math.min(W-R, x(sel) + slot/2);
    hi = `<rect class="fc-band" x="${x0.toFixed(1)}" y="${T}" width="${(x1-x0).toFixed(1)}" height="${ih}"/>` + (bars ? '' : `<line class="fc-guide" x1="${x(sel).toFixed(1)}" x2="${x(sel).toFixed(1)}" y1="${T}" y2="${T+ih}"/>`);
  }
  let body;
  if(bars){
    const bw = Math.max(1.5, Math.min(slot*0.36, 14));
    const bar = (v, i, off, cls) => { const h = v/top*ih; return h > 0 ? `<rect class="${cls}" x="${(x(i)+off).toFixed(1)}" y="${(T+ih-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(2, bw/2).toFixed(1)}"/>` : ''; };
    body = fd.inc.map((v,i) => bar(v, i, -bw-0.5, 'fc-bi')).join('') + fd.exp.map((v,i) => bar(v, i, 0.5, 'fc-be')).join('');
  } else {
    const dots = n <= 12 ? fd.inc.map((v,i) => `<circle class="fc-di" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2"/>`).join('') + fd.exp.map((v,i) => `<circle class="fc-de" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2"/>`).join('') : '';
    const selDots = (sel !== null && n > 12 && sel < n) ? `<circle class="fc-di" cx="${x(sel).toFixed(1)}" cy="${y(fd.inc[sel]).toFixed(1)}" r="3.6"/><circle class="fc-de" cx="${x(sel).toFixed(1)}" cy="${y(fd.exp[sel]).toFixed(1)}" r="3.6"/>` : '';
    body = `<path class="fc-ai" d="${area(fd.inc)}"/><path class="fc-ae" d="${area(fd.exp)}"/><path class="fc-inc" d="${path(fd.inc)}"/><path class="fc-exp" d="${path(fd.exp)}"/>${dots}${selDots}`;
  }
  /* zonas táctiles: una por día/mes */
  const hits = fd.labels.map((_, i) => { const x0 = Math.max(L, x(i) - slot/2), x1 = Math.min(W-R, x(i) + slot/2); return `<rect class="fc-hit" data-fi="${i}" x="${x0.toFixed(1)}" y="${T}" width="${(x1-x0).toFixed(1)}" height="${ih+B}"/>`; }).join('');
  return `<svg class="fc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Flujo: ingresos y gastos">${grid}${xl}${hi}${body}${hits}</svg>`;
}
/* Detalle del día/mes elegido en la gráfica de Flujo. */
function flowDetail(fd, sel){
  if(sel === null || sel < 0 || sel >= fd.keys.length) return '';
  const key = fd.keys[sel], lab = fd.fullLabel(key);
  const items = state.entries.filter(e => fd.keyOf(e.date) === key && (e.type === 'ingreso' || e.type === 'gasto' || e.type === 'cajachica' || e.type === 'abono'))
    .slice().sort((p,q) => q.date.localeCompare(p.date));
  const ing = fd.inc[sel], gas = fd.exp[sel];
  const MAX = 6;
  const rows = items.slice(0, MAX).map(e => {
    const c = catById(e.type), pm = e.paymentMethod ? paymentMethodName(e.paymentMethod) : '', out = c ? c.sign < 0 : false;
    const when = fmtDate(e.date);
    return `<div class="rec"><span class="ri">${ic(ENTRY_ICON[e.type] || 'receipt')}</span>
      <span class="rm"><div class="rt">${esc(e.detail || (c ? c.label : ''))}</div><div class="rs">${when} · ${pm || (c ? c.label : '')}</div></span>
      <span class="ra ${out ? 'out' : ''}">${out ? '-' : '+'}${mny(e.amount)}</span></div>`;
  }).join('');
  return `<div class="fl-det">
    <div class="fl-det-h"><div><div class="tag">${lab.tag}</div><div class="ttl">${esc(lab.text)}</div></div>
      <button type="button" class="fl-det-x" id="fl-det-close" aria-label="Cerrar detalle">${ic('x')}</button></div>
    <div class="fl-det-sum"><div><small>Ingresos</small><b>${mny(ing)}</b></div><div><small>Gastos</small><b>${mny(gas)}</b></div></div>
    ${items.length ? rows + (items.length > MAX ? `<div class="more">y ${items.length - MAX} movimiento${items.length - MAX === 1 ? '' : 's'} más</div>` : '') : '<div class="more">Sin movimientos en este lapso.</div>'}
  </div>`;
}
function categoryBreakdown(kind, start, end){
  const norm = t => String(t||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = new Map();
  entriesInRange(start, end)
    .filter(e => kind === 'gasto' ? (e.type === 'gasto' || e.type === 'cajachica' || e.type === 'abono') : e.type === 'ingreso')
    .forEach(e => {
      const label = e.type === 'abono' ? 'Abonos a deudas' : (String(e.detail || '').trim() || 'Sin categoría');
      const k = norm(label), cur = map.get(k) || { label, total: 0, count: 0 };
      cur.total += e.amount; cur.count++; map.set(k, cur);
    });
  const rows = [...map.values()].map(r => ({ ...r, total: r2(r.total) })).sort((p,q) => q.total - p.total);
  return { rows, total: r2(rows.reduce((t,r) => t + r.total, 0)) };
}

function toggleHideBalance(){ state.hideBalance = !state.hideBalance; saveHideBalance(); render(); }
function sheetGo(act){
  state.sheet = false;
  if(['ingreso','gasto','cajachica'].includes(act)){ state.activeCategory = act; state.page = 'capturar'; }
  else if(act === 'transferencia') state.page = 'transferencia';
  else if(act === 'abono') state.page = 'abono';
  else if(act === 'deuda') state.page = 'deuda';
  else if(act === 'cuenta') state.page = 'cuentas';
  else if(act === 'categoria') state.page = 'catadmin';
  render(); window.scrollTo(0, 0);
}
function renderTabBar(){
  const tabs = [['home','Inicio','home'],['resumen','Reportes','pie'],['categorias','Categorías','bars'],['ajustes','Ajustes','gear']];
  const tabBtn = ([p,l,i]) => `<button class="tab ${state.page===p?'active':''}" data-page="${p}">${ic(i)}<span>${l}</span></button>`;
  return `<nav class="tabbar">${tabs.slice(0,2).map(tabBtn).join('')}<button class="tab-add" id="fab" aria-label="Nuevo movimiento"><span class="plus">${ic('plus')}</span></button>${tabs.slice(2).map(tabBtn).join('')}</nav>`;
}
function renderCifra(){
  const d = state.cifra; if(!d) return '';
  const F = homeFigures(), gb = F.gb;
  const row = (k, v, cls) => `<div class="dt-row ${cls||''}"><span class="k">${k}</span><span class="v">${mny(v)}</span></div>`;
  let title = '', body = '', note = '';
  if(d === 'gastos'){
    title = 'Gastos de ' + F.mesLabel;
    body = row('Gastos', F.mes.gastos) + row('Caja chica', F.mes.cajachica) + row('Abonos a deudas', F.mes.abonos) + row('Total de gastos del mes', F.mes.salidas, 'dt-total');
    note = 'Todo lo que sale de tus cuentas: gastos, caja chica y abonos. Incluye los movimientos con fecha de este mes, aunque sean posteriores a hoy.';
  } else {
    title = 'Balance actual (hasta hoy)';
    body = row('+ Capital inicial', gb.capital) + row('+ Ingresos', gb.ingresos) + row('− Gastos', gb.gastos) + row('− Caja chica', gb.cajachica) + row('− Abonos a deudas', gb.abonos) + row('Balance actual', gb.total, 'dt-total');
    const dif = r2(gb.total - F.totalAcc);
    if(gb.programado !== 0) body += row('Programado (fecha posterior a hoy)', gb.programado);
    if(dif !== 0) body += row('Diferencia con "En cuentas"', dif);
    note = 'Suma de todo lo registrado hasta hoy desde tu primer movimiento. Lo que tenga fecha posterior se muestra aparte y aún no cuenta.' + (dif !== 0 ? ' La diferencia con "En cuentas" son movimientos sin cuenta asignada.' : '');
  }
  return `<div class="sheet-overlay" data-cifra-close></div>
    <div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sheet-grab"></div><p class="sheet-title">${esc(title)}</p>
      ${body}
      <p class="hint" style="margin:10px 0 14px;">${note}</p>
      <button type="button" class="btn-save" data-cifra-close style="--chip-color:#636366;">Cerrar</button></div>`;
}
function renderSheet(){
  if(!state.sheet) return '';
  const items = [['ingreso','Ingreso','down'],['gasto','Gasto','up'],['cajachica','Caja chica','coins'],['transferencia','Transferencia','swap'],['abono','Abono','hand'],['deuda','Nueva deuda','bank'],['cuenta','Nueva cuenta','wallet'],['categoria','Nueva categoría','bars']];
  return `<div class="sheet-overlay" data-sheet-close></div>
    <div class="sheet"><div class="sheet-grab"></div><p class="sheet-title">¿Qué quieres registrar?</p>
      <div class="sheet-grid">${items.map(([a,l,i]) => `<button class="sheet-item" data-act="${a}"><span class="ri">${ic(i)}</span>${l}</button>`).join('')}</div></div>`;
}

/* ---------- render: inicio ---------- */
/* Cifras de Inicio: una sola fuente para la pantalla y para sus desgloses. */
function homeFigures(){
  const gb = globalBalanceInfo();
  const totalAcc = r2(paymentMethodBalances(todayISO()).reduce((t,m) => t + m.balance, 0));
  const mr = monthRange(new Date());
  const mes = flowSplit(entriesInRange(mr.start, mr.end));
  const fr = getPeriodRange(state.flowRange, new Date());
  const rango = flowSplit(entriesInRange(fr.start, fr.end));
  return { gb, totalAcc, mes, rango, mesLabel: cap(new Date().toLocaleDateString('es-MX', { month:'long', year:'numeric' })) };
}
function renderHome(){
  const F = homeFigures();
  const gb = F.gb;
  const totalAcc = F.totalAcc;
  const hoyStr = todayISO();
  const gastosMes = F.mes.salidas;
  const fd = flowData(state.flowRange);
  const dateLabel = cap(new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
  const recent = state.entries.filter(e => e.type !== 'deuda').slice().sort((p,q) => q.date.localeCompare(p.date)).slice(0, 5);
  const pend = totalDebtPending();
  const rangeOpts = [['semana','Esta semana'],['mes','Este mes'],['año','Este año']];
  /* Balance por cuenta: activas y con saldo distinto de cero (igual que Reportes → Saldo por cuenta). */
  const accsConSaldo = paymentMethodBalances(hoyStr).filter(m => m.status !== 'archived' && r2(m.balance) !== 0);
  const accsList = accsConSaldo.length ? `<div class="bal-accs">${accsConSaldo.map(m => `<div class="bal-acc"><span class="an"><i style="background:${m.color}"></i><span>${esc(m.name)}</span></span><b>${mny(m.balance)}</b></div>`).join('')}</div>` : '';

  return `
    <div class="hd">
      <div class="brand-lockup">${logoMark('brand-mark')}
        <div class="brand-text"><h1>Metría</h1><p class="brand-sub">Tus finanzas, en orden</p></div>
      </div>
      <button class="theme-toggle" id="theme-toggle" title="Cambiar apariencia">${ic(state.theme==='dark'?'sun':'moon')}</button>
    </div>
    <div class="sub-hd"><h2>Resumen de hoy</h2><p>${dateLabel}</p></div>

    <div class="bal-card">
      <div class="bal-top">
        <div>
          <div class="bal-lbl">Balance actual <button class="eye" id="eye-toggle" aria-label="${state.hideBalance?'Mostrar':'Ocultar'} balance">${ic(state.hideBalance?'eyeoff':'eye')}</button></div>
          <button type="button" class="bal-fig" data-cifra="balance" aria-label="Ver desglose del balance">${mny(gb.total)}</button>
        </div>
        <span class="bal-icon">${ic('wallet')}</span>
      </div>
      ${accsList}
      <div class="mini-row">
        <button class="mini tap" data-page="cuentas"><span class="mi">${ic('wallet')}</span><span><div class="ml">En cuentas</div><div class="mv">${mny(totalAcc)}</div></span></button>
        <button type="button" class="mini tap" data-cifra="gastos"><span class="mi">${ic('up')}</span><span><div class="ml">Gastos del mes</div><div class="mv">${mny(gastosMes)}</div></span></button>
      </div>
    </div>

    <div class="fl-card">
      <div class="fl-head"><h3>Flujo</h3>
        <div class="fl-tools">
          <div class="seg" role="group" aria-label="Tipo de gráfica"><button type="button" data-fstyle="linea" class="${state.flowStyle==='linea'?'on':''}" aria-label="Gráfica de línea" title="Línea">${ic('trend')}</button><button type="button" data-fstyle="barras" class="${state.flowStyle==='barras'?'on':''}" aria-label="Gráfica de barras" title="Barras">${ic('bars')}</button></div>
          <select class="fl-sel" id="flow-range" aria-label="Periodo">${rangeOpts.map(([v,l]) => `<option value="${v}" ${state.flowRange===v?'selected':''}>${l}</option>`).join('')}</select>
        </div>
      </div>
      ${flowChart(fd, state.flowStyle, state.flowSel)}
      ${flowDetail(fd, state.flowSel)}
      <div class="fl-foot">
        <span><span class="lg"><i style="background:var(--pos)"></i>Ingresos</span><span class="lg"><i style="background:var(--neg)"></i>Gastos</span></span>
      </div>
    </div>

    ${state.debts.length ? `<div class="row-card" data-page="deuda"><span class="ri">${ic('bank')}</span><span class="rm"><div class="rt">Deudas</div><div class="rs">${pend > 0 ? 'Pendiente: ' + mny(pend) : 'Todas liquidadas'}</div></span>${ic('chev')}</div>` : ''}

    <div class="rec-card">
      <div class="rec-head"><h3>Movimientos recientes</h3><button class="link" data-page="resumen">Ver todos ${ic('chev')}</button></div>
      ${recent.length ? recent.map(e => {
        const c = catById(e.type), pm = e.paymentMethod ? paymentMethodName(e.paymentMethod) : '';
        const s = c ? c.sign : 0, out = s < 0;
        const tint = c ? c.color : 'var(--accent)';
        return `<div class="rec"><span class="ri" style="background:color-mix(in srgb, ${tint} 16%, var(--card-alt));border-color:color-mix(in srgb, ${tint} 22%, var(--line));color:${tint}">${ic(ENTRY_ICON[e.type] || 'receipt')}</span>
          <span class="rm"><div class="rt">${esc(e.detail || (c ? c.label : ''))}</div><div class="rs">${fmtDate(e.date)} · ${pm || (c ? c.label : '')}</div></span>
          <span class="ra ${out ? 'out' : ''}">${s > 0 ? '+' : s < 0 ? '-' : ''}${mny(e.amount)}</span></div>`;
      }).join('') : `<div class="empty">Aún no hay movimientos. Toca + para registrar el primero.</div>`}
    </div>
  `;
}

/* ---------- render: cuentas (antes parte del Inicio) ---------- */
function renderCuentas(){
  const pmBalancesAll = paymentMethodBalances(todayISO());
  const pmBalancesActive = pmBalancesAll.filter(m => m.status !== 'archived');
  const totalBalance = r2(pmBalancesAll.reduce((s,m) => s + m.balance, 0));
  const positiveSum = pmBalancesActive.reduce((s,m) => s + Math.max(0, m.balance), 0);
  const pmPercentagesActive = pmBalancesActive.map(m => ({ ...m, pct: (m.balance <= 0 || positiveSum <= 0) ? 0 : (m.balance / positiveSum * 100) }));
  return `
    ${renderTopbar('Cuentas', true)}
    <p class="section-label">Cuentas disponibles</p>
    ${activePaymentMethods().length ? `<div class="panel">
      <div class="pm-balance-bubble">
        <span class="lbl">Balance total en tus cuentas</span>
        <span class="fig" style="color:${totalBalance>=0?'var(--ink)':'var(--c-gasto)'}">${fmt(totalBalance)}</span>
      </div>
      <div class="pm-chart">
        ${pmPercentagesActive.map(m => `
          <div class="pm-bar-row">
            <span class="pm-bar-label">${pmGlyph({icon:m.icon}) ? pmGlyph({icon:m.icon}) + ' ' : ''}${esc(m.name)}</span>
            <span class="pm-bar-track"><span class="pm-bar-fill" style="width:${m.pct.toFixed(1)}%;background:${m.color}"></span></span>
            <span class="pm-bar-pct">${m.pct.toFixed(0)}%</span>
          </div>`).join('')}
      </div>
      <p class="hint" style="margin-top:2px;">Las cuentas en negativo se muestran en 0% para no distorsionar la gráfica.</p>
    </div>` : ''}
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:#636366"></span>Agregar cuenta disponible</p>
      <form id="pm-form">
        <div class="field"><label>Nombre</label><input type="text" name="name" placeholder="Ej. Tarjeta BBVA" required value="${esc(state.newPmName || '')}"></div>
        <div class="field"><label>Balance actual de la cuenta</label><input type="number" name="capital" step="0.01" min="0" inputmode="decimal" placeholder="0.00" required value="${esc(state.newPmCapital || '')}"></div>
        <div class="field"><label>Color</label>${pmColorPicker(state.newPmColor, 'selectNewPmColor')}</div>
        <div class="field"><label>Ícono</label>${pmIconPicker(state.newPmIcon, 'selectNewPmIcon')}</div>
        <button type="submit" class="btn-save" style="--chip-color:${state.newPmColor};">Agregar</button>
      </form>
    </div>
    ${activePaymentMethods().length ? `<div class="panel">
      ${pmBalancesActive.map(m => {
        if(state.editingPmId === m.id){
          return `<form class="pm-edit-form" data-pmedit="${m.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
            <div class="field"><label>Nombre</label><input type="text" name="name" value="${esc(m.name)}" required></div>
            <div class="field"><label>Color</label>${pmColorPicker(state.editPmColor, 'selectEditPmColor')}</div>
            <div class="field"><label>Ícono</label>${pmIconPicker(state.editPmIcon, 'selectEditPmIcon')}</div>
            <div style="display:flex;gap:10px;">
              <button type="submit" class="btn-save" style="--chip-color:${state.editPmColor};">Guardar</button>
              <button type="button" class="btn-save" data-pmcancel style="--chip-color:#636366;">Cancelar</button>
            </div>
          </form>`;
        }
        return `
        <div class="entry-row">
          <span class="pm-badge" style="background:${m.color}">${pmGlyph({icon:m.icon})}</span>
          <div class="entry-main">
            <div class="entry-detail">${esc(m.name)}</div>
            <div class="entry-meta" style="color:${m.balance>=0?'var(--ink-faint)':'var(--c-gasto)'}">${fmt(m.balance)}</div>
          </div>
          <button class="pm-edit-btn" data-pmedit-start="${m.id}" title="Editar">✎</button>
          <button class="entry-del" data-delpm="${m.id}" title="Cerrar cuenta">×</button>
        </div>`;
      }).join('')}
    </div>` : ''}
    <p class="hint" style="margin:0 20px 10px;">Cada ingreso, gasto o abono que captures con un método asignado ajusta el saldo de esa cuenta arriba.</p>

  `;
}

/* ---------- render: categorías ---------- */
function renderCategorias(){
  const { start, end, label } = getPeriodRange(state.granularity, state.refDate);
  const bd = categoryBreakdown(state.catKind, start, end);
  const gransets = [['dia','Día'],['semana','Semana'],['quincena','Quinc.'],['mes','Mes'],['año','Año']];
  const segHtml = gransets.map(([id,lbl]) => `<button class="${state.granularity===id?'active':''}" data-gran="${id}">${lbl}</button>`).join('');
  const kinds = [['gasto','Gastos'],['ingreso','Ingresos']].map(([id,l]) => `<button class="${state.catKind===id?'active':''}" data-catkind="${id}">${l}</button>`).join('');
  const max = Math.max(1, ...bd.rows.map(r => r.total));
  return `
    ${renderTopbar('Categorías', false)}
    <div class="filter-bar">
      <div class="seg">${kinds}</div>
      <div class="seg">${segHtml}</div>
      <div class="nav-arrows"><button data-nav="-1">‹</button><span class="period-label">${label}</span><button data-nav="1">›</button></div>
    </div>
    <div class="balance-panel">
      <div class="balance-label">${state.catKind === 'gasto' ? 'Gastos del periodo' : 'Ingresos del periodo'}</div>
      <div class="balance-figure">${mny(bd.total)}</div>
      <div class="balance-sub">${bd.rows.length} categoría${bd.rows.length===1?'':'s'}</div>
    </div>
    <div class="panel">
      ${bd.rows.length ? bd.rows.map(r => `
        <div class="rec" style="border-top:none;padding:10px 0;">
          <span class="ri">${esc(r.label.charAt(0).toUpperCase())}</span>
          <span class="rm"><div class="rt">${esc(r.label)}</div>
            <div class="bar-track" style="margin-top:6px;"><span class="bar-fill" style="width:${(r.total/max*100).toFixed(1)}%;background:var(--accent);"></span></div>
            <div class="rs">${r.count} movimiento${r.count===1?'':'s'} · ${bd.total ? (r.total/bd.total*100).toFixed(0) : 0}%</div></span>
          <span class="ra neutral">${mny(r.total)}</span>
        </div>`).join('') : `<div class="empty">Sin ${state.catKind === 'gasto' ? 'gastos' : 'ingresos'} en este periodo.</div>`}
    </div>
    <div class="row-card" data-page="catadmin"><span class="ri">${ic('bars')}</span><span class="rm"><div class="rt">Mis categorías</div><div class="rs">Crear, renombrar o quitar</div></span>${ic('chev')}</div>
    <p class="hint" style="margin:10px 20px 10px;">Los movimientos se agrupan por la categoría que eliges al capturarlos o editarlos; los que no tienen categoría aparecen como "Sin categoría".</p>
  `;
}

/* ---------- categorías: administración ---------- */
function addCategory(kind, rawName){
  const name = String(rawName || '').trim().slice(0, CAT_NAME_MAX);
  if(!name){ showToast('Escribe el nombre de la categoría.'); return false; }
  if(categoryNameTaken(kind, name)){ showToast('Esa categoría ya existe.'); return false; }
  state.categories.push({ id: uid(), name, kind });
  saveAll();
  showToast('Categoría agregada.');
  return true;
}
function handleCatAdd(ev){
  ev.preventDefault();
  if(addCategory(state.catAdminKind, ev.target.name.value)){ ev.target.reset(); render(); }
}
function startEditCat(id){ state.editingCatId = id; render(); }
function cancelEditCat(){ state.editingCatId = null; render(); }
function saveCatEdit(ev, id){
  ev.preventDefault();
  const c = state.categories.find(x => x.id === id);
  if(!c) return;
  const name = String(ev.target.name.value || '').trim().slice(0, CAT_NAME_MAX);
  if(!name){ showToast('Escribe el nombre de la categoría.'); return; }
  if(categoryNameTaken(c.kind, name, c.id)){ showToast('Esa categoría ya existe.'); return; }
  const old = c.name;
  c.name = name;
  /* Los movimientos que usaban el nombre anterior pasan al nuevo (los generados automáticamente no se tocan). */
  state.entries.forEach(e => { if(!e.locked && e.type === c.kind && normName(e.detail) === normName(old)) e.detail = name; });
  state.editingCatId = null;
  saveAll();
  showToast('Categoría actualizada.');
  render();
}
function deleteCategory(id){
  const c = state.categories.find(x => x.id === id);
  if(!c) return;
  const n = categoryUsage(c.kind).get(normName(c.name)) || 0;
  askConfirm({
    title: '¿Quitar esta categoría?',
    text: `"${c.name}" dejará de aparecer en tus listas.` + (n ? `\nLos ${n} movimiento${n === 1 ? '' : 's'} que la usan conservan su nombre y siguen en tus reportes.` : ''),
    confirmLabel: 'Quitar',
    onConfirm: () => {
      state.categories = state.categories.filter(x => x.id !== id);
      saveAll();
      showToast('Categoría quitada.');
      render();
    }
  });
}
function renderCatAdmin(){
  const kind = state.catAdminKind;
  const kindColor = kind === 'ingreso' ? 'var(--c-ingreso)' : 'var(--c-gasto)';
  const kinds = [['ingreso','Ingresos'],['gasto','Gastos']].map(([id,l]) => `<button class="${kind===id?'active':''}" data-catadminkind="${id}">${l}</button>`).join('');
  const list = categoriesOf(kind);
  const usage = categoryUsage(kind);
  const sug = SUGGESTED_CATEGORIES[kind].filter(n => !categoryNameTaken(kind, n));
  const rows = list.map(c => {
    if(state.editingCatId === c.id){
      return `<form class="cat-edit-form" data-catedit="${c.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
        <div class="field"><label>Nombre</label><input type="text" name="name" value="${esc(c.name)}" maxlength="${CAT_NAME_MAX}" required></div>
        <p class="hint" style="margin:-4px 0 12px;">Al renombrarla, también cambia en los movimientos que ya la usan.</p>
        <div style="display:flex;gap:10px;">
          <button type="submit" class="btn-save" style="--chip-color:${kindColor};">Guardar</button>
          <button type="button" class="btn-save" data-catcancel style="--chip-color:#636366;">Cancelar</button>
        </div>
      </form>`;
    }
    const n = usage.get(normName(c.name)) || 0;
    return `<div class="entry-row">
      <span class="entry-cat" style="background:${kindColor}"></span>
      <div class="entry-main">
        <div class="entry-detail">${esc(c.name)}</div>
        <div class="entry-meta">${n} movimiento${n === 1 ? '' : 's'}</div>
      </div>
      <button class="pm-edit-btn" data-catedit-start="${c.id}" title="Renombrar">✎</button>
      <button class="entry-del" data-delcat="${c.id}" title="Quitar">×</button>
    </div>`;
  }).join('');
  return `
    ${renderTopbar('Mis categorías', true, 'categorias', 'Categorías')}
    <div class="filter-bar"><div class="seg">${kinds}</div></div>
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:${kindColor}"></span>Agregar categoría de ${kind === 'ingreso' ? 'ingreso' : 'gasto'}</p>
      <form id="cat-form" autocomplete="off">
        <div class="field"><label>Nombre</label><input type="text" name="name" placeholder="${kind === 'ingreso' ? 'Ej. Ventas' : 'Ej. Educación'}" maxlength="${CAT_NAME_MAX}" required></div>
        <button type="submit" class="btn-save" style="--chip-color:${kindColor};">Agregar</button>
      </form>
      ${sug.length ? `<p class="hint" style="margin:14px 0 0;">Ideas para agregar con un toque:</p>
      <div class="sug-chips">${sug.map(n => `<button type="button" class="sug-chip" data-catsug="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="panel">
      ${list.length ? rows : `<div class="empty">Aún no tienes categorías de ${kind === 'ingreso' ? 'ingreso' : 'gasto'}.<br>Agrega la primera arriba.</div>`}
    </div>
    <p class="hint" style="margin:0 20px 10px;">Estas categorías aparecen al capturar y al editar un ${kind === 'ingreso' ? 'ingreso' : 'gasto'}. Quitar una categoría no borra movimientos.</p>
  `;
}

/* ---------- render: ajustes ---------- */
let autoLock = { minutes: 5, options: [0, 1, 5, 15, 30] };
/* La consulta es asíncrona: al llegar solo se sincroniza el <select> si ya está
   en pantalla. No se vuelve a pintar toda la vista, porque eso podría reemplazar
   el control justo entre el toque y el clic y perder la interacción. */
if(window.security) window.security.getAutoLock().then(r => {
  if(r && r.ok){
    autoLock = r;
    const sel = document.getElementById('autolock-select');
    if(sel && sel.isConnected) sel.value = String(autoLock.minutes);
  }
}).catch(() => {});
const autoLockLabel = m => m === 0 ? 'Nunca' : (m === 1 ? '1 minuto' : m + ' minutos');
async function setAutoLock(v){
  const sel = document.getElementById('autolock-select');
  try{
    const r = await window.security.setAutoLock(Number(v));
    if(r && r.ok){ autoLock.minutes = r.minutes; showToast('Bloqueo automático actualizado.'); }
    else showToast((r && r.error) || 'No se pudo cambiar el ajuste.');
  }catch(e){ console.error(e); showToast('No se pudo cambiar el ajuste.'); }
  /* Refleja el valor real sin reemplazar el DOM (y revierte si el cambio falló). */
  if(sel && sel.isConnected) sel.value = String(autoLock.minutes);
}

/* Estado del desbloqueo con huella o rostro. En navegador llega "no disponible". */
let biometricState = { supported: false, available: false, enabled: false, requiresPassword: false, reason: '', busy: false };
/* Igual que el bloqueo automático: la consulta asíncrona no repinta la pantalla.
   Solo actualiza el interruptor y su texto si la sección ya está visible. */
if(window.security && window.security.biometric){
  window.security.biometric.status().then(r => {
    biometricState = { ...biometricState, ...(r || {}), busy: false };
    syncBiometricSetting();
  }).catch(() => {});
}
function biometricReasonText(){
  switch(biometricState.reason){
    case 'NO_HARDWARE': return 'Este teléfono no tiene lector de huellas o cámara compatible.';
    case 'HW_UNAVAILABLE': return 'La biometría no está disponible en este momento.';
    case 'NONE_ENROLLED': return 'Configura una huella o rostro en los ajustes de Android.';
    case 'SECURITY_UPDATE_REQUIRED': return 'Actualiza el sistema para usar la biometría.';
    case 'WEB': return 'El desbloqueo con huella o rostro solo está disponible en la app de Android.';
    default: return 'La biometría no está disponible en este teléfono.';
  }
}
function biometricHintText(){
  return biometricState.busy
    ? 'Esperando la verificación del teléfono…'
    : biometricState.requiresPassword
      ? 'Ingresa tu contraseña una vez después de reiniciar para volver a usar la biometría.'
      : 'Se guarda una llave cifrada en el teléfono, nunca tu contraseña. Si agregas una huella nueva, la llave se invalida y se pide la contraseña.';
}
/* Actualiza el interruptor existente sin reemplazar el DOM. */
function syncBiometricSetting(){
  const box = document.querySelector('#toggle-biometric .toggle-box');
  if(box) box.classList.toggle('on', !!biometricState.enabled);
  const hint = document.getElementById('biometric-hint');
  if(hint) hint.textContent = biometricHintText();
}
async function toggleBiometric(on){
  if(biometricState.busy) return;
  biometricState.busy = true;
  render();
  try{
    const r = on
      ? await window.security.biometric.enable()
      : await window.security.biometric.disable();
    if(r && r.ok) showToast(on ? 'Desbloqueo con huella o rostro activado.' : 'Desbloqueo con huella o rostro desactivado.');
    else showToast((r && r.error) || 'No se pudo cambiar el ajuste.');
    const st = await window.security.biometric.status();
    biometricState = { ...biometricState, ...(st || {}), busy: false };
  }catch(e){
    console.error(e);
    biometricState.busy = false;
    showToast('No se pudo cambiar el ajuste.');
  }
  /* El interruptor ya está en pantalla: se actualiza en el sitio. */
  syncBiometricSetting();
}
function renderBiometricSetting(){
  if(!window.security || !window.security.biometric){
    return `<p class="hint" style="margin:8px 0 0;">El desbloqueo con huella o rostro solo está disponible en la app de Android.</p>`;
  }
  if(!biometricState.supported){
    return `<p class="hint" style="margin:8px 0 0;">${esc(biometricReasonText())}</p>`;
  }
  if(!biometricState.available){
    return `<p class="hint" style="margin:8px 0 0;">${esc(biometricReasonText())}</p>`;
  }
  return `
    <div class="toggle-row" id="toggle-biometric">
      <span class="toggle-box ${biometricState.enabled ? 'on' : ''}" style="--chip-color:var(--c-ingreso)"></span>
      <span class="txt">Usar huella o rostro para desbloquear</span>
    </div>
    <p class="hint" id="biometric-hint" style="margin:8px 0 0;">${esc(biometricHintText())}</p>`;
}
/* Avisa actividad al proceso principal (como máximo cada 5 s) para el bloqueo por inactividad. */
let lastPing = 0;
['pointerdown','keydown','wheel','touchstart'].forEach(t => document.addEventListener(t, () => {
  const n = Date.now();
  if(n - lastPing > 5000 && window.security){ lastPing = n; window.security.ping(); }
}, { capture: true, passive: true }));

let appVersion = '';
if(window.appInfo) window.appInfo.version().then(v => {
  appVersion = v || '';
  const el = document.getElementById('app-version');
  if(el) el.textContent = 'Metría' + (appVersion ? ' v' + appVersion : '');
}).catch(() => {});

function renderAjustes(){
  return `
    ${renderTopbar('Ajustes', true)}
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--accent)"></span>Apariencia</p>
      <div class="field"><label>Tamaño de la vista</label>
        <div class="scale-opts" role="group" aria-label="Tamaño de la vista">${UI_SCALES.map(v => `<button type="button" class="scale-opt ${v === state.uiScale ? 'active' : ''}" data-scale="${v}" aria-pressed="${v === state.uiScale}">${uiScaleLabel(v)}</button>`).join('')}</div>
      </div>
      <p class="hint" style="margin:8px 0 0;">1x es el tamaño original. Con valores menores todo se ve más pequeño; con valores mayores, textos, elementos y secciones crecen.</p>
    </div>
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--c-deuda)"></span>Seguridad</p>
      <div class="field"><label>Bloquear la app tras</label>
        <select id="autolock-select">${autoLock.options.map(o => `<option value="${o}" ${o === autoLock.minutes ? 'selected' : ''}>${autoLockLabel(o)}${o === 0 ? '' : ' de inactividad'}</option>`).join('')}</select>
      </div>
      <p class="hint" style="margin:8px 0 0;">Al bloquearse se borra la llave de la memoria y se pide tu contraseña o biometría. El tiempo también cuenta mientras la app está en segundo plano; con “Nunca” no se bloquea sola.</p>
      <div class="field" style="margin-top:14px;"><label>Desbloqueo rápido</label>
        ${renderBiometricSetting()}
      </div>
    </div>
    <p class="section-label">Respaldo</p>
    <div class="panel" style="display:flex;gap:10px;">
      <button type="button" class="btn-save" id="export-btn" style="--chip-color:#636366;">Exportar</button>
      <button type="button" class="btn-save" id="import-btn" style="--chip-color:#636366;">Importar</button>
      <input type="file" id="import-file" accept="application/json" style="display:none;">
    </div>
    <p class="hint" style="margin:0 20px 10px;">Guarda un archivo cifrado con una contraseña que tú eliges, por si cambias de computadora o pierdes tus datos.</p>

    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:#636366"></span>Acerca de</p>
      <p class="hint" id="app-version" style="margin:0;">Metría${appVersion ? ' v' + esc(appVersion) : ''}</p>
    </div>
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--c-gasto)"></span>Zona de riesgo</p>
      <p class="hint" style="margin:0 0 14px;">Estas acciones afectan permanentemente tu información. No se pueden deshacer.</p>
      <button type="button" class="btn-save" data-wipe-request style="--chip-color:var(--c-gasto);">Borrar todos tus datos</button>
      <p class="hint" style="margin:10px 0 0;">Elimina todos los movimientos, deudas y cuentas (activas y archivadas); tus categorías vuelven a las predeterminadas. Tu apariencia (modo claro/oscuro y tamaño de la vista) se conserva. Exporta un respaldo antes si quieres conservar algo.</p>
    </div>
  `;
}

/* ---------- render: capturar ---------- */
function renderCapturar(){
  const cat = catById(state.activeCategory);
  const chips = CAPTURE_CATEGORIES.map(c => {
    return `<button class="cat-chip ${c.id===state.activeCategory?'active':''}" style="--chip-color:${c.color}" data-cat="${c.id}">
      <span class="cat-dot" style="background:${c.color}">${c.icon}</span>${c.label}
    </button>`;
  }).join('');

  const usesCatList = state.activeCategory === 'ingreso' || state.activeCategory === 'gasto';
  const detailInput = usesCatList
    ? `<select name="detail">${categoryOptions(state.activeCategory, '')}</select>
       <button type="button" class="link" data-page="catadmin" style="margin-top:6px;font-size:12.5px;">＋ Administrar categorías</button>`
    : `<input type="text" name="detail" placeholder="Opcional">`;
  const detailFields = state.soloTotal ? '' : `
    <div class="field">
      <label>${cat.detailLabel}</label>
      ${detailInput}
    </div>
    <div class="field">
      <label>Descripción (opcional)</label>
      <input type="text" name="description" placeholder="Notas sobre este movimiento">
    </div>`;

  const showPaymentMethod = state.activeCategory === 'ingreso' || state.activeCategory === 'gasto' || state.activeCategory === 'cajachica';
  const paymentMethodField = showPaymentMethod ? (
    activePaymentMethods().length
      ? `<div class="field"><label>Cuenta disponible</label><select name="paymentMethod" required><option value="" disabled selected>Selecciona una cuenta</option>${paymentMethodOptions()}</select></div>`
      : `<p class="hint">Aún no tienes cuentas disponibles. Agrega una desde Inicio → Cuentas disponibles antes de poder guardar este movimiento.</p>`
  ) : '';

  const loanField = state.activeCategory === 'ingreso' ? `
    <div class="toggle-row" id="toggle-loan">
      <span class="toggle-box ${state.isLoan?'on':''}" style="--chip-color:var(--c-deuda)"></span>
      <span class="txt">Es un préstamo — también sumará a tu deuda</span>
    </div>
    ${state.isLoan ? `<div class="field"><label>¿Quién te prestó?</label><input type="text" name="acreedor" placeholder="Ej. Mamá, banco, amigo" required></div>` : ''}
  ` : '';

  const recent = state.entries.filter(e => e.type === state.activeCategory).slice(0,6);
  const recentHtml = recent.length ? recent.map(e => {
    if(state.editingEntryId === e.id) return renderEntryEditForm(e);
    return `
    <div class="entry-row">
      <span class="entry-cat" style="background:${cat.color}"></span>
      <div class="entry-main">
        <div class="entry-detail">${e.detail ? esc(e.detail) : cat.label}${e.description ? ' · ' + esc(e.description) : ''}</div>
        <div class="entry-meta">${fmtDate(e.date)}${e.paymentMethod ? ' · ' + paymentMethodName(e.paymentMethod) : ''}</div>
      </div>
      <div class="entry-amount">${fmt(e.amount)}</div>
      ${e.locked ? `<span class="entry-auto" title="Este movimiento se generó automáticamente y no se puede modificar.">🔒 auto</span>` : `<button class="pm-edit-btn" data-editentry="${e.id}" title="Editar">✎</button>
      <button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>`}
    </div>`;
  }).join('') : `<div class="empty">Aún no hay movimientos en ${cat.label.toLowerCase()}.<br>Captura el primero arriba.</div>`;

  return `
    ${renderTopbar('Capturar', true)}
    <div class="cat-grid">${chips}</div>
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:${cat.color}"></span>${cat.label}</p>
      <form id="entry-form">
        <div class="field">
          <label>Monto</label>
          <input type="number" name="monto" step="0.01" min="0" placeholder="0.00" required inputmode="decimal">
        </div>
        <div class="field">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${todayISO()}">
        </div>
        <div class="toggle-row" id="toggle-solo">
          <span class="toggle-box ${state.soloTotal?'on':''}" style="--chip-color:${cat.color}"></span>
          <span class="txt">Captura rápida — solo el total, sin detalle</span>
        </div>
        ${loanField}
        ${detailFields}
        ${paymentMethodField}
        <button type="submit" class="btn-save" style="--chip-color:${cat.color}">Guardar movimiento</button>
      </form>
    </div>
    <p class="section-label">Últimos registros</p>
    <div class="panel">${recentHtml}</div>
  `;
}

/* ---------- deuda: helpers compartidos (deuda y abono) ---------- */
function debtsWithBalance(){
  return state.debts.map(d => {
    const paid = state.entries.filter(e => e.type==='abono' && e.debtId===d.id).reduce((s,e)=>s+e.amount,0);
    return { ...d, paid: r2(paid), balance: r2(d.amount - paid) };
  });
}
function renderAbonoSection(){
  const withBalance = debtsWithBalance();
  const payable = withBalance.filter(d => d.balance > 0);
  const debtOptions = payable.map(d => `<option value="${d.id}">${esc(d.name)} — debes ${fmt(d.balance)}</option>`).join('');

  let abonoForm;
  if(!payable.length){
    abonoForm = `<div class="panel"><p class="hint">No tienes deudas pendientes por abonar.</p></div>`;
  } else if(!activePaymentMethods().length){
    abonoForm = `<div class="panel"><p class="hint">Agrega una cuenta disponible desde Inicio → Cuentas disponibles antes de poder registrar un abono.</p></div>`;
  } else {
    abonoForm = `
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--c-abono)"></span>Registrar abono</p>
      <form id="abono-form">
        <div class="field">
          <label>¿A quién le debes?</label>
          <select name="debtId" required><option value="" disabled selected>Selecciona una deuda</option>${debtOptions}</select>
        </div>
        <div class="field"><label>Monto del abono</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${todayISO()}"></div>
        <div class="field"><label>Cuenta disponible</label><select name="paymentMethod" required><option value="" disabled selected>Selecciona una cuenta</option>${paymentMethodOptions()}</select></div>
        <button type="submit" class="btn-save" style="--chip-color:var(--c-abono)">Registrar abono</button>
      </form>
    </div>`;
  }

  const recentAbonos = state.entries.filter(e => e.type==='abono').slice(0,6);
  const abonoList = recentAbonos.length ? recentAbonos.map(e => {
    if(state.editingEntryId === e.id) return renderEntryEditForm(e);
    const d = state.debts.find(x => x.id === e.debtId);
    return `<div class="entry-row">
      <span class="entry-cat" style="background:var(--c-abono)"></span>
      <div class="entry-main"><div class="entry-detail">${d ? esc(d.name) : 'Deuda eliminada'}</div><div class="entry-meta">${fmtDate(e.date)}${e.paymentMethod ? ' · ' + paymentMethodName(e.paymentMethod) : ''}</div></div>
      <div class="entry-amount">${fmt(e.amount)}</div>
      ${e.locked ? `<span class="entry-auto" title="Este movimiento se generó automáticamente y no se puede modificar.">🔒 auto</span>` : `<button class="pm-edit-btn" data-editentry="${e.id}" title="Editar">✎</button>
      <button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>`}
    </div>`;
  }).join('') : `<div class="empty">Aún no registras abonos.</div>`;

  return { abonoForm, abonoList };
}

/* ---------- deuda: formulario de edición reutilizable (Deuda y Resumen) ---------- */
function renderDebtEditForm(d){
  return `<form class="debt-edit-form" data-debtedit="${d.id}" style="padding:12px 0;border-bottom:1px solid var(--line);">
    <div class="field"><label>¿A quién le debes?</label><input type="text" name="name" value="${esc(d.name)}" required></div>
    <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" value="${d.amount}"></div>
    <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${d.date}"></div>
    <div style="display:flex;gap:10px;">
      <button type="submit" class="btn-save" style="--chip-color:var(--c-deuda)">Guardar</button>
      <button type="button" class="btn-save" data-debtcancel style="--chip-color:#636366;">Cancelar</button>
    </div>
  </form>`;
}

/* ---------- deudas liquidadas ---------- */
function liquidatedDebts(){
  return state.debts.map(d => {
    const abonos = state.entries.filter(e => e.type==='abono' && e.debtId===d.id);
    if(!abonos.length) return null;
    const paid = abonos.reduce((s,e)=>s+e.amount,0);
    const balance = r2(d.amount - paid);
    if(balance > 0) return null;
    const lastPaymentDate = abonos.reduce((max,e)=> e.date > max ? e.date : max, abonos[0].date);
    return { ...d, paid, balance, numAbonos: abonos.length, lastPaymentDate };
  }).filter(Boolean);
}
function renderDeudasLiquidadas(){
  const liquidated = liquidatedDebts();
  const total = liquidated.reduce((s,d)=>s+d.amount,0);
  const rows = liquidated.length ? liquidated.map(d => `
    <div class="entry-row" style="border-bottom:1px solid var(--line);">
      <span class="entry-cat" style="background:var(--c-liquidada);"></span>
      <div class="entry-main">
        <div class="entry-detail" style="color:var(--c-liquidada);font-weight:600;">${esc(d.name)}</div>
        <div class="entry-meta">${fmt(d.amount)} original · ${d.numAbonos} abono${d.numAbonos===1?'':'s'} · inicio ${fmtDate(d.date)} · liquidada ${fmtDate(d.lastPaymentDate)}</div>
      </div>
      <div class="entry-amount" style="color:var(--c-liquidada);">${fmt(d.amount)}</div>
    </div>`).join('') : `<div class="empty">Aún no tienes deudas liquidadas.</div>`;

  return `
    ${renderTopbar('Deudas liquidadas', true)}
    <div class="balance-panel" style="border-color:color-mix(in srgb, var(--c-liquidada) 26%, var(--line));">
      <div class="balance-label" style="color:var(--c-liquidada);">Total de deudas liquidadas</div>
      <div class="balance-figure">${fmt(total)}</div>
      <div class="balance-sub">${liquidated.length} deuda${liquidated.length===1?'':'s'} liquidada${liquidated.length===1?'':'s'}</div>
    </div>
    <p class="section-label">Acreedores liquidados</p>
    <div class="panel">${rows}</div>
  `;
}

/* ---------- render: deuda ---------- */
function renderDeuda(){
  const withBalance = debtsWithBalance();
  const active = withBalance.filter(d => d.balance > 0);
  const pending = active.reduce((s,d)=>s+d.balance,0);

  const debtRows = active.length ? active.map(d => {
    if(state.editingDebtId === d.id) return renderDebtEditForm(d);
    return `
    <div class="entry-row">
      <span class="entry-cat" style="background:var(--c-deuda)"></span>
      <div class="entry-main">
        <div class="entry-detail">${esc(d.name)}</div>
        <div class="entry-meta">${fmt(d.amount)} original · ${fmt(d.paid)} abonado</div>
      </div>
      <div class="entry-amount" style="color:var(--c-deuda)">${fmt(d.balance)}</div>
      <button class="pm-edit-btn" data-debtedit-start="${d.id}" title="Editar">✎</button>
      <button class="entry-del" data-deldebt="${d.id}" title="Eliminar deuda">×</button>
    </div>`;
  }).join('') : `<div class="empty">No tienes deudas pendientes registradas.</div>`;

  const { abonoForm, abonoList } = renderAbonoSection();

  return `
    ${renderTopbar('Deuda', true)}
    <div class="balance-panel">
      <div class="balance-label">Deuda pendiente total</div>
      <div class="balance-figure" style="color:${pending>0?'var(--c-deuda)':'var(--c-ingreso)'}">${fmt(pending)}</div>
      <div class="balance-sub">${active.length} deuda${active.length===1?'':'s'} pendiente${active.length===1?'':'s'}</div>
    </div>
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--c-deuda)"></span>Nueva deuda</p>
      <form id="debt-form">
        <div class="field"><label>¿A quién le debes?</label><input type="text" name="name" placeholder="Ej. Tarjeta BBVA" required></div>
        <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${todayISO()}"></div>
        <button type="submit" class="btn-save" style="--chip-color:var(--c-deuda)">Registrar deuda</button>
      </form>
    </div>
    <p class="section-label">Lo que debes</p>
    <div class="panel">${debtRows}</div>
    <div class="panel" style="text-align:center;">
      <button type="button" class="btn-save" data-page="deudas-liquidadas">Deudas liquidadas</button>
    </div>
    ${abonoForm}
    <p class="section-label">Abonos recientes</p>
    <div class="panel">${abonoList}</div>
  `;
}

/* ---------- render: abono (acceso directo desde inicio) ---------- */
function renderAbono(){
  const pending = totalDebtPending();
  const { abonoForm, abonoList } = renderAbonoSection();
  return `
    ${renderTopbar('Abono', true)}
    <div class="balance-panel">
      <div class="balance-label">Deuda pendiente total</div>
      <div class="balance-figure" style="color:${pending>0?'var(--c-deuda)':'var(--c-ingreso)'}">${fmt(pending)}</div>
    </div>
    ${abonoForm}
    <p class="section-label">Abonos recientes</p>
    <div class="panel">${abonoList}</div>
    <p class="hint" style="margin:0 20px 10px;">¿Necesitas registrar una deuda nueva? Ve a Inicio → Deuda.</p>
  `;
}

/* ---------- render: transferencia ---------- */
function renderTransferencia(){
  if(activePaymentMethods().length < 2){
    return `
      ${renderTopbar('Transferencia', true)}
      <div class="panel">
        <p class="hint">Necesitas al menos dos cuentas disponibles (por ejemplo Efectivo y Tarjeta BBVA) para poder transferir entre cuentas. Agrégalas desde Inicio → Cuentas disponibles.</p>
      </div>
    `;
  }
  const options = paymentMethodOptions();
  const recent = state.entries.filter(e => e.type === 'transferencia').slice(0,8);
  const recentHtml = recent.length ? recent.map(e => {
    if(state.editingTransferId === e.id) return renderTransferEditForm(e);
    const comisionEntry = e.comisionEntryId ? state.entries.find(x => x.id === e.comisionEntryId) : null;
    return `
    <div class="entry-row">
      <span class="entry-cat" style="background:var(--c-transferencia)"></span>
      <div class="entry-main">
        <div class="entry-detail">${esc(e.detail)}</div>
        <div class="entry-meta">${fmtDate(e.date)}${comisionEntry ? ' · comisión ' + fmt(comisionEntry.amount) : ''}</div>
      </div>
      <div class="entry-amount">${fmt(e.amount)}</div>
      <button class="pm-edit-btn" data-transferedit-start="${e.id}" title="Editar">✎</button>
      <button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>
    </div>`;
  }).join('') : `<div class="empty">Aún no registras transferencias.</div>`;

  return `
    ${renderTopbar('Transferencia', true)}
    <div class="panel">
      <p class="panel-title"><span class="dot" style="background:var(--c-transferencia)"></span>Nueva transferencia</p>
      <form id="transfer-form">
        <div class="field"><label>Origen</label><select name="origen" required>${options}</select></div>
        <div class="field"><label>Destino</label><select name="destino" required>${options}</select></div>
        <div class="field"><label>Monto</label><input type="number" name="monto" step="0.01" min="0" required inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>Comisión por servicio (opcional)</label><input type="number" name="comision" step="0.01" min="0" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${todayISO()}"></div>
        <button type="submit" class="btn-save" style="--chip-color:var(--c-transferencia)">Registrar transferencia</button>
      </form>
      <p class="hint">El monto se resta de la cuenta de origen y se suma a la de destino. La comisión (si la hay) también se descuenta del origen y se registra aparte como gasto.</p>
    </div>
    <p class="section-label">Transferencias recientes</p>
    <div class="panel">${recentHtml}</div>
  `;
}

/* ---------- render: resumen ---------- */
/* ---------- Reportes por tipo de movimiento ---------- */
const REPORT_TYPES = [
  { id:'global',        label:'Global' },
  { id:'ingreso',       label:'Ingresos',       s:'ingreso',        p:'ingresos',        t:'ingresos',  f:false },
  { id:'gasto',         label:'Gastos',         s:'gasto',          p:'gastos',          t:'gastos',    f:false },
  { id:'deuda',         label:'Deudas',         s:'deuda',          p:'deudas',          t:'deudas',    f:true  },
  { id:'abono',         label:'Abonos',         s:'abono',          p:'abonos',          t:'abonos',    f:false },
  { id:'transferencia', label:'Transferencias', s:'transferencia',  p:'transferencias',  t:'transferencias', f:true  },
  { id:'cajachica',     label:'Caja chica',     s:'movimiento de caja chica', p:'movimientos de caja chica', t:'caja chica', f:false },
];
const DOW_SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
/* Partes del periodo para la gráfica: semana → 7 días; quincena y mes → días; año → 12 meses. El día no se grafica. */
function reportParts(gran, start, end){
  const keys = [], labels = [];
  if(gran === 'semana'){
    for(let i=0;i<7;i++){ const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i); keys.push(isoOf(dt)); labels.push(DOW_SHORT[i] + ' ' + dt.getDate()); }
    return { keys, labels, keyOf: d => d, show: () => true, values: true };
  }
  if(gran === 'año'){
    for(let i=0;i<12;i++){ keys.push(start.getFullYear() + '-' + String(i+1).padStart(2,'0')); labels.push(MONTH_SHORT[i]); }
    return { keys, labels, keyOf: d => d.slice(0,7), show: () => true, values: false };
  }
  for(let dt = new Date(start); dt <= end; dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()+1)){ keys.push(isoOf(dt)); labels.push(String(dt.getDate())); }
  const every = gran === 'quincena';
  return { keys, labels, keyOf: d => d, show: i => every || i === 0 || (i+1) % 5 === 0, values: false };
}
function barChart(parts, vals, o){
  const W=340, H=200, L=36, R=8, T=16, B=26, iw=W-L-R, ih=H-T-B, n=vals.length;
  const max = Math.max(0, ...vals);
  const raw = o.count ? Math.max(1, max/4) : (max > 0 ? max/4 : 250), pw = Math.pow(10, Math.floor(Math.log10(raw)));
  const mults = o.count ? [1,2,5,10] : [1,2,2.5,5,10];
  const step = mults.find(m => m*pw >= raw) * pw, top = step*4;
  const slot = iw/n, bw = Math.min(slot*0.62, 30);
  const y = v => T + ih - v/top*ih;
  let grid = '';
  for(let k=0;k<=4;k++){ const v = step*k, yy = y(v).toFixed(1); grid += `<line class="fc-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="bc-t" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${axisNum(v)}</text>`; }
  let bars = '', xl = '';
  vals.forEach((v,i) => {
    const cx = L + slot*i + slot/2, h = v/top*ih;
    const tip = parts.labels[i] + ': ' + (o.count ? v : fmt(v));
    if(v > 0) bars += `<rect x="${(cx-bw/2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="fill:${o.color}"><title>${esc(tip)}</title></rect>`;
    if(v > 0 && n <= 7) bars += `<text class="bc-v" x="${cx.toFixed(1)}" y="${(y(v)-4).toFixed(1)}" text-anchor="middle">${o.count ? v : '$' + Math.round(v).toLocaleString('es-MX')}</text>`;
    if(parts.show(i)) xl += `<text class="bc-t" x="${cx.toFixed(1)}" y="${H-8}" text-anchor="middle">${esc(parts.labels[i])}</text>`;
  });
  return `<svg class="fc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">${grid}${bars}${xl}</svg>`;
}

function renderResumen(){
  const { start, end, label } = getPeriodRange(state.granularity, state.refDate);
  const items = entriesInRange(start, end);

  const totals = {};
  CATEGORIES.forEach(c => totals[c.id] = 0);
  items.forEach(e => { totals[e.type] += e.amount; });

  const maxTotal = Math.max(1, ...CATEGORIES.map(c => totals[c.id]));

  const gransets = [['dia','Día'],['semana','Semana'],['quincena','Quinc.'],['mes','Mes'],['año','Año']];
  const segHtml = gransets.map(([id,lbl]) => `<button class="${state.granularity===id?'active':''}" data-gran="${id}">${lbl}</button>`).join('');

  const rows = CATEGORIES.filter(c => c.id !== 'capital' || totals.capital > 0).map(c => `
    <div class="cat-row">
      <span class="name">${c.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(totals[c.id]/maxTotal*100).toFixed(1)}%;background:${c.color}"></span></span>
      <span class="amount">${fmt(totals[c.id])}</span>
    </div>`).join('');

  const rt = REPORT_TYPES.some(t => t.id === state.reportType) ? state.reportType : 'global';
  const rtInfo = REPORT_TYPES.find(t => t.id === rt);
  const listItems = rt === 'global' ? items : items.filter(e => e.type === rt);
  const typeChips = REPORT_TYPES.map(t => `<button type="button" class="type-chip ${rt===t.id?'active':''}" data-rtype="${t.id}" aria-pressed="${rt===t.id}">${t.label}</button>`).join('');

  /* Resumen del periodo según el tipo elegido (solo información del periodo, sin balances actuales). */
  let summaryHtml;
  if(rt === 'global'){
    summaryHtml = `<div class="balance-panel">
      <div class="balance-label">Reporte global del periodo</div>
      <div class="balance-figure">${items.length}</div>
      <div class="balance-sub">movimiento${items.length===1?'':'s'} registrado${items.length===1?'':'s'}</div>
    </div>`;
  } else {
    const total = r2(listItems.reduce((sum,e) => sum + e.amount, 0)), n = listItems.length;
    summaryHtml = `<div class="balance-panel">
      <div class="balance-label">Total de ${rtInfo.t}</div>
      <div class="balance-figure">${fmt(total)}</div>
      <div class="balance-sub">${n} ${n===1 ? rtInfo.s : rtInfo.p} registrad${rtInfo.f ? 'a' : 'o'}${n===1?'':'s'}</div>
    </div>`;
  }

  /* Gráfica: total (o cantidad, en Global) en cada parte del periodo. El día no se grafica. */
  let chartHtml = '';
  if(state.granularity !== 'dia'){
    const parts = reportParts(state.granularity, start, end);
    const idx = {}; parts.keys.forEach((k,i) => idx[k] = i);
    const vals = parts.keys.map(() => 0);
    listItems.forEach(e => { const i = idx[parts.keyOf(e.date)]; if(i !== undefined) vals[i] += (rt === 'global' ? 1 : e.amount); });
    const clean = vals.map(r2);
    const unit = state.granularity === 'año' ? 'mes' : 'día';
    const title = cap(rt === 'global' ? 'movimientos' : rtInfo.t) + ' por ' + unit;
    chartHtml = `<div class="panel">
      <div class="bc-head">${title}</div>
      ${barChart(parts, clean, { count: rt === 'global', color: rt === 'global' ? 'var(--accent)' : catById(rt).color, aria: title })}
    </div>`;
  }

  const txList = listItems.length ? listItems
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date))
    .map(e => {
      const c = catById(e.type);
      const pmObj = e.paymentMethod ? state.paymentMethods.find(m => m.id === e.paymentMethod) : null;
      const pmMeta = pmObj ? ` · <span style="color:${pmColor(pmObj)};">●</span> ${esc(pmObj.name)}${pmObj.status==='archived' ? ' · Cuenta archivada' : ''}` : '';

      if(e.type === 'transferencia'){
        if(state.editingTransferId === e.id) return renderTransferEditForm(e);
        const comisionEntry = e.comisionEntryId ? state.entries.find(x => x.id === e.comisionEntryId) : null;
        return `
        <div class="entry-row">
          <span class="entry-cat" style="background:${c.color}"></span>
          <div class="entry-main">
            <div class="entry-detail">${c.label} · ${esc(e.detail)}</div>
            <div class="entry-meta">${fmtDate(e.date)}${comisionEntry ? ' · comisión ' + fmt(comisionEntry.amount) : ''}</div>
          </div>
          <div class="entry-amount">${fmt(e.amount)}</div>
          <button class="pm-edit-btn" data-transferedit-start="${e.id}" title="Editar">✎</button>
          <button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>
        </div>`;
      }

      if(e.type === 'deuda'){
        const debt = state.debts.find(x => x.id === e.debtId);
        if(debt && state.editingDebtId === debt.id) return renderDebtEditForm(debt);
        return `
        <div class="entry-row">
          <span class="entry-cat" style="background:${c.color}"></span>
          <div class="entry-main">
            <div class="entry-detail">${c.label}${e.detail ? ' · ' + esc(e.detail) : ''}</div>
            <div class="entry-meta">${fmtDate(e.date)}</div>
          </div>
          <div class="entry-amount">${fmt(e.amount)}</div>
          ${debt ? `<button class="pm-edit-btn" data-debtedit-start="${debt.id}" title="Editar">✎</button><button class="entry-del" data-deldebt="${debt.id}" title="Eliminar deuda">×</button>` : `<button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>`}
        </div>`;
      }

      if(state.editingEntryId === e.id) return renderEntryEditForm(e);
      return `
      <div class="entry-row">
        <span class="entry-cat" style="background:${c.color}"></span>
        <div class="entry-main">
          <div class="entry-detail">${c.label}${e.detail ? ' · ' + esc(e.detail) : ''}</div>
          <div class="entry-meta">${fmtDate(e.date)}${pmMeta}</div>
        </div>
        <div class="entry-amount">${fmt(e.amount)}</div>
        ${e.locked ? `<span class="entry-auto" title="Este movimiento se generó automáticamente y no se puede modificar.">🔒 auto</span>` : `<button class="pm-edit-btn" data-editentry="${e.id}" title="Editar">✎</button>
        <button class="entry-del" data-del="${e.id}" title="Eliminar">×</button>`}
      </div>`;
    }).join('') : `<div class="empty">Sin movimientos en este periodo.</div>`;

  const pending = totalDebtPending();
  const ccItems = items.filter(e => e.type === 'cajachica');
  const ccTotal = ccItems.reduce((s,e)=>s+e.amount,0);
  const ccByMethod = {};
  ccItems.forEach(e => { if(e.paymentMethod) ccByMethod[e.paymentMethod] = (ccByMethod[e.paymentMethod]||0) + e.amount; });

  return `
    ${renderTopbar('Reportes', true)}
    <div class="filter-bar">
      <div class="type-chips" role="group" aria-label="Tipo de movimiento">${typeChips}</div>
      <div class="seg">${segHtml}</div>
      <div class="nav-arrows">
        <button data-nav="-1">‹</button>
        <span class="period-label">${label}</span>
        <button data-nav="1">›</button>
      </div>
    </div>

    ${summaryHtml}
    ${chartHtml}

    ${state.debts.length ? `<div class="panel stat-row">
      <span class="k">Deuda pendiente total</span>
      <span class="v" style="color:${pending>0?'var(--c-deuda)':'var(--c-ingreso)'}">${fmt(pending)}</span>
    </div>` : ''}

    ${(() => {
      /* Solo cuentas activas con saldo distinto de cero; sin porcentajes. */
      const conSaldo = paymentMethodBalances(todayISO()).filter(m => m.status !== 'archived' && r2(m.balance) !== 0);
      if(!conSaldo.length) return '';
      return `<p class="section-label">Saldo por cuenta</p>
    <div class="panel">
      ${conSaldo.map(m => `
        <div class="stat-row" style="padding:8px 0;">
          <span class="k" style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:${m.color};flex-shrink:0;"></span>${esc(m.name)}</span>
          <span class="v" style="font-family:var(--mono);font-weight:600;color:${m.balance>=0?'var(--ink)':'var(--c-gasto)'}">${fmt(m.balance)}</span>
        </div>`).join('')}
    </div>`;
    })()}

    ${ccItems.length && (rt === 'global' || rt === 'cajachica') ? `<p class="section-label">Caja chica</p>
    <div class="panel">
      <div class="stat-row" style="padding:8px 0;"><span class="k">Movimientos</span><span class="v">${ccItems.length}</span></div>
      <div class="stat-row" style="padding:8px 0;"><span class="k">Total enviado a caja chica</span><span class="v" style="color:var(--c-cajachica)">${fmt(ccTotal)}</span></div>
      ${Object.entries(ccByMethod).map(([pmId, amt]) => {
        const pmObj = state.paymentMethods.find(m => m.id === pmId);
        return `<div class="stat-row" style="padding:8px 0;">
          <span class="k" style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:${pmObj?pmColor(pmObj):'#636366'};"></span>${pmObj?esc(pmObj.name)+(pmObj.status==='archived'?' · Cuenta archivada':''):'Cuenta eliminada'}</span>
          <span class="v">${fmt(amt)}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${rt === 'global' ? `<p class="section-label">Por categoría</p>
    <div class="panel">${rows}</div>` : ''}

    <p class="section-label">Movimientos</p>
    <div class="panel">${txList}</div>
  `;
}

/* ---------- render principal ---------- */
function render(){
  const app = document.getElementById('app');
  if(!state.loaded){
    app.innerHTML = `<div class="empty">Cargando tu libro mayor…</div>`;
    return;
  }
  let body;
  if(state.page === 'home') body = renderHome();
  else if(state.page === 'capturar') body = renderCapturar();
  else if(state.page === 'deuda') body = renderDeuda();
  else if(state.page === 'deudas-liquidadas') body = renderDeudasLiquidadas();
  else if(state.page === 'abono') body = renderAbono();
  else if(state.page === 'transferencia') body = renderTransferencia();
  else if(state.page === 'ajustes') body = renderAjustes();
  else if(state.page === 'cuentas') body = renderCuentas();
  else if(state.page === 'categorias') body = renderCategorias();
  else if(state.page === 'catadmin') body = renderCatAdmin();
  else body = renderResumen();

  if(state.loadError){
    body = `<div style="margin:12px 20px;padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--c-gasto);color:var(--c-gasto);font-size:13.5px;line-height:1.45;"><b>No se pudieron leer tus datos guardados.</b><br>Por seguridad la app no guardará nada nuevo, para no sobrescribirlos. Cierra y vuelve a abrir la app. Si el aviso continúa, restaura un respaldo desde Inicio → Respaldo → Importar.</div>` + body;
  }
  body += `<p class="app-credit">Desarrollado por Kubee Kapoor (kubeekapoor@proton.me)</p>`;
  body += renderPmCloseModal();
  body += renderWipeModal();
  body += renderConfirmModal();
  body += renderPwModal();
  body += renderSheet();
  body += renderCifra();
  const showTabs = ['home','resumen','categorias','ajustes'].includes(state.page);
  if(showTabs) body += renderTabBar();
  app.className = showTabs ? 'has-tabs' : '';
  document.body.classList.toggle('has-tabs', showTabs);

  app.innerHTML = body;
  bindEvents();
}

function bindEvents(){
  const eye = document.getElementById('eye-toggle'); if(eye) eye.addEventListener('click', toggleHideBalance);
  const fab = document.getElementById('fab'); if(fab) fab.addEventListener('click', () => { state.sheet = true; render(); });
  document.querySelectorAll('[data-cifra]').forEach(el => el.addEventListener('click', () => { state.cifra = el.dataset.cifra; render(); }));
  document.querySelectorAll('[data-cifra-close]').forEach(el => el.addEventListener('click', () => { state.cifra = null; render(); }));
  document.querySelectorAll('[data-sheet-close]').forEach(el => el.addEventListener('click', () => { state.sheet = false; render(); }));
  document.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => sheetGo(el.dataset.act)));
  const keepScroll = fn => { const sy = window.scrollY; fn(); render(); window.scrollTo(0, sy); };
  const flowSel = document.getElementById('flow-range'); if(flowSel) flowSel.addEventListener('change', () => { state.flowRange = flowSel.value; state.flowSel = null; render(); });
  document.querySelectorAll('[data-fstyle]').forEach(el => el.addEventListener('click', () => { state.flowStyle = el.dataset.fstyle; saveFlowStyle(); keepScroll(() => {}); }));
  document.querySelectorAll('[data-fi]').forEach(el => el.addEventListener('click', () => { const i = +el.dataset.fi; keepScroll(() => { state.flowSel = (state.flowSel === i) ? null : i; }); }));
  const flowX = document.getElementById('fl-det-close'); if(flowX) flowX.addEventListener('click', () => keepScroll(() => { state.flowSel = null; }));
  document.querySelectorAll('[data-rtype]').forEach(el => el.addEventListener('click', () => { state.reportType = el.dataset.rtype; render(); }));
  document.querySelectorAll('[data-catkind]').forEach(el => el.addEventListener('click', () => { state.catKind = el.dataset.catkind; render(); }));
  document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => setPage(el.dataset.page)));
  document.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('click', () => selectCategory(el.dataset.cat)));
  document.querySelectorAll('[data-gran]').forEach(el => el.addEventListener('click', () => setGran(el.dataset.gran)));
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navPeriod(parseInt(el.dataset.nav))));
  document.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => deleteEntry(el.dataset.del)));
  document.querySelectorAll('[data-deldebt]').forEach(el => el.addEventListener('click', () => deleteDebt(el.dataset.deldebt)));
  const toggle = document.getElementById('toggle-solo');
  if(toggle) toggle.addEventListener('click', toggleSolo);
  const loanToggle = document.getElementById('toggle-loan');
  if(loanToggle) loanToggle.addEventListener('click', toggleLoan);
  document.querySelectorAll('[data-catadminkind]').forEach(el => el.addEventListener('click', () => { state.catAdminKind = el.dataset.catadminkind; state.editingCatId = null; render(); }));
  const catForm = document.getElementById('cat-form');
  if(catForm) catForm.addEventListener('submit', handleCatAdd);
  document.querySelectorAll('[data-catsug]').forEach(el => el.addEventListener('click', () => { const sy = window.scrollY; if(addCategory(state.catAdminKind, el.dataset.catsug)){ render(); window.scrollTo(0, sy); } }));
  document.querySelectorAll('[data-catedit-start]').forEach(el => el.addEventListener('click', () => startEditCat(el.dataset.cateditStart)));
  document.querySelectorAll('[data-catcancel]').forEach(el => el.addEventListener('click', cancelEditCat));
  document.querySelectorAll('.cat-edit-form').forEach(el => el.addEventListener('submit', (ev) => saveCatEdit(ev, el.dataset.catedit)));
  document.querySelectorAll('[data-delcat]').forEach(el => el.addEventListener('click', () => deleteCategory(el.dataset.delcat)));
  const pmForm = document.getElementById('pm-form');
  if(pmForm){
    pmForm.addEventListener('submit', addPaymentMethod);
    /* Conserva lo escrito aunque la vista se vuelva a pintar (por ejemplo al
       elegir color o ícono). Antes esto se hacía con oninput inline, que no
       podía ver el estado del IIFE y lanzaba un error en cada tecla. */
    const pmName = pmForm.elements.name;
    const pmCapital = pmForm.elements.capital;
    if(pmName) pmName.addEventListener('input', () => { state.newPmName = pmName.value; });
    if(pmCapital) pmCapital.addEventListener('input', () => { state.newPmCapital = pmCapital.value; });
  }
  document.querySelectorAll('[data-delpm]').forEach(el => el.addEventListener('click', () => requestClosePaymentMethod(el.dataset.delpm)));
  const wipeRequestBtn = document.querySelector('[data-wipe-request]');
  if(wipeRequestBtn) wipeRequestBtn.addEventListener('click', requestWipeData);
  const wipeConfirmBtn = document.querySelector('[data-wipe-confirm]');
  if(wipeConfirmBtn) wipeConfirmBtn.addEventListener('click', confirmWipeData);
  const wipeCancelBtn = document.querySelector('[data-wipe-cancel]');
  if(wipeCancelBtn) wipeCancelBtn.addEventListener('click', cancelWipeData);
  const confirmOkBtn = document.querySelector('[data-confirm-ok]');
  if(confirmOkBtn) confirmOkBtn.addEventListener('click', runConfirm);
  const confirmCancelBtn = document.querySelector('[data-confirm-cancel]');
  if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirm);
  const pmCloseCancel = document.querySelector('[data-pmclose-cancel]');
  if(pmCloseCancel) pmCloseCancel.addEventListener('click', closePmCloseModal);
  const pmCloseBack = document.querySelector('[data-pmclose-back]');
  if(pmCloseBack) pmCloseBack.addEventListener('click', pmCloseModalBack);
  const pmCloseTransferBtn = document.querySelector('[data-pmclose-transfer]');
  if(pmCloseTransferBtn) pmCloseTransferBtn.addEventListener('click', pmCloseModalShowTransfer);
  const pmCloseRemoveBtn = document.querySelector('[data-pmclose-remove]');
  if(pmCloseRemoveBtn) pmCloseRemoveBtn.addEventListener('click', pmCloseModalShowRemove);
  const pmCloseConfirmZero = document.querySelector('[data-pmclose-confirmzero]');
  if(pmCloseConfirmZero) pmCloseConfirmZero.addEventListener('click', confirmArchiveZeroBalance);
  const pmCloseConfirmRemove = document.querySelector('[data-pmclose-confirmremove]');
  if(pmCloseConfirmRemove) pmCloseConfirmRemove.addEventListener('click', confirmRemoveBalance);
  const pmCloseTransferForm = document.getElementById('pm-close-transfer-form');
  if(pmCloseTransferForm) pmCloseTransferForm.addEventListener('submit', handleTransferCloseSubmit);
  document.querySelectorAll('[data-pmcolor-fn]').forEach(el => el.addEventListener('click', () => {
    const fn = { selectNewPmColor, selectEditPmColor }[el.dataset.pmcolorFn];
    if(fn) fn(el.dataset.pmcolor);
  }));
  document.querySelectorAll('[data-pmicon-fn]').forEach(el => el.addEventListener('click', () => {
    const fn = { selectNewPmIcon, selectEditPmIcon }[el.dataset.pmiconFn];
    if(fn) fn(el.dataset.pmicon);
  }));
  document.querySelectorAll('[data-pmedit-start]').forEach(el => el.addEventListener('click', () => startEditPm(el.dataset.pmeditStart)));
  document.querySelectorAll('[data-pmcancel]').forEach(el => el.addEventListener('click', cancelEditPm));
  document.querySelectorAll('.pm-edit-form').forEach(el => el.addEventListener('submit', (ev) => savePmEdit(ev, el.dataset.pmedit)));
  document.querySelectorAll('[data-editentry]').forEach(el => el.addEventListener('click', () => startEditEntry(el.dataset.editentry)));
  document.querySelectorAll('[data-entrycancel]').forEach(el => el.addEventListener('click', cancelEditEntry));
  document.querySelectorAll('.entry-edit-form').forEach(el => el.addEventListener('submit', (ev) => saveEntryEdit(ev, el.dataset.entryedit)));
  document.querySelectorAll('[data-debtedit-start]').forEach(el => el.addEventListener('click', () => startEditDebt(el.dataset.debteditStart)));
  document.querySelectorAll('[data-debtcancel]').forEach(el => el.addEventListener('click', cancelEditDebt));
  document.querySelectorAll('.debt-edit-form').forEach(el => el.addEventListener('submit', (ev) => saveDebtEdit(ev, el.dataset.debtedit)));
  document.querySelectorAll('[data-transferedit-start]').forEach(el => el.addEventListener('click', () => startEditTransfer(el.dataset.transfereditStart)));
  document.querySelectorAll('[data-transfercancel]').forEach(el => el.addEventListener('click', cancelEditTransfer));
  document.querySelectorAll('.transfer-edit-form').forEach(el => el.addEventListener('submit', (ev) => saveTransferEdit(ev, el.dataset.transferedit)));
  const themeBtn = document.getElementById('theme-toggle');
  if(themeBtn) themeBtn.addEventListener('click', toggleTheme);
  const form = document.getElementById('entry-form');
  if(form) form.addEventListener('submit', handleSave);
  const debtForm = document.getElementById('debt-form');
  if(debtForm) debtForm.addEventListener('submit', handleDebtSave);
  const abonoForm = document.getElementById('abono-form');
  if(abonoForm) abonoForm.addEventListener('submit', handleAbonoSave);
  const transferForm = document.getElementById('transfer-form');
  if(transferForm) transferForm.addEventListener('submit', handleTransferSave);
  document.querySelectorAll('[data-scale]').forEach(el => el.addEventListener('click', () => setUiScale(el.dataset.scale)));
  const alSel = document.getElementById('autolock-select');
  if(alSel) alSel.addEventListener('change', () => setAutoLock(alSel.value));
  const bioToggle = document.getElementById('toggle-biometric');
  if(bioToggle) bioToggle.addEventListener('click', () => toggleBiometric(!biometricState.enabled));
  const pwForm = document.getElementById('pw-form');
  if(pwForm){
    pwForm.addEventListener('submit', submitPwModal);
    document.querySelector('[data-pw-cancel]').addEventListener('click', () => { state.pwModal = null; render(); });
    document.getElementById('pw-main').focus();
  }
  const exportBtn = document.getElementById('export-btn');
  if(exportBtn) exportBtn.addEventListener('click', exportBackup);
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  if(importBtn && importFile){
    importBtn.addEventListener('click', () => {
      /* Abrir el selector de archivos manda la app a segundo plano: avisamos a la capa
         de bloqueo para que no la bloquee mientras el usuario elige el respaldo. */
      if(window.MetriaPlatform && window.MetriaPlatform.beginExternalActivity) window.MetriaPlatform.beginExternalActivity();
      importFile.click();
    });
    importFile.addEventListener('change', importBackup);
  }
}

async function init(){
  await Promise.all([loadAll(), loadTheme()]);
  state.loaded = true;
  render();
}

/* Al bloquear, la capa de arranque descarga esta interfaz de la memoria. */
function shutdown(){
  state.entries = [];
  state.debts = [];
  state.paymentMethods = [];
  state.categories = [];
  state.loaded = false;
  const root = document.getElementById('app');
  if (root) root.innerHTML = '';
}

window.MetriaApp = { init, shutdown, handleBack, closeTopLayer };
})();
