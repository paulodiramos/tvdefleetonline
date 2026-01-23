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

### Estado Atual
| Componente | Linhas | Endpoints |
|------------|--------|-----------|
| server.py | 17.650 | 34 ativos |
| routes/*.py | 26.487 | 510 |
| models/*.py | 2.424 | - |

### Ficheiros de Rotas Criados
- `routes/credenciais.py` (NOVO) - Gestão de credenciais de plataformas
- `routes/rpa_designer.py` - Sistema RPA Designer
- `routes/rpa_automacao.py` - Automação RPA
- `routes/rpa_simplificado.py` - Upload CSV manual
- E mais 40+ ficheiros de rotas

### Endpoints Ainda no server.py (34)
- Uploads de ficheiros (recibos, comprovativos)
- Sincronização de plataformas
- Import Uber/Bolt
- Ganhos Uber/Bolt
- Endpoints públicos
- Configurações de sincronização
- Import CSV
- Bolt test/sync
- Configuração de mapeamento

### Próximos Passos da Refatoração
1. Mover endpoints de sincronização para `routes/sincronizacao.py`
2. Mover endpoints de import para `routes/importacoes.py`
3. Consolidar modelos duplicados entre server.py e models/

---

## Funcionalidades Implementadas

### Sistema de Automação RPA (Completo)

#### RPA Designer (Admin)
- Upload de scripts Playwright gravados localmente
- Configuração de campos de credenciais
- Gestão de versões de scripts

#### RPA Automático
- Plataformas: Uber, Bolt, Via Verde, Prio + customizadas
- Execução com credenciais encriptadas
- Logs e screenshots de depuração

#### RPA Simplificado (CSV)
- Upload manual de ficheiros de fornecedores
- Exportação de relatórios

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
- [ ] Continuar refatoração do server.py
- [ ] Validar scripts RPA em ambiente com internet

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Consolidar modelos Pydantic duplicados
