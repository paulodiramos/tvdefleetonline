#!/bin/bash
# ===========================================
# TVDEFleet - Script de Instalação VPS
# ===========================================
# Servidor: 94.46.171.222
# Sistema: Ubuntu/Debian
# ===========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     TVDEFleet - Instalação Automática         ║"
echo "║         VPS: 94.46.171.222                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Por favor, execute como root (sudo ./install.sh)${NC}"
    exit 1
fi

# Atualizar sistema
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
apt-get update && apt-get upgrade -y

# Instalar dependências
echo -e "${YELLOW}[2/8] Instalando dependências...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Instalar Docker
echo -e "${YELLOW}[3/8] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}Docker já instalado${NC}"
fi

# Instalar Docker Compose
echo -e "${YELLOW}[4/8] Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}Docker Compose já instalado${NC}"
fi

# Criar diretório da aplicação
echo -e "${YELLOW}[5/8] Criando diretórios...${NC}"
APP_DIR="/opt/tvdefleet"
mkdir -p $APP_DIR
cd $APP_DIR

# Configurar Firewall
echo -e "${YELLOW}[6/8] Configurando Firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Criar ficheiro .env se não existir
echo -e "${YELLOW}[7/8] Verificando configuração...${NC}"
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${YELLOW}Ficheiro .env não encontrado!${NC}"
    echo -e "${YELLOW}Copie o .env.example para .env e configure as variáveis${NC}"
    cp deployment/.env.example .env 2>/dev/null || echo "Crie o ficheiro .env manualmente"
fi

# Instruções finais
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Instalação de Dependências Completa!      ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}Próximos passos:${NC}"
echo ""
echo "1. Copie os ficheiros do projeto para: $APP_DIR"
echo "   scp -r /app/* root@94.46.171.222:$APP_DIR/"
echo ""
echo "2. Configure o ficheiro .env:"
echo "   nano $APP_DIR/.env"
echo ""
echo "3. Inicie os containers:"
echo "   cd $APP_DIR && docker-compose up -d"
echo ""
echo "4. (Opcional) Configure SSL com Let's Encrypt:"
echo "   ./setup-ssl.sh tvdefleet.com"
echo ""
echo -e "${GREEN}Servidor pronto para TVDEFleet!${NC}"
