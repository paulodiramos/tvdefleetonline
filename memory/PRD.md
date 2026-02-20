# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas completo para empresas TVDE (Transporte Individual e Remunerado de Passageiros em Veículos Descaracterizados).

## Core Requirements

### User Roles
1. **Admin** - Gestão completa do sistema
2. **Gestor** (`gestao`) - Gere múltiplos parceiros atribuídos
3. **Parceiro** - Empresa de frotas TVDE
4. **Operacional** - Parceiro com gestão de frota própria
5. **Inspetor** - Apenas vistorias
6. **Contabilista** (`contabilista`) - Acesso a documentos: faturas fornecedores, recibos motoristas
7. **Motorista** - Condutores

### Key Features
- Gestão de veículos (manutenção, seguros, inspeções, extintores)
- Gestão de motoristas e documentação
- Sistema de turnos e ponto
- Dashboard de faturação
- RPA para importação de dados (Uber, Bolt, Prio, Via Verde)
- Geração de relatórios PDF
- Aplicação móvel para motoristas (Expo/React Native)
- Sistema de Mensagens com filtragem por hierarquia de roles
- Página de Contabilidade com gestão de faturas e recibos

## What's Been Implemented

### Session 2026-02-20 (Latest - WhatsApp Web Integration)
- **Feature: WhatsApp Web com QR Code - DONE:**
  - **Arquitetura:** Microserviço Node.js (porta 3001) + API FastAPI + UI React
  - **Funcionalidade:** Cada parceiro tem a sua própria sessão WhatsApp
  - **QR Code:** Gerado em tempo real, atualiza automaticamente a cada 3 segundos
  - **Sessão:** Persistente até o utilizador terminar ou expirar
  - **Endpoints Backend:**
    - `GET /api/whatsapp-web/health` - Estado do serviço
    - `GET /api/whatsapp-web/status` - Estado da conexão por parceiro
    - `GET /api/whatsapp-web/qr` - Obter QR code
    - `POST /api/whatsapp-web/logout` - Terminar sessão
    - `POST /api/whatsapp-web/send` - Enviar mensagem individual
    - `POST /api/whatsapp-web/send-bulk` - Enviar em massa
    - `POST /api/whatsapp-web/send-to-motorista/{id}` - Enviar a motorista
    - `POST /api/whatsapp-web/send-to-all-motoristas` - Enviar a todos motoristas
    - `GET /api/whatsapp-web/templates` - Templates de mensagens
    - `GET/PUT /api/whatsapp-web/alerts-config` - Configurar alertas automáticos
  - **UI (página /whatsapp):**
    - Estado de conexão (conectado/desconectado)
    - QR Code para escanear
    - Tab "Enviar": Compor mensagens, selecionar motoristas
    - Tab "Motoristas": Lista de motoristas com WhatsApp
    - Tab "Histórico": Mensagens enviadas
    - Tab "Config": Alertas automáticos (documentos, manutenção, vencimentos, relatórios)
  - **Templates:** 6 templates pré-definidos (relatório semanal, documento expirando, manutenção, boas-vindas, comunicado, vistoria)
  - **Testes:** 100% backend (9/9) + 100% frontend - iteration_59.json

- **Feature: UI Gestão de Armazenamento - DONE:**
  - **Página:** `/sistema-admin` exibe detalhes de armazenamento por pasta
  - **Visualização:** Usado, Livre, Total, com barra de progresso colorida
  - **Detalhes por pasta:** tmp, dump, uploads, logs, etc.
  - **Botão "Limpar Temporários":** Remove ficheiros temporários
  - **Ficheiros:** `frontend/src/pages/SistemaAdmin.js`, `backend/routes/admin.py`

### Session 2026-02-20 (Gestão de Planos e Preços)
- **Feature: Campos de Preços com IVA - DONE:**
  - **Funcionalidade:** Todos os campos de preço em planos e módulos indicam "Introduza valores SEM IVA"
  - **Cálculo automático:** Abaixo de cada campo aparece "c/IVA: €X.XX" calculado em verde
  - **Ficheiros:** `frontend/src/pages/AdminGestaoPlanos.js`

