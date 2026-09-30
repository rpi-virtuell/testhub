// Anmeldung: NIP-07 (Browser-Erweiterung) und NIP-46 (Bunker / Remote-Signer).
// Ohne Anmeldung läuft der Hub im Lesemodus.
import type { EventTemplate, VerifiedEvent } from 'nostr-tools';
import { generateSecretKey } from 'nostr-tools/pure';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { setAuthSigner } from './pool';
import { storageGet, storageSet } from '../config';

export type LoginMethod = 'nip07' | 'nip46';

export interface Session {
  pubkey: string;
  method: LoginMethod;
  sign: (e: EventTemplate) => Promise<VerifiedEvent>;
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(e: EventTemplate): Promise<VerifiedEvent>;
    };
  }
}

const KEY_SESSION = 'edufeed-hub:session';
let session: Session | null = null;
let bunker: BunkerSigner | null = null;
const listeners = new Set<() => void>();

export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function set(s: Session | null) {
  session = s;
  setAuthSigner(s ? s.sign : null);
  for (const fn of listeners) fn();
}
export function getSession(): Session | null {
  return session;
}

export function hasExtension(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

export async function loginWithExtension(): Promise<Session> {
  if (!window.nostr) throw new Error('Keine Nostr-Browser-Erweiterung gefunden (z. B. Alby, nos2x, Keys.band).');
  const pubkey = await window.nostr.getPublicKey();
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) throw new Error('Die Erweiterung hat keinen gültigen Schlüssel geliefert.');
  const s: Session = { pubkey, method: 'nip07', sign: (e) => window.nostr!.signEvent(e) };
  storageSet(KEY_SESSION, JSON.stringify({ method: 'nip07', pubkey }));
  set(s);
  return s;
}

export async function loginWithBunker(input: string, onAuthUrl: (url: string) => void, existingSecret?: string): Promise<Session> {
  const bp = await parseBunkerInput(input.trim());
  if (!bp) throw new Error('Die Eingabe ist keine gültige bunker://-Adresse oder NIP-05-Adresse eines Bunkers.');
  if (!bp.relays.length) throw new Error('Die Bunker-Adresse enthält kein Relay (…?relay=wss://…).');
  const sk = existingSecret ? hexToBytes(existingSecret) : generateSecretKey();
  const signer = BunkerSigner.fromBunker(sk, bp, { onauth: onAuthUrl });
  const connect = existingSecret ? Promise.resolve() : signer.connect();
  await withTimeout(connect, 60000, 'Der Bunker hat nicht innerhalb von 60 Sekunden geantwortet.');
  const pubkey = await withTimeout(signer.getPublicKey(), 30000, 'Der Bunker hat keinen öffentlichen Schlüssel geliefert.');
  bunker = signer;
  const s: Session = { pubkey, method: 'nip46', sign: (e) => signer.signEvent(e) };
  storageSet(KEY_SESSION, JSON.stringify({ method: 'nip46', pubkey, bunker: input.trim(), secret: bytesToHex(sk) }));
  set(s);
  return s;
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function logout() {
  storageSet(KEY_SESSION, null);
  if (bunker) {
    try {
      await bunker.close();
    } catch {
      /* ignore */
    }
    bunker = null;
  }
  set(null);
}

/** Stellt eine gespeicherte Sitzung wieder her (ohne Nutzerinteraktion, wenn möglich). */
export async function restoreSession(): Promise<void> {
  const raw = storageGet(KEY_SESSION);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as { method: LoginMethod; pubkey: string; bunker?: string; secret?: string };
    if (saved.method === 'nip07') {
      // Erweiterungen injizieren window.nostr teils verzögert.
      for (let i = 0; i < 10 && !window.nostr; i++) await new Promise((r) => setTimeout(r, 150));
      if (window.nostr) set({ pubkey: saved.pubkey, method: 'nip07', sign: (e) => window.nostr!.signEvent(e) });
    } else if (saved.method === 'nip46' && saved.bunker && saved.secret) {
      await loginWithBunker(saved.bunker, () => {}, saved.secret);
    }
  } catch {
    storageSet(KEY_SESSION, null);
  }
}
