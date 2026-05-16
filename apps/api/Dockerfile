FROM node:24-alpine AS runner
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build:api

WORKDIR /app/apps/api
CMD ["sh", "-c", "node ../../scripts/init-remote-db.mjs && node dist/main.js"]
