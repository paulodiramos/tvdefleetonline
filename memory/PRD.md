# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE (Uber, Bolt, etc.) com funcionalidades completas para parceiros e administradores.

## Última Atualização
**Data:** Dezembro 2025
**Sessão:** Preparação de deployment para VPS

---

## O Que Foi Implementado

### ✅ Funcionalidades Core (Completas)
- Dashboard com métricas e gráficos
- Gestão de veículos e motoristas
- Sistema de parceiros com multi-tenancy
- Relatórios semanais automáticos
- Sistema de alertas e notificações
- Gestão de documentos com upload
- Sistema de vistorias
- Importação de dados (Uber, Bolt, Via Verde)
- RPA para extração automática de dados

### ✅ WhatsApp Cloud API (Dezembro 2025)
- **Status:** Code-complete, aguarda credenciais
- Serviço de integração com API oficial Meta
- Endpoints para envio em massa
- Templates de mensagem pré-definidos
- Sistema de agendamento de tarefas
- UI para gestão de mensagens

### ✅ Deployment (Dezembro 2025)
- Dockerfiles para backend e frontend
- Docker Compose para orquestração
- Configuração Nginx com SSL
- Scripts de instalação e gestão
- Guia de instalação completo

---

## Backlog Priorizado

### P0 - Crítico
- [ ] Configurar credenciais WhatsApp Cloud API
- [ ] Deploy no VPS 94.46.171.222

### P1 - Alta Prioridade
- [ ] UI completa para abas WhatsApp Cloud (Alertas, Templates, Histórico)
- [ ] UI para configuração de agendamento de relatórios
- [ ] Ativar OAuth para cloud storage (Google Drive, etc.)

### P2 - Média Prioridade
- [ ] Remover código legacy whatsapp-web.js
- [ ] Refatorar FichaVeiculo.js
- [ ] Bug navegação ficha veículo
- [ ] Verificar edição categorias planos

### P3 - Baixa Prioridade
- [ ] Sistema de alertas avançados
- [ ] Arquivamento de dados antigos
- [ ] App móvel - relógio de ponto
- [ ] Investigar instabilidade scraper Prio

---

## Arquitetura Técnica

### Stack
- **Frontend:** React 19 + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python 3.11)
- **Base de Dados:** MongoDB 7.0
- **Deployment:** Docker + Docker Compose + Nginx

### Estrutura de Ficheiros Principais
```
/app
├── backend/
│   ├── routes/          # Endpoints API
│   ├── services/        # Lógica de negócio
│   ├── models/          # Modelos Pydantic
│   └── server.py        # Entry point
├── frontend/
│   └── src/
│       ├── pages/       # Páginas React
│       └── components/  # Componentes UI
└── deployment/          # Ficheiros Docker/VPS
```

---

## Credenciais de Teste
- **Admin:** admin@tvdefleet.com / Admin123!
- **Parceiro:** geral@zmbusines.com / Admin123!

---

## Notas para Continuação
- A integração WhatsApp Cloud está completa mas inativa (falta token da Meta)
- Ficheiros de deployment prontos em `/app/deployment/`
- VPS alvo: 94.46.171.222
