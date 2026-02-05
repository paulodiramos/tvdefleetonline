import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, Loader2, Shield, Key, 
  Lock, Smartphone, Clock, FileText, Calendar, Users, DollarSign
} from 'lucide-react';

const ConfiguracaoUberParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [credenciais, setCredenciais] = useState({ email: '', password: '', telefone: '' });
  const [sessao, setSessao] = useState(null);
  const [historico, setHistorico] = useState([]);
  
  // Estados de login
  const [fazendoLogin, setFazendoLogin] = useState(false);
  const [precisaSMS, setPrecisaSMS] = useState(false);
  const [codigoSMS, setCodigoSMS] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Carregar credenciais
      const credRes = await axios.get(`${API}/uber/minhas-credenciais`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (credRes.data?.email) {
        setCredenciais(prev => ({ ...prev, email: credRes.data.email, telefone: credRes.data.telefone || '' }));
      }
      
      // Verificar sessão
      const sessaoRes = await axios.get(`${API}/uber/minha-sessao`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessao(sessaoRes.data);
      
      // Carregar histórico
      const histRes = await axios.get(`${API}/uber/meu-historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(histRes.data || []);
      
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const guardarCredenciais = async () => {
    if (!credenciais.email || !credenciais.password) {
      toast.error('Preencha email e password');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/uber/minhas-credenciais`, credenciais, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais guardadas!');
    } catch (error) {
      toast.error('Erro ao guardar');
    }
  };

  const fazerLogin = async () => {
    if (!credenciais.email || !credenciais.password) {
      toast.error('Preencha as credenciais primeiro');
      return;
    }
    
    // Guardar credenciais primeiro
    await guardarCredenciais();
    
    setFazendoLogin(true);
    setPrecisaSMS(false);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/uber/fazer-login`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      });
      
      if (response.data.sucesso) {
        toast.success('Login realizado com sucesso!');
        carregarDados();
      } else if (response.data.precisa_sms) {
        setPrecisaSMS(true);
        toast.info('Introduza o código SMS enviado para o seu telefone');
      } else if (response.data.precisa_captcha) {
        toast.warning('CAPTCHA detectado. Por favor, contacte o administrador.');
      } else {
        toast.error(response.data.erro || 'Erro no login');
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
    } finally {
      setFazendoLogin(false);
    }
  };

  const confirmarSMS = async () => {
    if (!codigoSMS || codigoSMS.length < 4) {
      toast.error('Introduza o código de 4 dígitos');
      return;
    }
    
    setFazendoLogin(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/uber/confirmar-sms`, { codigo: codigoSMS }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      });
      
      if (response.data.sucesso) {
        toast.success('Login completo!');
        setPrecisaSMS(false);
        setCodigoSMS('');
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Código inválido');
      }
    } catch (error) {
      toast.error('Erro ao confirmar SMS');
    } finally {
      setFazendoLogin(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-7 h-7 text-blue-500" />
            Sincronização Uber Fleet
          </h1>
          <p className="text-gray-500 mt-1">
            Configure as suas credenciais para extração automática de rendimentos
          </p>
        </div>

        {/* Estado da Sessão */}
        <Card className={sessao?.ativa ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className={`w-6 h-6 ${sessao?.ativa ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <p className="font-medium">Estado da Sessão</p>
                  <p className={`text-sm ${sessao?.ativa ? 'text-green-600' : 'text-red-600'}`}>
                    {sessao?.ativa 
                      ? `Ativa - expira em ${sessao.dias_restantes} dias` 
                      : 'Sessão expirada - faça login'}
                  </p>
                </div>
              </div>
              {sessao?.ativa ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-500" />
              Credenciais Uber Fleet
            </CardTitle>
            <CardDescription>
              Introduza os dados de acesso ao portal Uber Fleet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Email Uber</label>
              <Input
                type="email"
                placeholder="seu.email@exemplo.com"
                value={credenciais.email}
                onChange={(e) => setCredenciais({ ...credenciais, email: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={credenciais.password}
                onChange={(e) => setCredenciais({ ...credenciais, password: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Telefone (para SMS)</label>
              <Input
                type="tel"
                placeholder="910000000"
                value={credenciais.telefone}
                onChange={(e) => setCredenciais({ ...credenciais, telefone: e.target.value })}
              />
            </div>
            
            <Button onClick={guardarCredenciais} variant="outline" className="w-full">
              Guardar Credenciais
            </Button>
          </CardContent>
        </Card>

        {/* Login */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              Autenticação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!precisaSMS ? (
              <Button 
                onClick={fazerLogin} 
                disabled={fazendoLogin || !credenciais.email || !credenciais.password}
                className="w-full"
              >
                {fazendoLogin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    A fazer login...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Fazer Login na Uber
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700 mb-2">
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">Código SMS Enviado</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    Introduza o código de 4 dígitos
                  </p>
                </div>
                
                <Input
                  type="text"
                  placeholder="0000"
                  maxLength={4}
                  value={codigoSMS}
                  onChange={(e) => setCodigoSMS(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                />
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setPrecisaSMS(false); setCodigoSMS(''); }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={confirmarSMS}
                    disabled={fazendoLogin || codigoSMS.length < 4}
                    className="flex-1"
                  >
                    {fazendoLogin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
            
            {sessao?.ativa && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Sessão Ativa!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  O administrador pode agora extrair os seus rendimentos automaticamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        {historico.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Últimas Importações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historico.map((imp, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(imp.created_at).toLocaleDateString('pt-PT')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {imp.total_motoristas}
                      </span>
                      <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        €{imp.total_rendimentos?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instruções */}
        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Como funciona?</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Introduza as suas credenciais Uber Fleet</li>
                  <li>Clique em "Fazer Login na Uber"</li>
                  <li>Se receber SMS, introduza o código</li>
                  <li>A sessão fica ativa por ~30 dias</li>
                  <li>O administrador extrai os rendimentos automaticamente</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoUberParceiro;
