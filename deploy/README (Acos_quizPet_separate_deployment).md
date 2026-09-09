# Standalone Deployment Guide: QuizPetAuthoring-only and acos-server-only

This guide is for running services separately in local Docker.

- QuizPetAuthoring-only: run MariaDB + Tomcat without acos-server.
- acos-server-only: run only acos-server and connect to an existing QuizPet endpoint.

## 1. Prerequisites

- Docker and Docker Compose are installed.
- Commands are run from repository root unless otherwise stated.

## 2. QuizPetAuthoring-only (MariaDB + Tomcat)

This mode uses [docker-compose.quizpet.yml](docker-compose.quizpet.yml).

### 2.1 Start

```bash
cd deploy/ec2
docker compose -f docker-compose.quizpet.yml up -d --build --remove-orphans
```

### 2.2 Initialize database

```bash
cd ../..
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/init-db.sql
```

Optional seed import:

```bash
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_user_202604132302.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquestion_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/ent_jquiz_202604132255.sql
docker exec -i quizpet-mysql mariadb -uroot -prootpassword < QuizPetAuthoring/src/main/resources/db/rel_question_quiz_202604132255.sql
```

### 2.3 Access

- QuizPetAuthoring: http://localhost:18080/quizpet

### 2.4 Stop

```bash
cd deploy/ec2
docker compose -f docker-compose.quizpet.yml down
```

## 3. acos-server-only (connect to existing QuizPet)

This mode runs only acos-server from [docker-compose.yml](docker-compose.yml) and skips dependent services.

### 3.1 Configure environment

Edit [deploy/ec2/.env](.env):

- Set QuizPet endpoint to an existing service (example if QuizPetAuthoring-only is on host):

```env
QUIZPET_BASE_URL=http://host.docker.internal:18080/quizpet
QUIZPET_BASE_URL_LOCAL=http://host.docker.internal:18080/quizpet
```

- Keep CheerPJ remote-first defaults:

```env
CHEERPJ_RUNTIME_BASE_URL=https://cjrtnc.leaningtech.com/4.3/
CHEERPJ_DISABLE_SELF_HOST=true
# CHEERPJ_SELF_HOST_DIR=/usr/src/app/acos-jstracing/acos-jstracing-type/static/assets/cheerpj/4.3
```

Notes:
- On macOS and Windows, host.docker.internal works by default.
- If your QuizPet is remote, replace the URL with your remote endpoint.

### 3.2 Start acos-server only

```bash
cd deploy/ec2
docker compose -f docker-compose.yml up -d --build --no-deps acos-server
```

### 3.3 Validate

```bash
cd deploy/ec2
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail=120 acos-server
```

- ACOS homepage: http://localhost:3000/
- Java page example: http://localhost:3000/html/jstracing/jstracing-java/sample_quiz

### 3.4 Stop

```bash
cd deploy/ec2
docker compose -f docker-compose.yml stop acos-server
```

## 4. Common troubleshooting

- Page still uses old JS:
  - Rebuild service and hard-refresh browser cache.
- Java runtime load failed:
  - Verify CHEERPJ_RUNTIME_BASE_URL points to a reachable CDN URL.
  - Keep CHEERPJ_DISABLE_SELF_HOST=true when local CheerpJ assets are incomplete.
- quizpet-generator API fails in acos-server-only mode:
  - Confirm QUIZPET_BASE_URL and credentials in [deploy/ec2/.env](.env).

## 5. Existing ACOS rollout notes (for acos-server-only mode)

If your target already runs ACOS and you only need an incremental deployment:

1. Back up current release metadata:
- running image tags
- container names
- env files

2. Create a rollback tag in your deployment repo:

```bash
git tag before-pitts-quizpet-acos-$(date +%Y%m%d-%H%M)
```

3. Rebuild only `acos-server` without starting dependent services:

```bash
cd deploy/ec2
docker compose -f docker-compose.yml up -d --build --no-deps acos-server
```

4. Validate:
- `/<host>/quizpet-generator`
- `/<host>/quizpet-generator/api/topics`
- `/<host>/html/jstracing/jstracing-java/sample_quiz`

## 6. Quick rollback (acos-server-only mode)

```bash
cd deploy/ec2
git checkout <previous-tag-or-branch>
docker compose -f docker-compose.yml up -d --build --no-deps acos-server
```
