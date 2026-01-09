# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## Current Session Focus
Implementação da importação de relatórios para perfil de parceiro com dados reais.

## What's Been Implemented

### Importação de Relatórios de Parceiro (Janeiro 2026)
**Status: COMPLETO** ✅

#### Funcionalidades Implementadas:
1. **Importação Bolt CSV**: Corrigido suporte para BOM (UTF-8-sig) e parsing correto de campos
2. **Importação Uber CSV**: Corrigido encoding e integração com sistema existente
3. **Importação Carregamentos Elétricos CSV**: Nova função `importar_carregamentos_csv` para formato PRIOENERGY
4. **Importação Combustível Excel**: Adicionado suporte para campo `cartao_frota_fossil_id`
5. **Valores de Aluguer**: Configurados nos veículos associados aos motoristas

#### Dados Verificados e Validados:

**Karen Souza** (ID: b5fc7af8-fea5-48c3-a79e-f8bde00e1ba6, Veículo: BR-03-MZ):
| Campo | Esperado | Importado | Status |
|-------|----------|-----------|--------|
| Bolt | €323,86 | €323,86 | ✅ |
| Uber | €85,89 | €85,89 | ✅ |
| Elétrico | €119,16 | €119,16 | ✅ |
| Aluguer | €400/semana | €400/semana | ✅ |

**Nelson Francisco** (ID: e2355169-10a7-4547-9dd0-479c128d73f9, Veículo: AS-83-NX):
| Campo | Esperado | Importado | Status |
|-------|----------|-----------|--------|
| Uber | €607,54 | €607,54 | ✅ |
| Bolt | €136,74 | €136,74 | ✅ |
| Combustível | €144,63 | Registado | ✅ |
| Aluguer | €249,99/semana | €249,99/semana | ✅ |

#### Ficheiros Modificados:
- `/app/backend/server.py`:
  - `importar_carregamentos_csv()`: Nova função para CSV de carregamentos elétricos
  - `importar_bolt/uber_ganhos()`: Corrigido encoding UTF-8-sig
  - `importar_combustivel_excel()`: Adicionado suporte para `cartao_frota_fossil_id`
  - Endpoints retornam dados serializados corretamente (sem `_id` do MongoDB)

#### Endpoints de Importação:
- `POST /api/importar/uber` - Importação CSV Uber
- `POST /api/importar/bolt` - Importação CSV Bolt
- `POST /api/importar/viaverde` - Importação Excel Via Verde
- `POST /api/importar/carregamento` - Importação CSV Carregamentos Elétricos
- `POST /api/importar/combustivel` - Importação Excel Combustível
- `POST /api/import/bolt/ganhos` - Importação dedicada Bolt
- `POST /api/import/uber/ganhos` - Importação dedicada Uber

---

### Correção do Cálculo Via Verde (Janeiro 2026)
**Status: COMPLETO** ✅

#### Regras de Negócio:
1. Filtro por `market_description` = "portagens" ou "parques"
2. Usar `liquid_value` para soma
3. Sem atraso de semanas

---

## Prioritized Backlog

### P1 - Alta Prioridade
- [ ] Adicionar indicação da semana de referência dos custos da Via Verde no relatório

### P2 - Média Prioridade
- [ ] Refatoração do backend - mover lógica de importação para `services/`
- [ ] Melhorar validação de duplicados na importação

### P3 - Baixa Prioridade
- [ ] Implementar motor de execução RPA
- [ ] Incluir lista detalhada de transações Via Verde no PDF
- [ ] Criar editor visual para automação RPA

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
- `despesas_combustivel`: Carregamentos elétricos (tipo_transacao='carregamento_eletrico')
- `abastecimentos_combustivel`: Abastecimentos de combustível fóssil
- `vehicles`: Veículos com valor_semanal, cartao_frota_eletric_id, cartao_frota_fossil_id
- `motoristas`: Dados dos motoristas

### Key API Endpoints
- `POST /api/importar/{plataforma}`: Importação genérica por plataforma
- `GET /api/relatorios/motorista/{id}/semanais`: Relatórios semanais do motorista
- `GET /api/relatorios/motorista/{id}/via-verde-total`: Cálculo Via Verde

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Reports
- `/app/test_reports/iteration_1.json`: Testes Via Verde API
- `/app/test_reports/iteration_2.json`: Testes importação de dados (17 testes, 100% passados)
- `/app/tests/test_import_data.py`: Testes de validação de importação
- `/app/tests/test_via_verde_api.py`: Testes API Via Verde

## Notes
- Veículos devem ter `cartao_frota_eletric_id` configurado para associar carregamentos elétricos
- Veículos devem ter `cartao_frota_fossil_id` configurado para associar abastecimentos de combustível
- Valores de aluguer são configurados em `vehicles.valor_semanal` e `vehicles.tipo_contrato.valor_aluguer`
