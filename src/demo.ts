// DEMO-DATEN – nur aktiv, wenn der Schalter »Demo-Daten« eingeschaltet ist.
// Alle Inhalte sind erfunden und dienen ausschließlich dazu, die Oberfläche vorzuführen,
// wenn keine Relays erreichbar sind. Sie werden niemals an Relays gesendet.
import type { Event } from 'nostr-tools';

const hex = (seed: string) => {
  let h = '';
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  while (h.length < 64) {
    x = (x * 1103515245 + 12345) >>> 0;
    h += x.toString(16).padStart(8, '0');
  }
  return h.slice(0, 64);
};

export const PK = {
  lena: hex('demo-lena'),
  tobias: hex('demo-tobias'),
  redaktion: hex('demo-redaktion'),
  anna: hex('demo-anna'),
  werkstatt: hex('demo-community-werkstatt'),
  konfi: hex('demo-community-konfi'),
  wp: hex('demo-wp-sync'),
};

const now = Math.floor(Date.now() / 1000);
const ev = (kind: number, pubkey: string, tags: string[][], content = '', ageSec = 3600): Event => ({
  id: hex(`${kind}-${pubkey}-${JSON.stringify(tags).slice(0, 80)}-${content.slice(0, 20)}`),
  pubkey,
  kind,
  tags,
  content,
  created_at: now - ageSec,
  sig: '0'.repeat(128),
});

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';

export function materials(): Event[] {
  return [
    ev(30142, PK.lena, [
      ['d', 'https://beispiel.org/material/psalm-23-bildmeditation'],
      ['type', 'LearningResource'],
      ['name', 'Psalm 23 als Bildmeditation'],
      ['about:prefLabel:de', 'Evangelische Religion'],
      ['learningResourceType:prefLabel:de', 'Arbeitsblatt'],
      ['educationalLevel:prefLabel:de', 'Sekundarstufe I'],
      ['audience:prefLabel:de', 'Lehrende'],
      ['t', 'Psalmen'], ['t', 'Vertrauen'], ['t', 'Meditation'],
      ['inLanguage', 'de'],
      ['license:id', CC_BY],
      ['isAccessibleForFree', 'true'],
      ['p', PK.lena, '', 'creator'],
      ['datePublished', '2026-09-12'],
    ], 'Eine angeleitete Bildmeditation zu Psalm 23 mit sechs Fotokarten, Impulsfragen und einer Schreibaufgabe. Geeignet als Einstieg in das Thema Vertrauen und Geborgenheit. Enthält eine Fassung in einfacher Sprache.', 3 * 3600),
    ev(30142, PK.redaktion, [
      ['d', 'https://beispiel.org/material/ramadan-fastenzeit'],
      ['name', 'Ramadan und Fastenzeit: interreligiös vergleichen'],
      ['about:prefLabel:de', 'Religion'],
      ['learningResourceType:prefLabel:de', 'Unterrichtsreihe'],
      ['educationalLevel:prefLabel:de', 'Sekundarstufe I'],
      ['t', 'Interreligiöses Lernen'], ['t', 'Islam'], ['t', 'Fastenzeit'],
      ['inLanguage', 'de'],
      ['license:id', CC_BY_SA],
      ['publisher:name', 'rpi-virtuell'],
      ['mainEntityOfPage:provider:name', 'rpi-virtuell'],
      ['creator:name', 'Redaktion Materialpool'],
    ], 'Vier Doppelstunden, in denen Schülerinnen und Schüler Fastentraditionen in Islam und Christentum vergleichen, mit Interviewleitfaden und Rollenkarten.', 9 * 3600),
    ev(30142, PK.anna, [
      ['d', 'https://beispiel.org/material/synagoge-erklaerfilm'],
      ['name', 'Was ist eine Synagoge? Erklärfilm mit Aufgaben'],
      ['about:prefLabel:de', 'Religion'],
      ['learningResourceType:prefLabel:de', 'Video'],
      ['educationalLevel:prefLabel:de', 'Primarstufe'],
      ['t', 'Judentum'], ['t', 'Synagoge'],
      ['license:id', CC_BY_SA],
      ['mainEntityOfPage:provider:name', 'OERSI'],
      ['creator:name', 'Anna K.'],
      ['duration', 'PT7M'],
    ], 'Sieben Minuten Erklärfilm über Aufbau und Funktion einer Synagoge, mit Arbeitsblatt und Lösung.', 26 * 3600),
    ev(30142, PK.lena, [
      ['d', 'https://beispiel.org/material/hiob-klasse-9'],
      ['name', 'Hiob: Warum lässt Gott Leid zu?'],
      ['about:prefLabel:de', 'Evangelische Religion'],
      ['learningResourceType:prefLabel:de', 'Unterrichtsreihe'],
      ['educationalLevel:prefLabel:de', 'Sekundarstufe I'],
      ['t', 'Theodizee'], ['t', 'Hiob'], ['t', 'Bibel'],
      ['license:id', CC_BY_SA],
      ['p', PK.lena, '', 'creator'],
    ], 'Entwurf einer Unterrichtsreihe für Klasse 9 zur Theodizeefrage anhand des Hiobbuchs.', 3 * 86400),
    ev(30142, PK.redaktion, [
      ['d', 'https://beispiel.org/material/schoepfung-bildkarten'],
      ['name', 'Schöpfung erzählen: Bildkarten zu Gen 1'],
      ['about:prefLabel:de', 'Evangelische Religion'],
      ['learningResourceType:prefLabel:de', 'Bildkarten'],
      ['educationalLevel:prefLabel:de', 'Primarstufe'],
      ['t', 'Schöpfung'], ['t', 'Bibel'],
      ['license:id', CC_BY_SA],
      ['mainEntityOfPage:provider:name', 'rpi-virtuell'],
    ], 'Zwölf Bildkarten zum Nacherzählen von Gen 1, mit Impulsfragen für Kleingruppen.', 5 * 86400),
    ev(30142, PK.tobias, [
      ['d', 'https://beispiel.org/material/konfi-stadtrallye'],
      ['name', 'Konfi-Stadtrallye: Kirche im Quartier entdecken'],
      ['about:prefLabel:de', 'Gemeindepädagogik'],
      ['learningResourceType:prefLabel:de', 'Methode'],
      ['educationalLevel:prefLabel:de', 'außerschulisch'],
      ['t', 'Konfirmandenarbeit'], ['t', 'Sozialraum'],
      ['license:id', CC_BY],
      ['creator:name', 'Tobias B.'],
    ], 'Stationen, Fragekarten und Auswertungsbogen für eine 90-minütige Rallye durch die eigene Gemeinde.', 8 * 86400),
  ];
}

