#!/bin/bash
# Script de inicialização do WhatsApp Service
# Verifica e instala dependências automaticamente

set -e

echo "=========================================="
echo "TVDEFleet WhatsApp Service - Inicialização"
echo "=========================================="

# Função para verificar se o Chromium está instalado
check_chromium() {
    if command -v chromium &> /dev/null; then
        echo "✅ Chromium encontrado em: $(which chromium)"
        chromium --version 2>/dev/null || true
        return 0
    elif command -v chromium-browser &> /dev/null; then
        echo "✅ Chromium-browser encontrado em: $(which chromium-browser)"
        chromium-browser --version 2>/dev/null || true
        # Criar link simbólico para compatibilidade
        if [ ! -f /usr/bin/chromium ]; then
            ln -sf $(which chromium-browser) /usr/bin/chromium
        fi
        return 0
    elif command -v google-chrome &> /dev/null; then
        echo "✅ Google Chrome encontrado em: $(which google-chrome)"
        # Criar link simbólico para compatibilidade
        if [ ! -f /usr/bin/chromium ]; then
            ln -sf $(which google-chrome) /usr/bin/chromium
        fi
        return 0
    else
        return 1
    fi
}

# Função para instalar o Chromium
install_chromium() {
    echo "📦 Instalando Chromium..."
    
    # Detectar o sistema operativo
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update -qq
        apt-get install -y -qq chromium || apt-get install -y -qq chromium-browser
    elif [ -f /etc/alpine-release ]; then
        # Alpine
        apk add --no-cache chromium
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        yum install -y chromium
    else
        echo "❌ Sistema operativo não suportado para instalação automática"
        echo "Por favor, instale o Chromium manualmente"
        exit 1
    fi
    
    echo "✅ Chromium instalado com sucesso!"
}

# Função para limpar ficheiros de lock antigos
cleanup_locks() {
    echo "🧹 Limpando ficheiros de lock antigos..."
    WWEBJS_AUTH="/app/backend/whatsapp_service/.wwebjs_auth"
    
    if [ -d "$WWEBJS_AUTH" ]; then
        find "$WWEBJS_AUTH" -name "SingletonLock" -delete 2>/dev/null || true
        find "$WWEBJS_AUTH" -name "SingletonCookie" -delete 2>/dev/null || true
        find "$WWEBJS_AUTH" -name "SingletonSocket" -delete 2>/dev/null || true
        echo "✅ Ficheiros de lock limpos"
    fi
}

# Função para matar processos Chromium órfãos
kill_orphan_chromium() {
    echo "🔍 Verificando processos Chromium órfãos..."
    pkill -f "chromium.*whatsapp" 2>/dev/null || true
    pkill -f "chrome.*whatsapp" 2>/dev/null || true
    echo "✅ Processos órfãos terminados"
}

# Verificar e instalar dependências Node.js
check_node_deps() {
    echo "📦 Verificando dependências Node.js..."
    cd /app/backend/whatsapp_service
    
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        echo "Instalando dependências..."
        npm install --quiet
    fi
    
    echo "✅ Dependências Node.js OK"
}

# === EXECUÇÃO PRINCIPAL ===

echo ""
echo "1️⃣ Verificando Chromium..."
if ! check_chromium; then
    echo "⚠️ Chromium não encontrado. A instalar..."
    install_chromium
    check_chromium
fi

echo ""
echo "2️⃣ Limpando ambiente..."
kill_orphan_chromium
cleanup_locks

echo ""
echo "3️⃣ Verificando dependências..."
check_node_deps

echo ""
echo "=========================================="
echo "✅ Ambiente preparado! Iniciando serviço..."
echo "=========================================="
echo ""

# Iniciar o serviço Node.js
cd /app/backend/whatsapp_service
exec node index.js
