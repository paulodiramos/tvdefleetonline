# TVDEFleet - Product Requirements Document

## Visão Geral
Sistema de gestão de frotas TVDE (Uber, Bolt, etc.) com funcionalidades completas para parceiros e administradores.

## Última Atualização
**Data:** 21 Fevereiro 2026
**Sessão:** Implementação da funcionalidade RPA "Login" vs "Extração"

---

## O Que Foi Implementado

### ✅ RPA Designer - Designs Login vs Extração (Fevereiro 2026) 🆕
- **Nova funcionalidade:** Separação de designs em dois tipos: "Login" e "Extração"
- **Backend:**
  - Endpoint `GET /api/rpa-designer/designs` suporta filtro `tipo_design` (login/extracao)
  - Endpoint `POST /api/rpa-designer/sessao/iniciar` aceita parâmetro `tipo_design`
  - Endpoint `POST /api/rpa-designer/sessao/{id}/guardar` guarda o `tipo_design`
  - Novo endpoint `GET /api/rpa-designer/designs-sincronizacao/{plataforma_id}/{semana}` para verificar designs disponíveis
  - Novo endpoint `POST /api/rpa-designer/executar-sincronizacao` para execução sequencial
- **Frontend:**
  - Secção "Tipo de Design" com botões "Login" e "Extração"
  - Contadores de designs gravados por tipo
  - Indicadores de semana actualizados por tipo de design
  - Texto de ajuda dinâmico
- **Ficheiros modificados:**
  - `backend/routes/rpa_designer.py`
  - `frontend/src/pages/RPADesigner.js`
- **Testes:** 100% passaram (10/10 backend, UI verificada)

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
- O sistema agora calcula correctamente semanas de Domingo a Sábado (formato Uber)
- `semana_index=0` = semana atual, `semana_index=1` = semana passada, etc.

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
- [x] ~~Implementar funcionalidade Login vs Extração no RPA~~ ✓ IMPLEMENTADO
- [ ] **Verificar persistência da base de dados Docker** (dados apagados ao fazer docker-compose down)

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
- [ ] Resolver warning React "duplicate keys" no Dashboard

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
│   ├── routes/
│   │   ├── rpa_designer.py  # RPA Designer (Login/Extração) ✨ MODIFICADO
│   │   └── uber_sync.py     # Sincronização Uber
│   ├── services/            # Lógica de negócio
│   ├── models/              # Modelos Pydantic
│   └── server.py            # Entry point
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── RPADesigner.js  # UI RPA Designer ✨ MODIFICADO
│       └── components/
└── deployment/              # Ficheiros Docker/VPS
```

### Schema BD - designs_rpa
```javascript
{
  "id": "uuid",
  "plataforma_id": "uuid",
  "nome": "string",
  "semana_offset": 0-3,
  "tipo_design": "login" | "extracao",  // 🆕 NOVO CAMPO
  "passos": [...],
  "versao": 1,
  "ativo": true
}
```

---

## Credenciais de Teste
- **Admin:** admin@tvdefleet.com / 123456
- **Parceiro:** geral@zmbusines.com / 123456

---

## Notas para Continuação
- **RPA Designer:** A funcionalidade de "Login" vs "Extração" permite criar designs separados para cada fase. O design de Login pode ser executado manualmente para resolver CAPTCHA, e o de Extração pode correr automatizado.
- **CAPTCHA Uber:** O sistema ainda requer intervenção manual para resolver CAPTCHA. A separação Login/Extração facilita este processo.
- A integração WhatsApp Cloud está completa mas inativa (falta token da Meta)
- **✅ RESOLVIDO:** Volumes MongoDB agora são persistentes (não serão apagados com docker-compose down)
- VPS alvo: 94.46.171.222

---

## Deployment VPS (22 Fevereiro 2026)

### ✅ Configuração Auto-Start Implementada:
- `docker-compose.yml` - Todos os serviços com `restart: always`
- `install-vps.sh` - Script de instalação completo
- `backup-db.sh` / `restore-db.sh` - Scripts de backup MongoDB
- `status.sh` - Script de monitorização
- Serviço systemd `tvdefleet.service` para auto-start no boot
- Volumes nomeados para persistência de dados:
  - `tvdefleet_mongodb_data` - Dados MongoDB
  - `tvdefleet_rpa_sessions` - Sessões de login RPA
  - `tvdefleet_uploads` - Ficheiros enviados

### RPA Uber:
- **Design de Login** (9 passos) - Para autenticação manual
- **Design de Extração** (17 passos) - Para gerar e descarregar relatórios
- **Cálculo de datas** corrigido para formato Uber (Segunda 4:03 AM a Segunda 4:00 AM)

