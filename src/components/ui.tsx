import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { isDemo, setDemo } from '../config';
import type { QueryOutcome } from '../nostr/pool';
import { displayName, initials, type CalendarEvent, type Material } from '../nostr/parse';
import { bumpEpoch, href, useProfile } from '../hooks';

// ---------- Icons (inline SVG, currentColor) ----------
const paths: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  home: 'M12 3 3 10v11h6v-6h6v6h6V10l-9-7Z',
  book: 'M5 3h9a4 4 0 0 1 4 4v14H8a3 3 0 0 1-3-3V3Zm2 2v13a1 1 0 0 0 1 1h8V7a2 2 0 0 0-2-2H7Z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6H2Zm15.5-6c2.6.3 4.5 2.4 4.5 5v1h-4c0-2.3-.2-4.3-.5-6Z',
  calendar: 'M7 2h2v2h6V2h2v2h3v17H4V4h3V2Zm-1 8v9h12v-9H6Zm0-4v2h12V6H6Z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.9 5.5-2 .4a7 7 0 0 1-.7 1.6l1.2 1.7-1.9 1.9-1.7-1.2c-.5.3-1 .5-1.6.7l-.4 2h-2.6l-.4-2a7 7 0 0 1-1.6-.7l-1.7 1.2-1.9-1.9 1.2-1.7a7 7 0 0 1-.7-1.6l-2-.4v-2.6l2-.4c.2-.6.4-1.1.7-1.6L4.6 5.3l1.9-1.9 1.7 1.2c.5-.3 1-.5 1.6-.7l.4-2h2.6l.4 2c.6.2 1.1.4 1.6.7l1.7-1.2 1.9 1.9-1.2 1.7c.3.5.5 1 .7 1.6l2 .4v2.6Z',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-8 10c0-4.4 3.6-8 8-8s8 3.6 8 8H4Z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0ZM8.5 20.5a5 5 0 0 1-3.5-8.5l2.1-2.1 1.4 1.4-2.1 2.1a3 3 0 0 0 4.2 4.2l2.1-2.1 1.4 1.4-2.1 2.1a5 5 0 0 1-3.5 1.5Zm8.4-6.4-1.4-1.4 2.1-2.1a3 3 0 0 0-4.2-4.2l-2.1 2.1-1.4-1.4L12 5a5 5 0 0 1 7 7l-2.1 2.1Z',
  pin: 'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v5.4l3.6 2.1-1 1.7L11 13.6V7h2Z',
  key: 'M14 2a8 8 0 0 0-7.7 10.1L2 16.4V22h5.6l1-1v-2h2v-2h2l1.3-1.3A8 8 0 1 0 14 2Zm2 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  chat: 'M4 4h16v12H8l-4 4V4Zm2 2v9.2L7.2 14H18V6H6Z',
  shield: 'M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5l-8-3Z',
};
export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg class="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d={paths[name] ?? ''} />
    </svg>
  );
}