- **Feature: Módulos em Destaque - DONE:**
  - **Funcionalidade:** Admin pode marcar módulos como "Em Destaque" para clientes
  - **UI:** Switch com ícone de estrela no modal de edição de módulo
  - **Backend Bug Fix:** Corrigido modelo `ModuloCreate` para incluir campo `destaque`
  - **Backend Bug Fix:** Serviço agora usa `data.destaque` em vez de hardcoded `False`

- **Feature: Aba Preços Especiais - DONE:**
  - **Funcionalidade:** Nova aba dedicada que lista todos os preços especiais por plano
  - **Tabela:** Mostra Parceiro, Tipo, Valor, Validade e botão de eliminar
  - **Eliminar:** Botão de eliminar remove preço especial da lista

- **Feature: Eliminação Permanente - DONE:**
  - **Funcionalidade:** Admin pode eliminar permanentemente planos, módulos e categorias inativas
  - **UI:** Items ativos mostram botão olho (amarelo) para desativar
  - **UI:** Items inativos mostram botão lixeira (vermelho) para eliminar permanentemente
  - **Backend Bug Fix:** Endpoints corrigidos para usar collections correctas (`planos_sistema`, `modulos_sistema`)
  - **Confirmação:** Dupla confirmação antes de eliminar permanentemente

- **Testes:** 100% backend (12/12) + 100% frontend (7/7 features) - iteration_58.json

### Session 2026-02-20 (Sistema de Progressão Automática)
- **Feature: Sistema de Progressão Automática de Classificações - DONE:**
  - **Backend:** Novos métodos em `comissoes_service.py`:
    - `calcular_pontuacao_cuidado_veiculo()` - Calcula pontuação baseada em vistorias (40%), incidentes (25%), manutenções (20%), avaliação do parceiro (15%)
    - `verificar_progressao_motorista()` - Verifica elegibilidade para promoção
    - `promover_motorista()` - Promove e notifica o motorista via app
    - `recalcular_todas_classificacoes()` - Recalcula todas as classificações (job automático/manual)
  - **Endpoints novos:**
    - `GET /api/comissoes/classificacao/motorista/{id}/progressao`
    - `GET /api/comissoes/classificacao/motorista/{id}/pontuacao-cuidado`
    - `POST /api/comissoes/classificacao/motorista/{id}/promover`
    - `POST /api/comissoes/classificacao/recalcular-todas`
    - `PUT /api/comissoes/classificacao/motorista/{id}/avaliacao-parceiro`
  - **Frontend:** Botão "Progressões" em `/usuarios` com modal de resultados
  - **Critérios de Progressão:**
    - Prata: 3+ meses serviço, 60+ pontuação cuidado (+1% bónus)
    - Ouro: 6+ meses serviço, 75+ pontuação cuidado (+2% bónus)
    - Platina: 12+ meses serviço, 85+ pontuação cuidado (+3.5% bónus)
    - Diamante: 24+ meses serviço, 95+ pontuação cuidado (+5% bónus)
  - **Testes:** 100% backend (iteration_57.json) + 100% frontend

### Session 2026-02-20 (Sistema de Progressão Automática)
- **Feature: Sistema de Progressão Automática de Classificações - DONE:**
  - **Backend:** Novos métodos em `comissoes_service.py`:
    - `calcular_pontuacao_cuidado_veiculo()` - Calcula pontuação baseada em vistorias (40%), incidentes (25%), manutenções (20%), avaliação do parceiro (15%)
    - `verificar_progressao_motorista()` - Verifica elegibilidade para promoção
    - `promover_motorista()` - Promove e notifica o motorista via app
    - `recalcular_todas_classificacoes()` - Recalcula todas as classificações (job automático/manual)
  - **Endpoints novos:**
    - `GET /api/comissoes/classificacao/motorista/{id}/progressao`
    - `GET /api/comissoes/classificacao/motorista/{id}/pontuacao-cuidado`
    - `POST /api/comissoes/classificacao/motorista/{id}/promover`
    - `POST /api/comissoes/classificacao/recalcular-todas`
    - `PUT /api/comissoes/classificacao/motorista/{id}/avaliacao-parceiro`
  - **Frontend:** Botão "Progressões" em `/usuarios` com modal de resultados
  - **Critérios de Progressão:**
    - Prata: 3+ meses serviço, 60+ pontuação cuidado (+1% bónus)
    - Ouro: 6+ meses serviço, 75+ pontuação cuidado (+2% bónus)
    - Platina: 12+ meses serviço, 85+ pontuação cuidado (+3.5% bónus)
    - Diamante: 24+ meses serviço, 95+ pontuação cuidado (+5% bónus)
  - **Testes:** 100% backend (iteration_57.json) + 100% frontend

