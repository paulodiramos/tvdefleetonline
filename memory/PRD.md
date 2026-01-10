# TVDEFleet - Product Requirements Document

## Original Problem Statement
Sistema de gestão de frotas para empresas TVDE (React + FastAPI + MongoDB). A aplicação permite gestão de motoristas, veículos, relatórios financeiros semanais, importação de dados de plataformas (Uber, Bolt, Via Verde, Carregamentos Elétricos, Combustível), e automações.

## What's Been Implemented

### Janeiro 2026

#### 1. Resumo Semanal Refinado para Parceiro ✅ (NEW)
**Status: COMPLETO**

Card no dashboard e página de resumo com:
- **Ganhos**: Total Uber + Bolt (discriminado)
- **Despesas Operacionais**: Combustível + Via Verde + Elétrico
- **Comissões Motoristas**: Baseado no contrato do veículo (% ou valor fixo)
- **Líquido Parceiro**: Ganhos - Despesas - Comissões
- Cálculo dinâmico baseado no tipo de contrato do veículo

#### 2. Gráficos de Evolução Semanal ✅ (NEW)
**Status: COMPLETO**

- Histórico das últimas 6 semanas
- Barras para Ganhos (verde), Despesas (laranja), Líquido (azul)
- Tooltips com valores detalhados
- Endpoint: `GET /api/relatorios/parceiro/historico-semanal`

#### 3. Sistema de Envio de Relatórios ✅ (NEW)
**Status: COMPLETO**

**WhatsApp (Link Direto)**:
- Gera link `wa.me/numero?text=mensagem`
- Abre WhatsApp no dispositivo
- Mensagem formatada com emojis
- Endpoint: `GET /api/relatorios/gerar-link-whatsapp/{motorista_id}`

**Email (SendGrid)** - Aguarda API Key:
- Estrutura pronta para integração
- Template HTML profissional
- Endpoint: `POST /api/relatorios/enviar-relatorio/{motorista_id}`
- Envio em massa: `POST /api/relatorios/enviar-relatorios-em-massa`

**UI de Envio**:
- Botão "Enviar Emails" no header
- Botões individuais por motorista (WhatsApp 💬 e Email 📧)
- Loading states durante envio

#### 4. Lista de Importações ✅
**Status: COMPLETO**

- Página `/lista-importacoes` com filtros
- Resumo por plataforma
- Lista detalhada de ficheiros

#### 5. Sistema de Relatórios Semanais ✅
**Status: COMPLETO**

- Valores verificados: Nelson (Uber €607.54, Bolt €136.74), Jorge (Uber €677.00, Bolt €299.61)

---

## Configuração Pendente

### SendGrid Email
Para ativar envio de emails, adicionar em `/app/backend/.env`:
```
SENDGRID_API_KEY=sua_chave_aqui
SENDER_EMAIL=relatorios@tvdefleet.com
```

---

## Architecture

### Key API Endpoints
- `GET /api/relatorios/parceiro/resumo-semanal` - Resumo semanal com comissões
- `GET /api/relatorios/parceiro/historico-semanal` - Histórico para gráficos
- `GET /api/relatorios/importacoes/historico` - Histórico de importações
- `GET /api/relatorios/gerar-link-whatsapp/{motorista_id}` - Link WhatsApp
- `POST /api/relatorios/enviar-relatorio/{motorista_id}` - Enviar relatório
- `POST /api/relatorios/enviar-relatorios-em-massa` - Enviar para todos

### Backend Services
- `/app/backend/services/envio_relatorios.py` - Serviço de envio (WhatsApp + Email)

### Vehicle Contract Model
```python
tipo_contrato_veiculo: "aluguer" | "comissao"
tipo_contrato: {
    "comissao_motorista": 70,  # % que vai para o motorista
    "comissao_parceiro": 30    # % que vai para o parceiro
}
```

---

## Prioritized Backlog

### P0 - Aguarda Configuração
- [ ] Configurar SENDGRID_API_KEY para ativar envio de emails

### P1 - Alta Prioridade
- [ ] Refatorar `server.py` - separar lógica de importação

### P2 - Média Prioridade
- [ ] Implementar sincronização automática (RPA)
- [ ] Conexão real com APIs (Uber, Bolt)

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal
- [ ] Notificações sobre importação
- [ ] Editor visual para automação RPA

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro (Zeny Macaia)**: geral@zmbusines.com / 123456
