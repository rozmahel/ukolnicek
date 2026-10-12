#!/usr/bin/env python3
"""Úkolníček – místní server pro vývoj.
Spuštění ve složce projektu:   python3 tools/serve.py        (nebo s jiným portem: python3 tools/serve.py 8001)
Pak otevři http://localhost:8000
Na rozdíl od `python3 -m http.server` posílá hlavičku „neukládat do mezipaměti“,
takže se každá změna v souborech projeví po obyčejném obnovení stránky."""
import http.server, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_request(self, code='-', size='-'):
        # vypisuje jen chyby (404 apod.), běžné požadavky ne
        if str(code).isdigit() and int(code) >= 400:
            super().log_request(code, size)

if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('localhost', PORT), NoCache) as s:
        print(f'Úkolníček běží na http://localhost:{PORT}  (ukončíš Ctrl+C)')
        try: s.serve_forever()
        except KeyboardInterrupt: print('\nkonec')
