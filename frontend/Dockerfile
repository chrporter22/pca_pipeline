# # Use an official Node.js image
# FROM node:18
#
# # Set working directory
# WORKDIR /app
#
# # Copy package.json and install dependencies
# COPY package*.json ./
# RUN npm install
#
# # Copy the rest of the app
# COPY . .
#
# # Expose port 3000 (React dev server)
# EXPOSE 3000
#
# # Start the dev server (or use `npm run build` for production)
# CMD ["npm", "start"]
FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 4173

CMD ["npm", "run", "start"]

