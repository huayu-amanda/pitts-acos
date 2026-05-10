# pitts-quizpet-acos Deployment and Integration Guide (For Existing ACOS Servers)

This document is for target servers that already run ACOS Content Server. The goal is to integrate the new capabilities from this project without impacting the existing components in the target environment.

Scope:
- Base system: existing `acos-server`
- Required integrations in this release:
  - Installed tools: `quizpet-generator`
  - Installed content types: `jstracing`
  - Installed content packages: `jstracing-python`, `jstracing-java`
  - Quiz retrieval backend: `QuizPetAuthoring` (Spring/Tomcat)
  - Database: `mariadb`

---

## 1. Target Architecture (Integrated into Existing ACOS)

Recommended post-integration layout:
- Existing `acos-server` continues to serve as the main entry point and host existing components
- Add `quizpet-tomcat` + `quizpet-mysql` as the QuizPet backend
- `acos-server` accesses QuizPet APIs via environment variables

Recommended routing:
- `http(s)://<host>/` -> `acos-server`
- `http(s)://<host>/quizpet/` -> `quizpet-tomcat:8080/quizpet`

This repository already provides an Nginx reverse-proxy example at `deploy/ec2/nginx.conf`.

---

## 2. Pre-Go-Live Checklist (Required)

Applicability: this section assumes the target environment uses Docker/Compose. If the target uses a non-container deployment flow, keep the backup and port/network checks, and follow the existing release process in that environment.

1. Back up the current running version
- Record current image tags, container names, and environment variable files
- If the deployment directory is managed by Git, create a tag first:

```bash
git tag before-pitts-quizpet-acos-$(date +%Y%m%d-%H%M)
```

2. Verify ports and network
- External port for `acos-server` (typically 3000, or 80/443 via Nginx)
- MariaDB is recommended to bind only to loopback: `127.0.0.1:3306`
- `quizpet-tomcat` can remain container-internal and does not need direct public exposure

3. Confirm Docker and Docker Compose are available on the target server

```bash
docker --version
docker compose version
```

---

## 3. Deployment Files and Variables

Key files:
- `deploy/ec2/docker-compose.yml`
- `deploy/ec2/.env`
- `deploy/ec2/nginx.conf`
- `deploy/ec2/mariadb/Dockerfile`
- `acos-server/Dockerfile`
  - Note: one of the key build files for this integration, used to build an `acos-server` image that includes `acos-jstracing`.

Key variables (`deploy/ec2/.env`):
- `QUIZPET_BASE_URL` (default source)
- `QUIZPET_USERNAME_ADMIN` / `QUIZPET_PASSWORD_ADMIN` (used by generator backend for quiz loading)
- `QUIZPET_USERNAME_STUDENT` / `QUIZPET_PASSWORD_STUDENT` (used by student quiz pages)
- `QUIZPET_BASE_URL_PITTS` (if Pittsburgh source must coexist)
- `MYSQL_ROOT_PASSWORD`

---

## 4. acos-server Code Changes/Additions (Must Be Completed First)

Note: this checklist targets the existing `acos-server` code repository. The assumption is that the codebase does not yet include this project's changes, so code integration must be completed before Compose/.env integration.

### 4.1 Required New Files (Add directly with the same filenames)

1. `acos-server/routes/quizpet-generator.js`
- Purpose: provides the `quizpet-generator` page and APIs (topics/search/load/import).

2. `acos-server/services/quizpet-generator-service.js`
- Purpose: encapsulates QuizPet quiz-loading logic, language detection, and response normalization.

3. `acos-server/services/quizpet-topic-options.js`
- Purpose: maintains topic dropdown options and sample quiz mappings.

4. `acos-server/views/quizpet-generator.html`
- Purpose: `quizpet-generator` page template and frontend interaction script.

Code comment requirement (already applied): each new/modified block above has a one-line comment `For pitts-quizpet-acos integration`.

### 4.2 Required Modifications in acos-server (Patch Existing Files)

1. `acos-server/app.js`
- Add route registration: import and call `registerQuizpetGeneratorRoutes(app, handlers)`.
- Allow `quizpet-generator` in the generic 4-segment route matcher to avoid interception by ACOS content routing.
- Add `quizpet-generator` fallback in the homepage tools list so the entry is always visible.
- Patch anchors (recommended search points):
  - `var registerQuizpetGeneratorRoutes = require('./routes/quizpet-generator');`
  - `registerQuizpetGeneratorRoutes(app, handlers);`
  - `if (req.params.protocol === 'quizpet-generator') { return next(); }`
  - `if (params.tools.indexOf('quizpet-generator') === -1)`
- Code comment status: all new/modified blocks above are marked with `For pitts-quizpet-acos integration`.

2. `acos-server/Dockerfile` (only if the target builds acos-server with Docker)
- Note: if the target already has working `COPY acos-server` and dependency-install steps, those can be reused. However, `acos-jstracing` installation steps must be integrated.
- Add `acos-jstracing` copy/install steps so the container can load `jstracing` content type and packages.
- Required key steps:
  - `COPY ./acos-jstracing ${APP_DIR}/acos-jstracing`
  - `RUN npm install ./acos-jstracing`

