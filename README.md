# QuizPet ACOS Python Tracing Local Docker Deployment Guide

This document explains how to deploy and run `quizpet-acos-python-tracing` locally with Docker after cloning from GitHub.

The process follows three key steps:
1. Start core services with Docker Compose:
	`cd deploy/ec2 && docker compose up -d --build --remove-orphans`
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
git clone <your-repo-url> quizpet-acos-python-tracing
cd quizpet-acos-python-tracing
```

## 3. Start Core Services (MySQL/Tomcat/ACOS)

The deployment file used by this project is `deploy/ec2/docker-compose.yml`.

```bash
cd deploy/ec2
docker compose up -d --build --remove-orphans
```

Notes:
- `acos-server` is built from `../../acos-server/Dockerfile`.
- MySQL is mapped to host `127.0.0.1:3306`.
- ACOS is mapped to host port `3000`.

## 4. Database Initialization (Create Schema, Then Import Seed Data)

### 4.1 Run init-db.sql (Create Databases and Tables)

`init-db.sql` creates required databases, user grants, and core table schemas.

Run from repository root:

```bash 
# quizpet-mysql database :
# user/password: root/rootpassword
cd /absolute/path/to/quizpet-acos-python-tracing
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/init-db.sql
```

Alternative (from anywhere):

```bash
cd /absolute/path/to/quizpet-acos-python-tracing
# or: cd "$(git rev-parse --show-toplevel)"
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/init-db.sql
```

### 4.2 Import Seed SQL Files from resources/db

Import in the following order (recommended):

```bash
cd /absolute/path/to/quizpet-acos-python-tracing

docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquestion-topics.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_jquizes.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-ent_user-testuser.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-rel_question_quiz-topics.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/insert-sample-rel_question_quiz-quizes.sql
```

Notes:
- `insert-sample-ent_jquiz(bak).sql` is a backup/reference script and is usually not required.
- These scripts use `USE webex21;`, so keep the import order aligned with schema dependencies.

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