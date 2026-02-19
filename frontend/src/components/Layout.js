import { Link, useLocation } from 'react-router-dom';
import { 
  Users, Car, Truck, FileText, DollarSign, MessageSquare, 
  Building, ClipboardCheck, Package, Settings, LogOut, ChevronDown, 
  Shield, Bell, Menu, X, Home, User, HardDrive, Building2, MessageCircle, Zap, TrendingUp
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Notificacoes from './Notificacoes';
import CriarTemplateModal from './CriarTemplateModal';
import GestorParceiroSelector from './GestorParceiroSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Mapeamento de funcionalidades para itens de menu
const FUNCIONALIDADES_MENU = {
  vistorias: ['Vistorias'],
  contratos: ['📄 Gestão de Contratos', '➕ Criar Contrato', 'Gestão de Contratos', 'Criar Contrato'],
  rpa_automacao: ['🤖 RPA Automação', '📥 Importação Dados', 'RPA Automação', 'Importação Dados', '📝 RPA Designer', 'RPA Designer'],
  relatorios: ['📊 Resumo Semanal', 'Resumo Semanal'],
  financeiro: ['💰 Extras/Dívidas', '✅ Verificar Recibos', '💳 Pagamentos', '📁 Arquivo de Recibos', 'Extras/Dívidas', 'Verificar Recibos', 'Pagamentos', 'Arquivo de Recibos'],
  alertas: ['🔔 Alertas de Custos', 'Alertas de Custos'],
  motoristas: ['Lista de Motoristas', 'Motoristas'],
  veiculos: ['Lista de Veículos', 'Veículos'],
  whatsapp: ['📱 WhatsApp', 'WhatsApp'],
  terabox: ['Terabox']
};

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [criarTemplateOpen, setCriarTemplateOpen] = useState(false);
  const [permissoes, setPermissoes] = useState([]);
  const [permissoesLoaded, setPermissoesLoaded] = useState(false);
  const [modulosAtivos, setModulosAtivos] = useState([]);

  // Carregar permissões de funcionalidades e módulos ativos
  useEffect(() => {
    const carregarPermissoes = async () => {
      if (!user || user.role === 'admin' || user.role === 'motorista') {
        setPermissoesLoaded(true);
        return;
      }
      
      try {
        const [permissoesRes, modulosRes] = await Promise.all([
          axios.get(`${API}/permissoes/minhas`),
          axios.get(`${API}/gestao-planos/modulos-ativos/user/${user.id}`).catch(() => ({ data: { modulos_ativos: [] } }))
        ]);
        setPermissoes(permissoesRes.data.funcionalidades || []);
        setModulosAtivos(modulosRes.data.modulos_ativos || []);
      } catch (err) {
        console.error('Erro ao carregar permissões:', err);
        // Em caso de erro, permitir tudo (fallback)
        setPermissoes(Object.keys(FUNCIONALIDADES_MENU));
      } finally {
        setPermissoesLoaded(true);
      }
    };
    
    carregarPermissoes();
  }, [user]);
  
  // Verificar se tem módulo de comissões ativo
  const temModuloComissoes = useCallback(() => {
    if (user?.role === 'admin') return true;
    return modulosAtivos.some(m => 
      m.toLowerCase().includes('comiss') || 
      m.toLowerCase().includes('commission') ||
      m.toLowerCase().includes('relatorios') ||
      m.toLowerCase().includes('reports')
    );
  }, [user, modulosAtivos]);

  // Verificar se um item de menu está permitido
  const itemPermitido = useCallback((label) => {
    // Admin tem acesso a tudo
    if (!user || user.role === 'admin' || user.role === 'motorista') return true;
    
    // Se permissões não carregaram ainda, mostrar tudo
    if (!permissoesLoaded) return true;
    
    // Verificar se o label está associado a alguma funcionalidade
    for (const [funcId, labels] of Object.entries(FUNCIONALIDADES_MENU)) {
      if (labels.some(l => label.includes(l) || l.includes(label))) {
        return permissoes.includes(funcId);
      }
    }
    
    // Items não mapeados - mostrar por padrão
    return true;
  }, [user, permissoes, permissoesLoaded]);

  // Filtrar submenu baseado nas permissões
  const filtrarSubmenu = useCallback((submenu) => {
    if (!user || user.role === 'admin' || user.role === 'motorista') return submenu;
    return submenu.filter(item => itemPermitido(item.label));
  }, [user, itemPermitido]);

  const getNavItems = () => {
    if (!user) return [];

    // Motorista menu
    if (user.role === 'motorista') {
      return [
        { path: '/profile', icon: Home, label: 'Início' },
        { path: '/motorista-documentos', icon: FileText, label: 'Documentos' },
        { path: '/motorista-ganhos', icon: DollarSign, label: 'Ganhos' },
        { path: '/mensagens', icon: MessageSquare, label: 'Mensagens' }
      ];
    }

    // Contabilista menu - Apenas acesso a contabilidade e documentos financeiros
    if (user.role === 'contabilista') {
      return [
        { path: '/dashboard', icon: Home, label: 'Início' },
        { path: '/contabilidade', icon: FileText, label: 'Contabilidade' },
        { 
          label: 'Documentos', 
          icon: FileText,
          submenu: [
            { path: '/contabilidade', label: '📋 Todas as Faturas' },
            { path: '/contabilidade?tab=faturas', label: '🧾 Faturas Fornecedores' },
            { path: '/contabilidade?tab=recibos', label: '📄 Recibos Motoristas' },
            { path: '/contabilidade?tab=veiculos', label: '🚗 Faturas Veículos' }
          ]
        }
      ];
    }

    // Parceiro menu - filtrado por permissões
    if (user.role === 'parceiro') {
      const motoristasSubmenu = filtrarSubmenu([
        { path: '/motoristas', label: 'Lista de Motoristas' },
        { path: '/contratos', label: '📄 Gestão de Contratos' },
        { path: '/criar-contrato', label: '➕ Criar Contrato' }
      ]);
      
      const veiculosSubmenu = filtrarSubmenu([
        { path: '/vehicles', label: 'Lista de Veículos' },
        { path: '/vistorias', label: 'Vistorias Agendadas' },
        { path: '/vistorias-mobile', label: '📱 Vistorias Móveis' },
        { path: '/inspetores', label: '👤 Inspetores' }
      ]);
      
      const financeiroSubmenu = filtrarSubmenu([
        { path: '/resumo-semanal', label: '📊 Resumo Semanal' },
        { path: '/gestao-extras', label: '💰 Extras/Dívidas' },
        { path: '/verificar-recibos', label: '✅ Verificar Recibos' },
        { path: '/pagamentos-parceiro', label: '💳 Pagamentos' },
        { path: '/arquivo-recibos', label: '📁 Arquivo de Recibos' },
        { path: '/alertas-custos', label: '🔔 Alertas de Custos' }
      ]);
      
      const items = [];
      
      if (motoristasSubmenu.length > 0) {
        items.push({ 
          label: 'Motoristas', 
          icon: Users,
          submenu: motoristasSubmenu
        });
      }
      
      if (veiculosSubmenu.length > 0) {
        items.push({ 
          label: 'Veículos', 
          icon: Car,
          submenu: veiculosSubmenu
        });
      }
      
      if (financeiroSubmenu.length > 0) {
        items.push({ 
          label: 'Financeiro', 
          icon: DollarSign,
          submenu: financeiroSubmenu
        });
      }
      
      items.push({ path: '/mensagens', icon: MessageSquare, label: 'Mensagens' });
      
      return items;
    }

    // Admin/Gestao menu
    const items = [
      { 
        label: 'Motoristas', 
        icon: Users,
        submenu: [
          { path: '/motoristas', label: 'Lista de Motoristas' },
          { path: '/contratos', label: '📄 Gestão de Contratos' },
          { path: '/criar-contrato', label: '➕ Criar Contrato' }
        ]
      },
      { 
        label: 'Veículos', 
        icon: Car,
        submenu: [
          { path: '/vehicles', label: 'Lista de Veículos' },
          { path: '/vistorias', label: 'Vistorias' }
        ]
      },
      { 
        label: 'Financeiro', 
        icon: DollarSign,
        submenu: [
          { path: '/resumo-semanal', label: '📊 Resumo Semanal' },
          { path: '/dashboard-faturacao', label: '📈 Dashboard Faturação' },
          { path: '/contabilidade', label: '📋 Contabilidade' },
          { path: '/gestao-extras', label: '💰 Extras/Dívidas' },
          { path: '/verificar-recibos', label: '✅ Verificar Recibos' },
          { path: '/pagamentos', label: '💳 Pagamentos a Motoristas' },
          { path: '/arquivo-recibos', label: '📁 Arquivo de Recibos' },
          { path: '/alertas-custos', label: '🔔 Alertas de Custos' },
          { path: '/importar-dados', label: '📥 Importar Dados' }
        ]
      },
      { path: '/mensagens', icon: MessageSquare, label: 'Mensagens' }
    ];

    // Add Parceiros for admin and gestao
    if (user.role === 'admin' || user.role === 'gestao') {
      items.splice(2, 0, { path: '/parceiros', icon: Building, label: 'Parceiros' });
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <Link 
                to={user?.role === 'motorista' ? '/profile' : '/dashboard'} 
                className="text-xl font-bold text-slate-800"
              >
                TVDEFleet
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-0">
              {navItems.map((item, index) => (
                item.submenu ? (
                  <DropdownMenu key={index}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center space-x-1 px-2 h-8">
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {item.submenu.map((subItem, subIndex) => (
                        <DropdownMenuItem key={subIndex} asChild={!subItem.action}>
                          {subItem.action ? (
                            <button 
                              onClick={subItem.action} 
                              className="cursor-pointer w-full text-left"
                            >
                              {subItem.label}
                            </button>
                          ) : (
                            <Link to={subItem.path} className="cursor-pointer">
                              {subItem.label}
                            </Link>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    key={index}
                    to={item.path}
                    className={`flex items-center space-x-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              {/* Gestor Parceiro Selector */}
              {user?.role === 'gestao' && (
                <GestorParceiroSelector user={user} />
              )}

              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => setNotificacoesOpen(true)}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>

              {/* Painel de Controlo Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="text-sm font-medium hidden sm:inline-block">
                      {user?.name?.split(' ')[0] || 'Utilizador'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Admin Panel - Reorganizado */}
                  {user.role === 'admin' && (
                    <>
                      {/* Gestão de Utilizadores e Planos */}
                      <div className="px-2 py-1.5">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Gestão
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/usuarios" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <Users className="w-4 h-4" />
                          <span>Utilizadores</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/gestao-planos" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <Package className="w-4 h-4" />
                          <span>Planos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/gestao-funcionalidades" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <Settings className="w-4 h-4" />
                          <span>Permissões</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/comissoes" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <span>💰 Comissões</span>
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Integrações e Sincronização - Simplificado */}
                      <div className="px-2 py-1.5">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Integrações
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/plataformas" className="flex items-center space-x-2 cursor-pointer pl-4" data-testid="admin-plataformas-link">
                          <span>🔌 Plataformas</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/sincronizacao-hub" className="flex items-center space-x-2 cursor-pointer pl-4" data-testid="sincronizacao-hub-link">
                          <span>📊 Sincronização</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes-admin" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <span>⚙️ Configurações</span>
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Comunicações */}
                      <div className="px-2 py-1.5">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Comunicações
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/whatsapp" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <span>📱 WhatsApp</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/comunicacoes" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <span>📧 Notificações</span>
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Sistema */}
                      <div className="px-2 py-1.5">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Sistema
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/terabox" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <HardDrive className="w-4 h-4" />
                          <span>Terabox</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/backup" className="flex items-center space-x-2 cursor-pointer pl-4" data-testid="admin-backup-link">
                          <span>💾 Backup Completo</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/sistema-admin" className="flex items-center space-x-2 cursor-pointer pl-4" data-testid="sistema-admin-link">
                          <span>🖥️ Gestão Sistema</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/precos-especiais" className="flex items-center space-x-2 cursor-pointer pl-4" data-testid="admin-precos-especiais-link">
                          <span>🏷️ Preços Especiais</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/termos-privacidade" className="flex items-center space-x-2 cursor-pointer pl-4">
                          <span>📜 Termos</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Parceiro Panel */}
                  {user.role === 'parceiro' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/meu-plano" className="flex items-center space-x-2 cursor-pointer">
                          <Package className="w-4 h-4" />
                          <span>Meu Plano</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/loja-planos" className="flex items-center space-x-2 cursor-pointer" data-testid="link-loja-planos">
                          <Building2 className="w-4 h-4" />
                          <span>Loja de Planos</span>
                        </Link>
                      </DropdownMenuItem>
                      {itemPermitido('Terabox') && (
                        <DropdownMenuItem asChild>
                          <Link to="/terabox" className="flex items-center space-x-2 cursor-pointer">
                            <HardDrive className="w-4 h-4" />
                            <span>Terabox</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to="/gestao-documentos" className="flex items-center space-x-2 cursor-pointer" data-testid="link-gestao-documentos">
                          <FileText className="w-4 h-4" />
                          <span>Gestão de Documentos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/empresas-faturacao" className="flex items-center space-x-2 cursor-pointer" data-testid="link-empresas-faturacao">
                          <Building2 className="w-4 h-4" />
                          <span>Empresas de Faturação</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard-faturacao" className="flex items-center space-x-2 cursor-pointer" data-testid="link-dashboard-faturacao">
                          <TrendingUp className="w-4 h-4" />
                          <span>Dashboard Faturação</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">
                          <Settings className="w-3 h-3" />
                          <span>Configurações</span>
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes-parceiro" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>📧 Email & Comunicações</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes-parceiro?tab=credenciais" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>🔐 Plataformas</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-relatorios" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>⚙️ Configurações Relatórios</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/copia-seguranca" className="flex items-center space-x-2 cursor-pointer pl-6" data-testid="link-copia-seguranca">
                          <span>💾 Cópia de Segurança</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/config/comissoes" className="flex items-center space-x-2 cursor-pointer pl-6" data-testid="config-comissoes-link">
                          <span>💰 Comissões</span>
                        </Link>
                      </DropdownMenuItem>
                      {itemPermitido('📱 WhatsApp') && (
                        <DropdownMenuItem asChild>
                          <Link to="/whatsapp" className="flex items-center space-x-2 cursor-pointer pl-6">
                            <span>📱 WhatsApp</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">
                          <Zap className="w-3 h-3" />
                          <span>Login Plataformas</span>
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/minha-configuracao-uber" className="flex items-center space-x-2 cursor-pointer pl-6" data-testid="parceiro-login-uber">
                          <span>🚗 Login Uber</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-prio" className="flex items-center space-x-2 cursor-pointer pl-6" data-testid="parceiro-login-prio">
                          <span>⛽ Login Prio</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Motorista Panel */}
                  {user.role === 'motorista' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/meu-plano-motorista" className="flex items-center space-x-2 cursor-pointer">
                          <Package className="w-4 h-4" />
                          <span>Meu Plano</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center space-x-2 cursor-pointer">
                      <User className="w-4 h-4" />
                      <span>Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="flex items-center space-x-2 cursor-pointer text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item, index) => (
                item.submenu ? (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {item.submenu.map((subItem, subIndex) => (
                        subItem.action ? (
                          <button
                            key={subIndex}
                            onClick={() => {
                              subItem.action();
                              setMobileMenuOpen(false);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            {subItem.label}
                          </button>
                        ) : (
                          <Link
                            key={subIndex}
                            to={subItem.path}
                            className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {subItem.label}
                          </Link>
                        )
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={index}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname === item.path
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Notificações Modal */}
      <Notificacoes 
        open={notificacoesOpen} 
        onOpenChange={setNotificacoesOpen}
        user={user}
      />

      {/* Criar Template Modal */}
      <CriarTemplateModal
        open={criarTemplateOpen}
        onOpenChange={setCriarTemplateOpen}
        user={user}
        onSuccess={() => {
          // Refresh ou redirect se necessário
        }}
      />
    </div>
  );
};

export default Layout;
