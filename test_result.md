# Test Results - TVDEFleet FleetManager

## Last Updated: 2026-01-03

## Testing Context
- Testing new CSV Import feature for Via Verde expenses
- Automatic association with vehicles and drivers

## Test Scenarios to Verify

### Backend API Tests
1. POST /api/despesas/preview - Preview CSV/XLSX file before import
2. POST /api/despesas/importar - Import expenses with automatic association
3. GET /api/despesas/ - List all imported expenses
4. GET /api/despesas/resumo - Get expense summary
5. GET /api/despesas/importacoes - List import history
6. GET /api/despesas/por-veiculo/{id} - Get expenses for specific vehicle
7. GET /api/despesas/por-motorista/{id} - Get expenses for specific driver

### Import Logic to Verify
- Matricula (license plate) is correctly identified
- Vehicle is found by matricula
- Motorista is associated via vehicle assignment
- Tipo responsavel is determined:
  - If vehicle is "aluguer" type → motorista
  - If Via Verde associated with motorista → motorista  
  - Otherwise → veiculo (parceiro)

### Frontend Tests
1. /importar-despesas page loads with summary cards
2. File upload dropzone works
3. Preview shows column mapping and sample data
4. Import creates records and updates statistics
5. Import history table shows completed imports
6. Recent expenses table shows imported data

## Current Import Stats (Via Verde Test)
- Total records: 829
- Vehicles found: 752
- Drivers associated: 348
- Total value: €1,337.79
- Motoristas: €0.00
- Parceiro: €1,337.79

## Incorporate User Feedback
- CSV import for Via Verde (COMPLETED)
