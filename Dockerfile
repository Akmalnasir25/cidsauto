FROM node:20-slim

# Install Python, wget, dan Google Chrome
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
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

CMD ["node", "server.js"]