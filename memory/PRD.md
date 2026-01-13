# TVDEFleet - Product Requirements Document

## Changelog (2026-01-13 - Session 12 - Refatoração Backend CONCLUÍDA)

### P0/P1/P2/P3 - Refatoração do Backend - SUCESSO
- **Estado inicial:** 21.969 linhas, 300 endpoints no `api_router`
- **Estado final:** 17.505 linhas, 192 endpoints no `api_router`
- **Redução total:** ~4.464 linhas (~20%) e 108 endpoints removidos
- **Routers modulares:** 39 ficheiros

### Endpoints Removidos do server.py (Já existentes nos routers):
1. **Vehicles** (~1.700 linhas): CRUD, photos, agenda, historico, document uploads, maintenance, vistorias
2. **Motoristas** (~656 linhas): upload, validação, moloni, planos, parceiros, documentos
3. **Parceiros** (~700 linhas): CRUD, register-public, csv-examples, certidao-permanente, meu-plano, alertas
4. **Planos CRUD** (~158 linhas): get, post, put, delete básicos
5. **Subscription/Planos** (~487 linhas): admin/planos, promocao, comprar-plano-motorista, public, seed
6. **Planos Motorista/Sistema/Parceiro** (~267 linhas): CRUD completo para cada tipo

### Testes Validados:
- ✅ `GET /api/planos` - 3 planos retornados
- ✅ `GET /api/vehicles` - 29 veículos retornados
- ✅ `GET /api/parceiros` - funcionando
- ✅ `GET /api/motoristas` - funcionando
- ✅ Backend reiniciou sem erros após cada modificação

### Meta Atingida:
- **Objetivo:** Reduzir server.py para < 18.000 linhas ✅
- **Resultado:** 17.505 linhas (~20% de redução)

---

## Changelog (2026-01-13 - Session 11 - Features + Melhorias Completas)

### Widget de Alertas no Dashboard (COMPLETO)
- **Localização:** Dashboard principal, após o card "Resumo Semanal"
- **Funcionalidades:**
  - Mostra até 3 alertas de custos ativos
  - Card com gradiente vermelho/laranja quando há alertas
  - Ícone específico por categoria (Fuel, Zap, MapPin, Shield, Wrench)
  - Badge com percentual de utilização
  - Valores atuais vs limites configurados
  - Botão "Ver Todos →" para ir à página /alertas-custos
  - Só aparece quando há alertas ativos
- **Ficheiro:** `/app/frontend/src/pages/Dashboard.js`

### Sistema de Alertas de Custos - MELHORIA (COMPLETO)
- **Nova página:** `/alertas-custos` (`/app/frontend/src/pages/AlertasCustos.js`)
- **Funcionalidades:**
  - Configuração de limites por categoria (11 categorias)
  - Período de análise: semanal ou mensal
  - Slider para percentual de aviso (50-95%)
  - Notificações na app e/ou email
  - Tab "Estado Atual" mostra alertas ativos
  - Tab "Histórico" mostra alertas passados
  - Alertas automáticos quando limites são ultrapassados
- **Backend:** Novos endpoints em `/app/backend/routes/alertas.py`:
  - `GET/POST /api/alertas/config-limites` - Configuração
  - `GET /api/alertas/custos/verificar` - Verificar estado
  - `GET /api/alertas/custos/historico` - Histórico
- **Menu:** Financeiro → "🔔 Alertas de Custos"
- **Testado:** 13/13 testes backend + UI validada

### Relatório de Custos por Fornecedor - MELHORIA (COMPLETO)
- **Nova página:** `/relatorio-fornecedores` (`/app/frontend/src/pages/RelatorioFornecedores.js`)
- **Funcionalidades:**
  - Dashboard de análise de custos por categoria (Combustível, Via Verde, GPS, Seguros, etc.)
  - Gráfico de distribuição com percentagens
  - Top fornecedores com maior volume de despesas
  - Evolução mensal com variações mês-a-mês
  - Top veículos e motoristas com mais despesas
  - Distribuição por responsabilidade (Motorista vs Parceiro)
  - Filtro por ano
