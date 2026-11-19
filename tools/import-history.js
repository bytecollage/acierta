#!/usr/bin/env node
/* import-history.js — carga intentos antiguos (historial.json) en Google Sheets.
 *
 *   node tools/import-history.js <archivo.json> <correo-del-estudiante> [--dry-run]
 *
 * Usa la acción "import" del Apps Script, protegida con ADMIN_KEY (apps-script/Config.gs,
 * que no se versiona). Los intentos quedan reservados para ese correo y pasan a la
 * cuenta del estudiante la primera vez que inicia sesión con él. Es idempotente:
 * repetirlo no duplica intentos.
 *
 * La URL de la API se lee de web/js/config.js.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const [file, email] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!file || !email) {
  console.error("Uso: node tools/import-history.js <archivo.json> <correo> [--dry-run]");
  process.exit(2);
}

const config = fs.readFileSync(path.join(root, "apps-script/Config.gs"), "utf8");
const adminKey = (config.match(/ADMIN_KEY:\s*'([^']+)'/) || [])[1];
const client = fs.readFileSync(path.join(root, "web/js/config.js"), "utf8");
const apiUrl = (client.match(/API_URL:\s*"([^"]*)"/) || [])[1];
if (!adminKey) { console.error("No se encontró ADMIN_KEY en apps-script/Config.gs"); process.exit(1); }
if (!apiUrl) { console.error("API_URL está vacío en web/js/config.js"); process.exit(1); }

const records = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(records) || !records.length) { console.error("El archivo no trae intentos."); process.exit(1); }

records.forEach((r) => console.log(`  ${r.examId}  ${r.score}/${r.total}  ${r.completedAt}`));
console.log(`${records.length} intento(s) para ${email}`);
if (dryRun) process.exit(0);

(async () => {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "import", adminKey, email, records }),
  });
  const data = await res.json();
  if (data.error) { console.error(`Error: ${data.error} (${data.code})`); process.exit(1); }
  console.log(`Añadidos: ${data.added} · ya existían: ${data.duplicates}`);
})().catch((e) => { console.error(e); process.exit(1); });
