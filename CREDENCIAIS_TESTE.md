# Credenciais de Teste - TVDEFleet

## 👤 Usuários Disponíveis

### 1. 👨‍💼 ADMIN
- **Email:** `admin@tvdefleet.com`
- **Senha:** `o72ocUHy`
- **Role:** `admin`
- **Nome:** Admin TVDEFleet
- **Permissões:** Acesso total ao sistema

---

### 2. 🏢 GESTOR
- **Email:** `gestor@tvdefleet.com`
- **Senha:** `OrR44xJ1`
- **Role:** `gestao`
- **Nome:** João Silva - Gestor
- **Permissões:** Gerir múltiplos parceiros, aprovar documentos

---

### 3. 🏪 PARCEIRO
- **Email:** `parceiro@tvdefleet.com`
- **Senha:** `UQ1B6DXU`
- **Role:** `parceiro`
- **Nome:** Maria Santos - Parceira
- **Permissões:** Gerir veículos e motoristas associados

---

### 4. 🔧 OPERACIONAL
- **Email:** `operacional@tvdefleet.com`
- **Senha:** `rn8rYw7E`
- **Role:** `operacional`
- **Nome:** Pedro Costa - Operacional
- **Permissões:** Gestão de frota própria

---

### 5. 🚗 MOTORISTA
- **Email:** `motorista@tvdefleet.com`
- **Senha:** `2rEFuwQO`
- **Role:** `motorista`
- **Nome:** Carlos Oliveira - Motorista
- **Permissões:** Ver seus ganhos, enviar recibos

---

## 🔐 Notas de Segurança

⚠️ **IMPORTANTE:** Estas são credenciais de teste/desenvolvimento. 
- Não usar em produção
- Alterar senhas antes de deploy
- Implementar política de senhas fortes

## 🧪 Como Testar

### Login via Frontend
```
1. Acesse: https://driver-platform-ids.preview.emergentagent.com/login
2. Use qualquer credencial acima
3. Navegue conforme as permissões do role
```

### Login via API
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "motorista@tvdefleet.com",
    "password": "2rEFuwQO"
  }'
```

## 📋 Funcionalidades por Role

### ADMIN
- ✅ Gestão completa de usuários
- ✅ Gestão de parceiros
- ✅ Gestão de veículos
- ✅ Configuração de planos de assinatura
- ✅ Verificação de recibos
- ✅ Relatórios financeiros

### GESTOR (gestao)
- ✅ Gerir múltiplos parceiros
- ✅ Aprovar documentos
- ✅ Ver relatórios de todos os parceiros
- ✅ Verificar recibos

### PARCEIRO
- ✅ Gerir seus veículos
- ✅ Gerir seus motoristas
- ✅ Ver alertas e manutenções
- ✅ Dashboard do parceiro

### OPERACIONAL
- ✅ Gestão de frota própria
- ✅ Ver relatórios dos seus veículos
- ✅ Adicionar despesas/receitas

### MOTORISTA
- ✅ Ver seus ganhos
- ✅ Enviar recibos
- ✅ Ver histórico de pagamentos
- ✅ Atualizar dados pessoais

---

**Gerado em:** 2025-11-26
**Sistema:** TVDEFleet v1.0
