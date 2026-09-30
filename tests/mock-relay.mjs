// Minimaler lokaler Nostr-Relay für End-to-End-Tests (NIP-01, NIP-11, einfache NIP-50-Suche).
// Liefert zusätzlich die gebaute Single-File-HTML unter / aus.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { verifyEvent } from 'nostr-tools/pure';

export function matchFilter(f, ev) {
  if (f.ids && !f.ids.includes(ev.id)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.since && ev.created_at < f.since) return false;
  if (f.until && ev.created_at > f.until) return false;
  for (const [k, vals] of Object.entries(f)) {
    if (!k.startsWith('#')) continue;
    const name = k.slice(1);
    if (!ev.tags.some((t) => t[0] === name && vals.includes(t[1]))) return false;
  }
  if (f.search) {
    const hay = (ev.content + ' ' + ev.tags.map((t) => t.slice(1).join(' ')).join(' ')).toLowerCase();
    if (!f.search.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function startMockRelay({ port = 0, htmlFile, events = [] } = {}) {
  const store = [...events];
  const received = [];
  const server = http.createServer((req, res) => {
    if (req.headers.accept?.includes('application/nostr+json')) {
      res.writeHead(200, { 'Content-Type': 'application/nostr+json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ name: 'mock-relay', supported_nips: [1, 11, 29, 50], software: 'edufeed-hub-test' }));
      return;
    }
    if (htmlFile && (req.url === '/' || req.url?.startsWith('/?'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(readFileSync(htmlFile));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg[0] === 'REQ') {
        const [, subId, ...filters] = msg;
        const out = new Map();
        for (const f of filters) {
          const matched = store.filter((e) => matchFilter(f, e)).sort((a, b) => b.created_at - a.created_at);
          for (const e of matched.slice(0, f.limit ?? 500)) out.set(e.id, e);
        }
        for (const e of out.values()) ws.send(JSON.stringify(['EVENT', subId, e]));
        ws.send(JSON.stringify(['EOSE', subId]));
      } else if (msg[0] === 'EVENT') {
        const ev = msg[1];
        const ok = verifyEvent(ev);
        received.push(ev);
        if (ok) store.push(ev);
        ws.send(JSON.stringify(['OK', ev.id, ok, ok ? '' : 'invalid: bad signature']));
      } else if (msg[0] === 'CLOSE') {
        /* nichts zu tun */
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({ port: p, url: `ws://127.0.0.1:${p}`, http: `http://127.0.0.1:${p}/`, received, store, close: () => new Promise((r) => { wss.close(); server.close(() => r()); }) });
    });
  });
}
