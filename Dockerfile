# syntax=docker/dockerfile:1

# ---- Build: install dependencies and produce the static bundle ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
# The browser calls the API on its own origin; nginx below forwards /api to the API service.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Serve: static files plus a same-origin proxy to the API ----
FROM nginx:1.29-alpine AS runtime

# Rendered with the environment at start-up (see docker/nginx.conf.template).
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS makes the image export NGINX_LOCAL_RESOLVERS (the DNS
# servers from /etc/resolv.conf), which the proxy needs to resolve the API name per request.
# Override both at deploy time when the API lives elsewhere. API_UPSTREAM is scheme and host only.
ENV API_UPSTREAM=https://capium-timenfee-capiumtimenfeeapi-d8ypy4-63fda8-51-195-252-84.sslip.io \
    API_HOST=capium-timenfee-capiumtimenfeeapi-d8ypy4-63fda8-51-195-252-84.sslip.io \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
