// Parser für die im Hub genutzten Event-Kinds. Tag-Formate nach:
//  - NIP-AMB (edufeed-org/nips, Branch edufeed-amb, AMB.md) für kind 30142
//  - NIP-52 bzw. wp-to-nostr (docs/nostr-kind-31923.md) für kind 31922/31923
//  - NIP-29 für kind 39000 (Gruppenmetadaten) und kind 9/11 (Nachrichten)
//  - Communikey (edufeed-app, .claude/skills/communikey, docs/nips/communikey-groups.md) für kind 10222
import type { Event } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

export const tagValue = (ev: Event, name: string): string | undefined => ev.tags.find((t) => t[0] === name)?.[1];
export const tagValues = (ev: Event, name: string): string[] => ev.tags.filter((t) => t[0] === name && t[1]).map((t) => t[1]);

/** Sprachabhängige Labels: bevorzugt :de, sonst :en, sonst beliebige Sprache. */
function prefLabels(ev: Event, prop: string): string[] {
  const byLang = new Map<string, string[]>();
  for (const t of ev.tags) {
    const m = t[0].match(new RegExp(`^${prop}:prefLabel:([a-zA-Z-]+)$`));
    if (m && t[1]) {
      const arr = byLang.get(m[1]) ?? [];
      arr.push(t[1]);
      byLang.set(m[1], arr);
    }
  }
  return byLang.get('de') ?? byLang.get('en') ?? [...byLang.values()][0] ?? [];
}

export interface Person {
  name?: string;
  pubkey?: string;
  role?: string;
  affiliation?: string;
}

export interface Material {
  id: string;
  pubkey: string;
  d: string;
  naddr: string;
  name: string;
  description: string;
  image?: string;
  url?: string;
  license?: string;
  licenseLabel?: string;
  keywords: string[];
  subjects: string[];
  levels: string[];
  resourceTypes: string[];
  audience: string[];
  languages: string[];
  creators: Person[];
  publishers: string[];
  provider?: string;
  datePublished?: string;
  isFree?: boolean;
  createdAt: number;
  raw: Event;
}

export function licenseLabel(uri?: string): string | undefined {
  if (!uri) return undefined;
  const cc = uri.match(/creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/?([\d.]+)?/i);
  if (cc) {
    if (cc[1] === 'publicdomain') return cc[2] === 'zero' ? 'CC0 1.0' : 'Public Domain';
    return `CC ${cc[2].toUpperCase()}${cc[3] ? ' ' + cc[3] : ''}`;
  }
  if (/^CC[ -]/i.test(uri)) return uri.toUpperCase().replace(/-/g, ' ');
  try {
    return new URL(uri).hostname;
  } catch {
    return uri;
  }
}

function isHttp(s?: string): s is string {
  return !!s && /^https?:\/\//i.test(s);
}

export function parseMaterial(ev: Event): Material {
  const d = tagValue(ev, 'd') ?? '';
  const license = tagValue(ev, 'license:id') ?? tagValue(ev, 'license');
  const creators: Person[] = [];
  for (const t of ev.tags) {
    if (t[0] === 'p' && t[1] && (t[3] === 'creator' || t[3] === 'contributor')) creators.push({ pubkey: t[1], role: t[3] });
  }
  const creatorNames = tagValues(ev, 'creator:name');
  const affil = tagValues(ev, 'creator:affiliation:name');
  creatorNames.forEach((name, i) => creators.push({ name, role: 'creator', affiliation: affil[i] }));
  tagValues(ev, 'contributor:name').forEach((name) => creators.push({ name, role: 'contributor' }));

  const encodingUrl = tagValue(ev, 'encoding:contentUrl') ?? tagValue(ev, 'encoding:embedUrl');
  const pageUrl = tagValue(ev, 'mainEntityOfPage:id');
  const url = [d, pageUrl, tagValue(ev, 'r'), encodingUrl].find(isHttp);
  let naddr = '';
  try {
    naddr = nip19.naddrEncode({ kind: ev.kind, pubkey: ev.pubkey, identifier: d });
  } catch {
    naddr = '';
  }
  const free = tagValue(ev, 'isAccessibleForFree');
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    d,
    naddr,
    name: tagValue(ev, 'name') ?? tagValue(ev, 'title') ?? 'Ohne Titel',
    description: (ev.content || tagValue(ev, 'description') || '').trim(),
    image: tagValue(ev, 'image'),
    url,
    license,
    licenseLabel: licenseLabel(license),
    keywords: tagValues(ev, 't'),
    subjects: prefLabels(ev, 'about'),
    levels: prefLabels(ev, 'educationalLevel'),
    resourceTypes: prefLabels(ev, 'learningResourceType'),
    audience: prefLabels(ev, 'audience'),
    languages: tagValues(ev, 'inLanguage'),
    creators,
    publishers: tagValues(ev, 'publisher:name'),
    provider: tagValue(ev, 'mainEntityOfPage:provider:name') ?? tagValues(ev, 'publisher:name')[0],
    datePublished: tagValue(ev, 'datePublished') ?? tagValue(ev, 'dateCreated'),
    isFree: free === undefined ? undefined : free === 'true',
    createdAt: ev.created_at,
    raw: ev,
  };
}

