# 📋 Guia de Importação de Carregamentos Elétricos

## 📁 Formato do Ficheiro Excel

### Estrutura do Ficheiro

O ficheiro Excel deve conter as seguintes colunas (ordem exata):

| Coluna | Nome | Tipo | Obrigatório | Descrição |
|--------|------|------|-------------|-----------|
| A | DATA | Data/Hora | Opcional | Data e hora do carregamento (formato: DD/MM/YYYY HH:MM) |
| B | **Nº. CARTÃO** | Texto | **✅ SIM** | CardCode que identifica o veículo (ex: PTPRIO6087131736480003) |
| C | NOME | Texto | Opcional | Nome do cartão/motorista (informativo) |
| D | DESCRIÇÃO | Texto | Opcional | Descrição do veículo (informativo) |
| E | MATRÍCULA | Texto | Opcional | Matrícula do veículo (informativo, não usado para identificação) |
| F | ID CARREGAMENTO | Texto | Opcional | Identificador único do carregamento |
| G | POSTO | Texto | Opcional | Identificador do posto de carregamento |
| H | ENERGIA | Decimal | Opcional | Energia consumida em kWh |
| I | DURAÇÃO | Decimal | Opcional | Duração do carregamento em minutos |
| J | CUSTO | Decimal | Opcional | Custo base sem IVA |
| K | OPC IEC | Decimal | Opcional | Taxa IEC |
| L | TOTAL | Decimal | Opcional | Total sem IVA |
| M | **TOTAL c/ IVA** | Decimal | **✅ SIM** | Total com IVA (valor usado nos relatórios) |
| N | FATURA PTPRIO | Texto | Opcional | Número da fatura |

---

## 🔑 Campos Obrigatórios

### 1. **Nº. CARTÃO** (CardCode)
- **Formato:** Texto alfanumérico, geralmente com prefixo PTPRIO ou PTEDP
- **Exemplo:** `PTPRIO6087131736480003`
- **Importante:** Este CardCode deve estar configurado na ficha do veículo no campo **"Cartão Frota Elétrico ID (Carregamentos)"**

### 2. **TOTAL c/ IVA**
- **Formato:** Número decimal (use ponto ou vírgula)
- **Exemplo:** `16.24` ou `19,05`
- **Importante:** Este é o valor principal usado para os relatórios semanais

---

## 🔄 Como Funciona a Importação

### Passo 1: Identificação do Veículo
O sistema procura o veículo usando o **Nº. CARTÃO** (CardCode):
1. Compara com o campo `cartao_frota_eletric_id` na ficha do veículo
2. Se não encontrar com prefixo completo, tenta sem o prefixo (PTPRIO/PTEDP)

### Passo 2: Associação do Motorista
O motorista é associado **automaticamente** através do veículo:
1. Sistema verifica o campo `motorista_atribuido` na ficha do veículo
2. Associa todas as despesas desse carregamento ao motorista atribuído

### Passo 3: Criação de Registos
Cada linha do Excel cria um registo com:
- Despesa total (TOTAL c/ IVA)
- Energia consumida (kWh)
- Duração do carregamento
- Associação ao veículo e motorista
- Data e hora do carregamento

### Passo 4: Relatórios Automáticos
Após importação, o sistema:
- ✅ Calcula totais gerais
- ✅ Agrupa despesas por motorista
- ✅ Cria relatórios semanais de rascunho
- ✅ Adiciona valores ao campo `carregamentos_eletricos` nos relatórios

---

## 📊 Exemplo de Dados

```
DATA                | Nº. CARTÃO              | TOTAL c/ IVA | ENERGIA | POSTO
15/01/2025 10:30    | PTPRIO6087131736480003  | 16.24        | 33.5    | SJM-00051
16/01/2025 14:20    | PTPRIO6087131736480003  | 19.05        | 38.4    | ALM-00040
17/01/2025 09:15    | PTPRIO9050324927265598  | 20.04        | 42.1    | BRR-00082
```

---

## 🚀 Como Importar

### Na Interface Web:
1. Aceda à página **"Importar Dados"**
2. Selecione a plataforma: **"Via Verde"**
3. Escolha o ficheiro Excel (.xlsx)
4. Defina o período:
   - **Data início:** Primeiro dia do período (ex: 01/01/2025)
   - **Data fim:** Último dia do período (ex: 31/01/2025)
5. Clique em **"Importar"**

