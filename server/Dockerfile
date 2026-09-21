# ─────────────────────────────────────────────────────────────────────────────
# 두 판으로 나눈다 — 빌드 도구(typescript·tsx)를 실행 이미지에 남기지 않으려는 것이다.
# 남기면 이미지가 커져 Cloud Run 의 콜드 스타트가 길어지고, 안 쓰는 코드가 공격 면이 된다.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
# package*.json 만 먼저 넣는 이유 — 소스만 바뀐 배포에서 npm ci 층이 캐시에 남는다
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# **마이그레이션 SQL 을 같이 싣는다** — 부팅에서 돌리므로 없으면 표 없는 서버가 뜬다
COPY migrations ./migrations
# root 로 돌리지 않는다
USER node
# Cloud Run 이 PORT 를 넣어 준다. 로컬에서 그냥 돌릴 때를 위한 기본값이다
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
