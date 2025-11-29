# Lista Completa de Bugs e Funcionalidades - TVDEFleet

## 🔴 BUGS CRÍTICOS (Prioridade Máxima)

### Perfil Motorista:
1. ❌ Dashboard - adicionar seleção data/semana/todos
2. ❌ Download contrato - erro runtime
3. ❌ Notificações recibo pendente - link errado (deve ir para /recibos-ganhos)
4. ❌ Download PDF relatório semanal ganhos
5. ❌ Download comprovativo - erro
6. ❌ Ver recibo - erro
7. ❌ Trocar recibo após pagamento - não deve permitir
8. ❌ Download recibo após pagamento - implementar

### Perfil Parceiro:
9. ❌ Dashboard - adicionar seleção período (início/fim)
10. ❌ Ver/download recibo em popup
11. ❌ Remover comprovativo e recibo
12. ❌ Estado "liquidado" ao adicionar comprovativo

### Perfil Gestor:
13. ❌ Dashboard - selecionar datas/semanas/parceiro
14. ❌ Erro carregar permissões
15. ❌ Erro carregar parceiros
16. ❌ Erro carregar contratos
17. ❌ Erro carregar pagamentos

## 🟡 FUNCIONALIDADES NOVAS (Alta Prioridade)

### 1. Dashboard Veículo
- [ ] 4 cards (Revisão, Seguro, Inspeção, Extintor)
- [ ] Adicionar card "Próxima Vistoria"
- [ ] Cards clicáveis para abas correspondentes
- [ ] Integrar com VehicleMaintenanceCard existente

### 2. Sistema Vistorias (Expandir existente)
- [x] CRUD básico (já implementado)
- [ ] Agenda de vistorias
- [ ] Histórico com fotos
- [ ] Conversão fotos danos em PDF
- [ ] Integração com plano manutenções/alertas

### 3. Download Documentos (Parceiro)
- [ ] Download documentos do motorista
- [ ] Botão na lista de motoristas

### 4. Sistema Pagamentos/Recibos (Melhorias)
- [ ] Ver relatório ganhos detalhado (sem download)
- [ ] Download comprovativo sempre disponível
- [ ] Download recibo após inserção
- [ ] Estado "liquidado" obriga comprovativo
- [ ] Popup visualização recibo
- [ ] Confirmação recibo (correto/errado + observação)

### 5. Sistema Mensagens/Tickets
- [ ] Mensagens entre empresa (motorista-operacional)
- [ ] Mensagens frota (motorista-parceiro-gestor)
- [ ] Tickets técnicos para admin (todos perfis)
- [ ] Visualizado/não visualizado
- [ ] Integração com planos

### 6. CSV Import & Sync Auto
- [ ] Import CSV ganhos Uber/Bolt
- [ ] Import CSV KM
- [ ] Sincronização automática
- [ ] Verificação módulos ativos

### 7. Sistema Envio Relatórios
- [ ] Envio manual/automático
- [ ] WhatsApp ou Email
- [ ] Por semana ou entre datas
- [ ] Para motoristas e parceiros
- [ ] Confirmação parceiro (correto/errado)

### 8. Preços Módulos
- [ ] Admin define preços por módulo
- [ ] Interface gestão preços
- [ ] Cálculo automático planos

## 🟢 FUNCIONALIDADES MÉDIAS (Média Prioridade)

### Operacional:
- [ ] Dashboard com seleção datas/semanas
- [ ] Mesmo sistema veículos do parceiro
- [ ] Adicionar novos motoristas
- [ ] Lista pagamentos ativa
- [ ] CSV import se módulo ativo

### Gestor:
- [ ] Aceitar documentos motoristas
- [ ] Admin define parceiros atribuídos
- [ ] Acesso total exceto configurações/módulos

## 📋 ESTRUTURA DE IMPLEMENTAÇÃO SUGERIDA

### Fase 1: Correções Críticas (1-2 horas)
1. Corrigir erros download/visualização
2. Corrigir dashboards com seleção datas
3. Corrigir links notificações
4. Corrigir estados pagamentos

### Fase 2: Dashboard Veículo (30 min)
1. Adicionar card vistoria
2. Tornar cards clicáveis

### Fase 3: Sistema Mensagens (1 hora)
1. Backend: modelos e endpoints
2. Frontend: UI básica
3. Integração com planos

### Fase 4: CSV Import (30 min)
1. Expandir imports existentes
2. Verificação módulos

### Fase 5: Envio Relatórios (1 hora)
1. Backend: integração email/whatsapp
2. Frontend: UI configuração
3. Agendamento automático

## 🎯 ESTIMATIVA TOTAL
- Bugs Críticos: 2-3 horas
- Funcionalidades Novas: 3-4 horas
- **Total:** 5-7 horas trabalho

## 📝 NOTAS
- Sistema vistorias já tem 80% implementado
- Sistema módulos já está funcional
- Filtros já implementados em 3 páginas
- Muitos componentes reutilizáveis disponíveis
