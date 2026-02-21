# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE (Uber, Bolt, etc.) com funcionalidades completas para parceiros e administradores.

## Última Atualização
**Data:** Fevereiro 2026
**Sessão:** Correção de bug no cálculo de datas da sincronização Uber

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

### ✅ Correção RPA Uber (Fevereiro 2026)
- **Bug corrigido:** Cálculo de datas para sincronização semanal
- O sistema agora calcula correctamente semanas de Segunda a Domingo
- `semana_index=0` = semana atual, `semana_index=1` = semana passada, etc.
- Ficheiro corrigido: `backend/routes/uber_sync.py`

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
- [x] ~~Corrigir cálculo de datas para sincronização Uber~~ ✓ CORRIGIDO
- [ ] Verificar persistência da sessão Uber durante sincronização
- [ ] Verificar persistência da base de dados Docker

### P1 - Alta Prioridade
- [ ] Sistema de backup/restauração para Admin
- [ ] Corrigir importação Via Verde
- [ ] Configurar domínio tvdefleet.com com SSL
- [ ] UI completa para abas WhatsApp Cloud (Alertas, Templates, Histórico)

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
│   │   └── uber_sync.py # Sincronização Uber (corrigido)
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
- **Admin:** admin@tvdefleet.com / 123456
- **Parceiro:** geral@zmbusines.com / 123456

---

## Notas para Continuação
- A integração WhatsApp Cloud está completa mas inativa (falta token da Meta)
- Ficheiros de deployment prontos em `/app/deployment/`
- VPS alvo: 94.46.171.222
- **Cálculo de datas Uber corrigido** - usar semana_index para seleccionar semana
