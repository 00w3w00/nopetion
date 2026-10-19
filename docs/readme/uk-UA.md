<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Ваші документи — на вашому сервері.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Особистий простір на основі Docmost: блоковий редактор, вкладені сторінки, ШІ для документів і локальні вкладення.

## Можливості

- Документи з блоків, таблиць і коду та подання баз даних спільнотної редакції.
- Вкладені сторінки й незалежні особисті простори; відновлення кошика та історії.
- Повний вибір емодзі та 96 рекомендованих значків сторінок.
- Експорт поточної сторінки й вибраних дочірніх сторінок у PDF із корейськими шрифтами.
- Встановлення PWA й офлайн-редагування вибраних сторінок із синхронізацією після підключення.
- Автоматичні теги й списки класифікації без переміщення документів.
- Окреме підключення ШІ та перегляд завдань на панелі ШІ документа.

## Початок роботи

Підготуйте Docker Compose і Node.js 24; посібник також містить налаштування через контейнер. Створіть нові секрети, задайте фактичну адресу в APP_URL файлу .env і запустіть застосунок.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Під час першого запуску введіть однаковий пароль у два поля, щоб створити власника. Надалі потрібен лише пароль. Порожні значення заборонено; дозволено один символ без окремої верхньої межі кількості символів.

[Server installation guide](../server-install.md)

## Налаштування в застосунку

Налаштування → Функції сервера керують Draw.io, необов’язковою обробкою PDF/A через Gotenberg і сайтами, яким дозволено вбудовувати Nopetion у фрейм. Збереження потребує сесії власника. Вкладення зберігаються локально. Надсилання пошти й відновлення пароля електронною поштою видалено.

## Перенесення на інший сервер

Особистий пакет вихідного коду містить код і ліцензійні повідомлення. Справжні .env, облікові записи, документи, вкладення, резервні копії та історію Git виключено. На цільовому сервері створіть нові секрети.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Розробка

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Ліцензія та стан

Походить від Docmost 0.96.0. Ядро використовує AGPL-3.0; оригінальні повідомлення про авторські права та сторонні компоненти збережено. Для Enterprise діють окремі умови; видалені комерційні реалізації не активуються. Не вважайте все історичне дерево AGPL. Перевірки публічного розповсюдження ще не завершено; пакет призначено для тестування на особистому сервері.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
