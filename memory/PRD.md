# TVDEFleet - Product Requirements Document

## Changelog (2026-01-10 - Session 4)
### Session Updates:
- **IMPLEMENTED**: Gestão do Histórico de Importações (`/lista-importacoes`)
  - Novo ficheiro de rotas: `/app/backend/routes/importacoes.py`
  - `DELETE /api/importacoes/{id}` - Eliminar importação e todos os registos associados
  - `PUT /api/importacoes/{id}/estado` - Alterar estado (processado, pendente, erro, revisto)
  - `GET /api/importacoes/{id}` - Obter detalhes de importação
- **IMPLEMENTED**: Escalões de KM Extra nos Veículos
  - Novos campos: `km_extra_escalao_1_limite`, `km_extra_escalao_1_valor`, `km_extra_escalao_2_valor`
  - Lógica: Até X km extra aplica valor do escalão 1, acima aplica valor do escalão 2
  - UI com fundo gradiente vermelho/laranja e exemplo de cálculo dinâmico
- **IMPLEMENTED**: Semanada por Época nos Veículos
  - Novos campos: `semanada_por_epoca`, `semanada_epoca_alta`, `semanada_epoca_baixa`
  - UI com fundo púrpura/índigo, campos laranja (alta) e azul (baixa)
  - Usa os mesmos meses configurados na secção KM por Época
- **IMPLEMENTED**: Periodicidade do Slot
  - Novo campo: `slot_periodicidade` (semanal, mensal, anual)
  - Dropdown na secção de compra do veículo
- **IMPLEMENTED**: Melhorias nos Contratos Assinados
  - Adicionado checkbox `assinado_gestor` 
  - Novo endpoint: `PUT /api/vehicles/{id}/contratos/{contrato_id}` para atualizar assinaturas
  - UI melhorada com checkboxes editáveis e botão "Download PDF"
- **FIXED**: Código duplicado no `ListaImportacoes.js` que impedia o frontend de compilar
- **TESTED**: Via screenshots - todas as funcionalidades verificadas

## Changelog (2026-01-10 - Session 3)
### Session Updates:
- **IMPLEMENTED**: KM por Época - Campos km_por_epoca, km_epoca_alta, km_epoca_baixa, meses_epoca_alta, meses_epoca_baixa no modelo TipoContrato
- **IMPLEMENTED**: Upload de Contratos Assinados - Endpoint POST /api/vehicles/{id}/upload-contrato
- **IMPLEMENTED**: Listagem de Contratos - Endpoint GET /api/vehicles/{id}/contratos
- **IMPLEMENTED**: Delete de Contratos - Endpoint DELETE /api/vehicles/{id}/contratos/{contrato_id}
- **TESTED**: 14/14 testes backend passaram (TestKMPorEpoca, TestContratosUpload, TestVehicleDataPersistence, TestUnauthorizedAccess, TestVehicleNotFound)
- **VERIFIED**: UI das secções Condições de Quilometragem e Contratos na FichaVeiculo.js

## Changelog (2026-01-10 - Session 2)
### Session Updates:
- **FIXED**: Upload de documento do motorista - erro MongoDB de conflito de path no $set
- **FIXED**: Duplicação do campo "Valor Aluguer" removida (secção legacy)
- **VALIDATED**: Comissão de Parceiro só aparece quando tipo = "comissao" (já funcionava)
- **VALIDATED**: Valor Aluguer aparece apenas para tipos de aluguer

## Changelog (2026-01-10 - Session 1)
### Session Updates:
- **FIXED**: Cartão Frota (Combustível) não guardava - adicionado `cartao_frota_id` ao modelo Pydantic
- **FIXED**: Cartão Frota Elétrico não guardava ID - adicionado `cartao_frota_eletric_id` ao modelo Pydantic  
- **REMOVED**: Secção duplicada "Contrato do Veículo" na ficha do veículo
- **ADDED**: Atribuição de custos (Motorista/Parceiro) no histórico de manutenções
- **ADDED**: Tipos de custo: Multa, Dano, Seguro com opção de dedução do motorista
- **UPDATED**: Modal de manutenção com grupos organizados (Manutenção, Reparação, Custos/Danos)

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

### Requisitos de Relatórios para Parceiros
O utilizador solicitou refinamentos ao sistema de relatórios:
1. **Relatório Semanal**: Consolidar ganhos (Uber, Bolt) e despesas (Via Verde, combustível, elétrico) para cada motorista
2. **Nova Lógica Financeira**: O valor líquido do parceiro é calculado como:
   - **Receitas do Parceiro** = Alugueres + Vendas de Veículos + Extras (dívidas, cauções, danos)
   - **Despesas Operacionais** = Combustível + Via Verde + Elétrico
   - **Líquido Parceiro** = Receitas - Despesas

---

## What's Been Implemented

### Janeiro 2026

#### ✅ Gestão do Histórico de Importações (10/01/2026 - Session 4)
**Status: COMPLETO E TESTADO**

**Backend:**
- Novo ficheiro: `/app/backend/routes/importacoes.py`
- Endpoints implementados:
  - `DELETE /api/importacoes/{id}` - Eliminar importação
  - `PUT /api/importacoes/{id}/estado` - Alterar estado
  - `GET /api/importacoes/{id}` - Obter detalhes
- Suporta múltiplas coleções: ganhos_uber, ganhos_bolt, portagens_viaverde, abastecimentos_combustivel, despesas_combustivel

