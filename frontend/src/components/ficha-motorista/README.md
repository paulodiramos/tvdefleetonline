# Componentes Ficha de Motorista - Guia de Refatoração

## Visão Geral

Este diretório contém componentes extraídos do ficheiro `FichaMotorista.js` (2668 linhas) para melhorar a manutenção do código.

## Componentes Criados

| Componente | Linhas | Descrição |
|------------|--------|-----------|
| `MotoristaDadosPessoaisTab.js` | 469 | Tab completa de dados pessoais, contactos, documentos, emergência |
| `MotoristaFinanceiroTab.js` | 382 | Tab de configuração financeira (Via Verde, IVA, comissões) |
| `MotoristaExtrasTab.js` | 181 | Tab de extras, dívidas e créditos |
| `MotoristaPlataformasTab.js` | 211 | Tab de dados Uber/Bolt/Energia |
| `index.js` | 5 | Exportações |
| **Total** | **1248** | |

## Como Usar

### Importação
```javascript
import { 
  MotoristaDadosPessoaisTab, 
  MotoristaFinanceiroTab,
  MotoristaExtrasTab,
  MotoristaPlataformasTab
} from '@/components/ficha-motorista';
```

### Props dos Componentes

#### MotoristaDadosPessoaisTab
```javascript
<MotoristaDadosPessoaisTab
  dadosMotorista={dadosMotorista}
  setDadosMotorista={setDadosMotorista}
  isEditing={isEditing}
  setIsEditing={setIsEditing}
  saving={saving}
  onSave={handleSaveDadosMotorista}
  calcularIdade={calcularIdade}
  getAniversarioBadge={getAniversarioBadge}
  getValidadeBadge={getValidadeBadge}
  isDocumentoProximoExpirar={isDocumentoProximoExpirar}
  isDocumentoExpirado={isDocumentoExpirado}
/>
```

#### MotoristaFinanceiroTab
```javascript
<MotoristaFinanceiroTab
  configFinanceira={configFinanceira}
  setConfigFinanceira={setConfigFinanceira}
  historicoViaVerde={historicoViaVerde}
  veiculo={veiculo}
  isEditing={isEditing}
  setIsEditing={setIsEditing}
  saving={saving}
  onSave={handleSaveConfigFinanceira}
  onAbaterViaVerde={handleAbaterViaVerde}
/>
```

#### MotoristaExtrasTab
```javascript
<MotoristaExtrasTab
  extras={extras}
  extrasLoading={extrasLoading}
  totalExtras={totalExtras}
  totalPendentes={totalPendentes}
  onOpenExtraModal={openExtraModal}
  onTogglePago={handleTogglePago}
  onDeleteExtra={handleDeleteExtra}
/>
```

#### MotoristaPlataformasTab
```javascript
<MotoristaPlataformasTab
  dadosMotorista={dadosMotorista}
  setDadosMotorista={setDadosMotorista}
  isEditing={isEditing}
  setIsEditing={setIsEditing}
  saving={saving}
  onSave={handleSaveDadosMotorista}
/>
```

## Tabs Originais vs Componentes

| Tab Original | Componente | Status |
|--------------|------------|--------|
| `dados-pessoais` | MotoristaDadosPessoaisTab | ✅ Criado |
| `documentos` | (mantido inline - usa DocumentUploadCard interno) | - |
| `plataformas` | MotoristaPlataformasTab | ✅ Criado |
| `veiculo` | (mantido inline - muito integrado com estado) | - |
| `financeiro` | MotoristaFinanceiroTab | ✅ Criado |
| `extras` | MotoristaExtrasTab | ✅ Criado |
| `app-config` | (mantido inline - pequeno ~85 linhas) | - |
| `ponto` | (mantido inline - pequeno ~75 linhas) | - |
| `turnos` | (mantido inline - pequeno ~100 linhas) | - |

## Componentes que Permanecem em FichaMotorista.js

Os seguintes elementos devem permanecer no ficheiro original devido à integração com estado local:
- Modal de Extra (DialogContent para criar/editar extras)
- DocumentUploadCard (componente interno)
- Funções de utilidade (`calcularIdade`, `getValidadeBadge`, etc.)
- Tabs pequenas (documentos, veiculo, app-config, ponto, turnos)

## Integração Recomendada

Para integrar os componentes:

### 1. Adicionar imports
```javascript
import { 
  MotoristaDadosPessoaisTab, 
  MotoristaFinanceiroTab,
  MotoristaExtrasTab,
  MotoristaPlataformasTab
} from '@/components/ficha-motorista';
```

### 2. Substituir TabsContent
```jsx
<TabsContent value="dados-pessoais" className="space-y-4">
  <MotoristaDadosPessoaisTab
    dadosMotorista={dadosMotorista}
    setDadosMotorista={setDadosMotorista}
    isEditing={isEditing}
    setIsEditing={setIsEditing}
    saving={saving}
    onSave={handleSaveDadosMotorista}
    calcularIdade={calcularIdade}
    getAniversarioBadge={getAniversarioBadge}
    getValidadeBadge={getValidadeBadge}
    isDocumentoProximoExpirar={isDocumentoProximoExpirar}
    isDocumentoExpirado={isDocumentoExpirado}
  />
</TabsContent>
```

## Redução Potencial

| Cenário | Linhas Atuais | Após Refatoração |
|---------|---------------|------------------|
| FichaMotorista.js | 2668 | ~1420 |
| Componentes extraídos | - | 1248 |
| **Benefício** | - | Código mais modular |

## Notas

- Os componentes utilizam a mesma estrutura visual e UX do ficheiro original
- As funções de callback são passadas como props mantendo a separação de concerns
- Os data-testid foram preservados para compatibilidade com testes

## Data de Criação

- Criado em: Dezembro 2025
- Autor: Sistema de Refatoração Automática
