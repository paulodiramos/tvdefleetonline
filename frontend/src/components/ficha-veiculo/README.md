# Componentes de Ficha de Veículo - Guia de Refatoração

## Visão Geral

Este diretório contém componentes extraídos do ficheiro `FichaVeiculo.js` (6055 linhas) para melhorar a manutenção do código.

## Componentes Criados

| Componente | Linhas | Descrição | Status |
|------------|--------|-----------|--------|
| `VeiculoSeguroTab.js` | 169 | Gestão de seguro do veículo | ✅ Pronto |
| `VeiculoInspecaoTab.js` | 138 | Gestão de inspeção periódica | ✅ Pronto |
| `VeiculoExtintorTab.js` | 148 | Gestão de extintor | ✅ Pronto |
| `VeiculoAgendaTab.js` | 327 | Gestão de agenda/eventos | ✅ Pronto |
| `VeiculoHistoricoTab.js` | 218 | Histórico do veículo | ✅ Pronto |

## Como Usar

### Importação
```javascript
import { 
  VeiculoSeguroTab, 
  VeiculoInspecaoTab, 
  VeiculoExtintorTab, 
  VeiculoAgendaTab, 
  VeiculoHistoricoTab 
} from '@/components/ficha-veiculo';
```

### Props Comuns

Todos os componentes esperam as seguintes props:

```javascript
{
  vehicle,          // Dados do veículo
  editMode,         // Boolean - modo de edição ativo
  canEdit,          // Boolean - permissão de edição
  onSave,           // Função para guardar alterações
  // + props específicas de cada componente
}
```

### Exemplo de Uso (VeiculoSeguroTab)

```jsx
<VeiculoSeguroTab
  vehicle={vehicle}
  seguroForm={seguroForm}
  setSeguroForm={setSeguroForm}
  editMode={editMode}
  canEdit={canEdit}
  onSave={handleSaveSeguro}
  onUploadDocument={handleUploadDocument}
  onDownloadDocument={handleDownloadDocument}
  uploadingDoc={uploadingDoc}
/>
```

## Integração com FichaVeiculo.js

Para integrar estes componentes no ficheiro original:

1. Adicionar import no topo do ficheiro
2. Substituir o conteúdo da `TabsContent` correspondente pelo componente
3. Passar as props necessárias

### Exemplo de Substituição

**Antes:**
```jsx
<TabsContent value="seguro">
  <Card>
    {/* ~180 linhas de código */}
  </Card>
</TabsContent>
```

**Depois:**
```jsx
<TabsContent value="seguro">
  <VeiculoSeguroTab
    vehicle={vehicle}
    seguroForm={seguroForm}
    setSeguroForm={setSeguroForm}
    editMode={editMode}
    canEdit={canEdit}
    onSave={handleSaveSeguro}
    onUploadDocument={handleUploadDocument}
    onDownloadDocument={handleDownloadDocument}
    uploadingDoc={uploadingDoc}
  />
</TabsContent>
```

## Notas de Implementação

- Os componentes foram criados para serem **drop-in replacements**
- O estado continua centralizado no componente pai (`FichaVeiculo.js`)
- Funções de callback são passadas como props
- Todos os componentes seguem o mesmo padrão de design

## Componentes Já Existentes em FichaVeiculo.js

O ficheiro original já contém estes componentes internos que seguem o mesmo padrão:

- `HistoricoAtribuicoesTab` (linha 5534)
- `RelatorioFinanceiroTab` (linha 5698)

## Redução Potencial

| Cenário | Linhas Atuais | Após Refatoração |
|---------|---------------|------------------|
| FichaVeiculo.js | 6055 | ~4000 |
| Componentes extraídos | - | ~1000 |
| **Benefício** | - | Código mais modular |

## Data de Criação

- Criado em: Dezembro 2025
- Autor: Sistema de Refatoração Automática
