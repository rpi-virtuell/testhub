// End-to-End-Test der Single-File-HTML mit Playwright (Chromium) gegen einen lokalen Test-Relay.
// Aufruf: npm run build && node tests/e2e.mjs [Ausgabeordner-für-Screenshots]
import { chromium } from 'playwright';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { startMockRelay } from './mock-relay.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = resolve(process.argv[2] ?? 'test-results');
mkdirSync(OUT, { recursive: true });
const HTML = resolve('dist-single/index.html');

// ---------- Testdaten (signiert, nur für den lokalen Test-Relay) ----------
const keys = Object.fromEntries(['relay', 'lena', 'redaktion', 'wp', 'community', 'me'].map((n) => [n, generateSecretKey()]));
const pk = (n) => getPublicKey(keys[n]);
const now = Math.floor(Date.now() / 1000);
const sign = (n, kind, tags, content = '', age = 3600) => finalizeEvent({ kind, tags, content, created_at: now - age }, keys[n]);
const day = 86400;
const makeEvents = (R) => [
  sign('lena', 0, [], JSON.stringify({ name: 'Lena Test', about: 'Testprofil' })),
  sign('redaktion', 0, [], JSON.stringify({ name: 'Redaktion Test' })),
  sign('community', 0, [], JSON.stringify({ name: 'Test-Community Reli', about: 'Community aus dem Testrelay' })),
  sign('me', 0, [], JSON.stringify({ name: 'Ich (Test)', about: 'Angemeldetes Testkonto', nip05: 'ich@example.org' })),
  sign('lena', 30142, [['d', 'https://example.org/psalm-23'], ['name', 'Psalm 23 als Bildmeditation'], ['about:prefLabel:de', 'Evangelische Religion'], ['learningResourceType:prefLabel:de', 'Arbeitsblatt'], ['educationalLevel:prefLabel:de', 'Sekundarstufe I'], ['t', 'Psalmen'], ['t', 'Vertrauen'], ['license:id', 'https://creativecommons.org/licenses/by/4.0/'], ['p', pk('lena'), '', 'creator'], ['inLanguage', 'de']], 'Bildmeditation mit sechs Fotokarten.', 2 * 3600),
  sign('redaktion', 30142, [['d', 'https://example.org/schoepfung'], ['name', 'Schöpfung erzählen: Bildkarten'], ['about:prefLabel:de', 'Evangelische Religion'], ['learningResourceType:prefLabel:de', 'Bildkarten'], ['educationalLevel:prefLabel:de', 'Primarstufe'], ['t', 'Schöpfung'], ['license:id', 'https://creativecommons.org/licenses/by-sa/4.0/'], ['publisher:name', 'rpi-virtuell'], ['mainEntityOfPage:provider:name', 'rpi-virtuell']], 'Zwölf Bildkarten zu Gen 1.', 5 * 3600),
  sign('redaktion', 30142, [['d', 'https://example.org/synagoge'], ['name', 'Was ist eine Synagoge?'], ['learningResourceType:prefLabel:de', 'Video'], ['educationalLevel:prefLabel:de', 'Primarstufe'], ['t', 'Judentum'], ['license:id', 'https://creativecommons.org/licenses/by-sa/4.0/'], ['creator:name', 'Anna Test']], 'Erklärfilm mit Aufgaben.', day),
  sign('wp', 31923, [['d', 'https://example.org/termin/1'], ['title', 'Online-Werkstatt LiaScript'], ['start', String(now + 5 * day)], ['end', String(now + 5 * day + 5400)], ['start_tzid', 'Europe/Berlin'], ['location', 'online'], ['t', 'relilab'], ['h', pk('community')]], 'Einführung', day),
  sign('redaktion', 31922, [['d', 'fachtag'], ['title', 'Fachtag Religionspädagogik digital'], ['start', new Date(Date.now() + 12 * day * 1000).toISOString().slice(0, 10)], ['location', 'Münster']], '', day),
  sign('wp', 31923, [['d', 'https://example.org/termin/alt'], ['title', 'Vergangener Impuls'], ['start', String(now - 9 * day)], ['end', String(now - 9 * day + 3600)]], '', 10 * day),
  sign('relay', 39000, [['d', 'werkstatt'], ['name', 'OER-Werkstatt Test'], ['about', 'Testgruppe auf dem lokalen Relay'], ['public'], ['open']], '', 3 * day),
  sign('relay', 39002, [['d', 'werkstatt'], ['p', pk('lena')], ['p', pk('redaktion')]], '', 3 * day),
  sign('relay', 39001, [['d', 'werkstatt'], ['p', pk('redaktion'), 'admin']], '', 3 * day),
  sign('redaktion', 11, [['h', 'werkstatt'], ['title', 'Willkommen in der Werkstatt']], 'Bitte stellt euch kurz vor.', 2 * day),
  sign('lena', 9, [['h', 'werkstatt']], 'Hallo zusammen, ich teile bald eine Reihe zu Hiob.', 3600),
  sign('community', 10222, [['r', R], ['content', 'Chat'], ['k', '9'], ['content', 'Termine'], ['k', '31923'], ['membership', 'werkstatt', R]], '', 2 * day),
];

