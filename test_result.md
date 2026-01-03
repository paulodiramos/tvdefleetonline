backend:
  - task: "Vehicle Assignment History"
    implemented: true
    working: true
    file: "/app/backend/routes/vehicles.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "✅ Implemented - New endpoints for vehicle device management and assignment history. POST /api/vehicles/{id}/atribuir-motorista now creates history records with date/time, km, and devices."
      - working: true
        agent: "testing"
        comment: "✅ PHASE 1 VEHICLE MANAGEMENT ENDPOINTS FULLY TESTED (21/21 tests passed - 100% success). NEW ENDPOINTS WORKING: 1) GET/PUT /api/vehicles/{id}/dispositivos - Device management (OBU Via Verde, Cartões combustível) working perfectly. Vehicle AS-83-NX devices retrieved and updated successfully. 2) GET /api/vehicles/{id}/historico-atribuicoes - Assignment history with ganhos calculation working. 3) POST /api/vehicles/{id}/atribuir-motorista - Driver assignment with history creation working. Creates historico_id and data_atribuicao as expected. 4) All endpoints return proper data structures and handle authentication correctly. Vehicle ID 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7 tested successfully."

  - task: "Despesas Via Verde in Weekly Reports"
    implemented: true
    working: true
    file: "/app/backend/routes/relatorios.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "✅ Fixed - Updated gerar_relatorio_semanal in routes/relatorios.py to include imported despesas from despesas_fornecedor collection. Test with semana 1/2026 returned €81.30 Via Verde."
      - working: true
        agent: "testing"
        comment: "✅ COMPREHENSIVE TESTING COMPLETED - Via Verde weekly reports working perfectly! Test 1: Semana 1/2026 (29 dez-4 jan) correctly returned €81.30 Via Verde from 15-21 dezembro period (2-week delay applied). Test 2: Semana 52/2025 correctly returned €0.00 for period without expenses. Test 3: Delay calculation logic verified working. All 3 test cases passed with exact expected values."

  - task: "Despesas Import Logic Update"
    implemented: true
    working: true
    file: "/app/backend/routes/despesas.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ NEW LOGIC WORKING - Expenses assigned to motoristas! Resumo API shows €1517.37 for motoristas and €3851.39 for parceiro (updated values from latest test). Contract types 'aluguer', 'compra', 'slot' correctly assign expenses to motorista, while 'comissao' assigns to veiculo (parceiro). Total: €5368.76 across 3322 records."

  - task: "Report Delete Endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ DELETE /api/relatorios/semanal/{relatorio_id} working correctly. Successfully deleted report for parceiro user. API returns proper success message."

  - task: "Report Status Change Endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ PUT /api/relatorios/semanal/{relatorio_id}/status working correctly. Successfully changed status from 'unknown' to 'aprovado'. Valid statuses: rascunho, pendente_aprovacao, aprovado, aguarda_recibo, verificado, pago, rejeitado."

  - task: "List Reports for Parceiro"
    implemented: true
    working: true
    file: "/app/backend/routes/relatorios.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ GET /api/relatorios/semanais-todos working correctly. Returns 8 reports for parceiro user with proper filtering by parceiro_id (updated count from latest test)."

  - task: "CSV Import API"
    implemented: true
    working: true
    file: "/app/backend/routes/despesas.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ POST /api/despesas/importar working correctly. Successfully imported 3/3 test records with 3 vehicles found. Returns proper import statistics."

  - task: "Despesas List API"
    implemented: true
    working: true
    file: "/app/backend/routes/despesas.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ GET /api/despesas/ working correctly. Returns 10 despesas from total of 3325 records (updated count). Sample shows proper assignment: AS-83-NX → veiculo (€2.15)."

  - task: "Vehicle Costs Management API"
    implemented: true
    working: true
    file: "/app/backend/routes/vehicles.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ NEW VEHICLE COSTS ENDPOINTS WORKING PERFECTLY! 1) POST /api/vehicles/{id}/custos - Successfully adds costs to vehicle history. Tested with revisao (€150), seguro (€500), vistoria (€35). Returns custo_id and proper response structure. 2) GET /api/vehicles/{id}/custos - Returns costs list with totals by category. Vehicle AS-83-NX shows 3 costs totaling €685 with proper category grouping: revisao €150, seguro €500, vistoria €35. All valid categories supported: revisao, vistoria, seguro, pneus, reparacao, combustivel, lavagem, multa, outros."

  - task: "Vehicle ROI Report API"
    implemented: true
    working: true
    file: "/app/backend/routes/vehicles.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ VEHICLE ROI CALCULATION WORKING PERFECTLY! GET /api/vehicles/{id}/relatorio-ganhos endpoint tested with multiple scenarios: 1) Total period: Receitas €750, Custos €685, Lucro €65, ROI 9.49% - calculation verified correct. 2) Year filter (2026): Properly filters data by year. 3) Custom period: Correctly applies date range filters. ROI formula ((receitas - custos) / custos) * 100 working accurately. Cost categories properly grouped and revenue/cost breakdown detailed. All period types supported: total, ano, mes, custom."

