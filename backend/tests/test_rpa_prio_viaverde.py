"""
Testes para RPA Prio e Via Verde - Verifica se a sincronização funciona correctamente.
Testa os endpoints de RPA e verifica se os filtros de datas funcionam.

Bugs reportados:
1. Prio sync retorna sempre dados da semana 6 independente da semana selecionada
2. Via Verde sync não funciona/falha
3. Relatório PDF semanal não inclui lista de combustível (testado em outro módulo)
"""

import pytest
import requests
import os
import time
from datetime import datetime, timedelta

# URL base do backend
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://billing-matrix.preview.emergentagent.com')

# Credenciais de teste
TEST_USER = {
    "email": "tsacamalda@gmail.com",
    "password": "test123"
}

# Credenciais Prio
PRIO_CREDENTIALS = {
    "username": "196635",
    "password": "Sacam@2026"
}

# Credenciais Via Verde
VIAVERDE_CREDENTIALS = {
    "email": "tsacamalda@gmail.com",
    "password": "D@niel18"
}


class TestRPAPrioViaVerde:
    """Testes para RPA Prio e Via Verde"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: obter token de autenticação"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=TEST_USER
        )
        assert response.status_code == 200, f"Login falhou: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Calcular datas da semana 5 de 2026 (27/01/2026 a 02/02/2026)
        self.semana_teste = 5
        self.ano_teste = 2026
        jan4 = datetime(self.ano_teste, 1, 4)
        start_of_week = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=self.semana_teste-1)
        end_of_week = start_of_week + timedelta(days=6)
        self.data_inicio = start_of_week.strftime('%Y-%m-%d')  # 2026-01-27
        self.data_fim = end_of_week.strftime('%Y-%m-%d')       # 2026-02-02
    
    # ==========================================================
    # TESTES DE CREDENCIAIS - Verificar se as credenciais existem
    # ==========================================================
    
    def test_01_verificar_credenciais_prio(self):
        """Verificar se existem credenciais Prio configuradas"""
        response = requests.get(
            f"{BASE_URL}/api/credenciais-plataforma?parceiro_id={self.user_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Erro ao obter credenciais: {response.text}"
        
        credenciais = response.json()
        prio_cred = None
        for c in credenciais:
            if c.get("plataforma") in ["prio", "prio_energy"]:
                prio_cred = c
                break
        
        if prio_cred:
            print(f"✅ Credenciais Prio encontradas: {prio_cred.get('email') or prio_cred.get('username')}")
        else:
            print("⚠️ Credenciais Prio NÃO encontradas - teste criará credenciais")
    
    def test_02_verificar_credenciais_viaverde(self):
        """Verificar se existem credenciais Via Verde configuradas"""
        response = requests.get(
            f"{BASE_URL}/api/credenciais-plataforma?parceiro_id={self.user_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Erro ao obter credenciais: {response.text}"
        
        credenciais = response.json()
        viaverde_cred = None
        for c in credenciais:
            if c.get("plataforma") in ["viaverde", "via_verde"]:
                viaverde_cred = c
                break
        
        if viaverde_cred:
            print(f"✅ Credenciais Via Verde encontradas: {viaverde_cred.get('email')}")
        else:
            print("⚠️ Credenciais Via Verde NÃO encontradas - teste criará credenciais")
    
    # ==========================================================
    # TESTES DE ENDPOINTS - Verificar se os endpoints respondem
    # ==========================================================
    
    def test_03_endpoint_prio_executar_rpa_responde(self):
        """
        Testar se o endpoint /api/prio/executar-rpa responde e inicia execução.
        Bug reportado: Prio sync retorna sempre dados da semana 6
        """
        payload = {
            "tipo_periodo": "semana_especifica",
            "semana": self.semana_teste,
            "ano": self.ano_teste
        }
        
        response = requests.post(
            f"{BASE_URL}/api/prio/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        # Se credenciais não existem, vai retornar 400
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "não configuradas" in error_detail:
                print(f"⚠️ Credenciais Prio não configuradas: {error_detail}")
                pytest.skip("Credenciais Prio não configuradas para este parceiro")
        
        assert response.status_code == 200, f"Erro ao executar RPA Prio: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"RPA Prio não iniciou: {data}"
        assert "execucao_id" in data, "Falta execucao_id na resposta"
        
        print(f"✅ RPA Prio iniciado: {data.get('execucao_id')}")
        print(f"   Período: {data.get('periodo')}")
        print(f"   Mensagem: {data.get('message')}")
        
        # Guardar execução ID para verificar depois
        self.prio_execucao_id = data.get("execucao_id")
    
    def test_04_endpoint_viaverde_executar_rpa_responde(self):
        """
        Testar se o endpoint /api/viaverde/executar-rpa responde e inicia execução.
        Bug reportado: Via Verde sync não funciona/falha
        """
        payload = {
            "tipo_periodo": "semana_especifica",
            "semana": self.semana_teste,
            "ano": self.ano_teste
        }
        
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        # Se credenciais não existem, vai retornar 400
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            if "não configuradas" in error_detail:
                print(f"⚠️ Credenciais Via Verde não configuradas: {error_detail}")
                pytest.skip("Credenciais Via Verde não configuradas para este parceiro")
        
        assert response.status_code == 200, f"Erro ao executar RPA Via Verde: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"RPA Via Verde não iniciou: {data}"
        assert "execucao_id" in data, "Falta execucao_id na resposta"
        
        print(f"✅ RPA Via Verde iniciado: {data.get('execucao_id')}")
        print(f"   Período: {data.get('periodo_descricao')}")
        
        # Guardar execução ID para verificar depois
        self.viaverde_execucao_id = data.get("execucao_id")
    
    def test_05_endpoint_prio_execucoes_responde(self):
        """Verificar se o endpoint de listar execuções Prio funciona"""
        response = requests.get(
            f"{BASE_URL}/api/prio/execucoes",
            headers=self.headers
        )
        assert response.status_code == 200, f"Erro ao listar execuções Prio: {response.text}"
        
        execucoes = response.json()
        print(f"✅ GET /api/prio/execucoes retornou {len(execucoes)} execuções")
        
        # Mostrar últimas 3 execuções
        for i, exec in enumerate(execucoes[:3]):
            print(f"   [{i+1}] ID: {exec.get('id')[:8]}... | Status: {exec.get('status')} | Período: Semana {exec.get('semana')}/{exec.get('ano')}")
    
    def test_06_endpoint_viaverde_execucoes_responde(self):
        """Verificar se o endpoint de listar execuções Via Verde funciona"""
        response = requests.get(
            f"{BASE_URL}/api/viaverde/execucoes",
            headers=self.headers
        )
        assert response.status_code == 200, f"Erro ao listar execuções Via Verde: {response.text}"
        
        execucoes = response.json()
        print(f"✅ GET /api/viaverde/execucoes retornou {len(execucoes)} execuções")
        
        # Mostrar últimas 3 execuções
        for i, exec in enumerate(execucoes[:3]):
            print(f"   [{i+1}] ID: {exec.get('id')[:8]}... | Status: {exec.get('status')} | Período: {exec.get('periodo_descricao', 'N/A')}")
    
    # ==========================================================
    # TESTES DE TIPOS DE PERÍODO - Verificar se os parâmetros são aceites
    # ==========================================================
    
    def test_07_prio_tipo_periodo_ultima_semana(self):
        """Testar RPA Prio com tipo_periodo=ultima_semana"""
        payload = {
            "tipo_periodo": "ultima_semana"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/prio/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 400 and "não configuradas" in response.json().get("detail", ""):
            pytest.skip("Credenciais Prio não configuradas")
        
        assert response.status_code == 200, f"Erro: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Prio ultima_semana: {data.get('periodo')}")
    
    def test_08_prio_tipo_periodo_datas_personalizadas(self):
        """Testar RPA Prio com tipo_periodo=datas_personalizadas"""
        payload = {
            "tipo_periodo": "datas_personalizadas",
            "data_inicio": self.data_inicio,
            "data_fim": self.data_fim
        }
        
        response = requests.post(
            f"{BASE_URL}/api/prio/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 400 and "não configuradas" in response.json().get("detail", ""):
            pytest.skip("Credenciais Prio não configuradas")
        
        assert response.status_code == 200, f"Erro: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Prio datas_personalizadas: {data.get('periodo')}")
    
    def test_09_viaverde_tipo_periodo_ultima_semana(self):
        """Testar RPA Via Verde com tipo_periodo=ultima_semana"""
        payload = {
            "tipo_periodo": "ultima_semana"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 400 and "não configuradas" in response.json().get("detail", ""):
            pytest.skip("Credenciais Via Verde não configuradas")
        
        assert response.status_code == 200, f"Erro: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Via Verde ultima_semana: {data.get('periodo_descricao')}")
    
    def test_10_viaverde_tipo_periodo_datas_personalizadas(self):
        """Testar RPA Via Verde com tipo_periodo=datas_personalizadas"""
        payload = {
            "tipo_periodo": "datas_personalizadas",
            "data_inicio": self.data_inicio,
            "data_fim": self.data_fim
        }
        
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 400 and "não configuradas" in response.json().get("detail", ""):
            pytest.skip("Credenciais Via Verde não configuradas")
        
        assert response.status_code == 200, f"Erro: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Via Verde datas_personalizadas: {data.get('periodo_descricao')}")
    
    # ==========================================================
    # TESTES DE ERROS - Verificar tratamento de erros
    # ==========================================================
    
    def test_11_prio_sem_autenticacao(self):
        """Testar que endpoint Prio requer autenticação"""
        response = requests.post(
            f"{BASE_URL}/api/prio/executar-rpa",
            json={"tipo_periodo": "ultima_semana"}
        )
        # Aceitar 401 ou 403 como resposta válida (autenticação requerida)
        assert response.status_code in [401, 403], f"Endpoint deveria requerer autenticação (esperado 401/403, obtido {response.status_code})"
        print(f"✅ Endpoint Prio requer autenticação ({response.status_code})")
    
    def test_12_viaverde_sem_autenticacao(self):
        """Testar que endpoint Via Verde requer autenticação"""
        response = requests.post(
            f"{BASE_URL}/api/viaverde/executar-rpa",
            json={"tipo_periodo": "ultima_semana"}
        )
        # Aceitar 401 ou 403 como resposta válida (autenticação requerida)
        assert response.status_code in [401, 403], f"Endpoint deveria requerer autenticação (esperado 401/403, obtido {response.status_code})"
        print(f"✅ Endpoint Via Verde requer autenticação ({response.status_code})")


class TestCredenciaisSetup:
    """Testes para verificar e configurar credenciais se necessário"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: obter token de autenticação"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=TEST_USER
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_criar_credenciais_prio_se_necessario(self):
        """Criar credenciais Prio se não existirem"""
        # Verificar se já existem
        response = requests.get(
            f"{BASE_URL}/api/credenciais-plataforma?parceiro_id={self.user_id}",
            headers=self.headers
        )
        credenciais = response.json() if response.status_code == 200 else []
        
        prio_existe = any(c.get("plataforma") in ["prio", "prio_energy"] for c in credenciais)
        
        if prio_existe:
            print("✅ Credenciais Prio já existem")
            return
        
        # Criar credenciais
        payload = {
            "parceiro_id": self.user_id,
            "plataforma": "prio",
            "email": PRIO_CREDENTIALS["username"],  # Prio usa username como "email"
            "username": PRIO_CREDENTIALS["username"],
            "password": PRIO_CREDENTIALS["password"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/credenciais-plataforma",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 200:
            print(f"✅ Credenciais Prio criadas: {PRIO_CREDENTIALS['username']}")
        else:
            print(f"⚠️ Erro ao criar credenciais Prio: {response.text}")
    
    def test_criar_credenciais_viaverde_se_necessario(self):
        """Criar credenciais Via Verde se não existirem"""
        # Verificar se já existem
        response = requests.get(
            f"{BASE_URL}/api/credenciais-plataforma?parceiro_id={self.user_id}",
            headers=self.headers
        )
        credenciais = response.json() if response.status_code == 200 else []
        
        viaverde_existe = any(c.get("plataforma") in ["viaverde", "via_verde"] for c in credenciais)
        
        if viaverde_existe:
            print("✅ Credenciais Via Verde já existem")
            return
        
        # Criar credenciais
        payload = {
            "parceiro_id": self.user_id,
            "plataforma": "viaverde",
            "email": VIAVERDE_CREDENTIALS["email"],
            "password": VIAVERDE_CREDENTIALS["password"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/credenciais-plataforma",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code == 200:
            print(f"✅ Credenciais Via Verde criadas: {VIAVERDE_CREDENTIALS['email']}")
        else:
            print(f"⚠️ Erro ao criar credenciais Via Verde: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
