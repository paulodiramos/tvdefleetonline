# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE (Uber/Bolt) com sincronização automática de dados financeiros.

## Requisitos Principais

### Funcionalidades Implementadas

#### 1. Sincronização Automática Uber via CSV (P0) ✅
**Data: 2026-02-13**
- Implementado RPA (Playwright) para download automático do relatório CSV do portal Uber
- Fluxo: Login → Navegar para Relatórios → Encontrar relatório → Download CSV → Processar dados
- Endpoint: `POST /api/uber/sincronizar-csv`
- Campos extraídos: tarifa, gratificacao (uGrat), portagens (uPort), pago_total, taxa_servico

#### 2. Separação de Portagens e Gratificações Uber (P0) ✅
**Data: 2026-02-13**
- Adicionadas colunas uPort e uGrat no resumo semanal
- Backend calcula e retorna os valores separados
- Frontend exibe nas colunas dedicadas

#### 3. Edição Manual de Ganhos Uber ✅
**Data: 2026-02-13**
- Endpoint: `PUT /api/ganhos-uber/{ganho_id}`
- Permite corrigir manualmente valores de portagens/gratificações

#### 4. Correcção do RPA - Seleção da Semana Correcta ✅
**Data: 2026-02-14**
- Implementada função `_formatar_data_pt()` para converter datas para formato PT
- Implementada função `_verificar_intervalo_corresponde()` para comparar intervalos de datas
- O RPA agora identifica e descarrega apenas o relatório da semana específica solicitada
- Removida a lógica problemática que clicava no primeiro download encontrado

#### 5. Prevenção de Duplicados na Importação ✅
**Data: 2026-02-14**
- Verificação por UUID do motorista Uber como prioridade
- Fallback para verificação por nome do motorista
- Update em vez de insert quando já existe registo para semana/ano/motorista

#### 6. Correcção do Cálculo do Rendimento Uber (P0) ✅
**Data: 2026-02-14**
- **Bug:** O rendimento total da Uber (uRendimento) estava a mostrar 344,63€ em vez de 266,30€
- **Causa raiz:** No ficheiro `sincronizacao.py`, linha 2951, o campo `rendimentos` estava a ser guardado com o valor de `tarifa` (359,58€) em vez de `ganho/pago_total` (281,72€)
- **Impacto:** O cálculo em `relatorios.py` usava `rendimentos` como base e subtraía portagens e gratificações: 359,58 - 13,45 - 1,50 = 344,63€ (incorreto)
- **Correção:** Alterado para usar `ganho` (pago_total) como valor de `rendimentos`: 281,72 - 13,45 - 1,50 = 266,77€ ≈ 266,30€ (correto)
- **Ficheiro corrigido:** `backend/routes/sincronizacao.py`
- **Nota:** Dados já existentes na BD precisam ser re-sincronizados para corrigir os valores

#### 7. Totais uPort e uGrat na Tabela do Resumo Semanal ✅
**Data: 2026-02-14**
- Adicionados totais de uPort (portagens Uber) e uGrat (gratificações Uber) na linha de TOTAIS da tabela
- Totais alinhados com as colunas correspondentes
- Ficheiro corrigido: `frontend/src/pages/ResumoSemanalParceiro.js`

#### 8. Correcção da Selecção de Semana na Sincronização Uber ✅
**Data: 2026-02-14**
- **Bug:** A sincronização da semana 6 usava os dados da semana 5 (fallback incorreto)
- **Causa raiz:** O scraper `platform_scrapers.py` usava o último relatório como fallback quando não encontrava o período específico
- **Correções aplicadas:**
  1. Adicionado método `_verificar_intervalo_corresponde()` para verificação robusta de datas em múltiplos formatos
  2. Adicionado método `_formatar_data_pt()` para converter datas para formato português
  3. Removido o fallback que usava o último relatório - agora só usa o relatório da semana específica
  4. Melhorada a lógica de geração de novo relatório para definir explicitamente as datas
- **Ficheiro corrigido:** `backend/integrations/platform_scrapers.py`

#### 9. Nova Lógica de Cálculo "Lucro do Parceiro" ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** O lucro do parceiro deve ser calculado de forma diferente consoante o saldo do motorista
- **Nova regra implementada:**
  - Se saldo do motorista >= 0: Lucro Parceiro = aluguer + extras
  - Se saldo do motorista < 0: Lucro Parceiro = aluguer + extras + saldo (diminuído pela dívida)
