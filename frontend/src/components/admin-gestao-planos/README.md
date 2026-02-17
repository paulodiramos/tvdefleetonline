# Componentes Admin Gestão de Planos - Guia de Refatoração

## Visão Geral

Este diretório contém componentes extraídos do ficheiro `AdminGestaoPlanos.js` (3032 linhas) para melhorar a manutenção do código.

## Componentes Criados

| Componente | Linhas | Descrição |
|------------|--------|-----------|
| `PlanosTab.js` | 196 | Tab de gestão de planos (parceiro/motorista) |
| `CategoriasTab.js` | 190 | Tab de categorias com dashboard e distribuição |
| `ModulosTab.js` | 231 | Tab de módulos com filtros e dashboard |
| `SubscricoesTab.js` | 76 | Tab de subscrições ativas (tabela) |
| `DescontosTab.js` | 144 | Tab de descontos e preços especiais |
| `PromocoesTab.js` | 68 | Tab de promoções e campanhas |
| `index.js` | 7 | Exportações |
| **Total** | **912** | |

## Como Usar

### Importação
```javascript
import { 
  PlanosTab, 
  CategoriasTab, 
  ModulosTab, 
  SubscricoesTab, 
  DescontosTab, 
  PromocoesTab 
} from '@/components/admin-gestao-planos';
```

### Props dos Componentes

#### PlanosTab
```javascript
<PlanosTab
  planos={planos}
  onOpenPlanoModal={openPlanoModal}
  onDeletePlano={handleDeletePlano}
/>
```

#### CategoriasTab
```javascript
<CategoriasTab
  categorias={categorias}
  planos={planos}
  onOpenCategoriaModal={openCategoriaModal}
  onDeleteCategoria={handleDeleteCategoria}
/>
```

#### ModulosTab
```javascript
<ModulosTab
  modulos={modulos}
  onOpenModuloModal={openModuloModal}
  onDeleteModulo={handleDeleteModulo}
/>
```

#### SubscricoesTab
```javascript
<SubscricoesTab subscricoes={subscricoes} />
```

#### DescontosTab
```javascript
<DescontosTab
  subscricoes={subscricoes}
  onOpenPrecoFixoModal={() => setShowPrecoFixoModal(true)}
  onRemovePrecoFixo={handleRemovePrecoFixo}
  onRemoveDesconto={handleRemoveDesconto}
/>
```

#### PromocoesTab
```javascript
<PromocoesTab planos={planos} />
```

## Integração com AdminGestaoPlanos.js

Para integrar estes componentes no ficheiro original:

### 1. Adicionar imports
```javascript
import { 
  PlanosTab, CategoriasTab, ModulosTab, 
  SubscricoesTab, DescontosTab, PromocoesTab 
} from '@/components/admin-gestao-planos';
```

### 2. Substituir TabsContent
```jsx
{/* Antes: ~200 linhas */}
<TabsContent value="planos">
  {/* código inline */}
</TabsContent>

{/* Depois: 1 componente */}
<TabsContent value="planos">
  <PlanosTab
    planos={planos}
    onOpenPlanoModal={openPlanoModal}
    onDeletePlano={handleDeletePlano}
  />
</TabsContent>
```

## Estrutura de Tabs

| Tab | Componente | Funcionalidades |
|-----|------------|-----------------|
| `planos` | PlanosTab | Lista planos parceiro/motorista, editar, eliminar |
| `categorias` | CategoriasTab | Dashboard, distribuição, CRUD categorias |
| `modulos` | ModulosTab | Dashboard, filtros por tipo, CRUD módulos |
| `subscricoes` | SubscricoesTab | Tabela de subscrições ativas |
| `descontos` | DescontosTab | Preços fixos e descontos percentuais |
| `promocoes` | PromocoesTab | Promoções por plano |

## Componentes que Permanecem no Ficheiro Original

Os modais devem permanecer no ficheiro original pois dependem de estado local:
- Modal de Plano
- Modal de Módulo
- Modal de Categoria
- Modal de Preço Fixo
- Modal de Promoção

## Redução Potencial

| Cenário | Linhas Atuais | Após Refatoração |
|---------|---------------|------------------|
| AdminGestaoPlanos.js | 3032 | ~2100 |
| Componentes extraídos | - | 912 |
| **Benefício** | - | Código modular |

## Utilidades Incluídas

### getTipoCobrancaLabel (ModulosTab)
```javascript
const getTipoCobrancaLabel = (tipo) => {
  const labels = {
    'fixo': 'Fixo',
    'por_veiculo': 'Por Veículo',
    'por_motorista': 'Por Motorista',
    'por_veiculo_motorista': 'Por Veículo + Motorista'
  };
  return labels[tipo] || tipo;
};
```

### getCategoriaColor (PlanosTab)
```javascript
const getCategoriaColor = (categoria) => {
  const colors = {
    'standard': 'bg-slate-100 text-slate-700',
    'premium': 'bg-amber-100 text-amber-700',
    'enterprise': 'bg-purple-100 text-purple-700',
    'custom': 'bg-blue-100 text-blue-700'
  };
  return colors[categoria?.toLowerCase()] || 'bg-slate-100 text-slate-700';
};
```

## Data de Criação

- Criado em: Dezembro 2025
- Autor: Sistema de Refatoração Automática
