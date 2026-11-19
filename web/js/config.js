/* config.js — configuración pública del cliente.
 *
 * Ambos valores son públicos por diseño: el client ID de OAuth identifica la app ante
 * Google y la URL /exec es la API del historial. La protección está en el Apps Script,
 * que verifica el ID token de cada petición (ver apps-script/Code.gs).
 *
 * Si API_URL o GOOGLE_CLIENT_ID están vacíos, la app funciona en modo local: el
 * historial se guarda solo en este navegador.
 */
window.ExaniConfig = {
  API_URL: "",
  GOOGLE_CLIENT_ID: "1003482871641-isci83hfo0jiaoh1tksuuc4v2fpl2ti9.apps.googleusercontent.com",
};
