# EC2 deployment (single host, only port 80 exposed)

This deploy recipe runs everything on **one EC2 instance** using Docker Compose:
- `nginx` (public entrypoint, **port 80 only**)
- `acos-server` (serves JSTracing pages + receives `/event`)
- `QuizPetAuthoring` (Tomcat WAR at `/quizpet`)
- `mariadb` (private; bound to `127.0.0.1:3306`)

## 1) EC2 prerequisites

- Amazon Linux 2023 or Ubuntu 22.04 is fine.
- Install Docker + Docker Compose plugin.

Recommended instance type for this project:
- `t4g.small` (ARM64) is typically enough for ~3 users.

Storage:
- 30–60GB gp3 EBS.

Security Group inbound rules (minimum):
- TCP `80` from `0.0.0.0/0`
- (Optional admin) TCP `22` **only from your IP** (or use SSM and do not open 22)

Security Group outbound rules:
- Allow all outbound (default) so containers can reach Pyodide CDN and npm registries.

## 2) Install Docker (examples)

Ubuntu 22.04:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Amazon Linux 2023 (package names may vary):

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker

# docker compose plugin availability depends on repo; if missing, install docker-compose-plugin
sudo dnf install -y docker-compose-plugin || true
docker compose version
```

## 3) Deploy

From the repo root on the EC2 instance:

```bash
cd deploy/ec2

# Optional: make ACOS-generated URLs use your public IP (instead of localhost:3000)
# export SERVER_ADDRESS="http://<EC2_PUBLIC_IP>/"

# Optional: grade forwarding endpoints.
# ACOS now forwards `grade` events by selected protocol (LTI/PAWS/A+/SPLICE, etc.).
# Global fallback:
# export GRADE_FORWARD_URL="http://quizpet-tomcat:8080/quizpet/api/acos/grade"
# Protocol-specific override examples:
# export GRADE_FORWARD_URL_LTI="http://quizpet-tomcat:8080/quizpet/api/acos/grade"
# export GRADE_FORWARD_URL_PAWS="http://quizpet-tomcat:8080/quizpet/api/acos/grade"
# export GRADE_FORWARD_URL_APLUS="http://quizpet-tomcat:8080/quizpet/api/acos/grade"
# export GRADE_FORWARD_URL_SPLICE="http://quizpet-tomcat:8080/quizpet/api/acos/grade"

docker compose up -d --build
```

First boot will initialize DB from `QuizPetAuthoring/init-db.sql`.

## 4) Access

- ACOS/JSTracing content (example):
  - `http://<EC2_PUBLIC_IP>/html/jstracing/jstracing-python/point_above_below`
- QuizPetAuthoring endpoint:
  - `http://<EC2_PUBLIC_IP>/quizpet/api/acos/grade`

## 5) Operations

Check container status:

```bash
cd deploy/ec2
docker compose ps
```

View logs:

```bash
cd deploy/ec2
docker compose logs -f nginx
docker compose logs -f acos-server
docker compose logs -f quizpet-tomcat
docker compose logs -f quizpet-mysql
```

Rebuild after code changes:

```bash
cd deploy/ec2
docker compose up -d --build
```

## 6) View DB safely (no public 3306)

Use SSH port forwarding from your laptop:

```bash
ssh -i <key.pem> -L 3306:127.0.0.1:3306 ec2-user@<EC2_PUBLIC_IP>
```

Then connect your DB client to:
- host: `127.0.0.1`
- port: `3306`
- user: `quizpet`
- password: `quizpet`
- database: `webex21`

Quick SQL from the EC2 host:

```bash
cd deploy/ec2
docker exec -i quizpet-mysql mariadb -uquizpet -pquizpet -e "SELECT COUNT(*) FROM webex21.ent_acos_grade;"
```

## Notes

- If you later buy a domain + HTTPS, you only need to update `nginx` (and optionally set `SERVER_ADDRESS`).
- Database initialization via `/docker-entrypoint-initdb.d` is expected to work on Linux EC2.

If you stop/start the instance, the public IP may change. For a stable IP, allocate and attach an Elastic IP.
