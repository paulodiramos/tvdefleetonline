# TVDEFleet - Product Requirements Document

## Changelog (2026-01-11 - Session 7 - IDs Plataformas Uber/Bolt + Correções P1)
### Session Updates:
- **IMPLEMENTED**: Campos de ID de Plataforma para Motoristas (P0)
  - Frontend: Campos `ID Uber (UUID)` e `ID Bolt` na tab "Plataformas" em `FichaMotorista.js`
  - Backend: Modelo Pydantic `Motorista` já tinha os campos `uuid_motorista_uber` e `identificador_motorista_bolt`
  - Endpoint `PUT /api/motoristas/{id}` aceita e persiste os novos campos
  - Adicionado ícone `Hash` aos imports do lucide-react
- **UPDATED**: Lógica de importação Uber (`process_uber_csv` em `server.py`)
  - Prioridade 1: Pesquisa por `uuid_motorista_uber`
  - Prioridade 2: Fallback para pesquisa por nome
  - Guarda `motorista_id` quando encontra correspondência
- **UPDATED**: Lógica de importação Bolt (`process_bolt_csv` em `server.py`)
  - Prioridade 1: Pesquisa por `identificador_motorista_bolt`
  - Prioridade 2: Fallback para email principal
  - Prioridade 3: Fallback para email_bolt
  - Prioridade 4: Fallback para nome
  - Guarda `motorista_id` quando encontra correspondência
- **BUG FIX**: Correção do campo de combustível em múltiplos endpoints
  - Alterado de `valor_liquido` para usar ordem: `valor_total` → `valor` → `valor_liquido`
  - Afectados: WhatsApp, Email, PDF e dashboard de relatórios
- **VERIFIED**: Edição de resumo semanal funciona correctamente
  - Ajustes são gravados em `ajustes_semanais` e lidos no cálculo
  - Status mostra `editado_manual` e `tem_ajuste_manual=True`
- **VERIFIED**: Importação de elétrico (new-line error) já foi corrigida em sessões anteriores
- **TESTED**: API IDs plataforma funciona
- **TESTED**: UI mostra e permite editar os IDs
- **TESTED**: Edição resumo semanal grava e lê correctamente

## Changelog (2026-01-11 - Session 6g - Bug Fixes Bolt & Combustível)
### Session Updates:
- **BUG FIX**: Import Bolt não encontrava motoristas
  - Adicionada busca por email além do identificador Bolt
  - Se encontra por email, actualiza automaticamente o `identificador_motorista_bolt`
  - Resultado: 9 motoristas encontrados (antes era só 1)
- **BUG FIX**: Combustível usava coluna errada (VALOR LÍQUIDO em vez de TOTAL)
  - Adicionado campo `valor_total` e `valor` à importação
  - `valor` agora usa TOTAL (com IVA) como valor principal
- **BUG FIX**: Combustível não aparecia no resumo semanal
  - Query só procurava por data, mas dados têm semana/ano diferente
  - Corrigida query para buscar por `data` OU `semana/ano`
- **TESTED**: Import Bolt - 9 motoristas encontrados
- **TESTED**: Import Combustível - 9 registos, valores correctos (€339.58 + €262.59 = €602.17)
- **TESTED**: Resumo S2/2026 mostra combustível correctamente

## Changelog (2026-01-11 - Session 6f - Bug Fixes Importação Elétrico)
### Session Updates:
- **BUG FIX**: Carregamentos elétricos eram gravados na colecção errada (`portagens_viaverde`)
  - Corrigido para gravar em `despesas_combustivel`
  - Migrados 1498 registos da colecção errada para a correcta
- **BUG FIX**: Valor do carregamento elétrico não era lido correctamente
  - Adicionada leitura das colunas TOTAL e TOTAL c/ IVA
  - Campo `valor_total` agora é correctamente guardado
  - Adicionados campos `cartao_frota_id` e `valor` para compatibilidade
- **BUG FIX**: Query de elétrico no resumo não encontrava registos
  - Adicionada busca por `cartao_frota_id` além de `card_code`
- **TESTED**: Importação eletrico.xlsx S3/2026 - €301.73 total (20 registos)
- **TESTED**: Resumo semanal mostra correctamente os valores elétricos

