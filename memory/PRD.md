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

## Tarefas Pendentes

### P1 - Alta Prioridade
- [x] ~~Refatoração do `server.py`~~ - Removidas 1538 linhas, ~42 endpoints duplicados (25/01/2025)
- [x] ~~Implementar lógica de agendamento de RPA~~ - Scheduler automático implementado (25/01/2025)
- [x] ~~Sistema de Gestão de Planos e Módulos~~ - Implementado (26/01/2025)
- [ ] Integração If Then Pay - Pagamentos online (Multibanco, MB Way, Cartão, Débito Direto)
- [ ] Integração Moloni - Faturação automática após pagamento
- [ ] Continuar refatoração do server.py (~151 endpoints restantes, ~16100 linhas)

### P2 - Média Prioridade
- [x] ~~Limitar "Próximos Eventos" no dashboard~~ - Alertas limitados a 5 itens (25/01/2025)
- [x] ~~Testar parser CSV com ficheiros reais~~ - Bolt e Uber testados com sucesso (25/01/2025)
- [ ] Testar parser CSV da Via Verde com ficheiro de exemplo
- [ ] Loja online de planos/módulos (frontend parceiro/motorista)
- [ ] Página "Meu Plano" para parceiros verem e fazerem upgrade

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
