FROM node:20-slim

# Install Python dan Chromium (lebih ringan dari Chrome penuh)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip3 install --break-system-packages -r requirements.txt

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Pastikan folder data wujud
RUN mkdir -p /app/data

EXPOSE 3001

ENV NODE_OPTIONS="--max-old-space-size=384"
CMD ["node", "server.js"]