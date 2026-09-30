import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { nip19 } from 'nostr-tools';
import { loadMaterial, loadMaterials } from '../data';
import { href, navigate, useAsync, useProfiles, type Route } from '../hooks';
import { displayName, type Material } from '../nostr/parse';
import { Avatar, Chip, Empty, Icon, License, Loading, MaterialCard, Name, RelayNote, relTime } from '../components/ui';
import { RichText } from '../components/rich';

type FacetKey = 'levels' | 'resourceTypes' | 'licenseLabel';
const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'levels', label: 'Bildungsstufe' },
  { key: 'resourceTypes', label: 'Ressourcentyp' },
  { key: 'licenseLabel', label: 'Lizenz' },
];
const facetValues = (m: Material, k: FacetKey): string[] => (k === 'licenseLabel' ? (m.licenseLabel ? [m.licenseLabel] : []) : m[k]);

export function Materials({ route }: { route: Route }) {
  const q = route.query.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [filters, setFilters] = useState<Partial<Record<FacetKey, string>>>({});
  const res = useAsync(() => loadMaterials(q, 80), [q]);

  const facets = useMemo(() => {
    const out: Record<FacetKey, Map<string, number>> = { levels: new Map(), resourceTypes: new Map(), licenseLabel: new Map() };
    for (const m of res.data?.items ?? []) for (const f of FACETS) for (const v of facetValues(m, f.key)) out[f.key].set(v, (out[f.key].get(v) ?? 0) + 1);
    return out;
  }, [res.data]);

  const items = (res.data?.items ?? []).filter((m) => FACETS.every((f) => !filters[f.key] || facetValues(m, f.key).includes(filters[f.key]!)));

  const modeLabel = res.data?.demo
    ? 'Demo-Daten, lokal gefiltert'
    : res.data?.mode === 'nip50'
      ? 'Volltextsuche am AMB-Relay (NIP-50)'
      : res.data?.mode === 'local'
        ? 'Lokale Filterung der geladenen Materialien (Relay ohne NIP-50)'
        : 'Neueste Materialien';

  return (
    <div class="page">
      <div class="pagehead">
        <span class="eyebrow">Entdecken</span>
        <h1>Lernmaterialien</h1>
        <p class="lede">Offene Bildungsressourcen mit AMB-Metadaten (Nostr kind 30142) aus dem Edufeed-Netz.</p>
      </div>
      <form
        class="bigsearch"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({});
          navigate('materialien', { q: input.trim() || undefined });
        }}
      >
        <Icon name="search" />
        <label for="mat-search" class="sr">
          Suchbegriff
        </label>
        <input id="mat-search" type="search" placeholder="Thema, Schlagwort, Fach …" value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} />
        <button class="btn p" type="submit">
          Suchen
        </button>
      </form>

      <div class="resultbar">
        <span>
          {res.loading ? 'Suche läuft …' : `${items.length} ${items.length === 1 ? 'Material' : 'Materialien'}`}
          {q && !res.loading && <> für »{q}«</>}
        </span>
        <span class="mode">{modeLabel}</span>
      </div>

      {FACETS.some((f) => facets[f.key].size > 0) && (
        <div class="facets">
          {FACETS.filter((f) => facets[f.key].size > 0).map((f) => (
            <div class="facet" key={f.key}>
              <span class="flabel">{f.label}</span>
              <div class="chips">
                {[...facets[f.key].entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([v, n]) => (
                    <button
                      type="button"
                      key={v}
                      class={'chip' + (filters[f.key] === v ? ' on' : '')}
                      aria-pressed={filters[f.key] === v}
                      onClick={() => setFilters((s) => ({ ...s, [f.key]: s[f.key] === v ? undefined : v }))}
                    >
                      {v} <span class="n">{n}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {res.loading && !res.data && <Loading />}
      {res.data && items.length > 0 && (
        <div class="cards wide">
          {items.map((m) => (
            <MaterialCard key={m.id} m={m} />
          ))}
        </div>
      )}
      {res.data && !res.loading && items.length === 0 && (
        <Empty title={q ? `Keine Treffer für »${q}«` : 'Keine Materialien gefunden'} outcomes={res.data.outcomes}>
          Versuchen Sie einen allgemeineren Begriff oder entfernen Sie Filter.
        </Empty>
      )}
      {res.data && <RelayNote outcomes={res.data.outcomes} />}
    </div>
  );
}

export function MaterialDetail({ naddr }: { naddr: string }) {
  let ptr: nip19.AddressPointer | null = null;
  try {
    const dec = nip19.decode(naddr);
    if (dec.type === 'naddr') ptr = dec.data;
  } catch {
    ptr = null;
  }
  const res = useAsync(() => (ptr ? loadMaterial(ptr.pubkey, ptr.identifier, ptr.relays) : Promise.resolve(null)), [naddr]);
  const [copied, setCopied] = useState('');
  const creatorKeys = (res.data?.items?.creators ?? []).filter((c) => c.pubkey && c.role !== 'contributor').map((c) => c.pubkey!);
  const creatorProfiles = useProfiles(creatorKeys);

  if (!ptr) return <div class="page"><Empty title="Ungültige Material-Adresse">Der Link enthält keine gültige naddr-Adresse.</Empty></div>;
  if (res.loading && !res.data) return <div class="page"><Loading label="Lade Material …" /></div>;
  const m = res.data?.items;
  if (!m) return <div class="page"><Empty title="Material nicht gefunden" outcomes={res.data?.outcomes}>Das Material ist auf den konfigurierten Relays nicht (mehr) vorhanden.</Empty></div>;

  const creators = m.creators.filter((c) => c.role !== 'contributor');
  const creatorNames = creators.map((c) => c.name ?? (c.pubkey ? displayName(creatorProfiles[creatorKeys.indexOf(c.pubkey)], c.pubkey) : '')).filter(Boolean);
  const attribution = `»${m.name}«${creatorNames.length ? ' von ' + creatorNames.join(', ') : ''}${m.licenseLabel ? ', ' + m.licenseLabel : ''}`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied('manuell');
    }
    setTimeout(() => setCopied(''), 2500);
  };
  const facts: [string, string | undefined][] = [
    ['Fach', m.subjects.join(', ')],
    ['Bildungsstufe', m.levels.join(', ')],
    ['Ressourcentyp', m.resourceTypes.join(', ')],
    ['Zielgruppe', m.audience.join(', ')],
    ['Sprache', m.languages.map((l) => (l === 'de' ? 'Deutsch' : l === 'en' ? 'Englisch' : l)).join(', ')],
    ['Lizenz', m.licenseLabel],
    ['Herausgeber', m.publishers.join(', ')],
    ['Veröffentlicht', m.datePublished ? new Date(m.datePublished).toLocaleDateString('de-DE') : undefined],
    ['Kostenfrei', m.isFree === undefined ? undefined : m.isFree ? 'ja' : 'nein'],
    ['Schlagworte', m.keywords.join(', ')],
  ];

  return (
    <div class="page">
      <nav class="crumb" aria-label="Pfad">
        <a href={href('materialien')}>Materialien</a>
        {m.subjects[0] && <> › {m.subjects[0]}</>}
        {m.levels[0] && <> › {m.levels[0]}</>}
      </nav>
      <div class="detail">
        <article class="stack">
          <div class="chips">
            {m.resourceTypes.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
            <License label={m.licenseLabel} uri={m.license} />
          </div>
          <h1 class="dtitle">{m.name}</h1>
          <div class="byline">
            {creators.length > 0 ? (
              creators.map((c, i) =>
                c.pubkey ? (
                  <span class="who" key={i}>
                    <Avatar pubkey={c.pubkey} size={26} /> <Name pubkey={c.pubkey} />
                  </span>
                ) : (
                  <span class="who" key={i}>
                    {c.name}
                    {c.affiliation ? ` (${c.affiliation})` : ''}
                  </span>
                ),
              )
            ) : (
              <span class="who">
                <Avatar pubkey={m.pubkey} size={26} /> <Name pubkey={m.pubkey} />
              </span>
            )}
            <span>· eingetragen {relTime(m.createdAt)}</span>
            {m.provider && <span>· via {m.provider}</span>}
          </div>
          {m.image && <img class="hero" src={m.image} alt="" referrerpolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).hidden = true)} />}
          {m.description ? <RichText text={m.description} class="desc" /> : <p class="desc muted">Keine Beschreibung vorhanden.</p>}
          <div class="row">
            {m.url && (
              <a class="btn p" href={m.url} target="_blank" rel="noopener noreferrer">
                Material öffnen
              </a>
            )}
            <button class="btn s" type="button" onClick={() => copy(m.url ?? location.href, 'link')}>
              <Icon name="link" size={16} /> Link kopieren
            </button>
            {copied && <span class="toast">{copied === 'manuell' ? 'Kopieren nicht möglich, bitte manuell markieren.' : 'Kopiert.'}</span>}
          </div>
          <details class="tech">
            <summary>Technische Ansicht (AMB / Nostr)</summary>
            <p class="small">
              kind {m.raw.kind} · Adresse <code>{m.naddr.slice(0, 24)}…</code>
            </p>
            <pre class="code">{m.raw.tags.map((t) => t.join('  ')).join('\n')}</pre>
          </details>
        </article>
        <aside class="side">
          <section class="panel">
            <h3 class="ph">Steckbrief</h3>
            <dl class="meta">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Fragment key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </Fragment>
                ))}
            </dl>
          </section>
          <section class="panel">
            <h3 class="ph">Namensnennung</h3>
            <p class="small">{attribution}</p>
            <button class="btn s sm" type="button" onClick={() => copy(attribution, 'attr')}>
              Namensnennung kopieren
            </button>
          </section>
          {res.data && <RelayNote outcomes={res.data.outcomes} />}
        </aside>
      </div>
    </div>
  );
}
