# # Stage 1: Build
# FROM node:22.11.0-alpine AS builder

# WORKDIR /app

# # Enable and install pnpm
# RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

# # Copy lockfile and manifest first (for better caching)
# COPY pnpm-lock.yaml package.json ./

# # Install dependencies
# RUN pnpm install --frozen-lockfile

# # Copy rest of the files
# COPY tsconfig*.json ./
# COPY prisma ./prisma
# COPY src ./src

# # Generate Prisma client and build the NestJS project
# RUN pnpm prisma generate
# RUN pnpm build

# # Stage 2: Production image
# FROM node:22-alpine AS production

# WORKDIR /app

# # Enable and install pnpm
# RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

# # Only copy necessary files
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/package.json ./

# # Optional: copy .env if you're building with one
# # Uncomment if using a pre-defined .env file during image build
# # COPY .env .env

# # Expose the default NestJS port
# EXPOSE 3000

# # Use environment variables from .env at runtime (if mounting the file)
# ENV NODE_ENV=production

# # Start the app
# CMD ["pnpm", "start:prod"]



# FROM node:22.11.0-slim AS base
# # Add tools required to build mediasoup native modules
# RUN \
# 	set -x \
# 	&& apt-get update \
# 	&& apt-get install -y build-essential python3 python3-pip
# ENV PNPM_HOME="/pnpm"
# ENV PATH="$PNPM_HOME:$PATH"
# RUN corepack enable
# COPY . /app
# WORKDIR /app

# FROM base AS prod-deps
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# FROM base AS build
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# RUN pnpm run build

# FROM base
# COPY --from=prod-deps /app/node_modules /app/node_modules
# COPY --from=build /app/dist /app/dist
# EXPOSE 3000
# EXPOSE 40000-40020/udp
# EXPOSE 4443
# CMD [ "pnpm", "start:prod" ]


FROM node:22.11.0-slim AS base
# Add tools required to build mediasoup native modules
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y build-essential python3 python3-pip
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_INTEGRITY_KEYS='{"npm":[{"expires":"2025-01-29T00:00:00.000Z","keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","keytype":"ecdsa-sha2-nistp256","scheme":"ecdsa-sha2-nistp256","key":"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="},{"expires":null,"keyid":"SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U","keytype":"ecdsa-sha2-nistp256","scheme":"ecdsa-sha2-nistp256","key":"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g=="}]}'
RUN corepack enable

FROM base AS prod

COPY pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm fetch --prod

COPY . /app
RUN pnpm install -g @nestjs/cli prisma
RUN pnpm prisma generate
RUN pnpm run build

FROM base
COPY --from=prod /app/node_modules /app/node_modules
COPY --from=prod /app/dist /app/dist
EXPOSE 8000
EXPOSE 40000-40020/udp
EXPOSE 4443
CMD [ "pnpm", "start:prod" ]