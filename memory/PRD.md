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

### 1. WhatsApp Corrigido para Produção
- ✅ Instalado Chromium no ambiente (`/usr/bin/chromium`)
- ✅ Corrigido limpeza automática de lock files no `index.js`
- ✅ Reativado router do WhatsApp no `server.py`
- ✅ Restaurada rota e link no frontend (`/whatsapp`)
- ⚠️ **NOTA PARA DEPLOYMENT**: O Chromium precisa ser instalado no ambiente de produção

### 2. RPA Simplificado Removido
- ✅ Eliminado `/app/backend/routes/rpa_simplificado.py`
- ✅ Eliminado `/app/frontend/src/pages/RPASimplificado.js`
- ✅ Removido import e referências do `server.py`

### 3. Sistema RPA Ativo
- **RPA Designer** (`/rpa-designer`): Admin pode criar e gerir scripts Playwright
- **RPA Automação** (`/rpa-automacao`): Execução de automações configuradas

---

## ✅ Refatoração do Backend - CONCLUÍDA (97.4%)

### Estado Final (23/01/2026)
| Componente | Endpoints |
|------------|-----------|
| **server.py** | **14** |
| **routes/*.py** | **514** |

### Taxa de Modularização: 97.4% ✅

---

## Funcionalidades Implementadas

### Sistema de Automação RPA
- RPA Designer (Admin) - Upload de scripts Playwright
- RPA Automático - Execução com credenciais encriptadas

### WhatsApp Business
- Envio de mensagens individuais
- Envio em massa para motoristas
- QR Code para autenticação por parceiro
- Multi-sessão (cada parceiro tem sessão própria)

### Gestão de Utilizadores
- Filtros por perfil, parceiro, data
- Ações admin: bloquear, revogar, alterar senha

### Integrações
- WhatsApp Web.js (Multi-sessão)
- Terabox
- Playwright

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Requisitos de Deployment

### Para WhatsApp funcionar em produção:
1. Instalar Chromium: `apt-get install -y chromium`
2. Verificar path: `/usr/bin/chromium`
3. Diretório de sessões: `/app/backend/whatsapp_service/.wwebjs_auth`

### Serviços necessários:
- Backend (FastAPI): porta 8001
- Frontend (React): porta 3000
- WhatsApp Service (Node.js): porta 3001
- MongoDB

---

## Tarefas Pendentes

### P1 - Alta Prioridade
- [ ] Validar WhatsApp no domínio tvdefleet.com após deployment
- [ ] Teste end-to-end do fluxo RPA Designer

### P2 - Média Prioridade  
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens
- [ ] Mover os 14 endpoints restantes para rotas

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
- [ ] Validar scripts RPA em ambiente com internet
