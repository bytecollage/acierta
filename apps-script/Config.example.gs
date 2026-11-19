/**
 * Config.gs — configuración del Apps Script. Copiar a Config.gs y rellenar.
 */
const CONFIG = {
  // ID del spreadsheet (el tramo entre /d/ y /edit de su URL).
  SPREADSHEET_ID: '1miDVrQWLaHdHD2kmCMIq7e8ZDDGf0QcpIdbuk9eKJ_4',
  // OAuth Client ID (tipo "Aplicación web") de Google Cloud. Debe coincidir con web/js/config.js.
  GOOGLE_CLIENT_ID: 'XXXXXXXX.apps.googleusercontent.com',
  // Secreto para derivar el studentId. NO cambiarlo después: los historiales quedarían huérfanos.
  PEPPER: 'GENERAR: 64 caracteres hex aleatorios',
  // Clave para la acción "import" (carga de intentos antiguos). Solo para el administrador.
  ADMIN_KEY: 'GENERAR: cadena aleatoria larga',
};