## Changelog (2026-01-11 - Session 6e - Bug Fixes Resumo & Importação)
### Session Updates:
- **BUG FIX**: Edição manual no resumo semanal não gravava
  - Os valores eram guardados em `ajustes_semanais` mas nunca eram lidos
  - Adicionada verificação de ajustes manuais ao calcular resumo
  - Valores do ajuste manual substituem os valores calculados
  - Adicionado flag `tem_ajuste_manual` e `status: editado_manual`
- **BUG FIX**: Importação de ficheiro elétrico Excel dava erro "new-line character"
  - Adicionado suporte para `plataforma=carregamento` com ficheiros `.xlsx`
  - Agora detecta automaticamente e chama `importar_carregamentos_excel()`
- **TESTED**: Edição manual de Arlei Oliveira S2/2026 - valores guardados e aplicados
- **TESTED**: Importação de eletrico.xlsx - 20 carregamentos importados

## Changelog (2026-01-11 - Session 6d - GPS Verizon & Manutenção)
### Session Updates:
- **IMPLEMENTED**: Sistema de Importação GPS Verizon Fleet
  - Endpoint `POST /api/import/gps-odometro` - Importa CSV com km dos veículos
  - Detecção automática de colunas (matrícula, km, data, motorista)
  - Actualização automática do `km_atual` dos veículos
  - Só actualiza se o novo km for maior que o actual
- **IMPLEMENTED**: Sistema de Alertas de Revisão
  - Alerta automático quando faltam X km para revisão (`km_aviso_manutencao`, default 5000)
  - Alerta crítico quando km de revisão é ultrapassado
  - Notificações para parceiro e gestores
  - Endpoint `GET /api/alertas/revisao` - Lista alertas pendentes
  - Endpoint `PUT /api/alertas/{id}/resolver` - Marca alerta como resolvido
- **IMPLEMENTED**: Dashboard de Manutenção
  - Endpoint `GET /api/dashboard/manutencao` - Resumo da frota
  - Mostra veículos com revisão em dia, próxima e atrasada
  - Lista top 20 veículos em alerta ordenados por prioridade
- **TESTED**: Importação GPS actualiza km e cria alertas automaticamente
- **TESTED**: Dashboard mostra métricas correctamente

## Changelog (2026-01-11 - Session 6c - Bug Fixes)
### Session Updates:
- **BUG FIX**: Motorista desativado aparecia nos relatórios semanais
  - Adicionado filtro `status_motorista=ativo` na query de motoristas em `routes/relatorios.py`
  - Agora só motoristas com status "ativo" (ou sem status definido) aparecem no resumo
- **BUG FIX**: Não era possível eliminar dados Via Verde
  - A query de delete usava apenas `motorista_id`, mas os dados Via Verde estão ligados por `via_verde_id`
  - Corrigido para também buscar por `via_verde_id`, `obu` e `matricula` do veículo
- **BUG FIX**: Importação Bolt CSV não guardava o período (semana/ano)
  - Adicionados parâmetros `periodo_inicio` e `periodo_fim` ao endpoint `/api/import/bolt/ganhos`
  - O período é agora calculado automaticamente a partir da data de início
- **TESTED**: Delete Via Verde eliminou 5 registos para Bruno Coelho S1/2026
- **TESTED**: Importação Bolt CSV guarda período correctamente (2026W2)

## Changelog (2026-01-11 - Session 6 - Foto de Perfil & Refatoração)
### Session Updates:
- **IMPLEMENTED**: Funcionalidade de Foto de Perfil do Motorista (P1)
  - Endpoint `POST /api/motoristas/{id}/foto` - Upload com processamento de imagem
  - Endpoint `GET /api/motoristas/{id}/foto` - Visualização da foto
  - Endpoint `DELETE /api/motoristas/{id}/foto` - Eliminar foto
  - Processamento automático: redimensionamento 300x300, crop quadrado, JPEG otimizado
- **BUG FIX**: Resumo semanal não mostrava valor do aluguer
  - Corrigido para buscar `tipo_contrato.valor_aluguer` quando `valor_semanal` está vazio
