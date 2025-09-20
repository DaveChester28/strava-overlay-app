FROM node:18-alpine
WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY server/src ./src

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "src/index.js"]
