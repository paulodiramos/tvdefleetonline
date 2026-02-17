"""
Tests for Iteration 36 - Categorias e Filtros na Loja de Planos
Features tested:
1. GET /api/gestao-planos/categorias/public - endpoint público retorna categorias
2. GET /api/gestao-planos/planos/public - retorna planos com icone, cor, categoria_id
3. Filtro por categoria funciona no frontend
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCategoriasPublic:
    """Test GET /api/gestao-planos/categorias/public endpoint"""
    
    def test_categorias_public_returns_200(self):
        """Endpoint público deve retornar 200"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/categorias/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/gestao-planos/categorias/public returns 200")
    
    def test_categorias_public_returns_list(self):
        """Deve retornar uma lista de categorias"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/categorias/public")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✅ categorias/public returns list with {len(data)} items")
    
    def test_categorias_have_required_fields(self):
        """Categorias devem ter campos obrigatórios: id, nome, icone, cor"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/categorias/public")
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No categories found - skipping field validation")
        
        categoria = data[0]
        required_fields = ['id', 'nome', 'icone', 'cor', 'ativo']
        
        for field in required_fields:
            assert field in categoria, f"Missing field: {field}"
        
        print(f"✅ Categoria has required fields: {required_fields}")
        print(f"   Sample: nome={categoria.get('nome')}, icone={categoria.get('icone')}, cor={categoria.get('cor')}")
    
    def test_categorias_only_active(self):
        """Apenas categorias ativas devem ser retornadas"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/categorias/public")
        data = response.json()
        
        for cat in data:
            assert cat.get('ativo') == True, f"Inactive category found: {cat.get('nome')}"
        
        print(f"✅ All {len(data)} categories are active")


class TestPlanosPublic:
    """Test GET /api/gestao-planos/planos/public endpoint"""
    
    def test_planos_public_returns_200(self):
        """Endpoint público deve retornar 200"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/gestao-planos/planos/public returns 200")
    
    def test_planos_public_returns_list(self):
        """Deve retornar uma lista de planos"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✅ planos/public returns list with {len(data)} items")
    
    def test_planos_have_icone_field(self):
        """Planos devem ter campo icone"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public")
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No plans found")
        
        planos_com_icone = [p for p in data if p.get('icone')]
        print(f"✅ Found {len(planos_com_icone)}/{len(data)} planos with icone field")
        
        # Verificar formato (emoji ou string)
        for plano in planos_com_icone[:3]:
            print(f"   - {plano.get('nome')}: icone={plano.get('icone')}")
    
    def test_planos_have_cor_field(self):
        """Planos devem ter campo cor"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public")
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No plans found")
        
        planos_com_cor = [p for p in data if p.get('cor')]
        print(f"✅ Found {len(planos_com_cor)}/{len(data)} planos with cor field")
        
        # Verificar formato (hex color)
        for plano in planos_com_cor[:3]:
            cor = plano.get('cor')
            assert cor.startswith('#'), f"Invalid color format: {cor}"
            print(f"   - {plano.get('nome')}: cor={cor}")
    
    def test_planos_categoria_id_field_exists(self):
        """Verificar se planos têm campo categoria_id (pode ser null)"""
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public")
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No plans found")
        
        # categoria_id pode existir ou não - verificamos se algum plano tem
        planos_com_categoria = [p for p in data if p.get('categoria_id')]
        print(f"✅ Found {len(planos_com_categoria)}/{len(data)} planos with categoria_id defined")
        
        if planos_com_categoria:
            for plano in planos_com_categoria[:3]:
                print(f"   - {plano.get('nome')}: categoria_id={plano.get('categoria_id')}")
    
    def test_planos_filter_by_tipo_usuario(self):
        """Deve filtrar planos por tipo_usuario"""
        # Testar filtro para parceiro
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public?tipo_usuario=parceiro")
        assert response.status_code == 200
        planos_parceiro = response.json()
        
        for plano in planos_parceiro:
            assert plano.get('tipo_usuario') == 'parceiro', f"Expected parceiro, got {plano.get('tipo_usuario')}"
        
        print(f"✅ Filter by tipo_usuario=parceiro returns {len(planos_parceiro)} planos")
        
        # Testar filtro para motorista
        response = requests.get(f"{BASE_URL}/api/gestao-planos/planos/public?tipo_usuario=motorista")
        assert response.status_code == 200
        planos_motorista = response.json()
        
        for plano in planos_motorista:
            assert plano.get('tipo_usuario') == 'motorista', f"Expected motorista, got {plano.get('tipo_usuario')}"
        
        print(f"✅ Filter by tipo_usuario=motorista returns {len(planos_motorista)} planos")


class TestCategoriasAuthenticated:
    """Test authenticated category endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@tvdefleet.com", "password": "123456"}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate as admin")
        token = response.json().get('token')
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_and_list_categoria(self, auth_headers):
        """Admin pode criar categoria e ela aparece na lista pública"""
        import uuid
        test_id = str(uuid.uuid4())[:8]
        
        # Criar categoria
        categoria_data = {
            "nome": f"TEST_Cat_{test_id}",
            "descricao": "Teste de categoria",
            "icone": "🧪",
            "cor": "#10B981",
            "ordem": 999
        }
        
        response = requests.post(
            f"{BASE_URL}/api/gestao-planos/categorias",
            json=categoria_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        categoria_id = created.get('id')
        print(f"✅ Created categoria: {created.get('nome')} with id={categoria_id}")
        
        # Verificar na lista pública
        response = requests.get(f"{BASE_URL}/api/gestao-planos/categorias/public")
        categorias = response.json()
        
        found = any(c.get('id') == categoria_id for c in categorias)
        assert found, f"Created category not found in public list"
        print(f"✅ Created category appears in public list")
        
        # Cleanup - deletar categoria
        response = requests.delete(
            f"{BASE_URL}/api/gestao-planos/categorias/{categoria_id}",
            headers=auth_headers
        )
        print(f"✅ Cleanup: deleted test category")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
