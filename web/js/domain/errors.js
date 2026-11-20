/* errors.js — errores de datos: el mensaje se muestra al estudiante y `detail` explica la causa. */

export class DataError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "DataError";
    this.detail = detail || "";
  }
}
