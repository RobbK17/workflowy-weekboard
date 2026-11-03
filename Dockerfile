# Fly.io image for the Workflowy Week Board. No npm install is needed: the app has no dependencies.
FROM node:22-slim
WORKDIR /app
COPY server.js index.html mobile.html icon-180.png icon-192.png icon-512.png ./
ENV NODE_ENV=production DEPLOY_MODE=fly PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