### Session 2026-02-20 (Fluxo Aprovação Melhorado + Migração UI)
- **Feature: UI do Fluxo de Aprovação Melhorado - DONE:**
  - **Funcionalidade:** Admin pode atribuir Parceiro e Classificação ao aprovar motoristas
  - **Frontend:** Modal de aprovação em `GestaoUtilizadores.js` agora inclui:
    - Dropdown "Atribuir a Parceiro" com lista de todos os parceiros
    - Dropdown "Classificação Inicial" com níveis (Bronze, Prata, Ouro, Platina, Diamante) e bónus
  - **Backend:** Endpoint `PUT /api/users/{user_id}/approve` já suportava `parceiro_id` e `classificacao`
  - **Testes:** 100% backend (10/10) + 100% frontend (iteration_56.json)

- **Feature: Botão de Migração de Dados no Admin - DONE:**
  - **Funcionalidade:** Botão "Corrigir Dados" na página de Gestão de Usuários
  - **Modal:** Mostra estatísticas (total motoristas, sem dados pessoais, formato antigo)
  - **Endpoints:**
    - `GET /api/admin/verificar-migracao` - Verifica quantos motoristas precisam migração
    - `POST /api/admin/migrar-motoristas` - Executa correção de dados
  - **Testes:** Funcional, modal mostra dados correctos

- **Refactoring: Hooks para FichaVeiculo.js - IN PROGRESS:**
  - **Criado:** `/app/frontend/src/hooks/useFichaVeiculoState.js`
  - **Hooks:** `useFichaVeiculoBasicState`, `useFichaVeiculoForms`
  - **Estados Iniciais:** Exportados para reutilização
  - **Próximo Passo:** Migrar `FichaVeiculo.js` para usar os hooks

### Session 2026-02-20 (Correção Documentos & Playwright)
- **Bug Fix: Registo de Motoristas "Not Found" - DONE:**
  - **Problema:** Ao fazer registo, aparecia "Not Found" no toast
  - **Causa:** URL duplicava `/api` - fazia `POST /api/api/auth/register` em vez de `POST /api/auth/register`
  - **Solução:** Corrigido em `RegistoMotorista.js` - removido `/api` extra das chamadas
  - **Ficheiro:** `frontend/src/pages/RegistoMotorista.js` (linhas 108, 123)
  - **Testes:** Registo funciona, motorista criado na BD com status pendente ✅

- **Bug Fix: Dados e Documentos não guardados na ficha - DONE:**
  - **Problema:** Campos como morada, data nascimento, NIF não eram guardados na collection `motoristas`
  - **Causa:** O modelo `UserCreate` não tinha estes campos e o backend não os copiava para o documento motorista
  - **Solução:** 
    1. Expandido `UserCreate` em `models/user.py` com campos: whatsapp, data_nascimento, nif, nacionalidade, morada_completa, codigo_postal
    2. Actualizado `auth.py` para copiar todos os campos para o documento `motoristas`
    3. Adicionados campos de documentos em falta: carta_conducao, identificacao, comprovativo_morada
  - **Ficheiros:** `backend/models/user.py`, `backend/routes/auth.py`
  - **Testes:** Todos os campos e documentos agora são guardados correctamente ✅

- **Bug Fix: Endpoint motoristas-pendentes-sync 404 - DONE:**
  - **Problema:** Endpoint `/api/users/motoristas-pendentes-sync` dava 404
  - **Causa:** Rota com `{user_id}` no server.py estava a capturar o path antes
  - **Solução:** Renomeada rota para `/api/motoristas-pendentes-sync`
  - **Ficheiros:** `backend/routes/users.py`, `frontend/src/pages/GestaoUtilizadores.js`

