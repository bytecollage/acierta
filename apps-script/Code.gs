/**
 * Code.gs — API del historial de intentos sobre Google Sheets.
 *
 * Se publica como Aplicación web (Ejecutar como: Yo · Acceso: Cualquier usuario).
 * La configuración (client ID, pepper, clave de administración) vive en Config.gs,
 * que NO se versiona. Ver docs/arquitectura.md §2–3.
 *
 * Acciones (todas por POST, cuerpo JSON enviado como text/plain para evitar el
 * preflight CORS):
 *
 *   list    { idToken }                    -> intentos del estudiante
 *   create  { idToken, record }            -> añade un intento
 *   import  { adminKey, email, records }   -> carga intentos antiguos para un correo;
 *                                             se asignan al estudiante en su primer login
 *
 * Mantenimiento (se ejecuta a mano desde el editor de Apps Script):
 *
 *   migrateExamIds()  -> pasa la hoja a los ids nuevos (diagnostico-7 → N1E02). Ver D-14.
 *
 * No hay acciones de borrado ni de edición: la API pública solo lee y añade.
 *
 * Identidad: el cliente inicia sesión con Google (Google Identity Services) y manda el
 * ID token. Aquí se verifica contra Google y el estudiante se guarda como
 * SHA-256(PEPPER + ":" + sub). La hoja no contiene correos ni nombres.
 */

const SHEET_ATTEMPTS = 'attempts';
const SHEET_STUDENTS = 'students';

const ATTEMPT_COLUMNS = [
  'id', 'studentId', 'examId', 'examTitle', 'version', 'completedAt',
  'attemptNumber', 'isFirstAttempt', 'score', 'total', 'percentage',
  'correctCount', 'incorrectCount', 'minutes', 'activeMs', 'elapsedWallMs',
  'answers', 'keyDistribution', 'areaResults', 'topicResults', 'topicAreas',
  'createdAt',
];
const STUDENT_COLUMNS = ['studentId', 'createdAt', 'lastSeenAt'];

const JSON_FIELDS = ['keyDistribution', 'areaResults', 'topicResults', 'topicAreas'];
const INT_FIELDS = ['attemptNumber', 'score', 'total', 'percentage', 'correctCount',
                    'incorrectCount', 'minutes', 'activeMs', 'elapsedWallMs'];

const MAX_JSON_CHARS = 40000;        // el límite de una celda es 50 000
const MAX_ATTEMPTS_PER_EXAM = 200;   // tope por estudiante y examen (no se borra nada)
const RATE_LIMIT = { creates: 30, windowSec: 600 };
const PENDING_PREFIX = 'pending:';
const PENDING_PROP = 'PENDING_CLAIMS';

/* ===================================================== ids de examen (D-14) */

/** Hasta el 2026-11-19 los exámenes se identificaban como diagnostico-N; ahora el id es el
 *  código N<nivel>E<examen>. Se traduce al leer y al escribir, así que la hoja puede tener
 *  aún filas antiguas sin que nada falle; migrateExamIds() las normaliza. */
function canonExamId(id) {
  const m = /^diagnostico-(\d+)$/.exec(String(id));
  if (!m) return String(id);
  const n = Number(m[1]) - 1;
  return 'N' + Math.floor(n / 5) + 'E' + ('0' + ((n % 5) + 1)).slice(-2);
}

function canonTitle(t) {
  return String(t).replace(/\s*Diagn[oó]stico\b/i, '');
}

/** Normaliza examId y examTitle de todas las filas de la hoja. Idempotente. */
function migrateExamIds() {
  return withLock(() => {
    const sh = sheet(SHEET_ATTEMPTS, ATTEMPT_COLUMNS);
    const rows = allRows(sh, ATTEMPT_COLUMNS);
    if (!rows.length) return 0;
    let changed = 0;
    const cols = rows.map((r) => {
      const id = canonExamId(r[2]), title = canonTitle(r[3]);
      if (id !== String(r[2]) || title !== String(r[3])) changed++;
      return [id, title];
    });
    sh.getRange(2, 3, cols.length, 2).setValues(cols);
    Logger.log('migrateExamIds: ' + changed + ' de ' + rows.length + ' filas actualizadas');
    return changed;
  });
}

