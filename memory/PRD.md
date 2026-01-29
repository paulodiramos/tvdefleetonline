# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro, automações RPA e sistema de permissões granular.

## Arquitetura
- **Frontend**: React (porta 3000)
- **Backend**: FastAPI (porta 8001)
- **Database**: MongoDB

---

## ✅ Sistema de Agendamento RPA (Implementado: 25/01/2025)

### Descrição
Sistema que permite agendar execuções automáticas de automações RPA (Bolt, Uber, Via Verde, etc).

### Componentes
- **Serviço Scheduler**: `/app/backend/services/rpa_scheduler.py`
  - Loop de verificação a cada 5 minutos
  - Verifica `rpa_agendamentos` com `proxima_execucao` no passado
  - Executa automações em background
  - Atualiza `proxima_execucao` após cada execução

### Endpoints
- `POST /api/rpa-auto/agendamentos` - Criar novo agendamento
- `GET /api/rpa-auto/agendamentos` - Listar agendamentos
- `PUT /api/rpa-auto/agendamentos/{id}` - Atualizar agendamento
- `DELETE /api/rpa-auto/agendamentos/{id}` - Eliminar agendamento
- `POST /api/rpa-auto/agendamentos/executar-pendentes` - Forçar execução (admin)

### Frequências Suportadas
- **Diário**: Executa todos os dias à hora configurada
- **Semanal**: Executa no dia da semana configurado (0=Segunda, 6=Domingo)
- **Mensal**: Executa no dia 1 de cada mês

### Ficheiros Relevantes
- `/app/backend/services/rpa_scheduler.py`
- `/app/backend/routes/rpa_automacao.py`

---

## ✅ Sistema de Permissões de Funcionalidades (Implementado: 25/01/2025)

### Descrição
Sistema que permite ao admin controlar granularmente quais funcionalidades cada parceiro pode aceder.

### Funcionalidades Disponíveis (15 total)
- **comunicacao**: whatsapp, email
- **veiculos**: vistorias, veiculos, agenda_veiculos, anuncios_venda
- **documentos**: contratos, documentos
- **automacao**: rpa_automacao, importacao_csv
- **financeiro**: relatorios, financeiro
- **gestao**: motoristas
- **sistema**: alertas
- **integracao**: terabox

### Endpoints Backend
- `GET /api/permissoes/minhas` - Retorna funcionalidades do utilizador atual
- `GET /api/permissoes/funcionalidades` - Lista todas as funcionalidades disponíveis
- `GET /api/permissoes/parceiro/{id}` - Permissões de um parceiro específico
- `PUT /api/permissoes/parceiro/{id}` - Atualizar permissões (admin only)
- `GET /api/permissoes/admin/todos-parceiros` - Listar todos os parceiros com permissões

### Frontend
- **Layout.js**: Carrega permissões via `GET /api/permissoes/minhas` no `useEffect`
- **itemPermitido()**: Função que verifica se um item de menu deve ser mostrado
- **filtrarSubmenu()**: Filtra submenus baseado nas permissões

### Ficheiros Relevantes
- `/app/backend/routes/permissoes_funcionalidades.py`
- `/app/frontend/src/components/Layout.js`
- `/app/frontend/src/contexts/PermissionsContext.js`

---

## ✅ Sistema de Permissões de Plataformas RPA (Implementado)

### Descrição
Sistema que permite ao admin controlar quais plataformas de RPA cada parceiro pode utilizar.

### Endpoints
- `GET /api/rpa-auto/plataformas` - Lista plataformas (filtradas por permissões)
- `GET /api/rpa-auto/parceiro-plataformas/{id}` - Permissões de plataformas de um parceiro
- `PUT /api/rpa-auto/parceiro-plataformas/{id}` - Atualizar permissões (admin only)

---

## ✅ WhatsApp Business Cloud API (Atualizado: 24/01/2025)

### Nova Arquitetura (Sem Railway!)
A integração WhatsApp usa a **API oficial da Meta**:

```
TVDEFleet → Meta Graph API → Mensagem ✅
```

### Vantagens
- ✅ **100% oficial** - API da Meta
- ✅ **Sem Railway** - Integração direta
- ✅ **Sem QR Code** - Não precisa escanear
- ✅ **1000 msgs grátis/mês** por número

### Configuração por Parceiro
Cada parceiro acede a `Configurações → WhatsApp` e:
1. Cria conta em developers.facebook.com
2. Adiciona número WhatsApp Business
3. Copia Phone Number ID e Access Token
4. Cola nas configurações e testa

### Ficheiros Relevantes
- `/app/backend/routes/whatsapp_cloud.py`
- `/app/frontend/src/pages/ConfiguracoesParceiro.js`

---

## ✅ Sistema de Email SMTP por Parceiro