- **Correção Upload de Documentos no Registo - DONE:**
  - **Problema:** Documentos carregados durante a inscrição de motoristas não ficavam associados à ficha do motorista
  - **Causa:** Query incorreta no endpoint `/api/documentos/upload` - usava `{"email": {"$exists": True}}` que fazia match com qualquer motorista
  - **Solução:** Corrigida a query para buscar primeiro o email do user, depois atualizar motoristas por `id` OU `email`
  - **Ficheiro:** `backend/routes/documentos.py` (linhas 69-82)
  - **Testes:** 12/12 backend 100% (iteration_55.json)

- **Correção Playwright/RPA - DONE:**
  - **Problema:** Browser virtual não funcionava - browsers Playwright instalados na versão errada
  - **Causa:** Playwright 1.56.0 requer browsers v1194 mas apenas v1208 estava instalado
  - **Solução:** Reinstalados browsers na versão correcta (chromium-1194)
  - **Verificado:** `/api/admin/sistema/status` retorna Playwright instalado e funcional
  - **Testes:** Sessões de browser virtual iniciam correctamente, screenshots funcionam

- **Health-Check Automático do Playwright - DONE:**
  - **Novo Endpoint:** `GET /api/admin/sistema/playwright/health-check`
  - **Funcionalidades:** Testa lançamento do browser, navegação e screenshot com métricas de tempo
  - **Histórico:** Guarda resultados na BD para análise
  - **Endpoint Histórico:** `GET /api/admin/sistema/playwright/health-history`

- **Refatoração FichaVeiculo.js - DONE:**
  - **Antes:** 5162 linhas
  - **Depois:** 4080 linhas (-1082 linhas, -21%)
  - **Componentes de Tab extraídos (10):**
    - `VeiculoHistoricoAtribuicoesTab` (168 linhas)
    - `VeiculoRelatorioFinanceiroTab` (365 linhas)
    - `VeiculoAgendaTab` (327 linhas)
    - E mais 7 tabs existentes
  - **Modais extraídos (3):**
    - `AgendaEditModal` (85 linhas)
    - `IntervencaoEditModal` (68 linhas)
    - `ManutencaoAddModal` (225 linhas)
  - **Total modularizado:** 2886 linhas em 14 ficheiros
  - **Benefícios:** Código mais modular, manutenção facilitada, componentes reutilizáveis

### Session 2026-02-19 (Perfil Utilizador Motorista)
- **Perfil de Utilizador para Motoristas - DONE:**
  - **Nova Tab "Motorista":** Aparece apenas para motoristas quando admin visualiza perfil
  - **Ver Documentos:** Botão navega para ficha completa do motorista (/motoristas/{id})
  - **Atribuir Parceiro:** Dropdown + botão para atribuir/alterar parceiro
  - **Atribuir Plano:** Dropdown + botão para atribuir plano de faturação
  - **Endpoint Novo:** `PUT /api/users/{id}/plano` para atribuir planos
  - **Bug Fix:** approve_user cria documento em motoristas se não existir
  - **Ficheiros:** `backend/routes/users.py`, `frontend/src/pages/PerfilUtilizador.js`
  - **Testes:** 12/12 backend + frontend 100% (iteration_54.json)

### Session 2026-02-19 (Sistema Utilizadores Melhorado)
- **Sistema de Gestão de Utilizadores Melhorado - DONE:**
  - **Atribuir Parceiro:** Admin pode atribuir/alterar parceiro a motoristas já aprovados
  - **Alterar Tipo de Conta:** Admin pode alterar role (motorista → gestor/parceiro/admin)
  - **Ver Documentos:** Botão direto para ver documentos do motorista
  - **Bug Fix:** Motorista aprovado agora cria documento na collection `motoristas` automaticamente
  - **Bug Fix:** Endpoint `set-role` não dava erro quando role já era igual
  - **Ficheiros:** `backend/routes/users.py`, `frontend/src/pages/GestaoUtilizadores.js`
  - **Testes:** 13/13 backend + frontend 100% (iteration_53.json)

### Session 2026-02-19 (Fluxo de Aprovação com Planos)
- **Fluxo de Aprovação de Utilizadores Melhorado - DONE:**
  - **Funcionalidade:** Admin pode atribuir Plano e Preço Especial ao aprovar novos parceiros
  - **Backend:** Endpoint `PUT /api/users/{user_id}/approve` atualizado para aceitar `plano_id` e `preco_especial_id`
  - **Frontend:** Diálogo de aprovação dinâmico:
    - Para PARCEIROS: mostra dropdown de Plano + dropdown de Preço Especial (quando aplicável)
    - Para MOTORISTAS: mostra dropdown de Parceiro
  - **Ficheiros:** `backend/routes/users.py`, `frontend/src/pages/GestaoUtilizadores.js`
  - **Testes:** 10/10 backend + frontend 100% (iteration_52.json)