/* =================================================================== HTTP */

function doGet() {
  return json({ ok: true, service: 'exani-history' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return json({ error: 'JSON inválido', code: 'bad_request' });
  }
  try {
    switch (req.action) {
      case 'list':   return json(actionList(req));
      case 'create': return json(actionCreate(req));
      case 'import': return json(actionImport(req));
      default:       return json({ error: 'acción inválida', code: 'bad_request' });
    }
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message, code: err.code });
    console.error(err);
    return json({ error: 'error interno', code: 'internal' });
  }
}

class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================================================================ acciones */

function actionList(req) {
  const who = verifyIdToken(req.idToken);
  const studentId = studentIdOf(who.sub);
  withLock(() => {
    touchStudent(studentId);
    claimPending(who, studentId);
  });
  return { ok: true, history: readAttempts(studentId) };
}

function actionCreate(req) {
  const who = verifyIdToken(req.idToken);
  const studentId = studentIdOf(who.sub);
  const record = sanitizeRecord(req.record);
  rateLimit(studentId);

  return withLock(() => {
    touchStudent(studentId);
    claimPending(who, studentId);
    const result = appendAttempt(studentId, record);
    return { ok: true, saved: result.saved, duplicate: result.duplicate };
  });
}

function actionImport(req) {
  if (!CONFIG.ADMIN_KEY || req.adminKey !== CONFIG.ADMIN_KEY) {
    throw new ApiError('unauthorized', 'clave de administración inválida');
  }
  const email = normalizeEmail(req.email);
  if (!email) throw new ApiError('bad_request', 'falta email');
  if (!Array.isArray(req.records) || !req.records.length) {
    throw new ApiError('bad_request', 'records debe ser una lista no vacía');
  }
  const records = req.records.map(sanitizeRecord)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const pendingId = PENDING_PREFIX + sha256Hex(CONFIG.PEPPER + ':email:' + email);

  return withLock(() => {
    let added = 0, duplicates = 0;
    records.forEach((r) => {
      const res = appendAttempt(pendingId, r);
      if (res.duplicate) duplicates++; else added++;
    });
    const pending = readPendingClaims();
    if (pending.indexOf(pendingId) === -1) {
      pending.push(pendingId);
      PropertiesService.getScriptProperties().setProperty(PENDING_PROP, JSON.stringify(pending));
    }
    return { ok: true, added, duplicates };
  });
}

/* =============================================================== identidad */

function verifyIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4096) {
    throw new ApiError('auth', 'inicia sesión para continuar');
  }
  const cache = CacheService.getScriptCache();
  const cacheKey = 'tok:' + sha256Hex(idToken).slice(0, 48);
  const hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new ApiError('auth', 'sesión vencida o inválida');

  const p = JSON.parse(res.getContentText());
  if (p.aud !== CONFIG.GOOGLE_CLIENT_ID) throw new ApiError('auth', 'token de otra aplicación');
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') {
    throw new ApiError('auth', 'emisor inválido');
  }
  const expMs = Number(p.exp) * 1000;
  if (!(expMs > Date.now())) throw new ApiError('auth', 'sesión vencida');

  const who = {
    sub: String(p.sub),
    email: (p.email_verified === true || p.email_verified === 'true') ? normalizeEmail(p.email) : null,
  };
  const ttl = Math.floor((expMs - Date.now()) / 1000) - 30;
  if (ttl > 0) cache.put(cacheKey, JSON.stringify(who), Math.min(ttl, 21600));
  return who;
}

function studentIdOf(sub) {
  return sha256Hex(CONFIG.PEPPER + ':' + sub);
}

function normalizeEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(s) ? s : '';
}

