<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>自分の文書を、自分のサーバーで。</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Docmost を基にした個人用ワークスペース。ブロック編集、階層ページ、文書 AI、ローカル添付ファイルをまとめて使えます。

## 主な機能

- ブロック、表、コード、コミュニティ版のデータベース表示で文書を作成。
- 階層ページと独立した個人用ワークスペース。ごみ箱と変更履歴から復元。
- 全絵文字の選択と、ページ向けおすすめアイコン 96 個。
- 現在のページと選択した子ページを、韓国語フォント付きの PDF に出力。
- PWA のインストールと、選択したページのオフライン編集・再接続時の同期。
- 文書の場所を変えずに分類タグと一覧を自動生成。
- 文書 AI を別途接続し、文書の AI パネルでジョブの状態を確認。

## はじめに

Docker Compose と Node.js 24 を用意します。インストールガイドにはコンテナで初期設定する方法もあります。新しい秘密値を生成し、.env の APP_URL を実際の接続先に設定して起動してください。

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

初回画面でパスワードと確認欄に同じ値を入力すると、個人所有者アカウントが作成されます。以後はパスワードだけでログインします。空欄は不可、1 文字から入力でき、文字数の個別上限はありません。

[Server installation guide](../server-install.md)

## アプリ内の設定

設定 → サーバー機能で Draw.io、任意の Gotenberg PDF/A 処理、Nopetion のフレーム表示を許可するサイトを管理します。保存には所有者のセッションが必要です。添付はローカル保存です。メール送信とメールによるパスワード復旧は削除しました。

## 別のサーバーへ移す

個人サーバー用ソースにはコードとライセンス表示が含まれます。実際の .env、アカウント、文書、添付、バックアップ、Git 履歴は含みません。移行先で秘密値を新規生成してください。

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## 開発

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## ライセンスと状態

Docmost 0.96.0 を基にしています。コアは AGPL-3.0 で、元の著作権表示と第三者の表示を保持します。Enterprise 領域は別条件です。商用実装は除去済みで、有効化しません。過去のツリー全体を AGPL と扱わないでください。公開配布の確認事項が残っており、このパッケージは個人サーバーでのテスト用です。

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
