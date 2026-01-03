# Test Results - TVDEFleet FleetManager

## Last Updated: 2026-01-03

## Testing Context
- Testing updated expense assignment logic
- Testing multi-select and bulk delete for reports

## Test Scenarios to Verify

### Backend Tests
1. **Despesas Logic Update:**
   - Contract type "aluguer", "compra", "slot" → expense goes to motorista
   - Contract type "comissao" → expense goes to veiculo (parceiro)

2. **Report Bulk Actions:**
   - DELETE /api/relatorios/semanal/{id} - Delete single report
   - PUT /api/relatorios/semanal/{id}/status - Change status

### Frontend Tests - RelatoriosSemanaisLista
1. Page loads at /relatorios-semanais-lista (parceiro login)
2. Shows statistics (Total, Pendentes, Aprovados, Rejeitados)
3. "Selecionar Todos" checkbox works
4. Individual checkboxes select reports
5. Bulk actions bar appears when items selected:
   - "X relatório(s) selecionado(s)" text
   - "Alterar Estado" button
   - "Eliminar Selecionados" button
   - "Limpar Seleção" button
6. Delete confirmation dialog with warning
7. Status change modal with dropdown

### Import Stats (Via Verde with new logic)
- Total records: 829
- Vehicles found: 752
- Drivers associated: 348
- Valor Motoristas: €505.79 (was €0.00)
- Valor Parceiro: €832.00 (was €1337.79)

## Incorporate User Feedback
- Expense logic updated for contract types
- Reports multi-select and bulk delete implemented
