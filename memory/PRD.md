# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro, automações RPA e sistema de permissões granular.

## Arquitetura
- **Frontend**: React (porta 3000)
- **Backend**: FastAPI (porta 8001)
- **Database**: MongoDB (`tvdefleet_db`)

---

## ✅ Sincronização RPA Via Verde - COMPLETA (01/02/2026)

### Descrição
Automação completa para extrair dados de portagens da Via Verde usando **download direto de Excel** (sem necessidade de email).

### Fluxo de Funcionamento
1. Login automático no portal Via Verde Empresas (`#txtUsername`, `#txtPassword`)
2. Navegação para "Extratos e Movimentos" → Tab "Movimentos"
3. Clique no botão **"Exportar excel"** (classe: `a.link-download.dropdown-link`)
4. Seleção de **Excel** no dropdown
5. Download automático do ficheiro `.xlsx`
6. Parsing do Excel com todas as colunas:
   - License Plate, Entry Date, Entry/Exit Point, Value, Liquid Value, etc.
7. Importação automática para a BD (`portagens_viaverde`)
8. Detecção de duplicados (evita reimportar dados existentes)

### Ficheiros Relevantes
- `/app/backend/services/rpa_viaverde_v2.py` - Script RPA com download direto
- `/app/backend/routes/sincronizacao.py` - Endpoints da API

### Resultados
- **14.837 portagens** importadas na BD
- **9 execuções RPA** registadas
- Última execução: 548 movimentos processados

### Credenciais de Teste
- **Email:** geral@zmbusines.com
- **Password Via Verde:** 5+?n74vi%*8GJ3e

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
- [x] ~~Página "Meu Plano" para Parceiros~~ - Página completa com detalhes do plano, custos e módulos (29/01/2025)
- [x] ~~Correção Resumo Semanal Bolt~~ - Query suporta período_semana/ano além de semana/ano (30/01/2025)
- [x] ~~Segurança na Sincronização~~ - Verifica parceiro_id e parceiro_atribuido (30/01/2025)
- [x] ~~Correção API Bolt getFleetOrders~~ - company_ids como array + extração de ganhos de order_price (30/01/2025)
- [x] ~~Sistema RPA Central~~ - Credenciais centrais geridas pelo Admin para todos os parceiros (30/01/2025)
- [ ] **Processamento real Ifthenpay** - Usar credenciais para gerar referências MB
- [ ] **Processamento real Moloni** - Emitir faturas automaticamente
- [ ] Continuar refatoração do server.py (~36 endpoints @app restantes, ~16000 linhas)

### P2 - Média Prioridade
- [x] ~~Limitar "Próximos Eventos" no dashboard~~ - Alertas limitados a 5 itens (25/01/2025)
- [x] ~~Testar parser CSV com ficheiros reais~~ - Bolt e Uber testados com sucesso (25/01/2025)
- [x] ~~Página "Meu Plano" para parceiros~~ - Implementada com cálculo de custos (29/01/2025)
- [x] ~~Loja online de planos/módulos~~ - Interface completa para ver e comparar planos (29/01/2025)
- [x] ~~Consolidação de menus~~ - Credenciais Plataformas integrado em Configurações Parceiro (29/01/2025)
- [x] ~~Integração Bolt API Oficial~~ - OAuth2 com client_id/client_secret (29/01/2025)
- [ ] Testar parser CSV da Via Verde com ficheiro de exemplo

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

## ✅ Sistema de Exportação/Importação de Dados (Implementado: 29/01/2025)

### Descrição
Sistema completo para exportar e importar dados de motoristas e veículos via CSV.

### Exportação
- **Campos Selecionáveis**: 20 campos para motoristas, 22 campos para veículos
- **Delimitadores**: Ponto-e-vírgula (;) para Excel PT, Vírgula (,) para internacional
- **Formatos**: CSV individual ou ZIP com ambos os ficheiros
- **BOM UTF-8**: Incluído para compatibilidade com Excel

