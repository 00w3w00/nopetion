<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Vos documents, sur votre propre serveur.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Un espace personnel dérivé de Docmost, avec éditeur par blocs, pages imbriquées, IA documentaire et pièces jointes locales.

## Fonctionnalités

- Rédiger avec des blocs, tableaux, code et vues de bases de données communautaires.
- Organiser des pages imbriquées et des espaces personnels indépendants ; restaurer la corbeille et l’historique.
- Sélecteur complet d’émojis et 96 icônes de page suggérées.
- Exporter la page actuelle avec les sous-pages choisies dans un PDF incluant les polices coréennes.
- Installer la PWA et activer l’édition hors ligne pour les pages choisies ; synchroniser à la reconnexion.
- Créer automatiquement des étiquettes et listes sans déplacer les documents.
- Connecter l’IA séparément et suivre les tâches dans le panneau IA du document.

## Démarrage

Préparez Docker Compose et Node.js 24 ; le guide propose aussi une initialisation par conteneur. Générez de nouveaux secrets, renseignez l’adresse réelle dans APP_URL du fichier .env, puis démarrez.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Au premier démarrage, saisissez le même mot de passe dans les deux champs pour créer le compte propriétaire. Ensuite, seul le mot de passe est nécessaire. Les valeurs vides sont refusées ; un caractère est accepté, sans plafond spécifique de caractères.

[Server installation guide](../server-install.md)

## Réglages dans l’application

Réglages → Fonctions du serveur permet de gérer Draw.io, le traitement PDF/A facultatif par Gotenberg et les sites autorisés à afficher Nopetion dans un cadre. L’enregistrement exige la session du propriétaire. Les pièces jointes restent locales. L’envoi de courriels et la récupération de mot de passe par courriel sont supprimés.

## Transfert vers un autre serveur

Le paquet privé contient le code et les mentions de licence. Les vrais fichiers .env, comptes, documents, pièces jointes, sauvegardes et l’historique Git sont exclus. Générez de nouveaux secrets sur la destination.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Développement

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Licence et état du projet

Dérivé de Docmost 0.96.0. Le cœur est sous AGPL-3.0 ; les mentions originales et celles des tiers sont conservées. Les chemins Enterprise ont des conditions distinctes ; les implémentations commerciales retirées ne sont pas activées. L’arborescence historique entière ne doit pas être assimilée à de l’AGPL. Les vérifications de distribution publique restent ouvertes ; ce paquet est destiné aux essais sur un serveur personnel.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
