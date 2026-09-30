// Erzeugt aus der Single-File-HTML (dist-single/index.html) eine Fragment-Variante für
// Claude-Artifacts (ohne <!doctype>/<html>/<head>/<body>, <title> zuerst).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const title = head.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>CoC-Hub</title>';
const keep = head
  .replace(/<meta[^>]*>/gi, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '');
const out = `${title}\n${keep.trim()}\n${body.trim()}\n`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/coc-hub.html', out);
console.log(`dist-artifact/coc-hub.html (${(out.length / 1024).toFixed(1)} KB)`);