export function materialMatches(m: Material, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = [m.name, m.description, ...m.keywords, ...m.subjects, ...m.levels, ...m.resourceTypes, ...m.publishers, ...m.creators.map((c) => c.name ?? '')]
    .join(' ')
    .toLowerCase();
  return terms.every((t) => hay.includes(t));
}

// ---------- Termine (NIP-52) ----------
export interface CalendarEvent {
  id: string;
  pubkey: string;
  kind: number;
  d: string;
  naddr: string;
  title: string;
  summary?: string;
  content: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  tz?: string;
  location?: string;
  image?: string;
  url?: string;
  hashtags: string[];
  communities: string[];
  raw: Event;
}

function parseDateOnly(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function parseCalendarEvent(ev: Event): CalendarEvent | null {
  const startRaw = tagValue(ev, 'start');
  if (!startRaw) return null;
  const allDay = ev.kind === 31922;
  let start: Date | null;
  let end: Date | null = null;
  const endRaw = tagValue(ev, 'end');
  if (allDay) {
    start = parseDateOnly(startRaw);
    if (endRaw) end = parseDateOnly(endRaw);
  } else {
    const n = Number(startRaw);
    start = Number.isFinite(n) ? new Date(n * 1000) : null;
    if (endRaw && Number.isFinite(Number(endRaw))) end = new Date(Number(endRaw) * 1000);
  }
  if (!start || isNaN(start.getTime())) return null;
  const d = tagValue(ev, 'd') ?? '';
  let naddr = '';
  try {
    naddr = nip19.naddrEncode({ kind: ev.kind, pubkey: ev.pubkey, identifier: d });
  } catch {
    /* ignore */
  }
  const r = tagValue(ev, 'r');
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    kind: ev.kind,
    d,
    naddr,
    title: tagValue(ev, 'title') ?? tagValue(ev, 'name') ?? 'Termin',
    summary: tagValue(ev, 'summary'),
    content: ev.content,
    start,
    end: end ?? undefined,
    allDay,
    tz: tagValue(ev, 'start_tzid'),
    location: tagValue(ev, 'location'),
    image: tagValue(ev, 'image'),
    url: isHttp(r) ? r : isHttp(d) ? d : undefined,
    hashtags: tagValues(ev, 't'),
    communities: tagValues(ev, 'h'),
    raw: ev,
  };
}

/** Kommende zuerst (aufsteigend), laufende zählen als kommend; vergangene danach absteigend. */
export function sortCalendar(list: CalendarEvent[], now = new Date()): { upcoming: CalendarEvent[]; past: CalendarEvent[] } {
  const endOf = (e: CalendarEvent) => {
    if (e.end) return e.allDay ? e.end.getTime() + 86400000 : e.end.getTime();
    return e.allDay ? e.start.getTime() + 86400000 : e.start.getTime() + 3600000;
  };
  const upcoming = list.filter((e) => endOf(e) >= now.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime());
  const past = list.filter((e) => endOf(e) < now.getTime()).sort((a, b) => b.start.getTime() - a.start.getTime());
  return { upcoming, past };
}

// ---------- NIP-29-Gruppen ----------
export interface Group {
  id: string;
  relay: string;
  name: string;
  about?: string;
  picture?: string;
  isPublic: boolean;
  isOpen: boolean;
  createdAt: number;
  raw: Event;
}

export function parseGroup(ev: Event, relay: string): Group | null {
  const id = tagValue(ev, 'd');
  if (!id) return null;
  const has = (n: string) => ev.tags.some((t) => t[0] === n);
  return {
    id,
    relay,
    name: tagValue(ev, 'name') || id,
    about: tagValue(ev, 'about'),
    picture: tagValue(ev, 'picture'),
    isPublic: !has('private'),
    isOpen: !has('closed'),
    createdAt: ev.created_at,
    raw: ev,
  };
}

