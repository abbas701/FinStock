# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
WORKDIR /app

# Use pnpm via Corepack and install dependencies
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile

# Copy project files and build client + server
COPY . .
RUN corepack pnpm build

FROM node:22-slim AS runner
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
