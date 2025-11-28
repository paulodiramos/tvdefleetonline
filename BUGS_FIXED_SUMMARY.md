# Correção dos 6 Bugs Críticos

## ✅ Bug 1: Download documentos motorista após aprovação
**Status:** CORRIGIDO
- Adicionado seção "Documentos Aprovados" na página de perfil
- Botões de download para todos os 9 documentos
- Visível apenas quando `documentosAprovados === true`

## ✅ Bug 2: Restrição upload documentos
**Status:** CORRIGIDO
- Array atualizado: `['comprovativo_iban', 'registo_criminal', 'comprovativo_seguro']`
- Motorista com documentos aprovados só pode alterar esses 3
- Mensagem de erro clara para outros documentos

## ⚠️ Bug 3: Download contrato erro runtime
**Status:** CÓDIGO CORRETO, POSSÍVEL FALTA DE DADOS
- Função `handleDownloadContrato()` implementada corretamente
- Endpoint backend existe: `/motoristas/{id}/contrato/download`
- Erro pode ser: contrato não existe no banco de dados

## ✅ Bug 4: Download documentos motorista (Parceiro)
**Status:** NÃO É BUG
- Funcionalidade já existe na página Motoristas
- Botão "Ver Documentos" disponível
- Endpoint funcional

## ✅ Bug 5: Comprovativo sem 'saved_path'
**Status:** CORRIGIDO
- Backend atualizado para usar: `file_info.get("pdf_path") or file_info.get("original_path")`
- Função `process_uploaded_file` retorna `original_path` e `pdf_path`
- Correção aplicada ao endpoint `/relatorios-ganhos/{id}/comprovativo`

## ⚠️ Bug 6: Verificar recibos sem lista
**Status:** NÃO É BUG - FALTA DE DADOS
- Endpoint `/api/recibos` funciona corretamente
- Permissões corretas para parceiro
- Retorna array vazio porque não há recibos criados no sistema

## Arquivos Modificados:
1. `/app/frontend/src/App.js` - Adicionada rota `/recibos-ganhos`
2. `/app/frontend/src/components/MotoristaDadosPessoaisExpanded.js`
   - Adicionado comprovativo_seguro às restrições
   - Adicionada seção de downloads de documentos aprovados
3. `/app/backend/server.py`
   - Corrigido endpoint comprovativo para usar `pdf_path` ou `original_path`
