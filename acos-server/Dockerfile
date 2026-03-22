FROM node:18-bullseye

# Set working directory
WORKDIR /usr/src/app

# 0. Copy local content-type packages referenced via file paths
COPY ./acos-jsparsons /usr/src/acos-jsparsons

# 1. Copy acos-server project code (including package*.json)
COPY ./acos-server /usr/src/app

# 2. Install acos-server dependencies
RUN npm install

# 3. Install official content types + content packages + lti
RUN npm install \
    github:acos-server/acos-jsvee \
    github:acos-server/acos-jsvee-python \
    github:acos-server/acos-lti

# 4. Copy and install local custom content types
COPY ./acos-jstracing /usr/src/app/acos-jstracing
RUN npm install /usr/src/acos-jsparsons && npm install ./acos-jstracing

# 5. Expose port & start
EXPOSE 3000
CMD ["npm", "start"]