FROM node:18

WORKDIR /app

# Install all dependencies (including dev) for building
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Build the application
COPY . .
RUN npm run build

# Remove dev dependencies for production image
RUN npm prune --production

EXPOSE 3002

CMD ["npm", "start"]
