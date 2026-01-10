# TVDEFleet - Product Requirements Document

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

#### ✅ Refatoração do Backend - Modularização de Rotas (10/01/2026)
**Status: COMPLETO - Fase 1**

**Novos ficheiros de rotas criados:**
- `/app/backend/routes/parceiros.py` - CRUD completo para parceiros, alertas, certidão permanente
- `/app/backend/routes/planos.py` - Gestão de planos, módulos, promoções, subscrições
- `/app/backend/routes/pagamentos.py` - CRUD de pagamentos, upload de comprovativos
- `/app/backend/routes/reports.py` - Relatórios de dashboard, ROI, evolução semanal
- `/app/backend/routes/gestores.py` - Gestão de gestores e atribuição de parceiros

**Endpoints migrados:**
- `GET/POST /api/parceiros` - Lista e cria parceiros
- `GET/PUT/DELETE /api/parceiros/{id}` - CRUD individual
- `GET /api/parceiros/{id}/alertas` - Alertas do parceiro
- `GET /api/parceiros/{id}/estatisticas` - Estatísticas
- `GET/PUT/POST /api/parceiros/{id}/certidao-permanente` - Certidão
- `GET/POST/PUT/DELETE /api/planos` - Gestão de planos
- `GET/POST /api/admin/planos` - Admin de planos
- `POST /api/pagamentos` - Criar pagamento
- `GET /api/pagamentos/semana-atual` - Pagamentos da semana
- `PUT /api/pagamentos/{id}/marcar-pago` - Marcar como pago
- `GET /api/reports/dashboard` - Dashboard principal
- `GET /api/reports/roi/{vehicle_id}` - ROI por veículo
- `GET /api/reports/parceiro/semanal` - Relatório semanal
- `GET /api/gestores` - Lista gestores
- `PUT /api/gestores/{id}/atribuir-parceiros` - Atribuir parceiros

**Benefícios:**
- Código mais organizado e manutenível
- Cada domínio em ficheiro separado
- Facilita testes unitários
- Reduz risco de conflitos

#### ✅ Sistema de Extras/Dívidas do Motorista (NEW - 10/01/2026)
**Status: COMPLETO E TESTADO (29/29 testes passaram)**

**Backend:**
- Novo ficheiro `/app/backend/routes/extras.py` com API CRUD completa
- `GET /api/extras-motorista` - Lista extras com filtros (motorista_id, tipo, semana, ano, pago)
- `POST /api/extras-motorista` - Cria extras (divida, caucao_parcelada, dano, multa, outro)
- `PUT /api/extras-motorista/{id}` - Atualiza extras
- `DELETE /api/extras-motorista/{id}` - Elimina extras
- Validação de campos obrigatórios com resposta 422

**Frontend:**
- Nova página `/gestao-extras` com UI completa
- Cards de resumo: Total Extras, Pendentes, Pagos
- Tabela com filtros por Motorista, Tipo, Status
- Modal de criação/edição com suporte a cauções parceladas
- Link no menu Financeiro: "💰 Extras/Dívidas"

**Integração:**
- Resumo semanal inclui extras nos cálculos
- Card do dashboard mostra Receitas Parceiro (Aluguer + Extras)
- Fórmula: Líquido Parceiro = Receitas - Despesas Operacionais

#### ✅ Resumo Semanal Refinado para Parceiro
**Status: COMPLETO**

Card no dashboard e página de resumo com:
- **Receitas Parceiro**: Aluguer + Extras + Vendas
- **Despesas Operacionais**: Combustível + Via Verde + Elétrico
- **Líquido Parceiro**: Receitas - Despesas
- Cálculo dinâmico baseado no contrato do veículo

#### ✅ Gráficos de Evolução Semanal
**Status: COMPLETO**

- Histórico das últimas 6 semanas
- Barras para Receitas (verde), Despesas (vermelho), Líquido (azul)
- Tooltips com valores detalhados

#### ✅ Sistema de Envio de Relatórios
**Status: PARCIAL**

**WhatsApp (Funcional)**:
- Gera link `wa.me/numero?text=mensagem`
- Mensagem formatada com emojis

**Email (Aguarda API Key)**:
- Estrutura pronta para SendGrid
- Endpoint: `POST /api/relatorios/enviar-relatorio/{motorista_id}`

---

## Architecture

### Key API Endpoints
```
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
```

### Database Collections
```javascript
// extras_motorista
{
  id: string,
  motorista_id: string,
  parceiro_id: string,
  tipo: "divida" | "caucao_parcelada" | "dano" | "multa" | "outro",
  descricao: string,
  valor: number,
  data: string,
  semana: number,
  ano: number,
  parcelas_total: number | null,
  parcela_atual: number | null,
  pago: boolean,
  data_pagamento: string | null,
  observacoes: string | null,
  created_by: string,
  created_at: string
}
```

---

## Prioritized Backlog

### P0 - Bloqueado
- [ ] Configurar SENDGRID_API_KEY para ativar envio de emails

### P1 - Alta Prioridade
- [ ] Refatorar `server.py` - separar lógica de importação para services/

### P2 - Média Prioridade
- [ ] Implementar sincronização automática (RPA)
- [ ] Registar vendas de veículos

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal
- [ ] Notificações sobre importação
- [ ] Editor visual para automação RPA

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Data
- **Motorista Teste Backend**: ID `0eea6d82-625f-453d-ba26-e6681563b2b8`
- **Extra Existente**: Dívida €150 (semana 51/2025), Caução Parcelada €50 (semana 2/2026)

## Test Reports
- `/app/test_reports/iteration_4.json` - 29/29 testes passaram
- `/app/tests/test_extras_motorista.py` - Suite de testes pytest
