FROM node:22-alpine

WORKDIR /app

COPY . .

# Frontend build
RUN cd frontend && npm install && npm run build

# Backend dependencies
RUN cd backend && npm install --omit=dev

EXPOSE 5000

ENV NODE_ENV=production

CMD ["sh", "-c", "node backend/db/migrate.js; node backend/src/app.js"]