- **Alterações efectuadas:**
  1. **Frontend (`ResumoSemanalParceiro.js`):**
     - Adicionada nova coluna "Lucro Parc." na tabela de motoristas
     - Actualizada caixa "Lucro Parceiro" para mostrar a nova lógica
     - Calcula o total de lucro do parceiro somando os lucros individuais de cada motorista
  2. **Backend (`relatorios.py`):**
     - PDF geral do resumo semanal: Adicionada coluna "L.Parc." na tabela e actualizado resumo final ✅
     - PDF individual do motorista: **REMOVIDO** (ver ponto 10 abaixo)
  3. **Mensagens WhatsApp e Email (`envio_relatorios.py`):**
     - Mantidos os campos uPort, uGrat, Aluguer, Extras
     - **REMOVIDO** o campo "Lucro do Parceiro" dos relatórios enviados aos motoristas (ver ponto 10)
- **Exemplo de cálculo:**
  - Motorista com líquido = -109,89€ e aluguer = 220,00€
  - Lucro Parceiro = 220,00 + 0,00 + (-109,89) = 110,11€

#### 10. Remoção do "Lucro do Parceiro" dos Relatórios do Motorista ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** Remover o campo "Lucro do Parceiro" de todos os relatórios destinados aos motoristas
- **Alterações efectuadas:**
  1. **PDF individual do motorista (`relatorios.py` - função `generate_motorista_pdf`):**
     - Removida a linha "LUCRO DO PARCEIRO" da tabela do PDF
     - O PDF termina agora em "VALOR LÍQUIDO MOTORISTA"
  2. **Texto WhatsApp (`envio_relatorios.py` - função `generate_relatorio_motorista_text`):**
     - Não continha o campo "Lucro do Parceiro" (já estava correcto)
  3. **Email HTML (`envio_relatorios.py` - função `generate_relatorio_motorista_html`):**
     - Removida a secção "Lucro do Parceiro" do template HTML
     - Mantida apenas a secção "Saldo Motorista"
- **O que mantém o "Lucro do Parceiro":**
  - UI do parceiro (`ResumoSemanalParceiro.js`) - coluna "Lucro Parc." na tabela ✅
  - PDF geral do resumo semanal (`generate_resumo_semanal_pdf`) - coluna "L.Parc." e resumo final ✅

#### 11. Correcção da Lógica do Cartão "Motoristas" ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** Clarificar a lógica de cálculo no cartão "Motoristas":
  - **Ganhos Totais** = Soma dos líquidos **positivos** dos motoristas
  - **Dívidas** = Soma dos líquidos **negativos** (valor absoluto, com sinal negativo)
  - **Total Pagamentos** = Ganhos Totais - Dívidas - Extras
- **Alteração efectuada:**
  - **Ficheiro:** `frontend/src/pages/ResumoSemanalParceiro.js` (linhas ~1312-1362)
  - Corrigido "Total Pagamentos" que estava a SOMAR extras em vez de SUBTRAIR
  - Adicionado sinal negativo às dívidas e ao total quando negativo
- **Exemplo de cálculo (motorista com líquido -109,89€):**
  - Ganhos Totais: 0,00€ (nenhum líquido positivo)
  - Dívidas: -109,89€ (valor absoluto do líquido negativo com sinal)
  - Extras: 0,00€
  - Total Pagamentos: 0,00 - 109,89 - 0,00 = **-109,89€**
- **Teste realizado:** Screenshot confirmou os valores correctos no cartão

#### 12. Sistema de Browser Remoto para Prio (com SMS 2FA) ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** Criar sistema idêntico ao Uber para login manual na Prio (com verificação SMS)
- **Ficheiros criados:**
  - `backend/services/browser_interativo_prio.py` - Serviço de browser Playwright
  - `backend/routes/browser_prio.py` - API endpoints para browser remoto
  - `frontend/src/pages/ConfiguracaoPrioParceiro.js` - Página de configuração
- **Funcionalidades:**
  - Browser remoto com screenshots em tempo real
  - Login manual com suporte a SMS 2FA
  - Sessão guardada para extracções automáticas
  - Extracção de combustível (Excel) via menu "Transações Frota"
  - Extracção de elétrico (CSV) via menu "Transações Electric"
- **Acesso:** Menu Financeiro → Configuração Prio