export function calendar(): Event[] {
  const day = 86400;
  const at = (daysAhead: number, hour: number, min = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, min, 0, 0);
    return String(Math.floor(d.getTime() / 1000));
  };
  const date = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return [
    ev(31923, PK.wp, [['d', 'https://beispiel.org/termin/liascript-werkstatt'], ['title', 'Online-Werkstatt: OER erstellen mit LiaScript'], ['start', at(7, 16)], ['end', at(7, 17, 30)], ['start_tzid', 'Europe/Berlin'], ['location', 'Zoom (Link nach Anmeldung)'], ['summary', 'Einführung in LiaScript für Religionslehrkräfte, mit Praxisteil.'], ['t', 'relilab'], ['t', 'OER']], 'Wir bauen gemeinsam ein kleines Lernmodul.', 2 * day),
    ev(31922, PK.redaktion, [['d', 'fachtag-rp-digital'], ['title', 'Fachtag Religionspädagogik digital'], ['start', date(14)], ['location', 'Münster'], ['summary', 'Vorträge und Workshops zu digitalen Lernwegen im RU.']], '', 4 * day),
    ev(31923, PK.tobias, [['d', 'konfi-stammtisch-nord'], ['title', 'Konfi-Stammtisch Nord'], ['start', at(22, 19, 30)], ['end', at(22, 21)], ['location', 'online'], ['t', 'Konfirmandenarbeit']], '', 1 * day),
    ev(31923, PK.redaktion, [['d', 'sprechstunde-edufeed'], ['title', 'Sprechstunde: Materialien ins Edufeed-Netz bringen'], ['start', at(29, 15)], ['end', at(29, 16)], ['location', 'online']], '', 1 * day),
    ev(31923, PK.wp, [['d', 'https://beispiel.org/termin/ki-im-ru'], ['title', 'relilab-Impuls: KI-Bilder im Religionsunterricht'], ['start', at(-6, 18)], ['end', at(-6, 19)], ['location', 'online'], ['t', 'relilab']], '', 10 * day),
  ];
}

