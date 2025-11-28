# Sistema de Vistorias de Veículos - Implementação Completa

## Resumo
Implementado sistema completo de vistorias/inspeções para veículos com upload de fotos, geração de relatórios PDF e histórico completo.

## Backend Changes

### 1. Modelo de Dados (`/app/backend/models/veiculo.py`)
**Novos Modelos:**
- `VehicleVistoria`: Modelo completo para vistorias
  - id, veiculo_id, data_vistoria
  - tipo: "entrada", "saida", "periodica", "danos"
  - km_veiculo, responsavel
  - observacoes, estado_geral
  - fotos[], itens_verificados{}
  - danos_encontrados[]
  - pdf_relatorio, assinaturas

- `VistoriaCreate`: Modelo para criação de vistorias

**Atualização no Modelo Vehicle:**
- Adicionado campo: `proxima_vistoria: Optional[datetime]`

### 2. Endpoints API (`/app/backend/server.py`)
Criados 7 novos endpoints em `/api/vehicles/{vehicle_id}/vistorias`:

1. **POST /vehicles/{vehicle_id}/vistorias**
   - Criar nova vistoria
   - Permissões: ADMIN, GESTAO, PARCEIRO, OPERACIONAL
   - Atualiza data da próxima vistoria no veículo

2. **GET /vehicles/{vehicle_id}/vistorias**
   - Listar todas as vistorias do veículo
   - Ordenado por data (mais recente primeiro)
   - Permissões: Todos os roles autenticados

3. **GET /vehicles/{vehicle_id}/vistorias/{vistoria_id}**
   - Detalhes de uma vistoria específica

4. **PUT /vehicles/{vehicle_id}/vistorias/{vistoria_id}**
   - Atualizar vistoria existente
   - Permissões: ADMIN, GESTAO, PARCEIRO, OPERACIONAL

5. **DELETE /vehicles/{vehicle_id}/vistorias/{vistoria_id}**
   - Deletar vistoria
   - Permissões: Apenas ADMIN e GESTAO

6. **POST /vehicles/{vehicle_id}/vistorias/{vistoria_id}/upload-foto**
   - Upload de fotos da vistoria
   - Aceita múltiplos uploads
   - Armazena em `/uploads/vistorias/{vehicle_id}/`

7. **POST /vehicles/{vehicle_id}/vistorias/{vistoria_id}/gerar-pdf**
   - Gera relatório PDF da vistoria
   - Usa reportlab para criação
   - Inclui dados do veículo, vistoria, observações
   - Salva URL do PDF na vistoria

## Frontend Changes

### 1. Componente VehicleMaintenanceCard (`/app/frontend/src/components/VehicleMaintenanceCard.js`)
**Funcionalidades:**
- Dashboard visual de manutenção e revisões
- Mostra próxima revisão, seguro, inspeção, extintor
- **NOVO**: Exibe próxima vistoria com data e hora
- Sistema de badges coloridos por urgência:
  - Verde: OK (> 30 dias)
  - Laranja: Warning (7-30 dias)
  - Vermelho: Urgente/Expirado (< 7 dias)

### 2. Nova Página: VehicleVistorias (`/app/frontend/src/pages/VehicleVistorias.js`)
**Funcionalidades Principais:**

**Lista de Vistorias:**
- Card para cada vistoria com informações principais
- Badges para tipo e estado geral
- Grid de fotos (preview das primeiras 3)
- Botões de ação: Ver Detalhes, Adicionar Foto, Gerar PDF

**Modal de Criação:**
- Formulário completo com:
  - Tipo de vistoria (entrada/saída/periódica/danos)
  - Data da vistoria
  - KM do veículo
  - Estado geral (excelente/bom/razoável/mau)
  - **Checklist de Verificação** (10 itens):
    * Pneus, Freios, Luzes, Lataria
    * Interior, Motor, Transmissão, Suspensão
    * Ar Condicionado, Eletrônicos
  - Observações (textarea)
  - Próxima vistoria (agenda)

**Modal de Visualização:**
- Detalhes completos da vistoria
- Checklist com ícones de check/cross
- Galeria de fotos (clicável para ampliar)
- Informações do responsável

**Upload de Fotos:**
- Botão inline para cada vistoria
- Upload direto sem modal adicional
- Feedback visual durante upload

**Geração de PDF:**
- Um clique para gerar relatório
- Abre PDF em nova aba automaticamente

### 3. Rota no App.js
- Nova rota: `/vehicles/:vehicleId/vistorias`
- Integrada com autenticação

## Base de Dados
**Nova Coleção MongoDB:** `vistorias`

**Estrutura do Documento:**
```json
{
  "id": "uuid",
  "veiculo_id": "uuid",
  "data_vistoria": "ISO DateTime",
  "tipo": "periodica",
  "km_veiculo": 50000,
  "responsavel_nome": "Nome do User",
  "responsavel_id": "user_uuid",
  "observacoes": "string",
  "estado_geral": "bom",
  "fotos": ["url1", "url2"],
  "itens_verificados": {
    "pneus": true,
    "freios": true,
    ...
  },
  "danos_encontrados": [],
  "pdf_relatorio": "/uploads/vistorias/relatorios/vistoria_uuid.pdf",
  "created_at": "ISO DateTime",
  "updated_at": "ISO DateTime"
}
```

## Fluxo de Uso

1. **Acesso:** Gestor/Parceiro/Operacional navega para página do veículo
2. **Criar Vistoria:** Clica em "Nova Vistoria"
3. **Preencher Formulário:** Seleciona tipo, data, preenche checklist
4. **Salvar:** Sistema cria registro no banco
5. **Upload Fotos:** Após criar, pode adicionar fotos individualmente
6. **Gerar PDF:** Clica em "Gerar PDF" para relatório formal
7. **Visualizar:** Histórico completo de todas as vistorias

## Próximos Passos Sugeridos
- [ ] Adicionar link para página de vistorias na página de detalhes do veículo
- [ ] Integrar VehicleMaintenanceCard na página de detalhes
- [ ] Adicionar notificações automáticas quando próxima vistoria está próxima
- [ ] Permitir comparação entre vistorias (antes/depois)
- [ ] Adicionar assinatura digital para responsável e motorista
