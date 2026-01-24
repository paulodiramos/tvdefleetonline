# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React (porta 3000)
- **Backend**: FastAPI (porta 8001)
- **WhatsApp Service**: Node.js externo hospedado no Railway
- **Database**: MongoDB

---

## ✅ WhatsApp - FUNCIONAL (Atualizado: 24/01/2025)

### Arquitetura
O serviço WhatsApp usa uma arquitetura de microserviço externo:
1. **Serviço Node.js no Railway**: `https://tvdefleet-whatsap-production.up.railway.app`
2. **Backend FastAPI**: Comunica com o serviço externo via HTTP
3. **Frontend React**: Exibe QR Code para conexão

### Estado Actual
- ✅ **QR Code a funcionar**: Corrigido problema de exibição do QR Code
- ✅ **Serviço externo no Railway**: Ativo e funcional
- ✅ **Multi-sessão**: Cada parceiro tem a sua própria sessão WhatsApp

### Correção Aplicada (24/01/2025)
- **Problema**: O frontend esperava `response.data.qrCode` mas o serviço Railway retorna `response.data.qr`
- **Solução**: Atualizado `Integracoes.js` para verificar ambas as chaves (`qr` e `qrCode`)

---

## ✅ Funcionalidades Completas

### Sistema RPA
- Plataformas pré-definidas: Uber, Bolt, Via Verde, Prio
- Criar plataformas personalizadas (admin)
- Páginas interligadas: RPA Automação ↔ RPA Designer ↔ Mapeamento

### Integrações
- Terabox: Configuração por parceiro
- WhatsApp: QR Code funcional com serviço externo

### UI/UX
- Menu e botão voltar em todas as páginas de configuração
- Links de navegação entre páginas relacionadas

### Sistema de Planos
- Gestão unificada para parceiro, gestor e motorista
- Página única: GestaoPlanos.js

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`

---

## Tarefas Concluídas
- ✅ Sistema de plataformas personalizadas no RPA
- ✅ Páginas RPA interligadas
- ✅ Menu/botão voltar nas páginas de configuração
- ✅ WhatsApp com serviço externo no Railway
- ✅ QR Code do WhatsApp a funcionar (24/01/2025)
- ✅ Sistema de planos unificado
- ✅ Remoção de páginas obsoletas (/automacao, /cartoes-frota)

## Tarefas Pendentes

### P1 - Alta Prioridade
- [ ] Finalizar refatoração do `server.py` (remover código comentado, migrar endpoints restantes)
- [ ] Consolidação de modelos Pydantic em ficheiros dedicados

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Testes end-to-end completos

---

## Ficheiros Chave
- `/app/frontend/src/pages/Integracoes.js` - Página de integrações (WhatsApp, Terabox)
- `/app/backend/routes/whatsapp.py` - API do WhatsApp
- `/app/backend/.env` - Configuração WHATSAPP_SERVICE_URL
- `/app/whatsapp-vps-deploy/` - Código do serviço externo WhatsApp
