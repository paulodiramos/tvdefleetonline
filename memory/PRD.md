# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)
- **WhatsApp**: whatsapp-web.js (Node.js) com Chromium

---

## ✅ Alterações desta Sessão (24/01/2026)

### 1. WhatsApp por Parceiro
- ✅ Cada parceiro configura o seu próprio WhatsApp no perfil (`/configuracoes-parceiro`)
- ✅ Acesso disponível para parceiros e gestores
- ✅ Novos templates de mensagem: Vistoria Agendada, Lembrete de Vistoria, Manutenção
- ✅ Sistema de envio em massa por tipo de evento

### 2. Terabox por Parceiro
- ✅ Nova tab "Terabox" nas configurações do parceiro
- ✅ Configuração de cookie de autenticação com instruções
- ✅ Opções de sincronização: documentos, relatórios, vistorias
- ✅ Teste de conexão integrado

### 3. Requisitos de Deployment Documentados
- ✅ Criado `/app/DEPLOYMENT.md` com instruções completas
- ✅ O Chromium é necessário para o WhatsApp funcionar
- ✅ Deve ser instalado no Dockerfile ou script de inicialização

### 4. Templates de Mensagem WhatsApp (Novos)
- Vistoria Agendada (data, hora, local, veículo)
- Lembrete de Vistoria (notificação prévia)
- Manutenção Agendada (tipo, data, local)

---

## Configurações por Parceiro (`/configuracoes-parceiro`)

### Tabs Disponíveis:
1. **Email** - Configuração SMTP
2. **WhatsApp** - Número, templates, notificações automáticas
3. **Terabox** - Cookie, pasta raiz, sincronização
4. **Plataformas** - Credenciais Uber/Bolt/Via Verde

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Requisitos de Deployment

### Chromium (para WhatsApp)
```bash
# Adicionar ao Dockerfile ou script de inicialização
apt-get update && apt-get install -y chromium
```

O Chromium é necessário porque o `whatsapp-web.js` usa o Puppeteer para simular um browser e conectar ao WhatsApp Web. Sem o Chromium instalado, o serviço não consegue criar sessões.

### Serviços necessários:
- Backend (FastAPI): porta 8001
- Frontend (React): porta 3000
- WhatsApp Service (Node.js): porta 3001
- MongoDB

---

## Tarefas Concluídas
- ✅ WhatsApp configurado por parceiro
- ✅ Terabox configurado por parceiro  
- ✅ Templates de mensagem para eventos/vistorias
- ✅ Documentação de deployment

## Tarefas Pendentes

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
- [ ] Mover os 14 endpoints restantes para rotas
