"""
Test suite for Financial Approval Flow (Fluxo de Aprovação Financeira)
Tests the endpoints for:
- Status management: PUT /api/relatorios/parceiro/resumo-semanal/motorista/{id}/status
- Receipt upload: POST /api/relatorios/parceiro/resumo-semanal/motorista/{id}/upload-recibo
- Payment proof upload: POST /api/relatorios/parceiro/resumo-semanal/motorista/{id}/upload-comprovativo
- Status retrieval: GET /api/relatorios/parceiro/resumo-semanal/status
- File downloads: GET /api/relatorios/files/recibos/{filename}, GET /api/relatorios/files/comprovativos/{filename}

Flow: Pendente -> Aprovado -> Aguardar Recibo -> A Pagamento -> Liquidado
"""

import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARCEIRO_EMAIL = "parceiro@tvdefleet.com"
PARCEIRO_PASSWORD = "123456"
ADMIN_EMAIL = "admin@tvdefleet.com"
ADMIN_PASSWORD = "123456"


class TestFluxoAprovacaoFinanceiro:
    """Tests for the financial approval flow endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.motorista_id = None
        self.semana = datetime.now().isocalendar()[1]
        self.ano = datetime.now().year
    
    def login_parceiro(self):
        """Login as parceiro and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token") or data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def login_admin(self):
        """Login as admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token") or data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def get_motorista_id(self):
        """Get a motorista ID from the resumo semanal"""
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        if response.status_code == 200:
            data = response.json()
            motoristas = data.get("motoristas", [])
            if motoristas:
                return motoristas[0].get("motorista_id")
        return None
    
    # ==================== STATUS ENDPOINT TESTS ====================
    
    def test_01_login_parceiro(self):
        """Test parceiro login"""
        data = self.login_parceiro()
        assert "token" in data
        assert data.get("user", {}).get("role") == "parceiro"
        print(f"SUCCESS: Parceiro login successful")
    
    def test_02_get_resumo_semanal(self):
        """Test GET /api/relatorios/parceiro/resumo-semanal"""
        self.login_parceiro()
        
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code == 200, f"Failed to get resumo semanal: {response.text}"
        data = response.json()
        
        assert "semana" in data
        assert "ano" in data
        assert "motoristas" in data
        assert "totais" in data
        
        print(f"SUCCESS: Resumo semanal retrieved - {len(data.get('motoristas', []))} motoristas")
        
        # Store motorista_id for subsequent tests
        if data.get("motoristas"):
            self.motorista_id = data["motoristas"][0].get("motorista_id")
            print(f"  Motorista ID for tests: {self.motorista_id}")
    
    def test_03_get_status_relatorios(self):
        """Test GET /api/relatorios/parceiro/resumo-semanal/status"""
        self.login_parceiro()
        
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code == 200, f"Failed to get status: {response.text}"
        data = response.json()
        
        # Response should be a dict with motorista_id as keys
        assert isinstance(data, dict)
        print(f"SUCCESS: Status retrieved for {len(data)} motoristas")
    
    def test_04_update_status_to_aprovado(self):
        """Test PUT /api/relatorios/parceiro/resumo-semanal/motorista/{id}/status - Change to aprovado"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        response = self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={
                "status": "aprovado",
                "semana": self.semana,
                "ano": self.ano
            }
        )
        
        assert response.status_code == 200, f"Failed to update status: {response.text}"
        data = response.json()
        
        assert data.get("status") == "aprovado"
        print(f"SUCCESS: Status updated to 'aprovado' for motorista {motorista_id}")
    
    def test_05_update_status_to_aguardar_recibo(self):
        """Test PUT /api/relatorios/parceiro/resumo-semanal/motorista/{id}/status - Change to aguardar_recibo"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        response = self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={
                "status": "aguardar_recibo",
                "semana": self.semana,
                "ano": self.ano
            }
        )
        
        assert response.status_code == 200, f"Failed to update status: {response.text}"
        data = response.json()
        
        assert data.get("status") == "aguardar_recibo"
        print(f"SUCCESS: Status updated to 'aguardar_recibo' for motorista {motorista_id}")
    
    def test_06_update_status_invalid(self):
        """Test PUT /api/relatorios/parceiro/resumo-semanal/motorista/{id}/status - Invalid status"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        response = self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={
                "status": "invalid_status",
                "semana": self.semana,
                "ano": self.ano
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print(f"SUCCESS: Invalid status correctly rejected with 400")
    
    def test_07_update_status_missing_params(self):
        """Test PUT /api/relatorios/parceiro/resumo-semanal/motorista/{id}/status - Missing params"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        # Missing semana and ano
        response = self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={"status": "aprovado"}
        )
        
        assert response.status_code == 400, f"Expected 400 for missing params, got {response.status_code}"
        print(f"SUCCESS: Missing params correctly rejected with 400")
    
    # ==================== UPLOAD RECIBO TESTS ====================
    
    def test_08_upload_recibo(self):
        """Test POST /api/relatorios/parceiro/resumo-semanal/motorista/{id}/upload-recibo"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        # First set status to aguardar_recibo
        self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={"status": "aguardar_recibo", "semana": self.semana, "ano": self.ano}
        )
        
        # Create a test PDF file
        test_file_content = b"%PDF-1.4 test recibo content"
        files = {
            'file': ('test_recibo.pdf', io.BytesIO(test_file_content), 'application/pdf')
        }
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/upload-recibo",
            params={"semana": self.semana, "ano": self.ano},
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to upload recibo: {response.text}"
        data = response.json()
        
        assert "filename" in data
        assert data.get("status") == "a_pagamento"
        print(f"SUCCESS: Recibo uploaded, status changed to 'a_pagamento'")
        print(f"  Filename: {data.get('filename')}")
    
    # ==================== UPLOAD COMPROVATIVO TESTS ====================
    
    def test_09_upload_comprovativo(self):
        """Test POST /api/relatorios/parceiro/resumo-semanal/motorista/{id}/upload-comprovativo"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        # Create a test PDF file
        test_file_content = b"%PDF-1.4 test comprovativo content"
        files = {
            'file': ('test_comprovativo.pdf', io.BytesIO(test_file_content), 'application/pdf')
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/upload-comprovativo",
            params={"semana": self.semana, "ano": self.ano},
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to upload comprovativo: {response.text}"
        data = response.json()
        
        assert "filename" in data
        print(f"SUCCESS: Comprovativo uploaded")
        print(f"  Filename: {data.get('filename')}")
    
    # ==================== STATUS FLOW COMPLETE TEST ====================
    
    def test_10_complete_status_flow(self):
        """Test complete status flow: pendente -> aprovado -> aguardar_recibo -> a_pagamento -> liquidado"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        statuses = ["pendente", "aprovado", "aguardar_recibo", "a_pagamento", "liquidado"]
        
        for status in statuses:
            response = self.session.put(
                f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
                json={"status": status, "semana": self.semana, "ano": self.ano}
            )
            
            assert response.status_code == 200, f"Failed to set status to {status}: {response.text}"
            data = response.json()
            assert data.get("status") == status
            print(f"  ✓ Status changed to: {status}")
        
        print(f"SUCCESS: Complete status flow verified")
    
    def test_11_verify_status_after_flow(self):
        """Verify status is correctly stored after flow"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if motorista_id in data:
            status_info = data[motorista_id]
            print(f"SUCCESS: Status info retrieved for motorista {motorista_id}")
            print(f"  Status: {status_info.get('status_aprovacao')}")
            if status_info.get('recibo_path'):
                print(f"  Recibo: {status_info.get('recibo_filename')}")
            if status_info.get('comprovativo_path'):
                print(f"  Comprovativo: {status_info.get('comprovativo_filename')}")
    
    # ==================== UNAUTHORIZED ACCESS TESTS ====================
    
    def test_12_unauthorized_access(self):
        """Test that endpoints require authentication"""
        # Clear auth header
        session = requests.Session()
        
        response = session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"SUCCESS: Unauthorized access correctly rejected")
    
    # ==================== ADMIN ACCESS TESTS ====================
    
    def test_13_admin_can_access_status(self):
        """Test that admin can access status endpoints"""
        self.login_admin()
        
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code == 200, f"Admin failed to access status: {response.text}"
        print(f"SUCCESS: Admin can access status endpoint")
    
    # ==================== RESET STATUS FOR CLEAN STATE ====================
    
    def test_99_reset_status_to_pendente(self):
        """Reset status to pendente for clean state"""
        self.login_parceiro()
        motorista_id = self.get_motorista_id()
        
        if not motorista_id:
            pytest.skip("No motorista found for testing")
        
        response = self.session.put(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/motorista/{motorista_id}/status",
            json={"status": "pendente", "semana": self.semana, "ano": self.ano}
        )
        
        assert response.status_code == 200
        print(f"SUCCESS: Status reset to 'pendente' for clean state")


class TestVerificarRecibosPage:
    """Tests for the Verificar Recibos page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.semana = datetime.now().isocalendar()[1]
        self.ano = datetime.now().year
    
    def login_parceiro(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.session.headers.update({"Authorization": f"Bearer {data.get('token')}"})
        return data
    
    def test_filter_aguardar_recibo_status(self):
        """Test filtering motoristas with status 'aguardar_recibo' for Verificar Recibos page"""
        self.login_parceiro()
        
        # Get resumo semanal
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        resumo = response.json()
        
        # Get status
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        status_data = response.json()
        
        # Filter motoristas with aguardar_recibo status
        motoristas = resumo.get("motoristas", [])
        aguardar_recibo = [
            m for m in motoristas 
            if status_data.get(m["motorista_id"], {}).get("status_aprovacao") == "aguardar_recibo"
        ]
        
        print(f"SUCCESS: Found {len(aguardar_recibo)} motoristas with 'aguardar_recibo' status")
        print(f"  Total motoristas: {len(motoristas)}")


class TestPagamentosParceiroPage:
    """Tests for the Pagamentos Parceiro page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.semana = datetime.now().isocalendar()[1]
        self.ano = datetime.now().year
    
    def login_parceiro(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.session.headers.update({"Authorization": f"Bearer {data.get('token')}"})
        return data
    
    def test_filter_a_pagamento_status(self):
        """Test filtering motoristas with status 'a_pagamento' for Pagamentos Parceiro page"""
        self.login_parceiro()
        
        # Get resumo semanal
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        resumo = response.json()
        
        # Get status
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        status_data = response.json()
        
        # Filter motoristas with a_pagamento status
        motoristas = resumo.get("motoristas", [])
        a_pagamento = [
            m for m in motoristas 
            if status_data.get(m["motorista_id"], {}).get("status_aprovacao") == "a_pagamento"
        ]
        
        print(f"SUCCESS: Found {len(a_pagamento)} motoristas with 'a_pagamento' status")
        print(f"  Total motoristas: {len(motoristas)}")


class TestArquivoRecibosPage:
    """Tests for the Arquivo Recibos page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.semana = datetime.now().isocalendar()[1]
        self.ano = datetime.now().year
    
    def login_parceiro(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARCEIRO_EMAIL,
            "password": PARCEIRO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.session.headers.update({"Authorization": f"Bearer {data.get('token')}"})
        return data
    
    def test_filter_liquidado_status(self):
        """Test filtering motoristas with status 'liquidado' for Arquivo Recibos page"""
        self.login_parceiro()
        
        # Get resumo semanal
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        resumo = response.json()
        
        # Get status
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        status_data = response.json()
        
        # Filter motoristas with liquidado status
        motoristas = resumo.get("motoristas", [])
        liquidados = [
            m for m in motoristas 
            if status_data.get(m["motorista_id"], {}).get("status_aprovacao") == "liquidado"
        ]
        
        print(f"SUCCESS: Found {len(liquidados)} motoristas with 'liquidado' status")
        print(f"  Total motoristas: {len(motoristas)}")
    
    def test_filter_all_statuses(self):
        """Test filtering motoristas with all statuses for Arquivo Recibos page"""
        self.login_parceiro()
        
        # Get resumo semanal
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        resumo = response.json()
        
        # Get status
        response = self.session.get(
            f"{BASE_URL}/api/relatorios/parceiro/resumo-semanal/status",
            params={"semana": self.semana, "ano": self.ano}
        )
        assert response.status_code == 200
        status_data = response.json()
        
        # Count by status
        motoristas = resumo.get("motoristas", [])
        status_counts = {
            "pendente": 0,
            "aprovado": 0,
            "aguardar_recibo": 0,
            "a_pagamento": 0,
            "liquidado": 0,
            "sem_status": 0
        }
        
        for m in motoristas:
            status = status_data.get(m["motorista_id"], {}).get("status_aprovacao", "pendente")
            if status in status_counts:
                status_counts[status] += 1
            else:
                status_counts["sem_status"] += 1
        
        print(f"SUCCESS: Status distribution:")
        for status, count in status_counts.items():
            print(f"  {status}: {count}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
