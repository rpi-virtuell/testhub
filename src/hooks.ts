import { useEffect, useState, useCallback } from 'preact/hooks';
import { getSession, onSessionChange, type Session } from './nostr/auth';
import { getStatuses, onStatusChange, type RelayStatus } from './nostr/pool';
import { getProfile, onProfiles, requestProfile } from './data';
import type { Profile } from './nostr/parse';

// ---------- Hash-Routing (GitHub-Pages-tauglich) ----------
export interface Route {
  path: string[];
  query: URLSearchParams;
}
export function parseHash(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, '');
  const [p, q] = h.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q ?? '') };
}
export function href(path: string, query?: Record<string, string | undefined>): string {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString() : '';
  return '#/' + path.replace(/^\//, '') + (qs ? '?' + qs : '');
}
export function navigate(path: string, query?: Record<string, string | undefined>) {
  location.hash = href(path, query);
}
export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const fn = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
}

// ---------- Asynchrones Laden ----------
export interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: string;
  reload: () => void;
}
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ loading: boolean; data?: T; error?: string }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ loading: true, data: s.data }));
    fn().then(
      (data) => alive && setState({ loading: false, data }),
      (e) => alive && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, appEpoch]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** Wird erhöht, wenn Relays oder Demo-Modus geändert werden → alle Ansichten laden neu. */
export let appEpoch = 0;
const epochListeners = new Set<() => void>();
export function bumpEpoch() {
  appEpoch++;
  epochListeners.forEach((f) => f());
}
export function useEpoch(): number {
  const [e, setE] = useState(appEpoch);
  useEffect(() => {
    const fn = () => setE(appEpoch);
    epochListeners.add(fn);
    return () => {
      epochListeners.delete(fn);
    };
  }, []);
  return e;
}

export function useSession(): Session | null {
  const [s, setS] = useState(getSession());
  useEffect(
    () =>
      onSessionChange(() => {
        setS(getSession());
      }),
    [],
  );
  return s;
}

export function useRelayStatuses(): RelayStatus[] {
  const [s, setS] = useState(getStatuses());
  useEffect(
    () =>
      onStatusChange(() => {
        setS(getStatuses());
      }),
    [],
  );
  return s;
}

export function useProfile(pubkey: string | undefined): Profile | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    if (!pubkey) return;
    requestProfile(pubkey);
    return onProfiles(() => force((x) => x + 1));
  }, [pubkey]);
  return pubkey ? getProfile(pubkey) : undefined;
}

/** Mehrere Profile auf einmal (für zusammengesetzte Texte wie die Namensnennung). */
export function useProfiles(pubkeys: string[]): (Profile | undefined)[] {
  const [, force] = useState(0);
  const key = pubkeys.join(',');
  useEffect(() => {
    pubkeys.forEach(requestProfile);
    return onProfiles(() => force((x) => x + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return pubkeys.map(getProfile);
}
