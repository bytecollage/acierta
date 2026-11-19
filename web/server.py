#!/usr/bin/env python3
"""
server.py — servidor estático para desarrollo local.

Sin dependencias: solo la librería estándar.

    python3 server.py                 # http://localhost:8080
    python3 server.py --port 8081
    python3 server.py --host 0.0.0.0  # accesible desde la red local

En producción la app se sirve desde GitHub Pages y el historial vive en Google Sheets
(ver docs/arquitectura.md). Este servidor solo sirve archivos y
desactiva la caché de data/ para ver los cambios al instante.

El inicio de sesión con Google solo funciona en orígenes autorizados en el client ID
de OAuth: http://localhost:8080 está registrado; otro puerto no podrá iniciar sesión.
"""

import argparse
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def end_headers(self):
        # Sin caché: evita que el navegador sirva JSON o JS viejo durante el desarrollo.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(ThreadingHTTPServer):
    # El valor por defecto (5) hace que el navegador vea conexiones rechazadas cuando pide
    # muchos archivos a la vez; los scripts que fallan dejan el panel en «Cargando…».
    request_queue_size = 128
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="127.0.0.1",
                    help="127.0.0.1 por defecto. Usa 0.0.0.0 para la red local.")
    args = ap.parse_args()

    print("Acierta — servidor local")
    print(f"  carpeta: {BASE}")
    print(f"  abre:    http://{'localhost' if args.host == '127.0.0.1' else args.host}:{args.port}")
    print("  Ctrl+C para detener.\n")

    try:
        Server((args.host, args.port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    except OSError as e:
        sys.exit(f"No se pudo abrir el puerto {args.port}: {e}")


if __name__ == "__main__":
    main()