### 4.3 Recommended Files to Sync (Avoid Runtime Differences)

1. `acos-server/package-lock.json`
- Purpose: locks dependency resolution to reduce environment-specific drift.

2. `acos-server/certs/adapt2-extra-ca.pem`
- Purpose: ensures Node can validate certificate chains when connecting to external HTTPS QuizPet sources.

### 4.4 Quick Verification After Code Integration

1. Page reachable: `/<host>/quizpet-generator` returns a page.
2. API reachable: `/<host>/quizpet-generator/api/topics` returns JSON.
3. Quiz loading works: `/<host>/quizpet-generator/api/quiz/<quizId>` returns quiz data.
4. Homepage visibility: `quizpet-generator` appears in ACOS homepage tools.

---

## 5. Recommended Go-Live Flow (Based on Existing Environment)

Prerequisite: Sections 3 and 4 have been completed, and the environment already has a working `acos-server` release pipeline.

### Step 1: Release acos-server Incremental Changes (Required)

- Release the already integrated code through the existing release flow. Do not repeat branch switching or code integration.

- If using this repository's `deploy/ec2/docker-compose.yml`, run:
```bash
cd deploy/ec2
docker compose up -d --build acos-server
```

### Step 2: Database Initialization and Seed Data Import (Required)

Note: follow the import order from README: create schema first, then import seed SQL files. In production, rehearse this in a backup environment first.

```bash
cd /<deploy_root>/pitts-quizpet-acos

# 1) Initialize schema
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/init-db.sql

# 2) Import user data (keep login accounts available)
docker exec quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE quizpet; TRUNCATE TABLE ent_user;"
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/ent_user_202604132302.sql
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_user-testuser.sql

# 3) Import question data (reset AUTO_INCREMENT for reproducible IDs)
docker exec quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE quizpet; TRUNCATE TABLE ent_jquestion; ALTER TABLE ent_jquestion AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/ent_jquestion_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquestion.sql

# 4) Import quiz data and patch rdfIdDisplay
docker exec quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE quizpet; TRUNCATE TABLE ent_jquiz; ALTER TABLE ent_jquiz AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/ent_jquiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquizes.sql
docker exec quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE quizpet; UPDATE ent_jquiz SET rdfIdDisplay = 'q_java' WHERE QuizID BETWEEN 1 AND 255 AND (rdfIdDisplay IS NULL OR TRIM(rdfIdDisplay) = '');"

# 5) Import question-quiz relation data
docker exec quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE quizpet; TRUNCATE TABLE rel_question_quiz;"
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/rel_question_quiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" < QuizPetAuthoring/src/main/resources/db/insert-sample-rel_question_quiz.sql
```

### Step 3: Update Environment Variables as Needed (Only If Changed)

- Update `deploy/ec2/.env` only when these values differ from production:
  - `QUIZPET_BASE_URL`
  - `QUIZPET_USERNAME_ADMIN` / `QUIZPET_PASSWORD_ADMIN`
  - `QUIZPET_USERNAME_STUDENT` / `QUIZPET_PASSWORD_STUDENT`
  - `MYSQL_ROOT_PASSWORD`
- After updates, restart only impacted services.

### Step 4: Update QuizPet Backend as Needed (Only If Backend Image Changed)

- If `QuizPetAuthoring` and `deploy/ec2/mariadb/Dockerfile` were not changed in this release, this step can be skipped.
- Run when updates are needed:

```bash
cd deploy/ec2
docker compose up -d --build quizpet-mysql quizpet-tomcat
```

### Step 5: Sync Static Assets (Only When jstracing Package Is Updated Independently)

```bash
cd /<deploy_root>/pitts-quizpet-acos/acos-jstracing
npm install
npm run sync-static
```

For hot updates into a running `acos-server` container, use:

```bash
docker cp acos-jstracing acos-server:/usr/src/app/acos-jstracing
docker exec acos-server sh -lc "cd /usr/src/app && npm install ./acos-jstracing"
docker restart acos-server
```

---

## 6. Validation Checklist (Verify Item by Item)

On ACOS homepage, verify:

1. Installed tools
- `quizpet-generator` is present

2. Installed content types
- `jstracing` is present

3. Installed content packages
- `jstracing-python` is present
- `jstracing-java` is present

4. No regression in existing components
- Existing protocols/content types/content packages remain visible
- Existing items in screenshots remain unchanged

Functional validation recommendations:
- Open `/<host>/quizpet-generator` and confirm quiz loading
- Open `/<host>/html/jstracing/jstracing-python/sample_quiz` and confirm it runs
- Open `/<host>/html/jstracing/jstracing-java/sample_quiz` and confirm it runs

---

## 7. Rollback Plan

### Quick Rollback (Container Level)

1. Stop newly added services:

```bash
cd deploy/ec2
docker compose stop quizpet-tomcat quizpet-mysql
```

2. Restore `acos-server` to the previous working image or Git tag:

```bash
git checkout <previous-tag-or-branch>
cd deploy/ec2
docker compose up -d --build acos-server
```

### Full Rollback (Including Data)

- Restore MySQL volume or logical backup created before go-live
- Restore previous `.env` and reverse-proxy configuration

---