### Via API:
```bash
POST /api/importar/viaverde
Headers:
  - Authorization: Bearer {token}
  - Content-Type: multipart/form-data
Body:
  - file: ficheiro.xlsx
  - periodo_inicio: 2025-01-01
  - periodo_fim: 2025-01-31
```

---

## ✅ Resposta Após Importação

### Exemplo de Resposta:
```json
{
  "message": "Importação concluída: 29 carregamentos importados",
  "sucesso": 29,
  "erros": 0,
  "totais": {
    "total_despesas": 385.88,
    "total_energia_kwh": 868.99,
    "total_duracao_minutos": 1450,
    "total_duracao_horas": 24.2
  },
  "despesas_por_motorista": [
    {
      "motorista_nome": "João Silva",
      "motorista_email": "joao@example.com",
      "total_despesas": 150.50,
      "total_energia": 350.20,
      "total_carregamentos": 12
    },
    {
      "motorista_nome": "Maria Santos",
      "motorista_email": "maria@example.com",
      "total_despesas": 235.38,
      "total_energia": 518.79,
      "total_carregamentos": 17
    }
  ]
}
```

---

## ⚠️ Erros Comuns

### Erro: "Veículo não encontrado com CardCode"
**Causa:** O CardCode não está configurado na ficha do veículo  
**Solução:**
1. Vá para **Veículos** → Selecione o veículo
2. Clique em **Editar**
3. Na tab **Informações**, encontre o campo **"Cartão Frota Elétrico ID (Carregamentos)"**
4. Cole o CardCode do Excel (ex: PTPRIO6087131736480003)
5. Clique em **Guardar**

### Erro: "Linha X: Nº. CARTÃO não encontrado"
**Causa:** A linha no Excel está vazia ou sem CardCode  
**Solução:** Verifique se todas as linhas têm o campo **Nº. CARTÃO** preenchido

### Erro: "Linha X: erro ao processar"
**Causa:** Dados inválidos na linha (formato incorreto)  
**Solução:** Verifique se os valores numéricos estão corretos (sem texto nos campos numéricos)

---

## 📝 Configuração de Veículos

### Antes de importar, configure os veículos:

1. **Aceda à ficha do veículo:**
   - Menu: Veículos → Lista de Veículos
   - Clique no veículo desejado

2. **Configure o CardCode:**
   - Tab: **Informações**
   - Campo: **"Cartão Frota Elétrico ID (Carregamentos)"**
   - Valor: Cole o Nº. CARTÃO do Excel
   - Exemplo: `PTPRIO6087131736480003`

3. **Atribua um motorista:**
   - Campo: **"Motorista Atribuído"**
   - Selecione o motorista na lista
   - Este motorista receberá todas as despesas deste veículo

4. **Guarde as alterações**

---

## 📈 Relatórios Gerados

Após a importação, o sistema gera automaticamente:

### 1. Relatórios Semanais de Rascunho
- Estado: **"rascunho"**
- Campo: **carregamentos_eletricos** preenchido com o total da semana
- Um relatório por motorista, por semana

### 2. Relatório Detalhado Imediato
- Total de despesas importadas
- Total de energia consumida
- Duração total dos carregamentos
- Despesas agrupadas por motorista

### 3. Histórico de Transações
- Todos os carregamentos ficam salvos na coleção `portagens_viaverde`
- Tipo: `carregamento_eletrico`
- Podem ser consultados e filtrados

---

## 🔍 Consultar Dados Importados

### Via Interface Web:
- **Relatórios Semanais:** Menu → Relatórios → Ver relatórios em rascunho
- **Histórico do Motorista:** Menu → Motoristas → Selecionar motorista → Ver histórico

### Via API:
```bash
# Ver relatórios semanais
GET /api/relatorios/semanais-todos
Filter: estado=rascunho

# Ver carregamentos específicos
GET /api/portagens-viaverde
Filter: tipo_transacao=carregamento_eletrico
```

---

## 📞 Suporte

Se tiver dúvidas ou encontrar problemas:
1. Verifique se os CardCodes estão configurados nos veículos
2. Confirme que os veículos têm motoristas atribuídos
3. Valide o formato do ficheiro Excel (use o template fornecido)
4. Contacte o suporte técnico com os detalhes do erro

---

## 📦 Ficheiros Disponíveis

- **Template_Importacao_Carregamentos.xlsx** - Template com exemplos e estrutura correta
- **README_CARREGAMENTOS_ELETRICOS.md** - Este documento (instruções completas)

---

**Última atualização:** 15 de Dezembro de 2025  
**Versão:** 2.0 (com suporte para formato oficial)
