# ========== Stage 1: Build frontend ==========
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

# ========== Stage 2: Production ==========
FROM node:20-alpine

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy backend dependencies and install
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Remove build tools to reduce image size
RUN apk del python3 make g++

# Create data directories
RUN mkdir -p /app/data/databases /app/data/tmp-uploads

# Environment variables
ENV PORT=3000
ENV JWT_SECRET=change-me-in-production

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/me || exit 1

CMD ["node", "backend/server.js"]
