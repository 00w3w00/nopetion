<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Seus documentos, no seu próprio servidor.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

Um espaço pessoal baseado no Docmost, com editor de blocos, páginas aninhadas, IA para documentos e anexos locais.

## Recursos

- Escreva com blocos, tabelas, código e visualizações de banco de dados da edição comunitária.
- Organize páginas aninhadas e espaços pessoais independentes; restaure a lixeira e o histórico.
- Seletor completo de emojis e 96 ícones de página sugeridos.
- Exporte a página atual com as subpáginas escolhidas em um PDF com fontes coreanas.
- Instale a PWA e ative a edição offline nas páginas escolhidas; sincronize ao reconectar.
- Gere etiquetas e listas de classificação sem mover os documentos.
- Conecte a IA separadamente e acompanhe tarefas no painel de IA do documento.

## Primeiros passos

Prepare Docker Compose e Node.js 24; o guia também oferece a configuração por contêiner. Gere novos segredos, ajuste APP_URL no .env para o endereço real e inicie o aplicativo.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Na primeira execução, digite a mesma senha nos dois campos para criar a conta proprietária. Depois, basta a senha. Valores vazios são rejeitados; um caractere é permitido, sem limite específico de quantidade de caracteres.

[Server installation guide](../server-install.md)

## Configurações no aplicativo

Configurações → Recursos do servidor gerencia Draw.io, processamento PDF/A opcional com Gotenberg e os sites autorizados a mostrar Nopetion em um frame. Salvar exige a sessão do proprietário. Os anexos ficam no armazenamento local. O envio de emails e a recuperação de senha por email foram removidos.

## Transferir para outro servidor

O pacote privado inclui código e avisos de licença. Não inclui .env reais, contas, documentos, anexos, backups nem o histórico Git. Gere novos segredos no destino.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Desenvolvimento

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## Licença e status

Derivado do Docmost 0.96.0. O núcleo usa AGPL-3.0 e mantém os avisos originais e de terceiros. As áreas Enterprise têm termos separados; as implementações comerciais removidas não são habilitadas. Não considere toda a árvore histórica como AGPL. As verificações para distribuição pública continuam pendentes; o pacote é destinado a testes em servidor pessoal.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
