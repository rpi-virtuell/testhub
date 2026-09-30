import { render } from 'preact';
import './styles.css';
import { useEffect, useState } from 'preact/hooks';
import { href, navigate, useEpoch, useProfile, useRelayStatuses, useRoute, useSession, type Route } from './hooks';
import { restoreSession } from './nostr/auth';
import { displayName } from './nostr/parse';
import { getRelays } from './config';
import { Avatar, DemoBanner, Icon } from './components/ui';
import { Home } from './views/home';
import { MaterialDetail, Materials } from './views/materials';
import { CommunityView, GroupView, Groups } from './views/groups';
import { Calendar, EventDetail } from './views/calendar';
import { Settings } from './views/settings';
import { Account, Login } from './views/account';

const NAV = [
  { key: '', label: 'Start', icon: 'home' },
  { key: 'materialien', label: 'Materialien', icon: 'book', also: ['material'] },
  { key: 'gruppen', label: 'Gruppen', icon: 'users', also: ['gruppe', 'community'] },
  { key: 'termine', label: 'Termine', icon: 'calendar', also: ['termin'] },
];

function View({ route }: { route: Route }) {
  const [a, b] = route.path;
  switch (a ?? '') {
    case '':
      return <Home />;
    case 'materialien':
      return <Materials route={route} />;
    case 'material':
      return <MaterialDetail naddr={b ?? ''} />;
    case 'gruppen':
      return <Groups />;
    case 'gruppe':
      return <GroupView id={b ?? ''} relay={route.query.get('r') || getRelays('groups')[0] || ''} />;
    case 'community':
      return <CommunityView npub={b ?? ''} />;
    case 'termine':
      return <Calendar />;
    case 'termin':
      return <EventDetail naddr={b ?? ''} />;
    case 'einstellungen':
      return <Settings />;
    case 'anmelden':
      return <Login />;
    case 'profil':
      return <Account />;
    default:
      return (
        <div class="page">
          <div class="empty">
            <b>Seite nicht gefunden</b>
            <a href={href('')}>Zur Startseite</a>
          </div>
        </div>
      );
  }
}

function RelayIndicator() {
  const st = useRelayStatuses();
  const open = st.filter((s) => s.state === 'open' || s.state === 'closed').length;
  const bad = st.filter((s) => s.state === 'error').length;
  const state = st.length === 0 ? 'idle' : open > 0 ? (bad ? 'partial' : 'ok') : st.some((s) => s.state === 'connecting') ? 'connecting' : 'bad';
  const label =
    state === 'ok' ? `${open} ${open === 1 ? 'Relay' : 'Relays'} erreichbar` : state === 'partial' ? `${open} erreichbar, ${bad} nicht` : state === 'bad' ? 'Keine Relays erreichbar' : state === 'connecting' ? 'Verbinde …' : 'Relays';
  return (
    <a class="relayind" data-state={state} href={href('einstellungen')} title="Relay-Einstellungen und Verbindungsstatus">
      <span class="dot" aria-hidden="true" />
      <span class="lbl">{label}</span>
    </a>
  );
}

function Header({ route }: { route: Route }) {
  const session = useSession();
  const p = useProfile(session?.pubkey);
  const [q, setQ] = useState('');
  const cur = route.path[0] ?? '';
  return (
    <header class="top">
      <div class="top-in">
        <a class="logo" href={href('')} aria-label="Edufeed Community-Hub, Startseite">
          edufeed<em>·</em>hub
        </a>
        <form
          class="topsearch"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate('materialien', { q: q.trim() || undefined });
          }}
        >
          <Icon name="search" size={16} />
          <label class="sr" for="top-search">
            Materialien suchen
          </label>
          <input id="top-search" type="search" placeholder="Materialien suchen …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </form>
        <nav class="mainnav" aria-label="Hauptnavigation">
          {NAV.map((n) => (
            <a key={n.key} href={href(n.key)} class={cur === n.key || n.also?.includes(cur) ? 'on' : ''} aria-current={cur === n.key ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <RelayIndicator />
        <a class={'iconbtn' + (cur === 'einstellungen' ? ' on' : '')} href={href('einstellungen')} aria-label="Einstellungen">
          <Icon name="gear" />
        </a>
        {session ? (
          <a class="me" href={href('profil')} title={displayName(p, session.pubkey)}>
            <Avatar pubkey={session.pubkey} size={32} />
          </a>
        ) : (
          <a class="btn p sm" href={href('anmelden')}>
            Anmelden
          </a>
        )}
      </div>
    </header>
  );
}

function BottomNav({ route }: { route: Route }) {
  const session = useSession();
  const cur = route.path[0] ?? '';
  const items = [...NAV, { key: session ? 'profil' : 'anmelden', label: session ? 'Konto' : 'Anmelden', icon: 'user', also: ['profil', 'anmelden', 'einstellungen'] }];
  return (
    <nav class="bottomnav" aria-label="Navigation">
      {items.map((n) => (
        <a key={n.key} href={href(n.key)} class={cur === n.key || n.also?.includes(cur) ? 'on' : ''}>
          <Icon name={n.icon} size={20} />
          <span>{n.label}</span>
        </a>
      ))}
    </nav>
  );
}

function App() {
  const route = useRoute();
  const epoch = useEpoch();
  useEffect(() => {
    restoreSession();
  }, []);
  return (
    <>
      <a class="skip" href="#inhalt" onClick={(e) => { e.preventDefault(); document.getElementById('inhalt')?.focus(); }}>
        Zum Inhalt springen
      </a>
      <Header route={route} />
      <DemoBanner key={'d' + epoch} />
      <main id="inhalt" tabIndex={-1}>
        <View key={epoch + ':' + route.path.join('/') + '?' + route.query.toString()} route={route} />
      </main>
      <footer class="foot">
        <span>Edufeed Community-Hub · MVP · offene Daten aus dem Nostr-Netz</span>
        <a href={href('einstellungen')}>Relays</a>
      </footer>
      <BottomNav route={route} />
    </>
  );
}

render(<App />, document.getElementById('app')!);