function sha256Hex(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

function rateLimit(studentId) {
  const cache = CacheService.getScriptCache();
  const key = 'rl:' + studentId.slice(0, 32);
  const n = Number(cache.get(key) || 0) + 1;
  if (n > RATE_LIMIT.creates) throw new ApiError('rate_limited', 'demasiados envíos; espera unos minutos');
  cache.put(key, String(n), RATE_LIMIT.windowSec);
}

/* ============================================================== validación */

function sanitizeRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new ApiError('bad_request', 'record inválido');
  const out = {};

  out.examId = str(r.examId, 40);
  if (!/^[A-Za-z0-9-]+$/.test(out.examId)) throw new ApiError('bad_request', 'examId inválido');
  out.examId = canonExamId(out.examId);
  out.examTitle = canonTitle(str(r.examTitle, 200));
  // Un texto que empieza con = + - @ se interpretaría como fórmula en la hoja.
  if (/^[=+\-@]/.test(out.examTitle)) throw new ApiError('bad_request', 'examTitle inválido');
  out.version = str(r.version, 10);
  if (!/^\d+\.\d+$/.test(out.version)) throw new ApiError('bad_request', 'version inválida');

  const t = Date.parse(r.completedAt);
  if (isNaN(t)) throw new ApiError('bad_request', 'completedAt inválido');
  out.completedAt = new Date(t).toISOString();

  INT_FIELDS.forEach((k) => {
    if (r[k] === undefined || r[k] === null || r[k] === '') return;
    const n = Number(r[k]);
    if (!Number.isInteger(n) || n < 0 || n > 1e10) throw new ApiError('bad_request', k + ' inválido');
    out[k] = n;
  });
  ['score', 'total', 'percentage'].forEach((k) => {
    if (out[k] === undefined) throw new ApiError('bad_request', 'falta ' + k);
  });
  if (out.percentage > 100 || out.score > out.total || out.total > 1000) {
    throw new ApiError('bad_request', 'puntaje inconsistente');
  }

  // `<código>|<minutos>|<LETRAS>`; se acepta el formato anterior `<minutos><LETRAS>`.
  out.answers = str(r.answers, 1100);
  if (!/^(?:[A-Z0-9]{1,20}\|\d+\||\d+)[ABC]{1,1000}$/.test(out.answers)) throw new ApiError('bad_request', 'answers inválido');

  JSON_FIELDS.forEach((k) => {
    const v = r[k];
    if (v === undefined || v === null) { out[k] = {}; return; }
    if (typeof v !== 'object' || Array.isArray(v)) throw new ApiError('bad_request', k + ' inválido');
    if (JSON.stringify(v).length > MAX_JSON_CHARS) throw new ApiError('bad_request', k + ' demasiado grande');
    out[k] = v;
  });
  return out;
}

function str(v, max) {
  if (typeof v !== 'string') throw new ApiError('bad_request', 'campo de texto inválido');
  const s = v.trim();
  if (!s || s.length > max) throw new ApiError('bad_request', 'campo de texto inválido');
  return s;
}

/* ================================================================== hojas */

function spreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** Devuelve la pestaña; la crea con encabezados y formato de texto si no existe. */
function sheet(name, columns) {
  const ss = spreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Texto plano: evita que Sheets convierta fechas ISO o cadenas de respuestas.
    sh.getRange(1, 1, sh.getMaxRows(), columns.length).setNumberFormat('@');
  }
  return sh;
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function allRows(sh, columns) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  // Si alguna celda quedó fuera del formato de texto, Sheets pudo convertir la fecha.
  return sh.getRange(2, 1, last - 1, columns.length).getValues()
    .map((r) => r.map((v) => (v instanceof Date ? v.toISOString() : v)));
}

function rowToAttempt(row) {
  const o = {};
  ATTEMPT_COLUMNS.forEach((k, i) => { o[k] = row[i]; });
  INT_FIELDS.forEach((k) => { o[k] = o[k] === '' ? null : Number(o[k]); });
  o.isFirstAttempt = o.isFirstAttempt === true || String(o.isFirstAttempt).toUpperCase() === 'TRUE';
  JSON_FIELDS.forEach((k) => {
    try { o[k] = o[k] ? JSON.parse(o[k]) : {}; } catch (_) { o[k] = {}; }
  });
  ['examId', 'examTitle', 'version', 'completedAt', 'answers', 'createdAt'].forEach((k) => {
    o[k] = String(o[k]);
  });
  o.examId = canonExamId(o.examId);
  o.examTitle = canonTitle(o.examTitle);
  delete o.studentId;
  return o;
}

