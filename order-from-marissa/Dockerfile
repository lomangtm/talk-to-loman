FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN find dist/public/assets -name '*.js' -exec sed -i 's/localStorage/window._LS/g; s/sessionStorage/window._SS/g' {} +
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
