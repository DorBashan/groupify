FROM node:20-alpine AS build

WORKDIR /app
COPY package.json .
RUN npm install

COPY index.html vite.config.js ./
COPY src ./src

# Backend URL for production build — nginx proxies /api to backend container
ARG VITE_API_URL=""
RUN npm run build

# Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
