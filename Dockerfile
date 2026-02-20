FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy only the packages we need
COPY packages/core/package.json packages/core/
COPY packages/directory/package.json packages/directory/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core/ packages/core/
COPY packages/directory/ packages/directory/

# Build
RUN pnpm --filter @squadklaw/core build && pnpm --filter @squadklaw/directory build

# Create data directory for SQLite
RUN mkdir -p /data

ENV PORT=3141
ENV DB_PATH=/data/squadklaw.db
EXPOSE 3141

CMD ["node", "packages/directory/dist/server.js"]
