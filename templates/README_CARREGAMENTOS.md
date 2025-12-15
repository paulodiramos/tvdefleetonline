# Templates de Importação de Carregamentos Elétricos

## 📋 Formato Simplificado (Recomendado)

**Ficheiro:** `carregamentos_formato_simplificado.csv`

**Delimitador:** `;` (ponto e vírgula)

**Estrutura:**
```
data;hora;CardCode;posto;kwh;valor_total;duracao_min
```

**Campos Obrigatórios:**
- `data` - Data no formato D/M/YYYY (ex: 7/12/2025)
- `hora` - Hora no formato HH:MM:SS (ex: 18:13:26)
- `CardCode` - ID do Cartão Frota Elétrico (ex: PTPRIO6087131736480003)
- `posto` - ID da estação de carregamento (ex: SJM-00051)
- `kwh` - Energia consumida em kWh (ex: 33.356)
- `valor_total` - Valor total com taxas em € (ex: 14.08)

**Campos Opcionais:**
- `duracao_min` - Duração do carregamento em minutos (ex: 46.94)

**Exemplo:**
```csv
data;hora;CardCode;posto;kwh;valor_total;duracao_min
7/12/2025;18:13:26;PTPRIO6087131736480003;SJM-00051;33.356;14.08;46.94
7/12/2025;23:08:33;PTPRIO6087131736480008;SJM-00082;22.109;8.58;42.70
```

---

## 📋 Formato Completo (Via Verde)

**Ficheiro:** `carregamentos_formato_completo.csv`

**Delimitador:** `,` (vírgula)

**Estrutura:** 25 colunas (exportação direta da Via Verde)

**Campos Principais:**
- `StartDate` - Data e hora no formato M/D/YYYY H:MM:SS AM/PM
- `CardCode` - ID do Cartão Frota Elétrico
- `Energy` - Energia consumida em kWh
- `TotalValueWithTaxes` - Valor total com taxas
- `IdChargingStation` - ID da estação
- `TotalDuration` - Duração em minutos

**Este formato é gerado automaticamente pela plataforma Via Verde.**

---

## ⚙️ Configuração Necessária

### 1. Preencher "Cartão Frota Elétrico ID" no Veículo

**Passos:**
1. Ir para **Veículos**
2. Selecionar o veículo
3. Clicar em **Editar**
4. Procurar o campo: **"Cartão Frota Elétrico ID (Carregamentos)"**
5. Preencher com o valor da coluna `CardCode` do CSV
   - Exemplo: `PTPRIO6087131736480003`
6. **Guardar**

### 2. Atribuir Motorista ao Veículo

**Passos:**
1. No mesmo formulário do veículo
2. Campo: **"Motorista Atribuído"**
3. Selecionar o motorista
4. **Guardar**

---

## 🔄 Como Importar

### Método 1: Via Interface

1. Ir para **Importar Plataformas**
2. Selecionar **"Carregamentos (Elétrico)"** (ícone verde)
3. Carregar o ficheiro CSV (formato simplificado ou completo)
4. Definir período (ex: 01/12/2025 a 31/12/2025)
5. Clicar em **Importar**

### Método 2: Via API

```bash
curl -X POST "https://seu-dominio.com/api/importar/viaverde" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@carregamentos.csv" \
  -F "periodo_inicio=2025-12-01" \
  -F "periodo_fim=2025-12-31"
```

---

## ✅ Resultado Esperado

**Após importação bem-sucedida:**

1. **Dados Salvos:**
   - Coleção MongoDB: `portagens_viaverde`
   - Tipo: `carregamento_eletrico`

2. **Relatório Semanal Criado:**
   - Estado: `rascunho`
   - Campo: `carregamentos_eletricos` = soma dos valores da semana

3. **Associações:**
   - Veículo identificado por `CardCode`
   - Motorista obtido via `motorista_atribuido` do veículo

**Exemplo de Relatório:**
```json
{
  "estado": "rascunho",
  "motorista_nome": "João Silva",
  "semana": 50,
  "ano": 2025,
  "carregamentos_eletricos": 95.23,
  "ganhos_uber": 500.00,
  "ganhos_bolt": 300.00
}
```

---

## ⚠️ Notas Importantes

1. **Não é necessário email do motorista** - O sistema usa apenas o CardCode
2. **Delimitador correto** - `;` para simplificado, `,` para completo
3. **Formato de data** - D/M/YYYY (português) para simplificado
4. **Separador decimal** - `.` (ponto) em vez de `,` (vírgula)
5. **CardCode deve existir** - Veículo deve ter o campo preenchido
6. **Valores em Euros** - Usar formato numérico (ex: 14.08, não 14,08€)

---

## 🐛 Solução de Problemas

### Erro: "Veículo não encontrado com CardCode"
**Solução:** Preencher o campo "Cartão Frota Elétrico ID" no veículo

### Erro: "Email do motorista vazio"
**Solução:** Verificar que o ficheiro tem as colunas corretas (data;hora;CardCode;...)

### Taxa de sucesso < 100%
**Solução:** Verificar se todos os CardCodes do CSV existem na base de dados

---

## 📊 Estatísticas

**Taxa de Sucesso Esperada:** 100%

**Campos Importados por Formato:**
- **Simplificado:** 7 campos
- **Completo:** 10+ campos (energia detalhada, preços, etc.)

**Tempo de Importação:** ~1-2 segundos para 35 registos
