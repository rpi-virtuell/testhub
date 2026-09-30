import { useState } from 'preact/hooks';
import { loadCalendar, loadCommunities, loadGroups, loadMaterials } from '../data';
import { href, navigate, useAsync, useSession } from '../hooks';
import { displayName, sortCalendar } from '../nostr/parse';
import { useProfile } from '../hooks';
import { Avatar, Empty, EventRow, Icon, Loading, MaterialCard, Name, RelayNote, SectionHead } from '../components/ui';

export function Home() {
  const session = useSession();
  const me = useProfile(session?.pubkey);
  const materials = useAsync(() => loadMaterials('', 12), []);
  const calendar = useAsync(() => loadCalendar(150), []);
  const groups = useAsync(() => loadGroups(), []);
  const communities = useAsync(() => loadCommunities(), []);
  const [q, setQ] = useState('');

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const upcoming = calendar.data ? sortCalendar(calendar.data.items).upcoming.slice(0, 4) : [];

  return (
    <div class="page">
      <section class="hello">
        <div class="hello-text">
          <span class="eyebrow">{today}</span>
          <h1>{session ? `Willkommen, ${displayName(me, session.pubkey)}` : 'Materialien, Gruppen und Termine aus dem Edufeed-Netz'}</h1>
          <p class="lede">
            Offene Bildungsmaterialien für Religionspädagogik und darüber hinaus, Austausch in Gruppen und Termine aus vielen Kalendern. Alles liegt als signierte Nostr-Events auf offenen Relays.
          </p>
        </div>
        <form
          class="bigsearch"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate('materialien', { q });
          }}
        >
          <Icon name="search" />
          <label for="home-search" class="sr">
            Materialien suchen
          </label>
          <input id="home-search" type="search" placeholder="Material suchen, z. B. Psalmen, Schöpfung, Konfi …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <button class="btn p" type="submit">
            Suchen
          </button>
        </form>
      </section>

      <div class="dash">
        <section class="stack" aria-labelledby="h-new">
          <SectionHead title="Neu im Netz" link={href('materialien')} linkLabel="Alle Materialien" />
          {materials.loading && !materials.data && <Loading />}
          {materials.data && materials.data.items.length > 0 && (
            <>
              <div class="cards">
                {materials.data.items.slice(0, 6).map((m) => (
                  <MaterialCard key={m.id} m={m} />
                ))}
              </div>
              <RelayNote outcomes={materials.data.outcomes} />
            </>
          )}
          {materials.data && materials.data.items.length === 0 && <Empty title="Noch keine Materialien gefunden" outcomes={materials.data.outcomes} />}
        </section>

        <aside class="side">
          <section class="panel" aria-labelledby="h-ev">
            <h3 class="ph" id="h-ev">
              Nächste Termine
            </h3>
            {calendar.loading && !calendar.data && <Loading label="Lade Termine …" />}
            {calendar.data && upcoming.length > 0 && upcoming.map((e) => <EventRow key={e.id} e={e} compact />)}
            {calendar.data && upcoming.length === 0 && <Empty compact title="Keine kommenden Termine" outcomes={calendar.data.outcomes} />}
            <a class="more" href={href('termine')}>
              Alle Termine
            </a>
          </section>

          <section class="panel" aria-labelledby="h-gr">
            <h3 class="ph" id="h-gr">
              Gruppen
            </h3>
            {groups.loading && !groups.data && <Loading label="Lade Gruppen …" />}
            {groups.data && groups.data.items.length > 0 && (
              <ul class="glist">
                {groups.data.items.slice(0, 6).map((g) => (
                  <li key={g.relay + g.id}>
                    <a href={href('gruppe/' + g.id, { r: g.relay })}>
                      <span class="gdot">{g.name.slice(0, 2).toUpperCase()}</span>
                      <span class="gname">{g.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {groups.data && groups.data.items.length === 0 && <Empty compact title="Keine Gruppen gefunden" outcomes={groups.data.outcomes} />}
            {communities.data && communities.data.items.length > 0 && (
              <>
                <h4 class="ph sub">Communities</h4>
                <ul class="glist">
                  {communities.data.items.slice(0, 4).map((c) => (
                    <li key={c.pubkey}>
                      <a href={href('community/' + c.npub)}>
                        <Avatar pubkey={c.pubkey} size={22} square />
                        <span class="gname">
                          <Name pubkey={c.pubkey} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <a class="more" href={href('gruppen')}>
              Alle Gruppen und Communities
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
