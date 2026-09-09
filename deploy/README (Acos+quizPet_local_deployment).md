# pitts-quizpet-acos Local Docker Deployment Guide

This document explains how to deploy and run `pitts-quizpet-acos` locally with Docker after cloning from GitHub.

The process follows three key steps:
1. Start core services with Docker Compose:
	`cd deploy/ec2`
    `docker compose up -d --build --remove-orphans`
2. Initialize databases and tables using `QuizPetAuthoring/init-db.sql`.
3. Import seed SQL files under `QuizPetAuthoring/src/main/resources/db`.

## 1. Prerequisites

1. Docker environment is installed and running.
Use Rancher Desktop (recommended in your setup), Docker Desktop, or Docker Engine + Docker Compose Plugin.

2. Docker commands are executable in your terminal.
`docker` and `docker compose` must be available (this is the key requirement).

3. Git is available (only needed for cloning/pulling repository code).

For Rancher Desktop, recommended settings are:
- Container Engine: `dockerd (moby)`
- Docker Socket: enabled

Verify environment (works for Rancher Desktop as well):

```bash
docker --version
docker compose version
```

If commands are not found, enable Docker socket in Rancher Desktop or switch to `dockerd (moby)` and retry.

## 1.1 Version Baseline (From Current Config Files)

The following versions are taken from the current project configuration and should be kept consistent for local deployment.

Versions defined in `QuizPetAuthoring/pom.xml`:
- Java: 1.8 (from `java-version` and Maven compiler source/target)
- Spring Framework: 3.2.15.RELEASE
- Spring Security: 3.2.4.RELEASE
- MySQL Connector/J: 5.1.30

Versions defined in Docker/Compose files:
- Database container (from `deploy/ec2/docker-compose.yml`): MariaDB 10.5
- Tomcat runtime image (from `QuizPetAuthoring/Dockerfile.ec2`): 9.0-jdk8-temurin
- QuizPetAuthoring build image (from `QuizPetAuthoring/Dockerfile.ec2`): Maven 3.9.6 + Eclipse Temurin 8

## 2. Clone the Repository

```bash
git clone <your-repo-url> pitts-quizpet-acos
cd pitts-quizpet-acos
```

## 3. Start Core Services (MySQL/Tomcat/ACOS)

The deployment file used by this project is `deploy/ec2/docker-compose.yml`.

**Important:** This stack now uses `deploy/ec2/.env` as the default startup environment file, so `docker compose` will load it automatically:

```bash
cd deploy/ec2
docker compose up -d --build --remove-orphans
```

Notes:
- `acos-server` is built from `../../acos-server/Dockerfile`.
- MySQL is mapped to host `127.0.0.1:3306`.
- ACOS is mapped to host port `3000`.
- Environment variables (`QUIZPET_USERNAME_ADMIN`, `QUIZPET_PASSWORD_ADMIN`, etc.) are loaded from `deploy/ec2/.env` and injected into the `acos-server` container.

## 4. Database Initialization (Create Schema, Then Import Seed Data)

### 4.1 Run init-db.sql (Create Databases and Tables)

`init-db.sql` creates required databases, user grants, and core table schemas.

Run from repository root:

```bash 
# quizpet-mysql database :
# user/password: root/rootpassword

cd /pitts-quizpet-acos
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/init-db.sql
```


### 4.2 Import Seed SQL Files from resources/db

Import in the following order (recommended):

```bash
cd /pitts-quizpet-acos

# Keep login available
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE webex21; TRUNCATE TABLE ent_user;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_user_202604132302.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_user-testuser.sql

# Reproducible ID layout for quiz/topic:
# 1) dump data uses AUTO_INCREMENT from 1
# 2) sample data keeps fixed IDs range (900+)
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE webex21; TRUNCATE TABLE ent_jquestion; ALTER TABLE ent_jquestion AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquestion_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquestion.sql

docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE webex21; TRUNCATE TABLE ent_jquiz; ALTER TABLE ent_jquiz AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquizes.sql

# Data patch: fill missing rdfIdDisplay for imported ent_jquiz rows
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE webex21; UPDATE ent_jquiz SET rdfIdDisplay = 'q_java' WHERE QuizID BETWEEN 1 AND 255 AND (rdfIdDisplay IS NULL OR TRIM(rdfIdDisplay) = '');"

docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE webex21; TRUNCATE TABLE rel_question_quiz;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/rel_question_quiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-rel_question_quiz.sql
```

Notes:
- The default runtime database is `webex21`, and sample scripts are aligned with `USE webex21;`.
- Not all legacy dump SQL files are directly compatible with the current schema; validate each file before importing.

## 5. Access and Validation

