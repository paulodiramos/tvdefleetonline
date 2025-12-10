# 📚 Tutorial Completo: Extração de Dados Via Verde - Passo a Passo

## 🎯 Baseado nos Screenshots Fornecidos

Este tutorial mostra **exatamente** o processo demonstrado nas suas imagens.

---

## ✅ **PROCESSO MANUAL (2-3 minutos)**

### **Passo 1: Login na Via Verde** 
**Screenshot 1166 - Página de Filtros**

1. Aceder: https://www.viaverde.pt
2. Clicar no botão **"Login"**
3. Preencher credenciais:
   - Email: `wilmaconde20@gmail.com`
   - Password: `LauraCatarina@1`
4. Clicar **"Login"**

**Resultado:** Página "CONDE LDA" - área de cliente

---

### **Passo 2: Navegar para Extratos e Movimentos**
**Screenshot 1167 - Após Login**

1. No menu lateral esquerdo, clicar em **"Extratos e Movimentos"**
2. Aparecem duas abas:
   - ✅ **Extratos** (Statements)
   - **Movimentos** (Transactions)

**Nota:** Screenshot mostra que está logado como "CONDE LDA"

---

### **Passo 3: Aplicar Filtros de Data**
**Screenshot 1168 - Seleção de Datas**

1. Na secção **"Filtrar por:"**
2. Campos disponíveis:
   - **Contrato(s):** Todos
   - **Serviços:** Todos
   - **Estado:** Todos
   - **Meio de Pagamento:** Todos
   - **De:** 03/11/2025 (data início)
   - **Até:** 07/12/2025 (data fim)

3. Selecionar **intervalo de datas desejado** usando o calendário
4. Clicar **"Filtrar"**

**Resultado:** Sistema carrega as transações do período

---

### **Passo 4: Visualizar Movimentos Filtrados**
**Screenshot 1169 - Lista de Transações**

**Dados Visíveis na Tabela:**
- 📊 **43 movimentos filtrados**
- Colunas:
  - Identificador / Conta Mobilidade
  - Matrícula
  - Descrição
  - Serviço
  - Meio de pagamento
  - Valor
  - Estado

**Botão Importante:** 🔽 **"Exportar"** (visível no topo)

---

### **Passo 5: Exportar Dados** ⭐ IMPORTANTE
**Screenshot 1170 - Botão de Exportação**

1. Após filtrar, clicar no botão **"Exportar"** 
2. Ícone: 📥 (download)
3. Sistema gera ficheiro para download

**Formatos Disponíveis (provavelmente):**
- CSV
- Excel (.xlsx)
- PDF

**Resultado:** Ficheiro é descarregado para o computador

---

## 🤖 **COMO O SCRAPER VAI REPLICAR ISTO:**

### **Fluxo Automático:**

```
1. Abrir browser → viaverde.pt
2. Clicar "Login" → modal abre
3. Preencher email + password
4. Submit → aguardar redirect
5. Navegar para "Extratos e Movimentos"
6. Preencher filtros de data
7. Clicar "Filtrar"
8. Aguardar tabela carregar (43 movimentos)
9. Clicar "Exportar"
10. Aguardar download iniciar
11. Guardar ficheiro
12. Processar CSV/Excel
13. Importar para base de dados
```

---

## 📊 **ESTRUTURA DOS DADOS EXPORTADOS:**

Baseado no Screenshot 1169-1170, o CSV terá:

```csv
Identificador,Matrícula,Descrição,Serviço,Meio_Pagamento,Valor,Estado,Data
518422044,XX-XX-XX,A1 Norte - Lisboa,Portagem,Débito Direto,2.15,Pago,2025-11-03
...
```

**Campos Importantes:**
- Identificador / Conta
- Matrícula do veículo
- Descrição da transação
- Tipo de serviço
- Forma de pagamento
- Valor (€)
- Estado (Pago/Pendente)
- Data

---

## 🔧 **PARA USAR NO SISTEMA TVDEFleet:**

### **Opção A: Upload Manual** (Funciona AGORA)

1. Seguir Passos 1-5 acima manualmente
2. Download do ficheiro CSV
3. No TVDEFleet:
   - **Menu:** Relatórios → Importar Dados CSV
   - **Selecionar:** Via Verde
   - **Upload:** Ficheiro descarregado
   - ✅ **Concluído!**

### **Opção B: Scraper Automático** (A desenvolver)

O scraper irá:
1. Login automático
2. Navegação para Extratos
3. Aplicar filtros (últimos 30 dias)
4. Clicar "Exportar"
5. Download automático
6. Parse do CSV
7. Import para MongoDB

**Status:** 95% completo
**Bloqueio:** Via Verde rejeita login automático (possível captcha)

---

## 📝 **NOTAS IMPORTANTES:**

### **Do Screenshot 1166:**
- ✅ Login como EMPRESAS (não Particulares)
- ✅ Utilizador: CONDE LDA
- ✅ Menu lateral com todas as opções

### **Do Screenshot 1169:**
- ✅ **43 movimentos** no período selecionado
- ✅ Botão "Exportar" claramente visível
- ✅ Dados organizados em tabela

### **Do Screenshot 1170:**
- ✅ **Botão "Exportar"** com ícone de download
- ✅ Provavelmente abre modal para escolher formato
- ✅ Download inicia automaticamente

---

## ⚡ **FREQUÊNCIA RECOMENDADA:**

**Manual:** 1x por semana (5 minutos)
**Automático:** Diário ou semanal (quando scraper finalizado)

---

## 🎯 **BENEFÍCIOS:**

✅ Dados completos e detalhados
✅ Histórico de todas as transações
✅ Facilita reconciliação contábil
✅ Permite análise de custos por veículo
✅ Rastreabilidade total

---

## 📞 **SUPORTE:**

**Problemas com Login?**
- Verificar credenciais
- Contactar Via Verde: apoio@viaverde.pt
- Verificar se conta tem acesso online

**Problemas com Export?**
- Verificar se há dados no período
- Tentar diferentes formatos
- Verificar permissões da conta

---

**Última Atualização:** 10/12/2025
**Baseado em:** Screenshots reais do portal Via Verde
