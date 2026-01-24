/**
 * ProtectedFeatureRoute - Componente para proteger rotas baseado em permissões
 * 
 * Verifica se o utilizador tem permissão para aceder a uma funcionalidade específica.
 * Se não tiver, redireciona para o dashboard.
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';

// Mapeamento de rotas para funcionalidades
const ROTA_FUNCIONALIDADE = {
  '/vistorias': 'vistorias',
  '/contratos': 'contratos',
  '/criar-contrato': 'contratos',
  '/rpa-automacao': 'rpa_automacao',
  '/rpa-designer': 'rpa_automacao',
  '/importacao-rpa': 'rpa_automacao',
  '/whatsapp': 'whatsapp',
  '/terabox': 'terabox',
  '/resumo-semanal': 'relatorios',
  '/relatorios': 'relatorios',
  '/gestao-extras': 'financeiro',
  '/verificar-recibos': 'financeiro',
  '/pagamentos-parceiro': 'financeiro',
  '/arquivo-recibos': 'financeiro',
  '/alertas-custos': 'alertas',
  '/motoristas': 'motoristas',
  '/vehicles': 'veiculos'
};

const ProtectedFeatureRoute = ({ children, user, rota }) => {
  const [loading, setLoading] = useState(true);
  const [permitido, setPermitido] = useState(true);

  useEffect(() => {
    const verificarPermissao = async () => {
      // Admin e motorista sempre têm acesso
      if (!user || user.role === 'admin' || user.role === 'motorista') {
        setPermitido(true);
        setLoading(false);
        return;
      }

      // Verificar se a rota precisa de permissão
      const funcionalidade = ROTA_FUNCIONALIDADE[rota];
      if (!funcionalidade) {
        setPermitido(true);
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/permissoes/minhas`);
        const funcionalidades = response.data.funcionalidades || [];
        setPermitido(funcionalidades.includes(funcionalidade));
      } catch (err) {
        console.error('Erro ao verificar permissão:', err);
        // Em caso de erro, permitir acesso
        setPermitido(true);
      } finally {
        setLoading(false);
      }
    };

    verificarPermissao();
  }, [user, rota]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">A verificar permissões...</p>
        </div>
      </div>
    );
  }

  if (!permitido) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedFeatureRoute;
