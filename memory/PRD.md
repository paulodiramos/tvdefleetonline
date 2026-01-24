# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)
- **WhatsApp**: whatsapp-web.js (Node.js) com Chromium (auto-instalação)

---

## ✅ Sistema de Auto-Instalação do Chromium (24/01/2026)

### Como Funciona
O serviço WhatsApp agora detecta e instala o Chromium automaticamente:

1. **Na Inicialização**: Verifica múltiplos caminhos para o Chromium
2. **Se Não Encontrado**: Tenta instalar automaticamente via `apt-get`
3. **Endpoints de Diagnóstico**: `/health` e `/system-info` mostram o estado

### Caminhos Verificados
- `/usr/bin/chromium`
- `/usr/bin/chromium-browser`
- `/usr/bin/google-chrome`
- `/usr/bin/google-chrome-stable`
- `$CHROMIUM_PATH` (variável de ambiente)

### Endpoints de Diagnóstico
```bash
# Health check com estado do Chromium
curl http://localhost:3001/health

# Informação detalhada do sistema
curl http://localhost:3001/system-info
```

### Script de Inicialização
Também criado `/app/scripts/start-whatsapp.sh` que pode ser usado como alternativa.

---

## Configurações por Parceiro (`/configuracoes-parceiro`)

### Tabs Disponíveis:
1. **Email** - Configuração SMTP
2. **WhatsApp** - Número, templates, notificações automáticas
3. **Terabox** - Cookie, pasta raiz, sincronização
4. **Plataformas** - Credenciais Uber/Bolt/Via Verde

---

## Templates de Mensagem WhatsApp

### Eventos/Vistorias (Novos)
- **Vistoria Agendada**: data, hora, local, veículo
- **Lembrete de Vistoria**: notificação prévia
- **Manutenção Agendada**: tipo, data, local

### Existentes
- Relatório Semanal
- Documento a Expirar
- Boas-vindas
- Mensagem Personalizada

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Tarefas Concluídas
- ✅ Sistema automático de detecção/instalação do Chromium
- ✅ Endpoints de diagnóstico (`/health`, `/system-info`)
- ✅ WhatsApp configurado por parceiro
- ✅ Terabox configurado por parceiro
- ✅ Templates de mensagem para eventos/vistorias

## Tarefas Pendentes

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
