<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>I tuoi documenti, sul tuo server.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Uno spazio personale basato su Docmost, con editor a blocchi, pagine annidate, IA per documenti e allegati locali.

## Funzionalità

- Scrivi con blocchi, tabelle, codice e viste di database della versione comunitaria.
- Organizza pagine annidate e spazi personali indipendenti; ripristina cestino e cronologia.
- Selettore completo di emoji e 96 icone di pagina suggerite.
- Esporta la pagina attuale e le sottopagine scelte in un PDF con caratteri coreani.
- Installa la PWA e attiva la modifica offline delle pagine selezionate; sincronizza alla riconnessione.
- Genera etichette e liste di classificazione senza spostare i documenti.
- Collega separatamente l’IA e segui le attività nel pannello IA del documento.

## Per iniziare

Prepara Docker Compose e Node.js 24; la guida offre anche la configurazione tramite contenitore. Genera nuovi segreti, imposta APP_URL nel file .env sull’indirizzo effettivo e avvia.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Al primo avvio inserisci la stessa password nei due campi per creare il proprietario. In seguito basta la password. I valori vuoti sono rifiutati; è ammesso un carattere, senza un limite specifico al numero di caratteri.

[Server installation guide](../server-install.md)

## Impostazioni nell’app

Impostazioni → Funzioni del server gestisce Draw.io, l’elaborazione PDF/A opzionale con Gotenberg e i siti autorizzati a mostrare Nopetion in un frame. Il salvataggio richiede la sessione del proprietario. Gli allegati rimangono locali. L’invio di email e il recupero password via email sono rimossi.

## Trasferimento a un altro server

Il pacchetto privato contiene codice e avvisi di licenza. Esclude i veri .env, account, documenti, allegati, backup e cronologia Git. Genera nuovi segreti sul server di destinazione.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Sviluppo

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Licenza e stato

Derivato da Docmost 0.96.0. Il nucleo usa AGPL-3.0 e conserva gli avvisi originali e di terze parti. Le aree Enterprise hanno termini separati; le implementazioni commerciali rimosse non vengono attivate. Non considerare tutto l’albero storico come AGPL. Le verifiche per la distribuzione pubblica sono ancora aperte; il pacchetto serve ai test su server personali.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
