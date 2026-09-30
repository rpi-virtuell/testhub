# Edufeed Community-Hub (MVP)

Ein schlanker Web-Client für das offene Edufeed-Netz auf Nostr. Er bündelt an einem Ort:

- **Lernmaterialien** mit AMB-Metadaten (kind `30142`) vom AMB-Relay, mit Volltextsuche
- **Gruppen** nach NIP-29 (kind `39000` ff., Nachrichten kind `9`/`11`) und **Communities** nach Communikey (kind `10222`)
- **Termine** nach NIP-52 (kind `31922`/`31923`), z. B. aus WordPress über `wp-to-nostr`

Der Hub speichert keine Inhalte selbst. Er liest und schreibt direkt aus dem Browser per WebSocket auf die konfigurierten Relays. Signiert wird immer beim Menschen: in einer Browser-Erweiterung (NIP-07) oder einem Remote-Signer (NIP-46).

Grundlage ist das Konzept »Edufeed Community-Hub« (Entwurf 0.1, Comenius-Institut / rpi-virtuell). Farben und Schriften folgen dem rpi-Theme der edufeed-app (RPI-Blau `#203A8F`, Orange `#FFA500`, Literata und Atkinson Hyperlegible).

## Start

Voraussetzung: Node.js 20 oder neuer.

```bash
npm i          # Abhängigkeiten installieren
npm run dev    # Entwicklungsserver auf http://localhost:5173
npm run build  # Typprüfung + alle Build-Varianten
```

`npm run build` erzeugt drei Ausgaben:

| Ordner | Inhalt | Zweck |
| --- | --- | --- |
| `dist/` | `index.html` + `assets/` | GitHub Pages oder beliebiges statisches Hosting |
| `dist-single/index.html` | eine eigenständige HTML-Datei (JS und CSS eingebettet) | zum Weitergeben, Öffnen ohne Server |
| `dist-artifact/edufeed-hub.html` | dieselbe Datei ohne `<html>`/`<head>`-Gerüst | für Claude-Artifacts |

Einzelne Varianten: `npm run build:pages`, `npm run build:single`. Nur Typprüfung: `npm run typecheck`.

### Tests

```bash
npm run build
npm run test:e2e   # Playwright (Chromium) gegen einen lokalen Test-Relay, Screenshots in test-results/
```

Der Test startet einen kleinen Nostr-Relay (`tests/mock-relay.mjs`) mit signierten Testdaten und prüft Start, Suche (NIP-50), Materialdetail, Gruppen, Posten mit `h`-Tag, Communikey, Termine, Einstellungen, Login/Logout (NIP-07) und die mobile Ansicht.

## Deployment auf GitHub Pages

1. Projekt in ein GitHub-Repository pushen (Branch `main`).
2. Im Repository unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** wählen.
3. Der Workflow `.github/workflows/pages.yml` baut bei jedem Push auf `main` und veröffentlicht `dist/`.

Die App nutzt Hash-Routing (`#/materialien`, `#/gruppe/<id>`) und relative Pfade (`base: './'`). Sie läuft deshalb auch in Unterverzeichnissen wie `https://<name>.github.io/<repo>/` ohne weitere Konfiguration.

## Relay-Konfiguration

Unter **Einstellungen** (Zahnrad oben rechts, `#/einstellungen`) lassen sich die Relays je Bereich bearbeiten, eine Adresse pro Zeile. Die Einstellung liegt im `localStorage` des Browsers. Dort ist auch der Verbindungsstatus jedes Relays sichtbar (inklusive NIP-11-Angaben, soweit abrufbar).

Standardwerte (`src/config.ts`):

| Bereich | Relays |
| --- | --- |
| Lernmaterialien (30142) | `wss://amb-relay.edufeed.org` |
| Gruppen (NIP-29) | `wss://groups.edufeed.org` |
| Termine (31922/31923) | `wss://relay-rpi.edufeed.org`, `wss://relay.edufeed.org`, `wss://amb-relay.edufeed.org` |
| Communities (10222) | `wss://relay-rpi.edufeed.org` |
| Profile (kind 0) | `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, `wss://purplepag.es` |

Die Auswahl folgt der `.env.example` der edufeed-app und dem Workflow von `wp-to-nostr`.

