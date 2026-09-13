FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed-admin && npm start"]
