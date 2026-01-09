# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## What's Been Implemented

### Janeiro 2026

#### 1. Sistema de Relatórios Semanais Refinado ✅ (NEW)
**Status: COMPLETO - Testado com 16 testes (100% pass rate)**

Implementado conforme especificação do utilizador com exemplos detalhados:

**Motoristas Verificados (Semana 51/2025):**
- **Nelson Francisco** (AS-83-NX):
  - ✅ Uber: €607.54
  - ✅ Bolt: €136.74
  - ✅ Via Verde ID: 601073900511
  - ✅ Cartão Combustível: 7824731736480002
  - ✅ Aluguer Semanal: €249.99

- **Jorge Macaia** (BQ-32-RS):
  - ✅ Uber: €677.00
  - ✅ Bolt: €299.61
  - ✅ Cartão Elétrico: PTPRIO6087131736480002
  - ✅ Aluguer Semanal: €249.99

**Melhorias Técnicas:**
- Endpoint refatorado para calcular dados em tempo real
- Não depende de relatórios pré-gerados
- Busca dados diretamente das coleções: ganhos_uber, ganhos_bolt, portagens_viaverde, abastecimentos_combustivel, despesas_combustivel
- Adicionados campos de contrato ao veículo: `km_atribuidos`, `valor_km_extra`, `km_tipo_atribuicao`

#### 2. Sistema de Importação Melhorado ✅
**Status: COMPLETO**

**Nova página unificada de importação para Parceiro** (`/importar-ficheiros`):
- Interface única para todas as plataformas: Uber, Bolt, Via Verde, Combustível, Elétrico
- Selector de Semana/Ano com navegação por setas
- Drag & drop para seleccionar ficheiros
- Importação individual ou em lote ("Importar Todos")
- Histórico de importações

**Configuração de Mapeamento para Admin** (`/configuracao-mapeamento`):
- Tabs para cada plataforma
- Tabela editável de mapeamento de campos (Campo do Sistema ↔ Coluna no Ficheiro)
- Indicação de campos obrigatórios/opcionais
- Configuração de sincronização automática (Diário/Semanal/Mensal)

**Credenciais Encriptadas para Parceiro** (`/credenciais-plataformas`):
- Cards para: Uber, Bolt, Via Verde, Prio Energy, GPS
- Passwords encriptadas antes de armazenar
- Botão para testar conexão
- Aviso de segurança sobre encriptação

**Novos Endpoints:**
- `GET/POST /api/parceiro/credenciais-plataformas` - Gestão de credenciais do parceiro
- `POST /api/parceiro/testar-conexao/{plataforma}` - Testar conexão
- `GET/POST /api/configuracao/mapeamento-campos` - Mapeamento de campos
- `GET/POST /api/configuracao/sincronizacao-auto` - Config sync automática

#### 3. Importação de Relatórios de Parceiro ✅
**Status: COMPLETO**

Funcionalidades implementadas e validadas:
- Importação Bolt CSV com suporte BOM (UTF-8-sig)
- Importação Uber CSV 
- Importação Carregamentos Elétricos CSV (formato PRIOENERGY)
- Importação Combustível Excel
- Importação Via Verde Excel
- Aluguer obtido automaticamente do veículo atribuído

#### 4. Indicação da Semana de Referência Via Verde ✅
**Status: COMPLETO**

- Backend retorna `semana_referencia` 
- Frontend mostra "(ref. Semana X/AAAA)" junto ao campo Via Verde

#### 5. Vista Consolidada "Resumo Semanal do Parceiro" ✅
**Status: COMPLETO**

Nova página `/resumo-semanal` com:
- 4 cards de resumo (Ganhos, Despesas, Líquido, Motoristas)
- Tabela detalhada por motorista
- Seleção de semana/ano com navegação anterior/próximo
- Dados calculados em tempo real

---

## Architecture

### Key API Endpoints
- `GET /api/relatorios/parceiro/resumo-semanal?semana=51&ano=2025` - Resumo semanal calculado em tempo real

### Key Database Collections
- `ganhos_uber` - Ganhos da plataforma Uber
- `ganhos_bolt` - Ganhos da plataforma Bolt
- `portagens_viaverde` - Transações Via Verde
- `abastecimentos_combustivel` - Abastecimentos de combustível fóssil
- `despesas_combustivel` - Carregamentos elétricos

### Vehicle Model (novos campos)
```python
# Quilómetros Contratados
km_atribuidos: Optional[int] = None  # Quilómetros semanais contratados
valor_km_extra: Optional[float] = None  # Preço por km extra (€)
km_tipo_atribuicao: Optional[str] = "semanal"  # "semanal" | "mensal" | "sazonal"
```

### Frontend Pages
- `/app/frontend/src/pages/ImportarFicheirosParceiro.js` - Interface unificada de importação
- `/app/frontend/src/pages/ConfiguracaoMapeamento.js` - Config mapeamento (admin)
- `/app/frontend/src/pages/CredenciaisPlataformas.js` - Credenciais encriptadas (parceiro)
- `/app/frontend/src/pages/ResumoSemanalParceiro.js` - Vista consolidada

### Menu Structure
**Parceiro:**
- Relatórios → Gerir Relatórios | Resumo Semanal | **Importar Ficheiros** | Histórico
- **Configurações → Credenciais Plataformas** | Configurações

**Admin:**
- Relatórios → Criar Relatório | Resumo Semanal | **Importar Ficheiros** | Ficheiros Importados
- Configurações → **Mapeamento Importação** | Automação RPA | Config CSV

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
- `/app/tests/test_resumo_semanal_parceiro.py` - Testes unitários

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro (Zeny Macaia)**: geral@zmbusines.com / 123456
