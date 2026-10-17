# One image for every host: Railway and Fly build this file directly, and deploy/vm/ runs it behind Caddy.
FROM node:24-bookworm-slim

# Prisma's query engine needs OpenSSL; ca-certificates lets the server reach Google over TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The start script runs through tsx and ensure-db, which are dev dependencies, so install everything.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
# The SQLite file lives on a mounted disk at /data. Mount a volume there, or the data is lost on every deploy.
RUN mkdir -p /data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Applies pending migrations (with a backup), seeds learning content once, then serves.
CMD ["npm", "run", "start"]
