# 📊 Plano de Integrações - Sistema Resumo Semanal

## Visão Geral

O sistema de Resumo Semanal precisa de consolidar dados de 3 fontes principais:
1. **Bolt** - Rendimentos de viagens TVDE
2. **Uber** - Rendimentos de viagens TVDE  
3. **Via Verde** - Portagens e despesas de veículos

---

## 1. 🟢 BOLT - API Oficial (FUNCIONAL)

### Estado: ✅ Implementado e Funcional

### Método de Integração:
- API REST oficial da Bolt
- Autenticação via API Key + Secret
- Sincronização automática

### Dados Obtidos:
- Rendimentos por motorista
- Viagens realizadas
- Período semanal

### Ficheiros:
- `/app/backend/services/bolt_api.py`
- `/app/backend/routes/sincronizacao.py` (endpoint `/bolt/sincronizar`)

---

## 2. 🟡 UBER - API Oficial (EM CONFIGURAÇÃO)

### Estado: ⚠️ Credenciais OK, Aguarda Aprovação de Scopes

### Método de Integração:
- **API Get Driver Payments** (preferencial)
- Endpoint: `GET /v1/vehicle-suppliers/earners/payments`
- Autenticação: OAuth 2.0 Client Credentials
- Scope necessário: `supplier.partner.payments`

### Passos para Ativar:
1. [ ] Contactar Uber Developer Support
2. [ ] Solicitar aprovação do scope `supplier.partner.payments`
3. [ ] Configurar Agreement no Dashboard
4. [ ] Obter Organization ID (org_id)
5. [ ] Testar endpoint

### Limitações da API:
- Dados apenas das últimas 24 horas
- Necessita sincronização diária para histórico

### Alternativa (Backup):
- Upload manual de ficheiro CSV/Excel exportado do portal Uber Fleet
- Endpoint: `POST /uber/upload-relatorio`

### Ficheiros:
- `/app/backend/services/uber_api.py` (implementado)
- `/app/backend/routes/sincronizacao.py` (endpoint `/uber/sincronizar-api`)

### Credenciais Configuradas:
- Client ID: `uLB31BdXqDi4Ly2RF_SHhI3o4Cek4mJS`
- Client Secret: Configurado
- App Name: `tvdefleet`

---

## 3. 🟠 VIA VERDE - Integração ERP

### Estado: 🔄 A Investigar Opções

### Opções de Integração:

#### Opção A: API Via Verde Empresas
- Verificar se existe API para parceiros empresariais
- Contactar Via Verde para acesso

#### Opção B: Integração via ERP
- Moloni, PHC, Primavera, SAP
- Exportar dados do ERP que já tenha integração Via Verde

#### Opção C: Ficheiro SEPA/Extracto Bancário
- Via Verde envia ficheiro SEPA com movimentos
- Processar ficheiro automaticamente

#### Opção D: Web Scraping (RPA) - Atual
- Script Playwright para extrair dados
- **Problema**: Dificuldade com seletor de datas
- **Solução proposta**: Descarregar ficheiro completo e filtrar no backend

#### Opção E: Upload Manual
- Exportar CSV/Excel do portal Via Verde
- Upload no sistema

### Dados Necessários:
- Portagens por matrícula
- Data/hora da passagem
- Valor
- Local (opcional)

### Ficheiros Atuais:
- `/app/backend/services/rpa_viaverde_v2.py` (RPA com bugs)

---

## 4. 📱 Interface do Resumo Semanal

### Fluxo Proposto:

```
┌─────────────────────────────────────────────────────────────┐
│                    RESUMO SEMANAL                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    BOLT     │  │    UBER     │  │  VIA VERDE  │         │
│  │  ✅ Sync    │  │  🔄 Sync    │  │  📤 Upload  │         │
│  │  Automático │  │  API/Upload │  │  Manual     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CONSOLIDAÇÃO                                         │   │
│  │ - Rendimentos totais por motorista                   │   │
│  │ - Portagens por veículo                              │   │
│  │ - Cálculo de lucro líquido                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ RELATÓRIO                                            │   │
│  │ - Exportar PDF/Excel                                 │   │
│  │ - Enviar por email                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 📋 Tarefas de Implementação

### Fase 1: Upload Manual (Imediato)
- [ ] Criar endpoint upload ficheiro Uber (`/uber/upload-relatorio`)
- [ ] Criar endpoint upload ficheiro Via Verde (`/viaverde/upload-relatorio`)
- [ ] Adicionar UI para upload na página Resumo Semanal
- [ ] Parser para CSV/Excel da Uber
- [ ] Parser para CSV/Excel da Via Verde

### Fase 2: API Uber (Após aprovação)
- [ ] Obter aprovação do scope `supplier.partner.payments`
- [ ] Obter Organization ID
- [ ] Testar endpoint `/uber/sincronizar-api`
- [ ] Implementar sincronização diária automática

### Fase 3: Via Verde (Investigar)
- [ ] Contactar Via Verde sobre API empresarial
- [ ] Avaliar integração via ERP (Moloni/PHC)
- [ ] Ou melhorar RPA com filtro no backend

### Fase 4: Consolidação
- [ ] Unificar dados das 3 fontes
- [ ] Calcular métricas por motorista
- [ ] Gerar relatório consolidado
- [ ] Exportação PDF/Excel

---

## 6. 🗄️ Estrutura de Dados

### Tabela: `rendimentos_consolidados`
```javascript
{
  parceiro_id: string,
  semana: number,
  ano: number,
  motorista_id: string,
  motorista_nome: string,
  
  // Bolt
  bolt_bruto: number,
  bolt_comissao: number,
  bolt_liquido: number,
  
  // Uber
  uber_bruto: number,
  uber_comissao: number,
  uber_liquido: number,
  
  // Via Verde
  portagens_total: number,
  
  // Calculados
  total_bruto: number,
  total_liquido: number,
  lucro_final: number,
  
  created_at: datetime,
  updated_at: datetime
}
```

---

## 7. 🔧 Endpoints Necessários

| Endpoint | Método | Descrição | Estado |
|----------|--------|-----------|--------|
| `/bolt/sincronizar` | POST | Sync API Bolt | ✅ |
| `/uber/sincronizar-api` | POST | Sync API Uber | ⚠️ Aguarda scopes |
| `/uber/upload-relatorio` | POST | Upload ficheiro Uber | 🔲 A criar |
| `/viaverde/upload-relatorio` | POST | Upload ficheiro Via Verde | 🔲 A criar |
| `/viaverde/executar-rpa` | POST | RPA Via Verde | ⚠️ Com bugs |
| `/resumo-semanal/consolidar` | POST | Consolidar dados | 🔲 A criar |
| `/resumo-semanal/exportar` | GET | Exportar relatório | 🔲 A criar |

---

## 8. 📅 Cronograma Sugerido

### Semana 1: Upload Manual
- Implementar uploads Uber e Via Verde
- Testar com ficheiros reais
- UI funcional

### Semana 2: Consolidação
- Endpoint de consolidação
- Relatório básico
- Exportação

### Semana 3+: APIs
- Ativar API Uber (após aprovação)
- Investigar API Via Verde
- Automatizar sincronizações

---

## 9. 📞 Contactos Necessários

### Uber
- Developer Support: https://developer.uber.com/support
- Solicitar: Aprovação scope `supplier.partner.payments`

### Via Verde
- Suporte Empresas: Verificar opções de API/integração
- Ou: Integração via ERP parceiro

