<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Ваши документы — на вашем сервере.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Личное рабочее пространство на основе Docmost: блочный редактор, вложенные страницы, ИИ для документов и локальные вложения.

## Возможности

- Документы из блоков, таблиц и кода с представлениями баз данных общественной редакции.
- Вложенные страницы и независимые личные пространства; восстановление корзины и истории.
- Полный выбор эмодзи и 96 рекомендуемых значков страниц.
- Экспорт текущей страницы и выбранных дочерних страниц в PDF с корейскими шрифтами.
- Установка PWA и редактирование выбранных страниц офлайн с синхронизацией после подключения.
- Автоматические теги и списки классификации без перемещения документов.
- Отдельное подключение ИИ и просмотр заданий на панели ИИ документа.

## Начало работы

Подготовьте Docker Compose и Node.js 24; в руководстве есть и настройка через контейнер. Создайте новые секреты, укажите фактический адрес в APP_URL файла .env и запустите приложение.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

При первом запуске введите одинаковый пароль в оба поля, чтобы создать владельца. Далее для входа нужен только пароль. Пустые значения запрещены; допустим один символ, отдельного ограничения числа символов нет.

[Server installation guide](../server-install.md)

## Настройки в приложении

Настройки → Функции сервера управляют Draw.io, необязательной обработкой PDF/A через Gotenberg и сайтами, которым разрешено встраивать Nopetion во фрейм. Для сохранения нужна сессия владельца. Вложения хранятся локально. Отправка почты и восстановление пароля по почте удалены.

## Перенос на другой сервер

Личный пакет исходников включает код и уведомления о лицензиях. Реальные .env, учётные записи, документы, вложения, резервные копии и история Git исключены. На целевом сервере создайте новые секреты.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Разработка

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Лицензия и состояние

Основано на Docmost 0.96.0. Ядро использует AGPL-3.0; исходные уведомления об авторских правах и сторонних компонентах сохранены. Для Enterprise действуют отдельные условия; удалённые коммерческие реализации не включаются. Не считайте всё историческое дерево лицензированным по AGPL. Проверки публичного распространения ещё не завершены; пакет предназначен для тестирования на личном сервере.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