- **Backend:** Novos endpoints em `/app/backend/routes/despesas.py`:
  - `GET /api/despesas/relatorio-fornecedores` - Relatório completo
  - `GET /api/despesas/relatorio-fornecedores/comparativo` - Comparativo mensal
- **Menu:** Adicionado em Relatórios → "💰 Custos Fornecedores"

### P2 - Refatoração do Backend (CONCLUÍDO PARCIALMENTE)
- **Estado final:**
  - **38 routers modulares** criados
  - **22.175 linhas** no server.py (reduzido de 22.490)
  - **310 endpoints** no server.py (reduzido de 327)
  - **~315 linhas** de código duplicado removidas
  - **17 endpoints duplicados** removidos
- **Novos routers criados nesta sessão:**
  - `vistorias.py` (12 endpoints)
  - `cartoes_frota.py` (9 endpoints)
  - `templates_contratos.py` (8 endpoints)
  - `ficheiros_importados.py` (9 endpoints)
  - `agenda.py` (11 endpoints)
- **Routers completos:** admin, agenda, alertas, auth, automacao, cartoes_frota, configuracoes, contratos, csv_config, dashboard, despesas, documentos, extras, ficheiros_importados, fornecedores, ganhos, gestores, ifthenpay, importacoes, manutencao, mensagens, modulos, motoristas, notificacoes, pagamentos, parceiros, planos, public, recibos, relatorios, reports, sincronizacao, storage, templates_contratos, terabox, users, vehicles, vistorias

### UI de Admin para Fornecedores (COMPLETO)
- **Nova página:** `/admin/fornecedores` (`/app/frontend/src/pages/AdminFornecedores.js`)
- **Funcionalidades:**
  - CRUD completo de fornecedores (criar, editar, eliminar)
  - Filtro por 8 tipos: Combustível Fóssil, Elétrico, GPS, Seguros, Manutenção, Lavagem, Pneus, Outros
  - Pesquisa por nome/descrição
  - Cards de estatísticas por tipo com ícones coloridos
  - Seed de fornecedores padrão (Galp, BP, Mobi.E, etc.)
- **Permissões:** Apenas Admin

### Página de Envio WhatsApp Business (COMPLETO)
- **Nova página:** `/whatsapp-envio` (`/app/frontend/src/pages/WhatsAppEnvio.js`)
- **Funcionalidades:**
  - Selecionar múltiplos motoristas para envio
  - Templates de mensagem pré-definidos (Relatório Semanal, Documento a Expirar, Boas-vindas)
  - Compor mensagem personalizada
  - Contador de caracteres
  - Tab de Histórico de mensagens enviadas
  - Indicador de modo de API (Cloud API vs Link wa.me)
  - Link para configurações de WhatsApp
- **Backend:** Novos endpoints adicionados:
  - `GET /api/parceiros/{id}/whatsapp-historico` - Histórico de mensagens
  - `POST /api/parceiros/{id}/whatsapp/enviar-motoristas` - Enviar mensagens

### Bug Fix: Erro de Compilação Frontend Terabox (CORRIGIDO)
- **Problema:** A página Terabox.js não compilava devido a um ícone inexistente (`FilePdf`)
- **Solução:** Substituído por `FileText` na função `getFileIcon()`
- **Ficheiro:** `/app/frontend/src/pages/Terabox.js`

---

## Changelog (2026-01-13 - Session 10 - Bug Fixes, Notificações, Email & Refatoração)

### Melhorias no Sistema de Notificações (COMPLETO)

#### Dados de Contacto do Emissor
- **Novo Campo:** `contacto_emissor` nas notificações com nome, email, telefone e role
- **Novo Campo:** `emissor_id` para rastrear quem criou a notificação
- **UI:** Modal de detalhes mostra contactos clicáveis (mailto, tel)

#### Sistema de Notas nas Notificações
- **Novo Campo:** `notas` editáveis em cada notificação
- **Novo Endpoint:** `PUT /api/notificacoes/{id}` para actualizar notas
- **Novo Endpoint:** `GET /api/notificacoes/{id}` para obter detalhes completos
- **UI:** Secção de notas no modal com editor inline

#### Dados de Contacto nas Mensagens
- **Melhorado:** Cabeçalho de conversa mostra email e telefone do participante

### Sistema de Envio de Email SMTP (COMPLETO)

