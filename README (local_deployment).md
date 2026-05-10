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
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE quizpet; TRUNCATE TABLE ent_user;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_user_202604132302.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_user-testuser.sql

# Reproducible ID layout for quiz/topic:
# 1) dump data uses AUTO_INCREMENT from 1
# 2) sample data keeps fixed IDs range (900+)
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE quizpet; TRUNCATE TABLE ent_jquestion; ALTER TABLE ent_jquestion AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquestion_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquestion.sql

docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE quizpet; TRUNCATE TABLE ent_jquiz; ALTER TABLE ent_jquiz AUTO_INCREMENT=1;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquizes.sql

# Data patch: fill missing rdfIdDisplay for imported ent_jquiz rows
docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE quizpet; UPDATE ent_jquiz SET rdfIdDisplay = 'q_java' WHERE QuizID BETWEEN 1 AND 255 AND (rdfIdDisplay IS NULL OR TRIM(rdfIdDisplay) = '');"

docker exec quizpet-mysql mariadb -uroot -prootpassword -e "USE quizpet; TRUNCATE TABLE rel_question_quiz;"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/rel_question_quiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-rel_question_quiz.sql
```

Notes:
- The sample scripts now use `USE quizpet;`.
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