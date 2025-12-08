import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Truck, LayoutDashboard, Car, Users, DollarSign, LogOut, Menu, X, Building, UserCircle, FileText, CreditCard, Upload, Settings, Database, Shield, ChevronDown, Zap, TrendingUp, Package, Receipt, MessageSquare, Plug, Bell, ClipboardCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from 'axios';
import { API } from '@/App';
import NotificationBell from '@/components/NotificationBell';

const Layout = ({ user, onLogout, children }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showTermosModal, setShowTermosModal] = useState(false);
  const [showPrivacidadeModal, setShowPrivacidadeModal] = useState(false);
  const [termosText, setTermosText] = useState('');
  const [privacidadeText, setPrivacidadeText] = useState('');

  useEffect(() => {
    fetchTextos();
  }, []);

  const fetchTextos = async () => {
    try {
      const response = await axios.get(`${API}/api/configuracoes/textos`);
      setTermosText(response.data.termos_condicoes || 'Termos e Condições não configurados.');
      setPrivacidadeText(response.data.politica_privacidade || 'Política de Privacidade não configurada.');
    } catch (error) {
      console.error('Error fetching textos:', error);
    }
  };

  const isActive = (path) => location.pathname === path;

  // Build navigation items based on role
  const getNavItems = () => {
    // For motorista role: Menu completo (4 itens - Dashboard é logo)
    if (user.role === 'motorista') {
      return [
        { path: '/motorista/recibos', icon: Receipt, label: 'Ganhos' },
        { path: '/motorista/oportunidades', icon: Car, label: 'Oportunidades' },
        { path: '/mensagens', icon: MessageSquare, label: 'Mensagens' }
      ];
    }

    // For parceiro role: Replace dashboard with reports, add payments with financeiro submenu
    if (user.role === 'parceiro') {
      return [
        { path: '/motoristas', icon: Users, label: 'Motoristas' },
        { path: '/vehicles', icon: Car, label: 'Veículos' },
        { path: '/vistorias', icon: ClipboardCheck, label: 'Vistorias' },
        { 
          label: 'Contratos', 
          icon: FileText,
          submenu: [
            { path: '/templates-contratos', label: 'Templates de Contratos' },
            { path: '/criar-contrato', label: 'Criar Contrato' },
            { path: '/lista-contratos', label: 'Lista de Contratos' }
          ]
        },
        { 
          label: 'Relatórios', 
          icon: TrendingUp,
          submenu: [
            { path: '/criar-relatorio-semanal', label: 'Criar Relatório' },
            { path: '/sincronizacao-auto', label: 'Sync Auto' },
            { path: '/upload-csv', label: 'Upload CSV' }
          ]
        },
        { 
          label: 'Financeiro', 
          icon: DollarSign,
          submenu: [
            { path: '/pagamentos-parceiro', label: 'Pagamentos' },
            { path: '/verificar-recibos', label: 'Verificar Recibos' }
          ]
        },
        { path: '/mensagens', icon: MessageSquare, label: 'Mensagens' }
      ];
    }

    // Default items for admin, gestao (Dashboard removed - logo handles that)
    const items = [
      { path: '/motoristas', icon: Users, label: 'Motoristas' },
      { path: '/vehicles', icon: Car, label: 'Veículos' },
      { path: '/vistorias', icon: ClipboardCheck, label: 'Vistorias' },
      { 
        label: 'Contratos', 
        icon: FileText,
        submenu: [
          { path: '/criar-contrato', label: 'Criar Contrato' },
          { path: '/lista-contratos', label: 'Lista de Contratos' }
        ]
      },
      { 
        label: 'Relatórios', 
        icon: TrendingUp,
        submenu: [
          { path: '/criar-relatorio-semanal', label: 'Criar Relatório' },
          { path: '/sincronizacao-auto', label: 'Sync Auto' },
          { path: '/upload-csv', label: 'Upload CSV' }
        ]
      },
      { 
        label: 'Financeiro', 
        icon: DollarSign,
        submenu: [
          { path: '/pagamentos', label: 'Pagamentos a Motoristas' },
          { path: '/verificar-recibos', label: 'Verificar Recibos' }
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
            <nav className="hidden md:flex items-center space-x-0.5">
              {navItems.map((item) => (
                item.submenu ? (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition text-sm text-slate-600 hover:bg-slate-100">
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {item.submenu.map((subitem) => (
                        <DropdownMenuItem key={subitem.path} asChild>
                          <Link to={subitem.path} className="cursor-pointer">
                            {subitem.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition text-sm ${
                      isActive(item.path)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <NotificationBell user={user} />
              
              {/* Admin Dropdown Menu */}
              <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex items-center space-x-2"
                    data-testid="profile-dropdown"
                  >
                    <span className="text-sm font-medium text-slate-800">Painel de Controlo</span>
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/usuarios" className="flex items-center space-x-2 cursor-pointer">
                          <Shield className="w-4 h-4" />
                          <span>Utilizadores</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/pendentes" className="flex items-center space-x-2 cursor-pointer">
                          <ClipboardCheck className="w-4 h-4" />
                          <span>Pendentes</span>
                        </Link>
                      </DropdownMenuItem>
                      
                      {/* Submenu Configurações */}
                      <div className="px-2 py-1.5">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">
                          <Settings className="w-3 h-3" />
                          <span>Configurações</span>
                        </div>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-planos" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <Package className="w-4 h-4" />
                          <span>Planos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/integracoes" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <Plug className="w-4 h-4" />
                          <span>Integrações</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/comunicacoes" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <Bell className="w-4 h-4" />
                          <span>Comunicações</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-comunicacoes" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <Mail className="w-4 h-4" />
                          <span>Config. Email/WhatsApp</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes-admin" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <FileText className="w-4 h-4" />
                          <span>Termos & Privacidade</span>
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="flex items-center space-x-2 cursor-pointer">
                          <UserCircle className="w-4 h-4" />
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
                    </>
                  )}
                  {user.role !== 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="flex items-center space-x-2 cursor-pointer">
                          <UserCircle className="w-4 h-4" />
                          <span>Perfil</span>
                        </Link>
                      </DropdownMenuItem>
                      {user.role === 'parceiro' && (
                        <DropdownMenuItem asChild>
                          <Link to="/meus-planos" className="flex items-center space-x-2 cursor-pointer">
                            <Package className="w-4 h-4" />
                            <span>Meus Módulos</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={onLogout}
                        className="flex items-center space-x-2 cursor-pointer text-red-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-button"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white" data-testid="mobile-menu">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                item.submenu ? (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center space-x-2 px-4 py-2 text-slate-800 font-medium">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.submenu.map((subitem) => (
                      <Link
                        key={subitem.path}
                        to={subitem.path}
                        className="flex items-center space-x-2 pl-11 pr-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span>{subitem.label}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition ${
                      isActive(item.path)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-800 px-4">{user.name}</p>
                <p className="text-xs text-slate-500 px-4 mb-3 capitalize">{user.role.replace('_', ' ')}</p>
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50 mb-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Truck className="w-5 h-5" />
                  <span>Site Público</span>
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-100 mb-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserCircle className="w-5 h-5" />
                  <span>Meu Perfil</span>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} TVDEFleet. Todos os direitos reservados.
            </p>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setShowTermosModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Termos e Condições
              </button>
              <button
                onClick={() => setShowPrivacidadeModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Política de Privacidade
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Termos e Condições */}
      <Dialog open={showTermosModal} onOpenChange={setShowTermosModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termos e Condições</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: termosText.replace(/\n/g, '<br/>') }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Política de Privacidade */}
      <Dialog open={showPrivacidadeModal} onOpenChange={setShowPrivacidadeModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Política de Privacidade</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: privacidadeText.replace(/\n/g, '<br/>') }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;