<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>自己的文档，自己的服务器。</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

基于 Docmost 的个人文档工作区，提供块编辑、嵌套页面、文档 AI 和本地附件。

## 主要功能

- 使用内容块、表格、代码和社区版数据库视图编写文档。
- 管理嵌套页面与独立个人工作区，支持回收站和历史恢复。
- 完整表情选择器，以及 96 个推荐页面图标。
- 将当前页面与选定子页面合并导出为 PDF，内置韩文字体。
- 安装 PWA，按需为选定页面启用离线编辑，重连后同步。
- 自动生成分类标签和列表，保持文档原有位置。
- 单独连接文档 AI，在文档 AI 面板查看任务状态。

## 开始使用

准备 Docker Compose 和 Node.js 24；安装指南也提供容器初始化方式。生成新的基础设施密钥，将 .env 中的 APP_URL 设为实际访问地址，再启动应用。

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

首次打开时，在密码和确认密码中输入相同内容，即可创建个人所有者账户。以后仅用密码登录。密码不能为空，允许 1 个字符，不另设字符数量上限。

[Server installation guide](../server-install.md)

## 在应用中设置

设置 → 服务器功能可管理 Draw.io、可选的 Gotenberg PDF/A 处理，以及允许通过框架显示 Nopetion 的站点。保存需要所有者会话。附件使用本地存储。邮件发送与邮件密码找回功能已移除。

## 转移到其他服务器

个人服务器源码包包含代码与许可证声明，不包含真实 .env、账户、文档、附件、备份或 Git 历史。请在目标服务器生成新的密钥。

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## 开发

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## 许可与项目状态

本项目源自 Docmost 0.96.0。核心采用 AGPL-3.0，并保留原有版权及第三方声明。Enterprise 路径适用单独条款，商业实现已移除，不会被启用。请勿将整个历史源码树视为 AGPL。公开分发审核尚未完成；此包用于个人服务器测试。

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
