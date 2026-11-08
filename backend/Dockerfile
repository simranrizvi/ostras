FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace=@social-flow/backend
COPY backend/src backend/src
RUN mkdir -p /app/backend/uploads && chown -R node:node /app
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/server.js"]