Cada parceiro configura o seu próprio email:
- **Gmail**: smtp.gmail.com:587 + App Password
- **Outlook**: smtp.office365.com:587
- **Outros**: Configuração personalizada

---

## ✅ Sistema RPA

- Plataformas pré-definidas: Uber, Bolt, Via Verde, Prio
- Criar plataformas personalizadas (admin)
- Execução de scripts Playwright
- Importação de CSV (manual ou agendada)
- Páginas: RPA Automação, RPA Designer, Importação Dados

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro Zeny: `geral@zmbusines.com` / `zeny123`

---

## Tarefas Concluídas (25/01/2025)
- ✅ **Sistema de Permissões de Funcionalidades** - Backend + Frontend + Testes
- ✅ **Limpeza de código obsoleto** - Removidos whatsapp-vps-deploy/ e whatsapp.py
- ✅ **Correção UI Modal de Execução RPA** - Seletores de semana/ano inicializados com valores atuais (25/01/2025)
- ✅ **Correção Modal de Detalhes da Execução RPA** - Carregamento de detalhes funcionando (25/01/2025)

## Tarefas Concluídas (26/01/2025)
- ✅ **Sistema de Gestão de Planos e Módulos** - Estrutura completa implementada
  - Backend: Modelos, serviço e rotas em `/app/backend/routes/gestao_planos.py`
  - Frontend Admin: `/app/frontend/src/pages/AdminGestaoPlanos.js`
  - Módulos predefinidos: Emails, Manutenção, Agenda, Publicidade, Contratos, WhatsApp, Relatórios, RPA, Vistorias, Autofaturação
  - Planos base: Gratuito, Profissional, Enterprise (parceiros) + Gratuito, Premium (motoristas)
  - Tipos de cobrança: fixo, por_veiculo, por_motorista
  - Periodicidades: semanal, mensal, anual
  - Promoções e campanhas (normal, pioneiro, lançamento)
  - Preços especiais por parceiro
- ✅ **Atribuição de Planos/Módulos nos Detalhes do Parceiro**
  - Componente: `/app/frontend/src/components/PlanoModulosParceiroTab.js`
  - Atribuir plano com trial, oferta gratuita ou desconto especial
  - Adicionar módulos individuais com trial ou oferta
  - Visualizar módulos ativos

## Tarefas Concluídas (27/01/2025)
- ✅ **UI de Preços por Veículo e Motorista** - Campos adicionados no modal de planos
  - Modal de criação/edição agora mostra:
    - **Preço Base do Plano** (semanal/mensal/anual)
    - **Preço por Veículo** (semanal/mensal/anual)
    - **Preço por Motorista** (semanal/mensal/anual)
    - **Taxa de Setup**
  - Cards de planos exibem estrutura de preços completa
  - Para planos de motoristas, mostra preços simples
  - Testado com 100% de sucesso (7/7 features)

- ✅ **Sistema de Pré-Pagamento Pro-Rata** - Implementado e testado
  - Backend: `/app/backend/services/prepagamento_service.py`
  - API: `/app/backend/routes/prepagamento.py`
  - Frontend: `/app/frontend/src/components/AdicionarRecursosCard.js`
  - Funcionalidades:
    - Parceiro solicita adição de veículos/motoristas na página `/meu-plano`
    - Sistema calcula valor pro-rata até à data de renovação
    - **Bloqueio automático** até pagamento ser confirmado
    - Modal de pagamento com opções: Multibanco, MBWAY, Cartão
    - Admin pode confirmar pagamento manualmente
    - Após confirmação: recursos são aplicados e mensalidade atualizada
  - Testado: 100% sucesso (16/16 backend + 8/8 frontend)
  - **NOTA: Gateway Ifthenpay SIMULADA** - referências são placeholders

## Tarefas Pendentes

### P1 - Alta Prioridade
- [x] ~~Refatoração do `server.py`~~ - Removidas 1538 linhas, ~42 endpoints duplicados (25/01/2025)
- [x] ~~Implementar lógica de agendamento de RPA~~ - Scheduler automático implementado (25/01/2025)
- [x] ~~Sistema de Gestão de Planos e Módulos~~ - Implementado (26/01/2025)
- [x] ~~UI de preços por veículo/motorista~~ - Implementado (27/01/2025)
- [x] ~~Sistema de Pré-Pagamento Pro-Rata~~ - Implementado (27/01/2025)
- [x] ~~Configuração Ifthenpay e Moloni~~ - Página admin `/admin/integracoes` (27/01/2025)
- [x] ~~Sistema de Comissões por Escala~~ - Implementado (27/01/2025)
- [x] ~~Classificação de Motoristas (5 níveis)~~ - Implementado (27/01/2025)
- [x] ~~Configuração de Comissões pelo Parceiro~~ - Implementado (27/01/2025)
- [x] ~~Turnos de motoristas por veículo~~ - Implementado (27/01/2025)
- [x] ~~Sistema de Sincronização Automática~~ - Implementado (27/01/2025)
- [x] ~~Refatoração Parcial server.py~~ - Criados import_ganhos.py e bolt_integration.py (27/01/2025)
- [x] ~~Sistema de Exportação de Dados CSV~~ - Implementado com seleção de campos (29/01/2025)
- [x] ~~Sistema de Importação de Dados CSV~~ - Funcionalidade completa de importação com preview e atualização (29/01/2025)
- [ ] **Processamento real Ifthenpay** - Usar credenciais para gerar referências MB
- [ ] **Processamento real Moloni** - Emitir faturas automaticamente
- [ ] Continuar refatoração do server.py (~36 endpoints @app restantes, ~16000 linhas)

