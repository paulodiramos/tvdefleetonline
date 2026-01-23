# TVDEFleet - Product Requirements Document

## Changelog (2026-01-23 - Session 20)

### 1. Gestão Avançada de Utilizadores ✅
**Página:** `/usuarios` (apenas Admin)

**Funcionalidades implementadas:**
- **Filtros de pesquisa avançados:**
  - Pesquisa por texto (nome, email, telefone)
  - Filtro por perfil (Admin, Gestor, Parceiro, Motorista)
  - Filtro por parceiro (dropdown com lista de parceiros)
  - Filtro por data (Data de / Data até)
  - Botão "Limpar Filtros" quando filtros ativos
  - Contador de resultados filtrados

- **Ações de administrador no modal de detalhes:**
  - Ver Perfil Completo
  - Validar Documentos
  - Alterar Role
  - Alterar Senha
  - Atribuir Plano (para motoristas/parceiros)
  - Gerir Parceiros (para gestores)
  - Bloquear/Desbloquear
  - Revogar (desativar completamente)
  - Eliminar

**Endpoints implementados:**
- `PUT /api/users/{id}/status` - Bloquear/desbloquear utilizador
- `PUT /api/users/{id}/revoke` - Revogar acesso do utilizador
- `PUT /api/users/{id}/reset-password` - Alterar senha (admin)

**Testes:** 94% backend, 100% frontend

---

### 2. Sistema RPA Simplificado ✅
**Página:** `/rpa-simplificado` (Admin, Gestão, Parceiro)

**Funcionalidades de Upload CSV:**
- **Prio Combustível** - Importar abastecimentos (data, matricula, litros, valor, local)
- **Prio Elétrico** - Importar carregamentos (data, matricula, kwh, valor, estacao)
- **GPS Verizon** - Importar rastreamento (data, matricula, km_percorridos, tempo_conducao)
- **GPS Cartrack** - Importar rastreamento (data, matricula, km_percorridos, tempo_conducao)
- **Outro Sistema** - Importação genérica

**Funcionalidades de Exportação CSV:**
- Relatórios Semanais (motorista, ganhos Uber/Bolt, comissões, valores a pagar)
- Recibos/Transações (recibos submetidos com valores e status)
- Despesas (combustível, elétrico, outras despesas)

**Testes:** 100% backend (26/26), 100% frontend

---

### 3. Sistema RPA Automático com Playwright ✅ NEW
**Página:** `/rpa-automacao` (Admin, Gestão, Parceiro)

**Plataformas suportadas:**
- 🚗 **Uber Driver** - Extrair ganhos semanais/mensais (requer 2FA)
- ⚡ **Bolt Fleet** - Extrair ganhos semanais/mensais
- 🛣️ **Via Verde Empresas** - Extrair portagens com data/hora e matrícula
- ⛽ **Prio Energy** - Extrair combustível e carregamentos elétricos

**Funcionalidades:**
- **Gestão de Credenciais Encriptadas** (Fernet encryption)
- **Execução Manual** com seleção de tipo e período
- **Agendamento Automático** (diário, semanal, mensal)
- **Histórico de Execuções** com logs detalhados e screenshots
- **Estatísticas** por plataforma e taxa de sucesso

**Endpoints implementados:**
- `GET /api/rpa-auto/plataformas` - Listar plataformas disponíveis
- `POST /api/rpa-auto/credenciais` - Guardar credenciais encriptadas
- `GET /api/rpa-auto/credenciais` - Listar credenciais (sem password)
- `DELETE /api/rpa-auto/credenciais/{plataforma}` - Eliminar credenciais
- `POST /api/rpa-auto/executar` - Iniciar execução (background)
- `GET /api/rpa-auto/execucoes` - Histórico de execuções
- `GET /api/rpa-auto/execucoes/{id}` - Detalhes com logs
- `POST /api/rpa-auto/agendamentos` - Criar agendamento
- `GET /api/rpa-auto/agendamentos` - Listar agendamentos
- `DELETE /api/rpa-auto/agendamentos/{id}` - Eliminar agendamento
- `GET /api/rpa-auto/estatisticas` - Estatísticas