**Suche:** Der AMB-Relay (khatru + Typesense) beantwortet NIP-50-Anfragen (`{"kinds":[30142],"search":"…"}`). Der Hub fragt NIP-11 ab; meldet ein Relay kein NIP-50 oder lehnt es die Suche ab, lädt der Hub die neuesten Materialien und filtert im Browser. Welcher Weg genutzt wurde, steht über der Trefferliste. Facetten (Bildungsstufe, Ressourcentyp, Lizenz) werden im Browser aus den Treffern gebildet.

**Demo-Daten:** In den Einstellungen gibt es einen Schalter »Demo-Daten anzeigen« (Standard: aus). Er ersetzt alle Abfragen durch erfundene, deutlich gekennzeichnete Beispielinhalte, damit die Oberfläche auch ohne Relay-Verbindung vorführbar ist. Im Demo-Modus wird nichts gesendet.

## Anmeldung

- **Ohne Konto:** alles lesbar (Lesemodus).
- **Browser-Erweiterung (NIP-07):** z. B. Alby, nos2x, Keys.band.
- **Remote-Signer / Bunker (NIP-46):** `bunker://…`-Adresse oder NIP-05-Adresse eines Bunkers (nostr-tools `BunkerSigner`). Die Sitzung wird im Browser gespeichert (Client-Schlüssel der Bunker-Verbindung, nicht Ihr privater Schlüssel).
- **Mit Google fortfahren:** Platzhalter, »demnächst« (in der edufeed-app über den Pomegranate-FROST-Signer gelöst).

Nach der Anmeldung zeigt der Hub das Profil (kind 0) und erlaubt Beiträge in NIP-29-Gruppen (kind 9 Chat, kind 11 Thema, jeweils mit `h`-Tag) sowie Beitrittsanfragen (kind 9021). Ob ein Beitrag angenommen wird, entscheidet der Gruppen-Relay; die Antwort wird angezeigt.

## Aufbau

```
src/
  config.ts          Relay-Standardwerte, localStorage
  nostr/pool.ts      Relay-Verbindungen, Status, Abfragen, Veröffentlichen
  nostr/parse.ts     Parser für 30142 (NIP-AMB), 31922/31923, 39000, 9/11, 10222, kind 0
  nostr/auth.ts      NIP-07 und NIP-46
  data.ts            Datenzugriff der Ansichten, Demo-Umschaltung
  demo.ts            Demo-Daten (nur mit Schalter)
  views/             Start, Materialien, Gruppen, Termine, Einstellungen, Anmeldung/Konto
tests/               Playwright-Test und lokaler Test-Relay
```

## Was der MVP kann und was offen ist

**Enthalten:** Start-Dashboard (neue Materialien, nächste Termine, Gruppen, Communities); Materialfeed, Suche (NIP-50 mit lokalem Fallback), Facettenfilter, Detailansicht mit Steckbrief, Lizenz, Link, Namensnennung und technischer Ansicht; NIP-29-Gruppenliste und -ansicht mit Nachrichten, Posten und Beitrittsanfrage; Communikey-Communities mit Typ (offen/moderiert/geschlossen), Inhaltsbereichen und Beiträgen per `h`-Tag; Termine chronologisch mit Monatsübersicht und Schlagwortfilter; Relay-Einstellungen mit Status; Login per NIP-07/NIP-46, Profil, Logout; helles und dunkles Farbschema; mobile Navigation.

**Offen (nächste Schritte laut Konzept):**

- Material teilen (Formular für 30142, NIP-101-Vorlagen, Upload über Blossom)
- Kommentare (NIP-22) und Reaktionen (NIP-25) am Material
- Google-Login (FROST-Signer), neues Konto mit Passwort (NIP-49)
- Kuratierte Ansicht / Web of Trust, Stummwörter, Meldungen (NIP-56), Qualitätssiegel (NIP-32)
- Zusagen zu Terminen (31925), Kalender-Abo (webcal), Sammlungen (NIP-51)
- Vokabulare (SKOS, kind 39737) für Facetten mit festen URIs statt Freitext-Labels
- NIP-42-Anmeldung wird automatisch beantwortet, private NIP-29-Gruppen sind aber nicht gezielt getestet
