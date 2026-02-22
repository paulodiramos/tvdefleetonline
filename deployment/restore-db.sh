#!/bin/bash
# ================================================================
# TVDEFleet - Script de Restauração MongoDB
# Executa: ./restore-db.sh [ficheiro_backup]
# ================================================================

BACKUP_DIR="${BACKUP_DIR:-/opt/tvdefleet/backups/mongodb}"

echo "🗄️ TVDEFleet - Restaurar MongoDB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Listar backups disponíveis
echo "📋 Backups disponíveis:"
echo ""
ls -lh $BACKUP_DIR/*.tar.gz 2>/dev/null | nl
echo ""

if [ -z "$1" ]; then
    read -p "Digite o número do backup a restaurar (ou caminho completo): " CHOICE
    
    if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
        BACKUP_FILE=$(ls -t $BACKUP_DIR/*.tar.gz 2>/dev/null | sed -n "${CHOICE}p")
    else
        BACKUP_FILE="$CHOICE"
    fi
else
    BACKUP_FILE="$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Ficheiro não encontrado: $BACKUP_FILE"
    exit 1
fi

echo ""
echo "⚠️ ATENÇÃO: Isto vai SUBSTITUIR todos os dados atuais!"
read -p "Tem a certeza? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "❌ Cancelado"
    exit 0
fi

echo ""
echo "📦 A restaurar $BACKUP_FILE..."

# Copiar para dentro do container
FILENAME=$(basename "$BACKUP_FILE")
docker cp "$BACKUP_FILE" tvdefleet-mongodb:/tmp/

# Extrair e restaurar
docker exec tvdefleet-mongodb bash -c "
    cd /tmp
    tar -xzvf $FILENAME
    FOLDER=\$(basename $FILENAME .tar.gz)
    mongorestore --db tvdefleet_db --drop /tmp/\$FOLDER/tvdefleet_db
    rm -rf /tmp/\$FOLDER /tmp/$FILENAME
"

echo ""
echo "✅ Restauração concluída!"
echo ""
echo "🔄 Reiniciando backend para aplicar mudanças..."
docker restart tvdefleet-backend

echo "✅ Pronto!"