### 5.1 Check Service Status

```bash
cd deploy/ec2
docker compose ps
```

### 5.2 Check Key Logs

```bash
cd deploy/ec2
docker compose logs --tail=100 acos-server
docker compose logs --tail=100 quizpet-tomcat
docker compose logs --tail=100 quizpet-mysql
```

### 5.3 Local URLs

- ACOS home: `http://localhost:3000/`
- QuizPet (Tomcat): `http://localhost:8080/quizpet` (container-side port; if not host-mapped, access via ACOS integration path)

## 6. Rebuild/Restart After Code Changes

After changing `acos-server` or related code, use:

```bash
cd deploy/ec2
docker compose up -d --build --remove-orphans
```

Usually you do not need `down` first. Use it only when you need a full reset of network/container state:

```bash
docker compose down
docker compose up -d --build --remove-orphans
```

## 6.1 Existing ACOS Incremental Go-Live (Optional)

Use this flow when your target environment already runs ACOS and you only want to roll out incremental changes from this project.

1. Pre-go-live checks:
- Back up current image tags, container names, and environment files.
- If deployment is Git-managed, create a rollback tag:

```bash
git tag before-pitts-quizpet-acos-$(date +%Y%m%d-%H%M)
```

- Confirm port/network policy (recommended):
	- ACOS external port: 3000 (or 80/443 behind reverse proxy)
	- MariaDB: bind loopback only (`127.0.0.1:3306`)
	- `quizpet-tomcat`: internal service unless direct exposure is required

2. Incremental release order:
- Release `acos-server` changes first:

```bash
cd deploy/ec2
docker compose up -d --build acos-server
```

- Import/refresh DB schema and seed data (Section 4).
- Rebuild QuizPet backend only if `QuizPetAuthoring` or `deploy/ec2/mariadb/Dockerfile` changed:

```bash
cd deploy/ec2
docker compose up -d --build quizpet-mysql quizpet-tomcat
```

3. Environment variable updates (only if changed):
- `QUIZPET_BASE_URL`
- `QUIZPET_USERNAME_ADMIN` / `QUIZPET_PASSWORD_ADMIN`
- `QUIZPET_USERNAME_STUDENT` / `QUIZPET_PASSWORD_STUDENT`
- `MYSQL_ROOT_PASSWORD`

4. Runtime validation:
- `/<host>/quizpet-generator`
- `/<host>/quizpet-generator/api/topics`
- `/<host>/html/jstracing/jstracing-python/sample_quiz`
- `/<host>/html/jstracing/jstracing-java/sample_quiz`

## 7. FAQ

### 7.1 Why do pages still look old after code changes?

Check the following:
- You ran `docker compose up -d --build --remove-orphans`
- Browser cache was hard-refreshed (Disable cache or Ctrl/Cmd + Shift + R)
- You are visiting the current instance at `http://localhost:3000/`

### 7.2 Why did initialization SQL not apply?

If MySQL already has an existing data volume, `/docker-entrypoint-initdb.d` only runs on first initialization. Re-run SQL manually (Section 4), or reset volume and rebuild:

```bash
cd deploy/ec2
docker compose down -v
docker compose up -d --build --remove-orphans
```

Warning: `down -v` deletes database data.

## 8. Refactor Migration Checklist (version-3.2)

This section documents the structural refactor on branch `version-3.2`.

### 8.1 Refactor Goal

- Align package responsibilities with ACOS package lifecycle:
	- content-type: only registers/rendering behavior for `jstracing`
	- content: each package owns its own manifest/content registration
	- tool: `quizpet-generator` is loaded as an installed ACOS tool
- Keep existing external URLs stable while decoupling internal code boundaries.

Comment:
- The key principle is separation of concerns. This makes future maintenance (adding new language packages/tools) safer and easier.

### 8.2 New Top-Level Components

Added:
- `acos-jstracing/acos-jstracing-type/`
- `acos-jstracing/acos-jstracing-python/`
- `acos-jstracing/acos-jstracing-java/`
- `acos-quizpet-generator-tool/`

Comment:
- `acos-jstracing-common/` is intentionally not added in this version to avoid premature abstraction; shared logic can be extracted later if duplication grows.

### 8.3 Detailed File Migration and Rationale

1. Content-type package created

Added:
- `acos-jstracing/acos-jstracing-type/index.js`
- `acos-jstracing/acos-jstracing-type/package.json`
- `acos-jstracing/acos-jstracing-type/fetch-quiz.js`
- `acos-jstracing/acos-jstracing-type/static/*`

Comment:
- `index.js` in this package only performs content-type registration and static/tooling mount responsibilities.

