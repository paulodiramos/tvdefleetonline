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
    
    def test_tarefa_2_ficheiros_importados(self):
        """TAREFA 2 - Página Ficheiros Importados: Testar endpoints de ficheiros importados"""
        print("\n📋 TAREFA 2 - Página Ficheiros Importados")
        print("-" * 60)
        print("TESTES:")
        print("1. Verificar se GET /api/ficheiros-importados funciona")
        print("2. Criar um registo de ficheiro importado para teste")
        print("3. Verificar se PUT /api/ficheiros-importados/{id}/aprovar funciona")
        print("4. Verificar se PUT /api/ficheiros-importados/{id}/rejeitar funciona")
        
        # Authenticate as admin
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("TAREFA-2-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: GET /api/ficheiros-importados
            print("\n1. Testando GET /api/ficheiros-importados")
            response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
            
            if response.status_code == 200:
                ficheiros = response.json()
                self.log_result("TAREFA-2-GET-Ficheiros", True, 
                              f"✅ GET /api/ficheiros-importados funciona: {len(ficheiros)} ficheiros encontrados")
            else:
                self.log_result("TAREFA-2-GET-Ficheiros", False, 
                              f"❌ GET /api/ficheiros-importados falhou: {response.status_code}")
                return False
            
            # Test 2: Create a test file record (if possible via API)
            print("\n2. Tentando criar registo de ficheiro importado para teste")
            
            # First, let's try to import a file to create a record
            csv_content = """data,motorista,valor
2025-01-15,Test Driver,25.50"""
            
            files = {
                'file': ('test_import.csv', csv_content.encode('utf-8'), 'text/csv')
            }
            
            # Try importing via uber endpoint to create a ficheiro_importado record
            import_response = requests.post(f"{BACKEND_URL}/importar/uber", files=files, headers=headers)
            
            if import_response.status_code == 200:
                self.log_result("TAREFA-2-Create-Record", True, 
                              "✅ Ficheiro importado criado via importação de teste")
                
                # Get the updated list to find our new record
                updated_response = requests.get(f"{BACKEND_URL}/ficheiros-importados", headers=headers)
                if updated_response.status_code == 200:
                    updated_ficheiros = updated_response.json()
                    
                    if len(updated_ficheiros) > len(ficheiros):
                        # Find the newest record
                        newest_ficheiro = max(updated_ficheiros, key=lambda x: x.get('created_at', ''))
                        ficheiro_id = newest_ficheiro['id']
                        
                        # Test 3: PUT /api/ficheiros-importados/{id}/aprovar
                        print(f"\n3. Testando PUT /api/ficheiros-importados/{ficheiro_id}/aprovar")
                        aprovar_response = requests.put(
                            f"{BACKEND_URL}/ficheiros-importados/{ficheiro_id}/aprovar", 
                            headers=headers
                        )
                        
                        if aprovar_response.status_code == 200:
                            self.log_result("TAREFA-2-Aprovar", True, 
                                          "✅ PUT /api/ficheiros-importados/{id}/aprovar funciona")
                        else:
                            self.log_result("TAREFA-2-Aprovar", False, 
                                          f"❌ Aprovar falhou: {aprovar_response.status_code}")
                        
                        # Test 4: PUT /api/ficheiros-importados/{id}/rejeitar
                        print(f"\n4. Testando PUT /api/ficheiros-importados/{ficheiro_id}/rejeitar")
                        rejeitar_response = requests.put(
                            f"{BACKEND_URL}/ficheiros-importados/{ficheiro_id}/rejeitar", 
                            headers=headers,
                            json={"observacoes": "Teste de rejeição"}
                        )
                        
                        if rejeitar_response.status_code == 200:
                            self.log_result("TAREFA-2-Rejeitar", True, 
                                          "✅ PUT /api/ficheiros-importados/{id}/rejeitar funciona")
                        else:
                            self.log_result("TAREFA-2-Rejeitar", False, 
                                          f"❌ Rejeitar falhou: {rejeitar_response.status_code}")
                    else:
                        self.log_result("TAREFA-2-Create-Record", False, 
                                      "❌ Nenhum novo ficheiro criado após importação")
                else:
                    self.log_result("TAREFA-2-Create-Record", False, 
                                  "❌ Não foi possível verificar ficheiros após importação")
            else:
                self.log_result("TAREFA-2-Create-Record", False, 
                              f"❌ Não foi possível criar ficheiro via importação: {import_response.status_code}")
                
                # If we can't create via import, test with existing files
                if len(ficheiros) > 0:
                    ficheiro_id = ficheiros[0]['id']
                    
                    # Test 3: PUT /api/ficheiros-importados/{id}/aprovar
                    print(f"\n3. Testando PUT /api/ficheiros-importados/{ficheiro_id}/aprovar (ficheiro existente)")
                    aprovar_response = requests.put(
                        f"{BACKEND_URL}/ficheiros-importados/{ficheiro_id}/aprovar", 
                        headers=headers
                    )
                    
                    if aprovar_response.status_code == 200:
                        self.log_result("TAREFA-2-Aprovar", True, 
                                      "✅ PUT /api/ficheiros-importados/{id}/aprovar funciona")
                    else:
                        self.log_result("TAREFA-2-Aprovar", False, 
                                      f"❌ Aprovar falhou: {aprovar_response.status_code}")
                    
                    # Test 4: PUT /api/ficheiros-importados/{id}/rejeitar
                    print(f"\n4. Testando PUT /api/ficheiros-importados/{ficheiro_id}/rejeitar (ficheiro existente)")
                    rejeitar_response = requests.put(
                        f"{BACKEND_URL}/ficheiros-importados/{ficheiro_id}/rejeitar", 
                        headers=headers,
                        json={"observacoes": "Teste de rejeição"}
                    )
                    
                    if rejeitar_response.status_code == 200:
                        self.log_result("TAREFA-2-Rejeitar", True, 
                                      "✅ PUT /api/ficheiros-importados/{id}/rejeitar funciona")
                    else:
                        self.log_result("TAREFA-2-Rejeitar", False, 
                                      f"❌ Rejeitar falhou: {rejeitar_response.status_code}")
                else:
                    self.log_result("TAREFA-2-No-Files", False, 
                                  "❌ Nenhum ficheiro disponível para testar aprovar/rejeitar")
            
            return True
            
        except Exception as e:
            self.log_result("TAREFA-2-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_tarefa_3_viaverde_config(self):
        """TAREFA 3 - Campo Via Verde Config no Backend: Testar campo viaverde_config no modelo do motorista"""
        print("\n📋 TAREFA 3 - Campo Via Verde Config no Backend")
        print("-" * 60)
        print("TESTES:")
        print("1. Verificar se o campo `viaverde_config` existe no modelo do motorista")
        print("2. Buscar um motorista via GET /api/motoristas e verificar se o campo existe")
        print("3. Testar PUT /api/motoristas/{id} com `viaverde_config: 'acumula'` e verificar se persiste")
        
        # Authenticate as admin
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("TAREFA-3-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1 & 2: GET /api/motoristas and check for viaverde_config field
            print("\n1-2. Testando GET /api/motoristas e verificando campo viaverde_config")
            response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
            
            if response.status_code == 200:
                motoristas = response.json()
                
                if len(motoristas) == 0:
                    self.log_result("TAREFA-3-No-Motoristas", False, "❌ Nenhum motorista encontrado")
                    return False
                
                # Check if viaverde_config field exists in any motorista
                motorista_with_field = None
                field_found = False
                
                for motorista in motoristas:
                    if 'viaverde_config' in motorista:
                        field_found = True
                        motorista_with_field = motorista
                        break
                
                if field_found:
                    self.log_result("TAREFA-3-Field-Exists", True, 
                                  f"✅ Campo viaverde_config existe no modelo: valor = '{motorista_with_field.get('viaverde_config')}'")
                else:
                    self.log_result("TAREFA-3-Field-Exists", False, 
                                  "❌ Campo viaverde_config não encontrado no modelo do motorista")
                
                # Test 3: Update a motorista with viaverde_config
                test_motorista = motoristas[0]
                motorista_id = test_motorista['id']
                motorista_name = test_motorista.get('name', 'Unknown')
                
                print(f"\n3. Testando PUT /api/motoristas/{motorista_id} com viaverde_config: 'acumula'")
                print(f"   Motorista: {motorista_name}")
                
                update_data = {
                    "viaverde_config": "acumula"
                }
                
                update_response = requests.put(
                    f"{BACKEND_URL}/motoristas/{motorista_id}", 
                    json=update_data, 
                    headers=headers
                )
                
                if update_response.status_code == 200:
                    self.log_result("TAREFA-3-Update-Success", True, 
                                  "✅ PUT /api/motoristas/{id} com viaverde_config funcionou")
                    
                    # Verify the field was saved
                    verify_response = requests.get(f"{BACKEND_URL}/motoristas/{motorista_id}", headers=headers)
                    
                    if verify_response.status_code == 200:
                        updated_motorista = verify_response.json()
                        saved_config = updated_motorista.get('viaverde_config')
                        
                        if saved_config == "acumula":
                            self.log_result("TAREFA-3-Persistence", True, 
                                          f"✅ Campo viaverde_config persistiu corretamente: '{saved_config}'")
                        else:
                            self.log_result("TAREFA-3-Persistence", False, 
                                          f"❌ Campo não persistiu corretamente: esperado 'acumula', obtido '{saved_config}'")
                    else:
                        self.log_result("TAREFA-3-Persistence", False, 
                                      f"❌ Não foi possível verificar persistência: {verify_response.status_code}")
                else:
                    self.log_result("TAREFA-3-Update-Failed", False, 
                                  f"❌ PUT /api/motoristas/{id} falhou: {update_response.status_code}")
                    print(f"   Erro: {update_response.text}")
            else:
                self.log_result("TAREFA-3-GET-Failed", False, 
                              f"❌ GET /api/motoristas falhou: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("TAREFA-3-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def test_tarefa_4_cartoes_frota_combustivel(self):
        """TAREFA 4 - Importação de Combustível com Cartões de Frota: Testar nova arquitetura de cartões"""
        print("\n📋 TAREFA 4 - Importação de Combustível com Cartões de Frota")
        print("-" * 60)
        print("TESTES:")
        print("1. Criar um cartão de frota tipo 'combustivel' via POST /api/cartoes-frota")
        print("2. Atribuir o cartão a um motorista")
        print("3. Verificar se a importação de combustível consegue encontrar o motorista via cartão")
        
        # Authenticate as admin
        headers = self.get_headers("admin")
        if not headers:
            self.log_result("TAREFA-4-Auth", False, "❌ No auth token for admin")
            return False
        
        try:
            # Test 1: Create a cartão de frota tipo "combustivel"
            print("\n1. Criando cartão de frota tipo 'combustivel'")
            
            cartao_data = {
                "numero_cartao": "TEST-COMBUSTIVEL-12345",
                "tipo": "combustivel",
                "fornecedor": "Galp",
                "observacoes": "Cartão de teste para combustível"
            }
            
            create_response = requests.post(
                f"{BACKEND_URL}/cartoes-frota", 
                json=cartao_data, 
                headers=headers
            )
            
            if create_response.status_code == 200:
                cartao_created = create_response.json()
                cartao_id = cartao_created['id']
                numero_cartao = cartao_created['numero_cartao']
                
                self.log_result("TAREFA-4-Create-Cartao", True, 
                              f"✅ Cartão de frota criado: {numero_cartao} (ID: {cartao_id})")
                
                # Test 2: Assign the cartão to a motorista
                print("\n2. Atribuindo cartão a um motorista")
                
                # Get a motorista to assign the cartão to
                motoristas_response = requests.get(f"{BACKEND_URL}/motoristas", headers=headers)
                
                if motoristas_response.status_code == 200:
                    motoristas = motoristas_response.json()
                    
                    if len(motoristas) == 0:
                        self.log_result("TAREFA-4-No-Motoristas", False, "❌ Nenhum motorista encontrado")
                        return False
                    
                    test_motorista = motoristas[0]
                    motorista_id = test_motorista['id']
                    motorista_name = test_motorista.get('name', 'Unknown')
                    
                    print(f"   Motorista selecionado: {motorista_name} (ID: {motorista_id})")
                    
                    # Update motorista with cartao_combustivel_id
                    update_motorista_data = {
                        "cartao_combustivel_id": cartao_id
                    }
                    
                    update_motorista_response = requests.put(
                        f"{BACKEND_URL}/motoristas/{motorista_id}", 
                        json=update_motorista_data, 
                        headers=headers
                    )
                    
                    if update_motorista_response.status_code == 200:
                        self.log_result("TAREFA-4-Assign-Cartao", True, 
                                      f"✅ Cartão atribuído ao motorista {motorista_name}")
                        
                        # Also update the cartão with motorista info
                        update_cartao_data = {
                            "motorista_atribuido": motorista_id
                        }
                        
                        update_cartao_response = requests.put(
                            f"{BACKEND_URL}/cartoes-frota/{cartao_id}", 
                            json=update_cartao_data, 
                            headers=headers
                        )
                        
                        if update_cartao_response.status_code == 200:
                            self.log_result("TAREFA-4-Update-Cartao", True, 
                                          "✅ Cartão atualizado com informações do motorista")
                        
                        # Test 3: Test combustível import with the cartão
                        print("\n3. Testando importação de combustível com o cartão")
                        
                        # Create test CSV with the cartão number
                        csv_content = f"""posto,data,hora,cartao,litros,valor_liquido,motorista
Galp,2025-01-15,14:30:00,{numero_cartao},45.5,65.75,{motorista_name}"""
                        
                        files = {
                            'file': ('test_combustivel.csv', csv_content.encode('utf-8'), 'text/csv')
                        }
                        
                        import_response = requests.post(
                            f"{BACKEND_URL}/importar/combustivel", 
                            files=files, 
                            headers=headers
                        )
                        
                        if import_response.status_code == 200:
                            import_result = import_response.json()
                            sucesso = import_result.get("sucesso", 0)
                            erros = import_result.get("erros", 0)
                            
                            if sucesso > 0 and erros == 0:
                                self.log_result("TAREFA-4-Import-Success", True, 
                                              f"✅ Importação de combustível funcionou: {sucesso} registos importados")
                            else:
                                erros_detalhes = import_result.get("erros_detalhes", [])
                                self.log_result("TAREFA-4-Import-Partial", False, 
                                              f"❌ Importação com problemas: {sucesso} sucessos, {erros} erros")
                                if erros_detalhes:
                                    print(f"   Detalhes dos erros: {erros_detalhes}")
                        else:
                            self.log_result("TAREFA-4-Import-Failed", False, 
                                          f"❌ Importação de combustível falhou: {import_response.status_code}")
                            print(f"   Erro: {import_response.text}")
                    else:
                        self.log_result("TAREFA-4-Assign-Failed", False, 
                                      f"❌ Falha ao atribuir cartão ao motorista: {update_motorista_response.status_code}")
                else:
                    self.log_result("TAREFA-4-Get-Motoristas-Failed", False, 
                                  f"❌ Falha ao obter motoristas: {motoristas_response.status_code}")
            else:
                self.log_result("TAREFA-4-Create-Failed", False, 
                              f"❌ Falha ao criar cartão de frota: {create_response.status_code}")
                print(f"   Erro: {create_response.text}")
            
            return True
            
        except Exception as e:
            self.log_result("TAREFA-4-Error", False, f"❌ Erro durante teste: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence - Focus on Review Request Critical Tests"""
        print("🚀 INICIANDO VERIFICAÇÃO FINAL - TAREFAS 2, 3 E 4 IMPLEMENTADAS")
        print("=" * 80)
        
        # Authenticate required users
        print("\n🔐 AUTENTICAÇÃO DE UTILIZADORES")
        print("-" * 40)
        for role in ["admin", "parceiro"]:
            self.authenticate_user(role)
        
        # PRIORITY: REVIEW REQUEST CRITICAL TESTS
        print("\n🎯 VERIFICAÇÃO FINAL: TAREFAS 2, 3 E 4 IMPLEMENTADAS")
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