#### 13. Sincronização Separada Combustível/Elétrico Prio ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** "vamos criar sistema de sincronização para cada um combustível e elétrico"
- **Implementação:**
  1. **UI com dois botões separados:**
     - "Sincronizar Combustível" (cor âmbar) - Extrai ficheiro XLS da página "Transações Frota"
     - "Sincronizar Elétrico" (cor verde) - Extrai ficheiro CSV da página "Transações Electric"
  2. **Processador de Ficheiros (`backend/services/prio_processor.py`):**
     - `processar_combustivel_xls()` - Processa ficheiros Excel de combustível
     - `processar_eletrico_csv()` - Processa ficheiros CSV de carregamentos elétricos
  3. **Armazenamento:**
     - Combustível → colecção `abastecimentos_combustivel`
     - Elétrico → colecção `despesas_combustivel`
  4. **Lógica de extracção actualizada baseada nos vídeos do utilizador:**
     - Login: `https://myprio.com/MyPrioReactiveTheme/Login`
     - Combustível: `https://myprio.com/Transactions/Transactions`
     - Elétrico: `https://myprio.com/Transactions/Transactions?tab=electric`
- **Ficheiros modificados:**
  - `backend/services/browser_interativo_prio.py` - Lógica de extracção actualizada
  - `backend/services/prio_processor.py` - NOVO processador de ficheiros
  - `backend/routes/browser_prio.py` - Endpoint de extracção com processamento
  - `frontend/src/pages/ConfiguracaoPrioParceiro.js` - UI com botões separados
- **Testes:** 100% passou (iteration_39.json)

#### 14. Sessão Persistente de 30 Dias para Prio e Uber ✅
**Data: 2026-02-14**
- **Requisito do utilizador:** "login prio fica com sessao ligada durante 30 dias nao desliga"
- **Implementação:**
  1. **Alteração de `storage_state` para `launch_persistent_context`:**
     - Anteriormente: Usava `storage_state` com ficheiro JSON em `/tmp/`
     - Agora: Usa `launch_persistent_context` com directório persistente em `/app/data/`
  2. **Directórios de sessão persistentes:**
     - Prio: `/app/data/prio_sessions/parceiro_{id}/`
     - Uber: `/app/data/uber_sessions/parceiro_{id}/`
  3. **Dados guardados automaticamente:**
     - Cookies de autenticação
     - localStorage
     - sessionStorage
     - IndexedDB
     - Cache do browser
  4. **Vantagem:** Os dados são guardados automaticamente pelo Chromium, incluindo timestamps de expiração de cookies
- **Ficheiros modificados:**
  - `backend/services/browser_interativo_prio.py` - Sessão persistente Prio
  - `backend/services/browser_interativo.py` - Sessão persistente Uber
- **Resultado:** Após login manual uma vez, a sessão é mantida até os cookies expirarem (tipicamente 30 dias)

#### 23. Sistema de Gestão de Plataformas Configurável ✅
**Data: 2026-02-16**
- **Novo sistema unificado** para gerir todas as integrações de dados (Uber, Bolt, GPS, Prio, Via Verde, etc.)
- **Categorias de plataformas:**
  - `plataforma` - Plataformas TVDE (Uber, Bolt)
  - `gps` - GPS/Tracking (Verizon, Cartrack, Radius)
  - `portagens` - Portagens (Via Verde)
  - `abastecimento` - Combustível e Elétrico (Prio, Galp, Radius Fuel)
- **Métodos de integração:**
  - `rpa` - Automação com Playwright
  - `api` - Integração via API
  - `upload_manual` - Upload de ficheiro Excel/CSV
- **Tipos de login:**
  - `manual` - Parceiro faz login manualmente (Uber, Prio)
  - `automatico` - Sistema faz login com credenciais guardadas
- **Funcionalidades Admin:**
  - Criar/editar/eliminar plataformas
  - Configurar passos RPA (login + extração)
  - Configurar mapeamento de campos para importação
  - Definir campos de credenciais por plataforma
- **9 plataformas pré-definidas** criadas via seed
- **Ficheiros criados:**
  - `backend/models/plataformas.py` - Modelos de dados
  - `backend/routes/plataformas.py` - Endpoints API
  - `frontend/src/pages/AdminPlataformas.js` - Interface de Admin
- **Acesso:** Menu Admin → Sincronização → Gestão Plataformas