#### Serviço de Email
- **Novo ficheiro:** `/app/backend/utils/email_service.py`
- Classe `EmailService` para envio via SMTP do parceiro
- Templates HTML para relatórios semanais e alertas de documentos
- Suporte a anexos, CC e BCC

#### Endpoint de Envio
- **Novo Endpoint:** `POST /api/parceiros/{id}/enviar-email-motoristas`

### Bug Fixes

#### 1. Parsing de Datas Multi-formato (CORRIGIDO)
- **Problema:** Datas no formato `dd/mm/yyyy` causavam erros de parsing
- **Solução:** Função `parse_date()` que suporta múltiplos formatos
- **Ficheiro:** `/app/backend/utils/notificacoes.py`

#### 2. Download documentos de motorista (CORRIGIDO)
- Endpoint procura agora em `documents` E `documentos`

#### 3. Parceiro criar templates de contrato (CORRIGIDO)
- `UserRole.PARCEIRO` adicionado às permissões

### Sistema Terabox - Armazenamento de Documentos (COMPLETO)

#### Backend (`/app/backend/routes/terabox.py`)
- **Gestão de Pastas:**
  - `GET /api/terabox/pastas` - Listar pastas
  - `POST /api/terabox/pastas` - Criar pasta
  - `DELETE /api/terabox/pastas/{id}` - Eliminar pasta

- **Gestão de Ficheiros:**
  - `GET /api/terabox/ficheiros` - Listar ficheiros
  - `POST /api/terabox/upload` - Upload de ficheiro
  - `POST /api/terabox/upload-multiplo` - Upload múltiplo
  - `GET /api/terabox/download/{id}` - Download de ficheiro
  - `GET /api/terabox/preview/{id}` - Preview (imagens/PDFs)
  - `PUT /api/terabox/ficheiros/{id}/mover` - Mover ficheiro
  - `PUT /api/terabox/ficheiros/{id}/renomear` - Renomear
  - `DELETE /api/terabox/ficheiros/{id}` - Eliminar

- **Outros:**
  - `GET /api/terabox/stats` - Estatísticas de armazenamento
  - `GET /api/terabox/pesquisar` - Pesquisa de ficheiros
  - `GET /api/terabox/categorias` - Categorias disponíveis

#### Frontend (`/app/frontend/src/pages/Terabox.js`)
- Interface estilo explorador de ficheiros
- Navegação por breadcrumbs
- Upload por drag & drop ou botão
- Preview de imagens e PDFs
- Pesquisa integrada
- Estatísticas de armazenamento

#### Armazenamento
- Base: `/app/backend/uploads/terabox/{parceiro_id}/`
- Cada parceiro tem o seu espaço isolado
- Organização por pastas hierárquicas
- Metadados em MongoDB (terabox_pastas, terabox_ficheiros)

---

### Sistema de WhatsApp Business (COMPLETO)

#### Serviço de WhatsApp
- **Novo ficheiro:** `/app/backend/utils/whatsapp_service.py`
- Suporta dois modos:
  - **Cloud API:** WhatsApp Business API oficial da Meta (requer credenciais)
  - **Web Link:** Gera links wa.me para envio manual (fallback)
- Templates para relatórios semanais, alertas de documentos, boas-vindas

#### Endpoints de Envio
- **Novo Endpoint:** `POST /api/parceiros/{id}/enviar-whatsapp-motoristas`
- **Novo Endpoint:** `POST /api/parceiros/{id}/enviar-relatorio-whatsapp/{motorista_id}`
- Log de mensagens enviadas na colecção `whatsapp_log`

### Refatoração do Backend (EM PROGRESSO)

#### Novo Router: documentos.py
- **Novo ficheiro:** `/app/backend/routes/documentos.py`
- Endpoints migrados:
  - `GET /api/documentos/pendentes`
  - `GET /api/documentos/user/{user_id}`
  - `PUT /api/documentos/{documento_id}/aprovar`
  - `PUT /api/documentos/{documento_id}/rejeitar`
  - `PUT /api/documentos/user/{user_id}/aprovar-todos`
  - `GET /api/users/{user_id}/complete-details`

