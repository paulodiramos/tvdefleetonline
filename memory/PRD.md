# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React (porta 3000)
- **Backend**: FastAPI (porta 8001)
- **WhatsApp Service**: Node.js (porta 3001) - **Requer configuração adicional em produção**
- **Database**: MongoDB

---

## ⚠️ Limitação em Produção: WhatsApp

### Problema
O serviço WhatsApp usa `whatsapp-web.js` que requer:
1. Node.js runtime
2. Chromium browser instalado
3. Um processo separado a correr na porta 3001

### Estado Actual
- Em **preview/desenvolvimento**: Funciona ✅
- Em **produção (Emergent)**: Mostra "Serviço Offline" ⚠️

### Solução
O frontend foi actualizado para mostrar mensagem clara quando o serviço não está disponível:
> "Serviço WhatsApp não disponível. Contacte o suporte técnico para activar esta funcionalidade."

### Para Activar em Produção
1. Configurar um servidor separado com Node.js e Chromium
2. Executar o serviço: `cd /app/backend/whatsapp_service && node index.js`
3. Garantir que o backend consegue aceder a `http://localhost:3001`

---

## ✅ Funcionalidades Completas

### Sistema RPA
- Plataformas pré-definidas: Uber, Bolt, Via Verde, Prio
- Criar plataformas personalizadas (admin)
- Páginas interligadas: RPA Automação ↔ RPA Designer ↔ Mapeamento

### Integrações
- Terabox: Configuração por parceiro
- WhatsApp: UI melhorada com mensagem de erro clara

### UI/UX
- Menu e botão voltar em todas as páginas de configuração
- Links de navegação entre páginas relacionadas

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Tarefas Concluídas
- ✅ Sistema de plataformas personalizadas no RPA
- ✅ Páginas RPA interligadas
- ✅ Menu/botão voltar nas páginas de configuração
- ✅ Mensagem clara quando WhatsApp offline

## Tarefas Pendentes

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Configurar WhatsApp para funcionar em produção (requer servidor dedicado)

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
