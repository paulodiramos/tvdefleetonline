import { Link, useLocation } from 'react-router-dom';
import { 
  Users, Car, Truck, FileText, TrendingUp, DollarSign, MessageSquare, 
  Building, ClipboardCheck, Package, Settings, LogOut, ChevronDown, 
  Shield, Bell, Menu, X, Home, User
} from 'lucide-react';
import { useState } from 'react';
import Notificacoes from './Notificacoes';
import CriarTemplateModal from './CriarTemplateModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [criarTemplateOpen, setCriarTemplateOpen] = useState(false);

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

    // Parceiro menu
    if (user.role === 'parceiro') {
      return [
        { path: '/motoristas', icon: Users, label: 'Motoristas' },
        { 
          label: 'Veículos', 
          icon: Car,
          submenu: [
            { path: '/vehicles', label: 'Lista de Veículos' },
            { path: '/vistorias', label: 'Vistorias' }
          ]
        },
        { 
          label: 'Contratos', 
          icon: FileText,
          submenu: [
            { path: '/contratos', label: 'Gestão de Contratos' },
            { action: () => setCriarTemplateOpen(true), label: 'Criar Template' },
            { path: '/criar-contrato', label: 'Criar Contrato' }
          ]
        },
        { 
          label: 'Relatórios', 
          icon: TrendingUp,
          submenu: [
            { path: '/relatorios', label: '📊 Gerir Relatórios' },
            { path: '/historico-relatorios', label: '📜 Histórico' },
            { path: '/configuracao-relatorios', label: '⚙️ Configurações' }
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

    // Admin/Gestao menu
    const items = [
      { path: '/motoristas', icon: Users, label: 'Motoristas' },
      { 
        label: 'Veículos', 
        icon: Car,
        submenu: [
          { path: '/vehicles', label: 'Lista de Veículos' },
          { path: '/vistorias', label: 'Vistorias' }
        ]
      },
      { 
        label: 'Contratos', 
        icon: FileText,
        submenu: [
          { path: '/contratos', label: 'Gestão de Contratos' },
          { action: () => setCriarTemplateOpen(true), label: 'Criar Template' },
          { path: '/criar-contrato', label: 'Criar Contrato' }
        ]
      },
      { 
        label: 'Relatórios', 
        icon: TrendingUp,
        submenu: [
          { path: '/criar-relatorio-semanal', label: 'Criar Relatório' },
          { path: '/gestao-pagamentos-recibos', label: 'Pagamentos & Recibos' },
          { path: '/gestao-credenciais', label: 'Sincronização Auto' },
          { path: '/importar-dados', label: 'Importar Dados CSV' },
          { path: '/ficheiros-importados', label: 'Ficheiros Importados' },
          { path: '/configuracao-csv', label: 'Configurar Extração CSV' },
          { path: '/automacao', label: '🤖 Automação RPA' }
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
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item, index) => (
                item.submenu ? (
                  <DropdownMenu key={index}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center space-x-1">
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
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
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
                      {user?.name || 'Utilizador'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Admin Panel */}
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/planos-parceiros" className="flex items-center space-x-2 cursor-pointer">
                          <Package className="w-4 h-4" />
                          <span>Gestão de Planos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/usuarios" className="flex items-center space-x-2 cursor-pointer">
                          <Users className="w-4 h-4" />
                          <span>Utilizadores</span>
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
                        <Link to="/configuracao-integracao" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>Integrações</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes-comunicacao" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>Comunicações</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-categorias" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>Categorias Uber/Bolt</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/cartoes-frota" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>Cartões de Frota</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/automacao" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>🤖 Automação RPA</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracao-csv" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>📊 Extração CSV</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/termos-privacidade" className="flex items-center space-x-2 cursor-pointer pl-6">
                          <span>Termos & Privacidade</span>
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
