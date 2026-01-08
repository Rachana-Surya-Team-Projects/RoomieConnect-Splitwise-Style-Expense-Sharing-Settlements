FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# install nodemon globally for hot reload
RUN npm install -g nodemon

COPY . .

CMD ["npm", "run", "dev"]
