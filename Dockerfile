# syntax=docker/dockerfile:1.7
# One image per app: docker build --build-arg APP=student -t tutora-student .
# Static files served by nginx (non-root, port 8080) with security headers and a CSP; the app's API
# areas and the realtime socket are proxied to API_UPSTREAM, so the browser stays same-origin.

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:1.29-alpine

FROM ${NODE_IMAGE} AS build
ARG APP
RUN test -n "$APP" || (echo "Pass --build-arg APP=student|tutor|admin" && exit 1)
WORKDIR /src
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/student/package.json apps/student/
COPY apps/tutor/package.json apps/tutor/
COPY apps/admin/package.json apps/admin/
COPY packages/api-client/package.json packages/api-client/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.yarn/berry/cache yarn install --immutable
COPY tsconfig.base.json ./
# The build type-checks the whole app, tests included (they import the shared test helpers).
COPY test test
COPY packages packages
COPY apps/${APP} apps/${APP}
# Same-origin API (nginx proxies it). Cross-app links come from build args.
ARG VITE_STUDENT_APP_URL=/
ARG VITE_TUTOR_APP_URL=/
ARG VITE_ADMIN_APP_URL=/
ENV VITE_API_BASE_URL="" \
    VITE_STUDENT_APP_URL=${VITE_STUDENT_APP_URL} \
    VITE_TUTOR_APP_URL=${VITE_TUTOR_APP_URL} \
    VITE_ADMIN_APP_URL=${VITE_ADMIN_APP_URL}
RUN yarn workspace @tutora/${APP}-app build

FROM ${NGINX_IMAGE}
ARG APP
# Runtime settings (see docker/README.md). The proxied API areas are derived from APP at start-up.
ENV APP=${APP} \
    PORT=8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    API_UPSTREAM=http://api:3000 \
    CSP_CONNECT_EXTRA="" \
    CSP_MEDIA_EXTRA=""
RUN rm /etc/nginx/conf.d/default.conf \
 && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/app.conf.template /etc/nginx/templates/app.conf.template
COPY docker/15-api-areas.envsh /docker-entrypoint.d/15-api-areas.envsh
COPY --from=build /src/apps/${APP}/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
