<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>내 문서를 내 서버에서. 나에게 맞춘 개인용 워크스페이스.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

블록으로 기록하고, 페이지로 정리하고, 필요한 문서만 AI와 연결하세요. Nopetion은 Docmost를 기반으로 개인 사용 흐름을 다듬은 자가 호스팅 문서 앱입니다.

## 한눈에 보기

| 기능              | 할 수 있는 일                                                 |
| :---------------- | :------------------------------------------------------------ |
| ✍️ 문서 편집      | 블록·표·코드·콜아웃과 커뮤니티 데이터베이스 보기              |
| 🗂️ 내 문서 구조   | 하위 페이지, 끌어서 정렬, 독립된 개인 워크스페이스            |
| 💾 저장과 복원    | DB 저장 확인, 변경 이력, 휴지통 복원                          |
| 😀 페이지 아이콘  | 전체 이모지 선택기, 추천 아이콘 96개, 주요 아이콘 한국어 검색 |
| 🤖 문서 AI        | 별도 계정 연결, 서버 작업 실행, 문서 AI 패널의 진행·결과 확인 |
| 📑 PDF            | 현재 문서와 선택한 하위 문서를 합쳐 내보내기, 한국어 폰트     |
| 📱 PWA·오프라인   | 선택한 문서를 기기에 보관하고 편집한 뒤 재연결 시 동기화      |
| 🏷️ 자동 분류      | 문서 위치를 유지하며 분류 태그와 목록 생성                    |
| 🔧 서버 기능 설정 | 앱에서 Draw.io·Gotenberg·iframe 허용 사이트 관리              |

## 빠르게 시작하기

**Docker Compose**와 **Node.js 24**를 준비합니다. Node.js 없이 초기 설정하는 방법은 [서버 설치 안내](../server-install.md)에 있습니다.

```sh
node scripts/init-env.mjs
```

생성된 `.env`의 `APP_URL`을 실제 접속 주소로 정한 뒤 실행합니다. `.env`의 앱 secret과 DB 비밀번호는 자동 생성되는 서버용 값입니다.

```sh
docker compose up --build -d
```

처음 접속하면 **비밀번호 + 비밀번호 확인**을 입력합니다. 두 값이 일치하면 개인 계정과 기본 워크스페이스가 만들어집니다. 이후에는 **비밀번호만으로 로그인**합니다. 1자부터 허용하고 별도의 글자 수 상한은 두지 않으며, HTTP 요청 크기와 로그인 시도 제한은 유지합니다.

기본 접속 주소는 `http://localhost:3000`입니다. 배포 Compose는 앱을 loopback에 연결하고 DB·Redis의 호스트 포트를 열지 않습니다. 원격 접속은 개인 HTTPS 프록시 또는 SSH 터널을 구성한 주소로 진행합니다. [자세한 설치·접속 방법 →](../server-install.md)

## 설정은 앱에서

**설정 → 서버 기능**에서 저장하면 재배포 없이 적용됩니다.

| 설정      | 동작                                                                  |
| :-------- | :-------------------------------------------------------------------- |
| Draw.io   | 기본 편집기 또는 직접 운영하는 편집기 주소                            |
| Gotenberg | 선택 기능. 주소를 설정하면 생성된 PDF를 해당 서버에서 PDF/A-2b로 처리 |
| iframe    | 다른 사이트에서 Nopetion을 표시하도록 허용할 출처 목록                |

Gotenberg 주소를 비워두면 내장 PDF를 사용합니다. 서버 기능 저장은 개인 소유자 세션만 허용하며, 문서와 첨부 접근 권한은 계속 적용됩니다. OAuth 승인 화면은 항상 iframe을 차단합니다.

이름·비밀번호·테마는 프로필과 내 설정에서 관리합니다. 문서 AI와 외부 문서 서비스는 각 연결 화면에서 별도로 로그인합니다. 받은편지함과 프로필의 복구 이메일 항목은 제거했으며, AI 상태는 문서 AI 패널에서 확인합니다. 메일 전송과 이메일 비밀번호 복구는 제공하지 않습니다.

## 데이터와 서버 이동

첨부파일은 **로컬 영구 저장소**를 사용합니다. PostgreSQL·Redis·첨부·AI·외부 연결 설정은 각각 운영 볼륨에 보존됩니다. [백업·복원 안내](../backup-restore.md)에서 일관된 암호화 백업과 격리 복원 검증을 다룹니다.

`scp`로 옮길 개인 서버용 소스 묶음은 코드와 라이선스 고지를 포함합니다. 실제 `.env`, 계정·문서·첨부·백업과 Git 이력은 포함하지 않습니다. 새 서버에서 비밀값을 새로 생성해 시작합니다. [설치 묶음과 서버 실행 →](../server-install.md)

## 개발

React/Mantine 클라이언트와 NestJS 서버를 하나의 pnpm/Nx 모노레포로 관리합니다.

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
node scripts/init-env.mjs
docker compose -f docker-compose.dev.yml up -d
pnpm --filter server migration:latest
pnpm dev
```

| 위치                  | 역할                                          |
| :-------------------- | :-------------------------------------------- |
| `apps/client`         | 문서 편집기와 개인용 UI                       |
| `apps/server`         | 인증·문서·첨부·AI·PDF API                     |
| `packages/editor-ext` | 공유 편집기 확장과 커뮤니티 데이터베이스 기능 |
| `scripts`             | 환경 초기화·백업·복원·설치 묶음 도구          |

빌드와 검사는 `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:personal`을 사용합니다. 개발 도구는 Node.js **24**, pnpm **11.28.2**로 고정합니다. [개발 환경과 운영 설정](../server-install.md)

## 출처와 라이선스

Nopetion은 [Docmost 0.96.0](https://github.com/docmost/docmost)을 기반으로 수정한 개인용 포크입니다. 원본 README·기여자 감사는 [원본 문서](../upstream-readme.md), 시작 commit은 [출처 기록](../upstream-source.json)에 보존합니다.

코어에는 [AGPL-3.0](../../LICENSE)이 적용됩니다. 원본 저작권·면책·제3자 고지를 유지하며 수정 내역과 날짜는 [변경 고지](../../notices/NOPETION-MODIFICATIONS.md)에 기록합니다. Enterprise 경로는 별도 조건이며 제거한 상용 구현을 활성화하거나 새 기능에 재사용하지 않습니다. 체크아웃 전체를 AGPL로 간주하지 않습니다. [고지 모음](../../notices)

**현재는 개인 서버 테스트 단계입니다.** 공개 배포 전 라이선스 경계·제3자 고지·보안 검토의 잔여 항목을 완료해야 합니다. 설치 묶음 준비가 공개 배포 승인이나 감사 완료를 뜻하지 않습니다.
