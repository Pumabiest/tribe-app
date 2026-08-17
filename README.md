# TRIBE — Dating-App nach Style/Subkultur

Statt nur Mann/Frau/Divers matcht TRIBE über frei wählbare Kategorien in drei
Gruppen:

- **Geschlecht/Identität** (22 Optionen: Frau, Mann, Trans Frau, Trans Mann,
  Nicht-binär, Genderqueer, Genderfluid, Agender, Bigender, Pangender,
  Demigender, Androgyn, Two-Spirit, Intersex, Cross-Dresser, Drag Queen,
  Drag King, Femme, Butch, Femboy, Tomboy, u.a.)
- **Sexuelle Orientierung** (9 Optionen: Hetero, Homo, Lesbisch, Bi, Pan,
  Asexuell, Demisexuell, Queer, u.a.)
- **Style/Szene** (Emo, Gothic, Punk, Scene, Grunge, Metalhead, Cyberpunk,
  Techwear, E-Boy, E-Girl, Soft Boy)

Jede:r wählt beim Anmelden zwei Dinge aus:
- **Wie ich mich präsentiere** (Identity-Tags, mehrere möglich)
- **Wonach ich suche** (Seeking-Tags, mehrere möglich). Es gibt einen
  "🌈 Alle Geschlechter / alles gemixt"-Button, der die Gender-/
  Orientierungs-Filter komplett löscht, wenn man nicht gezielt nach
  bestimmten Geschlechtern suchen will.

Beim Swipen sieht man nur Profile, deren Identity-Tags zur eigenen Suche
passen — und umgekehrt (man wird selbst nur Leuten gezeigt, deren Suche zur
eigenen Präsentation passt, sofern die andere Person Tags ausgewählt hat).
Zusätzlich gibt es einen **Altersfilter** (von-bis, gegenseitig: man sieht
nur Leute im eigenen Wunschbereich, und wird selbst nur Leuten gezeigt, in
deren Wunschbereich man fällt) sowie ein freies **Standort-Feld**
(Stadt/Region/Land), das auf dem Profil und den Swipe-Karten angezeigt wird.

## Funktionen

- Registrierung/Login (18+, Altersprüfung)
- Profil mit Foto, Bio, Standort, Identity- und Seeking-Tags, Altersfilter
- Swipe-Deck (Wischen per Touch/Maus oder Buttons) mit Match-Erkennung
- Match-Liste + Chat zwischen gematchten Personen
- **TRIBE Premium**: 4,99 €/Monat, werbefrei (deutlich günstiger als z. B.
  Tinder Plus, das meist ~9,99 €/Monat kostet)
- **Werbung** für Nicht-Premium-Nutzer:innen: dezente Anzeigenkarten alle 6
  Profile im Swipe-Deck (keine Vollbild-Unterbrechung, keine Werbung im Chat)

- Suchleiste in "Matches", um ein Match nach Namen zu finden
- Swipe rückgängig machen ("↺"-Button, solange daraus noch kein Match
  entstanden ist)
- Support: Nutzer:innen können im Profil ein Ticket schreiben, du siehst und
  beantwortest es in `/admin.html`
- **Echte Zahlungen über Stripe** (Premium-Abo + Firmen können Werbung
  buchen und bezahlen) — siehe Abschnitt unten

### Echte Zahlungen einrichten (Stripe)

Solange keine Stripe-Zugangsdaten hinterlegt sind, läuft die App automatisch
im **Demo-Modus**: "Premium kaufen" schaltet sofort frei, ohne dass echtes
Geld fließt. Das ist praktisch zum Testen, aber für einen echten Start
brauchst du ein Stripe-Konto. So richtest du es ein:

1. Geh auf **stripe.com** und leg ein Konto an (Name, Bankverbindung für
   Auszahlungen, Identitätsnachweis — Stripe führt dich durch).
2. Im Stripe-Dashboard, oben rechts: wechsle testweise auf **"Testmodus"**
   um erstmal ohne echte Karten zu testen. Später für den echten Betrieb auf
   "Live-Modus" umschalten.
3. Unter **Entwickler → API-Schlüssel**: den **Geheimen Schlüssel**
   (beginnt mit `sk_test_...` bzw. später `sk_live_...`) kopieren.