#### Novo Router: users.py
- **Novo ficheiro:** `/app/backend/routes/users.py`
- Endpoints: pending, all, approve, set-role, status, delete, reset-password

#### Novo Router: storage.py
- **Novo ficheiro:** `/app/backend/routes/storage.py`
- Endpoints: Google Drive connect, callback, status, upload, files, configure

#### Novo Router: modulos.py
- **Novo ficheiro:** `/app/backend/routes/modulos.py`
- Endpoints: listar módulos, atribuir/adicionar/remover módulos de utilizador

#### Novo Router: recibos.py
- **Novo ficheiro:** `/app/backend/routes/recibos.py`
- Endpoints: CRUD recibos, verificação, pagamentos-recibos

#### Novo Router: dashboard.py
- **Novo ficheiro:** `/app/backend/routes/dashboard.py`
- Endpoints: dashboard stats, parceiro estatísticas, próximas datas, alertas stats

#### Novo Router: fornecedores.py
- **Novo ficheiro:** `/app/backend/routes/fornecedores.py`
- Endpoints: CRUD fornecedores, tipos, seed default (Galp, BP, Mobi.E, etc)

#### Estado da Refatoração
- **server.py:** ~22.400 linhas (ainda tem endpoints duplicados)
- **Routers criados:** 33 ficheiros em `/app/backend/routes/`
- **Nota:** Os novos routers têm precedência sobre os endpoints do server.py

---

## Changelog (2026-01-12 - Session 9 - Final)

### Sistema de Planos de Motorista (COMPLETO)
**Página:** `/admin/planos-motorista`

**3 Categorias Implementadas:**
1. **Básico** (€0/mês) - Apenas consulta de ganhos
2. **Standard** (€9.99/mês) - Consulta + Envio de recibos
3. **Premium** (€19.99/mês) - Tudo + Relatórios + Autofaturação

**Funcionalidades:**
- Visualização dos 3 planos em cards
- Editar nome, descrição, preços e funcionalidades
- Activar/desactivar planos
- Tab de categorias com explicação dos módulos
- Estatísticas de motoristas por plano
- Endpoint: `/api/admin/planos-motorista-sistema`

---

### Correções e Melhorias

#### 1. Bug Fix: Ganhos Bolt no PDF vs Resumo Semanal (CORRIGIDO)
- **Problema:** Valores diferentes entre resumo semanal e PDF
- **Causa:** Campo `valor_liquido` não estava a ser lido no resumo semanal para `viagens_bolt`
- **Ficheiro:** `/app/backend/routes/relatorios.py` linha 921

#### 2. Menu Configurações do Parceiro (COMPLETO)
- Adicionado link "📧 Email & Credenciais" no submenu Configurações
- Ficheiro: `/app/frontend/src/components/Layout.js`

#### 3. Sistema RPA - Nova/Editar Automação (COMPLETO)
- Botão "Nova Automação" adicionado
- Modal com campos: Nome, Descrição, Frequência, Ícone, Ativar
- Botões de Editar e Eliminar em cada automação
- Badge "Sistema" para automações pré-definidas
- Ficheiro: `/app/frontend/src/pages/AutomacaoRPA.js`

#### 4. Menu Admin - Automação RPA (COMPLETO)
- Reorganizado menu admin com `/automacao-rpa` em destaque
- Ficheiro: `/app/frontend/src/components/Layout.js`

---

### Novas Funcionalidades Implementadas (Sessão Anterior)

#### 1. Sistema de Email por Parceiro (COMPLETO)
- Página `/configuracoes-parceiro` com configuração SMTP
- Campos: Servidor SMTP, Porta, Utilizador, Password, Nome Remetente, Email Remetente
- Opção TLS, botão testar email
- Endpoints: `GET/PUT /api/parceiros/{id}/config-email`, `POST /api/parceiros/{id}/config-email/testar`

#### 2. Credenciais de Plataformas (COMPLETO)
- Tab na página de configurações do parceiro
- Campos para Uber (Email, Telemóvel, Password), Bolt (Email, Password), Via Verde (Utilizador, Password)
- Passwords mascaradas com opção mostrar/esconder
- Endpoints: `GET/PUT /api/parceiros/{id}/credenciais-plataformas`

