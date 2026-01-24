/**
 * PermissionsContext - Gestão de Permissões de Funcionalidades
 * 
 * Este contexto gerencia as permissões de funcionalidades para cada parceiro.
 * O admin controla quais funcionalidades cada parceiro pode aceder através
 * da página /admin/gestao-funcionalidades
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';

// Mapeamento de funcionalidades para rotas e itens de menu
export const FUNCIONALIDADES_CONFIG = {
  whatsapp: {
    rotas: ['/whatsapp'],
    menuItems: ['WhatsApp', '📱 WhatsApp']
  },
  email: {
    rotas: [],
    menuItems: ['Email']
  },
  vistorias: {
    rotas: ['/vistorias'],
    menuItems: ['Vistorias']
  },
  contratos: {
    rotas: ['/contratos', '/criar-contrato', '/lista-contratos', '/templates-contratos'],
    menuItems: ['Gestão de Contratos', 'Criar Contrato', '📄 Gestão de Contratos', '➕ Criar Contrato']
  },
  rpa_automacao: {
    rotas: ['/rpa-automacao', '/rpa-designer', '/importacao-rpa'],
    menuItems: ['RPA Automação', 'RPA Designer', 'Importação Dados', '🤖 RPA Automação', '📥 Importação Dados']
  },
  importacao_csv: {
    rotas: ['/importar-ficheiros', '/lista-importacoes', '/ficheiros-importados', '/configuracao-csv'],
    menuItems: ['Importar', 'Importação']
  },
  agenda_veiculos: {
    rotas: [],
    menuItems: ['Agenda']
  },
  alertas: {
    rotas: ['/alertas-custos'],
    menuItems: ['Alertas', '🔔 Alertas de Custos']
  },
  anuncios_venda: {
    rotas: [],
    menuItems: ['Anúncios']
  },
  relatorios: {
    rotas: ['/resumo-semanal', '/relatorios', '/relatorios-semanais', '/historico-relatorios', '/gerar-relatorio-semanal'],
    menuItems: ['Resumo Semanal', 'Relatórios', '📊 Resumo Semanal']
  },
  financeiro: {
    rotas: ['/gestao-extras', '/verificar-recibos', '/pagamentos-parceiro', '/arquivo-recibos'],
    menuItems: ['Financeiro', 'Extras/Dívidas', 'Verificar Recibos', 'Pagamentos', 'Arquivo de Recibos', '💰 Extras/Dívidas', '✅ Verificar Recibos', '💳 Pagamentos', '📁 Arquivo de Recibos']
  },
  motoristas: {
    rotas: ['/motoristas'],
    menuItems: ['Motoristas', 'Lista de Motoristas']
  },
  veiculos: {
    rotas: ['/vehicles', '/ficha-veiculo'],
    menuItems: ['Veículos', 'Lista de Veículos']
  },
  documentos: {
    rotas: [],
    menuItems: ['Documentos']
  },
  terabox: {
    rotas: ['/terabox'],
    menuItems: ['Terabox']
  }
};

const PermissionsContext = createContext(null);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export const PermissionsProvider = ({ children, user }) => {
  const [funcionalidades, setFuncionalidades] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar permissões do utilizador
  const loadPermissions = useCallback(async () => {
    if (!user) {
      setFuncionalidades([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Admin tem todas as permissões
    if (user.role === 'admin') {
      setIsAdmin(true);
      setFuncionalidades(Object.keys(FUNCIONALIDADES_CONFIG));
      setLoading(false);
      return;
    }

    // Motorista não tem permissões de funcionalidades (tem menu próprio)
    if (user.role === 'motorista') {
      setFuncionalidades([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Parceiro e Gestão - carregar do backend
    try {
      setLoading(true);
      const response = await axios.get(`${API}/permissoes/minhas`);
      setFuncionalidades(response.data.funcionalidades || []);
      setIsAdmin(response.data.is_admin || false);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      // Em caso de erro, permitir todas as funcionalidades (fallback seguro)
      setFuncionalidades(Object.keys(FUNCIONALIDADES_CONFIG));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  /**
   * Verificar se uma funcionalidade específica está permitida
   */
  const temPermissao = useCallback((funcionalidadeId) => {
    if (isAdmin) return true;
    if (!user) return false;
    if (user.role === 'motorista') return true; // Motoristas usam menu próprio
    return funcionalidades.includes(funcionalidadeId);
  }, [funcionalidades, isAdmin, user]);

  /**
   * Verificar se uma rota está permitida
   */
  const rotaPermitida = useCallback((rota) => {
    if (isAdmin) return true;
    if (!user) return false;
    if (user.role === 'motorista') return true;
    
    // Rotas sempre permitidas (dashboard, profile, etc)
    const rotasPublicas = ['/dashboard', '/profile', '/login', '/mensagens', '/notificacoes', '/meu-plano', '/configuracoes-parceiro', '/credenciais-plataformas', '/configuracao-relatorios', '/integracoes'];
    if (rotasPublicas.some(r => rota.startsWith(r))) return true;

    // Verificar se a rota está associada a alguma funcionalidade
    for (const [funcId, config] of Object.entries(FUNCIONALIDADES_CONFIG)) {
      if (config.rotas.some(r => rota.startsWith(r))) {
        return funcionalidades.includes(funcId);
      }
    }

    // Rotas não mapeadas - permitir por padrão
    return true;
  }, [funcionalidades, isAdmin, user]);

  /**
   * Verificar se um item de menu deve ser mostrado
   */
  const menuItemPermitido = useCallback((label) => {
    if (isAdmin) return true;
    if (!user) return false;
    if (user.role === 'motorista') return true;

    // Verificar se o label está associado a alguma funcionalidade desativada
    for (const [funcId, config] of Object.entries(FUNCIONALIDADES_CONFIG)) {
      if (config.menuItems.some(item => label.includes(item) || item.includes(label))) {
        return funcionalidades.includes(funcId);
      }
    }

    // Items não mapeados - permitir por padrão
    return true;
  }, [funcionalidades, isAdmin, user]);

  /**
   * Filtrar array de itens de menu baseado nas permissões
   */
  const filtrarMenuItems = useCallback((items) => {
    if (isAdmin || !user || user.role === 'motorista') return items;

    return items.filter(item => {
      // Se tem submenu, filtrar recursivamente
      if (item.submenu) {
        const submenuFiltrado = item.submenu.filter(sub => menuItemPermitido(sub.label));
        // Se todos os subitems foram removidos, remover o item pai
        return submenuFiltrado.length > 0;
      }
      return menuItemPermitido(item.label);
    }).map(item => {
      if (item.submenu) {
        return {
          ...item,
          submenu: item.submenu.filter(sub => menuItemPermitido(sub.label))
        };
      }
      return item;
    });
  }, [menuItemPermitido, isAdmin, user]);

  const value = {
    funcionalidades,
    isAdmin,
    loading,
    error,
    temPermissao,
    rotaPermitida,
    menuItemPermitido,
    filtrarMenuItems,
    recarregarPermissoes: loadPermissions
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export default PermissionsContext;
