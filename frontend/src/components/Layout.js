import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Truck, LayoutDashboard, Car, Users, DollarSign, LogOut, Menu, X, Building, UserCircle, FileText, CreditCard, Upload, Settings, Database, Shield, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Layout = ({ user, onLogout, children }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Build navigation items based on role
  const getNavItems = () => {
    // For parceiro/operacional role: Replace dashboard with reports, add payments, REMOVE financials
    if (user.role === 'parceiro' || user.role === 'operacional') {
      return [
        { path: '/relatorios', icon: FileText, label: 'Relatórios' },
        { path: '/vehicles', icon: Car, label: 'Veículos' },
        { path: '/motoristas', icon: Users, label: 'Motoristas' },
        { path: '/pagamentos', icon: CreditCard, label: 'Pagamentos' }
      ];
    }

    // Default items for admin, gestao, motorista (Dashboard removed - logo handles that)
    const items = [
      { path: '/vehicles', icon: Car, label: 'Veículos' },
      { path: '/motoristas', icon: Users, label: 'Motoristas' },
      { path: '/financials', icon: DollarSign, label: 'Financeiro' }
    ];

    // Add Parceiros for admin and gestao
    if (user.role === 'admin' || user.role === 'gestao') {
      items.splice(2, 0, { path: '/parceiros', icon: Building, label: 'Parceiros' });
    }

    // Add Contratos for admin and gestao
    if (user.role === 'admin' || user.role === 'gestao') {
      items.push({ path: '/contratos', icon: FileText, label: 'Contratos' });
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
              <Link to="/dashboard" className="text-xl font-bold text-slate-800">TVDEFleet</Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-0.5">
              {navItems.map((item) => (
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
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Admin Dropdown Menu */}
              <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex items-center space-x-2"
                    data-testid="profile-dropdown"
                  >
                    <span className="text-sm font-medium text-slate-800">Admin</span>
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
                        <Link to="/vehicle-data" className="flex items-center space-x-2 cursor-pointer">
                          <Database className="w-4 h-4" />
                          <span>Dados de Veículos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/configuracoes" className="flex items-center space-x-2 cursor-pointer">
                          <Settings className="w-4 h-4" />
                          <span>Configurações</span>
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
    </div>
  );
};

export default Layout;