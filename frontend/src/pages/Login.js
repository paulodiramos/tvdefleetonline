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
                  onClick={() => navigate('/registo-motorista')}
                  data-testid="register-motorista-button"
                >
                  Registar como Motorista
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
    </div>
  );
};

export default Login;