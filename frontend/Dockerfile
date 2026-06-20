FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Runs Vite dev server binding to host network
CMD ["npm", "run", "dev"]
