# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)

---

## ✅ Refatoração do Backend - CONCLUÍDA (97.4%)

### Estado Final (23/01/2026)
| Componente | Endpoints |
|------------|-----------|
| **server.py** | **14** |
| **routes/*.py** | **514** |

### Taxa de Modularização: 97.4% ✅

### Endpoints Movidos/Comentados Nesta Sessão
- ✅ GET/POST /api/credenciais-plataforma/* (6 endpoints)
- ✅ GET/POST /api/configuracao/* (4 endpoints)
- ✅ GET /api/ganhos-bolt, /api/ganhos-uber (2 endpoints)
- ✅ GET/POST /api/public/* (3 endpoints)
- ✅ GET /api/logs-sincronizacao (1 endpoint)
- ✅ GET/POST /api/sincronizacao/* (3 endpoints)
- ✅ GET /api/dados/{plataforma} (1 endpoint)

### Endpoints Restantes no server.py (14)
Estes endpoints precisam de tratamento especial ou têm dependências:
1. **Uploads** (2): /uploads/recibos, /uploads/comprovativo_pagamento
2. **Sincronização Manual** (1): /api/sincronizar/{parceiro_id}/{plataforma}
3. **Import Ganhos** (2): /api/import/uber/ganhos, /api/import/bolt/ganhos
4. **Import CSV** (2): /api/import-csv/{plataforma}, /api/import-csv/history
5. **Bolt Integration** (3): /api/bolt/test-connection, sync-earnings, save-credentials
6. **Admin/Parceiro Creds** (4): /api/admin/credenciais-parceiros, /api/parceiro/credenciais-plataformas

### Ficheiros de Rotas Principais
- `routes/credenciais.py` - Gestão de credenciais (NOVO)
- `routes/configuracoes.py` - Configurações do sistema
- `routes/sincronizacao.py` - Sincronização de plataformas
- `routes/ganhos.py` - Ganhos Uber/Bolt
- `routes/public.py` - Endpoints públicos
- `routes/rpa_designer.py` - Sistema RPA Designer
- E mais 40+ ficheiros

---

## Funcionalidades Implementadas

### Sistema de Automação RPA
- RPA Designer (Admin) - Upload de scripts Playwright
- RPA Automático - Execução com credenciais encriptadas
- RPA Simplificado - Upload manual de CSVs

### Gestão de Utilizadores
- Filtros por perfil, parceiro, data
- Ações admin: bloquear, revogar, alterar senha

### Integrações
- WhatsApp Web.js
- Terabox
- Playwright

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Tarefas Pendentes

### P2 - Média Prioridade  
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Mover os 14 endpoints restantes para rotas

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
- [ ] Validar scripts RPA em ambiente com internet