export interface GroupMessage {
  id: string;
  pubkey: string;
  kind: number;
  title?: string;
  content: string;
  createdAt: number;
  replyTo?: string;
  raw: Event;
}

export function parseGroupMessage(ev: Event): GroupMessage {
  const q = ev.tags.find((t) => t[0] === 'q' || (t[0] === 'e' && t[3] === 'reply'));
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    kind: ev.kind,
    title: tagValue(ev, 'title') ?? tagValue(ev, 'subject'),
    content: ev.content,
    createdAt: ev.created_at,
    replyTo: q?.[1],
    raw: ev,
  };
}

// ---------- Communikey (kind 10222) ----------
export interface ContentSection {
  name: string;
  kinds: number[];
  access?: string;
}
export type CommunityType = 'open' | 'moderated' | 'closed';
export interface Community {
  pubkey: string;
  npub: string;
  relays: string[];
  sections: ContentSection[];
  type: CommunityType;
  membership?: { groupId: string; relay?: string };
  description?: string;
  location?: string;
  createdAt: number;
  raw: Event;
}

export function parseCommunity(ev: Event): Community {
  const sections: ContentSection[] = [];
  let current: ContentSection | null = null;
  let membership: Community['membership'];
  let hasConcord = false;
  for (const t of ev.tags) {
    if (t[0] === 'content' && t[1]) {
      current = { name: t[1], kinds: [] };
      sections.push(current);
    } else if (t[0] === 'k' && current && t[1]) {
      const n = Number(t[1]);
      if (Number.isFinite(n)) current.kinds.push(n);
    } else if (t[0] === 'access' && current) {
      current.access = t[1] === 'role' && t[2] ? `Rolle »${t[2]}«` : t[1] === 'members' ? 'nur Mitglieder' : t[1];
    } else if (t[0] === 'membership' && t[1]) {
      membership = { groupId: t[1], relay: t[2] };
    } else if (t[0] === 'concord') {
      hasConcord = true;
    }
  }
  const type: CommunityType = membership && hasConcord ? 'open' : hasConcord ? 'closed' : membership ? 'moderated' : 'open';
  return {
    pubkey: ev.pubkey,
    npub: nip19.npubEncode(ev.pubkey),
    relays: tagValues(ev, 'r'),
    sections,
    type,
    membership: type === 'moderated' ? membership : undefined,
    description: tagValue(ev, 'description'),
    location: tagValue(ev, 'location'),
    createdAt: ev.created_at,
    raw: ev,
  };
}

export const COMMUNITY_TYPE_LABEL: Record<CommunityType, string> = { open: 'Offen', moderated: 'Moderiert', closed: 'Geschlossen' };

export const KIND_LABEL: Record<number, string> = {
  1: 'Kurznachricht',
  9: 'Chat',
  11: 'Forum',
  1111: 'Kommentar',
  30023: 'Artikel',
  30142: 'Lernmaterial',
  30301: 'Kanban',
  31922: 'Termin (ganztägig)',
  31923: 'Termin',
  31924: 'Kalender',
};

// ---------- Profile (kind 0) ----------
export interface Profile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  banner?: string;
  website?: string;
}

export function parseProfile(ev: Event): Profile {
  try {
    const c = JSON.parse(ev.content || '{}');
    return {
      pubkey: ev.pubkey,
      name: typeof c.name === 'string' ? c.name : undefined,
      displayName: typeof c.display_name === 'string' ? c.display_name : typeof c.displayName === 'string' ? c.displayName : undefined,
      picture: typeof c.picture === 'string' ? c.picture : undefined,
      about: typeof c.about === 'string' ? c.about : undefined,
      nip05: typeof c.nip05 === 'string' ? c.nip05 : undefined,
      banner: typeof c.banner === 'string' ? c.banner : undefined,
      website: typeof c.website === 'string' ? c.website : undefined,
    };
  } catch {
    return { pubkey: ev.pubkey };
  }
}

export function displayName(p: Profile | undefined, pubkey: string): string {
  const n = p?.displayName || p?.name;
  if (n) return n;
  try {
    const npub = nip19.npubEncode(pubkey);
    return npub.slice(0, 10) + '…' + npub.slice(-4);
  } catch {
    return pubkey.slice(0, 8);
  }
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '')).toUpperCase();
}
