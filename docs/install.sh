#!/bin/bash

# =============================================================================
# TVDEFleet - Script de Instalação Automática para Ubuntu 22.04
# =============================================================================
# 
# USO: 
#   chmod +x install.sh
#   sudo ./install.sh
#
# ANTES DE EXECUTAR:
#   1. Ter domínio a apontar para o IP do servidor
#   2. Ter acesso root ao servidor
#   3. Editar as variáveis abaixo
# =============================================================================

set -e

# =============================================================================
# CONFIGURAÇÕES - EDITAR ANTES DE EXECUTAR
# =============================================================================
DOMAIN="seudominio.pt"                    # Alterar para o seu domínio
MONGO_APP_PASSWORD="MudarEstaPassword123" # Password do MongoDB para a app
JWT_SECRET=$(openssl rand -hex 32)        # Gerado automaticamente
APP_USER="tvdefleet"                      # Utilizador do sistema
APP_DIR="/var/www/tvdefleet"              # Diretório da aplicação
GITHUB_REPO=""                            # URL do repositório GitHub (opcional)

# =============================================================================
# CORES PARA OUTPUT
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# FUNÇÕES AUXILIARES
# =============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# VERIFICAÇÕES INICIAIS
# =============================================================================
echo ""
echo "=============================================="
echo "   TVDEFleet - Instalação Automática"
echo "=============================================="
echo ""

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script deve ser executado como root (sudo)"
   exit 1
fi

# Verificar domínio
if [[ "$DOMAIN" == "seudominio.pt" ]]; then
    log_error "Por favor, edite o script e configure o seu domínio"
    exit 1
fi

log_info "Domínio: $DOMAIN"
log_info "Utilizador: $APP_USER"
log_info "Diretório: $APP_DIR"
echo ""

read -p "Continuar com a instalação? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

# =============================================================================
# 1. ATUALIZAR SISTEMA
# =============================================================================
log_info "A atualizar sistema..."
apt update && apt upgrade -y
apt install -y curl wget git unzip software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release ufw

log_success "Sistema atualizado"

# =============================================================================
# 2. CRIAR UTILIZADOR
# =============================================================================
log_info "A criar utilizador $APP_USER..."
if id "$APP_USER" &>/dev/null; then
    log_warning "Utilizador $APP_USER já existe"
else
    useradd -m -s /bin/bash $APP_USER
    usermod -aG sudo $APP_USER
    log_success "Utilizador $APP_USER criado"
fi

# =============================================================================
# 3. CONFIGURAR FIREWALL
# =============================================================================
log_info "A configurar firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
log_success "Firewall configurado"

# =============================================================================
# 4. INSTALAR MONGODB
# =============================================================================
log_info "A instalar MongoDB..."
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
   gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   tee /etc/apt/sources.list.d/mongodb-org-7.0.list

apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

log_success "MongoDB instalado"

# =============================================================================
# 5. CONFIGURAR MONGODB
# =============================================================================
log_info "A configurar MongoDB..."

# Esperar MongoDB iniciar
sleep 5

# Criar utilizadores
mongosh --eval "
use tvdefleet_db
db.createUser({
  user: 'tvdefleet_app',
  pwd: '$MONGO_APP_PASSWORD',
  roles: [ { role: 'readWrite', db: 'tvdefleet_db' } ]
})
" || log_warning "Utilizador MongoDB pode já existir"

# Ativar autenticação
cat > /etc/mongod.conf << EOF
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: enabled
EOF

systemctl restart mongod
log_success "MongoDB configurado"

# =============================================================================
# 6. INSTALAR PYTHON
# =============================================================================
log_info "A instalar Python 3.11..."
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3.11-dev
log_success "Python 3.11 instalado"

# =============================================================================
# 7. INSTALAR NODE.JS
# =============================================================================
log_info "A instalar Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g yarn
log_success "Node.js e Yarn instalados"

# =============================================================================
# 8. CRIAR ESTRUTURA DE DIRETÓRIOS
# =============================================================================
log_info "A criar estrutura de diretórios..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/backend/uploads
mkdir -p $APP_DIR/backend/logs
mkdir -p $APP_DIR/frontend
mkdir -p /opt/scripts
mkdir -p /var/backups/tvdefleet
chown -R $APP_USER:$APP_USER $APP_DIR
log_success "Diretórios criados"

# =============================================================================
# 9. INSTALAR NGINX
# =============================================================================
log_info "A instalar Nginx..."
apt install -y nginx
systemctl enable nginx
log_success "Nginx instalado"