### Importação
- **Apenas Atualização**: Não cria registos novos, apenas atualiza existentes
- **Chaves Únicas**: NIF para motoristas, Matrícula para veículos
- **Preview**: Pré-visualização das alterações antes de confirmar
- **Validação**: Erros detalhados para linhas ignoradas

### Endpoints
- `GET /api/exportacao/campos` - Listar campos disponíveis
- `GET /api/exportacao/motoristas` - Exportar motoristas para CSV
- `GET /api/exportacao/veiculos` - Exportar veículos para CSV
- `GET /api/exportacao/completa` - Exportar ambos em ZIP
- `POST /api/exportacao/importar/motoristas/preview` - Preview de importação
- `POST /api/exportacao/importar/motoristas/confirmar` - Confirmar importação
- `POST /api/exportacao/importar/veiculos/preview` - Preview de veículos
- `POST /api/exportacao/importar/veiculos/confirmar` - Confirmar importação

### Ficheiros
- `/app/backend/routes/exportacao.py` - Endpoints de export/import
- `/app/frontend/src/pages/ExportarDados.js` - UI completa

---

## Ficheiros Removidos (25/01/2025)
- `/app/whatsapp-vps-deploy/` - Directório obsoleto do Railway
- `/app/backend/routes/whatsapp.py` - Substituído por whatsapp_cloud.py

---

## ✅ Loja de Planos e Módulos (Implementado: 29/01/2025)

### Descrição
Interface para parceiros visualizarem e compararem planos disponíveis.

### Funcionalidades
- **Listagem de Planos**: Gratuito, Profissional, Enterprise com preços e features
- **Toggle Mensal/Anual**: Mostra preços anuais com desconto de 17%
- **Tab de Módulos**: Lista de módulos disponíveis com indicador de incluído/não incluído
- **Modal de Upgrade**: Preparado para integração com pagamento (Ifthenpay)
- **Marcação de Plano Atual**: Indica claramente qual é o plano ativo

### Ficheiros
- `/app/frontend/src/pages/LojaPlanos.js` - Página da loja
- `/app/frontend/src/pages/MeuPlanoParceiro.js` - Link para a loja

### Notas
- A funcionalidade de pagamento real depende da integração Ifthenpay (P1)
- Por agora, mostra mensagem para contactar suporte

---

## ✅ Integração Bolt API Oficial (Implementado: 29/01/2025)

### Descrição
Integração com a API oficial da Bolt Fleet usando OAuth2 Client Credentials.

### Funcionalidades
- **Autenticação OAuth2**: Token endpoint com client_id e client_secret
- **Auto-refresh de Token**: Token renova automaticamente antes de expirar (10 min)
- **Endpoints disponíveis**:
  - `POST /api/bolt/api/test-connection` - Testar conexão
  - `POST /api/bolt/api/save-credentials` - Guardar credenciais
  - `GET /api/bolt/api/credentials` - Obter credenciais (mascaradas)
  - `POST /api/bolt/api/sync-data` - Sincronizar dados
  - `GET /api/bolt/api/fleet-info` - Info da frota
  - `GET /api/bolt/api/drivers` - Lista de motoristas

### Ficheiros
- `/app/backend/services/bolt_api_service.py` - Cliente da API Bolt
- `/app/backend/routes/bolt_integration.py` - Endpoints (legado + API oficial)
- `/app/frontend/src/pages/ConfiguracoesParceiro.js` - UI com campos API

### Como obter credenciais
1. Aceder a fleets.bolt.eu
2. Ir a API Credentials
3. Clicar "Generate credentials"
4. Copiar Client ID e Secret

---

## ✅ Correções de Bugs - Resumo Semanal Bolt (30/01/2025)

### Bug 1: Valores Bolt não aparecem no Resumo Semanal
**Problema**: Os valores de ganhos da Bolt sincronizados não apareciam nas semanas 1 e 2 do resumo semanal.

**Causa Raiz**: A query de `ganhos_bolt` só verificava `semana/ano`, mas os dados importados usam `periodo_semana/periodo_ano`.

