# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React (porta 3000)
- **Backend**: FastAPI (porta 8001)
- **Database**: MongoDB

---

## ✅ WhatsApp Business Cloud API (Atualizado: 24/01/2025)

### Nova Arquitetura (Sem Railway!)
A integração WhatsApp foi **completamente refatorada** para usar a **API oficial da Meta**:

```
Antes (instável):
TVDEFleet → Railway → whatsapp-web.js → WhatsApp Web → Mensagem ❌

Agora (oficial e estável):
TVDEFleet → Meta Graph API → Mensagem ✅
```

### Vantagens
- ✅ **100% oficial** - API da Meta
- ✅ **Sem Railway** - Integração direta
- ✅ **Sem QR Code** - Não precisa escanear
- ✅ **Sem telemóvel ligado** - Funciona 24/7
- ✅ **1000 msgs grátis/mês** por número
- ✅ **Cada parceiro configura o seu próprio número**

### Configuração por Parceiro
Cada parceiro acede a `Configurações → WhatsApp` e:
1. Cria conta em developers.facebook.com
2. Adiciona número WhatsApp Business
3. Copia Phone Number ID e Access Token
4. Cola nas configurações e testa

### Ficheiros Relevantes
- `/app/backend/routes/whatsapp_cloud.py` - Nova API WhatsApp Cloud
- `/app/frontend/src/pages/ConfiguracoesParceiro.js` - UI de configuração

---

## ✅ Sistema de Email SMTP por Parceiro

Cada parceiro configura o seu próprio email:
- **Gmail**: smtp.gmail.com:587 + App Password
- **Outlook**: smtp.office365.com:587
- **Outros**: Configuração personalizada

---

## ✅ Funcionalidades Completas

### Sistema RPA
- Plataformas pré-definidas: Uber, Bolt, Via Verde, Prio
- Criar plataformas personalizadas (admin)
- Páginas interligadas: RPA Automação ↔ RPA Designer ↔ Mapeamento

### Integrações
- ✅ WhatsApp Cloud API (oficial Meta)
- ✅ Email SMTP por parceiro
- ✅ Terabox por parceiro

### Sistema de Planos
- Gestão unificada para parceiro, gestor e motorista

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`

---

## Tarefas Concluídas (24/01/2025)
- ✅ **Migração WhatsApp para Cloud API** - Removida dependência do Railway
- ✅ Nova página de Integrações simplificada
- ✅ Configuração WhatsApp na página do parceiro
- ✅ Sistema de plataformas personalizadas no RPA
- ✅ Sistema de planos unificado
- ✅ Remoção de páginas obsoletas

## Tarefas Pendentes

### P1 - Alta Prioridade
- [ ] Finalizar refatoração do `server.py` (remover código comentado)
- [ ] Consolidação de modelos Pydantic

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Testes end-to-end completos

---

## Ficheiros Removidos/Obsoletos
- `/app/backend/routes/whatsapp.py` - Substituído por whatsapp_cloud.py
- `/app/whatsapp-vps-deploy/` - Já não é necessário (pode eliminar do Railway)

## Notas Importantes
- **Railway pode ser desativado** - A solução WhatsApp já não depende dele
- Cada parceiro deve criar conta no Meta Developers para usar WhatsApp
