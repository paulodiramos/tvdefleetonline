# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## What's Been Implemented

### Janeiro 2026

#### 1. Sistema de Importação Melhorado ✅
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

#### 2. Importação de Relatórios de Parceiro ✅
**Status: COMPLETO**

Funcionalidades implementadas e validadas:
- Importação Bolt CSV com suporte BOM (UTF-8-sig)
- Importação Uber CSV 
- Importação Carregamentos Elétricos CSV (formato PRIOENERGY)
- Importação Combustível Excel
- Aluguer obtido automaticamente do veículo atribuído

#### 3. Indicação da Semana de Referência Via Verde ✅
**Status: COMPLETO**

- Backend retorna `semana_referencia` 
- Frontend mostra "(ref. Semana X/AAAA)" junto ao campo Via Verde

#### 4. Vista Consolidada "Resumo Semanal do Parceiro" ✅
**Status: COMPLETO**

Nova página `/resumo-semanal` com:
- 4 cards de resumo (Ganhos, Despesas, Líquido, Motoristas)
- Tabela detalhada por motorista

---

## Architecture

### New Files Created
**Frontend:**
- `/app/frontend/src/pages/ImportarFicheirosParceiro.js` - Interface unificada de importação
- `/app/frontend/src/pages/ConfiguracaoMapeamento.js` - Config mapeamento (admin)
- `/app/frontend/src/pages/CredenciaisPlataformas.js` - Credenciais encriptadas (parceiro)
- `/app/frontend/src/pages/ResumoSemanalParceiro.js` - Vista consolidada

**Backend:**
- Novos endpoints em `/app/backend/server.py` para credenciais e configurações

### Menu Structure
**Parceiro:**
- Relatórios → Gerir Relatórios | Resumo Semanal | **Importar Ficheiros** | Histórico
- **Configurações → Credenciais Plataformas** | Configurações

**Admin:**
- Relatórios → Criar Relatório | Resumo Semanal | **Importar Ficheiros** | Ficheiros Importados
- Configurações → **Mapeamento Importação** | Automação RPA | Config CSV

---

## Prioritized Backlog

### P2 - Média Prioridade
- [ ] Implementar conexão real com plataformas (Uber, Bolt API)
- [ ] Refatoração do backend - mover lógica para `services/`

### P3 - Baixa Prioridade
- [ ] Motor de execução RPA
- [ ] Exportar resumo semanal para Excel/PDF
- [ ] Editor visual para automação

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456