# =============================================================================
# 10. INSTALAR CERTBOT
# =============================================================================
log_info "A instalar Certbot..."
apt install -y certbot python3-certbot-nginx
log_success "Certbot instalado"

# =============================================================================
# 11. CRIAR CONFIGURAÇÃO NGINX (SEM SSL INICIALMENTE)
# =============================================================================
log_info "A configurar Nginx..."
cat > /etc/nginx/sites-available/tvdefleet << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 10M;
    root $APP_DIR/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location /uploads/ {
        alias $APP_DIR/backend/uploads/;
        expires 30d;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/tvdefleet /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
log_success "Nginx configurado"

# =============================================================================
# 12. CRIAR FICHEIROS .ENV
# =============================================================================
log_info "A criar ficheiros de configuração..."

# Backend .env
cat > $APP_DIR/backend/.env << EOF
MONGO_URL=mongodb://tvdefleet_app:$MONGO_APP_PASSWORD@127.0.0.1:27017/tvdefleet_db?authSource=tvdefleet_db
DB_NAME=tvdefleet_db
JWT_SECRET=$JWT_SECRET
ENVIRONMENT=production
FRONTEND_URL=https://$DOMAIN
UPLOAD_DIR=$APP_DIR/backend/uploads
MAX_UPLOAD_SIZE=10485760
EOF

# Frontend .env
cat > $APP_DIR/frontend/.env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
REACT_APP_ENV=production
EOF

chown -R $APP_USER:$APP_USER $APP_DIR
log_success "Ficheiros .env criados"

# =============================================================================
# 13. CRIAR SERVIÇO SYSTEMD
# =============================================================================
log_info "A criar serviço systemd..."
cat > /etc/systemd/system/tvdefleet-backend.service << EOF
[Unit]
Description=TVDEFleet Backend API
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/gunicorn server:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8001 \
    --timeout 120 \
    --access-logfile $APP_DIR/backend/logs/access.log \
    --error-logfile $APP_DIR/backend/logs/error.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
log_success "Serviço systemd criado"

# =============================================================================
# 14. CRIAR SCRIPT DE BACKUP
# =============================================================================
log_info "A criar script de backup..."
cat > /opt/scripts/backup-tvdefleet.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/tvdefleet"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_USER="tvdefleet_app"
MONGO_DB="tvdefleet_db"
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --db $MONGO_DB --username $MONGO_USER --authenticationDatabase $MONGO_DB --out $BACKUP_DIR/mongo_$DATE 2>/dev/null
tar -czvf $BACKUP_DIR/mongo_$DATE.tar.gz -C $BACKUP_DIR mongo_$DATE
rm -rf $BACKUP_DIR/mongo_$DATE

# Backup uploads
tar -czvf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/tvdefleet/backend/uploads 2>/dev/null

# Limpar backups antigos
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup concluído: $DATE"
EOF

chmod +x /opt/scripts/backup-tvdefleet.sh

# Adicionar ao crontab
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/scripts/backup-tvdefleet.sh >> /var/log/tvdefleet-backup.log 2>&1") | crontab -

log_success "Script de backup configurado"

# =============================================================================
# RESUMO FINAL
# =============================================================================
echo ""
echo "=============================================="
echo "   INSTALAÇÃO CONCLUÍDA!"
echo "=============================================="
echo ""
log_success "Sistema base instalado"
echo ""
echo "PRÓXIMOS PASSOS:"
echo ""
echo "1. CLONAR O CÓDIGO:"
echo "   cd $APP_DIR"
echo "   git clone SEU_REPO ."
echo ""
echo "2. CONFIGURAR BACKEND:"
echo "   cd $APP_DIR/backend"
echo "   python3.11 -m venv venv"
echo "   source venv/bin/activate"
echo "   pip install -r requirements.txt"
echo "   pip install gunicorn uvicorn[standard]"
echo ""
echo "3. CONFIGURAR FRONTEND:"
echo "   cd $APP_DIR/frontend"
echo "   yarn install"
echo "   yarn build"
echo ""
echo "4. ATIVAR SSL:"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "5. INICIAR BACKEND:"
echo "   systemctl enable tvdefleet-backend"
echo "   systemctl start tvdefleet-backend"
echo ""
echo "=============================================="
echo "CREDENCIAIS GERADAS:"
echo "=============================================="
echo "MongoDB Password: $MONGO_APP_PASSWORD"
echo "JWT Secret: $JWT_SECRET"
echo ""
echo "GUARDE ESTAS CREDENCIAIS EM LOCAL SEGURO!"
echo "=============================================="