function readAttempts(studentId) {
  const sh = sheet(SHEET_ATTEMPTS, ATTEMPT_COLUMNS);
  return allRows(sh, ATTEMPT_COLUMNS)
    .filter((r) => r[1] === studentId)
    .map(rowToAttempt)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/** Añade un intento ya validado. Idempotente: examen + fecha + cadena identifican un intento. */
function appendAttempt(studentId, rec) {
  const sh = sheet(SHEET_ATTEMPTS, ATTEMPT_COLUMNS);
  const mine = allRows(sh, ATTEMPT_COLUMNS)
    .filter((r) => r[1] === studentId && canonExamId(r[2]) === rec.examId);

  const dup = mine.find((r) => String(r[5]) === rec.completedAt && String(r[16]) === rec.answers);
  if (dup) return { saved: rowToAttempt(dup), duplicate: true };
  if (mine.length >= MAX_ATTEMPTS_PER_EXAM) {
    throw new ApiError('limit', 'se alcanzó el máximo de intentos guardados para este examen');
  }

  // El número de intento se calcula aquí: el cliente puede no conocer intentos de otros
  // dispositivos o tener envíos pendientes.
  const earlier = mine.filter((r) => String(r[5]) < rec.completedAt).length;
  const full = Object.assign({}, rec, {
    id: Utilities.getUuid(),
    studentId,
    attemptNumber: earlier + 1,
    isFirstAttempt: earlier === 0,
    createdAt: new Date().toISOString(),
  });
  const row = ATTEMPT_COLUMNS.map((k) => {
    const v = full[k];
    if (v === undefined || v === null) return '';
    if (JSON_FIELDS.indexOf(k) !== -1) return JSON.stringify(v);
    return String(v);
  });
  sh.appendRow(row);
  if (earlier < mine.length) renumber(sh, studentId, rec.examId);
  return { saved: rowToAttempt(row), duplicate: false };
}

/** Recalcula attemptNumber / isFirstAttempt de un estudiante y examen por orden de fecha. */
function renumber(sh, studentId, examId) {
  const rows = allRows(sh, ATTEMPT_COLUMNS);
  const idx = [];
  rows.forEach((r, i) => {
    if (r[1] === studentId && (!examId || canonExamId(r[2]) === examId)) idx.push(i);
  });
  const byExam = {};
  idx.forEach((i) => {
    const ex = canonExamId(rows[i][2]);
    (byExam[ex] = byExam[ex] || []).push(i);
  });
  Object.keys(byExam).forEach((ex) => {
    byExam[ex]
      .sort((a, b) => String(rows[a][5]).localeCompare(String(rows[b][5])))
      .forEach((i, n) => {
        sh.getRange(i + 2, 7, 1, 2).setValues([[String(n + 1), String(n === 0)]]);
      });
  });
}

function touchStudent(studentId) {
  const sh = sheet(SHEET_STUDENTS, STUDENT_COLUMNS);
  const rows = allRows(sh, STUDENT_COLUMNS);
  const now = new Date().toISOString();
  const i = rows.findIndex((r) => r[0] === studentId);
  if (i === -1) sh.appendRow([studentId, now, now]);
  else sh.getRange(i + 2, 3).setValue(now);
}

/* ======================================================= intentos importados */

function readPendingClaims() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(PENDING_PROP) || '[]');
  } catch (_) {
    return [];
  }
}

/** Si hay intentos importados para el correo verificado de este estudiante, se le asignan. */
function claimPending(who, studentId) {
  if (!who.email) return;
  const pending = readPendingClaims();
  if (!pending.length) return;
  const pendingId = PENDING_PREFIX + sha256Hex(CONFIG.PEPPER + ':email:' + who.email);
  if (pending.indexOf(pendingId) === -1) return;

  const sh = sheet(SHEET_ATTEMPTS, ATTEMPT_COLUMNS);
  allRows(sh, ATTEMPT_COLUMNS).forEach((r, i) => {
    if (r[1] === pendingId) sh.getRange(i + 2, 2).setValue(studentId);
  });
  renumber(sh, studentId, null);
  PropertiesService.getScriptProperties()
    .setProperty(PENDING_PROP, JSON.stringify(pending.filter((p) => p !== pendingId)));
}