#### 3. Contacto de Emergência do Motorista (COMPLETO)
- Secção na ficha do motorista com destaque laranja
- Campos: Nome, Telefone, Parentesco, Email, Morada, Código Postal, Localidade
- Dados guardados no modelo do motorista

#### 4. Sistema RPA Admin (COMPLETO - Interface)
- Página `/automacao-rpa` restrita a administradores
- Lista de 5 automações: Uber, Bolt, Via Verde, Envio Relatórios, Alertas Documentos
- Tabs: Visão Geral, Histórico, Configurações
- **Nota:** Interface implementada, lógica de execução automática pendente (em desenvolvimento)

---

### Bug Fix: Uber Portagens no Cálculo do Líquido (COMPLETO)

**Problema:** O valor das "Uber Portagens" não estava a ser somado aos ganhos para calcular o líquido.

**Lógica de Negócio Corrigida:**
- `Rendimentos Uber` = Coluna "Pago a si:Os seus rendimentos" (sem portagens)
- `Uber Portagens` = Portagem + Imposto (reembolsado pela Uber)
- **Total Ganhos = Rendimentos Uber + Uber Portagens + Ganhos Bolt**
- **Líquido = Total Ganhos - Via Verde - Combustível - Elétrico - Aluguer - Extras**

**Ficheiros Corrigidos:**
- `frontend/ResumoSemanalParceiro.js` - Cálculo do líquido em tempo real
- `backend/routes/relatorios.py` - 5 locais onde `total_ganhos` era calculado:
  - Resumo semanal (linha 1065)
  - PDF motorista (linha 1514)
  - WhatsApp (linha 1927)
  - Email (linha 2061)
  - Enviar relatório (linha 3831)

**Teste Realizado:**
- Uber=100, UberPort=20, Bolt=50, ViaVerde=10, Comb=30, Eletr=5, Aluguer=100, Extras=10
- Líquido esperado: (100+20+50) - 45 - 100 - 10 = **€15,00** ✅

---

### Bug Fixes P0 Anteriores (COMPLETO - 9/9 testes passaram)

**Problema:** Utilizador reportou bugs no resumo semanal e relatório PDF:
1. Coluna "Uber Portagens" não editável
2. Coluna "Extras" não afetava o cálculo do valor líquido
3. Valor do aluguer incorreto/ausente no PDF
4. Totais incorretos no relatório PDF

**Correções implementadas:**

1. **Frontend (`ResumoSemanalParceiro.js` - linha 536-542):**
   - Cálculo do líquido agora usa `editForm` quando em modo edição
   - Permite atualização em tempo real ao alterar campos

2. **Backend PUT endpoint (`relatorios.py` - linha 2124-2148):**
   - Adicionado campo `uber_portagens` ao objecto de ajuste manual
   - Garante persistência dos valores editados

3. **Backend Ajustes Manuais (`relatorios.py` - linha 1044-1062):**
   - `uber_portagens` agora é aplicado quando existem ajustes manuais

4. **Backend PDF (`relatorios.py` - linha 1495-1512):**
   - Adicionada verificação de ajustes manuais antes de gerar PDF
   - Valores do ajuste substituem valores calculados

**Testes realizados:**
- ✅ Coluna "Uber Portagens" editável em modo edição
- ✅ Alterações em "Extras" atualizam "Líquido" em tempo real
- ✅ PDF mostra aluguer correto (€200 para Arlei Oliveira)
- ✅ Ajustes manuais são aplicados no PDF
- ✅ PUT endpoint guarda uber_portagens
- ✅ 9/9 testes backend passaram
- ✅ 100% testes frontend passaram

**Test Report:** `/app/test_reports/iteration_6.json`

---

## Changelog (2026-01-11 - Session 8 - Credenciais Plataformas)

### Correcção Via Verde - Usar Liquid Value (COMPLETO)
- **FIXED**: Importação Via Verde agora usa `liquid_value` em vez de `value`
- **IMPACT**: Total de Via Verde calculado correctamente no resumo
- **NOTE**: Dados existentes na BD já usam `liquid_value` no cálculo do resumo
- A próxima importação irá mostrar os valores correctos

