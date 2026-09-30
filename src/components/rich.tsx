// Formatierter Text für Nostr-Inhalte mit applesauce-content:
// Links, Bilder und Videos, Erwähnungen (npub, nevent, naddr …), Hashtags, eigene Emojis (NIP-30)
// und Bildergalerien. Der Parser erzeugt einen NAST-Baum, den wir hier mit Preact rendern.
import { getParsedContent } from 'applesauce-content/text';
import type { Content } from 'applesauce-content/nast';
import { getPubkeyFromDecodeResult } from 'applesauce-core/helpers/pointers';
import { isImageURL, isVideoURL } from 'applesauce-core/helpers/url';
import type { Event } from 'nostr-tools';
import { href } from '../hooks';
import { Name } from './ui';

// Eigener Cache-Schlüssel, damit wir nicht mit dem Standard-Cache für kind 1 kollidieren.
const CoCContent = Symbol('coc-content');

function Media({ url }: { url: string }) {
  if (isImageURL(url))
    return (
      <a class="rt-media" href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="" loading="lazy" referrerpolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).closest('a')!.hidden = true)} />
      </a>
    );
  if (isVideoURL(url)) return <video class="rt-media" src={url} controls preload="metadata" />;
  return null;
}

function NastNode({ node }: { node: Content }) {
  switch (node.type) {
    case 'text':
      return <>{node.value}</>;
    case 'link': {
      if (isImageURL(node.href) || isVideoURL(node.href)) return <Media url={node.href} />;
      let host = node.value;
      try {
        const u = new URL(node.href);
        host = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : '');
        if (host.length > 48) host = host.slice(0, 46) + '…';
      } catch {
        /* Originaltext behalten */
      }
      return (
        <a class="rt-link" href={node.href} target="_blank" rel="noopener noreferrer">
          {host}
        </a>
      );
    }
    case 'gallery':
      return (
        <span class="rt-gallery">
          {node.links.map((l) => (
            <Media key={l} url={l} />
          ))}
        </span>
      );
    case 'mention': {
      const pk = getPubkeyFromDecodeResult(node.decoded);
      const ext = 'https://njump.me/' + node.encoded;
      if (node.decoded.type === 'npub' || node.decoded.type === 'nprofile')
        return pk ? (
          <a class="rt-mention" href={ext} target="_blank" rel="noopener noreferrer">
            @<Name pubkey={pk} />
          </a>
        ) : null;
      return (
        <a class="rt-ref" href={ext} target="_blank" rel="noopener noreferrer">
          {node.decoded.type === 'naddr' ? 'Verweis' : 'Beitrag'} ↗
        </a>
      );
    }
    case 'hashtag':
      return (
        <a class="rt-tag" href={href('materialien', { q: node.hashtag })}>
          #{node.name}
        </a>
      );
    case 'emoji':
      return <img class="rt-emoji" src={node.url} alt={node.raw} title={node.raw} referrerpolicy="no-referrer" />;
    default:
      return null;
  }
}

/**
 * Rendert Nostr-Text formatiert. `event` liefert Tags (Hashtags, Emojis) und wird als Cache genutzt;
 * reine Strings (z. B. Beschreibungen aus Metadaten) werden ohne Cache geparst.
 */
export function RichText({ event, text, class: cls = 'txt' }: { event?: Event; text?: string; class?: string }) {
  const src = event ?? text ?? '';
  if (!src || (typeof src === 'string' && !src.trim())) return null;
  let root;
  try {
    root = typeof src === 'string' ? getParsedContent(src, undefined, undefined, null) : getParsedContent(src, text, undefined, text === undefined ? CoCContent : null);
  } catch {
    return <p class={cls}>{typeof src === 'string' ? src : src.content}</p>;
  }
  return (
    <div class={cls + ' rt'}>
      {root.children.map((n, i) => (
        <NastNode key={i} node={n} />
      ))}
    </div>
  );
}
