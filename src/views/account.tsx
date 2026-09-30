import { useState } from 'preact/hooks';
import { nip19 } from 'nostr-tools';
import { hasExtension, loginWithBunker, loginWithExtension, logout } from '../nostr/auth';
import { href, navigate, useProfile, useSession } from '../hooks';
import { displayName } from '../nostr/parse';
import { Avatar, Icon } from '../components/ui';
import { RichText } from '../components/rich';

export function Login() {
  const session = useSession();
  const [bunker, setBunker] = useState('');
  const [busy, setBusy] = useState<'' | 'ext' | 'bunker'>('');
  const [err, setErr] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const ext = hasExtension();

  if (session) {
    return (
      <div class="page narrow">
        <div class="note">
          Sie sind angemeldet. <a href={href('profil')}>Zum Konto</a>
        </div>
      </div>
    );
  }

  const withExt = async () => {
    setErr('');
    setBusy('ext');
    try {
      await loginWithExtension();
      navigate('profil');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };
  const withBunker = async (e: Event) => {
    e.preventDefault();
    setErr('');
    setAuthUrl('');
    setBusy('bunker');
    try {
      await loginWithBunker(bunker, (url) => setAuthUrl(url));
      navigate('profil');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy('');
    }
  };

  return (
    <div class="onb">
      <div class="onb-l">
        <h1>Mitreden, teilen, Termine merken</h1>
        <p>Zum Lesen brauchen Sie kein Konto. Mit einer Anmeldung schreiben Sie in Gruppen und veröffentlichen später eigene Materialien.</p>
        <ul>
          <li>
            <i>1</i>
            <span>
              <b>Ein Konto für viele Plattformen.</b> Ihr Nostr-Profil funktioniert auch in anderen Anwendungen des Edufeed-Netzes.
            </span>
          </li>
          <li>
            <i>2</i>
            <span>
              <b>Ihr Schlüssel bleibt bei Ihnen.</b> Der Hub sieht nie Ihren privaten Schlüssel; signiert wird in der Erweiterung oder im Bunker.
            </span>
          </li>
          <li>
            <i>3</i>
            <span>
              <b>Öffentlich heißt öffentlich.</b> Beiträge werden an mehrere Relays verteilt und sind dort für alle lesbar.
            </span>
          </li>
        </ul>
      </div>
      <div class="onb-r">
        <h2>Wie möchten Sie sich anmelden?</h2>
        <div class="opt disabled" aria-disabled="true">
          <span class="ic">
            <Icon name="user" />
          </span>
          <span>
            <span class="t">Mit Google fortfahren</span>
            <span class="s">Schlüssel wird aufgeteilt verwahrt (FROST-Remote-Signer). Im MVP noch nicht verfügbar.</span>
          </span>
          <span class="badge soon">demnächst</span>
        </div>

        <div class={'opt' + (ext ? ' rec' : '')}>
          <span class="ic">
            <Icon name="key" />
          </span>
          <span>
            <span class="t">Browser-Erweiterung (NIP-07)</span>
            <span class="s">{ext ? 'Erweiterung gefunden, z. B. Alby, nos2x oder Keys.band.' : 'Keine Erweiterung gefunden. Installieren Sie z. B. Alby oder nos2x und laden Sie die Seite neu.'}</span>
          </span>
          <button class="btn p sm" type="button" disabled={!ext || !!busy} onClick={withExt}>
            {busy === 'ext' ? 'Warte …' : 'Anmelden'}
          </button>
        </div>

        <form class="opt col" onSubmit={withBunker}>
          <span class="optrow">
            <span class="ic">
              <Icon name="shield" />
            </span>
            <span>
              <span class="t">Remote-Signer / Bunker (NIP-46)</span>
              <span class="s">bunker://-Adresse aus Ihrer Signer-App (z. B. Amber, nsec.app) oder Ihrer Einrichtung.</span>
            </span>
          </span>
          <label class="sr" for="bunker-url">
            Bunker-Adresse
          </label>
          <input id="bunker-url" class="input mono" placeholder="bunker://…?relay=wss://…&secret=…" value={bunker} onInput={(e) => setBunker((e.target as HTMLInputElement).value)} />
          <button class="btn s" type="submit" disabled={!bunker.trim() || !!busy}>
            {busy === 'bunker' ? 'Verbinde mit Bunker …' : 'Mit Bunker verbinden'}
          </button>
          {authUrl && (
            <p class="note small">
              Der Bunker verlangt eine Bestätigung:{' '}
              <a href={authUrl} target="_blank" rel="noopener noreferrer">
                Freigabe öffnen
              </a>
            </p>
          )}
        </form>
        {err && (
          <p class="outcome bad" role="alert">
            {err}
          </p>
        )}
        <p class="small muted">
          Oder <a href={href('')}>ohne Konto weiterstöbern</a>. Suche, Materialien, Gruppen und Termine bleiben frei lesbar.
        </p>
      </div>
    </div>
  );
}

export function Account() {
  const session = useSession();
  const p = useProfile(session?.pubkey);
  const [copied, setCopied] = useState(false);
  if (!session) {
    return (
      <div class="page narrow">
        <div class="note">
          Sie sind nicht angemeldet. <a href={href('anmelden')}>Jetzt anmelden</a>
        </div>
      </div>
    );
  }
  const npub = nip19.npubEncode(session.pubkey);
  return (
    <div class="page">
      <header class="phead">
        <div class="pcover" aria-hidden="true" />
        <div class="phead-row">
          <span class="pava">
            <Avatar pubkey={session.pubkey} size={88} />
          </span>
          <div class="n">
            <h1>{displayName(p, session.pubkey)}</h1>
            {p?.nip05 && <span class="nip05">{p.nip05}</span>}
          </div>
          <button
            class="btn s"
            type="button"
            onClick={async () => {
              await logout();
              navigate('');
            }}
          >
            Abmelden
          </button>
        </div>
      </header>
      <div class="detail">
        <section class="stack">
          {p?.about ? <RichText text={p.about} class="desc" /> : <p class="muted">Kein Profiltext (kind 0) auf den Profil-Relays gefunden.</p>}
          {p?.website && (
            <p>
              <a href={p.website} target="_blank" rel="noopener noreferrer">
                {p.website}
              </a>
            </p>
          )}
        </section>
        <aside class="side">
          <section class="panel">
            <h3 class="ph">Konto</h3>
            <dl class="meta">
              <dt>Angemeldet über</dt>
              <dd>
                <span class="signer">{session.method === 'nip07' ? 'Browser-Erweiterung (NIP-07)' : 'Bunker (NIP-46)'}</span>
              </dd>
              <dt>npub</dt>
              <dd class="mono wrap">{npub}</dd>
            </dl>
            <button
              class="btn s sm"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(npub);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* Kopieren nicht erlaubt */
                }
              }}
            >
              {copied ? 'Kopiert' : 'npub kopieren'}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
