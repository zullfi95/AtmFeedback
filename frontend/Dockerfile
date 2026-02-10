FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first
COPY FeedbackATM/frontend/package*.json ./
RUN npm install

# Copy shared components (must be before frontend to ensure correct paths)
COPY shared-components ./shared-components

# Copy FeedbackATM frontend source
COPY FeedbackATM/frontend/ .

RUN npm run build

FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY FeedbackATM/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