### P2 - Média Prioridade
- [x] ~~Limitar "Próximos Eventos" no dashboard~~ - Alertas limitados a 5 itens (25/01/2025)
- [x] ~~Testar parser CSV com ficheiros reais~~ - Bolt e Uber testados com sucesso (25/01/2025)
- [ ] Testar parser CSV da Via Verde com ficheiro de exemplo
- [ ] Loja online de planos/módulos (frontend parceiro/motorista)
- [ ] Página "Meu Plano" para parceiros verem e fazerem upgrade

---

## ✅ Sistema de Sincronização Automática de Dados (Implementado: 27/01/2025)

### Descrição
Sistema completo para automatizar a recolha de dados de Uber, Bolt, Via Verde e Abastecimentos, com agendamento e notificações.

### Funcionalidades
- **Fontes de Dados**: Uber (RPA/CSV), Bolt (API/RPA/CSV), Via Verde (RPA/CSV), Abastecimentos (RPA/CSV)
- **Métodos de Recolha**: Automático (RPA), API Oficial, Upload Manual (CSV)
- **Agendamento Global**: Frequência (diário/semanal/mensal), dia da semana/mês, hora
- **Resumo Semanal**: Geração automática, envio email/WhatsApp aos motoristas
- **Notificações ao Parceiro**: Sistema, Email, WhatsApp
- **Histórico**: Listagem de sincronizações com status, fontes e timestamps
- **Estatísticas**: Total, taxa de sucesso, última sync, próxima execução

### Endpoints
- `GET /api/sincronizacao-auto/fontes` - Listar fontes disponíveis
- `GET /api/sincronizacao-auto/config` - Obter configuração do parceiro
- `PUT /api/sincronizacao-auto/config` - Atualizar configuração
- `POST /api/sincronizacao-auto/executar` - Executar sincronização manual
- `GET /api/sincronizacao-auto/historico` - Obter histórico de execuções
- `GET /api/sincronizacao-auto/estatisticas` - Obter estatísticas

### Ficheiros
- `/app/frontend/src/components/ConfigSincronizacao.js` - Componente de configuração
- `/app/frontend/src/pages/ConfiguracoesParceiro.js` - Tab "Sincronização"
- `/app/backend/routes/sincronizacao.py` - Endpoints de sincronização automática
- `/app/backend/services/sincronizacao_service.py` - Serviço de sincronização

### Módulo para Cobrança
- Valor fixo por frota (não por veículo/motorista)
- Disponível após contratação do módulo

---

## ✅ Gestão de Turnos de Veículos (Implementado: 27/01/2025)

### Descrição
Sistema para atribuir múltiplos motoristas a um veículo com horários de início/fim e dias da semana.

### Funcionalidades
- **Motorista Principal**: Responsável padrão do veículo
- **Turnos Configurados**: Tabela com motorista, horário (HH:MM - HH:MM), dias da semana, estado (ativo/inativo), notas
- **Cobertura Semanal**: Visualização dos turnos por dia da semana
- **Modal de Turno**: Adicionar/editar com seleção de motorista, horas, dias da semana, notas

### Endpoints
- `GET /api/comissoes/turnos/veiculo/{id}` - Listar turnos do veículo
- `POST /api/comissoes/turnos/veiculo/{id}` - Adicionar turno
- `PUT /api/comissoes/turnos/veiculo/{id}/turno/{turno_id}` - Atualizar turno
- `DELETE /api/comissoes/turnos/veiculo/{id}/turno/{turno_id}` - Remover turno
- `PUT /api/comissoes/turnos/veiculo/{id}/principal` - Definir motorista principal

### Ficheiros
- `/app/frontend/src/components/VeiculoTurnos.js` - Componente de gestão de turnos
- `/app/frontend/src/pages/FichaVeiculo.js` - Tab "Turnos" adicionada
- `/app/backend/routes/comissoes.py` - Endpoints de turnos
- `/app/backend/services/comissoes_service.py` - Lógica de negócio

---

## ✅ Configuração de Comissões pelo Parceiro (Implementado: 27/01/2025)

