#!/bin/bash
# Script para restaurar a base de dados automaticamente
# Todas as passwords dos utilizadores são: 123456

echo "=== Restaurando base de dados TVDEFleet ==="

# Copiar dump para o container MongoDB
docker cp /opt/tvdefleet/dump tvdefleet-mongodb:/tmp/

# Restaurar a base de dados
docker exec tvdefleet-mongodb mongorestore --drop /tmp/dump/tvdefleet_db --db tvdefleet_db

# Garantir que as passwords estão corretas (hash para "123456")
docker exec tvdefleet-mongodb mongo tvdefleet_db --eval "db.users.updateMany({}, {\$set: {password: '\$2b\$12\$fGqhLFCbGX4eqCl9Ml82ZuLwiqhxsdIMjm6e1gpjLQCiXOmHnsMHC'}})"

echo "=== Base de dados restaurada com sucesso! ==="
echo "=== Password de todos os utilizadores: 123456 ==="
