# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE completo com funcionalidades avançadas de gestão de motoristas, veículos, financeiro e automações RPA.

## Arquitetura
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Automação**: Playwright (Python)
- **WhatsApp**: whatsapp-web.js (Node.js) com Chromium (auto-instalação)

---

## ✅ Alterações desta Sessão (24/01/2026)

### 1. Sistema de Plataformas Personalizadas no RPA
- ✅ **Backend**: Endpoints CRUD para criar/editar/eliminar plataformas
  - `POST /api/rpa-auto/plataformas` - Criar nova plataforma
  - `PUT /api/rpa-auto/plataformas/{id}` - Actualizar plataforma
  - `DELETE /api/rpa-auto/plataformas/{id}` - Eliminar plataforma
- ✅ **Frontend**: Botão "Nova Plataforma" (apenas admin)
- ✅ **Frontend**: Modal de criação com campos: nome, ícone, cor, URL login, tipos extração, 2FA
- ✅ **Frontend**: Badge "Personalizada" para distinguir das pré-definidas
- ✅ **Frontend**: Botão eliminar para plataformas personalizadas
- ✅ **Plataformas pré-definidas** protegidas (Uber, Bolt, Via Verde, Prio)

### 2. Página Configuração Mapeamento
- ✅ Menu superior sempre visível (usa Layout)
- ✅ Botão de voltar adicionado

### 3. Configurações por Parceiro
- ✅ Tab Terabox adicionada
- ✅ Templates de mensagem WhatsApp para eventos/vistorias

### 4. Sistema Automático de Chromium
- ✅ Auto-detecção e instalação do Chromium
- ✅ Endpoints de diagnóstico `/health` e `/system-info`

---

## Sistema RPA - Plataformas

### Pré-definidas (protegidas)
- Uber Driver
- Bolt Fleet
- Via Verde Empresas
- Prio Energy

### Personalizadas (admin pode criar)
- Galp Frota (exemplo criado)
- [Admin pode adicionar mais via interface]

---

## Credenciais de Teste
- Admin: `admin@tvdefleet.com` / `123456`
- Parceiro: `geral@zmbusines.com` / `zmpt2024`

---

## Tarefas Concluídas
- ✅ Sistema de criar plataformas personalizadas no RPA
- ✅ Menu e botão voltar na página de mapeamento
- ✅ Terabox configurado por parceiro
- ✅ Templates WhatsApp para eventos/vistorias
- ✅ Auto-instalação do Chromium

## Tarefas Pendentes

### P2 - Média Prioridade
- [ ] Limitar "Próximos Eventos" no dashboard a 3 itens

### P3 - Baixa Prioridade
- [ ] Limpeza de código comentado no server.py
