#!/bin/bash
# Script para garantir que os browsers do Playwright estão instalados
# Este script deve ser executado no startup do ambiente

echo "🎭 Verificando instalação do Playwright..."

# Verificar se o browser chromium existe
if [ ! -d "/pw-browsers/chromium_headless_shell-1194" ]; then
    echo "⏳ Instalando browsers do Playwright..."
    playwright install chromium
    echo "✅ Playwright browsers instalados com sucesso!"
else
    echo "✅ Playwright browsers já estão instalados."
fi
