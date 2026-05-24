FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip python3-reportlab --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
