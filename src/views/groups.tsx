import { useState } from 'preact/hooks';
import { nip19 } from 'nostr-tools';
import { loadCommunities, loadCommunity, loadGroup, loadGroups, postToGroup, requestJoin } from '../data';
import { getRelays, isDemo } from '../config';
import { href, useAsync, useSession, useProfile } from '../hooks';
import { COMMUNITY_TYPE_LABEL, KIND_LABEL, parseCalendarEvent, parseGroupMessage, parseMaterial, type Group, type GroupMessage } from '../nostr/parse';
import type { PublishOutcome } from '../nostr/pool';
import { groupMessageEvents } from 'applesauce-common/helpers/messages';
import { Avatar, Empty, EventRow, Loading, MaterialCard, Name, RelayNote, relTime } from '../components/ui';
import { RichText } from '../components/rich';

export function Groups() {
  const groups = useAsync(() => loadGroups(), []);
  const communities = useAsync(() => loadCommunities(), []);
  return (
    <div class="page">
      <div class="pagehead">
        <span class="eyebrow">Gemeinschaft</span>
        <h1>Gruppen und Communities</h1>
        <p class="lede">
          Moderierte Gruppen nach NIP-29 auf {getRelays('groups').map((u) => u.replace(/^wss?:\/\//, '')).join(', ') || 'keinem Relay'} und Communities nach Communikey (kind 10222).
        </p>
      </div>

      <section class="stack">
        <div class="sechead">
          <h2>Gruppen (NIP-29)</h2>
        </div>
        {groups.loading && !groups.data && <Loading label="Lade Gruppen …" />}
        {groups.data && groups.data.items.length > 0 && (
          <div class="gcards">
            {groups.data.items.map((g) => (
              <GroupCard key={g.relay + g.id} g={g} />
            ))}
          </div>
        )}
        {groups.data && groups.data.items.length === 0 && <Empty title="Keine Gruppen gefunden" outcomes={groups.data.outcomes} />}
        {groups.data && <RelayNote outcomes={groups.data.outcomes} />}
      </section>

      <section class="stack">
        <div class="sechead">
          <h2>Communities (Communikey)</h2>
        </div>
        {communities.loading && !communities.data && <Loading label="Lade Communities …" />}
        {communities.data && communities.data.items.length > 0 && (
          <div class="gcards">
            {communities.data.items.map((c) => (
              <a class="gcard" key={c.pubkey} href={href('community/' + c.npub)}>
                <Avatar pubkey={c.pubkey} size={44} square />
                <span class="gbody">
                  <span class="gt">
                    <Name pubkey={c.pubkey} />
                  </span>
                  <span class="badges">
                    <span class="tag">{COMMUNITY_TYPE_LABEL[c.type]}</span>
                    {c.sections.slice(0, 3).map((s) => (
                      <span class="tag soft" key={s.name}>
                        {s.name}
                      </span>
                    ))}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
        {communities.data && communities.data.items.length === 0 && (
          <Empty title="Keine Communities gefunden" outcomes={communities.data.outcomes}>
            Auf den Community-Relays liegt keine Community-Definition (kind 10222).
          </Empty>
        )}
      </section>
    </div>
  );
}

function GroupCard({ g }: { g: Group }) {
  return (
    <a class="gcard" href={href('gruppe/' + g.id, { r: g.relay })}>
      {g.picture ? <img class="gpic" src={g.picture} alt="" referrerpolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).hidden = true)} /> : <span class="gpic ph">{g.name.slice(0, 2).toUpperCase()}</span>}
      <span class="gbody">
        <span class="gt">{g.name}</span>
        {g.about && <span class="gs">{g.about.length > 110 ? g.about.slice(0, 108) + '…' : g.about}</span>}
        <span class="badges">
          <span class="tag">{g.isPublic ? 'Öffentlich lesbar' : 'Privat'}</span>
          <span class="tag soft">{g.isOpen ? 'Beitritt offen' : 'Beitritt auf Anfrage'}</span>
        </span>
      </span>
    </a>
  );
}

export function GroupView({ id, relay }: { id: string; relay: string }) {
  const session = useSession();
  const res = useAsync(() => loadGroup(id, relay), [id, relay]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<9 | 11>(9);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [local, setLocal] = useState<GroupMessage[]>([]);

  if (res.loading && !res.data) return <div class="page"><Loading label="Lade Gruppe …" /></div>;
  const d = res.data?.items;
  const group: Group = d?.group ?? { id, relay, name: id, isPublic: true, isOpen: true, createdAt: 0, raw: null as never };
  const messages = [...(d?.messages ?? []), ...local];
  const threads = messages.filter((m) => m.kind === 11).reverse();
  const chat = messages.filter((m) => m.kind === 9);
  const isMember = !!session && (d?.members.includes(session.pubkey) || d?.admins.some((a) => a.pubkey === session.pubkey));

  const report = (r: PublishOutcome[] | { local: GroupMessage }) => {
    if ('local' in r) {
      setLocal((l) => [...l, r.local]);
      setOutcome({ ok: true, text: 'Demo: nur lokal angezeigt, nicht gesendet.' });
      return true;
    }
    const ok = r.some((o) => o.ok);
    setOutcome({ ok, text: r.map((o) => `${o.url.replace(/^wss?:\/\//, '')}: ${o.ok ? 'angenommen' : o.message}`).join(' · ') });
    return ok;
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!text.trim() || (kind === 11 && !title.trim())) return;
    setBusy(true);
    setOutcome(null);
    try {
      const r = await postToGroup(group, text.trim(), kind, title.trim());
      if (report(r)) {
        setText('');
        setTitle('');
        if (!('local' in r)) {
          // eigene Nachricht sofort anzeigen; sie liegt nun auf dem Relay
          res.reload();
        }
      }
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="page">
      <nav class="crumb" aria-label="Pfad">
        <a href={href('gruppen')}>Gruppen</a> › {group.name}
      </nav>
      <header class="chead">
        <div class="banner" aria-hidden="true" />
        <div class="chead-row">
          {group.picture ? <img class="clogo" src={group.picture} alt="" referrerpolicy="no-referrer" /> : <span class="clogo">{group.name.slice(0, 2).toUpperCase()}</span>}
          <div class="n">
            <h1>{group.name}</h1>
            <div class="badges">
              <span class="tag">NIP-29-Gruppe</span>
              <span class="tag soft">{group.isPublic ? 'Öffentlich lesbar' : 'Privat'}</span>
              <span class="tag soft">{group.isOpen ? 'Beitritt offen' : 'Beitritt auf Anfrage'}</span>
              {d && d.members.length > 0 && <span class="muted small">{d.members.length} Mitglieder</span>}
            </div>
          </div>
          {session && !isMember && (
            <button
              class="btn s"
              type="button"
              onClick={async () => {
                try {
                  report(await requestJoin(group));
                } catch (err) {
                  setOutcome({ ok: false, text: String(err) });
                }
              }}
            >
              Beitritt anfragen
            </button>
          )}
        </div>
      </header>

      {!d?.group && res.data && (
        <Empty title="Gruppendaten nicht gefunden" outcomes={res.data.outcomes}>
          Auf {relay} liegen keine Metadaten (kind 39000) für »{id}«.
        </Empty>
      )}

      <div class="detail">
        <section class="stack" aria-label="Nachrichten">
          {session ? (
            <form class="composer" onSubmit={submit}>
              <div class="seg" role="radiogroup" aria-label="Beitragsart">
                <label class={kind === 9 ? 'on' : ''}>
                  <input type="radio" name="kind" checked={kind === 9} onChange={() => setKind(9)} /> Chat-Nachricht
                </label>
                <label class={kind === 11 ? 'on' : ''}>
                  <input type="radio" name="kind" checked={kind === 11} onChange={() => setKind(11)} /> Neues Thema
                </label>
              </div>
              {kind === 11 && (
                <>
                  <label class="sr" for="post-title">
                    Titel
                  </label>
                  <input id="post-title" class="input" placeholder="Titel des Themas" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
                </>
              )}
              <label class="sr" for="post-text">
                Nachricht
              </label>
              <textarea id="post-text" class="input" rows={3} placeholder={`Nachricht an ${group.name} …`} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
              <div class="row">
                <button class="btn p" type="submit" disabled={busy || !text.trim()}>
                  {busy ? 'Wird signiert …' : 'Senden'}
                </button>
                <span class="small muted">Wird mit h-Tag »{group.id}« an {relay.replace(/^wss?:\/\//, '')} gesendet.</span>
              </div>
              {outcome && <p class={'outcome ' + (outcome.ok ? 'ok' : 'bad')}>{outcome.text}</p>}
            </form>
          ) : (
            <div class="note">
              Lesemodus. <a href={href('anmelden')}>Melden Sie sich an</a>, um in dieser Gruppe zu schreiben.
            </div>
          )}

          {threads.length > 0 && (
            <>
              <h2 class="h3">Themen</h2>
              {threads.map((m) => (
                <Post key={m.id} m={m} />
              ))}
            </>
          )}
          <h2 class="h3">Chat</h2>
          {chat.length > 0 ? (
            <div class="chat">
              {groupMessageEvents(chat.map((m) => ({ ...m, created_at: m.createdAt }))).map((run) => (
                <ChatRun key={run[0].id} run={run} />
              ))}
            </div>
          ) : (
            res.data && <p class="muted">Noch keine Nachrichten in dieser Gruppe{isDemo() ? '' : ' (oder die Gruppe ist nicht öffentlich lesbar)'}.</p>
          )}
          {res.data && <RelayNote outcomes={res.data.outcomes} />}
        </section>
        <aside class="side">
          {group.about && (
            <section class="panel">
              <h3 class="ph">Über die Gruppe</h3>
              <RichText text={group.about} class="small" />
            </section>
          )}
          {d && d.admins.length > 0 && (
            <section class="panel">
              <h3 class="ph">Moderation</h3>
              <ul class="plist">
                {d.admins.slice(0, 8).map((a) => (
                  <li key={a.pubkey}>
                    <Avatar pubkey={a.pubkey} size={26} />
                    <span>
                      <Name pubkey={a.pubkey} />
                      <span class="muted small"> · {a.roles.join(', ') || 'Admin'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section class="panel">
            <h3 class="ph">Technik</h3>
            <dl class="meta">
              <dt>Relay</dt>
              <dd class="mono">{relay.replace(/^wss?:\/\//, '')}</dd>
              <dt>Gruppen-ID</dt>
              <dd class="mono">{id}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Post({ m, chat = false }: { m: GroupMessage; chat?: boolean }) {
  return (
    <article class={chat ? 'msg' : 'post'}>
      <Avatar pubkey={m.pubkey} size={chat ? 30 : 34} />
      <div class="pbody">
        <div class="h">
          <b>
            <Name pubkey={m.pubkey} />
          </b>
          <span>· {relTime(m.createdAt)}</span>
        </div>
        {m.title && <div class="t">{m.title}</div>}
        <RichText event={m.raw} text={m.raw ? undefined : m.content} />
      </div>
    </article>
  );
}

// Aufeinanderfolgende Nachrichten derselben Person (innerhalb von 5 Minuten) als eine Sprechblasen-Gruppe
function ChatRun({ run }: { run: GroupMessage[] }) {
  const first = run[0];
  return (
    <article class="msg">
      <Avatar pubkey={first.pubkey} size={32} />
      <div class="pbody">
        <div class="h">
          <b>
            <Name pubkey={first.pubkey} />
          </b>
          <span>· {relTime(first.createdAt)}</span>
        </div>
        <div class="bubbles">
          {run.map((m) => (
            <div class="bubble" key={m.id} title={new Date(m.createdAt * 1000).toLocaleString('de-DE')}>
              <RichText event={m.raw} text={m.raw ? undefined : m.content} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function CommunityView({ npub }: { npub: string }) {
  let pubkey = '';
  try {
    const dec = nip19.decode(npub);
    if (dec.type === 'npub') pubkey = dec.data;
  } catch {
    pubkey = '';
  }
  const res = useAsync(() => (pubkey ? loadCommunity(pubkey) : Promise.resolve(null)), [pubkey]);
  const profile = useProfile(pubkey || undefined);
  if (!pubkey) return <div class="page"><Empty title="Ungültige Community-Adresse" /></div>;
  if (res.loading && !res.data) return <div class="page"><Loading label="Lade Community …" /></div>;
  const c = res.data?.items.community;
  const content = res.data?.items.content ?? [];
  const materials = content.filter((e) => e.kind === 30142).map(parseMaterial);
  const events = content.filter((e) => e.kind === 31922 || e.kind === 31923).map(parseCalendarEvent).filter((x) => x !== null);
  const posts = content.filter((e) => e.kind === 9 || e.kind === 11 || e.kind === 1).map(parseGroupMessage);

  return (
    <div class="page">
      <nav class="crumb" aria-label="Pfad">
        <a href={href('gruppen')}>Communities</a> › <Name pubkey={pubkey} />
      </nav>
      <header class="chead">
        <div class="banner" aria-hidden="true" />
        <div class="chead-row">
          <span class="clogo-wrap">
            <Avatar pubkey={pubkey} size={76} square />
          </span>
          <div class="n">
            <h1>
              <Name pubkey={pubkey} />
            </h1>
            <div class="badges">
              <span class="tag">Communikey</span>
              {c && <span class="tag soft">{COMMUNITY_TYPE_LABEL[c.type]}</span>}
              {c?.location && <span class="muted small">{c.location}</span>}
            </div>
          </div>
        </div>
      </header>
      {!c && res.data && <Empty title="Community-Definition nicht gefunden" outcomes={res.data.outcomes}>Für diesen Schlüssel liegt kein kind 10222 auf den Community-Relays.</Empty>}
      <div class="detail">
        <section class="stack">
          {(c?.description || profile?.about) && <RichText text={c?.description || profile?.about} class="desc" />}
          {c?.membership && (
            <div class="note">
              Moderierte Community: Mitgliedschaft über die NIP-29-Gruppe{' '}
              <a href={href('gruppe/' + c.membership.groupId, { r: c.membership.relay ?? getRelays('groups')[0] })}>{c.membership.groupId}</a>.
            </div>
          )}
          {materials.length > 0 && (
            <>
              <h2 class="h3">Materialien</h2>
              <div class="cards">
                {materials.map((m) => (
                  <MaterialCard key={m.id} m={m} />
                ))}
              </div>
            </>
          )}
          {events.length > 0 && (
            <>
              <h2 class="h3">Termine</h2>
              {events.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </>
          )}
          <h2 class="h3">Beiträge</h2>
          {posts.length > 0 ? posts.map((m) => <Post key={m.id} m={m} chat />) : <p class="muted">Noch keine Beiträge mit dem h-Tag dieser Community gefunden.</p>}
          {res.data && <RelayNote outcomes={res.data.outcomes} />}
        </section>
        <aside class="side">
          {c && c.sections.length > 0 && (
            <section class="panel">
              <h3 class="ph">Inhaltsbereiche</h3>
              <ul class="sections">
                {c.sections.map((s) => (
                  <li key={s.name}>
                    <b>{s.name}</b>
                    <span class="small muted">
                      {s.kinds.map((k) => KIND_LABEL[k] ?? `kind ${k}`).join(', ')}
                      {s.access ? ` · veröffentlichen: ${s.access}` : ' · veröffentlichen: alle'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section class="panel">
            <h3 class="ph">Technik</h3>
            <dl class="meta">
              <dt>npub</dt>
              <dd class="mono wrap">{npub}</dd>
              {c && c.relays.length > 0 && (
                <>
                  <dt>Relays</dt>
                  <dd class="mono">{c.relays.map((r) => r.replace(/^wss?:\/\//, '')).join(', ')}</dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