frontend:
  - task: "RelatoriosSemanaisLista Page"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/RelatoriosSemanaisLista.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "testing"
        comment: "Frontend testing not performed as per system limitations. Backend APIs are working correctly to support frontend functionality."

metadata:
  created_by: "testing_agent"
  version: "1.4"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "Vehicle Costs Management API"
    - "Vehicle ROI Report API"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: "✅ ALL BACKEND TESTS PASSED (10/10 - 100% success rate). Key findings: 1) NEW EXPENSE LOGIC WORKING - €505.79 assigned to motoristas vs €2178.59 to parceiro, 2) Report delete API working for parceiro users, 3) Report status change API working with all valid statuses, 4) List reports API properly filtering by parceiro, 5) CSV import and despesas list APIs functioning correctly. All high-priority backend features are working as expected."
  - agent: "testing"
    message: "🎯 VIA VERDE WEEKLY REPORTS TESTING COMPLETED (14/14 tests passed - 100% success). PRIORITY TASK VERIFIED: Via Verde expenses from despesas_fornecedor collection are correctly included in weekly reports with proper via_verde_atraso_semanas=2 delay calculation. Test 1: Semana 1/2026 returned exact expected €81.30. Test 2: Semana 52/2025 correctly returned €0.00 for empty period. Test 3: Delay logic verified working. All backend APIs functioning perfectly. Updated expense totals: €1517.37 motoristas, €3851.39 parceiro from 3325 total records."
  - agent: "testing"
    message: "🚀 PHASE 1 VEHICLE MANAGEMENT ENDPOINTS COMPREHENSIVE TESTING COMPLETED (21/21 tests passed - 100% success rate). ALL NEW ENDPOINTS WORKING PERFECTLY: 1) GET /api/vehicles/{id}/dispositivos - Successfully retrieves vehicle devices (OBU Via Verde: 601073900511, Cartão Fossil: 7824731736480003). 2) PUT /api/vehicles/{id}/dispositivos - Successfully updates devices (tested with TEST-OBU-123, TEST-CARD-456). 3) GET /api/vehicles/{id}/historico-atribuicoes - Returns assignment history with motorista, dates, km, and ganhos_periodo calculation. 4) POST /api/vehicles/{id}/atribuir-motorista - Creates history records with historico_id and data_atribuicao as expected. Vehicle AS-83-NX (ID: 4ad331ff-c0f5-43c9-95b8-cc085d32d8a7) tested successfully. All endpoints handle authentication, return proper data structures, and integrate with historico_atribuicoes collection correctly."
  - agent: "testing"
    message: "🎯 NEW VEHICLE COSTS & ROI ENDPOINTS TESTING COMPLETED (31/31 tests passed - 100% success rate). COMPREHENSIVE TESTING OF NEW FEATURES: 1) POST /api/vehicles/{id}/custos - Successfully adds costs with all categories (revisao, vistoria, seguro, pneus, reparacao, combustivel, lavagem, multa, outros). Tested with €150 revisao, €500 seguro, €35 vistoria. Returns proper custo_id and response structure. 2) GET /api/vehicles/{id}/custos - Returns costs list with category totals. Vehicle AS-83-NX shows €685 total across 3 costs with proper grouping. 3) GET /api/vehicles/{id}/relatorio-ganhos - ROI calculation working perfectly! Receitas €750, Custos €685, Lucro €65, ROI 9.49%. Formula ((receitas-custos)/custos)*100 verified correct. Supports all period filters: total, ano, mes, custom. All new endpoints handle authentication, data validation, and return proper JSON structures. Vehicle financial management system fully operational!"