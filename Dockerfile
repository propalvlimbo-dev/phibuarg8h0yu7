# React build
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev=false
COPY web/ ./
RUN npm run build

# Go build
FROM golang:1.23-alpine AS api-builder
WORKDIR /app
COPY go.mod ./
COPY api/ ./api/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /girlscan-api ./api/cmd/server

# Minimal production image
FROM alpine:3.21
RUN addgroup -S girlscan && adduser -S girlscan -G girlscan
WORKDIR /app
COPY --from=api-builder /girlscan-api /app/girlscan-api
COPY --from=web-builder /app/web/dist /app/web
USER girlscan
ENV PORT=8080 STATIC_DIR=/app/web
EXPOSE 8080
ENTRYPOINT ["/app/girlscan-api"]