export function groups(): Event[] {
  return [
    ev(39000, PK.redaktion, [['d', 'oer-werkstatt-ru'], ['name', 'OER-Werkstatt RU'], ['about', 'Gemeinsam OER für den Religionsunterricht entwickeln, prüfen und teilen.'], ['public'], ['closed']], '', 20 * 86400),
    ev(39000, PK.redaktion, [['d', 'reli-grundschule'], ['name', 'Reli Grundschule'], ['about', 'Austausch für Religionslehrkräfte an Grundschulen.'], ['public'], ['open']], '', 30 * 86400),
    ev(39000, PK.redaktion, [['d', 'konfi-digital'], ['name', 'Konfi digital'], ['about', 'Digitale Methoden in der Konfirmandenarbeit.'], ['public'], ['open']], '', 40 * 86400),
  ];
}

export function groupMessages(groupId: string): Event[] {
  return [
    ev(11, PK.redaktion, [['h', groupId], ['title', 'Willkommen! So funktioniert die Werkstatt']], 'Regeln, Lizenzhinweise und wie ihr Materialien der Community zuordnet.', 6 * 86400),
    ev(11, PK.tobias, [['h', groupId], ['title', 'KI-Bilder im RU: Welche Lizenz gebt ihr an?']], 'Ich nutze generierte Bilder für Arbeitsblätter und bin unsicher, wie ich das korrekt kennzeichne.', 2 * 86400),
    ev(9, PK.lena, [['h', groupId]], 'Review gesucht: Unterrichtsreihe »Hiob« (Klasse 9). Wer schaut bis Ende Oktober drüber?', 86400),
    ev(9, PK.anna, [['h', groupId]], 'Die Bildmeditation zu Psalm 23 geht auch in Klasse 4 mit der Fassung in einfacher Sprache.', 5 * 3600),
  ];
}
export function groupMembers(): string[] {
  return [PK.redaktion, PK.lena, PK.tobias, PK.anna];
}

export function communities(): Event[] {
  return [
    ev(10222, PK.werkstatt, [['r', 'wss://relay-rpi.edufeed.org'], ['content', 'Chat'], ['k', '9'], ['content', 'Materialien'], ['k', '30142'], ['access', 'role', 'publisher'], ['content', 'Termine'], ['k', '31922'], ['k', '31923'], ['membership', 'oer-werkstatt-ru', 'wss://groups.edufeed.org'], ['description', 'Offen für Lehrkräfte, Referendar:innen und Hochschule.']], '', 10 * 86400),
    ev(10222, PK.konfi, [['r', 'wss://relay-rpi.edufeed.org'], ['content', 'Chat'], ['k', '9'], ['content', 'Termine'], ['k', '31923']], '', 12 * 86400),
  ];
}
export function communityContent(pubkey: string): Event[] {
  return [
    ev(9, PK.tobias, [['h', pubkey]], 'Hat jemand Erfahrungen mit Bibliolog in digitalen Settings?', 7200),
    ev(31923, PK.wp, [['h', pubkey], ['d', 'demo-x'], ['title', 'Online-Werkstatt: OER erstellen mit LiaScript'], ['start', String(now + 7 * 86400)]], '', 86400),
  ];
}

export function profiles(): Event[] {
  const p = (pk: string, o: Record<string, string>) => ev(0, pk, [], JSON.stringify(o), 86400);
  return [
    p(PK.lena, { name: 'Lena Sommer', about: 'Fachdidaktik Evangelische Religion · Hochschule (Demo-Profil)' }),
    p(PK.tobias, { name: 'Tobias B.', about: 'Gemeindepädagoge, Konfi-Arbeit (Demo-Profil)' }),
    p(PK.redaktion, { name: 'Redaktion (Demo)', about: 'Beispiel-Redaktionskonto' }),
    p(PK.anna, { name: 'Anna K.', about: 'Lehrerin Grundschule (Demo-Profil)' }),
    p(PK.werkstatt, { name: 'OER-Werkstatt Religionsunterricht', about: 'Gemeinsam OER für den Religionsunterricht entwickeln, prüfen und teilen.' }),
    p(PK.konfi, { name: 'Konfi digital', about: 'Netzwerk für digitale Konfirmandenarbeit.' }),
    p(PK.wp, { name: 'Termine aus WordPress (Demo)', about: 'Beispiel für ein wp-to-nostr-Konto' }),
  ];
}
