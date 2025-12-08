# 🔧 Como Ativar e Testar Módulos do Parceiro

## ✅ MÓDULOS JÁ ATIVADOS PARA O PARCEIRO DE TESTE

O parceiro `parceiro@tvdefleet.com` (ID: `parceiro-001`) já tem **TODOS os 7 módulos ativados**:

1. ✅ `gestao_eventos_veiculo` - Editar agenda de veículos
2. ✅ `gestao_contratos` - Criar contratos
3. ✅ `relatorios_avancados` - Relatórios detalhados
4. ✅ `gestao_documentos` - Upload de documentos
5. ✅ `acesso_vistorias` - Criar vistorias
6. ✅ `moloni_auto_faturacao` - Integração Moloni
7. ✅ `configuracao_templates` - Templates personalizados

---

## 🎯 Como Ativar Módulos para Outros Parceiros

### Método 1: Via Interface Admin (UI)

1. **Login como Admin**
   - Email: `admin@tvdefleet.com`
   - Password: `o72ocUHy`

2. **Navegar para Gestão de Módulos**
   - Menu → "Parceiros" → Ver lista
   - OU acessar: `/parceiros/modulos`

3. **Selecionar Parceiro**
   - Clicar em "Gerenciar Módulos" no card do parceiro

4. **Ativar Módulos**
   - Ligar os switches dos módulos desejados
   - Clicar em "Salvar Módulos"

### Método 2: Via API (Backend)

```bash
# 1. Login como Admin
TOKEN=$(curl -s -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tvdefleet.com","password":"o72ocUHy"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Atribuir módulos ao parceiro (substitua PARCEIRO_ID)
curl -X POST "http://localhost:8001/api/users/PARCEIRO_ID/modulos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "modulos_ativos": [
      "gestao_eventos_veiculo",
      "gestao_contratos",
      "relatorios_avancados",
      "gestao_documentos",
      "acesso_vistorias",
      "moloni_auto_faturacao",
      "configuracao_templates"
    ]
  }'
```

### Método 3: Via Planos (Recomendado para Produção)

1. **Criar Plano com Módulos**
   - Login como Admin
   - Menu → "Planos" → `/planos-parceiros`
   - Clicar em "Criar Plano"
   - Dar nome (ex: "Premium")
   - Selecionar módulos desejados
   - Definir tipo de cobrança
   - Salvar

2. **Atribuir Plano ao Parceiro**
   - Menu → "Utilizadores" → `/utilizadores`
   - Encontrar o parceiro
   - Clicar em "Alterar Plano"
   - Selecionar o plano criado
   - Salvar

---

## 🧪 Como Testar se Módulos Estão Ativos

### Teste 1: Verificar via API

```bash
# Login como Parceiro
TOKEN=$(curl -s -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"parceiro@tvdefleet.com","password":"UQ1B6DXU"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Ver módulos ativos
curl -X GET "http://localhost:8001/api/users/parceiro-001/modulos" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Verificar módulo específico
curl -X GET "http://localhost:8001/api/users/parceiro-001/verificar-modulo/gestao_eventos_veiculo" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Teste 2: Verificar no Frontend

#### A) Ver Módulos no Perfil
1. Login como Parceiro
2. Ir para `/profile`
3. Verificar card "Módulos Ativos" no topo
4. Deve mostrar badges verdes com os 7 módulos

#### B) Testar Edição de Agenda (módulo `gestao_eventos_veiculo`)
1. Login como Parceiro
2. Menu → "Veículos"
3. Clicar em qualquer veículo
4. Scroll até "Agenda e Eventos"
5. **SE MÓDULO ATIVO:**
   - Botões "Edit" (lápis) aparecem em cada evento
   - Botões "Trash" (lixo) aparecem em cada evento
   - Pode adicionar novos eventos
6. **SE MÓDULO INATIVO:**
   - Botões NÃO aparecem
   - Apenas visualização

#### C) Testar Criação de Contratos (módulo `gestao_contratos`)
1. Login como Parceiro
2. Menu → "Contratos"
3. Tab "Gerar Contrato"
4. **SE MÓDULO ATIVO:**
   - Formulário completo aparece
   - Pode criar contratos
5. **SE MÓDULO INATIVO:**
   - Mensagem de acesso negado

#### D) Testar Templates (módulo `configuracao_templates`)
1. Login como Parceiro
2. Menu → "Contratos" → Tab "Templates"
3. **SE MÓDULO ATIVO:**
   - Botão "Criar Template de Contrato" aparece (verde)
   - Pode criar/editar templates
5. **SE MÓDULO INATIVO:**
   - Botão não aparece ou desativado

---

## 🎯 Checklist de Verificação

### Para cada módulo, verificar:

- [ ] **gestao_eventos_veiculo**
  - [ ] Botões Edit/Trash na agenda do veículo
  - [ ] Pode adicionar/editar/remover eventos
  
- [ ] **gestao_contratos**
  - [ ] Tab "Gerar Contrato" acessível
  - [ ] Pode criar contratos para motoristas
  
- [ ] **relatorios_avancados**
  - [ ] Menu "Relatórios" acessível
  - [ ] Pode ver relatórios detalhados
  
- [ ] **gestao_documentos**
  - [ ] Pode fazer upload de documentos
  - [ ] Acesso à gestão de docs
  
- [ ] **acesso_vistorias**
  - [ ] Menu "Vistorias" acessível
  - [ ] Pode criar/ver vistorias
  
- [ ] **moloni_auto_faturacao**
  - [ ] Tab "Auto-Faturação" no perfil motorista
  - [ ] Pode configurar credenciais Moloni
  
- [ ] **configuracao_templates**
  - [ ] Botão "Criar Template" aparece
  - [ ] Pode criar/editar templates

---

## 🐛 Troubleshooting

### Problema: "Módulo não aparece ativo no frontend"

**Solução:**
1. Verificar na API se módulo está realmente ativo (ver comando acima)
2. Limpar cache do browser (Ctrl+Shift+R)
3. Fazer logout e login novamente
4. Verificar console do browser (F12) por erros

### Problema: "Botões de edição não aparecem"

**Causas possíveis:**
1. Módulo não está ativo → Verificar via API
2. Parceiro não tem veículos → Criar veículo de teste
3. Cache do browser → Limpar e recarregar
4. Erro no componente → Verificar console (F12)

### Problema: "Access Denied ao tentar usar funcionalidade"

**Solução:**
1. Verificar se módulo está ativo via API
2. Verificar se status é "ativo" (não "expirado" ou "cancelado")
3. Verificar logs do backend: `tail -f /var/log/supervisor/backend.*.log`

---

## 📝 Notas Importantes

1. **Módulos são verificados em tempo real** - Não precisa reiniciar nada
2. **Alterações via UI Admin são imediatas** - Salvou, já está ativo
3. **Parceiro vê apenas seus dados** - Filtros automáticos por `parceiro_id`
4. **Admin pode ativar/desativar a qualquer momento** - Controle total

---

## ✅ Status Atual

**Parceiro de Teste (`parceiro-001`):**
- Email: `parceiro@tvdefleet.com`
- Password: `UQ1B6DXU`
- Status: **7/7 módulos ATIVOS**
- Pronto para teste de todas as funcionalidades!

**Comando para verificar:**
```bash
bash /tmp/test_modulo.sh
```

---

**Última Atualização:** 08/12/2025
**Versão:** 1.0
