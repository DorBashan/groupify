FROM node:20-alpine

# needed for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json .
RUN npm install --production

COPY src ./src

CMD ["node", "src/index.js"]
