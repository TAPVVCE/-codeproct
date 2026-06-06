# ============================================================
# CODEPROCT — Dockerfile
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --production

# Copy all files
COPY . .

# Create data directory for SQLite and Excel exports
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