### Session 2026-02-19 (Bug Fixes Dashboard Faturação + Resumo Semanal)
- **Correção Dashboard Faturação - DONE:**
  - **Problema:** Total de 62.969€ mostrado para parceiro quando deveria ser 25.081€
  - **Causa:** dados_semanais continha empresa_faturacao_id de outros parceiros
  - **Solução:** Adicionado filtro `empresas_ids_validas` em `empresas_faturacao.py`
  - **Resultado:** Parceiro Zeny agora vê apenas 2 empresas (11.345€ + 13.736€ = 25.081€)
  - **Percentagens:** Corrigidas (antes mostravam 200000%, agora valores correctos)

- **Correção Resumo Semanal - DONE:**
  - **Problema:** Apareciam motoristas de outros parceiros (Motorista Teste Backend, Motorista Teste Novo)
  - **Causa:** Prioridade errada entre parceiro_id e parceiro_atribuido
  - **Solução:** Alterada prioridade para `parceiro_atribuido || parceiro_id` em `relatorios.py`
  - **Resultado:** Parceiro Zeny vê 12 motoristas (antes 14)
  - Testes: 11/11 passaram (100%)

- **Sistema de Mensagens - Filtragem por Hierarquia - DONE:**
  - Novo endpoint `GET /api/mensagens/destinatarios`
  - Admin vê todos os utilizadores aprovados
  - Parceiro vê motoristas da sua frota + gestores atribuídos + admin
  - Gestor vê parceiros atribuídos + motoristas das frotas + admin
  - Motorista vê parceiro + gestor + admin
  - Ficheiros: `backend/routes/mensagens.py`, `frontend/src/pages/Mensagens.js`
  - Testes: 8/8 passaram (100%)

- **Refatoração FichaVeiculo.js - PROGRESSO:**
  - Novo componente: `VeiculoDispositivosTab.js` (198 linhas)
  - Tab "Dispositivos" extraída com sucesso
  - Ficheiro reduzido de 5337 para 5162 linhas (-175 linhas)
  - Tabs já componentizadas: Seguro, Inspeção, Extintor, Revisão, Histórico, Dispositivos, Relatório
  - Tabs ainda inline: Info (~2200 linhas), Agenda (~277 linhas)

### Session 2026-02-19 (Via Verde Fix + Refactoring Progress)
- **Correção Relatório Via Verde - DONE:**
  - **Problema:** PDF do relatório semanal mostrava Via Verde de toda a frota em vez de apenas do motorista
  - **Solução:** Query corrigida para buscar apenas por `vehicle_id`, `matricula` e `motorista_id` (removido `parceiro_id`)
  - Ficheiro: `backend/routes/relatorios.py`

### Session 2026-02-19 (Database Check + Vehicle Refactoring)
- **Verificação de Base de Dados - OK:**
  - MongoDB conectado com 131 collections
  - users: 39, motoristas: 18, vehicles: 34, parceiros: 8
  - 2 utilizadores pendentes, 1 motorista sem parceiro
  - Índices verificados

### Session 2026-02-19 (Admin Dashboard Pendentes)
- **Lógica de Preços Especiais (Backend) - DONE e Testado 100%:**
  - Suporte completo para 5 tipos de cálculo:
    - `percentagem`: Desconto percentual sobre o preço base
    - `valor_fixo`: Preço fixo mensal total (ignora veículos/motoristas)
    - `valor_fixo_veiculo`: Preço fixo × número de veículos
    - `valor_fixo_motorista`: Preço fixo × número de motoristas
    - `valor_fixo_motorista_veiculo`: Preço fixo × min(veículos, motoristas)
  - Novos endpoints:
    - `GET /api/admin/precos-especiais` - Listar todos os preços especiais
    - `GET /api/gestao-planos/precos-especiais` - Listar via gestão de planos
    - `GET /api/gestao-planos/precos-especiais/calcular` - Calcular preço com especial
    - `PUT /api/gestao-planos/planos/{id}/precos-especiais/{preco_id}` - Atualizar
    - `DELETE /api/gestao-planos/planos/{id}/precos-especiais/{preco_id}` - Remover
  - Serviço: `planos_modulos_service.py` - Métodos calcular_preco_com_especial, listar_precos_especiais
  - Testes: 18/18 passaram (100% success rate)
  - Ficheiro de teste: `/app/backend/tests/test_precos_especiais.py`

