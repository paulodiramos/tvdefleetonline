# 📦 Sistema de Planos e Módulos - Guia Completo

## ✅ Bug Corrigido

**Problema**: Após alterar o plano de um parceiro, os módulos continuavam todos ativos e não respeitavam as restrições do novo plano.

**Causa Raiz**: Sistema tinha duas formas paralelas de armazenar planos:
- `users.plano_id` (usado pelo endpoint de atribuição)
- `planos_usuarios` (usado pelo endpoint de verificação)

**Solução Implementada**:
1. Endpoint `/api/admin/parceiros/{parceiro_id}/atribuir-plano` agora cria/atualiza registro em `planos_usuarios`
2. Endpoint `/api/users/{user_id}/verificar-modulo/{modulo_codigo}` tem fallback para verificar `users.plano_id`
3. Sistema totalmente funcional e testado ✅

---

## 📋 Novos Módulos Criados

Os seguintes módulos foram adicionados ao sistema:

### 1. **gestao_eventos_veiculo**
- **Nome**: Gestão de Eventos de Veículos
- **Descrição**: Editar e gerir eventos na agenda do veículo
- **Código**: `gestao_eventos_veiculo`

### 2. **vistorias_veiculos**
- **Nome**: Vistorias de Veículos
- **Descrição**: Sistema completo de vistorias e inspeções
- **Código**: `vistorias_veiculos`

### 3. **importar_csv**
- **Nome**: Importar CSV
- **Descrição**: Importação de dados via CSV (ganhos, KM, etc.)
- **Código**: `importar_csv`

### 4. **sincronizacao_automatica**
- **Nome**: Sincronização Automática
- **Descrição**: Sincronização automática com plataformas (Uber/Bolt)
- **Código**: `sincronizacao_automatica`

### 5. **envio_email**
- **Nome**: Envio de Email
- **Descrição**: Módulo de envio de emails e notificações
- **Código**: `envio_email`

### 6. **envio_whatsapp**
- **Nome**: Envio de WhatsApp
- **Descrição**: Envio de mensagens via WhatsApp
- **Código**: `envio_whatsapp`

### 7. **avisos_documentos**
- **Nome**: Avisos de Documentos
- **Descrição**: Alertas automáticos de documentos fora de prazo
- **Código**: `avisos_documentos`

### 8. **avisos_revisoes**
- **Nome**: Avisos de Revisões
- **Descrição**: Alertas de veículos próximos da revisão
- **Código**: `avisos_revisoes`

---

## 🎯 Como Usar o Sistema de Módulos

### 1. **Criar um Plano**

1. Aceda a: **Painel de Controlo** → **Gestão de Planos**
2. Clique em **"+ Criar Plano"**
3. Preencha:
   - Nome do plano
   - Descrição
   - Tipo de cobrança (Por Veículo / Por Motorista / Fixo)
   - Preço
   - Selecione os módulos que fazem parte deste plano
4. Clique em **"Criar Plano"**

### 2. **Atribuir Plano a um Parceiro**

**Via Gestão de Planos:**
1. Na página de "Gestão de Planos"
2. Encontre o plano desejado
3. Clique em **"Editar"**
4. Selecione os parceiros que devem ter este plano

**Via API:**
```bash
curl -X POST http://localhost:8001/api/admin/parceiros/{parceiro_id}/atribuir-plano \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"plano_id": "{PLANO_ID}"}'
```

### 3. **Verificar Permissões de Módulo**

**Via API:**
```bash
curl -H "Authorization: Bearer {TOKEN}" \
  http://localhost:8001/api/users/{user_id}/verificar-modulo/{modulo_codigo}
```

**Resposta:**
```json
{
  "tem_acesso": true,
  "motivo": "Acesso concedido"
}
```

### 4. **No Frontend**

Para verificar se um parceiro tem acesso a um módulo antes de exibir funcionalidades:

```javascript
const checkModuleAccess = async (moduloCodigo) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(
    `${API}/users/${user.id}/verificar-modulo/${moduloCodigo}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.tem_acesso;
};

