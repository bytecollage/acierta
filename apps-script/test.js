const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), assert = require('assert');
// Pruebas de Code.gs con los servicios de Apps Script simulados en memoria.
//   node apps-script/test.js
const path = require('path');
const dir = __dirname + '/';
const topics = Object.fromEntries(Array.from({ length: 104 }, (_, i) => ['Tema ' + i, { correct: 1, total: 2 }]));
const hist = [1, 2, 3, 4, 5, 6].map((n) => ({
  examId: 'diagnostico-' + n, examTitle: 'Nivel ' + n, version: '2.0',
  completedAt: new Date(Date.UTC(2026, 8 + Math.floor(n / 3), n * 3)).toISOString(),
  attemptNumber: 1, isFirstAttempt: true, score: n === 6 ? 125 : 90, total: n === 6 ? 150 : 100,
  percentage: n === 6 ? 83 : 90, minutes: 40, activeMs: 2400000, elapsedWallMs: 2400000,
  answers: '40' + 'ABC'.repeat(n === 6 ? 50 : 33) + (n === 6 ? '' : 'A'),
  keyDistribution: { A: 34, B: 33, C: 33 },
  areaResults: { 'Comprensión lectora': { correct: 28, total: 28 } },
  topicResults: topics, topicAreas: {}, answerString: 'x', savedAt: 'x',
}));

function makeSheet(name) {
  const data = []; // rows of arrays
  const sh = {
    name, data,
    getRange(r, c, nr = 1, nc = 1) {
      return {
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { (data[r - 1 + i] ||= [])[c - 1 + j] = x; })); return this; },
        setValue(x) { (data[r - 1] ||= [])[c - 1] = x; return this; },
        getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(data[r - 1 + i]?.[c - 1 + j] ?? ''); out.push(row); } return out; },
        setFontWeight() { return this; }, setNumberFormat() { return this; },
      };
    },
    getLastRow() { return data.length; }, getMaxRows() { return 1000; },
    setFrozenRows() {}, appendRow(row) { data.push(row.slice()); },
  };
  return sh;
}
const sheets = {};
const props = {};
const cache = new Map();
const tokens = {
  'tok-yander': { aud: 'CID', iss: 'https://accounts.google.com', sub: '111', email: 'Student@Gmail.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) },
  'tok-other': { aud: 'CID', iss: 'accounts.google.com', sub: '222', email: 'x@y.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) },
  'tok-wrongaud': { aud: 'OTHER', iss: 'accounts.google.com', sub: '333', exp: String(Math.floor(Date.now() / 1000) + 3600) },
};
let fetches = 0;
const ctx = {
  console,
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = makeSheet(n)) }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(),
  },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Logger: { log() {} },
  UrlFetchApp: { fetch(url) { fetches++; const t = decodeURIComponent(url.split('id_token=')[1]); const p = tokens[t];
    return { getResponseCode: () => (p ? 200 : 400), getContentText: () => JSON.stringify(p || { error: 'invalid' }) }; } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, s }) },
};
vm.createContext(ctx);
ctx.CONFIG = { SPREADSHEET_ID: 'S', GOOGLE_CLIENT_ID: 'CID', PEPPER: 'test-pepper', ADMIN_KEY: 'test-admin' };
vm.runInContext(fs.readFileSync(dir + 'Code.gs', 'utf8'), ctx);
const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);

// auth errors
assert.equal(post({ action: 'list' }).code, 'auth');
assert.equal(post({ action: 'list', idToken: 'bogus' }).code, 'auth');
assert.equal(post({ action: 'list', idToken: 'tok-wrongaud' }).code, 'auth');
assert.equal(post({ action: 'delete', idToken: 'tok-yander' }).code, 'bad_request');
assert.equal(post({ action: 'import', adminKey: 'nope', email: 'a@b.c', records: [1] }).code, 'unauthorized');

// import legacy for student email (case-insensitive)
const imp = post({ action: 'import', adminKey: ctx.CONFIG.ADMIN_KEY, email: 'student@gmail.com', records: hist });
assert.deepEqual([imp.added, imp.duplicates], [6, 0], JSON.stringify(imp));
const imp2 = post({ action: 'import', adminKey: ctx.CONFIG.ADMIN_KEY, email: 'student@gmail.com', records: hist });
assert.deepEqual([imp2.added, imp2.duplicates], [0, 6]);

// other user sees nothing
assert.equal(post({ action: 'list', idToken: 'tok-other' }).history.length, 0);

