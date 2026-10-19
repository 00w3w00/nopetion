<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Jouw documenten, op jouw eigen server.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Een persoonlijke werkplek op basis van Docmost, met blokeditor, geneste pagina’s, document-AI en lokale bijlagen.

## Mogelijkheden

- Schrijf met blokken, tabellen, code en databaseweergaven uit de community-editie.
- Orden geneste pagina’s en aparte persoonlijke werkruimten; herstel prullenbak en geschiedenis.
- Volledige emoji-kiezer en 96 voorgestelde paginapictogrammen.
- Exporteer de huidige pagina met gekozen onderliggende pagina’s als PDF, inclusief Koreaanse lettertypen.
- Installeer de PWA en schakel offline bewerken voor gekozen pagina’s in; synchroniseer na opnieuw verbinden.
- Maak automatisch classificatietags en lijsten zonder documenten te verplaatsen.
- Verbind document-AI apart en volg taken in het AI-paneel van het document.

## Aan de slag

Zorg voor Docker Compose en Node.js 24; de installatiegids beschrijft ook initialisatie met een container. Genereer nieuwe geheimen, stel APP_URL in .env in op het werkelijke adres en start de app.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Vul bij de eerste start in beide velden hetzelfde wachtwoord in om het eigenaarsaccount te maken. Daarna volstaat het wachtwoord. Lege waarden worden geweigerd; één teken is toegestaan, zonder aparte tekenlimiet.

[Server installation guide](../server-install.md)

## Instellingen in de app

Instellingen → Serverfuncties beheert Draw.io, optionele PDF/A-verwerking met Gotenberg en sites die Nopetion in een frame mogen tonen. Opslaan vereist de sessie van de eigenaar. Bijlagen worden lokaal opgeslagen. E-mailverzending en wachtwoordherstel via e-mail zijn verwijderd.

## Naar een andere server verplaatsen

Het privébronpakket bevat code en licentievermeldingen. Echte .env-bestanden, accounts, documenten, bijlagen, back-ups en Git-geschiedenis zijn uitgesloten. Genereer nieuwe geheimen op de bestemming.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Ontwikkeling

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Licentie en status

Afgeleid van Docmost 0.96.0. De kern gebruikt AGPL-3.0; oorspronkelijke auteursrecht- en derdenvermeldingen blijven behouden. Enterprise-paden hebben aparte voorwaarden; verwijderde commerciële implementaties worden niet ingeschakeld. Beschouw de hele historische boom niet als AGPL. Controles voor openbare verspreiding staan nog open; dit pakket is voor testen op een persoonlijke server.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
