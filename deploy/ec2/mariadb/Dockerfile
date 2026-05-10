FROM mariadb:10.5

# Bake the init SQL into the image so it works in:
# - Rancher Desktop / Docker Desktop VMs (macOS file sharing/TCC issues)
# - Remote Docker daemons
# - Kubernetes/Rancher workloads (no local hostPath)
COPY QuizPetAuthoring/init-db.sql /docker-entrypoint-initdb.d/01-init-db.sql
