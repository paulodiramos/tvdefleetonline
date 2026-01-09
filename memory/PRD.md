# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## What's Been Implemented

### Janeiro 2026

#### 1. Importação de Relatórios de Parceiro ✅
**Status: COMPLETO**

Funcionalidades:
- Importação Bolt CSV com suporte BOM (UTF-8-sig)
- Importação Uber CSV corrigida
- Importação Carregamentos Elétricos CSV (formato PRIOENERGY)
- Importação Combustível Excel com `cartao_frota_fossil_id`
- Valores de aluguer configurados nos veículos

Dados Validados (Karen & Nelson):
| Motorista | Bolt | Uber | Elétrico | Combustível | Aluguer |
|-----------|------|------|----------|-------------|---------|
| Karen Souza | €323,86 ✅ | €85,89 ✅ | €119,16 ✅ | - | €400 ✅ |
| Nelson Francisco | €136,74 ✅ | €607,54 ✅ | - | €144,63 ✅ | €249,99 ✅ |

#### 2. Indicação da Semana de Referência Via Verde ✅
**Status: COMPLETO**

- Backend retorna `semana_referencia` no endpoint `/api/relatorios/motorista/{id}/via-verde-total`
- Backend inclui `via_verde_semana_referencia` nos relatórios gerados
- Frontend mostra "(ref. Semana X/AAAA)" junto ao campo Via Verde
- Funciona no modal de criação e edição de relatórios

#### 3. Vista Consolidada "Resumo Semanal do Parceiro" ✅
**Status: COMPLETO**

Nova página `/resumo-semanal` com:
- Selector de semana/ano com navegação por setas
- 4 cards de resumo: Total Ganhos, Total Despesas, Valor Líquido, Motoristas
- Tabela detalhada por motorista com todas as colunas:
  - Uber, Bolt, Total Ganhos
  - Combustível, Elétrico, Via Verde (com ref. semana), Aluguer
  - Total Despesas, Valor Líquido, Status
- Acessível via menu Relatórios → Resumo Semanal

**Endpoint novo**: `GET /api/relatorios/parceiro/resumo-semanal?semana=X&ano=YYYY`

---

### Correção do Cálculo Via Verde (Sessão Anterior) ✅
**Status: COMPLETO**

Regras de negócio implementadas:
1. Filtro por `market_description` = "portagens" ou "parques"
2. Usar `liquid_value` para soma
3. Sem atraso de semanas

---

## Prioritized Backlog

### P2 - Média Prioridade
- [ ] Refatoração do backend - mover lógica de importação para `services/`
- [ ] Melhorar validação de duplicados na importação

### P3 - Baixa Prioridade
- [ ] Implementar motor de execução RPA
- [ ] Incluir lista detalhada de transações Via Verde no PDF
- [ ] Criar editor visual para automação RPA
- [ ] Exportar resumo semanal para Excel/PDF

---

## Technical Architecture

### Stack
- **Frontend**: React + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **File Processing**: pandas + openpyxl

### Key Collections
- `ganhos_bolt`: Ganhos importados da Bolt
- `ganhos_uber`: Ganhos importados da Uber
- `relatorios_semanais`: Relatórios consolidados por motorista
- `portagens_viaverde`: Transações Via Verde
- `despesas_combustivel`: Carregamentos elétricos
- `abastecimentos_combustivel`: Abastecimentos de combustível fóssil
- `vehicles`: Veículos com valor_semanal, cartao_frota_eletric_id, cartao_frota_fossil_id
- `motoristas`: Dados dos motoristas

### Key API Endpoints
- `POST /api/importar/{plataforma}`: Importação genérica
- `GET /api/relatorios/parceiro/resumo-semanal`: **NOVO** - Vista consolidada
- `GET /api/relatorios/motorista/{id}/via-verde-total`: Cálculo Via Verde com semana_referencia
- `POST /api/relatorios/gerar-semanal`: Geração de relatório com via_verde_semana_referencia

### New Files Created
- `/app/frontend/src/pages/ResumoSemanalParceiro.js`: Componente da vista consolidada
- `/app/backend/routes/relatorios.py`: Endpoint `get_resumo_semanal_parceiro`

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Reports
- `/app/test_reports/iteration_1.json`: Testes Via Verde API
- `/app/test_reports/iteration_2.json`: Testes importação de dados (17 testes, 100% passados)