// ---------- Avatar ----------
const AVA_CLASSES = ['b', 'o', 'g', 'v'];
export function Avatar({ pubkey, size = 32, square = false }: { pubkey: string; size?: number; square?: boolean }) {
  const p = useProfile(pubkey);
  const [broken, setBroken] = useState(false);
  const name = displayName(p, pubkey);
  const cls = AVA_CLASSES[parseInt(pubkey.slice(0, 2) || '0', 16) % AVA_CLASSES.length];
  const style = { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' };
  if (p?.picture && !broken)
    return <img class={'ava' + (square ? ' sq' : '')} style={style} src={p.picture} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span class={`ava ${cls}${square ? ' sq' : ''}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function Name({ pubkey }: { pubkey: string }) {
  const p = useProfile(pubkey);
  return <>{displayName(p, pubkey)}</>;
}

// ---------- Badges ----------
export function License({ label, uri }: { label?: string; uri?: string }) {
  if (!label) return <span class="lic none">Lizenz unbekannt</span>;
  return (
    <span class="lic" title={uri}>
      {label}
    </span>
  );
}
export function Chip({ children, on = false }: { children: ComponentChildren; on?: boolean }) {
  return <span class={'chip' + (on ? ' on' : '')}>{children}</span>;
}

// ---------- Datum ----------
const MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
export function DateBadge({ date, large = false }: { date: Date; large?: boolean }) {
  return (
    <span class={'date' + (large ? ' lg' : '')} aria-hidden="true">
      <small>{MONTHS[date.getMonth()]}</small>
      <b>{String(date.getDate()).padStart(2, '0')}</b>
    </span>
  );
}
export function formatWhen(e: CalendarEvent): string {
  const wd = e.start.toLocaleDateString('de-DE', { weekday: 'short' });
  if (e.allDay) {
    if (e.end && e.end.getTime() !== e.start.getTime()) return `${wd} · ganztägig bis ${e.end.toLocaleDateString('de-DE')}`;
    return `${wd} · ganztägig`;
  }
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: e.tz };
  let s: string;
  try {
    s = e.start.toLocaleTimeString('de-DE', opts);
  } catch {
    s = e.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  if (e.end) {
    try {
      s += '–' + e.end.toLocaleTimeString('de-DE', opts);
    } catch {
      /* ignore */
    }
  }
  return `${wd} · ${s} Uhr`;
}
export function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 2) return 'gestern';
  if (diff < 86400 * 30) return `vor ${Math.floor(diff / 86400)} Tagen`;
  return new Date(ts * 1000).toLocaleDateString('de-DE');
}

// ---------- Karten ----------
const PATTERNS = ['pat1', 'pat2', 'pat3', 'pat4'];
export function MaterialCard({ m }: { m: Material }) {
  const [broken, setBroken] = useState(false);
  const pat = PATTERNS[parseInt(m.id.slice(-2) || '0', 16) % PATTERNS.length];
  const type = m.resourceTypes[0];
  const meta = [m.levels[0], m.subjects[0]].filter(Boolean).join(' · ');
  return (
    <a class="mc" href={href('material/' + m.naddr)}>
      <div class={'img ' + pat}>
        {m.image && !broken && <img src={m.image} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setBroken(true)} />}
        {type && <span class="type">{type}</span>}
      </div>
      <div class="bd">
        <span class="ti">{m.name}</span>
        {meta && <span class="sub">{meta}</span>}
      </div>
      <div class="ft">
        <License label={m.licenseLabel} uri={m.license} />
        <span class="src-tag">{m.provider ? `via ${m.provider}` : relTime(m.createdAt)}</span>
      </div>
    </a>
  );
}

export function EventRow({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
  return (
    <a class={compact ? 'ev' : 'evrow'} href={href(`termin/${e.naddr}`)}>
      <DateBadge date={e.start} large={!compact} />
      <span class="evtext">
        <span class="t">{e.title}</span>
        <span class="s">
          <span>{formatWhen(e)}</span>
          {e.location && <span>{shortLocation(e.location)}</span>}
        </span>
      </span>
    </a>
  );
}
export function shortLocation(loc: string): string {
  if (/https?:\/\//.test(loc)) return /zoom/i.test(loc) ? 'online (Zoom)' : 'online';
  return loc.length > 40 ? loc.slice(0, 38) + '…' : loc;
}

// ---------- Zustände ----------
export function Loading({ label = 'Lade Daten von den Relays …' }: { label?: string }) {
  return (
    <div class="loading" role="status">
      <span class="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function RelayNote({ outcomes }: { outcomes: QueryOutcome[] }) {
  const failed = outcomes.filter((o) => !o.ok);
  if (!failed.length) return null;
  return (
    <p class="relaynote">
      Nicht erreichbar: {failed.map((o) => `${o.url.replace(/^wss?:\/\//, '')} (${o.error ?? o.closedReason ?? 'Fehler'})`).join(', ')}.{' '}
      <a href={href('einstellungen')}>Relays prüfen</a>
    </p>
  );
}

export function Empty({ title, children, outcomes, compact = false }: { title: string; children?: ComponentChildren; outcomes?: QueryOutcome[]; compact?: boolean }) {
  const allFailed = !!outcomes && outcomes.length > 0 && outcomes.every((o) => !o.ok);
  return (
    <div class={'empty' + (compact ? ' compact' : '')}>
      <b>{allFailed ? 'Keine Verbindung zu den Relays' : title}</b>
      {allFailed && compact ? (
        <p>{outcomes!.map((o) => o.url.replace(/^wss?:\/\//, '')).join(', ')} antworten nicht.</p>
      ) : allFailed ? (
        <p>
          Keines der konfigurierten Relays hat geantwortet ({outcomes!.map((o) => o.url.replace(/^wss?:\/\//, '')).join(', ')}). Das kann an der Netzwerkumgebung liegen, etwa einer Firewall oder einer eingebetteten Vorschau, die WebSocket-Verbindungen sperrt.
        </p>
      ) : (
        children && <p>{children}</p>
      )}
      <div class="row">
        <a class="btn s sm" href={href('einstellungen')}>
          Relays einstellen
        </a>
        {!isDemo() && (
          <button
            class="btn g sm"
            type="button"
            onClick={() => {
              setDemo(true);
              bumpEpoch();
            }}
          >
            Demo-Daten anzeigen
          </button>
        )}
      </div>
    </div>
  );
}

export function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div class="demo-banner" role="note">
      <b>Demo-Daten aktiv.</b> Alle Inhalte sind erfundene Beispiele und stammen nicht aus dem Edufeed-Netz. Beiträge werden nicht gesendet.
      <button
        type="button"
        class="btn sm s"
        onClick={() => {
          setDemo(false);
          bumpEpoch();
        }}
      >
        Echte Daten laden
      </button>
    </div>
  );
}

export function SectionHead({ title, link, linkLabel }: { title: string; link?: string; linkLabel?: string }) {
  return (
    <div class="sechead">
      <h2>{title}</h2>
      {link && <a href={link}>{linkLabel ?? 'Alle anzeigen'}</a>}
    </div>
  );
}
