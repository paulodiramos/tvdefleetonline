#!/bin/bash
# ================================================================
# TVDEFleet - Script de Status e Manutenção
# Executa: ./status.sh
# ================================================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              TVDEFleet - Status do Sistema                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Diretório de trabalho
WORK_DIR="${WORK_DIR:-/opt/tvdefleet/deployment}"
cd "$WORK_DIR" 2>/dev/null || cd "$(dirname "$0")"

# ==================== Status dos Containers ====================
echo "🐳 CONTAINERS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "tvdefleet|NAMES" || echo "   Nenhum container TVDEFleet a correr"
echo ""

# ==================== Uso de Recursos ====================
echo "📊 USO DE RECURSOS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "tvdefleet|NAME" 2>/dev/null || echo "   Não foi possível obter estatísticas"
echo ""

# ==================== Volumes ====================
echo "💾 VOLUMES (Dados Persistentes):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker volume ls --format "table {{.Name}}\t{{.Driver}}" | grep -E "tvdefleet|NAME" || echo "   Nenhum volume encontrado"
echo ""

# ==================== Espaço em Disco ====================
echo "📁 ESPAÇO EM DISCO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
df -h / | head -2
echo ""

# ==================== MongoDB ====================
echo "🗄️ MONGODB:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker ps | grep -q tvdefleet-mongodb; then
    docker exec tvdefleet-mongodb mongosh --quiet --eval "
        db = db.getSiblingDB('tvdefleet_db');
        print('   Base de dados: tvdefleet_db');
        print('   Coleções: ' + db.getCollectionNames().length);
        print('   Parceiros: ' + db.parceiros.countDocuments());
        print('   Motoristas: ' + db.motoristas.countDocuments());
        print('   Veículos: ' + db.veiculos.countDocuments());
        print('   Sessões Uber: ' + db.uber_sessions.countDocuments());
    " 2>/dev/null || echo "   Erro ao conectar ao MongoDB"
else
    echo "   ❌ MongoDB não está a correr"
fi
echo ""

# ==================== Sessões RPA ====================
echo "🤖 SESSÕES RPA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker ps | grep -q tvdefleet-backend; then
    docker exec tvdefleet-backend bash -c "
        echo '   Sessões Uber: ' \$(ls /app/data/uber_sessions 2>/dev/null | wc -l)
        echo '   Sessões Bolt: ' \$(ls /app/data/bolt_sessions 2>/dev/null | wc -l)
        echo '   Sessões Via Verde: ' \$(ls /app/data/viaverde_sessions 2>/dev/null | wc -l)
    " 2>/dev/null || echo "   Erro ao verificar sessões"
else
    echo "   ❌ Backend não está a correr"
fi
echo ""

# ==================== Últimos Logs ====================
echo "📋 ÚLTIMOS LOGS (Backend):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs tvdefleet-backend --tail 5 2>&1 | head -5 || echo "   Não há logs disponíveis"
echo ""

# ==================== Comandos Úteis ====================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Comandos Úteis                          ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Ver logs:      docker compose logs -f                     ║"
echo "║  Reiniciar:     systemctl restart tvdefleet                ║"
echo "║  Parar:         systemctl stop tvdefleet                   ║"
echo "║  Backup BD:     ./backup-db.sh                             ║"
echo "║  Restaurar BD:  ./restore-db.sh                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
