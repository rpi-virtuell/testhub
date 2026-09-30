// Datenzugriff der Ansichten. Liefert echte Relay-Daten oder – nur bei aktivem Schalter – Demo-Daten.
import type { Event, Filter } from 'nostr-tools';
import { getRelays, isDemo } from './config';
import { fetchNip11, publish, query, type PublishOutcome, type QueryOutcome } from './nostr/pool';
import {
  materialMatches,
  parseCalendarEvent,
  parseCommunity,
  parseGroup,
  parseGroupMessage,
  parseMaterial,
  parseProfile,
  type CalendarEvent,
  type Community,
  type Group,
  type GroupMessage,
  type Material,
  type Profile,
} from './nostr/parse';
import { getSession } from './nostr/auth';
import * as demo from './demo';

export interface Loaded<T> {
  items: T;
  outcomes: QueryOutcome[];
  demo: boolean;
  note?: string;
}

const wrapDemo = <T,>(items: T, note?: string): Loaded<T> => ({ items, outcomes: [], demo: true, note });

// ---------- Materialien ----------
export type SearchMode = 'recent' | 'nip50' | 'local';

export async function loadMaterials(q: string, limit = 60): Promise<Loaded<Material[]> & { mode: SearchMode }> {
  const term = q.trim();
  if (isDemo()) {
    const all = demo.materials().map(parseMaterial);
    return { ...wrapDemo(term ? all.filter((m) => materialMatches(m, term)) : all), mode: term ? 'local' : 'recent' };
  }
  const relays = getRelays('material');
  if (!term) {
    const r = await query(relays, { kinds: [30142], limit });
    return { items: sortNewest(r.events).map(parseMaterial), outcomes: r.outcomes, demo: false, mode: 'recent' };
  }
  // NIP-50 bevorzugen. Relays, die laut NIP-11 kein NIP-50 können, werden lokal gefiltert.
  const infos = await Promise.all(relays.map((u) => fetchNip11(u)));
  const searchRelays = relays.filter((_, i) => infos[i] == null || (infos[i]!.supported_nips ?? []).includes(50));
  const localRelays = relays.filter((u) => !searchRelays.includes(u));
  const results: Material[] = [];
  const outcomes: QueryOutcome[] = [];
  let mode: SearchMode = 'nip50';
  if (searchRelays.length) {
    const r = await query(searchRelays, { kinds: [30142], search: term, limit });
    outcomes.push(...r.outcomes);
    results.push(...r.events.map(parseMaterial));
    // Relay lehnt die Suche ab (CLOSED "unsupported" o. Ä.) → lokal filtern.
    const refused = r.outcomes.filter((o) => !o.ok || (o.closedReason && /unsupport|search|invalid/i.test(o.closedReason)));
    localRelays.push(...refused.map((o) => o.url).filter((u) => !localRelays.includes(u)));
  }
  if (localRelays.length) {
    const r = await query(localRelays, { kinds: [30142], limit: 500 });
    const local = r.events.map(parseMaterial).filter((m) => materialMatches(m, term));
    results.push(...local.filter((m) => !results.some((x) => x.id === m.id)));
    for (const o of r.outcomes) {
      const i = outcomes.findIndex((x) => x.url === o.url);
      if (i >= 0) outcomes[i] = o;
      else outcomes.push(o);
    }
    if (!searchRelays.length || results.length === local.length) mode = 'local';
  }
  return { items: results, outcomes, demo: false, mode };
}

export async function loadMaterial(pubkey: string, d: string, relayHints: string[] = []): Promise<Loaded<Material | null>> {
  if (isDemo()) {
    const ev = demo.materials().find((e) => e.pubkey === pubkey && e.tags.some((t) => t[0] === 'd' && t[1] === d));
    return wrapDemo(ev ? parseMaterial(ev) : null);
  }
  const relays = uniq([...getRelays('material'), ...relayHints]);
  const r = await query(relays, { kinds: [30142], authors: [pubkey], '#d': [d], limit: 1 });
  const ev = sortNewest(r.events)[0];
  return { items: ev ? parseMaterial(ev) : null, outcomes: r.outcomes, demo: false };
}