4. Kopiere `backend/.env.example` zu `backend/.env` und trag den Schlüssel
   bei `STRIPE_SECRET_KEY` ein.
5. Trag bei `APP_URL` die Adresse ein, unter der die App erreichbar ist
   (lokal: `http://localhost:4000`; live: deine echte Domain mit `https://`).
6. Server mit den echten Werten starten: `npm run start:live` (statt
   `npm start`) im `backend`-Ordner.
7. Für die Webhooks (damit Stripe der App Bescheid gibt, wenn wirklich
   bezahlt wurde): im Stripe-Dashboard unter **Entwickler → Webhooks** einen
   Endpunkt anlegen, Ziel-URL `<deine-app-url>/api/webhooks/stripe`, und
   diese Events abonnieren: `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.deleted`. Den dabei angezeigten **Signing Secret**
   (beginnt mit `whsec_...`) in `.env` bei `STRIPE_WEBHOOK_SECRET` eintragen.
   Wichtig: Webhooks brauchen eine öffentlich erreichbare URL — solange die
   App nur lokal läuft, kannst du dafür testweise die Stripe-CLI
   (`stripe listen --forward-to localhost:4000/api/webhooks/stripe`) nutzen.
8. Fertig — "Upgraden" im Profil öffnet jetzt eine echte Stripe-Checkout-Seite,
   "Kündigen" öffnet Stripes Kundenportal (dort verwalten Nutzer:innen ihr
   Abo selbst, inkl. Rechnungen).

Firmen können unter `/advertise.html` eine Werbeanzeige buchen und bezahlen
(Standardpreis 49 €/14 Tage, änderbar über `AD_PRICE_EUR`/`AD_DURATION_DAYS`
in `.env`). Jede gekaufte Anzeige geht erst nach deiner Freigabe in
`/admin.html` live — so kannst du unpassende Inhalte rausfiltern, bevor sie
echte Nutzer:innen sehen.

### Admin-Bereich

Erreichbar unter `/admin.html`. Zeigt Support-Tickets (beantworten,
schließen) und gebuchte Werbeanzeigen (freigeben/ablehnen). Geschützt durch
einen Admin-Schlüssel: setz `ADMIN_KEY` in `.env` für einen festen Schlüssel,
sonst wird bei jedem Serverstart ein neuer zufälliger im Terminal angezeigt.

## Starten

Voraussetzung: **Node.js 22.5 oder neuer** (wegen der eingebauten SQLite-Unterstützung).
Prüfen mit: `node -v`

Keine weitere Installation nötig — kein `npm install`, keine externen
Pakete. Nur eingebaute Node-Module.

```
cd backend
node server.js
```

Dann im Browser öffnen: **http://localhost:4000**

Zum Testen: Öffne die Seite in zwei verschiedenen Browserfenstern (oder einem
normalen + einem Inkognito-Fenster) und registriere zwei Accounts mit
überschneidenden Tags, um ein Match zu erzeugen.

Zum Beenden: im Terminal `Strg + C`.

## Struktur

```
dating-app/
  backend/
    server.js     App-Server: API + liefert das Frontend aus
    db.js         Datenbank-Schema + Kategorien (SQLite, Datei dating.db)
    uploads/       hochgeladene Profilfotos
  frontend/
    index.html
    style.css
    app.js         gesamte Frontend-Logik (kein Build-Schritt nötig)
```

Die Datenbank-Datei `backend/dating.db` wird beim ersten Start automatisch
angelegt. Zum Zurücksetzen aller Daten einfach diese Datei löschen.

## Wichtig, bevor das live geht

Das hier ist eine voll funktionsfähige App für den lokalen Betrieb bzw. zum
Testen. Für einen echten Launch mit echten Nutzer:innen kommen noch ein paar
Dinge dazu, die hier bewusst nicht enthalten sind:

- Hosting auf einem echten Server mit eigener Domain und HTTPS (aktuell läuft
  es nur lokal auf deinem Rechner)
- Altersverifikation über reine Selbstauskunft hinaus
- Melde-/Blockier-Funktion und Inhaltsmoderation (Pflicht für App Stores)
- E-Mail-Verifikation, Passwort-zurücksetzen
- Native Apps für Play Store / App Store (aktuell eine Web-App)

Sag Bescheid, wenn du bei einem dieser Punkte weitermachen willst.