### Session 2026-02-19 (Contabilista System Complete)
- **Sistema Completo de Contabilistas (Testado 95% Backend / 100% Frontend):**
  - Parceiros podem criar contabilistas via página `/contabilistas`
  - Contabilistas ficam auto-atribuídos ao parceiro que os cria
  - Admin pode atribuir mais parceiros via tab "Parceiros Atribuídos" no perfil
  - Seletor de parceiro ativo no header (igual ao gestor)
  - Menu restrito: Início, Contabilidade, Documentos
  - Página de Contabilidade filtra dados por parceiro ativo
  - APIs: `/api/contabilistas/*` (criar, lista, atribuir-parceiros, selecionar-parceiro, parceiro-ativo, parceiros)
  - Frontend: `GestaoContabilistas.js`, `GestorParceiroSelector.js` (suporta gestor e contabilista)
  - User de teste: maria.contabilista@test.com / Test123!

- **Funcionalidades de Gestão de Acessos (Testadas com Sucesso):**
  - Atribuição de parceiros a gestores via tab "Parceiros Atribuídos" no perfil
  - API: `PUT /api/gestores/{id}/atribuir-parceiros`
  - UI: Lista com badges, contador, botão guardar

- **Papel Contabilista (Testado com Sucesso):**
  - Novo role com menu restrito (Início, Contabilidade, Documentos)
  - Acesso apenas a visualização de faturas e recibos
  - User de teste criado: contabilista@tvdefleet.com

- **Gestão de Fornecedores por Parceiro (Testada com Sucesso):**
  - Nova página `/fornecedores` acessível pelo parceiro
  - CRUD completo (criar, editar, eliminar fornecedores)
  - Filtros por nome, NIF, email, tipo
  - 8 tipos de fornecedores disponíveis
  - API: `/api/parceiros/{id}/fornecedores`

### Session 2026-02-19 (Continuation)
- **UI para Atribuir Gestores na Página de Parceiros:**
  - Secção "Gestores Associados" no diálogo de edição
  - Lista com seleção múltipla e visual checkbox
- **Campos de Fatura na Manutenção de Veículos:**
  - Secção "Dados da Fatura (Opcional)" no formulário
  - Campos: Nº Fatura, Data, Fornecedor, Upload ficheiro
- **Página de Contabilidade (Full Stack):**
  - Backend: `/api/contabilidade/*`
  - Frontend: 3 tabs, filtros, estatísticas, exportação CSV

### Session 2026-02-19
- **Sistema Gestor ↔ Parceiro:**
  - Parceiros suportam múltiplos gestores (`gestores_ids[]`)
  - `PUT /api/parceiros/{id}/atribuir-gestores`
  - `GET /api/parceiros/{id}/gestores`
  - `POST /api/gestores/{id}/selecionar-parceiro`
  - `GET /api/gestores/{id}/parceiro-ativo`
- **Componente GestorParceiroSelector** - Dropdown no header para gestores
- **Página de Contabilidade:**
  - Backend: `/api/contabilidade/faturas-fornecedores`, `/api/contabilidade/recibos-motoristas`, `/api/contabilidade/faturas-veiculos`
  - Frontend: `ContabilidadePage.js` com tabs, filtros, estatísticas
- **Novo Papel Contabilista** adicionado ao modelo
- **Mobile App v1.1.0:**
  - targetSdkVersion 35, versionCode 6
  - expo-asset adicionado
  - ZIP: `/app/tvdefleet-drivers-v1.1.0.zip`

### Previous Sessions
- Dashboard de Faturação (matriz Motorista x Empresa até 5 empresas)
- Geração de Relatórios PDF semanal
- Página de perfil de utilizador com alteração de senha pelo admin
- Página de Gestão do Sistema (reinstalar Playwright, reiniciar serviços)
- Refatoração parcial de FichaVeiculo.js (3 tabs extraídas)

