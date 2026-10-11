FROM node:18-bullseye

#1 [Required] Set the working directory
# Use the actual WORKDIR used by the target acos-server environment;
# this default is only a template value.
ARG APP_DIR=/usr/src/app
WORKDIR ${APP_DIR}

#2 [Optional - typically already present] Copy acos-server code (including package*.json)
# If an equivalent COPY step already exists in the target Dockerfile,
# keep the existing implementation and do not duplicate it.
COPY ./acos-server ${APP_DIR}
COPY ./artifacts/npm ${APP_DIR}/artifacts/npm

#3 [Optional - typically already present] Install base acos-server dependencies
# If an equivalent dependency install step already exists (npm/yarn/pnpm),
# do not duplicate it.
RUN npm install --omit=dev

#4 [Required] Install split jstracing packages from npm tarballs
RUN npm install --omit=dev ${APP_DIR}/artifacts/npm/acos-jstracing-type-1.0.0.tgz \
 && npm install --omit=dev ${APP_DIR}/artifacts/npm/acos-jstracing-python-1.0.0.tgz \
 && npm install --omit=dev ${APP_DIR}/artifacts/npm/acos-jstracing-java-1.0.0.tgz

ENV JSTRACING_TOOLS_JAR_PATH=${APP_DIR}/node_modules/acos-jstracing-type/static/assets/tools.jar \
    CHEERPJ_RUNTIME_BASE_URL=https://cjrtnc.leaningtech.com/4.3/ \
    CHEERPJ_DISABLE_SELF_HOST=true
# Prefer remote CheerpJ runtime first because local self-host assets are incomplete.
# ENV CHEERPJ_SELF_HOST_DIR=${APP_DIR}/node_modules/acos-jstracing-type/static/assets/cheerpj/4.3

#5 [Required] Install quizpet-generator as an ACOS tool package
RUN npm install --omit=dev ${APP_DIR}/artifacts/npm/acos-quizpet-generator-tool-1.0.0.tgz

#6 [Optional - typically already present] Expose service port and start command
# If the target setup already defines port and startup conventions,
# keep those existing settings.
EXPOSE 3000
CMD ["npm", "start"]