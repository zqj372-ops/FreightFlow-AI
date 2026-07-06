FROM node:24-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate \
  && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate:deploy && npm run prisma:seed && exec npm run start"]
