FROM debian:bookworm-slim AS transcription
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl cmake build-essential
WORKDIR /src
RUN curl -fL --retry 3 https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.8.1.tar.gz -o /tmp/whisper.tar.gz && tar -xzf /tmp/whisper.tar.gz --strip-components=1
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DCMAKE_BUILD_TYPE=Release && cmake --build build --target whisper-cli -j2
RUN mkdir /models && curl -fL --retry 3 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o /models/ggml-base.bin
RUN printf "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe  /models/ggml-base.bin\n" | sha256sum -c -

FROM node:24-slim AS base
LABEL org.opencontainers.image.title="Nopetion"
LABEL org.opencontainers.image.description="Nopetion personal document workspace. Your docs, your rules."

RUN npm install -g pnpm@11.28.2

FROM base AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/editor-ext/package.json ./packages/editor-ext/package.json
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
ARG APP_URL=http://localhost:3000
ENV APP_URL=$APP_URL
# Keep the monorepo build, with one Nx task at a time in Docker's limited VM.
RUN pnpm build --parallel=1
RUN node scripts/package-server.mjs --public --out /tmp/nopetion-source.tar.gz

FROM base AS installer

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl bash ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# drop npm and corepack
RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -rf /usr/local/lib/node_modules/corepack \
  && rm -rf /usr/local/bin/npm \
  && rm -rf /usr/local/bin/npx \
  && rm -rf /usr/local/bin/corepack \
  && rm -rf /root/.npm \
  && rm -rf /root/.node-gyp

WORKDIR /app

# Independent local speech recognition engine, model and its notices.
COPY --from=transcription /src/build/bin/whisper-cli /opt/whisper/whisper-cli
COPY --from=transcription /models/ggml-base.bin /opt/whisper/ggml-base.bin
COPY --from=transcription /src/LICENSE /app/notices/whisper-cpp-LICENSE
# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/client/package.json /app/apps/client/package.json
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches
# Keep upstream license notices with the deployed image.
COPY --from=builder /app/LICENSE /app/LICENSE
COPY --from=builder /app/notices/NOPETION-MODIFICATIONS.md /app/notices/NOPETION-MODIFICATIONS.md
COPY --from=builder /app/apps/client/src/ee/LICENSE /app/notices/client-ee-LICENSE
COPY --from=builder /app/packages/ee/LICENSE /app/notices/ee-LICENSE
COPY --from=builder /app/packages/base-formula/LICENSE /app/notices/base-formula-LICENSE
COPY --from=builder /app/notices/third-party /app/notices/third-party
COPY --from=builder /app/notices/local-transcription /app/notices/local-transcription
COPY --from=builder /app/notices/vendored /app/notices/vendored
COPY --from=builder /tmp/nopetion-source.tar.gz /app/notices/corresponding-source.tar.gz

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile --prod && rm -rf /home/node/.cache/pnpm

RUN mkdir -p /app/data/storage /app/data/personal-ai /app/data/connectors

VOLUME ["/app/data/storage"]

EXPOSE 3000

# Deliver SIGTERM directly to Nest so its Yjs/worker shutdown hooks can finish.
# Match pnpm's original server cwd: local storage resolves ../../data/storage.
WORKDIR /app/apps/server
ENV NODE_ENV=production
CMD ["node", "/app/apps/server/dist/main.js"]
