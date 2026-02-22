#!/bin/bash
# ================================================================
# TVDEFleet - Script de Backup MongoDB
# Executa: ./backup-db.sh
# ================================================================

BACKUP_DIR="${BACKUP_DIR:-/opt/tvdefleet/backups/mongodb}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tvdefleet_backup_$DATE"

echo "🗄️ TVDEFleet - Backup MongoDB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Executar backup usando mongodump dentro do container
echo "📦 A criar backup..."
docker exec tvdefleet-mongodb mongodump --db tvdefleet_db --out /backup/temp_$DATE

# Mover backup
docker exec tvdefleet-mongodb mv /backup/temp_$DATE /backup/tvdefleet_backup_$DATE

# Comprimir
echo "🗜️ A comprimir..."
docker exec tvdefleet-mongodb tar -czvf /backup/tvdefleet_backup_$DATE.tar.gz -C /backup tvdefleet_backup_$DATE
docker exec tvdefleet-mongodb rm -rf /backup/tvdefleet_backup_$DATE

# Limpar backups antigos (manter últimos 7)
echo "🧹 A limpar backups antigos..."
ls -t $BACKUP_DIR/*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo ""
echo "✅ Backup concluído: $BACKUP_DIR/tvdefleet_backup_$DATE.tar.gz"
echo ""

# Listar backups
echo "📋 Backups disponíveis:"
ls -lh $BACKUP_DIR/*.tar.gz 2>/dev/null || echo "   Nenhum backup encontrado"
