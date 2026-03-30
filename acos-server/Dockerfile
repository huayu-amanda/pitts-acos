FROM node:18-bullseye

# Set working directory
WORKDIR /usr/src/app

# Add required intermediate CA so Node HTTPS can validate adapt2 chain.
COPY ./acos-server/certs/InCommonRSAServerCA2.pem /usr/local/share/ca-certificates/InCommonRSAServerCA2.crt
COPY ./acos-server/certs/USERTrustRSAAAACA.pem /usr/local/share/ca-certificates/USERTrustRSAAAACA.crt
COPY ./acos-server/certs/adapt2-extra-ca.pem /usr/src/app/certs/adapt2-extra-ca.pem
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/src/app/certs/adapt2-extra-ca.pem

# 0. Copy local content-type packages referenced via file paths
COPY ./acos-jsparsons /usr/src/acos-jsparsons

# 1. Copy acos-server project code (including package*.json)
COPY ./acos-server /usr/src/app

# 2. Install acos-server dependencies
RUN npm install

# 3. Install official content packages + lti
RUN npm install \
    github:acos-server/acos-lti

# 4. Copy and install local custom content types
COPY ./acos-jstracing /usr/src/app/acos-jstracing
RUN npm install /usr/src/acos-jsparsons && npm install ./acos-jstracing

# 5. Expose port & start
EXPOSE 3000
CMD ["npm", "start"]