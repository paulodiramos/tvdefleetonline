#!/bin/bash
# Script para gerar APK da TVDEFleet Drivers
# Execute este script no seu computador após descarregar a pasta mobile/tvdefleet-drivers

echo "=== TVDEFleet Drivers - Gerador de APK ==="
echo ""

# Verificar se está no diretório correto
if [ ! -f "app.json" ]; then
    echo "❌ Erro: Execute este script dentro da pasta tvdefleet-drivers"
    exit 1
fi

# Instalar dependências
echo "📦 A instalar dependências..."
npm install

# Instalar EAS CLI se não existir
if ! command -v eas &> /dev/null; then
    echo "📦 A instalar EAS CLI..."
    npm install -g eas-cli
fi

# Login no Expo (se necessário)
echo ""
echo "🔐 A fazer login no Expo..."
eas login

# Inicializar projeto EAS (se necessário)
echo ""
echo "⚙️ A configurar projeto EAS..."
eas project:init

# Gerar APK de produção
echo ""
echo "🔨 A gerar APK de produção..."
echo "Este processo pode demorar 10-15 minutos..."
echo ""
eas build --platform android --profile production

echo ""
echo "✅ Processo concluído!"
echo "O link para download do APK será mostrado acima."
echo ""
echo "Próximos passos:"
echo "1. Descarregue o APK do link fornecido"
echo "2. Aceda a https://play.google.com/console"
echo "3. Crie uma nova aplicação ou actualize a existente"
echo "4. Faça upload do APK"
