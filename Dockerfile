# syntax=docker/dockerfile:1
# Candidate: build from folio_grade, not its older sibling portfoliograded.
# Validate Chromium sandbox support on the target platform before launch.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client ./client
COPY shared ./shared
COPY server ./server
COPY vite.config.ts tsconfig.json tsconfig.node.json ./
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates chromium chromium-sandbox fonts-liberation \
       fonts-noto-color-emoji gosu tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    PG_DATA_DIR=/data/pg \
    CHROME_PATH=/usr/bin/chromium
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Railway volumes are mounted at runtime and initially owned by root.
# Only this short setup runs as root; Express and Chromium run as node.
RUN <<'SCRIPT'
set -eu
cat > /usr/local/bin/pg-entrypoint <<'ENTRYPOINT'
#!/bin/sh
set -eu
PG_DATA_DIR=$(realpath -m "$PG_DATA_DIR")
export PG_DATA_DIR
case "$PG_DATA_DIR" in
  /data|/data/*) ;;
  *) echo 'PG_DATA_DIR must be /data or a child of /data in this image' >&2; exit 1 ;;
esac
mkdir -p "$PG_DATA_DIR"
chown -R node:node "$PG_DATA_DIR"
exec gosu node:node "$@"
ENTRYPOINT
chmod 0755 /usr/local/bin/pg-entrypoint
SCRIPT
EXPOSE 3000
# Requires the integrated app's public /healthz endpoint. Browser capability
# must be smoke-tested separately; this check does not prove screenshots work.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/pg-entrypoint"]
CMD ["node", "dist/index.js"]
