# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)

## Funcionalidades Implementadas

### Sistema de Automação RPA

#### RPA Designer (NOVO - 23/01/2026)
- **Página**: `/rpa-designer` (apenas admin)
- **Funcionalidade**: Upload de scripts Playwright gravados localmente
- **Fluxo**:
  1. Admin grava ações no seu computador usando `npx playwright codegen [URL]`
  2. Admin faz upload do script na plataforma
  3. Define campos de credenciais (email, password, etc.)
  4. Parceiros vêem apenas interface simples para executar
- **Endpoints**:
  - `POST /api/rpa-designer/scripts` - Criar script
  - `GET /api/rpa-designer/scripts` - Listar scripts
  - `PUT /api/rpa-designer/scripts/{id}` - Atualizar script
  - `DELETE /api/rpa-designer/scripts/{id}` - Eliminar script
  - `GET /api/rpa-designer/template-script` - Obter template
  - `GET /api/rpa-designer/plataformas-disponiveis` - Listar para parceiros

#### RPA Automático
- **Página**: `/rpa-automacao`
- **Funcionalidade**: Execução de automações Playwright
- **Plataformas**: Uber, Bolt, Via Verde, Prio + customizadas
- **Integração**: Carrega plataformas do RPA Designer automaticamente

#### RPA Simplificado
- **Página**: `/rpa-simplificado`
- **Funcionalidade**: Upload manual de CSVs de fornecedores

### Gestão de Utilizadores
- **Página**: `/usuarios`
- **Filtros**: Perfil, parceiro, data
- **Ações admin**: Bloquear, revogar, alterar senha, validar documentos

### Outras Funcionalidades
- Dashboard com estatísticas
- Gestão de motoristas e veículos
- Contratos e financeiro
- Mensagens e notificações
- Integrações: WhatsApp, Terabox

## Ficheiros Chave - RPA Designer

### Backend
- `/app/backend/routes/rpa_designer.py` - API endpoints
- `/app/backend/rpa_scripts/` - Scripts guardados

### Frontend
- `/app/frontend/src/pages/RPADesigner.js` - Página admin
- `/app/frontend/src/pages/RPAAutomacao.js` - Integração parceiros

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

## Próximas Tarefas (Backlog)

### P1 - Alta Prioridade
- [ ] Validar scripts RPA em ambiente com acesso à internet
- [ ] Refatoração do `server.py` monolítico

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Testar automações Uber/Bolt/Prio com credenciais reais

### P3 - Baixa Prioridade
- [ ] Exportação de dados em JSON/CSV
- [ ] Melhorias de UI/UX gerais

## Notas Técnicas
- Browser Playwright não é persistente no ambiente preview
- Ambiente preview não tem acesso à internet externa
- Scripts customizados mostram badge "Custom" na lista de plataformas
