FROM node:18-alpine
WORKDIR /app
COPY server/package.json .
RUN npm install
COPY server/index.js .
EXPOSE 3001
CMD ["npm", "start"]
