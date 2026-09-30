// Schlanker Relay-Pool auf Basis von nostr-tools/relay mit sichtbarem Verbindungsstatus.
import { Relay } from 'nostr-tools/relay';
import type { Event, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools';

export type RelayState = 'idle' | 'connecting' | 'open' | 'error' | 'closed';
export interface RelayStatus {
  url: string;
  state: RelayState;
  error?: string;
  lastChange: number;
  nip11?: { name?: string; supported_nips?: number[]; software?: string } | null;
}

export interface QueryOutcome {
  url: string;
  ok: boolean;
  count: number;
  error?: string;
  closedReason?: string;
}
export interface QueryResult {
  events: Event[];
  outcomes: QueryOutcome[];
}

const relays = new Map<string, Promise<Relay>>();
const statuses = new Map<string, RelayStatus>();
const listeners = new Set<() => void>();
let authSigner: ((e: EventTemplate) => Promise<VerifiedEvent>) | null = null;

export function setAuthSigner(fn: ((e: EventTemplate) => Promise<VerifiedEvent>) | null) {
  authSigner = fn;
}

export function onStatusChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}
function setStatus(url: string, patch: Partial<RelayStatus>) {
  const prev = statuses.get(url) ?? { url, state: 'idle' as RelayState, lastChange: Date.now() };
  statuses.set(url, { ...prev, ...patch, lastChange: Date.now() });
  emit();
}
export function getStatuses(): RelayStatus[] {
  return [...statuses.values()];
}
export function getStatus(url: string): RelayStatus | undefined {
  return statuses.get(url);
}

const CONNECT_TIMEOUT = 7000;

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timed? ?out/i.test(msg)) return 'Zeitüberschreitung beim Verbinden';
  if (/closed|failed|error/i.test(msg)) return 'Verbindung nicht möglich';
  return msg || 'Unbekannter Fehler';
}

export function getRelay(url: string): Promise<Relay> {
  const existing = relays.get(url);
  if (existing) return existing;
  setStatus(url, { state: 'connecting', error: undefined });
  const p = (async () => {
    const r = new Relay(url, { enablePing: false, enableReconnect: false });
    r.onclose = () => {
      relays.delete(url);
      setStatus(url, { state: 'closed' });
    };
    r.onauth = async (evt: EventTemplate) => {
      if (!authSigner) throw new Error('Nicht angemeldet');
      return authSigner(evt);
    };
    await r.connect({ timeout: CONNECT_TIMEOUT });
    setStatus(url, { state: 'open', error: undefined });
    return r;
  })();
  relays.set(url, p);
  p.catch((e) => {
    relays.delete(url);
    setStatus(url, { state: 'error', error: friendlyError(e) });
  });
  return p;
}

export function disconnectAll() {
  for (const [url, p] of relays) {
    p.then((r) => r.close()).catch(() => {});
    relays.delete(url);
  }
  statuses.clear();
  emit();
}

/** Einmalige Abfrage über mehrere Relays: sammelt bis EOSE (oder Timeout) und dedupliziert. */
export async function query(urls: string[], filter: Filter, opts: { timeout?: number } = {}): Promise<QueryResult> {
  const timeout = opts.timeout ?? 9000;
  const seen = new Map<string, Event>();
  const outcomes = await Promise.all(
    urls.map(async (url): Promise<QueryOutcome> => {
      let count = 0;
      try {
        const relay = await getRelay(url);
        return await new Promise<QueryOutcome>((resolve) => {
          let settled = false;
          const finish = (o: QueryOutcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              sub.close();
            } catch {
              /* ignore */
            }
            resolve(o);
          };
          const sub = relay.subscribe([filter], {
            onevent(ev) {
              count++;
              if (!seen.has(ev.id)) seen.set(ev.id, ev);
            },
            oneose() {
              finish({ url, ok: true, count });
            },
            onclose(reason) {
              finish({ url, ok: !reason || count > 0, count, closedReason: reason });
            },
            eoseTimeout: timeout,
          });
          const timer = setTimeout(() => finish({ url, ok: count > 0, count, error: count ? undefined : 'Keine Antwort (Zeitüberschreitung)' }), timeout + 500);
        });
      } catch (e) {
        return { url, ok: false, count, error: friendlyError(e) };
      }
    }),
  );
  return { events: dedupeReplaceable([...seen.values()]), outcomes };
}

/** Bei adressierbaren/ersetzbaren Events nur die neueste Version je Adresse behalten. */
export function dedupeReplaceable(events: Event[]): Event[] {
  const byAddr = new Map<string, Event>();
  const rest: Event[] = [];
  for (const ev of events) {
    const k = ev.kind;
    let addr: string | null = null;
    if (k >= 30000 && k < 40000) addr = `${k}:${ev.pubkey}:${ev.tags.find((t) => t[0] === 'd')?.[1] ?? ''}`;
    else if (k === 0 || k === 3 || (k >= 10000 && k < 20000)) addr = `${k}:${ev.pubkey}`;
    if (!addr) {
      rest.push(ev);
      continue;
    }
    const prev = byAddr.get(addr);
    if (!prev || prev.created_at < ev.created_at) byAddr.set(addr, ev);
  }
  return [...byAddr.values(), ...rest];
}

export interface PublishOutcome {
  url: string;
  ok: boolean;
  message: string;
}

export async function publish(urls: string[], ev: Event): Promise<PublishOutcome[]> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const relay = await getRelay(url);
        try {
          const msg = await relay.publish(ev);
          return { url, ok: true, message: msg || 'angenommen' };
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          if (/auth-required/i.test(m) && authSigner) {
            await relay.auth(authSigner);
            const msg = await relay.publish(ev);
            return { url, ok: true, message: msg || 'angenommen' };
          }
          throw e;
        }
      } catch (e) {
        return { url, ok: false, message: translateRejection(e instanceof Error ? e.message : String(e)) };
      }
    }),
  );
}

function translateRejection(m: string): string {
  if (/restricted|not a member|blocked|forbidden/i.test(m)) return `Relay lehnt ab (${m}). Für diese Gruppe ist vermutlich eine Mitgliedschaft nötig.`;
  if (/auth-required/i.test(m)) return 'Relay verlangt Anmeldung (NIP-42).';
  if (/timed? ?out/i.test(m)) return 'Keine Bestätigung vom Relay (Zeitüberschreitung).';
  return m;
}

/** NIP-11-Relay-Info per HTTP. Liefert null, wenn nicht abrufbar (z. B. durch CSP blockiert). */
export async function fetchNip11(url: string): Promise<RelayStatus['nip11']> {
  const cached = statuses.get(url)?.nip11;
  if (cached !== undefined) return cached;
  try {
    const http = url.replace(/^ws/i, 'http');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(http, { headers: { Accept: 'application/nostr+json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    const info = await res.json();
    setStatus(url, { nip11: info });
    return info;
  } catch {
    setStatus(url, { nip11: null });
    return null;
  }
}