**Frontend:**
- Corrigido código duplicado em `ListaImportacoes.js`
- Dropdown de estados funcional (Processado, Pendente, Revisto, Erro)
- Modal de confirmação de eliminação

#### ✅ KM por Época e Contratos Assinados (10/01/2026 - Session 3)
**Status: COMPLETO E TESTADO (14/14 testes passaram)**

**Backend:**
- Novos campos no modelo TipoContrato: `km_por_epoca`, `km_epoca_alta`, `km_epoca_baixa`, `meses_epoca_alta`, `meses_epoca_baixa`
- Novo campo no modelo Vehicle: `contratos` (List[Dict])
- Endpoints de contratos:
  - `POST /api/vehicles/{id}/upload-contrato` - Upload de PDF de contrato
  - `GET /api/vehicles/{id}/contratos` - Lista contratos
  - `DELETE /api/vehicles/{id}/contratos/{contrato_id}` - Remove contrato

**Frontend:**
- Secção "Condições de Quilometragem" expandida com:
  - Toggle "KM diferentes por época (Alta/Baixa)"
  - Inputs para KM época alta e baixa
  - Botões de seleção de meses para época alta
- Secção "Contratos" com:
  - Upload de PDF de contrato assinado
  - Listagem de contratos com badges Motorista/Parceiro
  - Botão de download

#### ✅ Refatoração do Backend - Modularização de Rotas (10/01/2026)
**Status: COMPLETO - Fase 1**

**Novos ficheiros de rotas criados:**
- `/app/backend/routes/parceiros.py` - CRUD completo para parceiros
- `/app/backend/routes/planos.py` - Gestão de planos
- `/app/backend/routes/pagamentos.py` - CRUD de pagamentos
- `/app/backend/routes/reports.py` - Relatórios
- `/app/backend/routes/gestores.py` - Gestão de gestores

#### ✅ Sistema de Extras/Dívidas do Motorista (10/01/2026)
**Status: COMPLETO E TESTADO (29/29 testes passaram)**

**Backend:**
- API CRUD completa em `/app/backend/routes/extras.py`
- Validação de campos obrigatórios

**Frontend:**
- Página `/gestao-extras` com UI completa
- Cards de resumo: Total Extras, Pendentes, Pagos

---

## Architecture

### Key API Endpoints
```
# KM por Época e Contratos
PUT  /api/vehicles/{id}                           # Atualiza tipo_contrato com campos km_por_epoca
GET  /api/vehicles/{id}/contratos                 # Lista contratos do veículo
POST /api/vehicles/{id}/upload-contrato           # Upload PDF de contrato
DELETE /api/vehicles/{id}/contratos/{contrato_id} # Remove contrato

# Extras Motorista
GET  /api/extras-motorista           # Lista com filtros
POST /api/extras-motorista           # Criar
PUT  /api/extras-motorista/{id}      # Atualizar
DELETE /api/extras-motorista/{id}    # Eliminar

# Relatórios
GET /api/relatorios/parceiro/resumo-semanal     # Resumo com extras
GET /api/relatorios/parceiro/historico-semanal  # Dados para gráficos
GET /api/relatorios/gerar-link-whatsapp/{id}    # Link WhatsApp
POST /api/relatorios/enviar-relatorio/{id}      # Enviar por email

# Gestão de Importações (NEW - Session 4)
DELETE /api/importacoes/{id}                    # Eliminar importação
PUT    /api/importacoes/{id}/estado             # Alterar estado
GET    /api/importacoes/{id}                    # Detalhes de importação
```

### Database Collections
```javascript
// vehicles - tipo_contrato now includes:
{
  tipo_contrato: {
    km_por_epoca: boolean,
    km_epoca_alta: number,
    km_epoca_baixa: number,
    meses_epoca_alta: [number],  // e.g., [6,7,8,9]
    meses_epoca_baixa: [number]
  },
  contratos: [{
    id: string,
    tipo: string,
    documento_url: string,
    motorista_id: string,
    motorista_nome: string,
    assinado_motorista: boolean,
    assinado_parceiro: boolean,
    data: string,
    uploaded_by: string,
    uploaded_at: string
  }]
}

// Import records (in multiple collections) now include:
{
  ficheiro_nome: string,      // Used as ID for grouped imports
  estado: string,             // processado, pendente, erro, revisto
  estado_atualizado_em: string,
  estado_atualizado_por: string
}
```

---

## Prioritized Backlog

### P0 - Bloqueado
- [ ] Configurar SENDGRID_API_KEY para ativar envio de emails

### P1 - Alta Prioridade
- [ ] Implementar foto de perfil do motorista (pendente de sessões anteriores)
- [ ] Continuar refatoração: mover mais endpoints do `server.py` para ficheiros dedicados

### P2 - Média Prioridade
- [ ] Implementar sincronização automática (RPA)
- [ ] Dashboard de ROI com cálculos automáticos usando dados de investimento

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal com lista de transações Via Verde
- [ ] Notificações sobre importação
- [ ] Editor visual para automação RPA

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Data
- **Test Vehicle**: AB-12-CD (ID: c89c2b6b-2804-4044-b479-f51a91530466)
  - km_por_epoca: true
  - km_epoca_alta: 2000
  - km_epoca_baixa: 1200
  - meses_epoca_alta: [6, 7, 8, 9]
  - 2 contratos de teste carregados

## Test Reports
- `/app/test_reports/iteration_5.json` - 14/14 testes KM por Época e Contratos
- `/app/tests/test_km_epoca_contratos.py` - Suite de testes pytest