**Correção**: Adicionado `periodo_semana/periodo_ano` à query `$or` em `/app/backend/routes/relatorios.py` (linhas 896-912).

**Verificação**: Semana 2/2026 agora mostra €7506.32 em ganhos Bolt (8 motoristas).

### Bug 2: Sincronização não deve criar/mover motoristas
**Problema**: Risco da sincronização criar motoristas novos ou associar motoristas de outros parceiros.

**Causa Raiz**: A query só verificava `parceiro_id`, não `parceiro_atribuido`.

**Correção**: Adicionado `parceiro_atribuido` à query `$or` em `/app/backend/routes/sincronizacao.py` (linhas 1006-1048). A lógica apenas atualiza motoristas existentes.

**Verificação**: Código revisto confirma que não há operações de criação de motoristas.

---

## Notas Importantes
- **Railway foi desativado** - WhatsApp usa API Cloud oficial
- **Sistema de permissões activo** - Menu filtrado por funcionalidades

---

## 🔄 Em Progresso: Correção RPA Via Verde (02/02/2026)

### Problema Principal
O RPA da Via Verde não consegue filtrar por semana específica no site. A interface real difere do esperado:
1. Os campos de data "De:" e "Até:" não são facilmente acessíveis
2. O formato do site é MM/YYYY (não DD/MM/YYYY)
3. O dropdown de exportar oferece: PDF, XML, CSV, HTML (não Excel)

### Solução Implementada
1. **Filtragem pós-download**: O sistema agora descarrega todos os dados e filtra por semana no código Python
2. **Exportação CSV**: Alterado para usar CSV em vez de Excel (opção disponível no site)
3. **Via Verde Mensal**: Conforme decisão do utilizador, a Via Verde será versão mensal

### Estado Atual
- ✅ Login funciona
- ✅ Navegação funciona
- ❌ Download do CSV está com timeout (precisa de investigação adicional)

---

## ✅ NOVO: Script RPA Uber (02/02/2026)

### Descrição
Implementado script RPA para extração de dados do portal Uber Fleet.

### Funcionalidades
1. **Login automático** com email e password
2. **Navegação** para secção "Rendimentos"
3. **Seleção de período** (última semana, semana específica, personalizado)
4. **Extração de dados** da tabela de motoristas
5. **Download de relatório** (se disponível)

### Dados Extraídos por Motorista
- Nome do motorista
- Rendimentos totais
- Reembolsos e despesas
- Ajustes
- Pagamento
- Rendimentos líquidos

### Endpoint
`POST /api/uber/executar-rpa`

### Ficheiros
- `/app/backend/services/rpa_uber.py` - Script RPA
- `/app/backend/routes/sincronizacao.py` - Endpoint adicionado

### Requisitos
O parceiro precisa de configurar credenciais Uber em Configurações → Plataformas

### Descrição
Sistema completo de sincronização automática de portagens Via Verde que:
1. O parceiro clica no botão "Sincronizar" na página de Resumo Semanal
2. Seleciona o período (última semana, semana específica ou datas personalizadas)
3. O sistema executa RPA automaticamente: login → filtrar → download Excel → processar → importar
4. Os dados aparecem automaticamente no Resumo Semanal do motorista

### Funcionalidades Implementadas
- **RPA Via Verde com Download Direto de Excel** - Script Playwright (`rpa_viaverde_v2.py`)
- **Parser de Excel robusto** - Suporta todas as colunas do ficheiro Via Verde
- **Associação automática** - Vincula portagens a veículos/motoristas pela matrícula
- **Cálculo de semana** - Determina automaticamente a semana ISO de cada transação
- **Detecção de duplicados** - Evita reimportar dados existentes
- **Auto-criação de veículos** - Cria veículos placeholder para matrículas desconhecidas

### Correções Aplicadas (02/02/2026)
- **Bug de filtragem de datas** - RPA agora interage corretamente com o calendário popup do site Via Verde
- **Bug 422 no frontend** - Strings vazias convertidas para null em campos opcionais
- **Bug "valor" vs "value"** - Query do resumo semanal agora suporta ambos os campos
- **Bug de associação** - Via Verde busca por `matricula`, `vehicle_id` e `motorista_id`
- **Bug vehicles KeyError** - Tratamento de campos created_at/updated_at ausentes

