# Guia de Relatórios e Sincronização - TVDEFleet

## 📊 1. COMO ENVIAR RELATÓRIO PARA MOTORISTAS?

### Estado Atual
Atualmente, a funcionalidade de envio de relatórios **está MOCKADA** (simulada). O sistema tem a estrutura pronta mas não envia de facto emails ou WhatsApp.

### O que existe:
- ✅ Página de Gestão de Pagamentos e Recibos (`/gestao-pagamentos-recibos`)
- ✅ Botão "Enviado" que regista o histórico de envio
- ✅ Geração de PDFs de exemplo
- ❌ **Envio real por Email/WhatsApp NÃO implementado**

### Como funciona atualmente:
1. Na página de Gestão de Pagamentos e Recibos
2. Clica no botão "Ver" para visualizar o relatório
3. Clica no botão "Enviado" para registar que foi enviado
4. O sistema guarda o histórico, mas **não envia automaticamente**

### Para implementar o envio REAL:

#### Opção A: Email com SendGrid/AWS SES
```python
# Necessário:
- API Key do SendGrid ou AWS SES
- Configuração SMTP
- Template de email
```

#### Opção B: WhatsApp com Twilio/WhatsApp Business API
```python
# Necessário:
- Conta Twilio com WhatsApp habilitado
- Número de WhatsApp Business verificado
- API Key da Twilio
```

---

## 🔄 2. SINCRONIZAÇÃO COM BOLT - COMO TESTAR?

### Estado Atual da Integração Bolt
O sistema tem **suporte parcial** para Bolt:

#### O que está implementado:
- ✅ Modelo de dados para ganhos Bolt (`GanhoBolt`)
- ✅ Campos no cadastro de motoristas para credenciais Bolt
- ✅ Sistema de credenciais de plataforma
- ✅ Estrutura de sincronização automática

#### O que NÃO está implementado:
- ❌ **Scraping/API real da Bolt**
- ❌ Extração automática de dados da plataforma Bolt
- ❌ Parser de CSV/Excel da Bolt

### Como Sincronizar Dados da Bolt (Manualmente):

#### Método 1: Import Manual de CSV
1. Aceder à plataforma Bolt Partner
2. Fazer download do relatório de ganhos (CSV/Excel)
3. No sistema TVDEFleet:
   - Ir para Gestão de Motoristas
   - Selecionar motorista
   - Fazer upload do ficheiro Bolt

**Nota:** Esta funcionalidade precisa ser verificada/implementada

#### Método 2: Configurar Credenciais de Plataforma
1. Ir para Configuração de Sincronização
2. Adicionar credenciais Bolt para cada parceiro
3. Clicar em "Forçar Sincronização"

**Aviso:** A sincronização automática da Bolt requer:
- Credenciais de acesso à plataforma Bolt Partner
- Implementação de scraping ou acesso à API oficial

---

## 📅 3. QUANDO OS DADOS SÃO EXTRAÍDOS?

### Sistema de Sincronização Automática

#### Configuração Atual:
A página **Configuração de Sincronização** permite definir:
- **Dia da semana** para sincronização automática
- **Hora:** 00:00 (meia-noite) por padrão
- **Frequência:** Semanal

#### Fluxo de Extração:

```
┌─────────────────────────────────────┐
│ 1. Agendamento Configurado          │
│    - Dia: Segunda-feira (exemplo)   │
│    - Hora: 00:00                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Sistema Executa Sincronização    │
│    - Acede à plataforma externa     │
│    - Faz download dos dados         │
│    - Guarda ficheiro temporário     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Processamento de Dados           │
│    - Parse do CSV/Excel             │
│    - Validação de dados             │
│    - Cálculo de ganhos              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Armazenamento                    │
│    - Guarda na base de dados        │
│    - Cria registos de pagamentos    │
│    - Atualiza dashboard             │
└─────────────────────────────────────┘
```

### Sincronização Manual (Disponível Agora):
1. Ir para `/configuracao-sincronizacao`
2. Clicar em **"Forçar Agora"** para qualquer parceiro
3. O sistema executa sincronização imediata

**Nota:** A sincronização atualmente é **simulada** - não extrai dados reais de plataformas externas.

---

## 🔧 FUNCIONALIDADES QUE PRECISAM DE IMPLEMENTAÇÃO COMPLETA

### Alta Prioridade (P0):
1. **Envio Real de Relatórios por Email/WhatsApp**
   - Integração com provedor de email (SendGrid/AWS SES)
   - Integração com WhatsApp (Twilio)
   - Templates de mensagem

2. **Sincronização Real com Bolt**
   - Scraping da plataforma Bolt Partner
   - Ou integração via API oficial (se disponível)
   - Parser de ficheiros Bolt

3. **Extração Automática de Dados**
   - Implementar scraping/API para Uber
   - Implementar scraping/API para Bolt
   - Sistema de retry em caso de falha

### Média Prioridade (P1):
4. **Geração Real de PDFs de Relatórios**
   - Templates profissionais
   - Dados reais dos ganhos
   - Breakdown detalhado

5. **Sistema de Notificações**
   - Alertas quando sincronização falha
   - Notificações de novos relatórios
   - Emails de confirmação de pagamento

---

## 🧪 COMO TESTAR AS FUNCIONALIDADES ATUAIS

### Teste 1: Gestão de Pagamentos e Recibos
```bash
# Login como admin
Email: admin@tvdefleet.com
Password: o72ocUHy

# Navegação:
Dashboard → Financeiro → Gestão de Pagamentos e Recibos

# Verificar:
- ✅ 12 registos de exemplo visíveis
- ✅ Filtros funcionais
- ✅ Botões de ação (Ver, Enviado, Pagar)
```

### Teste 2: Configuração de Sincronização
```bash
# Navegação:
Dashboard → Configuração de Sincronização

# Testar:
1. Selecionar dia da semana
2. Clicar "Forçar Agora"
3. Verificar mensagem de sucesso
4. Verificar "Última sincronização" atualizada
```

### Teste 3: Credenciais de Parceiros
```bash
# Navegação (apenas admin):
Dashboard → Credenciais dos Parceiros

# Verificar:
- ✅ Lista de parceiros
- ✅ Emails visíveis
- ✅ Passwords encriptadas
- ✅ Referência ao CREDENCIAIS_TESTE.md
```

---

## 📋 PRÓXIMOS PASSOS RECOMENDADOS

### Curto Prazo:
1. Decidir sobre integração de email/WhatsApp
2. Obter credenciais necessárias (API keys)
3. Testar sincronização com Bolt manualmente

### Médio Prazo:
1. Implementar envio real de relatórios
2. Implementar scraping/API da Bolt
3. Testar fluxo completo ponta-a-ponta

### Longo Prazo:
1. Adicionar mais plataformas (Uber, outros)
2. Dashboard de analytics
3. Relatórios avançados com gráficos

---

## ❓ DÚVIDAS COMUNS

**Q: Posso enviar relatórios agora?**
A: Sim, mas terá de fazer manualmente. O sistema regista o histórico mas não envia automaticamente.

**Q: A sincronização com Bolt funciona?**
A: A estrutura existe, mas a extração real de dados não está implementada. Precisa de configurar scraping ou API.

**Q: Com que frequência os dados são extraídos?**
A: Pode configurar para qualquer dia da semana às 00:00, ou forçar manualmente a qualquer momento.

**Q: Como adiciono credenciais da Bolt?**
A: Atualmente não há interface para isso. Precisa ser implementado um módulo de gestão de credenciais de plataforma.

---

**Última Atualização:** 10/12/2025
**Versão do Sistema:** 1.0
