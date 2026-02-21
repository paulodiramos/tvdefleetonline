#!/bin/bash
# ===========================================
# TVDEFleet - Configuração SSL (Let's Encrypt)
# ===========================================

set -e

DOMAIN=${1:-tvdefleet.com}
EMAIL=${2:-admin@tvdefleet.com}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Configurando SSL para: $DOMAIN${NC}"

# Verificar se domínio foi fornecido
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Uso: ./setup-ssl.sh dominio.com email@exemplo.com${NC}"
    exit 1
fi

# Criar diretórios
mkdir -p deployment/ssl
mkdir -p /var/www/certbot

# Criar configuração temporária nginx (sem SSL)
cat > deployment/nginx-temp.conf << 'EOF'
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'OK';
    }
}
EOF

# Substituir variável
sed -i "s/\${DOMAIN}/$DOMAIN/g" deployment/nginx-temp.conf

echo -e "${YELLOW}[1/4] Iniciando nginx temporário...${NC}"

# Parar containers existentes
docker-compose down 2>/dev/null || true

# Iniciar nginx temporário
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/deployment/nginx-temp.conf:/etc/nginx/conf.d/default.conf:ro \
    -v /var/www/certbot:/var/www/certbot \
    nginx:alpine

sleep 5

echo -e "${YELLOW}[2/4] Obtendo certificado SSL...${NC}"

# Obter certificado
docker run --rm \
    -v $(pwd)/deployment/ssl:/etc/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

echo -e "${YELLOW}[3/4] Parando nginx temporário...${NC}"
docker stop nginx-temp
docker rm nginx-temp
rm deployment/nginx-temp.conf

echo -e "${YELLOW}[4/4] Atualizando configuração nginx...${NC}"

# Atualizar nginx-proxy.conf com o domínio correto
sed -i "s/tvdefleet.com/$DOMAIN/g" deployment/nginx-proxy.conf

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║        SSL Configurado com Sucesso!           ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "Certificados em: $(pwd)/deployment/ssl/"
echo ""
echo -e "${BLUE}Inicie a aplicação com:${NC}"
echo "docker-compose up -d"
echo ""
echo -e "${YELLOW}Renovação automática configurada via Certbot${NC}"
