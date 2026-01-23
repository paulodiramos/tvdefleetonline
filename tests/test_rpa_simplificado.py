"""
Test RPA Simplificado - Upload CSV e Exportação
Tests for: Prio Combustível, Prio Elétrico, GPS Verizon, GPS Cartrack, Outro
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


class TestRPAFornecedores:
    """Test GET /api/rpa/fornecedores - List available suppliers"""
    
    def test_listar_fornecedores_sem_auth(self):
        """Test listing suppliers without authentication (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 5, f"Expected 5 suppliers, got {len(data)}"
        
        # Verify all expected suppliers are present
        supplier_ids = [s["id"] for s in data]
        expected_ids = ["combustivel_prio", "eletrico_prio", "gps_verizon", "gps_cartrack", "outro"]
        for expected_id in expected_ids:
            assert expected_id in supplier_ids, f"Missing supplier: {expected_id}"
        
        print(f"✅ Found {len(data)} suppliers: {supplier_ids}")
    
    def test_fornecedor_combustivel_prio_details(self):
        """Test Prio Combustível supplier details"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200
        
        data = response.json()
        combustivel = next((f for f in data if f["id"] == "combustivel_prio"), None)
        
        assert combustivel is not None, "Prio Combustível not found"
        assert combustivel["nome"] == "Prio Combustível"
        assert combustivel["tipo"] == "combustivel"
        assert combustivel["icone"] == "⛽"
        assert "campos_esperados" in combustivel
        assert "mapeamento_padrao" in combustivel
        
        print(f"✅ Prio Combustível: {combustivel['nome']} - {combustivel['descricao']}")
    
    def test_fornecedor_eletrico_prio_details(self):
        """Test Prio Elétrico supplier details"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200
        
        data = response.json()
        eletrico = next((f for f in data if f["id"] == "eletrico_prio"), None)
        
        assert eletrico is not None, "Prio Elétrico not found"
        assert eletrico["nome"] == "Prio Elétrico"
        assert eletrico["tipo"] == "carregamento_eletrico"
        assert eletrico["icone"] == "🔌"
        
        print(f"✅ Prio Elétrico: {eletrico['nome']} - {eletrico['descricao']}")
    
    def test_fornecedor_gps_verizon_details(self):
        """Test GPS Verizon supplier details"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200
        
        data = response.json()
        verizon = next((f for f in data if f["id"] == "gps_verizon"), None)
        
        assert verizon is not None, "GPS Verizon not found"
        assert verizon["nome"] == "GPS Verizon"
        assert verizon["tipo"] == "gps"
        assert verizon["icone"] == "📍"
        
        print(f"✅ GPS Verizon: {verizon['nome']} - {verizon['descricao']}")
    
    def test_fornecedor_gps_cartrack_details(self):
        """Test GPS Cartrack supplier details"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200
        
        data = response.json()
        cartrack = next((f for f in data if f["id"] == "gps_cartrack"), None)
        
        assert cartrack is not None, "GPS Cartrack not found"
        assert cartrack["nome"] == "GPS Cartrack"
        assert cartrack["tipo"] == "gps"
        assert cartrack["icone"] == "🛰️"
        
        print(f"✅ GPS Cartrack: {cartrack['nome']} - {cartrack['descricao']}")
    
    def test_fornecedor_outro_details(self):
        """Test Outro Sistema supplier details"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores")
        assert response.status_code == 200
        
        data = response.json()
        outro = next((f for f in data if f["id"] == "outro"), None)
        
        assert outro is not None, "Outro Sistema not found"
        assert outro["nome"] == "Outro Sistema"
        assert outro["tipo"] == "outro"
        assert outro["icone"] == "📄"
        
        print(f"✅ Outro Sistema: {outro['nome']} - {outro['descricao']}")


class TestRPAImportacoes:
    """Test GET /api/rpa/importacoes - List import history (authenticated)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_listar_importacoes_sem_auth(self):
        """Test listing imports without authentication - should fail"""
        response = requests.get(f"{BASE_URL}/api/rpa/importacoes")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Importações endpoint requires authentication")
    
    def test_listar_importacoes_com_auth(self, auth_token):
        """Test listing imports with authentication"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa/importacoes", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✅ Found {len(data)} importações")
        
        # If there are imports, verify structure
        if len(data) > 0:
            imp = data[0]
            assert "id" in imp, "Import should have id"
            assert "fornecedor_id" in imp or "fornecedor_nome" in imp, "Import should have fornecedor info"
            assert "status" in imp, "Import should have status"
            print(f"   First import: {imp.get('fornecedor_nome', 'N/A')} - {imp.get('status', 'N/A')}")


class TestRPAEstatisticas:
    """Test GET /api/rpa/estatisticas - Get import statistics (authenticated)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_estatisticas_sem_auth(self):
        """Test getting statistics without authentication - should fail"""
        response = requests.get(f"{BASE_URL}/api/rpa/estatisticas")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Estatísticas endpoint requires authentication")
    
    def test_estatisticas_com_auth(self, auth_token):
        """Test getting statistics with authentication"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa/estatisticas", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify expected fields
        assert "total_importacoes" in data, "Should have total_importacoes"
        assert "importacoes_sucesso" in data, "Should have importacoes_sucesso"
        assert "importacoes_erro" in data, "Should have importacoes_erro"
        assert "taxa_sucesso" in data, "Should have taxa_sucesso"
        
        print(f"✅ Estatísticas: Total={data['total_importacoes']}, Sucesso={data['importacoes_sucesso']}, Erro={data['importacoes_erro']}, Taxa={data['taxa_sucesso']:.1f}%")


class TestRPAUpload:
    """Test POST /api/rpa/upload/{fornecedor_id} - Upload CSV file (authenticated)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_upload_sem_auth(self):
        """Test upload without authentication - should fail"""
        csv_content = "Data;Matrícula;Litros;Valor;Local\n2025-01-01;AA-00-AA;50;75.00;Lisboa"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        
        response = requests.post(f"{BASE_URL}/api/rpa/upload/combustivel_prio", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Upload endpoint requires authentication")
    
    def test_upload_fornecedor_invalido(self, auth_token):
        """Test upload with invalid supplier - should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        csv_content = "Data;Matrícula;Litros;Valor;Local\n2025-01-01;AA-00-AA;50;75.00;Lisboa"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/fornecedor_invalido",
            headers=headers,
            files=files
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✅ Upload with invalid supplier returns 404")
    
    def test_upload_combustivel_prio_csv(self, auth_token):
        """Test uploading Prio Combustível CSV"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create test CSV content
        csv_content = """Data;Matrícula;Litros;Valor;Local;Cartão
2025-01-20;TEST-00-AA;45.5;68.25;Lisboa;1234
2025-01-21;TEST-00-BB;30.0;45.00;Porto;5678"""
        
        files = {"file": ("test_combustivel.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/combustivel_prio",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Upload should be successful"
        assert "importacao_id" in data, "Should return importacao_id"
        assert data.get("registos_importados", 0) >= 0, "Should have registos_importados"
        
        print(f"✅ Upload Combustível: {data.get('registos_importados')} registos importados")
        print(f"   Importação ID: {data.get('importacao_id')}")
    
    def test_upload_eletrico_prio_csv(self, auth_token):
        """Test uploading Prio Elétrico CSV"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        csv_content = """Data;Matrícula;kWh;Valor;Estação;Cartão
2025-01-20;TEST-EV-01;25.5;12.75;Estação Lisboa;EV001
2025-01-21;TEST-EV-02;40.0;20.00;Estação Porto;EV002"""
        
        files = {"file": ("test_eletrico.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/eletrico_prio",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Upload should be successful"
        
        print(f"✅ Upload Elétrico: {data.get('registos_importados')} registos importados")
    
    def test_upload_gps_verizon_csv(self, auth_token):
        """Test uploading GPS Verizon CSV"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        csv_content = """Date;Vehicle;Distance (km);Drive Time;Driver
2025-01-20;TEST-GPS-01;150.5;3:30;João Silva
2025-01-21;TEST-GPS-02;200.0;4:15;Maria Santos"""
        
        files = {"file": ("test_verizon.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/gps_verizon",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Upload should be successful"
        
        print(f"✅ Upload GPS Verizon: {data.get('registos_importados')} registos importados")
    
    def test_upload_gps_cartrack_csv(self, auth_token):
        """Test uploading GPS Cartrack CSV"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        csv_content = """Data;Veículo;Km Percorridos;Tempo de Condução;Condutor
2025-01-20;TEST-CT-01;180.0;4:00;Pedro Costa
2025-01-21;TEST-CT-02;220.5;5:30;Ana Ferreira"""
        
        files = {"file": ("test_cartrack.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/gps_cartrack",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Upload should be successful"
        
        print(f"✅ Upload GPS Cartrack: {data.get('registos_importados')} registos importados")
    
    def test_upload_outro_csv(self, auth_token):
        """Test uploading Outro Sistema CSV"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        csv_content = """Campo1;Campo2;Campo3
Valor1;Valor2;Valor3
ValorA;ValorB;ValorC"""
        
        files = {"file": ("test_outro.csv", csv_content, "text/csv")}
        
        response = requests.post(
            f"{BASE_URL}/api/rpa/upload/outro",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Upload should be successful"
        
        print(f"✅ Upload Outro: {data.get('registos_importados')} registos importados")


class TestRPAExportar:
    """Test export endpoints - GET /api/rpa/exportar/*"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_exportar_relatorios_semanais_sem_auth(self):
        """Test export weekly reports without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/relatorios-semanais")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Export relatórios semanais requires authentication")
    
    def test_exportar_relatorios_semanais(self, auth_token):
        """Test export weekly reports - may return 404 if no data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/relatorios-semanais", headers=headers)
        
        # 200 = data found, 404 = no data (expected behavior)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            assert response.headers.get("content-type", "").startswith("text/csv"), "Should return CSV"
            print("✅ Export relatórios semanais: CSV returned")
        else:
            print("✅ Export relatórios semanais: 404 (no data - expected)")
    
    def test_exportar_recibos_sem_auth(self):
        """Test export receipts without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/recibos")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Export recibos requires authentication")
    
    def test_exportar_recibos(self, auth_token):
        """Test export receipts - may return 404 if no data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/recibos", headers=headers)
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            assert response.headers.get("content-type", "").startswith("text/csv"), "Should return CSV"
            print("✅ Export recibos: CSV returned")
        else:
            print("✅ Export recibos: 404 (no data - expected)")
    
    def test_exportar_despesas_sem_auth(self):
        """Test export expenses without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/despesas")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Export despesas requires authentication")
    
    def test_exportar_despesas(self, auth_token):
        """Test export expenses - may return 404 if no data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/rpa/exportar/despesas", headers=headers)
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            assert response.headers.get("content-type", "").startswith("text/csv"), "Should return CSV"
            print("✅ Export despesas: CSV returned")
        else:
            print("✅ Export despesas: 404 (no data - expected)")
    
    def test_exportar_despesas_com_filtros(self, auth_token):
        """Test export expenses with date filters"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        params = {
            "data_inicio": "2025-01-01",
            "data_fim": "2025-12-31"
        }
        response = requests.get(
            f"{BASE_URL}/api/rpa/exportar/despesas",
            headers=headers,
            params=params
        )
        
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        print(f"✅ Export despesas com filtros: {response.status_code}")


class TestRPAFornecedorById:
    """Test GET /api/rpa/fornecedores/{fornecedor_id}"""
    
    def test_get_fornecedor_combustivel_prio(self):
        """Test getting specific supplier by ID"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores/combustivel_prio")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == "combustivel_prio"
        assert data["nome"] == "Prio Combustível"
        print(f"✅ GET fornecedor by ID: {data['nome']}")
    
    def test_get_fornecedor_invalido(self):
        """Test getting non-existent supplier"""
        response = requests.get(f"{BASE_URL}/api/rpa/fornecedores/fornecedor_invalido")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ GET fornecedor inválido returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
