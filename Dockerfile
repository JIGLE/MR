# --- Build the static site ---------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# false = private archive (noindex, everything hidden from search engines)
# true  = public portfolio (only articles with `public: true` are published)
ARG ARCHIVE_PUBLIC=false
ARG SITE_URL=http://localhost:8080
ENV ARCHIVE_PUBLIC=$ARCHIVE_PUBLIC SITE_URL=$SITE_URL
RUN npm run build

# --- Serve it with Caddy -----------------------------------------------------------------------
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/auth /etc/caddy/auth
COPY deploy/entrypoint.sh /entrypoint.sh
COPY --from=build /app/dist /srv
RUN chmod +x /entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
