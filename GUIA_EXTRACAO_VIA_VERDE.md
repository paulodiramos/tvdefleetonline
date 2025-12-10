# 🎯 Guia Completo: Extração de Dados Via Verde

## 📊 **O que os Screenshots Mostraram:**

Dos screenshots enviados, identificamos:

### **Página de Extratos e Movimentos:**
- ✅ Tabela com dados organizados
- ✅ Botão **"Exportar extratos"** em PDF
- ✅ Botão **"Exportar detalhes"** (dropdown)
- ✅ Filtros por período, contrato, serviço
- ✅ **Botão "2ª Via de Extratos"** para download em massa

### **Dados Disponíveis na Tabela:**
- **Nº de extrato**: Número identificador + data
- **Contrato**: Número do contrato
- **Ano**: 2025
- **Mês**: Novembro, Outubro, Setembro, Agosto, Julho
- **Extrato**: Ícone PDF (downloadável)
- **Detalhe**: Botão "Exportar" com opções

---

## 🚀 **3 Soluções para Extração Automática**

### **Solução 1: Scraper com Download de PDF** (Melhor)
✅ **Recomendada** - Usa funcionalidade nativa do site

#### **Como Funciona:**
1. Scraper faz login
2. Navega para "Extratos e Movimentos"
3. Clica em filtros (se necessário)
4. Clica em **"2ª Via de Extratos"** ou **"Exportar extratos"**
5. Faz download de PDFs
6. Extrai dados dos PDFs usando OCR/parser

#### **Vantagens:**
- ✅ Usa funcionalidade oficial
- ✅ Dados completos e formatados
- ✅ Menos chance de quebrar

#### **O que preciso fazer:**
- Ajustar scraper para clicar nos botões corretos
- Implementar download de arquivos
- Criar parser de PDF

---

### **Solução 2: Extração da Tabela HTML** (Mais Rápido)
✅ **Alternativa** - Extração direta da página

#### **Como Funciona:**
1. Scraper faz login
2. Navega para "Extratos e Movimentos"
3. Aplica filtros de data
4. Extrai dados diretamente da tabela HTML
5. Salva no formato estruturado

#### **Vantagens:**
- ✅ Mais rápido (sem PDFs)
- ✅ Dados já estruturados
- ✅ Pode automatizar completamente

#### **Limitação:**
- ⚠️ Pode ter menos detalhes que o PDF

---

### **Solução 3: Upload Manual** (Já Funciona 100%)
✅ **Disponível Agora** - Sem código adicional

#### **Como Usar:**
1. Entrar em Via Verde manualmente
2. Ir para "Extratos e Movimentos"
3. Clicar **"Exportar extratos"**
4. Baixar CSV ou Excel (se disponível)
5. No sistema: **Menu → Importar Dados CSV**
6. Selecionar "Via Verde"
7. Fazer upload do ficheiro
8. ✅ Pronto!

---

## 🔧 **Implementação Imediata: Solução 1**

Vou agora **ajustar o scraper** para:
1. ✅ Fazer login corretamente
2. ✅ Navegar para "Extratos e Movimentos"
3. ✅ Clicar em "Exportar extratos"
4. ✅ Fazer download dos PDFs
5. ✅ Processar dados

---

## 📋 **Estrutura de Dados Esperada:**

```json
{
  "extrato_numero": "023815425/11/2025",
  "contrato": "518422044",
  "ano": 2025,
  "mes": "Novembro",
  "data": "2025-11-01",
  "movimentos": [
    {
      "data": "2025-11-03",
      "local": "A1 - Lisboa",
      "valor": 2.15,
      "tipo": "portagem",
      "matricula": "XX-XX-XX"
    }
  ]
}
```

---

## ⚙️ **Próximas Ações:**

**Posso implementar agora:**
1. ✅ Ajustar scraper Via Verde para clicar nos botões corretos
2. ✅ Implementar download automático de PDFs
3. ✅ Criar parser para extrair dados dos PDFs
4. ✅ Integrar com base de dados

**Quer que eu:**
- a) **Implemente Solução 1** (Scraper com PDF) - mais completo
- b) **Implemente Solução 2** (Extração tabela) - mais rápido
- c) **Use Solução 3** (Upload manual) - já funciona

---

## 💡 **Nota Importante:**

Dos screenshots vejo que está **LOGADO** e pode ver os dados.
Isto significa que o login manual está a funcionar!

O problema anterior era só que o scraper não encontrou os campos.
Agora que vi a estrutura real, posso ajustar perfeitamente! 🎯