**Ficheiros:**
- `/app/backend/routes/rpa_automacao.py` - API endpoints
- `/app/backend/services/rpa_executor.py` - Scripts Playwright
- `/app/frontend/src/pages/RPAAutomacao.js` - Frontend UI

**Testes:** 100% backend (24/24), 100% frontend

**Nota:** As execuções falham com ERR_NAME_NOT_RESOLVED no ambiente de preview porque os sites externos não são acessíveis. Em produção com acesso à internet, funcionará normalmente.

---

## Changelog (2026-01-22 - Session 19)

### 1. Guia Visual Gmail 2FA (App Password) ✅ NEW
**Componente:** `GmailAppPasswordGuide` em `ConfiguracoesParceiro.js`

**Funcionalidades:**
- Detecção automática de Gmail (quando servidor SMTP ou email contém "gmail")
- Alerta informativo sobre autenticação de 2 fatores
- Modal com guia passo-a-passo de 5 etapas
- Botão direto para página de App Passwords do Google
- Visualização do formato da senha gerada
- Avisos importantes sobre copiar a senha

**Comportamento:**
- Quando utilizador escreve "gmail" no servidor ou email → aparece:
  - Botão "Como criar Senha de Aplicação?" ao lado do campo Password
  - Alerta amarelo explicando a necessidade de App Password
  - Placeholder muda para "Cole a Senha de Aplicação aqui"

### 2. Guia Visual Terabox Cookie ✅
**Componente:** `TeraboxGuideModal` em `Integracoes.js`

**Funcionalidades:**
- Modal interativo com 5 passos visuais
- Simulação do DevTools do browser
- Botão direto para abrir terabox.com
- Instruções claras para encontrar cookie "ndus"

### 3. Integração API Terabox Cloud ✅
**Serviço:** `/app/backend/services/terabox_cloud.py`

- Autenticação via Cookie de Sessão
- Teste de conexão, criação de pastas, upload de ficheiros

### 4. Restauro Automático Sessões WhatsApp ✅
- Serviço Node.js detecta e restaura sessões no arranque

---

## Changelog (2026-01-22 - Session 18)

### 1. Sincronização Automática do Terabox ✅
**Endpoint implementado:** `POST /api/terabox/sync-documents`

**Funcionalidades:**
- Sincronização automática de documentos para estrutura organizada
- Suporta 5 categorias: contratos, recibos, vistorias, relatórios, documentos_motorista
- Cada parceiro tem a sua própria área isolada
- Estrutura de pastas: `/parceiro_id/Categoria/SubPasta/ficheiro.pdf`
- Logs de sincronização em `terabox_sync_logs`
- Endpoint para sincronização manual por parceiro: `POST /api/terabox/sync-trigger/{parceiro_id}`

**Ficheiros modificados:**
- `/app/backend/routes/terabox.py` - ~300 linhas de lógica de sincronização
- `/app/frontend/src/pages/Integracoes.js` - Botão de sincronização manual

### 2. WhatsApp Web Integration ✅ (Substituiu WhatsApp Business API)
**Serviço Node.js:** `/app/backend/whatsapp_service/` na porta 3001

**Funcionalidades:**
- Conexão via QR Code (escanear com telemóvel)
- Envio automático de mensagens após conexão
- Envio de relatórios semanais para motoristas
- Envio em massa para múltiplos motoristas
- Notificações de alteração de status
- Histórico de mensagens enviadas

**Endpoints:**
- `GET /api/whatsapp/status` - Estado da conexão
- `GET /api/whatsapp/qr` - Obter QR Code para escanear
- `POST /api/whatsapp/send` - Enviar mensagem individual
- `POST /api/whatsapp/send-bulk` - Envio em massa
- `POST /api/whatsapp/send-relatorio/{motorista_id}` - Enviar relatório
- `POST /api/whatsapp/logout` - Desconectar
- `POST /api/whatsapp/restart` - Reiniciar serviço

