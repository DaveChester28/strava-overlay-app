FROM node:18-alpine
WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci

# Copy source
COPY server/src ./src

# Expose port
EXPOSE 3001

# Start app
CMD ["npm", "start"]
