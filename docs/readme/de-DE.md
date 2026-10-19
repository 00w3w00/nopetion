<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Deine Dokumente. Dein eigener Server.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Ein persönlicher, auf Docmost basierender Arbeitsbereich mit Blockeditor, verschachtelten Seiten, Dokument-KI und lokalen Anhängen.

## Funktionen

- Dokumente mit Blöcken, Tabellen, Code und Community-Datenbankansichten erstellen.
- Verschachtelte Seiten und getrennte persönliche Arbeitsbereiche; Papierkorb und Verlauf wiederherstellen.
- Vollständige Emoji-Auswahl und 96 vorgeschlagene Seitensymbole.
- Die aktuelle Seite mit ausgewählten Unterseiten als PDF exportieren, einschließlich koreanischer Schriften.
- PWA installieren und Offline-Bearbeitung ausgewählter Seiten aktivieren; bei erneuter Verbindung synchronisieren.
- Automatische Klassifikation durch Tags und Listen, ohne Dokumente zu verschieben.
- Dokument-KI separat verbinden und Aufträge im KI-Bereich der Seite verfolgen.

## Schnellstart

Docker Compose und Node.js 24 vorbereiten; die Installationsanleitung bietet auch die Einrichtung per Container. Neue Infrastruktur-Geheimnisse erzeugen, APP_URL in .env auf die tatsächliche Zugriffsadresse setzen und starten.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Beim ersten Start dasselbe Passwort in beide Felder eingeben. Dadurch entsteht das persönliche Eigentümerkonto. Später genügt das Passwort. Leere Passwörter sind ausgeschlossen; ein Zeichen ist erlaubt, ohne separate Zeichenobergrenze.

[Server installation guide](../server-install.md)

## Einstellungen in der Anwendung

Unter Einstellungen → Serverfunktionen werden Draw.io, optionale Gotenberg-Verarbeitung zu PDF/A und erlaubte Frame-Ursprünge verwaltet. Speichern erfordert die Sitzung des Eigentümers. Anhänge bleiben lokal. E-Mail-Versand und Passwortwiederherstellung per E-Mail sind entfernt.

## Auf einen anderen Server übertragen

Das private Quellpaket enthält Code und Lizenzhinweise. Echte .env-Dateien, Konten, Dokumente, Anhänge, Sicherungen und Git-Verlauf sind ausgeschlossen. Auf dem Ziel neue Geheimnisse erzeugen.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Entwicklung

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Lizenz und Projektstatus

Abgeleitet von Docmost 0.96.0. Der Kern steht unter AGPL-3.0; ursprüngliche Urheberrechts- und Dritthinweise bleiben erhalten. Enterprise-Verzeichnisse haben eigene Bedingungen; entfernte kommerzielle Implementierungen werden nicht aktiviert. Der historische Gesamtbaum ist nicht pauschal AGPL. Prüfungen zur öffentlichen Verteilung sind offen; dieses Paket dient privaten Servertests.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