#### 24. Optimização da Base de Dados MongoDB ✅
**Data: 2026-02-16**
- Criados índices para melhorar performance em:
  - `motoristas`: parceiro_id, ativo, email
  - `vehicles`: parceiro_id, matricula, ativo
  - `users`: email (único), parceiro_id, role
  - `plataformas`: categoria, ativo, nome
  - `credenciais_parceiros`: parceiro_id, plataforma_id (composto único)
  - `ganhos_bolt`: parceiro_id, motorista_id, data
  - `relatorios_semanais`: parceiro_id, motorista_id, semana

#### 25. Limpeza e Refatoração do Projecto ✅
**Data: 2026-02-16**
- **Espaço recuperado:** ~400 MB
- **Cache Python** limpo em todo o projecto
- **Screenshots RPA/Debug** removidos
- **Ficheiros .bak** removidos
- **Ficheiros de teste** organizados em `/app/tests/`
- **Sessões WhatsApp antigas** removidas
- **Cache de browser** limpo (Prio + WhatsApp)
- **Ficheiros temporários** (+30 dias) removidos
- **Logs antigos** (+7 dias) removidos

### Funcionalidades Pendentes

#### Sistema de Sincronização Dinâmica (P0 - Em Progresso)
- Criar serviço que lê a configuração da plataforma e executa sincronização dinamicamente
- Refatorar menu de sincronização do parceiro para usar plataformas configuradas

#### Alertas Avançados (P1)
- Notificações por Email/SMS/Push
- Requer integração com serviço de terceiros

#### Comissões Avançadas (P1)
- Bónus de performance
- Relatórios detalhados

#### UI de Downgrade (P1)
- Interface para solicitar downgrade de plano

### Backlog (P2)

#### Refatoração Frontend (Componentes Criados mas Não Integrados)
Os componentes foram extraídos mas ainda não estão a ser usados nos ficheiros principais:

**FichaVeiculo.js** (6055 linhas)
- Componentes em `/app/frontend/src/pages/FichaVeiculo/components/`
- VeiculoSeguroTab.js, VeiculoInspecaoTab.js, VeiculoExtintorTab.js, etc.

**AdminGestaoPlanos.js** (3032 linhas)
- Componentes em `/app/frontend/src/pages/Admin/GestaoPlanos/components/`
- PlanosTab.js, CategoriasTab.js, ModulosTab.js, etc.

**FichaMotorista.js** (2668 linhas)
- Componentes em `/app/frontend/src/pages/FichaMotorista/components/`
- MotoristaDadosPessoaisTab.js, MotoristaFinanceiroTab.js, etc.

## Arquitectura Técnica

### Stack
- Backend: FastAPI (Python)
- Frontend: React.js com Vite
- Database: MongoDB
- UI: Shadcn/UI
- Automação: Playwright

### Ficheiros Chave
- `backend/services/rpa_uber.py`: Lógica RPA para Uber (corrigido 2026-02-14)
- `backend/routes/sincronizacao.py`: Endpoints de sincronização (corrigido 2026-02-14)
- `backend/routes/ganhos_uber_manual.py`: Edição manual de ganhos
- `backend/routes/relatorios.py`: Relatórios e resumos semanais
- `backend/routes/plataformas.py`: Gestão de plataformas e integrações (novo 2026-02-16)
- `backend/models/plataformas.py`: Modelos de dados de plataformas (novo 2026-02-16)
- `frontend/src/pages/ResumoSemanalParceiro.js`: UI do resumo semanal
- `frontend/src/pages/AdminPlataformas.js`: Gestão de plataformas Admin (novo 2026-02-16)

### Schema MongoDB (ganhos_uber)
```json
{
  "id": "uuid",
  "parceiro_id": "uuid",
  "uuid_motorista_uber": "uuid",
  "nome_motorista": "string",
  "semana": "int",
  "ano": "int",
  "data_inicio": "date",
  "data_fim": "date",
  "pago_total": "float",
  "tarifa": "float",
  "gratificacao": "float",
  "portagens": "float",
  "taxa_servico": "float",
  "fonte": "csv_rpa|rpa_uber|manual",
  "execucao_id": "uuid",
  "importado_em": "datetime"
}
```

### Endpoints API Principais
- `POST /api/uber/sincronizar-csv` - Sincronização automática via CSV
- `POST /api/uber/executar-rpa` - RPA antigo (scraping UI)
- `GET /api/uber/execucoes` - Histórico de execuções
- `PUT /api/ganhos-uber/{ganho_id}` - Edição manual
- `GET /api/relatorios/parceiro/resumo-semanal` - Resumo semanal