## Prioritized Backlog

### P0 - Critical
- [x] Página de Contabilidade - **DONE**
- [x] **Build AAB para Play Store** - **DONE** - App em avaliação na Play Store
- [x] **Sistema Contabilista Completo** - **DONE** (2026-02-19)
- [x] **Fluxo de Aprovação com Plano/Preços Especiais** - **DONE** (2026-02-19)
- [x] **Sistema Utilizadores Melhorado** - **DONE** (2026-02-19)
- [x] **Correção Upload Documentos Registo** - **DONE** (2026-02-20)
  - Documentos carregados no registo agora ficam associados ao motorista
- [x] **Correção Playwright/RPA** - **DONE** (2026-02-20)
  - Browsers reinstalados na versão correcta (v1194)

### P1 - High Priority
- [x] Seletor de parceiro ativo para gestores - **DONE**
- [x] UI para atribuir gestores na página de Parceiros - **DONE** (2026-02-19)
  - Tab "Parceiros Atribuídos" no perfil do gestor
  - Lista com badges "Atribuído"/"Não atribuído"
  - Botão "Guardar Alterações"
- [x] Papel Contabilista com acesso restrito - **DONE** (2026-02-19)
  - Menu limitado: Início, Contabilidade, Documentos
  - User de teste: contabilista@tvdefleet.com / Contabilista123!
- [x] Gestão de Fornecedores por Parceiro - **DONE** (2026-02-19)
  - Página /fornecedores com CRUD completo
  - Tipos: Geral, Oficina, Seguradora, Combustível, Via Verde, Pneus, Lavagem, Outros
- [x] Anexar documentos a seguros/inspeções/extintores - **DONE** (já existia)
- [x] Preços Especiais - lógica de backend completa - **DONE** (2026-02-19)
  - 5 tipos: percentagem, valor_fixo, valor_fixo_veiculo, valor_fixo_motorista, valor_fixo_motorista_veiculo
- [x] UI do Fluxo de Aprovação Melhorado - **DONE** (2026-02-20)
  - Admin pode atribuir Parceiro e Classificação ao aprovar motoristas
- [x] Botão de Migração de Dados no Admin - **DONE** (2026-02-20)
  - Página /usuarios com botão "Corrigir Dados" e modal de estatísticas
- [x] Sistema de Progressão Automática de Classificações - **DONE** (2026-02-20)
  - Cálculo de pontuação de cuidado com veículo (vistorias, incidentes, manutenções, avaliação)
  - Promoção automática de motoristas elegíveis
  - Notificação via app quando motorista sobe de nível
  - Botão "Progressões" no admin para recalcular todas
- [ ] Continuar refatoração do FichaVeiculo.js (hooks criados, falta migrar componente)

### P2 - Medium Priority
- [ ] Integração WhatsApp
- [ ] Base de dados de produção - sincronizar com nova DB

### P3 - Low Priority
- [ ] Alertas Avançados e Comissões Avançadas
- [ ] Sistema de arquivo de dados antigos

## Technical Architecture

```
/app
├── backend/           # FastAPI + MongoDB
│   ├── models/        # Pydantic models
│   ├── routes/        # API endpoints
│   │   └── contabilidade.py  # NEW
│   ├── services/      # Business logic
│   └── utils/         # Helpers (auth, db, etc.)
├── frontend/          # React + Shadcn UI
│   ├── components/    
│   │   └── GestorParceiroSelector.js  # NEW
│   └── pages/
│       └── ContabilidadePage.js  # NEW
└── mobile/           # Expo React Native
    └── tvdefleet-drivers/
        └── v1.1.0 ready for build
```

## Key DB Schema
- `users` - Utilizadores do sistema
- `parceiros` - Empresas parceiras (gestores_ids[] para múltiplos gestores)
- `motoristas` - Motoristas
- `vehicles` - Veículos (manutencoes[] com campos de fatura)
- `ganhos` - Ganhos importados das plataformas
- `turnos` - Registos de ponto

## Credentials
- **Admin**: admin@tvdefleet.com / Admin123!
- **Parceiro (Zeny)**: geral@zmbusines.com / Admin123!
- **Expo**: paulodiramos@gmail.com / Pra@10102017@Di
