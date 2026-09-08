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

#3 [Optional - typically already present] Install base acos-server dependencies
# If an equivalent dependency install step already exists (npm/yarn/pnpm),
# do not duplicate it.
RUN npm install

#4 [Required] Install the jstracing custom content type added in this integration
# For pitts-quizpet-acos integration
COPY ./acos-jstracing ${APP_DIR}/acos-jstracing
RUN npm install ./acos-jstracing

# Optional Java compiler runtime asset for CheerpJ Java mode.
# Put host file at deploy/ec2/assets/tools.jar before build to enable live Java compile.
COPY ./deploy/ec2/assets ${APP_DIR}/deploy-assets
ENV JSTRACING_TOOLS_JAR_PATH=${APP_DIR}/deploy-assets/tools.jar \
    CHEERPJ_RUNTIME_BASE_URL=https://cjrtnc.leaningtech.com/4.3/ \
    CHEERPJ_SELF_HOST_DIR=${APP_DIR}/deploy-assets/cheerpj/4.3

#5 [Required] Install quizpet-generator as an ACOS tool package
COPY ./acos-quizpet-generator-tool ${APP_DIR}/acos-quizpet-generator-tool
RUN npm install ./acos-quizpet-generator-tool

#6 [Optional - typically already present] Expose service port and start command
# If the target setup already defines port and startup conventions,
# keep those existing settings.
EXPOSE 3000
CMD ["npm", "start"]