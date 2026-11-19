# API del historial (Google Apps Script + Google Sheets)

El historial de intentos vive en un Google Spreadsheet. Este Apps Script lo expone como
una API mínima para la app publicada en GitHub Pages. Diseño y motivos en
[`spec/08-persistencia.md`](../spec/08-persistencia.md) y D-11 en
[`spec/10-decisiones-y-riesgos.md`](../spec/10-decisiones-y-riesgos.md).

| Archivo | Qué es | ¿Se versiona? |
|---|---|---|
| `Code.gs` | La API | Sí |
| `Config.gs` | Spreadsheet, client ID, `PEPPER` y `ADMIN_KEY` | **No** (está en `.gitignore`) |
| `Config.example.gs` | Plantilla de `Config.gs` | Sí |
| `test.js` | Pruebas de `Code.gs` con los servicios de Google simulados: `node apps-script/test.js` | Sí |

## Acciones

Todas van por `POST` con el cuerpo JSON enviado como `text/plain`, para evitar el preflight
CORS que Apps Script no atiende.

| Acción | Cuerpo | Efecto |
|---|---|---|
| `list` | `{ idToken }` | Devuelve los intentos del estudiante |
| `create` | `{ idToken, record }` | Añade un intento (validado e idempotente) |
| `import` | `{ adminKey, email, records }` | Carga intentos antiguos reservados para un correo; pasan a la cuenta del estudiante en su primer inicio de sesión (`tools/import-history.js`) |

No hay acciones de edición ni de borrado.

**Identidad.** Cada petición lleva el ID token de Google del estudiante. El script lo
verifica con `oauth2.googleapis.com/tokeninfo` (audiencia, emisor y vencimiento) y guarda
al estudiante como `SHA-256(PEPPER + ":" + sub)`. En la hoja no se guardan correos ni
nombres. **No cambies `PEPPER`** después de publicar: todos los historiales quedarían
huérfanos.

**Hoja.** El script crea solo las pestañas `attempts` y `students`, con encabezados y en
formato de texto plano. No edites los encabezados a mano.

---

## Puesta en marcha

### 1. Client ID de OAuth (Google Cloud)

1. En <https://console.cloud.google.com/>, crea un proyecto (por ejemplo `exani`).
2. **Google Auth Platform → Branding**: nombre de la app, correo de soporte y correo
   de contacto. Usa solo los alcances básicos (`openid`, `email`, `profile`), que no
   requieren verificación de Google.
3. **Audience**: tipo *External*. Pulsa **Publish app** para que cualquier cuenta de
   Google pueda iniciar sesión. En modo *Testing* solo entran los usuarios de prueba.
4. **Clients → Create client → Web application**. En *Authorized JavaScript origins*
   añade:
   - `https://bytecollage.github.io`
   - `http://localhost:8080`
   - `http://localhost`

   No hacen falta *redirect URIs*.
5. Copia el **Client ID**, que termina en `.apps.googleusercontent.com`.

### 2. Apps Script

1. Abre el spreadsheet y entra en **Extensiones → Apps Script**.
2. Sustituye el contenido de `Code.gs` por el de [`Code.gs`](Code.gs).
3. Crea un archivo `Config.gs` (botón **+ → Secuencia de comandos**) con el contenido de tu
   `apps-script/Config.gs` local y escribe en él el Client ID del paso 1.
4. **Implementar → Nueva implementación → Aplicación web**, con
   *Ejecutar como: Yo* y *Quién tiene acceso: Cualquier usuario*.
5. Autoriza los permisos: abrir el spreadsheet y conectarse a servicios externos (para
   verificar el token con Google). Google mostrará "app no verificada": entra en
   *Configuración avanzada → Ir a…*, porque el script es tuyo.
6. Copia la URL que termina en `/exec`.

### 3. Cliente

Pon el Client ID y la URL `/exec` en [`web/js/config.js`](../web/js/config.js). Los dos
valores son públicos por diseño.

### Cambios posteriores en el script

**Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión.**
Si creas una implementación nueva en lugar de editar la existente, la URL `/exec` cambia
y hay que actualizar `config.js`.
