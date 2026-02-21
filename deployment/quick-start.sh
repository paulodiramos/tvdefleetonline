#!/bin/bash
# ===========================================
# TVDEFleet - Quick Start (VPS 94.46.171.222)
# ===========================================
# Execute este script no VPS para instalar tudo rapidamente

echo "🚀 TVDEFleet - Instalação Rápida"
echo ""

# 1. Criar estrutura
mkdir -p /opt/tvdefleet
cd /opt/tvdefleet

# 2. Verificar se ficheiros existem
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Primeiro transfira os ficheiros para /opt/tvdefleet"
    echo ""
    echo "No seu computador, execute:"
    echo "  scp -r /caminho/tvdefleet/* root@94.46.171.222:/opt/tvdefleet/"
    exit 1
fi

# 3. Configurar .env
if [ ! -f ".env" ]; then
    cp deployment/.env.example .env
    echo "⚠️  Ficheiro .env criado. Por favor, configure-o:"
    echo "    nano .env"
    echo ""
    echo "Depois execute novamente: ./deployment/quick-start.sh"
    exit 0
fi

# 4. Build e Start
echo "🔨 Construindo imagens Docker..."
docker compose build

echo "🚀 Iniciando serviços..."
docker compose up -d

# 5. Aguardar
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# 6. Verificar
echo ""
echo "📊 Estado dos serviços:"
docker compose ps

echo ""
echo "✅ Instalação completa!"
echo ""
echo "🌐 Aceda à aplicação:"
echo "   Frontend: http://94.46.171.222"
echo "   API:      http://94.46.171.222/api/health"
echo ""
echo "📝 Credenciais de teste:"
echo "   Admin: admin@tvdefleet.com / Admin123!"
