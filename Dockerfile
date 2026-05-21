# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile --config.minimumReleaseAge=0 --config.dangerouslyAllowAllBuilds=true --config.unsafePerm=true

COPY . .
RUN corepack pnpm build --config.minimumReleaseAge=0 --config.verifyDepsBeforeRun=false --config.dangerouslyAllowAllBuilds=true --config.unsafePerm=true

FROM node:22-slim AS runner
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