### Coluna Uber Portagens no Resumo Semanal (COMPLETO)
- **IMPLEMENTED**: Nova coluna "Uber Port." na tabela de motoristas
- **IMPLEMENTED**: Coluna posicionada entre "Uber" e "Bolt"
- **IMPLEMENTED**: Suporte para edição do valor
- **IMPLEMENTED**: Total na linha de rodapé da tabela
- **TESTED**: Screenshot confirma funcionamento ✅

### UI Sistema de Extras na Ficha do Motorista (COMPLETO)
- **IMPLEMENTED**: Nova tab "Extras" na Ficha do Motorista
- **IMPLEMENTED**: Cards de resumo (Total Registado, Pendente, Registos)
- **IMPLEMENTED**: Tabela de extras com colunas: Tipo, Descrição, Semana, Valor, Estado, Ações
- **IMPLEMENTED**: Modal para criar/editar extras com campos:
  - Tipo (Dívida, Caução Parcelada, Dano, Multa, Crédito/Reembolso, Outro)
  - Descrição, Valor, Semana/Ano
  - Parcelas (para pagamentos parcelados)
  - Observações, Marcar como pago
- **IMPLEMENTED**: Ações: Toggle pago/pendente, Editar, Eliminar
- **TESTED**: Screenshots confirmam funcionamento ✅

### Página Credenciais Plataformas REDESENHADA (COMPLETO)
- **IMPLEMENTED**: Top menu com Layout padrão da aplicação
- **IMPLEMENTED**: Seta de voltar para navegação intuitiva
- **IMPLEMENTED**: Sistema de tabs: Plataformas, Combustível, GPS
- **IMPLEMENTED**: Plataformas fixas:
  - **Uber**: Email, Telemóvel, Código SMS (1x) - autenticação via SMS
  - **Bolt**: Email, Password
  - **Via Verde**: Utilizador, Password
- **IMPLEMENTED**: Combustíveis variáveis:
  - Prio Energy (principal) por defeito
  - Botão "Adicionar Fornecedor" para mais fornecedores
  - Campos: Email, Password, Nº Cartão (opcional)
- **IMPLEMENTED**: GPS variáveis:
  - Verifon (principal) e Radius por defeito
  - Botão "Adicionar Sistema GPS" para mais sistemas
  - Campos: Utilizador, Password, API Key (opcional)
  - Fornecedores não principais podem ser removidos
- **TESTED**: Screenshots confirmam funcionamento ✅

### Teste PDF Relatório Semanal (PASSADO)
- **TESTED**: Geração de PDF com novas colunas de detalhe
- **VERIFIED**: PDF gerado correctamente (HTTP 200, início %PDF-1.4)
- Colunas adicionadas: Data/Hora, Local (Via Verde), Tempo (Carregamentos)

## Changelog (2026-01-11 - Session 7 - COMPLETO)

### Bug Fix: Ganhos Bolt no Resumo Semanal
- **FIXED**: Resumo semanal agora busca ganhos de `ganhos_bolt` E `viagens_bolt`
- **FIXED**: Query melhorada para encontrar registos por múltiplos critérios (motorista_id, identificador_bolt, email)
- **IMPROVED**: Importação Bolt agora usa `Identificador individual` como chave primária
- **ADDED**: Campos `semana` e `ano` adicionados aos registos de importação Bolt
- **TESTED**: Screenshot confirma ganhos Bolt a aparecer correctamente ✅

### Importação Uber - Nova Lógica de Colunas
- `Pago a si:Os seus rendimentos` → Rendimentos líquidos
- `Portagem + Imposto sobre tarifa` → Uber Portagens (vai para acumulado)
- Novo campo `uber_portagens` no resumo semanal

### Via Verde Acumulado
- Importação Uber **adiciona** portagens ao acumulado
- Importação Via Verde **consome** o acumulado para pagar portagens
- UI com badge clicável e modal de abate

### Sistema de Despesas Extras (NOVO)
- Endpoints CRUD: `GET/POST/PUT/DELETE /api/motoristas/{id}/despesas-extras`
- Tipos: `debito` (danos, dívidas) | `credito` (crédito dias, reembolsos)

### Campos IDs Plataforma
- `uuid_motorista_uber` e `identificador_motorista_bolt` na ficha do motorista
- Importação usa estes IDs como chave primária de pesquisa

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
