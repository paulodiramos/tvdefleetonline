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
- ⚠️ **NOTA PARA DEPLOYMENT**: O Chromium precisa ser instalado no ambiente de produção

### 2. Rotas Removidas
- ✅ Removida `/automacao` - funcionalidade duplicada (usar `/rpa-automacao`)
- ✅ Removida `/cartoes-frota` - não utilizada
- ✅ Removida `/admin/planos-motorista` - redirecciona para `/gestao-planos`
- ✅ Eliminado `RPA Simplificado` - ficheiros e referências

### 3. Sistema de Planos Unificado
- ✅ Actualizado `/gestao-planos` para suportar **Parceiros, Gestores e Motoristas**
- ✅ Adicionado tipo "Gestor" com cor roxa no badge
- ✅ Filtros actualizados para os 3 tipos de utilizador
- ✅ Tipo de cobrança disponível para Parceiros e Gestores

### 4. Ficheiros Eliminados
- `/app/frontend/src/pages/Automacao.js`
- `/app/frontend/src/pages/CartoesFrota.js`
- `/app/frontend/src/pages/AdminPlanosMotorista.js`
- `/app/frontend/src/pages/RPASimplificado.js`
- `/app/backend/routes/rpa_simplificado.py`

---

## Sistema RPA Activo
- **RPA Designer** (`/rpa-designer`): Admin pode criar e gerir scripts Playwright
- **RPA Automação** (`/rpa-automacao`): Execução de automações configuradas

## Sistema de Planos (`/gestao-planos`)
- Tipos de utilizador: Parceiro, Gestor, Motorista
- Preços por periodicidade: Semanal, Mensal, Trimestral, Semestral, Anual
- Módulos configuráveis por tipo
- Atribuição individual ou em massa

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Requisitos de Deployment

### Para WhatsApp funcionar em produção:
1. Instalar Chromium: `apt-get install -y chromium`
2. Verificar path: `/usr/bin/chromium`
3. Diretório de sessões: `/app/backend/whatsapp_service/.wwebjs_auth`

### Serviços necessários:
- Backend (FastAPI): porta 8001
- Frontend (React): porta 3000
- WhatsApp Service (Node.js): porta 3001
- MongoDB

---

## Tarefas Pendentes

### P1 - Alta Prioridade
- [ ] Validar WhatsApp no domínio tvdefleet.com após deployment
- [ ] Teste end-to-end do fluxo RPA Designer

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Limpeza de código comentado no server.py

### P3 - Baixa Prioridade
- [ ] Mover os 14 endpoints restantes do `server.py` para rotas
- [ ] Validar scripts RPA em ambiente com internet