- **BUG FIX**: Endpoints ganhos-bolt e ganhos-uber falhavam com ObjectId error
  - Adicionado `{"_id": 0}` nas queries MongoDB
- **REFACTORED**: Backend - Criados novos ficheiros de rotas:
  - `routes/sincronizacao.py` (599 linhas) - Sincronização e credenciais de plataformas
  - `routes/public.py` (211 linhas) - Endpoints públicos (veículos, contacto, parceiros)
  - `routes/ganhos.py` (140 linhas) - Endpoints de ganhos Uber/Bolt
- **UPDATED**: `routes/__init__.py` - Total de 24 routers exportados
- **TESTED**: Foto de perfil funciona via curl e frontend
- **TESTED**: Resumo semanal retorna aluguer correctamente (€2859.95)
- **TESTED**: Ganhos Bolt retorna 9 registos

## Changelog (2026-01-10 - Session 5c - Fixes Adicionais)
### Session Updates:
- **BUG FIX**: Campo `disponivel_para_aluguer` adicionado ao modelo Vehicle
- **BUG FIX**: URL de download de documentos corrigido (removido /api duplicado)
- **BUG FIX**: Upload de documentos URL corrigido (`${API}/motoristas/...` em vez de `${API}/api/motoristas/...`)
- **TESTED**: Página pública /veiculos mostra 2 veículos disponíveis com condições
- **TESTED**: Download de documentos PDF funciona via URL público
- **TESTED**: Checkbox "Disponível para Aluguer" grava e carrega correctamente

## Changelog (2026-01-10 - Session 5b - Bugs & Funcionalidades)
### Session Updates:
- **BUG FIX**: Aprovação de documentos agora atualiza `status_motorista` para "ativo"
- **BUG FIX**: Download de documentos corrigido (procura em `documentos` e `documents`)
- **BUG FIX**: Endpoint GET motorista retorna todos os campos da base de dados
- **BUG FIX**: Erro `AttributeError` no endpoint `proximas-datas-dashboard` corrigido
- **IMPLEMENTED**: Valores do Slot só aparecem quando tipo_contrato="slot"
- **IMPLEMENTED**: Campos preenchidos têm cor mais escura (função `getFilledInputClass`)
- **IMPLEMENTED**: Secção "Publicação na Página de Veículos" em FichaVeiculo
  - Checkboxes: "Disponível para Aluguer" e "Disponível para Venda"
- **IMPLEMENTED**: Página pública /veiculos mostra veículos sem motorista
  - Condições contratuais: valor semanal, caução, KM incluídos, garantia
  - Badge "Disponível para Aluguer"
- **ADDED**: Tipo de contrato "Slot" nas opções

## Changelog (2026-01-10 - Session 5 - Refatoração Backend)
### Session Updates:
- **REFACTORED**: Backend - Criados novos ficheiros de rotas organizados por domínio:
  - `routes/admin.py` - Endpoints de configurações administrativas
  - `routes/alertas.py` - Endpoints de alertas e verificação
  - `routes/contratos.py` - Endpoints CRUD de contratos
- **REFACTORED**: Backend - Criados novos ficheiros de utilitários:
  - `utils/file_handlers.py` - Funções de upload e conversão de ficheiros
  - `utils/alerts.py` - Lógica de verificação e criação de alertas
- **REFACTORED**: Backend - Criados novos ficheiros de modelos:
  - `models/parceiro.py` - Modelos Parceiro, ParceiroCreate, AdminSettings
  - `models/ganhos.py` - Modelos GanhoUber, GanhoBolt, ViaVerde, GPS, Combustível
  - `models/sincronizacao.py` - Modelos CredenciaisPlataforma, LogSincronizacao
- **UPDATED**: `models/__init__.py` - Exporta todos os novos modelos
- **UPDATED**: `routes/__init__.py` - Exporta todos os routers (21 total)
- **UPDATED**: `server.py` - Importa utilitários dos novos módulos
- **TESTED**: Novos endpoints funcionais via curl

## Changelog (2026-01-10 - Session 4)
### Session Updates:
- **IMPLEMENTED**: Gestão do Histórico de Importações (`/lista-importacoes`)
  - Endpoints: DELETE, PUT estado, GET detalhes de importações
