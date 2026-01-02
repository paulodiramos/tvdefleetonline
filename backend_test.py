#!/usr/bin/env python3
"""
TVDEFleet Backend Testing Suite - Review Request Specific Tests
Tests for Tarefas 2, 3 e 4 implementadas
"""

import requests
import json
import os
import tempfile
import time
from PIL import Image
import io
import base64
from pathlib import Path

# Get backend URL from frontend .env
BACKEND_URL = "https://fleetmaster-45.preview.emergentagent.com/api"

# Test credentials (from review request)
TEST_CREDENTIALS = {
    "admin": {"email": "admin@tvdefleet.com", "password": "o72ocUHy"},
    "parceiro": {"email": "parceiro@tvdefleet.com", "password": "UQ1B6DXU"}
}

class TVDEFleetTester:
    def __init__(self):
        self.tokens = {}
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📋 RESUMO DOS TESTES")
        print("="*80)
        
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {result['test']}: {result['message']}")
            if result["details"]:
                print(f"   Details: {result['details']}")
        
        print("="*80)
    
    def get_test_summary(self):
        """Get test results summary statistics"""
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["success"])
        failed = total - passed
        
        return {
            "total": total,
            "passed": passed,
            "failed": failed
        }
    
    def authenticate_user(self, role):
        """Authenticate user and store token"""
        try:
            creds = TEST_CREDENTIALS[role]
            response = requests.post(f"{BACKEND_URL}/auth/login", json=creds)
            
            if response.status_code == 200:
                data = response.json()
                self.tokens[role] = data["access_token"]
                self.log_result(f"Auth-{role}", True, f"Successfully authenticated as {role}")
                return True
            else:
                self.log_result(f"Auth-{role}", False, f"Failed to authenticate: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result(f"Auth-{role}", False, f"Authentication error: {str(e)}")
            return False
    
    def get_headers(self, role):
        """Get authorization headers for role"""
        if role not in self.tokens:
            return None
        return {"Authorization": f"Bearer {self.tokens[role]}"}
    
    def test_review_request_critical_tests(self):
        """🎯 VERIFICAÇÃO FINAL: Tarefas P2 implementadas"""
        print("\n🎯 VERIFICAÇÃO FINAL: Tarefas P2 implementadas")
        print("=" * 80)
        print("CREDENCIAIS:")
        print("- Parceiro: parceiro@tvdefleet.com / UQ1B6DXU")
        print("\nTESTES A REALIZAR:")
        print("1. Sistema de Ficheiros Importados")
        print("2. Importação com Registo Automático")
        print("3. Aprovação com Criação de Relatórios")
        print("4. Agenda de Veículos")
        print("=" * 80)
        
        # Execute all critical tests
        self.test_sistema_ficheiros_importados()
        self.test_importacao_registo_automatico()
        self.test_aprovacao_criacao_relatorios()
        self.test_agenda_veiculos()
        
        return True
    
    def test_sistema_ficheiros_importados(self):
        """1. Sistema de Ficheiros Importados: GET /api/ficheiros-importados"""
        print("\n📋 1. Sistema de Ficheiros Importados")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/ficheiros-importados - verificar se lista ficheiros")
        print("- Verificar se ficheiro tem status 'aprovado'")
        print("- Verificar se tem informação de quem aprovou e quando")
        
        # Authenticate as parceiro
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Sistema-Ficheiros-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # Test: GET /api/ficheiros-importados
            print("\nTestando GET /api/ficheiros-importados")
            response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
            
            if response.status_code == 200:
                ficheiros = response.json()
                self.log_result("Sistema-Ficheiros-GET", True, 
                              f"✅ GET /api/ficheiros-importados funciona: {len(ficheiros)} ficheiros encontrados")
                
                # Check for approved files with approval info
                approved_files = [f for f in ficheiros if f.get('status') == 'aprovado']
                
                if approved_files:
                    approved_file = approved_files[0]
                    has_approver = 'aprovado_por' in approved_file
                    has_approval_date = 'aprovado_em' in approved_file
                    
                    if has_approver and has_approval_date:
                        self.log_result("Sistema-Ficheiros-Approval-Info", True, 
                                      f"✅ Ficheiro aprovado tem informação completa: aprovado_por={approved_file.get('aprovado_por')}, aprovado_em={approved_file.get('aprovado_em')}")
                    else:
                        self.log_result("Sistema-Ficheiros-Approval-Info", False, 
                                      f"❌ Ficheiro aprovado sem informação completa: aprovado_por={has_approver}, aprovado_em={has_approval_date}")
                else:
                    self.log_result("Sistema-Ficheiros-No-Approved", True, 
                                  "ℹ️ Nenhum ficheiro com status 'aprovado' encontrado (normal se não houver aprovações)")
                
            elif response.status_code == 404:
                self.log_result("Sistema-Ficheiros-GET", False, 
                              "❌ Endpoint GET /api/ficheiros-importados não implementado (404)")
            else:
                self.log_result("Sistema-Ficheiros-GET", False, 
                              f"❌ GET /api/ficheiros-importados falhou: {response.status_code}")
                print(f"   Erro: {response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Sistema-Ficheiros-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_importacao_registo_automatico(self):
        """2. Importação com Registo Automático"""
        print("\n📋 2. Importação com Registo Automático")
        print("-" * 60)
        print("TESTES:")
        print("- Criar novo ficheiro CSV de teste")
        print("- POST /api/importar/viaverde com periodo_inicio=2026-01-01 e periodo_fim=2026-01-07")
        print("- Verificar se retorna 'ficheiro_importado_id' na resposta")
        print("- GET /api/ficheiros-importados - verificar se novo ficheiro aparece com status 'pendente'")
        
        # Authenticate as parceiro
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Importacao-Automatica-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # Create test CSV file as specified in review request
            csv_content = """data;hora;CardCode;posto;kwh;valor_total;duracao_min
02/01/2026;16:00:00;PTPRIO9050324927265598;ESTACAO-NOVA;20.0;10.00;30"""
            
            print("\nCriando ficheiro CSV de teste conforme especificação:")
            print(csv_content)
            
            # Get initial count of files
            initial_response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
            initial_count = 0
            if initial_response.status_code == 200:
                initial_count = len(initial_response.json())
            
            # Test: POST /api/importar/viaverde with specific date range
            files = {
                'file': ('test_viaverde_2026.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            data = {
                'periodo_inicio': '2026-01-01',
                'periodo_fim': '2026-01-07'
            }
            
            print(f"\nTestando POST /api/importar/viaverde com periodo_inicio=2026-01-01 e periodo_fim=2026-01-07")
            import_response = requests.post(
                f"{BACKEND_URL}/importar/viaverde", 
                files=files, 
                data=data,
                headers=headers
            )
            
            if import_response.status_code == 200:
                import_result = import_response.json()
                
                # Check if response contains ficheiro_importado_id
                has_ficheiro_id = 'ficheiro_importado_id' in import_result
                
                if has_ficheiro_id:
                    ficheiro_id = import_result['ficheiro_importado_id']
                    self.log_result("Importacao-Automatica-Response", True, 
                                  f"✅ Resposta contém 'ficheiro_importado_id': {ficheiro_id}")
                    
                    # Verify new file appears in list with 'pendente' status
                    print(f"\nVerificando se novo ficheiro aparece na lista com status 'pendente'")
                    updated_response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
                    
                    if updated_response.status_code == 200:
                        updated_files = updated_response.json()
                        new_count = len(updated_files)
                        
                        if new_count > initial_count:
                            # Find the new file
                            new_file = None
                            for file in updated_files:
                                if file.get('id') == ficheiro_id:
                                    new_file = file
                                    break
                            
                            if new_file and new_file.get('status') == 'pendente':
                                self.log_result("Importacao-Automatica-Status", True, 
                                              f"✅ Novo ficheiro aparece com status 'pendente': {new_file.get('nome_ficheiro', 'N/A')}")
                            else:
                                status = new_file.get('status') if new_file else 'file not found'
                                self.log_result("Importacao-Automatica-Status", False, 
                                              f"❌ Novo ficheiro não tem status 'pendente': {status}")
                        else:
                            self.log_result("Importacao-Automatica-Count", False, 
                                          f"❌ Número de ficheiros não aumentou: {initial_count} -> {new_count}")
                    else:
                        self.log_result("Importacao-Automatica-List", False, 
                                      f"❌ Não foi possível verificar lista atualizada: {updated_response.status_code}")
                else:
                    self.log_result("Importacao-Automatica-Response", False, 
                                  "❌ Resposta não contém 'ficheiro_importado_id'")
                    print(f"   Resposta: {import_result}")
            else:
                self.log_result("Importacao-Automatica-Import", False, 
                              f"❌ POST /api/importar/viaverde falhou: {import_response.status_code}")
                print(f"   Erro: {import_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Importacao-Automatica-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_aprovacao_criacao_relatorios(self):
        """3. Aprovação com Criação de Relatórios"""
        print("\n📋 3. Aprovação com Criação de Relatórios")
        print("-" * 60)
        print("TESTES:")
        print("- PUT /api/ficheiros-importados/{id}/aprovar no novo ficheiro")
        print("- Verificar se resposta inclui informação sobre 'rascunhos' criados")
        
        # Authenticate as parceiro
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Aprovacao-Relatorios-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # Get list of files to find a pendente file to approve
            response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
            
            if response.status_code == 200:
                ficheiros = response.json()
                
                # Find a file with status 'pendente'
                pendente_file = None
                for file in ficheiros:
                    if file.get('status') == 'pendente':
                        pendente_file = file
                        break
                
                if pendente_file:
                    file_id = pendente_file['id']
                    file_name = pendente_file.get('nome_ficheiro', 'N/A')
                    
                    print(f"\nTestando PUT /api/ficheiros-importados/{file_id}/aprovar")
                    print(f"Ficheiro: {file_name}")
                    
                    # Test: PUT /api/ficheiros-importados/{id}/aprovar
                    approve_response = requests.put(
                        f"{BACKEND_URL}/ficheiros-importados/{file_id}/aprovar", 
                        headers=headers
                    )
                    
                    if approve_response.status_code == 200:
                        approve_result = approve_response.json()
                        
                        # Check if response includes information about 'rascunhos' created
                        has_rascunhos_info = any(key in approve_result for key in ['rascunhos', 'rascunhos_criados', 'relatorios_criados', 'relatorios'])
                        
                        if has_rascunhos_info:
                            rascunhos_info = approve_result.get('rascunhos') or approve_result.get('rascunhos_criados') or approve_result.get('relatorios_criados') or approve_result.get('relatorios')
                            self.log_result("Aprovacao-Relatorios-Rascunhos", True, 
                                          f"✅ Resposta inclui informação sobre rascunhos: {rascunhos_info}")
                        else:
                            self.log_result("Aprovacao-Relatorios-Rascunhos", False, 
                                          "❌ Resposta não inclui informação sobre 'rascunhos' criados")
                            print(f"   Resposta: {approve_result}")
                        
                        self.log_result("Aprovacao-Relatorios-Success", True, 
                                      f"✅ PUT /api/ficheiros-importados/{file_id}/aprovar funcionou")
                    else:
                        self.log_result("Aprovacao-Relatorios-Failed", False, 
                                      f"❌ PUT /api/ficheiros-importados/{file_id}/aprovar falhou: {approve_response.status_code}")
                        print(f"   Erro: {approve_response.text}")
                else:
                    self.log_result("Aprovacao-Relatorios-No-Pendente", False, 
                                  "❌ Nenhum ficheiro com status 'pendente' encontrado para aprovar")
            else:
                self.log_result("Aprovacao-Relatorios-List", False, 
                              f"❌ Não foi possível obter lista de ficheiros: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Aprovacao-Relatorios-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_agenda_veiculos(self):
        """4. Agenda de Veículos"""
        print("\n📋 4. Agenda de Veículos")
        print("-" * 60)
        print("TESTES:")
        print("- GET /api/vehicles - buscar um veículo")
        print("- POST /api/vehicles/{id}/agenda - adicionar evento de vistoria")
        print("- GET /api/vehicles/{id}/agenda - verificar se evento foi adicionado")
        
        # Authenticate as parceiro
        headers = self.get_headers("parceiro")
        if not headers:
            self.log_result("Agenda-Veiculos-Auth", False, "❌ No auth token for parceiro")
            return False
        
        try:
            # Test 1: GET /api/vehicles
            print("\n1. Testando GET /api/vehicles")
            vehicles_response = requests.get(f"{BACKEND_URL}/vehicles", headers=headers)
            
            if vehicles_response.status_code == 200:
                vehicles = vehicles_response.json()
                
                if len(vehicles) == 0:
                    self.log_result("Agenda-Veiculos-No-Vehicles", False, "❌ Nenhum veículo encontrado")
                    return False
                
                self.log_result("Agenda-Veiculos-GET", True, 
                              f"✅ GET /api/vehicles funcionou: {len(vehicles)} veículos encontrados")
                
                # Select first vehicle for testing
                test_vehicle = vehicles[0]
                vehicle_id = test_vehicle['id']
                vehicle_info = f"{test_vehicle.get('marca', 'N/A')} {test_vehicle.get('modelo', 'N/A')} - {test_vehicle.get('matricula', 'N/A')}"
                
                print(f"Veículo selecionado: {vehicle_info} (ID: {vehicle_id})")
                
                # Test 2: POST /api/vehicles/{id}/agenda - add inspection event
                print(f"\n2. Testando POST /api/vehicles/{vehicle_id}/agenda")
                
                agenda_event = {
                    "tipo": "inspecao",
                    "titulo": "Inspeção Periódica Teste",
                    "data": "2026-02-01",
                    "hora": "10:00",
                    "descricao": "Teste de agendamento de vistoria"
                }
                
                print(f"Evento a adicionar: {agenda_event}")
                
                add_event_response = requests.post(
                    f"{BACKEND_URL}/vehicles/{vehicle_id}/agenda", 
                    json=agenda_event,
                    headers=headers
                )
                
                if add_event_response.status_code == 200:
                    self.log_result("Agenda-Veiculos-POST", True, 
                                  "✅ POST /api/vehicles/{id}/agenda funcionou")
                    
                    # Test 3: GET /api/vehicles/{id}/agenda - verify event was added
                    print(f"\n3. Testando GET /api/vehicles/{vehicle_id}/agenda")
                    
                    get_agenda_response = requests.get(
                        f"{BACKEND_URL}/vehicles/{vehicle_id}/agenda", 
                        headers=headers
                    )
                    
                    if get_agenda_response.status_code == 200:
                        agenda = get_agenda_response.json()
                        
                        # Check if our test event is in the agenda
                        test_event_found = False
                        for event in agenda:
                            if (event.get('titulo') == 'Inspeção Periódica Teste' and 
                                event.get('tipo') == 'inspecao' and
                                event.get('data') == '2026-02-01'):
                                test_event_found = True
                                break
                        
                        if test_event_found:
                            self.log_result("Agenda-Veiculos-GET-Verify", True, 
                                          f"✅ Evento foi adicionado à agenda: {len(agenda)} eventos total")
                        else:
                            self.log_result("Agenda-Veiculos-GET-Verify", False, 
                                          f"❌ Evento não encontrado na agenda: {len(agenda)} eventos total")
                            print(f"   Eventos na agenda: {[e.get('titulo') for e in agenda]}")
                        
                        self.log_result("Agenda-Veiculos-GET-Agenda", True, 
                                      "✅ GET /api/vehicles/{id}/agenda funcionou")
                    else:
                        self.log_result("Agenda-Veiculos-GET-Agenda", False, 
                                      f"❌ GET /api/vehicles/{id}/agenda falhou: {get_agenda_response.status_code}")
                        print(f"   Erro: {get_agenda_response.text}")
                else:
                    self.log_result("Agenda-Veiculos-POST", False, 
                                  f"❌ POST /api/vehicles/{id}/agenda falhou: {add_event_response.status_code}")
                    print(f"   Erro: {add_event_response.text}")
            else:
                self.log_result("Agenda-Veiculos-GET", False, 
                              f"❌ GET /api/vehicles falhou: {vehicles_response.status_code}")
                print(f"   Erro: {vehicles_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("Agenda-Veiculos-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence - Focus on Review Request Critical Tests"""
        print("🚀 INICIANDO VERIFICAÇÃO FINAL - TAREFAS P2 IMPLEMENTADAS")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["parceiro"]:
            self.authenticate_user(role)
        
        # PRIORITY: REVIEW REQUEST CRITICAL TESTS
        print("\n🎯 VERIFICAÇÃO FINAL: Tarefas P2 implementadas")
        print("=" * 80)
        self.test_review_request_critical_tests()
        
        # Print final summary
        self.print_summary()
        
        return self.get_test_summary()


def main():
    """Main function to run tests"""
    tester = TVDEFleetTester()
    
    try:
        summary = tester.run_all_tests()
        
        print(f"\n🎯 RESUMO FINAL")
        print("=" * 50)
        print(f"Total de testes: {summary['total']}")
        print(f"✅ Sucessos: {summary['passed']}")
        print(f"❌ Falhas: {summary['failed']}")
        print(f"Taxa de sucesso: {summary['passed']/summary['total']*100:.1f}%")
        
        if summary['failed'] == 0:
            print("\n🎉 TODOS OS TESTES PASSARAM!")
            return 0
        else:
            print(f"\n⚠️ {summary['failed']} TESTES FALHARAM")
            return 1
            
    except Exception as e:
        print(f"\n💥 ERRO CRÍTICO: {str(e)}")
        return 1


if __name__ == "__main__":
    exit(main())