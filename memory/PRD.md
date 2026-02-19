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
- **NOVO:** Página de Contabilidade com gestão de faturas e recibos

## What's Been Implemented

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
- [ ] **Build AAB para Play Store** - Utilizador precisa executar o build

### P1 - High Priority
- [x] Seletor de parceiro ativo para gestores - **DONE**
- [ ] UI para atribuir gestores na página de Parceiros
- [ ] UI para adicionar campos de fatura em manutenção/seguro de veículos
- [ ] Continuar refatoração do FichaVeiculo.js
- [ ] Preços Especiais - completar lógica de backend

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
