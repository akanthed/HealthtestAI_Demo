FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm install instead of npm ci in CI builds without a lockfile. --omit=dev avoids dev deps.
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
CMD ["node", "index.js"]