// ---------- Termine ----------
export async function loadCalendar(limit = 200): Promise<Loaded<CalendarEvent[]>> {
  if (isDemo()) return wrapDemo(demo.calendar().map(parseCalendarEvent).filter(nonNull));
  const r = await query(getRelays('calendar'), { kinds: [31922, 31923], limit });
  return { items: r.events.map(parseCalendarEvent).filter(nonNull), outcomes: r.outcomes, demo: false };
}

export async function loadCalendarEvent(kind: number, pubkey: string, d: string): Promise<Loaded<CalendarEvent | null>> {
  if (isDemo()) {
    const ev = demo.calendar().find((e) => e.kind === kind && e.pubkey === pubkey && e.tags.some((t) => t[0] === 'd' && t[1] === d));
    return wrapDemo(ev ? parseCalendarEvent(ev) : null);
  }
  const r = await query(getRelays('calendar'), { kinds: [kind], authors: [pubkey], '#d': [d], limit: 1 });
  const ev = sortNewest(r.events)[0];
  return { items: ev ? parseCalendarEvent(ev) : null, outcomes: r.outcomes, demo: false };
}

// ---------- NIP-29-Gruppen ----------
export async function loadGroups(): Promise<Loaded<Group[]>> {
  if (isDemo()) return wrapDemo(demo.groups().map((e) => parseGroup(e, 'wss://groups.edufeed.org')).filter(nonNull));
  const relays = getRelays('groups');
  const per = await Promise.all(relays.map(async (url) => ({ url, r: await query([url], { kinds: [39000], limit: 300 }) })));
  const items: Group[] = [];
  for (const { url, r } of per) for (const ev of r.events) {
    const g = parseGroup(ev, url);
    if (g) items.push(g);
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { items, outcomes: per.flatMap((p) => p.r.outcomes), demo: false };
}

export interface GroupDetail {
  group: Group | null;
  messages: GroupMessage[];
  members: string[];
  admins: { pubkey: string; roles: string[] }[];
}

export async function loadGroup(id: string, relay: string): Promise<Loaded<GroupDetail>> {
  if (isDemo()) {
    const g = demo.groups().map((e) => parseGroup(e, relay)).find((x) => x?.id === id) ?? null;
    return wrapDemo({ group: g, messages: demo.groupMessages(id).map(parseGroupMessage), members: demo.groupMembers(), admins: [{ pubkey: demo.PK.redaktion, roles: ['admin'] }] });
  }
  const [meta, msgs, roster] = await Promise.all([
    query([relay], { kinds: [39000], '#d': [id], limit: 1 }),
    query([relay], { kinds: [9, 11], '#h': [id], limit: 150 }),
    query([relay], { kinds: [39001, 39002], '#d': [id], limit: 2 }),
  ]);
  const members = roster.events.find((e) => e.kind === 39002)?.tags.filter((t) => t[0] === 'p').map((t) => t[1]) ?? [];
  const admins =
    roster.events
      .find((e) => e.kind === 39001)
      ?.tags.filter((t) => t[0] === 'p')
      .map((t) => ({ pubkey: t[1], roles: t.slice(2) })) ?? [];
  const metaEv = sortNewest(meta.events)[0];
  return {
    items: {
      group: metaEv ? parseGroup(metaEv, relay) : null,
      messages: msgs.events.map(parseGroupMessage).sort((a, b) => a.createdAt - b.createdAt),
      members,
      admins,
    },
    outcomes: [...meta.outcomes, ...msgs.outcomes],
    demo: false,
  };
}

export async function postToGroup(group: Group, content: string, kind: 9 | 11, title?: string): Promise<PublishOutcome[] | { local: GroupMessage }> {
  const s = getSession();
  if (!s) throw new Error('Bitte zuerst anmelden.');
  const tags: string[][] = [['h', group.id]];
  if (kind === 11 && title) tags.push(['title', title]);
  const tpl = { kind, content, tags, created_at: Math.floor(Date.now() / 1000) };
  const signed = await s.sign(tpl);
  if (isDemo()) return { local: parseGroupMessage(signed) };
  return publish([group.relay], signed);
}

export async function requestJoin(group: Group): Promise<PublishOutcome[]> {
  const s = getSession();
  if (!s) throw new Error('Bitte zuerst anmelden.');
  const signed = await s.sign({ kind: 9021, content: 'Beitrittsanfrage über den CoC-Hub', tags: [['h', group.id]], created_at: Math.floor(Date.now() / 1000) });
  if (isDemo()) return [{ url: group.relay, ok: true, message: 'Demo: nicht gesendet' }];
  return publish([group.relay], signed);
}

// ---------- Communikey ----------
export async function loadCommunities(): Promise<Loaded<Community[]>> {
  if (isDemo()) return wrapDemo(demo.communities().map(parseCommunity));
  const r = await query(getRelays('communities'), { kinds: [10222], limit: 200 });
  return { items: sortNewest(r.events).map(parseCommunity), outcomes: r.outcomes, demo: false };
}

export async function loadCommunity(pubkey: string): Promise<Loaded<{ community: Community | null; content: Event[] }>> {
  if (isDemo()) {
    const ev = demo.communities().find((e) => e.pubkey === pubkey);
    return wrapDemo({ community: ev ? parseCommunity(ev) : null, content: demo.communityContent(pubkey) });
  }
  const relays = getRelays('communities');
  const def = await query(relays, { kinds: [10222], authors: [pubkey], limit: 1 });
  const ev = sortNewest(def.events)[0];
  const community = ev ? parseCommunity(ev) : null;
  const contentRelays = uniq([...relays, ...(community?.relays ?? [])]);
  const content = await query(contentRelays, { '#h': [pubkey], limit: 60 } as Filter);
  return { items: { community, content: sortNewest(content.events) }, outcomes: [...def.outcomes, ...content.outcomes], demo: false };
}

// ---------- Profile ----------
const profileCache = new Map<string, Profile | null>();
const profileListeners = new Set<() => void>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function onProfiles(fn: () => void): () => void {
  profileListeners.add(fn);
  return () => profileListeners.delete(fn);
}
export function getProfile(pubkey: string): Profile | undefined {
  const p = profileCache.get(pubkey);
  return p ?? undefined;
}
export function requestProfile(pubkey: string) {
  if (!pubkey || profileCache.has(pubkey) || pending.has(pubkey)) return;
  pending.add(pubkey);
  if (!timer) timer = setTimeout(flushProfiles, 120);
}
async function flushProfiles() {
  timer = null;
  const batch = [...pending];
  pending = new Set();
  for (const pk of batch) profileCache.set(pk, null);
  if (isDemo()) {
    for (const ev of demo.profiles()) if (batch.includes(ev.pubkey)) profileCache.set(ev.pubkey, parseProfile(ev));
    profileListeners.forEach((fn) => fn());
    return;
  }
  const relays = uniq([...getRelays('profiles'), ...getRelays('communities')]);
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const r = await query(relays, { kinds: [0], authors: chunk, limit: chunk.length }, { timeout: 6000 });
    for (const ev of r.events) profileCache.set(ev.pubkey, parseProfile(ev));
  }
  profileListeners.forEach((fn) => fn());
}
export function resetCaches() {
  profileCache.clear();
}

// ---------- Hilfen ----------
function sortNewest(evs: Event[]): Event[] {
  return [...evs].sort((a, b) => b.created_at - a.created_at);
}
function nonNull<T>(x: T | null): x is T {
  return x !== null;
}
function uniq(a: string[]): string[] {
  return [...new Set(a)];
}