### Resultados Testados
- **Semana 5/2026**: €99.11 em Via Verde distribuídos por 11 motoristas
- **Taxa de sucesso**: Backend 95%, Frontend 100%

### Ficheiros Relevantes
- `/app/backend/services/rpa_viaverde_v2.py` - Script RPA com Playwright (método expandir_filtro_e_selecionar_datas corrigido)
- `/app/backend/routes/sincronizacao.py` - Endpoint `/viaverde/executar-rpa` + função `auto_criar_veiculos_viaverde`
- `/app/backend/routes/relatorios.py` - Resumo Semanal com agregação Via Verde
- `/app/frontend/src/pages/ResumoSemanalParceiro.js` - UI com dropdown de sincronização

### Credenciais de Teste
- **Parceiro**: geral@zmbusines.com / zeny123
- **Via Verde**: geral@zmbusines.com / 5+?n74vi%*8GJ3e

---

## ✅ Sistema de Desativação de Motoristas (02/02/2026)

### Descrição
Sistema que permite desativar motoristas com uma data específica, impedindo que apareçam em relatórios de semanas futuras.

### Funcionalidades
- Pop-up de desativação com seleção de data
- Motoristas desativados não aparecem no Resumo Semanal após a data de desativação
- Endpoint: `PUT /api/motoristas/{id}/desativar` com `data_desativacao`

### Ficheiros Relevantes
- `/app/backend/routes/motoristas.py` (linhas 570-630) - Endpoint de desativação
- `/app/frontend/src/pages/Motoristas.js` (linhas 2230-2305) - Pop-up de desativação


---

## ✅ Sistema de Gestão de Utilizadores (02/02/2026)

### Descrição
Sistema completo para criar e gerir utilizadores com diferentes perfis (Admin, Gestor, Parceiro, Motorista), incluindo associação de gestores a parceiros.

### Funcionalidades
- **Listagem de Utilizadores**: Página `/utilizadores` com cards de utilizadores
- **Filtro por Role**: Dropdown para filtrar por Admin, Gestão, Parceiro, Motorista
- **Busca**: Campo de pesquisa por nome ou email
- **Criação de Utilizadores**: Modal com formulário para criar novos utilizadores
- **Tipos de Utilizador**:
  - **Motorista**: Pode ver ganhos, enviar recibos, aceder área do motorista
  - **Parceiro**: Gere motoristas, veículos e relatórios financeiros
  - **Gestor**: Pode gerir múltiplos parceiros associados (requer seleção de parceiros)
  - **Admin**: Acesso total ao sistema
- **Associação Gestor-Parceiro**: Tabela `gestor_parceiro` para relacionar gestores a parceiros
- **Validações**: Email duplicado, password mínima 6 caracteres, gestor requer ≥1 parceiro

### Endpoints
- `GET /api/users/all` - Listar todos os utilizadores (admin/gestão)
- `POST /api/auth/register` - Criar novo utilizador com role e parceiros_associados
- `GET /api/users/pending` - Utilizadores pendentes de aprovação
- `GET /api/parceiros` - Lista de parceiros para associação

### Ficheiros Relevantes
- `/app/frontend/src/pages/GestaoUtilizadores.js` - Página de gestão de utilizadores
- `/app/backend/routes/auth.py` - Endpoint de registo com suporte a roles
- `/app/backend/routes/users.py` - Endpoints de gestão de utilizadores
- `/app/backend/models/user.py` - Modelo com roles e parceiros_associados

### Credenciais de Teste
- **Admin**: admin@tvdefleet.com / 123456
- **Parceiro (criado via UI)**: parceiro.criado.ui@example.com / parceiro123
- **Parceiro (Zeny)**: geral@zmbusines.com / zeny123

### Correção Aplicada
- Corrigido endpoint de `/api/users` para `/api/users/all` no frontend