// owner claims on first list
const l = post({ action: 'list', idToken: 'tok-yander' });
assert.equal(l.history.length, 6);
// los registros antiguos (diagnostico-N, «Examen Diagnóstico …») se guardan con el id nuevo
assert.deepEqual(l.history.map((r) => r.examId), ['N0E01', 'N0E02', 'N0E03', 'N0E04', 'N0E05', 'N1E01']);
assert.ok(!JSON.stringify(sheets.attempts.data).includes('diagnostico-'));
const h6 = l.history.find((r) => r.examId === 'N1E01');
assert.equal(h6.score, 125); assert.equal(h6.isFirstAttempt, true); assert.equal(h6.attemptNumber, 1);
assert.equal(h6.areaResults['Comprensión lectora'].correct, 28);
assert.equal(Object.keys(h6.topicResults).length, 104);
assert.equal(h6.answers, hist[5].answers);
assert.ok(!('studentId' in h6));
assert.equal(JSON.parse(props.PENDING_CLAIMS).length, 0);
// no emails stored anywhere
assert.ok(!JSON.stringify(sheets).includes('gmail'));

// create: second attempt of N1E01, then an earlier-dated one → renumber
const base = { ...hist[5] };
let c = post({ action: 'create', idToken: 'tok-yander', record: { ...base, completedAt: '2026-11-20T10:00:00.000Z', attemptNumber: 99 } });
assert.equal(c.saved.attemptNumber, 2); assert.equal(c.saved.isFirstAttempt, false);
c = post({ action: 'create', idToken: 'tok-yander', record: { ...base, completedAt: '2026-11-20T10:00:00.000Z' } });
assert.equal(c.duplicate, true);
c = post({ action: 'create', idToken: 'tok-yander', record: { ...base, completedAt: '2026-11-01T10:00:00.000Z' } });
const six = post({ action: 'list', idToken: 'tok-yander' }).history.filter((r) => r.examId === 'N1E01');
assert.deepEqual(six.map((r) => [r.completedAt.slice(0, 10), r.attemptNumber, r.isFirstAttempt]),
  [['2026-11-01', 1, true], ['2026-11-18', 2, false], ['2026-11-20', 3, false]]);

// validation
const bad = (rec) => post({ action: 'create', idToken: 'tok-yander', record: rec }).code;
assert.equal(bad({ ...base, examId: '../x' }), 'bad_request');
assert.equal(bad({ ...base, answers: '72ACD' }), 'bad_request');
assert.equal(bad({ ...base, answers: 'N1E01|72|ACD' }), 'bad_request');
assert.equal(bad({ ...base, answers: 'n1e01|72|ABC' }), 'bad_request');
assert.equal(bad({ ...base, answers: 'N1E01|ABC' }), 'bad_request');
c = post({ action: 'create', idToken: 'tok-yander', record: { ...base, completedAt: '2026-11-22T10:00:00.000Z', answers: 'N1E01|72|' + 'ABC'.repeat(50) } });
assert.equal(c.saved.answers, 'N1E01|72|' + 'ABC'.repeat(50));
assert.equal(bad({ ...base, score: 200 }), 'bad_request');
assert.equal(bad({ ...base, topicResults: 'x' }), 'bad_request');
assert.equal(bad({ ...base, completedAt: 'nope' }), 'bad_request');
assert.equal(bad({ ...base, examTitle: '=IMPORTXML(1)' }), 'bad_request');
// unknown fields dropped
post({ action: 'create', idToken: 'tok-yander', record: { ...base, completedAt: '2026-11-21T10:00:00.000Z', evil: '=HYPERLINK()' } });
assert.ok(!JSON.stringify(sheets).includes('HYPERLINK'));

// D-14: una fila antigua que sigue en la hoja se lee con el id nuevo, cuenta para el número
// de intento de los registros nuevos y migrateExamIds() la normaliza.
const att = sheets.attempts.data;
const legacyRow = att[att.length - 1].slice();
legacyRow[0] = 'legacy-row'; legacyRow[2] = 'diagnostico-7'; legacyRow[3] = 'Examen Diagnóstico N1E02';
legacyRow[5] = '2026-10-01T10:00:00.000Z'; legacyRow[6] = '1'; legacyRow[7] = 'true';
att.push(legacyRow);
const n2 = post({ action: 'list', idToken: 'tok-yander' }).history.filter((r) => r.examId === 'N1E02');
assert.deepEqual(n2.map((r) => [r.examTitle, r.attemptNumber]), [['Examen N1E02', 1]]);
c = post({ action: 'create', idToken: 'tok-yander', record: { ...base, examId: 'N1E02', examTitle: 'Examen N1E02', completedAt: '2026-11-22T11:00:00.000Z' } });
assert.equal(c.saved.attemptNumber, 2);
assert.equal(ctx.migrateExamIds(), 1);
assert.equal(ctx.migrateExamIds(), 0);
assert.ok(!JSON.stringify(att).includes('diagnostico-') && !JSON.stringify(att).includes('Diagnóstico'));

// token cache: repeated calls don't refetch
const f0 = fetches; post({ action: 'list', idToken: 'tok-yander' }); assert.equal(fetches, f0);

// rate limit
let code; for (let i = 0; i < 40 && !code; i++) code = post({ action: 'create', idToken: 'tok-other', record: { ...base, completedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() } }).code;
assert.equal(code, 'rate_limited');
console.log('OK — all Code.gs tests passed. rows:', sheets.attempts.data.length - 1, 'students:', sheets.students.data.length - 1);
