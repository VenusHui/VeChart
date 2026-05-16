FROM node:24-alpine AS runner
WORKDIR /app

COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm install
RUN npm run build:web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
