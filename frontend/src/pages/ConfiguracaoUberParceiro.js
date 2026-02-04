import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, RefreshCw, 
  Key, Clock, ExternalLink, Loader2,
  Shield, Smartphone, Lock, Download, Users, DollarSign, FileText, Calendar
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ConfiguracaoUberParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [credenciais, setCredenciais] = useState({ email: '', password: '', telefone: '' });
  const [sessaoStatus, setSessaoStatus] = useState(null);
  const [loginStep, setLoginStep] = useState(0);
  const [smsCode, setSmsCode] = useState('');
  const [executando, setExecutando] = useState(false);
  const [loginWindow, setLoginWindow] = useState(null);
  
  // Estados para extração
  const [extraindo, setExtraindo] = useState(false);
  const [semanaIndex, setSemanaIndex] = useState("0");
  const [resultadoExtracao, setResultadoExtracao] = useState(null);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Carregar credenciais
      const credRes = await axios.get(`${API}/rpa/uber/minhas-credenciais`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (credRes.data) {
        setCredenciais({
          email: credRes.data.email || '',
          password: '',
          telefone: credRes.data.telefone || ''
        });
      }
      
      // Verificar status da sessão
      const statusRes = await axios.get(`${API}/rpa/uber/minha-sessao-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessaoStatus(statusRes.data);
      
      if (statusRes.data?.valida) {
        setLoginStep(2);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarCredenciais = async () => {
    if (!credenciais.email) {
      toast.error('Preencha o email');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa/uber/minhas-credenciais`, credenciais, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais guardadas!');
    } catch (error) {
      toast.error('Erro ao guardar credenciais');
    }
  };

  const iniciarLoginUber = async () => {
    if (!credenciais.email || !credenciais.password) {
      toast.error('Preencha email e password');
      return;
    }
    
    setExecutando(true);
    setLoginStep(1);
    
    try {
      const token = localStorage.getItem('token');
      
      // Guardar credenciais primeiro
      await salvarCredenciais();
      
      // Iniciar login
      const response = await axios.post(`${API}/rpa/uber/meu-login`, {
        email: credenciais.email,
        password: credenciais.password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Login Uber realizado com sucesso!');
        carregarDados();
      } else if (response.data.precisa_sms) {
        setLoginStep(1);
        toast.info('Código SMS enviado para o seu telefone');
      } else if (response.data.precisa_captcha) {
        toast.warning('CAPTCHA detectado - abrindo janela para login manual');
        abrirLoginManual();
      } else {
        toast.error(response.data.erro || 'Erro no login');
        setLoginStep(0);
      }
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error(error.response?.data?.detail || 'Erro ao iniciar login');
      setLoginStep(0);
    } finally {
      setExecutando(false);
    }
  };

  const confirmarSMS = async () => {
    if (!smsCode || smsCode.length !== 4) {
      toast.error('Introduza o código de 4 dígitos');
      return;
    }
    
    setExecutando(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/rpa/uber/meu-confirmar-sms`, {
        codigo: smsCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Login concluído com sucesso!');
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Código inválido');
      }
    } catch (error) {
      toast.error('Erro ao confirmar SMS');
    } finally {
      setExecutando(false);
    }
  };

  const abrirLoginManual = () => {
    const width = 500;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popup = window.open(
      'https://auth.uber.com/v2/?next_url=https%3A%2F%2Ffleet.uber.com%2F',
      'UberLogin',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
    
    setLoginWindow(popup);
    
    toast.info(
      'Faça login na janela que abriu. Após concluir, clique em "Confirmar Login Manual".',
      { duration: 10000 }
    );
  };

  const confirmarLoginManual = async () => {
    if (loginWindow) {
      loginWindow.close();
      setLoginWindow(null);
    }
    
    setExecutando(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/rpa/uber/meu-capturar-sessao`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Sessão Uber configurada!');
        carregarDados();
      } else {
        toast.info(response.data.mensagem || 'Sessão pode estar ativa - teste a sincronização');
        setLoginStep(2);
      }
    } catch (error) {
      toast.error('Erro ao capturar sessão');
    } finally {
      setExecutando(false);
    }
  };

  const testarSessao = async () => {
    try {
      const token = localStorage.getItem('token');
      toast.info('A verificar sessão Uber...');
      
      const response = await axios.post(`${API}/rpa/uber/meu-testar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        toast.success(response.data.mensagem || 'Sessão Uber ativa!');
        setLoginStep(2);
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Sessão expirada');
        setLoginStep(0);
      }
    } catch (error) {
      toast.error('Erro ao verificar sessão');
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
            Configuração Uber Fleet
          </h1>
          <p className="text-gray-500 mt-1">
            Configure as suas credenciais Uber para sincronização automática
          </p>
        </div>

        {/* Status da Sessão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Estado da Sessão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessaoStatus?.valida ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Sessão Ativa</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Clock className="w-4 h-4" />
                  Expira em {new Date(sessaoStatus.expira).toLocaleDateString('pt-PT')}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Sessão Expirada</span>
                </div>
                <span className="text-sm text-red-600">
                  Configure as credenciais abaixo
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-500" />
              Credenciais Uber Fleet
            </CardTitle>
            <CardDescription>
              As suas credenciais de acesso ao portal Uber Fleet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Email Uber</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
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
                placeholder="920000000"
                value={credenciais.telefone}
                onChange={(e) => setCredenciais({ ...credenciais, telefone: e.target.value })}
              />
            </div>
            
            <Button onClick={salvarCredenciais} variant="outline" className="w-full">
              Guardar Credenciais
            </Button>
          </CardContent>
        </Card>

        {/* Autenticação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              Autenticação Uber
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginStep === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Clique para iniciar o processo de login. Se a Uber pedir CAPTCHA, 
                  abrirá uma janela para login manual.
                </p>
                <Button 
                  onClick={iniciarLoginUber} 
                  disabled={executando || !credenciais.email || !credenciais.password}
                  className="w-full"
                >
                  {executando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Iniciar Login Uber
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={abrirLoginManual}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Login Manual (se houver CAPTCHA)
                </Button>
              </div>
            )}

            {loginStep === 1 && (
              <div className="space-y-3">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700 mb-2">
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">Código SMS Enviado</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    Introduza o código de 4 dígitos enviado para {credenciais.telefone}
                  </p>
                </div>
                
                <Input
                  type="text"
                  placeholder="0000"
                  maxLength={4}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                />
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setLoginStep(0)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={confirmarSMS}
                    disabled={executando || smsCode.length !== 4}
                    className="flex-1"
                  >
                    {executando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}

            {loginStep === 2 && (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Login Uber Configurado!</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    A sua sessão está ativa. O administrador pode agora extrair os seus rendimentos.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setLoginStep(0)}
                    className="flex-1"
                  >
                    Reconfigurar
                  </Button>
                  <Button 
                    onClick={testarSessao}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Testar Sessão
                  </Button>
                </div>
              </div>
            )}

            {loginWindow && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 mb-3">
                  Complete o login na janela popup. Depois clique aqui:
                </p>
                <Button 
                  onClick={confirmarLoginManual}
                  disabled={executando}
                  className="w-full"
                >
                  {executando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirmar Login Manual
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Como funciona?</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Configure as suas credenciais Uber Fleet</li>
                  <li>Faça login (manual se houver CAPTCHA)</li>
                  <li>A sessão dura aproximadamente 30 dias</li>
                  <li>O administrador extrai os rendimentos semanalmente</li>
                  <li>Se a sessão expirar, receberá uma notificação</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoUberParceiro;
