# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)

---

## Progresso da Refatoração do Backend (23/01/2026)

### Estado Atual - MELHORIA SIGNIFICATIVA
| Componente | Linhas | Endpoints |
|------------|--------|-----------|
| server.py | 17.670 | **19 activos** (era 34) |
| routes/*.py | 26.665 | **514** |
| models/*.py | 2.424 | - |

### Ficheiros de Rotas Criados/Atualizados
- `routes/credenciais.py` (NOVO) - Gestão de credenciais de plataformas
- `routes/configuracoes.py` (ATUALIZADO) - Adicionados endpoints de mapeamento e sincronização
- `routes/rpa_designer.py` - Sistema RPA Designer
- `routes/ganhos.py` - Ganhos Uber/Bolt (já existia, endpoints duplicados removidos do server.py)
- `routes/public.py` - Endpoints públicos (já existia, endpoints duplicados removidos do server.py)

### Endpoints Movidos Nesta Sessão
- ✅ GET/POST /api/credenciais-plataforma/* (6 endpoints)
- ✅ GET/POST /api/configuracao/mapeamento-campos (2 endpoints)
- ✅ GET/POST /api/configuracao/sincronizacao-auto (2 endpoints)
- ✅ GET /api/ganhos-bolt, /api/ganhos-uber (2 endpoints)
- ✅ GET/POST /api/public/* (3 endpoints)

### Endpoints Ainda no server.py (19)
- Uploads de ficheiros (2)
- Sincronização de plataformas (6)
- Import Uber/Bolt CSV (4)
- Bolt test/sync/save (3)
- Admin/Parceiro credenciais (4)

### Taxa de Modularização
**96.4%** dos endpoints estão modularizados (514 de 533 total)

---

## Funcionalidades Implementadas

### Sistema de Automação RPA (Completo)
- RPA Designer (Admin) - Upload de scripts Playwright
- RPA Automático - Execução com credenciais encriptadas
- RPA Simplificado - Upload manual de CSVs

### Gestão de Utilizadores
- Filtros por perfil, parceiro, data
- Ações admin: bloquear, revogar, alterar senha

### Integrações
- WhatsApp Web.js
- Terabox
- Playwright para automação

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Tarefas Pendentes

### P1 - Alta Prioridade
- [ ] Continuar refatoração - mover restantes 19 endpoints
- [ ] Validar scripts RPA em ambiente com internet

### P2 - Média Prioridade  
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Consolidar modelos Pydantic duplicados
- [ ] Limpeza de código comentado no server.py
