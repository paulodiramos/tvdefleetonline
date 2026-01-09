# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde), e automações.

## Current Session Focus
Correção do cálculo de despesas da Via Verde para relatórios semanais.

## What's Been Implemented

### Correção do Cálculo Via Verde (Janeiro 2026)
**Status: COMPLETO** ✅

#### Regras de Negócio Implementadas:
1. **Filtro por Market Description**: Incluir APENAS transações onde `market_description` = "portagens" ou "parques"
2. **Campo Liquid Value**: Usar a coluna `liquid_value` para soma dos valores
3. **Sem atraso de semanas**: Dados da semana X são usados no relatório da semana X

#### Ficheiros Modificados:
- `/app/backend/server.py`: Função `importar_viaverde_excel` - adicionado campo `market_description` aos documentos importados
- `/app/backend/routes/relatorios.py`: 
  - Função `get_motorista_via_verde_total` - implementado filtro por market_description
  - Função `gerar_relatorio_semanal` - implementado mesmo filtro

#### Valores Validados (Testes Passaram):
- **Marco Coelho** (OBU 601104486167):
  - Semana 47: €3,20
  - Semana 48: €10,80
  - Semana 50: €5,30
  - Semana 51: €3,90
  - **Total: €23,20** ✅
- **Arlei Oliveira** (OBU 601108925822): **€0** ✅

#### Endpoint API:
```
GET /api/relatorios/motorista/{motorista_id}/via-verde-total?semana={semana}&ano={ano}
```

## Prioritized Backlog

### P1 - Alta Prioridade
- [ ] Adicionar indicação da semana de referência dos custos da Via Verde no relatório (ex: "ref. Semana 50/2025")

### P2 - Média Prioridade
- [ ] Refatoração do backend - mover lógica de importação para `services/`
- [ ] Melhorar o ficheiro `server.py` que está muito grande (monólito)

### P3 - Baixa Prioridade
- [ ] Implementar motor de execução RPA (`backend/services/automacao_executor.py`)
- [ ] Incluir lista detalhada de transações Via Verde no PDF do relatório
- [ ] Criar editor visual para passos de automação RPA

## Technical Architecture

### Stack
- **Frontend**: React + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **File Processing**: pandas + openpyxl

### Key Collections
- `portagens_viaverde`: Transações da Via Verde importadas
- `vehicles`: Veículos com OBU/Via Verde ID
- `motoristas`: Dados dos motoristas
- `relatorios_semanais`: Relatórios financeiros semanais

### Key API Endpoints
- `GET /api/relatorios/motorista/{id}/via-verde-total`: Cálculo Via Verde por semana
- `POST /api/importar/viaverde`: Importação de ficheiros Excel Via Verde
- `POST /api/relatorios/motorista/{id}/gerar-semanal`: Geração de relatório semanal

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Reports
- `/app/test_reports/iteration_1.json`: Relatório de testes Via Verde API (13 testes, 100% passados)
- `/app/tests/test_via_verde_api.py`: Ficheiro de testes pytest

## Notes
- Documentos antigos na coleção `portagens_viaverde` sem o campo `market_description` são ignorados no cálculo
- A importação nova de ficheiros Excel já inclui o campo `market_description`
