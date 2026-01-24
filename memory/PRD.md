# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)
- **WhatsApp**: whatsapp-web.js (Node.js) com Chromium

---

## ✅ Alterações desta Sessão (24/01/2026)

### 1. WhatsApp Corrigido para Produção
- ✅ Instalado Chromium no ambiente (`/usr/bin/chromium`)
- ✅ Corrigido limpeza automática de lock files no `index.js`
- ✅ Reativado router do WhatsApp no `server.py`
- ✅ Restaurada rota e link no frontend (`/whatsapp`)
- ✅ Adicionado endpoint `/api/whatsapp/config` para configuração
- ⚠️ **NOTA PARA DEPLOYMENT**: O Chromium precisa ser instalado no ambiente de produção

### 2. Rotas Removidas
- ✅ Removida `/automacao` - funcionalidade duplicada
- ✅ Removida `/cartoes-frota` - não utilizada
- ✅ Removida `/admin/planos-motorista` - redirecciona para `/gestao-planos`
- ✅ Eliminado RPA Simplificado

### 3. Sistema de Planos Unificado (`/gestao-planos`)
- ✅ Adicionado tipo **Gestor** às opções (Parceiro, Gestor, Motorista)
- ✅ Badges com cores: Parceiro (azul), Gestor (roxo), Motorista (verde)
- ✅ Filtros actualizados para os 3 tipos de utilizador
- ✅ Corrigido duplicate key warning na lista de utilizadores

### 4. RPA Designer
- ✅ Adicionado endpoint `/api/rpa-designer/template` (alias)
- ✅ 1 script activo ("Via Verde Teste")

### 5. Terabox Preparado para Produção
- ✅ Integração com API Terabox funcional
- ✅ 78 pastas e 5 ficheiros configurados
- ✅ Endpoints de stats, ficheiros, pastas funcionais

---

## Testes Realizados (Iteration 18)

### Backend: 80% (24/30 testes)
- Gestão Planos: 7/7 ✅
- RPA Designer: 4/5 ✅ (template corrigido)
- RPA Automação: 6/6 ✅
- WhatsApp: 3/3 ✅
- Terabox: 5/5 ✅

### Frontend: 100%
- Todas as 5 páginas carregam correctamente

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Requisitos de Deployment

### Para WhatsApp funcionar em produção:
```bash
apt-get install -y chromium
```

### Serviços necessários:
- Backend (FastAPI): porta 8001
- Frontend (React): porta 3000
- WhatsApp Service (Node.js): porta 3001
- MongoDB

---

## Tarefas Concluídas (P1)
- ✅ Validação WhatsApp - endpoints funcionais
- ✅ Teste RPA Designer - script activo e template disponível
- ✅ Terabox preparado - API funcional

## Tarefas Pendentes

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Configurar credenciais do parceiro de teste

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
- [ ] Mover os 14 endpoints restantes para rotas
