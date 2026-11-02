#!/usr/bin/env python3
"""Une la interfaz en un solo HTML para la vista previa en navegador."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'web'
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/app.css').read_text(encoding='utf-8')
scripts = re.findall(r'<script src="([^"]+)"', html)
js = '\n'.join((root / s).read_text(encoding='utf-8') for s in scripts)
assert '</script' not in js.lower()
out = f'<title>ELOQUENT PRO</title>\n<style>{css}</style>\n<div id="app"></div><div id="nav"></div>\n<script>{js}</script>\n'
d = root.parent / 'dist'; d.mkdir(exist_ok=True); (d / 'preview.html').write_text(out, encoding='utf-8')
print(len(out) // 1024, 'KB')
