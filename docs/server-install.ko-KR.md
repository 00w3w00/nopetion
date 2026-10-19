# 개인 서버 설치와 전송

이 안내는 직접 관리하는 서버에서 Nopetion을 테스트하는 절차입니다. 앱·DB·Redis는 기존 모노레포의 Compose로 실행합니다. 실제 계정·문서·첨부·AI 연결은 설치 소스 묶음에 포함되지 않습니다.

## 1. 옮길 파일

준비된 `nopetion-server-날짜.tar.gz`와 같은 이름의 `.sha256`을 서버에 복사합니다. 소스 묶음에는 `.env.example`이 있고 실제 `.env`, node_modules, Git 이력, 검증 중 사용한 데이터와 백업은 없습니다. 체크섬을 비교한 뒤 새 디렉터리에서 압축을 풉니다.

```sh
sha256sum -c nopetion-server-날짜.tar.gz.sha256
tar -xzf nopetion-server-날짜.tar.gz
cd nopetion
```

macOS에서 체크섬을 확인할 때는 `shasum -a 256 -c 파일명.sha256`도 사용할 수 있습니다. 기존 설치 디렉터리나 데이터 볼륨 위에 새 설치를 덮어쓰지 않습니다.

## 2. 환경 초기화

서버에는 Docker Engine/Desktop과 Compose가 필요합니다. Node.js 24가 있으면 다음 명령으로 임의 앱 secret과 DB 비밀번호를 생성합니다. 기존 `.env`는 덮어쓰지 않습니다.

```sh
node scripts/init-env.mjs
```

Node.js가 없는 Linux/macOS 서버에서는 Node 24 컨테이너로 같은 초기화기를 실행할 수 있습니다.

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace \
  node:24-slim node scripts/init-env.mjs
```

`.env`에서 `APP_URL`을 실제 접속 주소로 정합니다. 앱 secret과 DB 비밀번호는 로그인 비밀번호와 별개입니다. 기본 `http://localhost:3000`은 서버 로컬 접속이나 아래 SSH 터널에서 사용할 수 있습니다. 개인 HTTPS 프록시가 준비되어 있다면 해당 HTTPS 주소를 설정합니다.

Draw.io·Gotenberg·iframe 출처는 `.env`에서 설정하지 않습니다. 첫 로그인 뒤 **설정 → 서버 기능**에서 저장합니다. 첨부는 로컬 영구 저장소를 사용하며, 메일 전송·이메일 비밀번호 복구 기능은 없습니다.

## 3. 실행

```sh
docker compose up --build -d
docker compose ps
```

처음 빌드할 때 의존성, 음성 전사 엔진과 모델을 내려받으므로 네트워크 연결과 여유 공간이 필요합니다. 빌드는 서버 CPU 구조에 맞게 수행됩니다. 현재 Mac mini에서 만든 이미지를 다른 CPU 구조의 서버에 그대로 복사하는 절차가 아닙니다.

배포 Compose는 앱을 `127.0.0.1:3000`에 연결하고 DB·Redis의 호스트 포트는 열지 않습니다. PC에서 SSH 터널을 열면 기본 로컬 주소로 접속할 수 있습니다.

```sh
ssh -L 3000:127.0.0.1:3000 user@your-server
```

PC 브라우저에서 `http://localhost:3000`을 엽니다. 이 터널 방식에서는 기본 HTTP `APP_URL`을 사용합니다. HTTPS를 사용하려면 별도로 준비한 프록시를 통해 접속하고 `APP_URL`도 해당 HTTPS 주소로 맞춥니다. Mac mini 전용 Tailscale 호스트명과 Compose override는 소스 묶음에 포함하지 않습니다.

## 하위 경로로 연결할 때

예를 들어 `APP_URL=https://your-server.example/nopetion`으로 정한 **다음에** 이미지를 빌드합니다. Compose는 공개 주소의 경로를 빌드에 전달합니다. 경로를 변경하면 앱 이미지를 다시 빌드해야 하며, DB·첨부 볼륨을 초기화할 필요는 없습니다.

프록시는 `/nopetion`을 제거한 요청을 로컬 앱으로 전달해야 합니다. 외부 `/nopetion/api/health`는 내부 `/api/health`가 됩니다. HTTP와 WebSocket 모두 같은 규칙을 적용합니다. Tailscale Serve의 `--set-path=/nopetion`은 이 방식으로 전달합니다. 기존 루트 서비스가 있다면 그 핸들러를 그대로 둡니다.

로그인·첨부·번역·실시간 저장·PWA는 지정한 경로를 사용합니다. PWA 범위와 쿠키도 해당 경로로 제한합니다. GitHub 같은 외부 연결의 콜백은 설정 화면에 표시되는 **하위 경로가 포함된 주소**를 등록합니다. AI 로그인은 기존 컴퓨터 로컬 콜백 제한을 유지합니다.

## 4. 첫 계정과 설정

1. 비밀번호와 비밀번호 확인에 같은 값을 입력합니다. 빈 값은 거절하고 1자부터 허용합니다.
2. 개인 계정, 기본 워크스페이스와 빈 General Space가 생성됩니다. 이후 로그인은 비밀번호만 사용합니다.
3. 프로필에서 이름·비밀번호를 관리합니다. 비밀번호를 잊었을 때 이메일 복구는 제공하지 않습니다.
4. **설정 → 서버 기능**에서 다이어그램 편집기, 선택 Gotenberg PDF/A 처리, iframe 허용 사이트를 설정합니다. 빈 Gotenberg 주소는 내장 PDF를 사용합니다. 허용 사이트는 경로 없이 정확한 HTTP/HTTPS 출처로 입력합니다.
5. 문서 AI와 외부 서비스는 각 설정 화면에서 새로 연결합니다. 다른 도구의 인증 파일이나 유료 제공자로 자동 전환하지 않습니다.

## 데이터 보존과 업데이트

PostgreSQL·Redis·첨부·AI·외부 연결 설정은 각각 영구 볼륨에 저장됩니다. 업데이트는 같은 프로젝트에서 새 소스를 빌드하고 기존 볼륨을 유지하는 방식으로 진행합니다. 운영 전용 백업과 키는 소스 묶음과 따로 관리하며 [백업·복원 안내](backup-restore.md)를 따릅니다.

```sh
docker compose up --build -d
```

개발 시에는 Node.js 24와 pnpm 11.28.2를 사용합니다. 개발용 DB/Redis 포트가 필요한 `docker-compose.dev.yml`은 배포 Compose와 구분합니다.

## 코드 묶음 만들기

프로젝트에서 다음 명령으로 새 개인 서버용 소스 묶음을 생성합니다. 출력 파일은 프로젝트 밖의 새 경로를 사용합니다. 기존 파일은 덮어쓰지 않습니다.

```sh
node scripts/package-server.mjs --out /absolute/path/nopetion-server.tar.gz
```

소스 목록·hash는 압축 내부의 `SERVER-BUNDLE.json`에 기록됩니다. 공개 배포 전 라이선스·제3자 고지·보안 검토는 별도로 완료해야 하며, 설치 묶음 생성은 그 판정을 변경하지 않습니다.
