# syntax=docker/dockerfile:1
# Site + painel da A. Menezes: um processo Node (Astro SSR) com banco SQLite e fotos no volume /data.
FROM node:24-alpine AS build
ARG BASE_PATH=/
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN BASE_PATH="$BASE_PATH" npm run build && npm prune --omit=dev

FROM node:24-alpine
ARG BASE_PATH=/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATA_DIR=/data BASE_PATH=$BASE_PATH
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY scripts/criar-admin.mjs ./scripts/criar-admin.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO /dev/null "http://127.0.0.1:4321${BASE_PATH}" || exit 1
CMD ["node", "dist/server/entry.mjs"]