**Como usar:**
1. Aceder a Configurações → Integrações
2. Na secção WhatsApp Web, clicar "Mostrar QR Code"
3. No telemóvel: WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo
4. Escanear o QR Code
5. Após conectar, pode enviar mensagens automaticamente

**Ficheiros criados/modificados:**
- `/app/backend/whatsapp_service/` - **NOVO** - Serviço Node.js completo
- `/app/backend/routes/whatsapp.py` - Reescrito para usar WhatsApp Web
- `/app/frontend/src/pages/Integracoes.js` - UI para QR Code e conexão

---

## Changelog (2026-01-19 - Session 17 - Arquivo Ex-Motoristas + Bug Combustíveis)

### 1. Arquivo de Ex-Motoristas ✅
**Nova página criada:** `/motoristas/arquivo`

**Funcionalidades:**
- Lista de motoristas inativos/arquivados
- Histórico de ganhos (Uber, Bolt, Total)
- Veículos utilizados durante o período de atividade
- Despesas/extras pendentes
- Opção de reativar motorista
- Pesquisa por nome, email ou telefone

**Endpoints criados:**
- `GET /api/motoristas/arquivo/ex-motoristas` - Listar ex-motoristas
- `GET /api/motoristas/{id}/historico-veiculos` - Histórico de veículos
- `GET /api/motoristas/{id}/despesas-extras` - Despesas pendentes

**Ficheiros:**
- `/app/frontend/src/pages/ArquivoExMotoristas.js` - **NOVO**
- `/app/backend/routes/motoristas.py` - Endpoints adicionados
- `/app/frontend/src/App.js` - Rota adicionada
- `/app/frontend/src/pages/Motoristas.js` - Botão "Arquivo Ex-Motoristas"

### 2. Bug Combustíveis/Elétricos no Relatório Semanal ✅
**Problema:** Registos de combustível com `vehicle_id` mas sem `motorista_id` não apareciam nos relatórios.

**Solução:** Corrigida query para buscar por `vehicle_id` OU `motorista_id` (usando $or):
- Query agora inclui registos do veículo atribuído ao motorista
- Campos `veiculo_id` e `motorista_id` incluídos nos registos para rastreabilidade

**Ficheiro modificado:** `/app/backend/routes/relatorios.py` (linhas 241-320)

---

## Changelog (2026-01-16 - Session 16 - Terabox Sync + WhatsApp Business)

### 1. Terabox - Sincronização Automática ✅
**Funcionalidades implementadas:**
- Sincronização automática de documentos para Terabox
- Estrutura organizada por pastas (Motoristas, Veículos, Contratos, Relatórios, etc.)
- Cada parceiro tem a sua própria área isolada
- Gestor/Admin pode visualizar todos os parceiros
- Estatísticas por parceiro (total ficheiros, tamanho)

**Endpoints adicionados:**
- `POST /api/terabox/sync/documento` - Sincronizar documento automaticamente
- `GET /api/terabox/sync/status` - Status de sincronização
- `GET /api/terabox/parceiros` - Listar parceiros com Terabox (admin)
- `GET /api/terabox/parceiro/{id}/stats` - Estatísticas de um parceiro

### 2. WhatsApp Business API ✅
**Funcionalidades implementadas:**
- Envio de relatórios semanais via WhatsApp
- Notificações de alteração de status
- Comunicação de vistorias agendadas
- Envio em massa para múltiplos motoristas
- Página de configuração em Integrações

**Endpoints adicionados:**
- `GET/POST /api/whatsapp/config` - Configuração da API
- `POST /api/whatsapp/send` - Enviar mensagem individual
- `POST /api/whatsapp/send-relatorio/{motorista_id}` - Enviar relatório
- `POST /api/whatsapp/send-bulk` - Envio em massa
- `POST /api/whatsapp/notify-status-change` - Notificar mudança de status
- `GET /api/whatsapp/logs` - Histórico de envios
- `GET /api/whatsapp/stats` - Estatísticas