// Exemplo de uso:
const hasImportCSV = await checkModuleAccess('importar_csv');
if (hasImportCSV) {
  // Mostrar opção de importar CSV
}
```

---

## 🔧 Alterações no Menu

### **Removido do Menu Principal:**
- ❌ "Utilizadores"
- ❌ "Planos" (que estava na barra de navegação)

### **Adicionado ao "Painel de Controlo":**
- ✅ **"Gestão de Planos"** (primeiro item, antes das configurações)
- ✅ Mantido "Config. Planos Base" nas configurações (para configurar tipos de planos)

### **Nova Estrutura do Menu Admin:**

```
Painel de Controlo (Dropdown)
├─ 📦 Gestão de Planos         [NOVO]
├─ ✅ Pendentes
├─ ⚙️  CONFIGURAÇÕES
│  ├─ 🗄️  Config. Planos Base
│  ├─ 🔌 Integrações
│  ├─ 🔔 Comunicações
│  ├─ ✉️  Config. Email/WhatsApp
│  ├─ 🚗 Categorias Uber/Bolt
│  └─ 📄 Termos & Privacidade
├─ 👤 Perfil
└─ 🚪 Sair
```

---

## 🧪 Teste Completo Realizado

### Cenário 1: Atribuir Plano Básico
- **Plano**: "Plano Básico Teste"
- **Módulos**: `gestao_veiculos`, `gestao_motoristas`, `vistorias_veiculos`
- **Resultado**: ✅ Parceiro tem acesso APENAS aos 3 módulos

### Cenário 2: Mudar para Plano Premium
- **Plano**: "Plano Premium Teste"
- **Módulos**: `importar_csv`, `envio_email`, `avisos_documentos`, `avisos_revisoes`
- **Resultado**: ✅ Parceiro perde acesso aos módulos antigos e ganha acesso aos novos

### Cenário 3: Verificação de Módulos Não Incluídos
- **Teste**: Verificar módulo `envio_whatsapp` (não incluído em nenhum plano)
- **Resultado**: ✅ Retorna `tem_acesso: false` com motivo correto

---

## 📊 Total de Módulos no Sistema

**23 módulos disponíveis**, incluindo:
- Módulos de gestão (veículos, motoristas, pagamentos)
- Módulos de importação/sincronização
- Módulos de comunicação (email, WhatsApp)
- Módulos de alertas (documentos, revisões)

---

## 🔐 Controle de Acesso

### Como Funciona:
1. Admin cria planos com módulos específicos
2. Admin atribui planos a parceiros
3. Sistema cria registro em `planos_usuarios` com os módulos ativos
4. Frontend verifica permissões antes de exibir funcionalidades
5. Backend valida permissões em endpoints críticos

### Exemplo de Implementação no Backend:
```python
@api_router.post("/veiculos/importar-csv")
async def importar_csv_veiculos(
    current_user: Dict = Depends(get_current_user)
):
    # Verificar se tem acesso ao módulo
    acesso = await verificar_acesso_modulo(
        current_user["id"], 
        "importar_csv"
    )
    if not acesso["tem_acesso"]:
        raise HTTPException(403, "Módulo não disponível no seu plano")
    
    # Continuar com a importação...
```

---

## 🆘 Solução de Problemas

### Parceiro não consegue aceder a um módulo que deveria ter:

1. Verificar se o parceiro tem um plano ativo:
   ```bash
   curl -H "Authorization: Bearer {TOKEN}" \
     http://localhost:8001/api/users/{parceiro_id}/verificar-modulo/{modulo_codigo}
   ```

2. Verificar o plano atribuído ao parceiro:
   - Aceda à base de dados: `db.planos_usuarios.find({user_id: "parceiro-001"})`
   - Verifique o campo `modulos_ativos`

3. Re-atribuir o plano através da API ou UI de Admin

---

**Data de Criação**: 08/12/2025  
**Versão do Sistema**: TVDEFleet v2.0  
**Status**: ✅ Sistema Totalmente Operacional
