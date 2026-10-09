# Stage 1 build
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install --global pnpm@12.10.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2 serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Optional default nginx config can be overridden by mounting your own
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