## Integrações

### Uber Supplier Portal
- URL: https://supplier.uber.com
- Autenticação: Email/Password com possível 2FA (SMS)
- Método: RPA com Playwright
- Dados extraídos: Relatório CSV de pagamentos

### Credenciais de Teste
- Email: tsacamalda@gmail.com
- Sistema: TVDEFleet

---

## Changelog Recente

### 2026-02-16: Melhoria na Verificação de Sessão Prio ✅

**Problema Reportado:** O utilizador precisava fazer login na Prio após cada sincronização, mesmo com sessão persistente configurada.

**Investigação:** 
- A sessão da Prio tinha realmente expirado (o portal redirecionou para login)
- O sistema de verificação confiava no estado guardado por demasiado tempo (24h) sem verificar activamente

**Melhorias Implementadas:**

1. **Verificação Activa de Sessão** (`browser_interativo_prio.py`):
   - Novo método `_verificar_e_restaurar_sessao()` que navega para página protegida
   - Novo método `refrescar_sessao()` para manter sessão activa
   - Parâmetro `verificar_sessao` no `get_browser_prio()`

2. **Endpoints Melhorados** (`routes/browser_prio.py`):
   - `GET /api/prio/sessao` agora faz verificação activa se última verificação > 60 min
   - `POST /api/prio/sessao/verificar-activa` - verificação sob demanda
   - `POST /api/prio/sessao/refrescar` - refrescar sessão manualmente

3. **UI Melhorada**:
   - Banner de aviso "Não tem sessão Prio activa" agora aparece correctamente
   - Toast com botão "Ir para Login Prio" quando sincronização falha

**Resultado:**
- ✅ Sistema verifica activamente se sessão está válida antes de sincronizar
- ✅ Alerta visual claro quando sessão expirou
- ✅ Botões de acção para renovar sessão facilmente

**Nota Importante:** A sessão da Prio pode expirar naturalmente pelo portal (timeout por inactividade). Quando isso acontece, o utilizador precisa fazer login novamente na página "Configuração Prio".

### 2026-02-15: Correção Sincronização Prio Combustível ✅

**Problema:** O botão "Sincronizar Prio Combustível" no Resumo Semanal não funcionava.

