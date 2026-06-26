FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install && npm install --prefix server && npm install --prefix client

COPY server ./server
COPY client ./client

RUN npm run build --prefix client && npm run build --prefix server

FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

RUN npm install --prefix server --omit=dev

RUN mkdir -p /app/server/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/server/data/ajaia.db

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
