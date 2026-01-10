# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## What's Been Implemented

### Janeiro 2026

#### 1. Card de Resumo Semanal no Dashboard ✅ (NEW)
**Status: COMPLETO**

Adicionado card de resumo semanal no dashboard do parceiro com:
- **Ganhos**: Total Uber + Bolt (discriminado)
- **Despesas**: Combustível + Elétrico + Via Verde + Aluguer
- **Valor Líquido**: Ganhos - Despesas
- Navegação por semanas (setas anterior/próximo)
- Número de motoristas

#### 2. Lista de Importações nos Relatórios ✅ (NEW)
**Status: COMPLETO**

Nova página `/lista-importacoes` com:
- Filtro por **Semana** ou **Período** de datas
- Resumo por plataforma (Uber, Bolt, Via Verde, Combustível, Elétrico)
- Lista detalhada de ficheiros importados com:
  - Plataforma
  - Nome do ficheiro
  - Data de importação
  - Número de registos
  - Total em €
  - Semana de referência
- Tabs para filtrar por plataforma específica

**Novo Endpoint:**
- `GET /api/relatorios/importacoes/historico?semana=X&ano=Y` - Retorna histórico de importações filtrado por período

#### 3. Sistema de Relatórios Semanais Refinado ✅
**Status: COMPLETO - Testado com 16 testes (100% pass rate)**

**Motoristas Verificados (Semana 51/2025):**
- **Nelson Francisco** (AS-83-NX): Uber €607.54 ✅, Bolt €136.74 ✅, Aluguer €249.99 ✅
- **Jorge Macaia** (BQ-32-RS): Uber €677.00 ✅, Bolt €299.61 ✅, Aluguer €249.99 ✅

#### 4. Sistema de Importação Melhorado ✅
**Status: COMPLETO**

- UI unificada de importação (`/importar-ficheiros`)
- Configuração de mapeamento (admin)
- Credenciais encriptadas (parceiro)

---

## Architecture

### Key API Endpoints
- `GET /api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025` - Resumo semanal calculado em tempo real
- `GET /api/relatorios/importacoes/historico?semana=51&ano=2025` - Histórico de importações

### Frontend Components
- `/app/frontend/src/components/ResumoSemanalCard.js` - Card de resumo para dashboard (NEW)
- `/app/frontend/src/pages/ListaImportacoes.js` - Página de lista de importações (NEW)
- `/app/frontend/src/pages/Dashboard.js` - Modificado para incluir ResumoSemanalCard

### Menu Structure
**Relatórios:**
- 📊 Gerir Relatórios
- 📈 Resumo Semanal
- 📋 Lista Importações (NEW)
- 📤 Importar Ficheiros
- 📜 Histórico

---

## Prioritized Backlog

### P1 - Alta Prioridade
- [ ] Refatorar `server.py` - separar lógica de importação em `services/import_service.py`

### P2 - Média Prioridade
- [ ] Implementar lógica de backend para sincronização automática (RPA)
- [ ] Implementar conexão real com plataformas (Uber, Bolt API)

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal com detalhes das transações Via Verde
- [ ] Notificações sobre estado da importação
- [ ] Editor visual para passos de automação RPA
- [ ] Exportar resumo semanal para Excel/PDF

---

## Test Reports
- `/app/test_reports/iteration_3.json` - 16 testes passaram (100%)

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro (Zeny Macaia)**: geral@zmbusines.com / 123456
