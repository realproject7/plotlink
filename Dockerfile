# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY packages/cli/package.json packages/cli/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=true
# Public settings only. Source DB credentials, storage/API secrets and runtime
# JWTs are excluded from both the context and image build environment.
ARG NEXT_PUBLIC_CHAIN_ID=8453
ARG NEXT_PUBLIC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_BUILDER_CODE
ARG NEXT_PUBLIC_ADMIN_WALLET_ADDRESS
ARG NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_CHAIN_ID=${NEXT_PUBLIC_CHAIN_ID} \
    NEXT_PUBLIC_CONTRACT_ADDRESS=${NEXT_PUBLIC_CONTRACT_ADDRESS} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID} \
    NEXT_PUBLIC_BUILDER_CODE=${NEXT_PUBLIC_BUILDER_CODE} \
    NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=${NEXT_PUBLIC_ADMIN_WALLET_ADDRESS} \
    NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL}
RUN POSTGREST_URL=http://127.0.0.1:9 POSTGREST_ADMIN_JWT=public-build-fixture \
    POSTGREST_PUBLIC_JWT=public-read-fixture npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/.next/cache && chown node:node /app/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/', {signal: AbortSignal.timeout(4000)}).then(r => {if (!r.ok) process.exit(1)}).catch(() => process.exit(1))"
CMD ["node", "server.js"]