- **IMPLEMENTED**: Escalões de KM Extra nos Veículos
  - Campos: `km_extra_escalao_1_limite`, `km_extra_escalao_1_valor`, `km_extra_escalao_2_valor`
- **IMPLEMENTED**: Semanada por Época com configuração de meses própria
  - Campos: `semanada_por_epoca`, `semanada_epoca_alta`, `semanada_epoca_baixa`
  - Campos: `semanada_meses_epoca_alta`, `semanada_meses_epoca_baixa` (arrays de meses 1-12)
  - UI: Botões clicáveis para selecionar meses de época alta/baixa
- **IMPLEMENTED**: Valores do Slot por Periodicidade
  - Campos: `slot_periodicidade` (semanal/mensal/anual)
  - Campos: `slot_valor_semanal`, `slot_valor_mensal`, `slot_valor_anual`
  - UI: 3 campos com destaque visual do valor da periodicidade selecionada
- **IMPLEMENTED**: Garantia do Veículo
  - Campos: `tem_garantia`, `data_limite_garantia`
  - UI: Checkbox + campo de data + indicador de validade (válida/expirada)
- **IMPLEMENTED**: Melhorias nos Contratos Assinados
  - Adicionado `assinado_gestor` + endpoint PUT para atualizar assinaturas
- **TESTED**: Via screenshots - todas as funcionalidades verificadas e funcionais

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
- [x] ~~Implementar foto de perfil do motorista~~ - COMPLETO (Session 6)
- [x] ~~Bug: Resumo semanal não busca aluguer do veículo~~ - COMPLETO (Session 6)
- [x] ~~Refatoração Backend~~ - Em progresso (24 routers criados)

### P2 - Média Prioridade
- [ ] Continuar refatoração: mover mais endpoints do `server.py` para ficheiros dedicados (ainda restam ~22.000 linhas)
- [ ] Implementar sincronização automática (RPA)
- [ ] Dashboard de ROI com cálculos automáticos usando dados de investimento

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal com lista de transações Via Verde
- [ ] Notificações sobre importação
- [ ] Editor visual para automação RPA

---

## Architecture Overview

### Backend Structure (Refactored)
```
/app/backend/
├── server.py              # Main FastAPI app (~21.000 linhas - em refatoração)
├── models/                # Pydantic models
│   ├── __init__.py       # Exporta todos os modelos
│   ├── user.py           # User, UserRole, TokenResponse
│   ├── motorista.py      # Motorista, MotoristaCreate, Documentos
│   ├── veiculo.py        # Vehicle, TipoContrato, Insurance, etc.
│   ├── parceiro.py       # Parceiro, ParceiroCreate, AdminSettings (NOVO)
│   ├── ganhos.py         # GanhoUber, GanhoBolt, ViaVerde, GPS, Combustível (NOVO)
│   ├── sincronizacao.py  # Credenciais, LogSync (NOVO)
│   ├── contrato.py       # Contratos motorista
│   ├── plano.py          # Planos de assinatura
│   └── relatorio.py      # Relatórios semanais
├── routes/               # API endpoints (21 routers)
│   ├── __init__.py       # Exporta todos os routers
│   ├── auth.py           # Autenticação
│   ├── admin.py          # Configurações admin (NOVO)
│   ├── alertas.py        # Alertas e verificações (NOVO)
│   ├── contratos.py      # CRUD de contratos (NOVO)
│   ├── vehicles.py       # Veículos (~2600 linhas)
│   ├── relatorios.py     # Relatórios (~3500 linhas)
│   ├── motoristas.py     # Motoristas
│   ├── parceiros.py      # Parceiros
│   └── ... (outros)
├── utils/                # Utilities
│   ├── file_handlers.py  # Upload, conversão PDF (NOVO)
│   ├── alerts.py         # Verificação de alertas (NOVO)
│   ├── database.py       # Conexão MongoDB
│   ├── auth.py           # JWT helpers
│   └── csv_parsers.py    # Parsers de CSV
└── services/             # Business logic
    └── envio_relatorios.py
```

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
