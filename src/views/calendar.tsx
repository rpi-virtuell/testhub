import { useState } from 'preact/hooks';
import { nip19 } from 'nostr-tools';
import { loadCalendar, loadCalendarEvent } from '../data';
import { href, useAsync } from '../hooks';
import { sortCalendar, type CalendarEvent } from '../nostr/parse';
import { Avatar, DateBadge, Empty, EventRow, Loading, Name, RelayNote, formatWhen } from '../components/ui';
import { RichText } from '../components/rich';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function MonthGrid({ month, events, onPrev, onNext }: { month: Date; events: CalendarEvent[]; onPrev: () => void; onNext: () => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  const hasEvent = new Set(events.filter((e) => e.start.getMonth() === month.getMonth() && e.start.getFullYear() === month.getFullYear()).map((e) => e.start.getDate()));
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return (
    <div class="month">
      <div class="mhead">
        <b>{month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</b>
        <span class="row">
          <button type="button" class="btn g sm" aria-label="Vorheriger Monat" onClick={onPrev}>
            ‹
          </button>
          <button type="button" class="btn g sm" aria-label="Nächster Monat" onClick={onNext}>
            ›
          </button>
        </span>
      </div>
      <div class="cal" role="grid" aria-label="Monatsübersicht">
        {WD.map((w) => (
          <b key={w}>{w}</b>
        ))}
        {cells.map((d, i) => {
          const isToday = d !== null && d === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
          return (
            <span key={i} class={(d === null ? 'x' : '') + (d !== null && hasEvent.has(d) ? ' e' : '') + (isToday ? ' today' : '')}>
              {d ?? ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function Calendar() {
  const res = useAsync(() => loadCalendar(300), []);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showPast, setShowPast] = useState(false);
  const [filter, setFilter] = useState('');
  const all = res.data?.items ?? [];
  const tags = [...new Set(all.flatMap((e) => e.hashtags))].slice(0, 10);
  const filtered = filter ? all.filter((e) => e.hashtags.includes(filter)) : all;
  const { upcoming, past } = sortCalendar(filtered);

  return (
    <div class="page">
      <div class="pagehead">
        <span class="eyebrow">Kalender</span>
        <h1>Termine</h1>
        <p class="lede">Fortbildungen, Werkstätten und Treffen als NIP-52-Kalenderevents, unter anderem aus WordPress über wp-to-nostr.</p>
      </div>
      <div class="evlayout">
        <aside class="side">
          <section class="panel">
            <MonthGrid month={month} events={filtered} onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
          </section>
          {tags.length > 0 && (
            <section class="panel">
              <h3 class="ph">Schlagworte</h3>
              <div class="chips">
                {tags.map((t) => (
                  <button type="button" key={t} class={'chip' + (filter === t ? ' on' : '')} aria-pressed={filter === t} onClick={() => setFilter(filter === t ? '' : t)}>
                    #{t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
        <section class="stack">
          <div class="sechead">
            <h2>Kommende Veranstaltungen</h2>
            {res.data && <span class="muted small">{upcoming.length} Termine</span>}
          </div>
          {res.loading && !res.data && <Loading label="Lade Termine …" />}
          {upcoming.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
          {res.data && !res.loading && upcoming.length === 0 && <Empty title="Keine kommenden Termine" outcomes={res.data.outcomes} />}
          {past.length > 0 && (
            <>
              <button type="button" class="btn g" aria-expanded={showPast} onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Vergangene Termine ausblenden' : `Vergangene Termine anzeigen (${past.length})`}
              </button>
              {showPast && (
                <div class="stack past">
                  {past.slice(0, 50).map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </div>
              )}
            </>
          )}
          {res.data && <RelayNote outcomes={res.data.outcomes} />}
        </section>
      </div>
    </div>
  );
}

export function EventDetail({ naddr }: { naddr: string }) {
  let ptr: nip19.AddressPointer | null = null;
  try {
    const d = nip19.decode(naddr);
    if (d.type === 'naddr') ptr = d.data;
  } catch {
    ptr = null;
  }
  const res = useAsync(() => (ptr ? loadCalendarEvent(ptr.kind, ptr.pubkey, ptr.identifier) : Promise.resolve(null)), [naddr]);
  if (!ptr) return <div class="page"><Empty title="Ungültige Termin-Adresse" /></div>;
  if (res.loading && !res.data) return <div class="page"><Loading label="Lade Termin …" /></div>;
  const e = res.data?.items;
  if (!e) return <div class="page"><Empty title="Termin nicht gefunden" outcomes={res.data?.outcomes} /></div>;
  const locIsUrl = e.location && /^https?:\/\/\S+$/.test(e.location.trim());
  return (
    <div class="page">
      <nav class="crumb" aria-label="Pfad">
        <a href={href('termine')}>Termine</a> › {e.title}
      </nav>
      <div class="detail">
        <article class="stack">
          <div class="evhead">
            <DateBadge date={e.start} large />
            <div>
              <h1 class="dtitle">{e.title}</h1>
              <p class="muted">
                {e.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })} · {formatWhen(e)}
              </p>
            </div>
          </div>
          {e.image && <img class="hero" src={e.image} alt="" referrerpolicy="no-referrer" onError={(ev) => ((ev.target as HTMLImageElement).hidden = true)} />}
          {e.summary && <p class="desc">{e.summary}</p>}
          {e.content && e.content !== e.summary && <RichText text={e.content} class="prose-text" />}
          <div class="row">
            {e.url && (
              <a class="btn p" href={e.url} target="_blank" rel="noopener noreferrer">
                Zur Veranstaltungsseite
              </a>
            )}
            {locIsUrl && (
              <a class="btn s" href={e.location!.trim()} target="_blank" rel="noopener noreferrer">
                Online-Raum öffnen
              </a>
            )}
          </div>
        </article>
        <aside class="side">
          <section class="panel">
            <h3 class="ph">Details</h3>
            <dl class="meta">
              <dt>Wann</dt>
              <dd>{formatWhen(e)}</dd>
              {e.location && (
                <>
                  <dt>Wo</dt>
                  <dd class="wrap">{e.location}</dd>
                </>
              )}
              {e.hashtags.length > 0 && (
                <>
                  <dt>Schlagworte</dt>
                  <dd>{e.hashtags.map((t) => '#' + t).join(' ')}</dd>
                </>
              )}
              <dt>Art</dt>
              <dd>kind {e.kind} ({e.allDay ? 'ganztägig' : 'mit Uhrzeit'})</dd>
            </dl>
          </section>
          <section class="panel">
            <h3 class="ph">Eingetragen von</h3>
            <p class="who">
              <Avatar pubkey={e.pubkey} size={28} /> <Name pubkey={e.pubkey} />
            </p>
          </section>
          {res.data && <RelayNote outcomes={res.data.outcomes} />}
        </aside>
      </div>
    </div>
  );
}
