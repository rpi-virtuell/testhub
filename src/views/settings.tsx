import { useState } from 'preact/hooks';
import { CATEGORY_INFO, DEFAULT_RELAYS, getAllRelays, isDemo, normalizeRelayUrl, resetRelays, saveRelays, setDemo, type RelayCategory } from '../config';
import { disconnectAll, fetchNip11, getRelay, getStatus } from '../nostr/pool';
import { resetCaches } from '../data';
import { bumpEpoch, useRelayStatuses } from '../hooks';

const STATE_LABEL: Record<string, string> = {
  idle: 'nicht verbunden',
  connecting: 'verbindet …',
  open: 'verbunden',
  error: 'Fehler',
  closed: 'getrennt (ruht)',
};

export function Settings() {
  const statuses = useRelayStatuses();
  const [drafts, setDrafts] = useState<Record<RelayCategory, string>>(() => {
    const all = getAllRelays();
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.join('\n')])) as Record<RelayCategory, string>;
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [demo, setDemoState] = useState(isDemo());
  const [testing, setTesting] = useState(false);

  const cats = Object.keys(CATEGORY_INFO) as RelayCategory[];
  const allUrls = [...new Set(cats.flatMap((c) => drafts[c].split(/\s+/).map(normalizeRelayUrl).filter((x): x is string => !!x)))];

  const save = (e: Event) => {
    e.preventDefault();
    const next = {} as Record<RelayCategory, string[]>;
    const invalid: string[] = [];
    for (const c of cats) {
      const lines = drafts[c].split(/\s+/).filter(Boolean);
      next[c] = [];
      for (const l of lines) {
        const u = normalizeRelayUrl(l);
        if (u) {
          if (!next[c].includes(u)) next[c].push(u);
        } else invalid.push(l);
      }
    }
    if (invalid.length) {
      setMsg({ ok: false, text: `Ungültige Relay-Adresse: ${invalid.join(', ')}. Erwartet wird wss://… .` });
      return;
    }
    saveRelays(next);
    disconnectAll();
    resetCaches();
    bumpEpoch();
    setMsg({ ok: true, text: 'Gespeichert. Ansichten laden mit den neuen Relays.' });
  };

  const test = async () => {
    setTesting(true);
    await Promise.all(allUrls.map((u) => getRelay(u).then(() => fetchNip11(u)).catch(() => {})));
    setTesting(false);
  };

  return (
    <div class="page">
      <div class="pagehead">
        <span class="eyebrow">Einstellungen</span>
        <h1>Relays und Darstellung</h1>
        <p class="lede">Aus welchen Relays der Hub liest. Die Einstellung gilt nur in diesem Browser.</p>
      </div>
      <div class="detail">
        <form class="stack" onSubmit={save}>
          {cats.map((c) => (
            <div class="field" key={c}>
              <label for={'relays-' + c}>
                <b>{CATEGORY_INFO[c].label}</b>
                <span class="small muted">{CATEGORY_INFO[c].hint}</span>
              </label>
              <textarea
                id={'relays-' + c}
                class="input mono"
                rows={Math.max(2, drafts[c].split('\n').length)}
                value={drafts[c]}
                spellcheck={false}
                onInput={(e) => setDrafts({ ...drafts, [c]: (e.target as HTMLTextAreaElement).value })}
              />
              <span class="small muted">Standard: {DEFAULT_RELAYS[c].join(', ')}</span>
            </div>
          ))}
          <div class="row">
            <button class="btn p" type="submit">
              Speichern
            </button>
            <button
              class="btn s"
              type="button"
              onClick={() => {
                resetRelays();
                setDrafts(Object.fromEntries(Object.entries(DEFAULT_RELAYS).map(([k, v]) => [k, v.join('\n')])) as Record<RelayCategory, string>);
                disconnectAll();
                resetCaches();
                bumpEpoch();
                setMsg({ ok: true, text: 'Auf Standard-Relays zurückgesetzt.' });
              }}
            >
              Standard wiederherstellen
            </button>
          </div>
          {msg && <p class={'outcome ' + (msg.ok ? 'ok' : 'bad')}>{msg.text}</p>}

          <div class="panel demo-toggle">
            <label class="switch" for="demo-switch">
              <input
                id="demo-switch"
                type="checkbox"
                checked={demo}
                onChange={(e) => {
                  const on = (e.target as HTMLInputElement).checked;
                  setDemo(on);
                  setDemoState(on);
                  resetCaches();
                  bumpEpoch();
                }}
              />
              <span>
                <b>Demo-Daten anzeigen</b>
                <span class="small muted">Ersetzt alle Relay-Abfragen durch erfundene Beispielinhalte. Nur zum Vorführen der Oberfläche, wenn kein Relay erreichbar ist. Standard: aus.</span>
              </span>
            </label>
          </div>
        </form>

        <aside class="side">
          <section class="panel">
            <div class="sechead">
              <h3 class="ph">Verbindungsstatus</h3>
              <button class="btn s sm" type="button" onClick={test} disabled={testing}>
                {testing ? 'Prüfe …' : 'Jetzt prüfen'}
              </button>
            </div>
            <ul class="relays">
              {allUrls.map((u) => {
                const st = statuses.find((s) => s.url === u) ?? getStatus(u);
                const state = st?.state ?? 'idle';
                const nips = st?.nip11?.supported_nips;
                return (
                  <li key={u} data-state={state}>
                    <span class="dot" aria-hidden="true" />
                    <span class="rurl mono">{u.replace(/^wss?:\/\//, '')}</span>
                    <span class="rstate">{STATE_LABEL[state]}</span>
                    {st?.error && <span class="small muted rerr">{st.error}</span>}
                    {nips && <span class="small muted rerr">NIP-50 {nips.includes(50) ? 'ja' : 'nein'} · NIP-29 {nips.includes(29) ? 'ja' : 'nein'}</span>}
                  </li>
                );
              })}
            </ul>
            <p class="small muted">Der Hub verbindet sich direkt aus Ihrem Browser per WebSocket. Firmennetze oder eingebettete Vorschauen können das blockieren.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
