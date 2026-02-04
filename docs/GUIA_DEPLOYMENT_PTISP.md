# 🚀 Guia Completo de Deployment - TVDEFleet

## Índice
1. [Requisitos do Servidor](#1-requisitos-do-servidor)
2. [Preparação Inicial](#2-preparação-inicial)
3. [Instalação do MongoDB](#3-instalação-do-mongodb)
4. [Configuração do Backend (FastAPI)](#4-configuração-do-backend-fastapi)
5. [Configuração do Frontend (React)](#5-configuração-do-frontend-react)
6. [Configuração do Nginx](#6-configuração-do-nginx)
7. [Certificado SSL (HTTPS)](#7-certificado-ssl-https)
8. [Configuração do Systemd](#8-configuração-do-systemd)
9. [Variáveis de Ambiente](#9-variáveis-de-ambiente)
10. [Geração do APK (App Móvel)](#10-geração-do-apk-app-móvel)
11. [Migração da Base de Dados](#11-migração-da-base-de-dados)
12. [Backup e Manutenção](#12-backup-e-manutenção)
13. [Troubleshooting](#13-troubleshooting)
14. [Checklist Final](#14-checklist-final)

---

## 1. Requisitos do Servidor

### Hardware Mínimo Recomendado
| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| Sistema | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Portas Necessárias
| Porta | Serviço | Descrição |
|-------|---------|-----------|
| 22 | SSH | Acesso remoto |
| 80 | HTTP | Redirecionamento para HTTPS |
| 443 | HTTPS | Tráfego web seguro |
| 27017 | MongoDB | Base de dados (apenas localhost) |

### Planos PTISP Compatíveis
- ✅ **VPS Linux** - Funciona perfeitamente
- ✅ **Cloud Server** - Funciona perfeitamente
- ❌ **Hosting Partilhado** - NÃO compatível (sem acesso root)

---

## 2. Preparação Inicial

### 2.1 Aceder ao Servidor via SSH
```bash
# No seu computador local
ssh root@SEU_IP_SERVIDOR

# Ou se tiver chave SSH configurada
ssh -i ~/.ssh/sua_chave root@SEU_IP_SERVIDOR
```

### 2.2 Atualizar o Sistema
```bash
# Atualizar lista de pacotes
sudo apt update

# Atualizar todos os pacotes
sudo apt upgrade -y

# Instalar ferramentas essenciais
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 2.3 Criar Utilizador Dedicado (Segurança)
```bash
# Criar utilizador para a aplicação
sudo adduser tvdefleet

# Adicionar ao grupo sudo
sudo usermod -aG sudo tvdefleet

# Mudar para o novo utilizador
su - tvdefleet
```

### 2.4 Configurar Firewall (UFW)
```bash
# Ativar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verificar status
sudo ufw status
```

---

## 3. Instalação do MongoDB

### 3.1 Adicionar Repositório Oficial
```bash
# Importar chave GPG do MongoDB
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor

# Adicionar repositório
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Atualizar lista de pacotes
sudo apt update
```

### 3.2 Instalar MongoDB
```bash
# Instalar MongoDB
sudo apt install -y mongodb-org

# Iniciar MongoDB
sudo systemctl start mongod

# Ativar início automático
sudo systemctl enable mongod

# Verificar status
sudo systemctl status mongod
```

### 3.3 Configurar Segurança do MongoDB
```bash
# Aceder à shell do MongoDB
mongosh

# Criar utilizador administrador
use admin
db.createUser({
  user: "admin",
  pwd: "ESCOLHA_UMA_PASSWORD_FORTE",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Criar utilizador para a aplicação
use tvdefleet_db
db.createUser({
  user: "tvdefleet_app",
  pwd: "OUTRA_PASSWORD_FORTE",
  roles: [ { role: "readWrite", db: "tvdefleet_db" } ]
})

# Sair
exit
```

### 3.4 Ativar Autenticação
```bash
# Editar configuração do MongoDB
sudo nano /etc/mongod.conf
```

Adicionar/modificar as seguintes linhas:
```yaml
# Segurança
security:
  authorization: enabled

# Rede - apenas localhost
net:
  port: 27017
  bindIp: 127.0.0.1
```

Reiniciar MongoDB:
```bash
sudo systemctl restart mongod
```

---

## 4. Configuração do Backend (FastAPI)

### 4.1 Instalar Python 3.11
```bash
# Adicionar repositório
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update

# Instalar Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Verificar instalação
python3.11 --version
```

### 4.2 Clonar o Projeto
```bash
# Criar diretório
sudo mkdir -p /var/www/tvdefleet
sudo chown tvdefleet:tvdefleet /var/www/tvdefleet

# Clonar do GitHub (após "Save to GitHub")
cd /var/www/tvdefleet
git clone https://github.com/SEU_USUARIO/tvdefleet.git .

# Ou se tiver o código em ZIP
# unzip tvdefleet.zip -d /var/www/tvdefleet
```

### 4.3 Configurar Ambiente Virtual
```bash
cd /var/www/tvdefleet/backend

# Criar ambiente virtual
python3.11 -m venv venv

# Ativar ambiente virtual
source venv/bin/activate

# Atualizar pip
pip install --upgrade pip

# Instalar dependências
pip install -r requirements.txt

# Instalar Gunicorn (servidor de produção)
pip install gunicorn uvicorn[standard]
```

### 4.4 Criar Ficheiro .env do Backend
```bash
nano /var/www/tvdefleet/backend/.env
```

Conteúdo:
```env
# Base de Dados MongoDB
MONGO_URL=mongodb://tvdefleet_app:OUTRA_PASSWORD_FORTE@127.0.0.1:27017/tvdefleet_db?authSource=tvdefleet_db
DB_NAME=tvdefleet_db

# JWT Secret (gerar uma string aleatória)
JWT_SECRET=GERAR_STRING_ALEATORIA_LONGA_AQUI_COM_64_CARACTERES_MINIMO

# Ambiente
ENVIRONMENT=production

# URL do Frontend (para CORS)
FRONTEND_URL=https://seudominio.pt

# Chaves de API (se usar)
# OPENAI_API_KEY=sk-...
# EMERGENT_LLM_KEY=...

# Upload de Ficheiros
UPLOAD_DIR=/var/www/tvdefleet/backend/uploads
MAX_UPLOAD_SIZE=10485760
```

### 4.5 Criar Diretórios Necessários
```bash
mkdir -p /var/www/tvdefleet/backend/uploads
mkdir -p /var/www/tvdefleet/backend/logs
chmod 755 /var/www/tvdefleet/backend/uploads
```

### 4.6 Testar Backend Manualmente
```bash
cd /var/www/tvdefleet/backend
source venv/bin/activate

# Testar se inicia sem erros
uvicorn server:app --host 0.0.0.0 --port 8001

# Se funcionar, pressionar Ctrl+C para parar
```

---

## 5. Configuração do Frontend (React)

### 5.1 Instalar Node.js 20 LTS
```bash
# Instalar NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recarregar shell
source ~/.bashrc

# Instalar Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verificar instalação
node --version
npm --version
```

### 5.2 Instalar Yarn
```bash
npm install -g yarn
```

### 5.3 Configurar Frontend
```bash
cd /var/www/tvdefleet/frontend

# Instalar dependências
yarn install
```

### 5.4 Criar Ficheiro .env do Frontend
```bash
nano /var/www/tvdefleet/frontend/.env
```

Conteúdo:
```env
# URL da API Backend (com /api)
REACT_APP_BACKEND_URL=https://seudominio.pt

# Ambiente
REACT_APP_ENV=production
```

### 5.5 Build de Produção
```bash
cd /var/www/tvdefleet/frontend

# Criar build de produção
yarn build

# Os ficheiros ficam em /var/www/tvdefleet/frontend/build
```

---

## 6. Configuração do Nginx

### 6.1 Instalar Nginx
```bash
sudo apt install -y nginx

# Verificar status
sudo systemctl status nginx
```

### 6.2 Criar Configuração do Site
```bash
sudo nano /etc/nginx/sites-available/tvdefleet
```

Conteúdo completo:
```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name seudominio.pt www.seudominio.pt;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS Principal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name seudominio.pt www.seudominio.pt;

    # Certificados SSL (serão criados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/seudominio.pt/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.pt/privkey.pem;
    
    # Configurações SSL Seguras
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Logs
    access_log /var/log/nginx/tvdefleet_access.log;
    error_log /var/log/nginx/tvdefleet_error.log;

    # Tamanho máximo de upload (10MB)
    client_max_body_size 10M;

    # Raiz do Frontend
    root /var/www/tvdefleet/frontend/build;
    index index.html;

    # Headers de Segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;

    # API Backend - Proxy para FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Ficheiros de Upload/Static do Backend
    location /uploads/ {
        alias /var/www/tvdefleet/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Ficheiros Estáticos do React (JS, CSS, imagens)
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Código da App Móvel
    location /ExpoSnackCode.txt {
        alias /var/www/tvdefleet/frontend/build/ExpoSnackCode.txt;
        add_header Content-Type text/plain;
    }

    # React Router - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bloquear acesso a ficheiros sensíveis
    location ~ /\. {
        deny all;
    }

    location ~ \.env$ {
        deny all;
    }
}
```

### 6.3 Ativar o Site
```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/tvdefleet /etc/nginx/sites-enabled/

# Remover site default (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Se OK, recarregar Nginx
sudo systemctl reload nginx
```

---

## 7. Certificado SSL (HTTPS)

### 7.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obter Certificado SSL Gratuito
```bash
# Antes de executar, comentar temporariamente as linhas SSL no nginx
# porque ainda não temos o certificado

sudo certbot --nginx -d seudominio.pt -d www.seudominio.pt
```

Seguir as instruções:
1. Introduzir email para notificações
2. Aceitar termos de serviço
3. Escolher redirecionar HTTP para HTTPS (opção 2)

### 7.3 Configurar Renovação Automática
```bash
# Testar renovação
sudo certbot renew --dry-run

# Adicionar ao crontab (já é automático, mas para confirmar)
sudo crontab -e
```

Adicionar:
```cron
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 8. Configuração do Systemd

### 8.1 Criar Serviço do Backend
```bash
sudo nano /etc/systemd/system/tvdefleet-backend.service
```

Conteúdo:
```ini
[Unit]
Description=TVDEFleet Backend API
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=tvdefleet
Group=tvdefleet
WorkingDirectory=/var/www/tvdefleet/backend
Environment="PATH=/var/www/tvdefleet/backend/venv/bin"
EnvironmentFile=/var/www/tvdefleet/backend/.env
ExecStart=/var/www/tvdefleet/backend/venv/bin/gunicorn server:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8001 \
    --timeout 120 \
    --access-logfile /var/www/tvdefleet/backend/logs/access.log \
    --error-logfile /var/www/tvdefleet/backend/logs/error.log
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8.2 Ativar e Iniciar Serviço
```bash
# Recarregar systemd
sudo systemctl daemon-reload

# Ativar início automático
sudo systemctl enable tvdefleet-backend

# Iniciar serviço
sudo systemctl start tvdefleet-backend

# Verificar status
sudo systemctl status tvdefleet-backend

# Ver logs em tempo real
sudo journalctl -u tvdefleet-backend -f
```

### 8.3 Comandos Úteis
```bash
# Reiniciar backend
sudo systemctl restart tvdefleet-backend

# Parar backend
sudo systemctl stop tvdefleet-backend

# Ver logs
sudo journalctl -u tvdefleet-backend --since "1 hour ago"
```

---

## 9. Variáveis de Ambiente

### 9.1 Resumo de Todas as Variáveis

#### Backend (.env)
```env
# MongoDB
MONGO_URL=mongodb://tvdefleet_app:PASSWORD@127.0.0.1:27017/tvdefleet_db?authSource=tvdefleet_db
DB_NAME=tvdefleet_db

# Segurança
JWT_SECRET=string_aleatoria_de_64_caracteres_ou_mais

# Ambiente
ENVIRONMENT=production
FRONTEND_URL=https://seudominio.pt

# Uploads
UPLOAD_DIR=/var/www/tvdefleet/backend/uploads
MAX_UPLOAD_SIZE=10485760

# APIs Externas (opcional)
OPENAI_API_KEY=sk-...
EMERGENT_LLM_KEY=...
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=https://seudominio.pt
REACT_APP_ENV=production
```

### 9.2 Gerar JWT Secret Seguro
```bash
# Gerar string aleatória
openssl rand -hex 32
```

---

## 10. Geração do APK (App Móvel)

### 10.1 Preparação Local (No Seu Computador)

```bash
# Instalar Expo CLI globalmente
npm install -g expo-cli eas-cli

# Fazer login no Expo
eas login
```

### 10.2 Criar Projeto Expo
```bash
# Criar novo projeto
npx create-expo-app tvdefleet-mobile
cd tvdefleet-mobile

# Copiar o código do ExpoSnackCode.js para App.js
# (adaptar imports conforme necessário)
```

### 10.3 Configurar app.json
```json
{
  "expo": {
    "name": "TVDEFleet Drivers",
    "slug": "tvdefleet-drivers",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "pt.seudominio.tvdefleet"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "package": "pt.seudominio.tvdefleet",
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "extra": {
      "apiUrl": "https://seudominio.pt/api"
    }
  }
}
```

### 10.4 Configurar eas.json
```bash
eas build:configure
```

Editar `eas.json`:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 10.5 Gerar APK
```bash
# Build de produção (APK)
eas build --platform android --profile production

# Ou build de preview para teste
eas build --platform android --profile preview
```

### 10.6 Download do APK
Após a build completar, receberá um link para download do APK.

### 10.7 Atualizar API URL na App
No código da app, alterar:
```javascript
const API_URL = 'https://seudominio.pt/api';
```

---

## 11. Migração da Base de Dados

### 11.1 Exportar da Emergent (MongoDB)

```bash
# Na plataforma Emergent, aceder ao terminal e exportar
mongodump --db tvdefleet_db --out /tmp/backup

# Comprimir
tar -czvf tvdefleet_db_backup.tar.gz /tmp/backup/tvdefleet_db
```

### 11.2 Transferir para o Servidor
```bash
# Do seu computador local
scp tvdefleet_db_backup.tar.gz tvdefleet@seuservidor:/tmp/
```

### 11.3 Importar no Servidor
```bash
# No servidor
cd /tmp
tar -xzvf tvdefleet_db_backup.tar.gz

# Importar para MongoDB
mongorestore --db tvdefleet_db \
    --username tvdefleet_app \
    --password "OUTRA_PASSWORD_FORTE" \
    --authenticationDatabase tvdefleet_db \
    /tmp/backup/tvdefleet_db
```

### 11.4 Verificar Dados
```bash
mongosh -u tvdefleet_app -p "OUTRA_PASSWORD_FORTE" --authenticationDatabase tvdefleet_db

use tvdefleet_db
show collections
db.users.countDocuments()
db.motoristas.countDocuments()
```

---

## 12. Backup e Manutenção

### 12.1 Script de Backup Automático
```bash
sudo nano /opt/scripts/backup-tvdefleet.sh
```

Conteúdo:
```bash
#!/bin/bash

# Configurações
BACKUP_DIR="/var/backups/tvdefleet"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_USER="tvdefleet_app"
MONGO_PASS="OUTRA_PASSWORD_FORTE"
MONGO_DB="tvdefleet_db"
RETENTION_DAYS=7

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do MongoDB
mongodump --db $MONGO_DB \
    --username $MONGO_USER \
    --password $MONGO_PASS \
    --authenticationDatabase $MONGO_DB \
    --out $BACKUP_DIR/mongo_$DATE

# Backup dos uploads
tar -czvf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/tvdefleet/backend/uploads

# Comprimir backup do MongoDB
tar -czvf $BACKUP_DIR/mongo_$DATE.tar.gz $BACKUP_DIR/mongo_$DATE
rm -rf $BACKUP_DIR/mongo_$DATE

# Remover backups antigos
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup concluído: $DATE"
```

```bash
# Tornar executável
sudo chmod +x /opt/scripts/backup-tvdefleet.sh

# Adicionar ao crontab (backup diário às 3h)
sudo crontab -e
```

Adicionar:
```cron
0 3 * * * /opt/scripts/backup-tvdefleet.sh >> /var/log/tvdefleet-backup.log 2>&1
```

### 12.2 Monitorização com Logs
```bash
# Ver logs do Backend
tail -f /var/www/tvdefleet/backend/logs/error.log

# Ver logs do Nginx
tail -f /var/log/nginx/tvdefleet_error.log

# Ver logs do MongoDB
tail -f /var/log/mongodb/mongod.log
```

### 12.3 Atualizações de Código
```bash
# Quando tiver novas versões
cd /var/www/tvdefleet

# Pull do GitHub
git pull origin main

# Backend - Atualizar dependências
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart tvdefleet-backend

# Frontend - Rebuild
cd ../frontend
yarn install
yarn build
```

---

## 13. Troubleshooting

### 13.1 Backend Não Inicia
```bash
# Ver logs detalhados
sudo journalctl -u tvdefleet-backend -n 100

# Testar manualmente
cd /var/www/tvdefleet/backend
source venv/bin/activate
python -c "from server import app; print('OK')"
```

### 13.2 Erro de Conexão MongoDB
```bash
# Verificar se MongoDB está a correr
sudo systemctl status mongod

# Testar conexão
mongosh -u tvdefleet_app -p "PASSWORD" --authenticationDatabase tvdefleet_db
```

### 13.3 Erro 502 Bad Gateway
```bash
# Verificar se backend está a correr
sudo systemctl status tvdefleet-backend

# Verificar porta
sudo netstat -tlnp | grep 8001

# Ver logs Nginx
tail -f /var/log/nginx/tvdefleet_error.log
```

### 13.4 Certificado SSL Expirado
```bash
# Renovar manualmente
sudo certbot renew

# Verificar datas
sudo certbot certificates
```

### 13.5 Sem Espaço em Disco
```bash
# Ver uso de disco
df -h

# Limpar logs antigos
sudo journalctl --vacuum-time=7d

# Limpar cache apt
sudo apt clean
```

---

## 14. Checklist Final

### Antes de Ir para Produção

- [ ] **Domínio** configurado a apontar para o IP do servidor
- [ ] **Firewall** configurado (apenas portas 22, 80, 443)
- [ ] **MongoDB** com autenticação ativada
- [ ] **SSL** certificado instalado e a funcionar
- [ ] **Backend** a correr como serviço systemd
- [ ] **Frontend** build de produção criado
- [ ] **Nginx** configurado e a servir o site
- [ ] **Backups** automáticos configurados
- [ ] **Variáveis de ambiente** todas configuradas
- [ ] **Teste** de todas as funcionalidades

### Testes a Fazer

1. [ ] Aceder a https://seudominio.pt - deve mostrar o frontend
2. [ ] Login com utilizador existente
3. [ ] Criar novo utilizador
4. [ ] Upload de ficheiros
5. [ ] Testar API: `curl https://seudominio.pt/api/health`
6. [ ] App móvel conecta à API
7. [ ] Certificado SSL válido (verificar no browser)

### Segurança Final

- [ ] Alterar todas as passwords default
- [ ] Remover acesso SSH por password (usar apenas chaves)
- [ ] Configurar fail2ban para proteção contra brute-force
- [ ] Verificar permissões de ficheiros

---

## Contactos e Suporte

### PTISP
- Website: https://www.ptisp.pt
- Suporte: suporte@ptisp.pt

### Documentação Útil
- Nginx: https://nginx.org/en/docs/
- MongoDB: https://docs.mongodb.com/
- FastAPI: https://fastapi.tiangolo.com/
- React: https://react.dev/
- Expo: https://docs.expo.dev/

---

**Última atualização:** Fevereiro 2026
**Versão do Guia:** 1.0