**Causa Raiz:** Incompatibilidade de versão do Playwright browser:
- O Playwright procurava: `/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
- Browser instalado: `/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell`

**Solução Aplicada:** Criação de symlink:
```bash
ln -sf /pw-browsers/chromium_headless_shell-1208 /pw-browsers/chromium_headless_shell-1194
```

**Resultado:** O fluxo de sincronização da Prio está operacional:
1. ✅ Botão "Sincronizar Prio Combustível" funciona
2. ✅ Verifica sessão da Prio correctamente
3. ✅ Mostra mensagem com botão para login se sessão expirada
4. ✅ Extracção de dados funciona quando sessão está activa

### 2026-02-15: Alerta Automático de Expiração da Sessão Prio ✅

**Funcionalidade:** Sistema de notificação automática quando a sessão Prio está prestes a expirar.

**Implementação:**
1. **Backend (`routes/browser_prio.py`):**
   - Novo endpoint `GET /api/prio/sessao/status-completo` com informações detalhadas
   - Função `_calcular_dias_restantes()` para calcular tempo até expiração
   - Retorna `alerta` com severidade (error/warning/info) baseado nos dias restantes

2. **Frontend (`ResumoSemanalParceiro.js`):**
   - Hook `useEffect` para verificar estado da sessão ao carregar a página
   - Banner de alerta visual quando sessão está prestes a expirar (≤3 dias) ou expirada
   - Botão "Renovar Sessão Prio" que navega para `/configuracao-prio`

**Regras de Alerta:**
- 0 dias: Alerta vermelho "Sessão expirada!"
- 1-3 dias: Alerta laranja "Sessão expira em X dias!"
- 4-7 dias: Info discreta (sem banner)
- >7 dias: Sem alerta

### 2026-02-16: Browser Virtual Embutido para RPA Admin ✅

**Funcionalidade:** O administrador pode agora usar um browser virtual embutido directamente na interface de Gestão de Plataformas para gravar e testar passos de automação RPA.

**Implementação:**

1. **Backend (`routes/browser_virtual_admin.py`):**
   - `POST /api/admin/browser-virtual/sessao/iniciar` - Inicia sessão Playwright
   - `DELETE /api/admin/browser-virtual/sessao/{id}` - Termina sessão
   - `GET /api/admin/browser-virtual/sessao/{id}/screenshot` - Captura screenshot
   - `POST /api/admin/browser-virtual/sessao/{id}/acao` - Executa acção (click, type, scroll)
   - `POST /api/admin/browser-virtual/sessao/{id}/gravar` - Toggle gravação
   - `POST /api/admin/browser-virtual/sessao/{id}/passos/guardar` - Guarda passos na plataforma
   - `GET /api/admin/browser-virtual/sessoes` - Lista sessões activas
   - `GET /api/admin/browser-virtual/rascunho/{plataforma_id}` - Obtém rascunho auto-guardado
   - `DELETE /api/admin/browser-virtual/rascunho/{plataforma_id}` - Limpa rascunho
   - WebSocket para comunicação em tempo real

2. **Frontend (`components/admin/BrowserVirtualEmbutido.jsx`):**
   - Visualização de screenshot em tempo real
   - Barra de URL com estado de conexão
   - Input de texto com botão Enviar
   - Botões de controlo: Enter, Tab, Scroll (cima/baixo), Espera
   - Toggle de gravação com indicador visual
   - Painel lateral "Passos Gravados" com contador
   - Botões para guardar como Login ou Extração
   - Botão Terminar para fechar sessão
   - **Badge "Auto-save"** quando há passos gravados
   - **Mensagem de recuperação** quando rascunho é carregado

3. **Integração (`pages/AdminPlataformas.js`):**
   - Nova tab "Testar" no modal de edição de plataformas
   - Resumo da configuração (passos login, extração, 2FA)
   - Opção "Browser Embutido" - abre o browser na mesma página
   - Opção "RPA Designer" - abre em nova janela

4. **Auto-save de Passos RPA:**
   - Passos são guardados automaticamente na colecção `rpa_rascunhos` a cada acção
   - Rascunho persiste mesmo quando sessão é terminada ou browser fechado
   - Ao iniciar nova sessão, passos anteriores são recuperados automaticamente
   - Toast de notificação com opção de limpar quando rascunho é recuperado
   - Rascunho é limpo automaticamente ao guardar passos definitivamente

5. **Replay de Passos (Testar Automação):**
   - Botão "Testar Replay" executa todos os passos gravados em sequência
   - Mostra resultado: passos OK vs passos com erro
   - Permite verificar se a automação funciona antes de guardar definitivamente
   - Badge verde/vermelho indica sucesso ou falha do replay

**Acesso:** Admin > Plataformas > Editar qualquer plataforma RPA > Tab "Testar"

**Nota:** O WebSocket pode não funcionar através do proxy Cloudflare. A API REST funciona como fallback fiável para todas as operações.

---

## Backlog

### P0 - Concluído ✅
1. ~~**Implementar Serviço de Execução RPA Dinâmico**~~ - Já existe em `services/rpa_dinamico.py`
   - Classe `RPADinamicoExecutor` com login, extração, datas dinâmicas
   - Endpoint `POST /api/plataformas/sincronizar` executa em background

2. ~~**Seletor de Credenciais de Parceiro no Browser Virtual**~~ (2026-02-16)
   - O browser NÃO inicia automaticamente quando há parceiros disponíveis
   - Mostrada UI para selecionar parceiro com credenciais antes de iniciar
   - Botão "Iniciar Browser" controla o arranque manual
   - **Botões "Inserir Email" e "Inserir Password"** - Inserem credenciais no browser sem as expor ao admin
   - Gravação usa REST API (fallback quando WebSocket bloqueado)
   - Botões de controlo têm texto branco legível
   - Novos endpoints: `POST /api/admin/browser-virtual/sessao/{id}/inserir-credencial`, `GET /api/admin/browser-virtual/sessao/{id}/tem-credenciais`

### P1 - Próximas Tarefas
1. **Alertas Avançados:** Implementar notificações por Email/SMS/Push na página de alertas.
2. **Comissões Avançadas:** Expandir a página de comissões com bónus e relatórios.
3. **UI de Downgrade:** Criar interface para solicitar downgrade do plano.
4. **Refatorar página de sincronização do Parceiro** - Gerar botões dinamicamente com base nas plataformas activas

### P2 - Futuro
1. **Refatoração dos "God Components":** FichaVeiculo.js, AdminGestaoPlanos.js, FichaMotorista.js
2. **Filtro de datas do portal Prio:** O portal Prio não filtra correctamente por datas. A mitigação actual (filtrar no backend após download) funciona.

#### 18. Múltiplos Cartões Elétricos - 5 Fornecedores ✅
**Data: 2026-02-18**
- Adicionados campos para 5 fornecedores de carregamento elétrico:
  - Prio Electric (`cartao_prio_eletric`)
  - Mio (`cartao_mio`)
  - Galp (`cartao_galp`)
  - Atlante (`cartao_atlante`)
  - Outro (`cartao_eletrico_outro` + `cartao_eletrico_outro_nome`)
- Backend soma automaticamente todos os carregamentos na coluna "carregamento_eletrico"
- Discriminação por fornecedor disponível em `carregamentos_discriminacao`
- UI atualizada na ficha do veículo com campos para cada fornecedor

#### 19. Bloquear/Desbloquear Utilizadores - Permissões Expandidas ✅
**Data: 2026-02-18**
- Admin pode bloquear/desbloquear qualquer utilizador
- Gestor pode bloquear/desbloquear parceiros e motoristas
- Parceiro pode bloquear/desbloquear motoristas associados a si
- Utilizador bloqueado não consegue fazer login
- Endpoint: `PUT /api/users/{user_id}/status`

#### 20. Sistema de Tickets Melhorado ✅
**Data: 2026-02-18**
- Associação de tickets a veículos específicos (`veiculo_id`, `veiculo_info`)
- Associação de tickets a motoristas específicos (`motorista_id`, `motorista_info`)
- Novas categorias: revisão, multas, seguro, manutenção
- Novos endpoints:
  - `GET /api/tickets/por-veiculo/{veiculo_id}`
  - `GET /api/tickets/por-motorista/{motorista_id}`
  - `GET /api/tickets/categorias`
- Destinatário pode ser especificado com `destinatario_id`

### Backups Disponíveis
- `/api/download-backup-completo` - Backup MongoDB (2.3 MB, 127 coleções)
- `/api/download-backup-v2` - Backup com novas funcionalidades

#### 21. Interface de Backup Completo para Admin ✅
**Data: 2026-02-18**
- **Nova página:** `/admin/backup` (`BackupAdmin.js`)
- **Funcionalidades implementadas:**
  1. **Backup Completo:** Exporta todas as 125+ coleções da base de dados num único ficheiro JSON
  2. **Backup Parcial por Categoria:** 11 categorias disponíveis (Utilizadores, Veículos, Contratos, RPA, Financeiro, Via Verde, Uber/Bolt, Relatórios, Configurações, Tickets, Planos)
  3. **Estatísticas da Base de Dados:** Mostra total de coleções e documentos
  4. **Tabela de Coleções:** Lista detalhada de cada coleção com número de documentos
  5. **Histórico de Backups:** Registo de todos os backups realizados
  6. **Importação de Backup:** Permite restaurar dados com opção de adicionar ou substituir
- **Acesso:** Menu Admin → Sistema → 💾 Backup Completo
- **Endpoints utilizados:**
  - `GET /api/backup/completo` - Exporta backup completo
  - `GET /api/backup/parcial/{categoria}` - Exporta por categoria
  - `GET /api/backup/colecoes` - Lista estatísticas das coleções
  - `GET /api/backup/historico` - Lista histórico de backups
  - `POST /api/backup/importar` - Importa backup

### Próximos Passos
1. Importar backup para deploy de produção (tvdefleet.com)
2. Criar Frontend para Exportação/Importação de configurações RPA individuais
3. Integração com WhatsApp (P2)

#### 22. Melhorias na Página de Anúncios de Veículos ✅
**Data: 2026-02-18**
- **Carrossel de Fotos:** Até 3 fotos por veículo com navegação por setas e indicadores
- **Transmissão:** Mostra se é Manual ou Automático (campo `caixa`)
- **Versão:** Mostra a versão do veículo quando disponível
- **UI melhorada:** Cards mais informativos e compactos

#### 23. Sistema de Gestão de Km dos Veículos ✅
**Data: 2026-02-18**
- **Novo campo:** `km_inicial` para gestão própria do parceiro
- **Novo endpoint:** `PUT /api/vehicles/{id}/atualizar-km`
  - Fontes: manual, gps, inspecao, revisao, manutencao, vistoria
  - Regista histórico na coleção `historico_km`
  - Sincroniza com manutenção quando fonte é revisão/manutenção
  - Cria alertas quando km ultrapassa próxima revisão

#### 24. Permissões de Dashboard Melhoradas ✅
**Data: 2026-02-18**
- **Parceiro:** Vê apenas os seus dados (veículos, motoristas, receitas)
- **Gestor:** Vê apenas parceiros atribuídos, pode filtrar individualmente
- **Admin:** Vê tudo, pode filtrar por parceiro
- Endpoint atualizado: `GET /api/reports/dashboard?parceiro_id=xxx`

#### 25. Bloquear Motoristas ✅
**Data: 2026-02-18**
- **Novo endpoint:** `PUT /api/motoristas/{id}/bloquear`
- **Permissões:**
  - Admin: pode bloquear qualquer motorista
  - Gestor: pode bloquear motoristas dos parceiros atribuídos
  - Parceiro: pode bloquear os seus próprios motoristas
- Campos: `bloqueado`, `bloqueado_em`, `bloqueado_por`, `motivo_bloqueio`

#### 26. Correção de Fotos de Veículos ✅
**Data: 2026-02-18**
- **Problema:** Fotos não apareciam porque `/uploads/` não era encaminhado para o backend
- **Solução:** Adicionado mount `/api/uploads` no backend
- **Endpoints de manutenção:**
  - `POST /api/admin/corrigir-caminhos-fotos` - Corrige paths sem `/` inicial
  - `POST /api/admin/reindexar-fotos-veiculos` - Reindexa fotos válidas do filesystem



#### 27. Sistema de Empresas de Faturação ✅
**Data: 2026-02-18**
- **Funcionalidade:** Permite que parceiros definam múltiplas entidades para emissão de recibos
- **Backend CRUD completo:**
  - `GET /api/empresas-faturacao/` - Listar empresas (parceiro vê as suas, admin vê todas)
  - `POST /api/empresas-faturacao/` - Criar nova empresa com validação NIPC (9 dígitos)
  - `GET /api/empresas-faturacao/{id}` - Obter detalhes de uma empresa
  - `PUT /api/empresas-faturacao/{id}` - Atualizar empresa, definir como principal
  - `DELETE /api/empresas-faturacao/{id}` - Eliminar empresa (só se sem recibos associados)
  - `GET /api/empresas-faturacao/dashboard/totais-ano` - Dashboard de totais anuais por empresa
- **Frontend:**
  - Nova página `/empresas-faturacao` com tabela, modal de criar/editar/eliminar
  - Badge "Principal" para empresa por defeito
  - Menu acessível: User Menu → Empresas de Faturação
- **Integração com Upload de Recibos:**
  - No Resumo Semanal, ao mudar status para "Aguardar Recibo", abre dialog com seletor de empresa
  - Upload de recibo guarda `empresa_faturacao_id` e `empresa_faturacao_info` em `status_relatorios`
- **Schema MongoDB (empresas_faturacao):**
  ```json
  {
    "id": "uuid",
    "parceiro_id": "uuid",
    "nome": "Nome da Empresa Lda",
    "nipc": "123456789",
    "morada": "string",
    "codigo_postal": "0000-000",
    "cidade": "string",
    "email": "string",
    "telefone": "string",
    "iban": "string",
    "ativa": true,
    "principal": false,
    "created_at": "datetime",
    "created_by": "uuid"
  }
  ```

#### 28. Dashboard de Faturação Anual ✅
**Data: 2026-02-18**
- **Funcionalidade:** Dashboard visual com gráficos de receitas por empresa de faturação ao longo do ano
- **Nova página:** `/dashboard-faturacao` (`DashboardFaturacao.js`)
- **Funcionalidades:**
  1. **Seletor de Ano:** Navegação entre anos com setas
  2. **Cards de Resumo:** Total Faturado, Total Recibos, Empresas Ativas (com gradientes coloridos)
  3. **Gráfico de Barras:** Faturação por empresa com tooltip interativo
  4. **Gráfico de Pizza:** Distribuição de receitas em percentagem
  5. **Tabela Detalhada:** Empresa, NIPC, Total Faturado, Recibos, Média/Recibo, % do Total
  6. **Botão "Gerir Empresas":** Navegação rápida para gestão de empresas
- **Biblioteca de gráficos:** Recharts (instalado)
- **Menu acessível:** User Menu → Dashboard Faturação (ícone TrendingUp)

