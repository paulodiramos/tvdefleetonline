#!/bin/bash
# ================================================================
# TVDEFleet - Script de Instalação para VPS
# Executa: sudo ./install-vps.sh
# ================================================================

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          TVDEFleet - Instalação VPS                        ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Este script vai:                                          ║"
echo "║  1. Instalar Docker e Docker Compose                       ║"
echo "║  2. Configurar auto-start dos serviços                     ║"
echo "║  3. Configurar MongoDB persistente                         ║"
echo "║  4. Instalar Playwright para RPA                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./install-vps.sh"
    exit 1
fi

# Variáveis
INSTALL_DIR="/opt/tvdefleet"
DOMAIN="${DOMAIN:-tvdefleet.com}"

echo "📁 Diretório de instalação: $INSTALL_DIR"
echo "🌐 Domínio: $DOMAIN"
echo ""

# ==================== 1. Atualizar Sistema ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 [1/6] Atualizando sistema..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
apt-get update
apt-get upgrade -y

# ==================== 2. Instalar Docker ====================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 [2/6] Instalando Docker..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v docker &> /dev/null; then
    # Instalar dependências
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

    # Adicionar chave GPG do Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Adicionar repositório
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Instalar Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Habilitar Docker no boot
    systemctl enable docker
    systemctl start docker
    
    echo "✅ Docker instalado com sucesso"
else
    echo "✅ Docker já está instalado"
fi

# ==================== 3. Criar Diretórios ====================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📂 [3/6] Criando diretórios..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p $INSTALL_DIR/{backend,frontend,deployment,backups/mongodb,logs}
mkdir -p $INSTALL_DIR/data/{uber_sessions,bolt_sessions,viaverde_sessions}

echo "✅ Diretórios criados"

# ==================== 4. Copiar Ficheiros ====================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 [4/6] Copiando ficheiros..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Se os ficheiros estão no diretório atual
if [ -d "./backend" ]; then
    cp -r ./backend/* $INSTALL_DIR/backend/
    cp -r ./frontend/* $INSTALL_DIR/frontend/
    cp -r ./deployment/* $INSTALL_DIR/deployment/
    echo "✅ Ficheiros copiados do diretório local"
else
    echo "⚠️ Diretórios backend/frontend não encontrados."
    echo "   Certifique-se de executar este script na pasta do projeto"
    echo "   Ou copie manualmente os ficheiros para $INSTALL_DIR"
fi

# ==================== 5. Configurar .env ====================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️ [5/6] Configurando ambiente..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ENV_FILE="$INSTALL_DIR/deployment/.env"

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
# TVDEFleet - Configuração de Ambiente
# Gerado em: $(date)

# Domínio
DOMAIN=$DOMAIN

# Segurança (MUDE EM PRODUÇÃO!)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
RPA_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Email (configurar depois)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@$DOMAIN
SMTP_FROM_NAME=TVDEFleet

# WhatsApp Cloud API (opcional)
WHATSAPP_CLOUD_ACCESS_TOKEN=
WHATSAPP_CLOUD_PHONE_NUMBER_ID=
WHATSAPP_CLOUD_WABA_ID=
WHATSAPP_CLOUD_VERIFY_TOKEN=
WHATSAPP_CLOUD_APP_SECRET=

# Emergent LLM Key (opcional)
EMERGENT_LLM_KEY=
EOF
    echo "✅ Ficheiro .env criado em $ENV_FILE"
    echo "⚠️ IMPORTANTE: Edite $ENV_FILE para configurar os valores corretos"
else
    echo "✅ Ficheiro .env já existe"
fi

# ==================== 6. Criar Serviço Systemd ====================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 [6/6] Configurando auto-start..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > /etc/systemd/system/tvdefleet.service << EOF
[Unit]
Description=TVDEFleet Application Stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR/deployment
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tvdefleet.service

echo "✅ Serviço tvdefleet configurado para auto-start"

# ==================== Resumo ====================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║               ✅ Instalação Concluída!                     ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  📁 Diretório: $INSTALL_DIR"
echo "║                                                            ║"
echo "║  🔧 Próximos passos:                                       ║"
echo "║                                                            ║"
echo "║  1. Editar configuração:                                   ║"
echo "║     nano $INSTALL_DIR/deployment/.env"
echo "║                                                            ║"
echo "║  2. Iniciar aplicação:                                     ║"
echo "║     systemctl start tvdefleet                              ║"
echo "║                                                            ║"
echo "║  3. Ver logs:                                              ║"
echo "║     docker compose -f $INSTALL_DIR/deployment/docker-compose.yml logs -f"
echo "║                                                            ║"
echo "║  4. Configurar SSL (depois do DNS):                        ║"
echo "║     $INSTALL_DIR/deployment/setup-ssl.sh"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  🔄 Comandos úteis:                                        ║"
echo "║     systemctl status tvdefleet    # Ver estado             ║"
echo "║     systemctl restart tvdefleet   # Reiniciar              ║"
echo "║     systemctl stop tvdefleet      # Parar                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
