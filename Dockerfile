# Stage 1 build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Optional default nginx config can be overridden by mounting your own
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]