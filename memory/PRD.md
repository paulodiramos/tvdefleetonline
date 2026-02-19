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
6. **Contabilista** (`contabilista`) - Acesso a documentos: faturas fornecedores, recibos motoristas (NOVO)
7. **Motorista** - Condutores

### Key Features
- Gestão de veículos (manutenção, seguros, inspeções, extintores)
- Gestão de motoristas e documentação
- Sistema de turnos e ponto
- Dashboard de faturação
- RPA para importação de dados (Uber, Bolt, Prio, Via Verde)
- Geração de relatórios PDF
- Aplicação móvel para motoristas (Expo/React Native)

## What's Been Implemented

### Session 2026-02-19
- **Sistema Gestor ↔ Parceiro Melhorado**:
  - Parceiros suportam múltiplos gestores (`gestores_ids[]`)
  - `PUT /api/parceiros/{id}/atribuir-gestores`
  - `GET /api/parceiros/{id}/gestores`
  - `POST /api/gestores/{id}/selecionar-parceiro`
  - `GET /api/gestores/{id}/parceiro-ativo`
- **Novo Papel Contabilista** adicionado ao modelo
- **Campos de Fatura em Veículos**:
  - Manutenção: `fatura_numero`, `fatura_url`, `fatura_data`, `fatura_fornecedor`
  - Seguro: `fatura_numero`, `fatura_url`, `fatura_data`, `valor_premio`

### Previous Sessions
- Dashboard de Faturação (matriz Motorista x Empresa até 5 empresas)
- Geração de Relatórios PDF semanal
- Página de perfil de utilizador com alteração de senha pelo admin
- Página de Gestão do Sistema (reinstalar Playwright, reiniciar serviços)
- Instalação automática do Playwright no arranque
- Refatoração parcial de FichaVeiculo.js (3 tabs extraídas)

## Prioritized Backlog

### P0 - Critical
- [ ] **Build AAB para Play Store** - Utilizador precisa submeter app com targetSdkVersion 35

### P1 - High Priority
- [ ] UI frontend para gestor selecionar parceiro ativo
- [ ] UI para atribuir gestores na página de Parceiros  
- [ ] Criar página de Contabilista com acesso a faturas/recibos
- [ ] Preços Especiais - completar lógica de backend
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
│   ├── services/      # Business logic
│   └── utils/         # Helpers (auth, db, etc.)
├── frontend/          # React + Shadcn UI
│   ├── components/    # Reusable components
│   └── pages/         # Page components
└── mobile/           # Expo React Native
    └── tvdefleet-drivers/
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
