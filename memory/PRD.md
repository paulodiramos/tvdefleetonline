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

### Session 2026-02-19 (Latest - Sistema Utilizadores Melhorado)
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
  - Parceiro cria contabilista
  - Admin atribui parceiros
  - Seletor de parceiro ativo
  - Filtros por parceiro na contabilidade
- [x] **Fluxo de Aprovação com Plano/Preços Especiais** - **DONE** (2026-02-19)
  - Admin atribui plano e preço especial ao aprovar parceiros
  - Diálogo dinâmico baseado no tipo de utilizador

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
- [ ] Continuar refatoração do FichaVeiculo.js

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
