// Relay-Konfiguration und lokale Einstellungen (localStorage, immer mit try/catch).

export type RelayCategory = 'material' | 'groups' | 'calendar' | 'communities' | 'profiles';

export const CATEGORY_INFO: Record<RelayCategory, { label: string; hint: string }> = {
  material: {
    label: 'Lernmaterialien (AMB, kind 30142)',
    hint: 'AMB-Relay mit NIP-50-Volltextsuche (Typesense).',
  },
  groups: {
    label: 'Gruppen (NIP-29)',
    hint: 'Relay, das NIP-29-Gruppen hostet (kind 39000 ff., Nachrichten kind 9/11).',
  },
  calendar: {
    label: 'Termine (NIP-52, kind 31922/31923)',
    hint: 'Hierhin veröffentlicht u. a. wp-to-nostr die WordPress-Termine.',
  },
  communities: {
    label: 'Communities (Communikey, kind 10222)',
    hint: 'Community-Definitionen und Beiträge mit h-Tag.',
  },
  profiles: {
    label: 'Profile (kind 0) & Veröffentlichung',
    hint: 'Allgemeine Relays für Profile, Namen und Bilder.',
  },
};

export const DEFAULT_RELAYS: Record<RelayCategory, string[]> = {
  material: ['wss://amb-relay.edufeed.org'],
  groups: ['wss://groups.edufeed.org'],
  calendar: ['wss://relay-rpi.edufeed.org', 'wss://relay.edufeed.org', 'wss://amb-relay.edufeed.org'],
  communities: ['wss://relay-rpi.edufeed.org'],
  profiles: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://purplepag.es'],
};

const KEY_RELAYS = 'edufeed-hub:relays';
const KEY_DEMO = 'edufeed-hub:demo';

export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* Speicher nicht verfügbar – Einstellung gilt nur für diese Sitzung */
  }
}

export function normalizeRelayUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^wss?:\/\//i.test(s)) s = 'wss://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'wss:' && u.protocol !== 'ws:') return null;
    let out = u.protocol + '//' + u.host + u.pathname;
    if (out.endsWith('/') && u.pathname === '/') out = out.slice(0, -1);
    return out.toLowerCase().startsWith('ws') ? out : null;
  } catch {
    return null;
  }
}

let relayCache: Record<RelayCategory, string[]> | null = null;

export function getRelays(cat: RelayCategory): string[] {
  if (!relayCache) {
    relayCache = { ...DEFAULT_RELAYS };
    const raw = storageGet(KEY_RELAYS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Record<RelayCategory, string[]>>;
        for (const k of Object.keys(DEFAULT_RELAYS) as RelayCategory[]) {
          if (Array.isArray(parsed[k])) relayCache[k] = parsed[k]!.filter((x) => typeof x === 'string');
        }
      } catch {
        /* defekte Einstellung ignorieren */
      }
    }
  }
  return relayCache[cat];
}

export function getAllRelays(): Record<RelayCategory, string[]> {
  const out = {} as Record<RelayCategory, string[]>;
  for (const k of Object.keys(DEFAULT_RELAYS) as RelayCategory[]) out[k] = getRelays(k);
  return out;
}

export function saveRelays(next: Record<RelayCategory, string[]>): void {
  relayCache = next;
  storageSet(KEY_RELAYS, JSON.stringify(next));
}

export function resetRelays(): void {
  relayCache = { ...DEFAULT_RELAYS };
  storageSet(KEY_RELAYS, null);
}

export function isDemo(): boolean {
  return storageGet(KEY_DEMO) === '1' || demoSession;
}
let demoSession = false;
export function setDemo(on: boolean): void {
  demoSession = on;
  storageSet(KEY_DEMO, on ? '1' : null);
}
