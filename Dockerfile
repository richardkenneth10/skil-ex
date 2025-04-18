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

FROM node:22-slim AS base
# Add tools required to build mediasoup native modules
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y build-essential python3 python3-pip
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prod

COPY pnpm-lock.yaml /app
WORKDIR /app
RUN pnpm fetch --prod

COPY . /app
RUN pnpm run build

FROM base
COPY --from=prod /app/node_modules /app/node_modules
COPY --from=prod /app/dist /app/dist
EXPOSE 3000
EXPOSE 40000-40020/udp
EXPOSE 4443
CMD [ "pnpm", "start:prod" ]