2. Python content package separated

Added:
- `acos-jstracing/acos-jstracing-python/index.js`
- `acos-jstracing/acos-jstracing-python/package.json`
- `acos-jstracing/acos-jstracing-python/manifest.json`
- `acos-jstracing/acos-jstracing-python/exercises/*.json`

Comment:
- This package reads its own `manifest.json`, constructs `meta.contents`, and registers itself into `handlers.contentPackages`.

3. Java content package separated

Added:
- `acos-jstracing/acos-jstracing-java/index.js`
- `acos-jstracing/acos-jstracing-java/package.json`
- `acos-jstracing/acos-jstracing-java/manifest.json`
- `acos-jstracing/acos-jstracing-java/exercises/*.json`

Comment:
- Java package registration mirrors Python package behavior and keeps language-specific content ownership local.

4. Root jstracing entrypoint converted to orchestrator

Updated:
- `acos-jstracing/index.js`

Before:
- One file handled content-type registration and both content-package registrations.

After:
- The file delegates registration to:
	- `acos-jstracing-type`
	- `acos-jstracing-python`
	- `acos-jstracing-java`

Comment:
- This is the core boundary change that aligns with the PCEX-style modular model.

5. Root jstracing packaging metadata updated

Updated:
- `acos-jstracing/package.json`

Change:
- Added `acos-jstracing-type/`, `acos-jstracing-python/`, and `acos-jstracing-java/` to the `files` list.

Comment:
- Ensures the new package subtree is included when installing `acos-jstracing`.

6. quizpet-generator extracted as standalone tool package

Added:
- `acos-quizpet-generator-tool/index.js`
- `acos-quizpet-generator-tool/package.json`
- `acos-quizpet-generator-tool/routes/quizpet-generator.js`
- `acos-quizpet-generator-tool/services/quizpet-generator-service.js`
- `acos-quizpet-generator-tool/services/quizpet-topic-options.js`
- `acos-quizpet-generator-tool/views/quizpet-generator.html`

Comment:
- The tool registers itself through `packageType = tool` and `handlers.tools`, which matches ACOS auto-discovery semantics.

7. quizpet-generator route path resolution updated for new layout

Updated:
- `acos-quizpet-generator-tool/routes/quizpet-generator.js`

Change highlights:
- `fetch_quiz` lookup now checks the new content-type package path first.
- content package directory resolution now checks `acos-jstracing/acos-<packageId>` first.
- Legacy paths are kept as fallbacks for compatibility.

Comment:
- This preserves runtime behavior while migrating directory ownership.

8. ACOS core app decoupled from direct generator registration

Updated:
- `acos-server/app.js`

Removed:
- direct `require('./routes/quizpet-generator')`
- direct `registerQuizpetGeneratorRoutes(app, handlers)` call
- manual homepage fallback insertion for quizpet-generator

Kept:
- generic route skip compatibility for `quizpet-generator` and `quizpet-generator-pitts` path patterns

Comment:
- ACOS core now stays package-agnostic; tool registration responsibility moves to the tool package.

9. Docker image wiring updated for tool package installation

Updated:
- `acos-server/Dockerfile`

Added:
- copy/install `./acos-quizpet-generator-tool` into app image

Comment:
- Without this step, auto-discovery would not find the tool in containerized deployments.

### 8.4 Compatibility Notes

- Expected user-facing URLs remain unchanged:
	- `/quizpet-generator`
	- `/quizpet-generator-pitts`
	- `/html/jstracing/jstracing-python/<exercise>`
	- `/html/jstracing/jstracing-java/<exercise>`

Comment:
- This refactor is structural. Functional behavior should remain consistent under the same environment configuration.

### 8.5 Validation Checklist (Post-Refactor)

- ACOS homepage shows `jstracing` in content types.
- ACOS homepage shows both `jstracing-python` and `jstracing-java` content packages.
- ACOS homepage shows `quizpet-generator` in tools (from `handlers.tools`).
- `/quizpet-generator` page loads and APIs respond.
- `/html/jstracing/jstracing-python/sample_quiz` loads.
- `/html/jstracing/jstracing-java/sample_quiz` loads.

Comment:
- If any item fails, first verify package installation paths in container (`acos-server/Dockerfile`) and auto-discovery logs on server startup.

## 9. Existing ACOS Rollback Reference

Quick rollback (container level):

```bash
cd deploy/ec2
docker compose stop quizpet-tomcat quizpet-mysql
git checkout <previous-tag-or-branch>
docker compose up -d --build acos-server
```

Full rollback:
- Restore MySQL volume or logical backup created before go-live.
- Restore previous `.env` and reverse-proxy configuration.