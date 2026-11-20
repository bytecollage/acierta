/* auth.js — inicio de sesión con Google (Google Identity Services).
 *
 * Solo se usa el ID token: se envía al Apps Script, que lo verifica y deriva un
 * identificador anónimo del estudiante. Aquí el token solo se decodifica para mostrar
 * el nombre; la verificación real ocurre en el servidor.
 *
 * El ID token dura una hora. Un examen puede durar más: si al terminar ya venció, el
 * intento queda pendiente en este navegador y se sube al volver a iniciar sesión
 * (ver storage.js).
 */

import { config } from "../config.js?v=__BUILD__";

const KEY = "exani.auth";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const MARGIN_MS = 60 * 1000;

const enabled = !!(config.GOOGLE_CLIENT_ID && config.API_URL);
const listeners = [];
let session = load();
let gisReady = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && s.token && s.sub ? s : null;
  } catch (_) {
    return null;
  }
}

function persist() {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch (_) { /* sin almacenamiento: la sesión dura lo que la página */ }
}

function decode(jwt) {
  const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function onCredential(resp) {
  try {
    const p = decode(resp.credential);
    session = {
      token: resp.credential,
      exp: p.exp * 1000,
      sub: p.sub,
      name: p.name || p.email || "Estudiante",
      email: p.email || "",
      picture: p.picture || "",
    };
    persist();
    listeners.forEach((fn) => fn(session));
  } catch (e) {
    console.warn("[auth] credencial ilegible:", e);
  }
}

function loadGis() {
  if (!enabled) return Promise.resolve(false);
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => {
      window.google.accounts.id.initialize({
        client_id: config.GOOGLE_CLIENT_ID,
        callback: onCredential,
        auto_select: true,
        use_fedcm_for_prompt: true,
      });
      resolve(true);
    };
    s.onerror = () => { console.warn("[auth] no se pudo cargar Google Identity Services"); resolve(false); };
    document.head.appendChild(s);
  });
  return gisReady;
}

/** Token vigente o null. */
function getToken() {
  if (!session) return null;
  return session.exp - Date.now() > MARGIN_MS ? session.token : null;
}

/** Pide a Google un token nuevo sin interacción si el navegador lo permite. */
async function refresh() {
  if (!(await loadGis())) return;
  window.google.accounts.id.prompt();
}

function signOut() {
  session = null;
  persist();
  if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
  listeners.forEach((fn) => fn(null));
}

/** Pinta el estado de la cuenta en un contenedor. `part` elige qué se pinta:
 *  "signin"  → solo el botón de Google, mientras no haya sesión vigente;
 *  "account" → solo nombre + «Cerrar sesión», con sesión vigente;
 *  sin `part` → lo que corresponda (botón o nombre + salir). */
async function mount(el, part) {
  if (!el || !enabled) return;
  const paint = async () => {
    el.innerHTML = "";
    const active = !!session && !!getToken();
    if (session && part !== "signin" && (part !== "account" || active)) {
      const who = document.createElement("span");
      who.className = "account-name";
      who.textContent = session.name;
      const out = document.createElement("button");
      out.type = "button";
      out.className = "link-btn";
      out.textContent = "Cerrar sesión";
      out.onclick = signOut;
      el.append(who, out);
    }
    if (!active && part !== "account") {
      const btn = document.createElement("div");
      el.append(btn);
      if (await loadGis()) {
        window.google.accounts.id.renderButton(btn, session
          ? { type: "standard", size: part === "signin" ? "medium" : "small", text: "continue_with" }
          : { type: "standard", size: "medium", text: "signin_with" });
      }
    }
  };
  listeners.push(paint);
  await paint();
}

const getSession = () => session;
const onChange = (fn) => { listeners.push(fn); };

export { enabled, getToken, getSession, refresh, signOut, mount, loadGis as init, onChange };