const relay = await startMockRelay({ htmlFile: HTML });
const R = relay.url;
relay.store.push(...makeEvents(R));
console.log('Test-Relay', R);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message));
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`);
};
const shot = async (name) => { await page.waitForTimeout(700); return page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); };

// 1) Standard-Relays (im Container nicht erreichbar) → sauberer Leerzustand
await page.goto(relay.http);
await page.waitForSelector('.hello');
await page.waitForFunction(() => document.querySelectorAll('.loading').length === 0, null, { timeout: 30000 }).catch(() => {});
const emptyTxt = await page.locator('.empty').first().textContent().catch(() => '');
check('Leerzustand ohne erreichbare Relays', !!emptyTxt, (emptyTxt ?? '').slice(0, 80));
await shot('00-start-ohne-relays');
const errorsDefault = consoleErrors.splice(0);

// 2) Lokaler Test-Relay für alle Kategorien
await page.evaluate((r) => {
  localStorage.setItem('edufeed-hub:relays', JSON.stringify({ material: [r], groups: [r], calendar: [r], communities: [r], profiles: [r] }));
}, R);
await page.reload();
await page.waitForSelector('.mc');
check('Start: Materialkarten', (await page.locator('.mc').count()) === 3);
await page.waitForSelector('.panel .ev');
check('Start: Termine', (await page.locator('.panel .ev').count()) === 2);
check('Start: Gruppen', (await page.locator('.glist a').count()) >= 1);
await page.waitForTimeout(400);
await shot('01-start');

// Materialsuche (NIP-50 am Relay)
await page.goto(relay.http + '#/materialien?q=Psalm');
await page.waitForSelector('.mc');
check('Suche NIP-50', (await page.locator('.mc').count()) === 1 && (await page.locator('.mode').textContent()).includes('NIP-50'));
await page.goto(relay.http + '#/materialien');
await page.waitForSelector('.mc');
await page.locator('button.chip', { hasText: 'Primarstufe' }).click();
check('Facette Bildungsstufe', (await page.locator('.mc').count()) === 2);
await page.locator('button.chip', { hasText: 'Primarstufe' }).click();
await shot('02-materialien');
await page.locator('.mc', { hasText: 'Psalm 23' }).click();
await page.waitForSelector('.dtitle');
const facts = await page.locator('.meta').first().textContent();
check('Materialdetail Steckbrief', facts.includes('Sekundarstufe I') && facts.includes('CC BY 4.0') && facts.includes('Psalmen'));
await shot('03-material-detail');

// Gruppen
await page.goto(relay.http + '#/gruppen');
await page.waitForSelector('.gcard');
check('Gruppenliste + Community', (await page.locator('.gcard').count()) === 2);
await shot('04-gruppen');

// Anmelden per NIP-07 (Test-Erweiterung) und posten
await page.exposeFunction('__testSign', (tpl) => finalizeEvent(tpl, keys.me));
await page.addInitScript((pubkey) => {
  window.nostr = { getPublicKey: async () => pubkey, signEvent: async (e) => window.__testSign(e) };
}, pk('me'));
await page.goto(relay.http + '#/anmelden');
await page.reload();
await page.locator('.opt', { hasText: 'NIP-07' }).locator('button').click();
await page.waitForSelector('.phead h1');
await page.waitForFunction(() => document.querySelector('.phead h1')?.textContent?.includes('Ich (Test)'), null, { timeout: 8000 }).catch(() => {});
check('Login NIP-07 + Profil kind 0', (await page.locator('.phead h1').textContent()).includes('Ich (Test)'));
await shot('05-profil');

await page.goto(relay.http + '#/gruppe/werkstatt?r=' + encodeURIComponent(R));
await page.waitForSelector('.chat .msg');
check('Gruppe: Nachrichten kind 9/11', (await page.locator('.chat .msg').count()) === 1 && (await page.locator('.post').count()) === 1);
await page.fill('#post-text', 'Testnachricht aus dem Hub');
await page.click('.composer button[type=submit]');
await page.waitForSelector('.outcome');
const posted = relay.received.find((e) => e.kind === 9 && e.content === 'Testnachricht aus dem Hub');
check('Posten mit h-Tag', !!posted && posted.tags.some((t) => t[0] === 'h' && t[1] === 'werkstatt'), await page.locator('.outcome').textContent());
await page.waitForFunction(() => document.querySelectorAll('.chat .msg').length === 2, null, { timeout: 8000 }).catch(() => {});
check('Eigene Nachricht erscheint', (await page.locator('.chat .msg').count()) === 2);
await shot('06-gruppe');

// Community (Communikey)
await page.goto(relay.http + '#/gruppen');
await page.locator('.gcard', { hasText: 'Test-Community' }).click();
await page.waitForSelector('.sections li');
check('Communikey 10222: Inhaltsbereiche', (await page.locator('.sections li').count()) === 2 && (await page.locator('.chead .tag.soft').textContent()) === 'Moderiert');
await shot('07-community');

// Termine
await page.goto(relay.http + '#/termine');
await page.waitForSelector('.evrow');
const titles = await page.locator('.evrow .t').allTextContents();
check('Termine chronologisch, kommende zuerst', titles.length === 2 && titles[0].includes('LiaScript') && titles[1].includes('Fachtag'), titles.join(' | '));
await page.getByRole('button', { name: /Vergangene Termine anzeigen/ }).click();
check('Vergangene Termine', (await page.locator('.past .evrow').count()) === 1);
await shot('08-termine');
await page.locator('.evrow').first().click();
await page.waitForSelector('.evhead');
await shot('09-termin-detail');

// Einstellungen
await page.goto(relay.http + '#/einstellungen');
await page.getByRole('button', { name: 'Jetzt prüfen' }).click();
await page.waitForSelector('.relays li[data-state="open"]');
check('Relay-Status sichtbar', (await page.locator('.relays li[data-state="open"]').count()) >= 1);
await shot('10-einstellungen');

// Abmelden
await page.goto(relay.http + '#/profil');
await page.getByRole('button', { name: 'Abmelden' }).click();
await page.waitForSelector('.hello');
check('Logout', (await page.locator('.top a.btn', { hasText: 'Anmelden' }).count()) === 1);

// Mobil
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(relay.http + '#/');
await page.waitForSelector('.mc');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('Mobil ohne horizontales Scrollen', !overflow);
await shot('11-start-mobil');
await page.setViewportSize({ width: 1280, height: 900 });

// Demo-Modus
await page.evaluate(() => localStorage.setItem('edufeed-hub:demo', '1'));
await page.goto(relay.http + '#/');
await page.reload();
await page.waitForSelector('.demo-banner');
await page.waitForSelector('.mc');
check('Demo-Modus mit Banner', (await page.locator('.mc').count()) === 6);
await shot('12-start-demo');
await page.goto(relay.http + '#/gruppe/oer-werkstatt-ru?r=wss%3A%2F%2Fgroups.edufeed.org');
await page.waitForSelector('.post');
await shot('13-gruppe-demo');

// Leerer Relay-Zustand bei Demo aus
await page.evaluate(() => localStorage.removeItem('edufeed-hub:demo'));

const appErrors = consoleErrors.filter((e) => !/WebSocket connection|ERR_|net::|Failed to load resource/i.test(e));
check('Keine App-Konsolenfehler (Test-Relay)', appErrors.length === 0, appErrors.join(' | '));
console.log('\nBrowser-Konsolenmeldungen mit Standard-Relays (erwartet: Netzwerkfehler):');
for (const e of [...new Set(errorsDefault)].slice(0, 12)) console.log('  ' + e.slice(0, 160));

await browser.close();
await relay.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
