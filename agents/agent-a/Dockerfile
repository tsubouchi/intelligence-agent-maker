FROM node:20-slim

# システムロケール & tzdata 省略で軽量化
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"] 
 