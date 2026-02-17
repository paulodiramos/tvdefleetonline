# CHANGELOG - TVDEFleet

## [2025-02-16] - Refatoração e Limpeza de Storage

### Limpeza Realizada
- **Cache Python** (`__pycache__`): Limpo em todo o projeto
- **Screenshots RPA/Debug**: Removidos de `/app/backend/rpa_screenshots/` e `/app/backend/screenshots/`
- **Ficheiros .bak**: Removidos (ex: `FichaVeiculo.js.bak`)
- **Ficheiros de teste**: Organizados - movidos de `/app/` para `/app/tests/`
- **Sessões WhatsApp antigas**: Removidas sessões `session-ab2a25aa-*` e `session-admin`
- **Cache do browser**: Limpo em sessões WhatsApp e Prio (Cache, Code Cache, GPUCache, DawnCache)
- **Ficheiros temporários**: Removidos CSV/Excel com mais de 30 dias
- **Logs antigos**: Removidos logs com mais de 7 dias
- **Pastas vazias**: Removidas

### Espaço Recuperado
- **Total estimado**: ~400 MB
- whatsapp_service/.wwebjs_auth: 552 MB → 236 MB
- prio_sessions: 69 MB → 2 MB
- backend total: 699 MB → 368 MB

---

## [2025-02-15] - Correções e Início Sistema Integrações

### Implementado
- Início da refatoração para Sistema de Integrações Configurável
- Modelos de dados expandidos em `backend/models/fornecedores.py`
- Novos endpoints para CRUD de configurações de integração
- Correção da distribuição de combustível no Resumo Semanal
- Correção do filtro de motoristas (apenas ativos do parceiro)
- Link para ficha do motorista no Resumo Semanal
- Melhoria no preenchimento do código SMS 2FA

### Em Progresso
- Frontend `AdminFornecedores.js` para configuração de integrações

### Pendente Validação
- Persistência da sessão Prio entre sincronizações
- Lista de motoristas correta no Resumo Semanal
