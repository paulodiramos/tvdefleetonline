#!/bin/bash
# ===========================================
# TVDEFleet - Script de Deploy
# ===========================================
# Uso: ./deploy.sh [build|start|stop|restart|logs|status]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/tvdefleet"

show_help() {
    echo -e "${BLUE}TVDEFleet - Comandos de Deploy${NC}"
    echo ""
    echo "Uso: ./deploy.sh [comando]"
    echo ""
    echo "Comandos:"
    echo "  build     - Construir imagens Docker"
    echo "  start     - Iniciar todos os serviços"
    echo "  stop      - Parar todos os serviços"
    echo "  restart   - Reiniciar todos os serviços"
    echo "  logs      - Ver logs (todos os serviços)"
    echo "  logs-be   - Ver logs do backend"
    echo "  logs-fe   - Ver logs do frontend"
    echo "  logs-db   - Ver logs do MongoDB"
    echo "  status    - Ver estado dos serviços"
    echo "  update    - Atualizar e reiniciar"
    echo "  backup    - Fazer backup da base de dados"
    echo "  shell-be  - Aceder ao shell do backend"
    echo "  shell-db  - Aceder ao MongoDB shell"
}

case "$1" in
    build)
        echo -e "${YELLOW}Construindo imagens...${NC}"
        docker-compose build --no-cache
        echo -e "${GREEN}Build completo!${NC}"
        ;;
    
    start)
        echo -e "${YELLOW}Iniciando serviços...${NC}"
        docker-compose up -d
        echo -e "${GREEN}Serviços iniciados!${NC}"
        docker-compose ps
        ;;
    
    stop)
        echo -e "${YELLOW}Parando serviços...${NC}"
        docker-compose down
        echo -e "${GREEN}Serviços parados!${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}Reiniciando serviços...${NC}"
        docker-compose restart
        echo -e "${GREEN}Serviços reiniciados!${NC}"
        ;;
    
    logs)
        docker-compose logs -f --tail=100
        ;;
    
    logs-be)
        docker-compose logs -f --tail=100 backend
        ;;
    
    logs-fe)
        docker-compose logs -f --tail=100 frontend
        ;;
    
    logs-db)
        docker-compose logs -f --tail=100 mongodb
        ;;
    
    status)
        echo -e "${BLUE}Estado dos serviços:${NC}"
        docker-compose ps
        echo ""
        echo -e "${BLUE}Uso de recursos:${NC}"
        docker stats --no-stream
        ;;
    
    update)
        echo -e "${YELLOW}Atualizando aplicação...${NC}"
        git pull origin main 2>/dev/null || echo "Git pull ignorado"
        docker-compose build
        docker-compose up -d
        echo -e "${GREEN}Atualização completa!${NC}"
        ;;
    
    backup)
        BACKUP_DIR="$APP_DIR/backups"
        BACKUP_FILE="tvdefleet_backup_$(date +%Y%m%d_%H%M%S).gz"
        mkdir -p $BACKUP_DIR
        
        echo -e "${YELLOW}Criando backup da base de dados...${NC}"
        docker-compose exec -T mongodb mongodump --archive --gzip --db=tvdefleet_db > "$BACKUP_DIR/$BACKUP_FILE"
        
        echo -e "${GREEN}Backup criado: $BACKUP_DIR/$BACKUP_FILE${NC}"
        
        # Manter apenas últimos 7 backups
        ls -tp $BACKUP_DIR/*.gz | tail -n +8 | xargs -I {} rm -- {} 2>/dev/null || true
        ;;
    
    shell-be)
        docker-compose exec backend /bin/bash
        ;;
    
    shell-db)
        docker-compose exec mongodb mongosh tvdefleet_db
        ;;
    
    *)
        show_help
        ;;
esac
