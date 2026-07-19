# syntax=docker/dockerfile:1

# ---- Frontend: instalar deps -----------------------------------------
FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Frontend: build (Next standalone) --------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY . .
# No forma parte del build del frontend; evita que Next lo mire de más.
RUN rm -rf backend
# NEXT_PUBLIC_* se hornea en el bundle del navegador en build time, no en
# runtime: tiene que ser "/api" (relativo) acá, para que el navegador del
# usuario le pegue al proxy de Next y no a un "localhost" que no existe
# fuera del contenedor.
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# ---- Backend: instalar deps (todas, para poder compilar) --------------
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# ---- Backend: build (Nest) --------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ .
RUN npm run build

# ---- Backend: deps de producción únicamente (imagen final más chica) --
FROM node:20-alpine AS backend-prod-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime ------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Frontend: salida standalone de Next (server.js + node_modules podados).
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

# Backend: build de Nest + sus deps de producción.
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-prod-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/scripts ./backend/scripts

# schema.sql: migrate.js lo busca en ../../schema.sql desde backend/scripts.
COPY schema.sql ./schema.sql

COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8080
CMD ["./start.sh"]