### Descrição
Página para parceiros configurarem as suas próprias escalas de comissão (se módulo ativo).

### Funcionalidades
- **Tipo de Comissão**: Valor fixo (€/semana), Percentagem fixa (%), ou Escala por valor faturado
- **Escala Própria**: Criar/editar níveis com valor mínimo, máximo e percentagem
- **Classificação Própria**: Personalizar bónus por nível de classificação
- **Gestão de Motoristas**: Atribuir classificação manual aos motoristas

### Acesso Condicional
Link "💰 Comissões" só aparece no menu se parceiro tiver módulo `relatorios_avancados`, `comissoes` ou similar.

### Ficheiros
- `/app/frontend/src/pages/ConfigComissoesParceiro.js` - Página de configuração
- `/app/frontend/src/components/Layout.js` - Link condicional no menu
- `/app/backend/routes/comissoes.py` - Endpoints `/parceiro/config`

---

## ✅ Sistema de Comissões e Classificação de Motoristas (Implementado: 27/01/2025)

### Descrição
Sistema flexível de comissões baseado em valor faturado com bónus por classificação de motorista.

### Escalas de Comissão (níveis ilimitados)
- Comissão % baseada no **valor faturado semanal**
- Escala padrão: 10% (até €500) → 12% → 14% → 16% → 18% (>€2000)
- Admin pode criar/editar escalas em `/admin/comissoes`

### Classificação de Motoristas (5 níveis)
| Nível | Meses Mín. | Cuidado Veículo | Bónus |
|-------|------------|-----------------|-------|
| 🥉 Bronze | 0 | 0% | +0% |
| 🥈 Prata | 3 | 60% | +1% |
| 🥇 Ouro | 6 | 75% | +2% |
| 💎 Platina | 12 | 85% | +3.5% |
| 👑 Diamante | 24 | 95% | +5% |

### Cálculo Total
- **Comissão Total = Comissão Base (escala) + Bónus (classificação)**
- Exemplo: €1200 faturado + Ouro = 14% + 2% = **16% (€192)**

### Ficheiros
- Backend: `/app/backend/services/comissoes_service.py`, `/app/backend/routes/comissoes.py`
- Frontend: `/app/frontend/src/pages/AdminComissoes.js`

---

## ✅ Sistema de Gestão de Planos e Módulos (Implementado: 26/01/2025)

### Descrição
Sistema completo para criar, gerir e atribuir planos e módulos a parceiros e motoristas.

### Estrutura de Preços
- **Por Veículo**: Preço multiplicado pelo número de veículos
- **Por Motorista**: Preço multiplicado pelo número de motoristas
- **Preço Fixo**: Preço único independente da quantidade
- **Periodicidades**: Semanal, Mensal, Anual

### Funcionalidades Admin
- Criar/Editar/Desativar planos
- Criar/Editar/Desativar módulos
- Definir limites (máx veículos/motoristas)
- Adicionar promoções (normal, pioneiro, lançamento)
- Definir preços especiais por parceiro
- Atribuir planos/módulos com trial ou oferta gratuita
- Ver estatísticas (subscrições ativas, receita mensal)

### Funcionalidades Parceiro
- Ver plano atual e módulos ativos
- Atualizar para plano superior (futuramente)
- Comprar módulos individuais (futuramente)

### Endpoints Principais
- `GET /api/gestao-planos/planos` - Listar planos
- `GET /api/gestao-planos/modulos` - Listar módulos
- `POST /api/gestao-planos/subscricoes/atribuir-plano` - Atribuir plano
- `POST /api/gestao-planos/subscricoes/atribuir-modulo` - Atribuir módulo
- `GET /api/gestao-planos/subscricoes/user/{id}` - Ver subscrição de utilizador
- `POST /api/gestao-planos/seed` - Popular dados iniciais

### Ficheiros Principais
- `/app/backend/models/planos_modulos.py` - Modelos Pydantic
- `/app/backend/services/planos_modulos_service.py` - Lógica de negócio
- `/app/backend/routes/gestao_planos.py` - Endpoints API
- `/app/frontend/src/pages/AdminGestaoPlanos.js` - UI Admin
- `/app/frontend/src/components/PlanoModulosParceiroTab.js` - UI Detalhes Parceiro

### Próximos Passos
1. Integração If Then Pay para pagamentos online
2. Integração Moloni para faturação automática
3. Loja online para parceiros/motoristas

---

## Ficheiros Removidos (25/01/2025)
- `/app/whatsapp-vps-deploy/` - Directório obsoleto do Railway
- `/app/backend/routes/whatsapp.py` - Substituído por whatsapp_cloud.py

---

## Notas Importantes
- **Railway foi desativado** - WhatsApp usa API Cloud oficial
- **Sistema de permissões activo** - Menu filtrado por funcionalidades