**Ficheiros criados/modificados:**
- `/app/backend/routes/whatsapp.py` - **NOVO** - Router completo WhatsApp
- `/app/backend/routes/terabox.py` - Endpoints de sincronização adicionados
- `/app/backend/server.py` - Router WhatsApp registado
- `/app/frontend/src/pages/Integracoes.js` - Configuração WhatsApp
- `/app/frontend/src/pages/ResumoSemanalParceiro.js` - Botão WhatsApp no envio em massa

**Configuração necessária:**
Para usar WhatsApp Business API:
1. Criar conta Meta Business em business.facebook.com
2. Adicionar WhatsApp Business
3. Obter Phone Number ID e Access Token
4. Configurar em TVDEFleet → Configurações → Integrações

---

## Prioritized Backlog

### P0 - Concluído
- [x] **Gestão Avançada de Utilizadores** - COMPLETO (Session 20)
  - Filtros por perfil, parceiro, data
  - Ações: bloquear, revogar, alterar senha, validar documentos
- [x] **Sistema RPA Simplificado** - COMPLETO (Session 20)
  - Upload CSV: Prio Combustível, Prio Elétrico, GPS Verizon, GPS Cartrack
  - Exportação CSV: Relatórios Semanais, Recibos, Despesas

### P1 - Alta Prioridade
- [x] ~~Implementar sincronização Terabox~~ - COMPLETO (Session 18)
- [ ] Limitar widget "Próximos Eventos" no dashboard a 3 itens
- [ ] Refatoração do backend (migrar rotas de `relatorios` do `server.py`)

### P2 - Média Prioridade
- [ ] Continuar refatoração: mover mais endpoints do `server.py` para ficheiros dedicados
- [ ] Implementar sincronização automática (RPA com Playwright)
- [ ] Dashboard de ROI com cálculos automáticos

### P3 - Baixa Prioridade
- [ ] PDF do relatório semanal com lista de transações Via Verde
- [ ] Editor visual para automação RPA
- [ ] Funcionalidade de exportação de dados (JSON/CSV)

---

## Architecture Overview

### Key API Endpoints - User Management (NEW)
```
GET  /api/users/all                    # Listar todos os utilizadores
GET  /api/users/pending                # Listar utilizadores pendentes
PUT  /api/users/{id}/status            # Bloquear/desbloquear
PUT  /api/users/{id}/revoke            # Revogar acesso
PUT  /api/users/{id}/reset-password    # Alterar senha
PUT  /api/users/{id}/set-role          # Alterar role
PUT  /api/users/{id}/validate-document # Validar documento
DELETE /api/users/{id}                 # Eliminar utilizador
```

### Key API Endpoints - Terabox Sync
```
POST /api/terabox/sync-documents           # Sincronizar todos os documentos
POST /api/terabox/sync-trigger/{parceiro}  # Sincronizar parceiro específico
GET  /api/terabox/sync-logs                # Histórico de sincronizações
GET  /api/terabox/stats                    # Estatísticas globais
GET  /api/terabox/parceiro/{id}/stats      # Estatísticas por parceiro
```

### Database Collections - Terabox
```javascript
// terabox_ficheiros - Ficheiros sincronizados
{
  id: string,
  nome: string,
  caminho_completo: string,
  tamanho: number,
  pasta_id: string,
  parceiro_id: string,
  categoria: string,  // contrato, recibo, vistoria, relatorio, documento_motorista
  entidade_id: string,
  sincronizado_automaticamente: boolean,
  data_criacao: datetime
}

// terabox_sync_logs - Logs de sincronização
{
  id: string,
  data: datetime,
  executado_por: string,
  parceiros: [string],
  categorias: [string],
  resultados: {
    total_sincronizados: number,
    por_categoria: object,
    erros: [string]
  }
}
```

---

## Test Credentials
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro**: parceiro@tvdefleet.com / 123456

## Test Reports
- `/app/test_reports/iteration_14.json` - Último relatório de testes
