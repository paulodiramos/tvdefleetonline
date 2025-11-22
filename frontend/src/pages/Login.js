import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Truck, Shield, Users, Building, CheckCircle } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loadingForgot, setLoadingForgot] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      toast.success('Login bem-sucedido!');
      onLogin(response.data.access_token, response.data.user);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8 hover:opacity-80 transition">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">TVDEFleet</h1>
          <p className="text-slate-600">Gestão Inteligente de Frotas</p>
        </Link>

        <Card className="glass shadow-xl" data-testid="login-card">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Bem-vindo</CardTitle>
            <CardDescription className="text-center">Entre com suas credenciais</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                  className="border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                  className="border-slate-300"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="text-center text-sm text-slate-600">
                <p className="mb-3">Novo motorista?</p>
                <Button
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={() => setShowRegistroModal(true)}
                  data-testid="register-motorista-button"
                >
                  Criar Nova Conta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Truck className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-slate-600">Gestão de Frotas</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Shield className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-slate-600">Seguros</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-slate-600">Motoristas</p>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Registo */}
      {showRegistroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Como deseja registar-se?</CardTitle>
              <CardDescription className="text-center">
                Escolha o tipo de registo adequado ao seu perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {/* Motorista */}
                <Card 
                  className="cursor-pointer hover:shadow-xl hover:border-blue-500 transition"
                  onClick={() => {
                    setShowRegistroModal(false);
                    navigate('/registo-motorista');
                  }}
                >
                  <CardHeader className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">Sou Motorista</CardTitle>
                    <CardDescription>Trabalho individual</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span>Registo individual</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span>Acesso a veículos</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span>Suporte especializado</span>
                      </li>
                    </ul>
                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-sm">
                      Registar
                    </Button>
                  </CardContent>
                </Card>

                {/* Gestão de Frota */}
                <Card 
                  className="cursor-pointer hover:shadow-xl hover:border-purple-500 transition border-2 border-purple-200"
                  onClick={() => {
                    setShowRegistroModal(false);
                    navigate('/registo-parceiro?tipo=gestao_frota');
                  }}
                >
                  <CardHeader className="text-center">
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">Popular</span>
                    </div>
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Truck className="w-10 h-10 text-purple-600" />
                    </div>
                    <CardTitle className="text-lg">Gerir Frota</CardTitle>
                    <CardDescription>Tenho veículos e motoristas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Gestão completa</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Múltiplos veículos</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Controlo financeiro</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        <span><strong>Serviços incluídos</strong></span>
                      </li>
                    </ul>
                    <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-sm">
                      Começar Agora
                    </Button>
                  </CardContent>
                </Card>

                {/* Usar Plataforma */}
                <Card 
                  className="cursor-pointer hover:shadow-xl hover:border-green-500 transition"
                  onClick={() => {
                    setShowRegistroModal(false);
                    navigate('/registo-parceiro?tipo=usar_plataforma');
                  }}
                >
                  <CardHeader className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building className="w-10 h-10 text-green-600" />
                    </div>
                    <CardTitle className="text-lg">Usar Plataforma</CardTitle>
                    <CardDescription>Outros serviços</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Acesso à plataforma</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Serviços parceiros</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Rede TVDE</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Consultoria</span>
                      </li>
                    </ul>
                    <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-sm">
                      Registar
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRegistroModal(false)}
                  className="px-8"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Login;