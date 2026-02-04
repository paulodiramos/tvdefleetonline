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
  Car, Settings, CheckCircle, AlertCircle, RefreshCw, 
  Key, Clock, User, Building, ExternalLink, Loader2,
  Shield, Smartphone, Lock, Download, Calendar, FileText, 
  DollarSign, Users, TrendingUp
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ConfiguracaoUber = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [credenciais, setCredenciais] = useState({ email: '', password: '', telefone: '' });
  const [sessaoStatus, setSessaoStatus] = useState({});
  const [loginStep, setLoginStep] = useState(0); // 0: inicial, 1: aguardando SMS, 2: sucesso
  const [smsCode, setSmsCode] = useState('');
  const [executando, setExecutando] = useState(false);
  const [loginWindow, setLoginWindow] = useState(null);
  
  // Estados para extração de rendimentos
  const [extraindo, setExtraindo] = useState(false);
  const [semanaIndex, setSemanaIndex] = useState("0");
  const [resultadoExtracao, setResultadoExtracao] = useState(null);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    fetchParceiros();
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      
      // Verificar status de sessão para cada parceiro
      for (const parceiro of response.data) {
        checkSessaoUber(parceiro.id);
      }
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const checkSessaoUber = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/rpa/uber/sessao-status/${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessaoStatus(prev => ({ ...prev, [parceiroId]: response.data }));
    } catch (error) {
      setSessaoStatus(prev => ({ ...prev, [parceiroId]: { valida: false, erro: true } }));
    }
  };

  const handleSelectParceiro = async (parceiro) => {
    setSelectedParceiro(parceiro);
    setLoginStep(0);
    setSmsCode('');
    
    // Carregar credenciais existentes
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/rpa/uber/credenciais/${parceiro.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setCredenciais({
          email: response.data.email || '',
          password: response.data.password || '',
          telefone: response.data.telefone || ''
        });
      }
    } catch (error) {
      // Sem credenciais existentes
      setCredenciais({ email: '', password: '', telefone: '' });
    }
  };

  const salvarCredenciais = async () => {
    if (!selectedParceiro) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa/uber/credenciais/${selectedParceiro.id}`, credenciais, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais guardadas!');
    } catch (error) {
      toast.error('Erro ao guardar credenciais');
    }
  };

  const iniciarLoginUber = async () => {
    if (!selectedParceiro || !credenciais.email || !credenciais.password) {
      toast.error('Preencha email e password');
      return;
    }
    
    setExecutando(true);
    setLoginStep(1);
    
    try {
      const token = localStorage.getItem('token');
      
      // Primeiro, guardar credenciais
      await salvarCredenciais();
      
      // Iniciar processo de login
      const response = await axios.post(`${API}/rpa/uber/iniciar-login/${selectedParceiro.id}`, {
        email: credenciais.email,
        password: credenciais.password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Login Uber realizado com sucesso!');
        checkSessaoUber(selectedParceiro.id);
      } else if (response.data.precisa_sms) {
        setLoginStep(1);
        toast.info('Código SMS enviado para ' + credenciais.telefone);
      } else if (response.data.precisa_captcha) {
        toast.warning('CAPTCHA detectado - abrindo janela para login manual');
        // Abrir janela popup para login manual
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
      const response = await axios.post(`${API}/rpa/uber/confirmar-sms/${selectedParceiro.id}`, {
        codigo: smsCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Login concluído com sucesso!');
        checkSessaoUber(selectedParceiro.id);
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
    // Abrir popup para o utilizador fazer login manual
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
    
    // Instruções
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
      const response = await axios.post(`${API}/rpa/uber/capturar-sessao/${selectedParceiro.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setLoginStep(2);
        toast.success('Sessão Uber capturada com sucesso!');
        checkSessaoUber(selectedParceiro.id);
      } else {
        toast.error('Não foi possível capturar a sessão');
      }
    } catch (error) {
      toast.error('Erro ao capturar sessão');
    } finally {
      setExecutando(false);
    }
  };

  const testarSincronizacao = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      toast.info('A testar sincronização Uber...');
      
      const response = await axios.post(`${API}/rpa/uber/testar/${parceiroId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        toast.success(`Teste OK! ${response.data.mensagem || ''}`);
      } else {
        toast.error(response.data.erro || 'Teste falhou');
      }
    } catch (error) {
      toast.error('Erro no teste de sincronização');
    }
  };

  const getSessaoStatusBadge = (parceiroId) => {
    const status = sessaoStatus[parceiroId];
    if (!status) return <Badge variant="outline">A verificar...</Badge>;
    if (status.erro) return <Badge variant="destructive">Erro</Badge>;
    if (status.valida) {
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ativa até {new Date(status.expira).toLocaleDateString()}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Sessão Expirada
      </Badge>
    );
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Car className="w-7 h-7 text-blue-500" />
              Configuração Uber Fleet
            </h1>
            <p className="text-gray-400 mt-1">
              Configure as credenciais Uber para cada parceiro
            </p>
          </div>
          <Button variant="outline" onClick={fetchParceiros}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Parceiros */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Parceiros
              </CardTitle>
              <CardDescription>
                Selecione um parceiro para configurar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {parceiros.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhum parceiro encontrado</p>
              ) : (
                parceiros.map((parceiro) => (
                  <div
                    key={parceiro.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedParceiro?.id === parceiro.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                    }`}
                    onClick={() => handleSelectParceiro(parceiro)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{parceiro.nome || parceiro.name}</h3>
                        <p className="text-sm text-gray-400">{parceiro.email}</p>
                      </div>
                      {getSessaoStatusBadge(parceiro.id)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Configuração do Parceiro Selecionado */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {selectedParceiro ? `Configurar: ${selectedParceiro.nome || selectedParceiro.name}` : 'Selecione um Parceiro'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedParceiro ? (
                <div className="text-center py-12 text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um parceiro na lista ao lado</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Credenciais */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Key className="w-4 h-4 text-yellow-500" />
                      Credenciais Uber Fleet
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-400">Email</label>
                        <Input
                          type="email"
                          placeholder="email@exemplo.com"
                          value={credenciais.email}
                          onChange={(e) => setCredenciais({ ...credenciais, email: e.target.value })}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400">Password</label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={credenciais.password}
                          onChange={(e) => setCredenciais({ ...credenciais, password: e.target.value })}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-gray-400">Telefone (para SMS)</label>
                        <Input
                          type="tel"
                          placeholder="920000000"
                          value={credenciais.telefone}
                          onChange={(e) => setCredenciais({ ...credenciais, telefone: e.target.value })}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                    </div>
                    
                    <Button onClick={salvarCredenciais} variant="outline" className="w-full">
                      Guardar Credenciais
                    </Button>
                  </div>

                  {/* Processo de Login */}
                  <div className="border-t border-slate-700 pt-6 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      Autenticação Uber
                    </h4>

                    {loginStep === 0 && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                          Clique para iniciar o processo de login. Se a Uber pedir CAPTCHA, 
                          abrirá uma janela para login manual.
                        </p>
                        <Button 
                          onClick={iniciarLoginUber} 
                          disabled={executando || !credenciais.email || !credenciais.password}
                          className="w-full bg-blue-600 hover:bg-blue-700"
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
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-500 mb-2">
                            <Smartphone className="w-5 h-5" />
                            <span className="font-medium">Código SMS Enviado</span>
                          </div>
                          <p className="text-sm text-gray-300">
                            Introduza o código de 4 dígitos enviado para {credenciais.telefone}
                          </p>
                        </div>
                        
                        <Input
                          type="text"
                          placeholder="0000"
                          maxLength={4}
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                          className="bg-slate-700 border-slate-600 text-center text-2xl tracking-widest"
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
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            {executando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {loginStep === 2 && (
                      <div className="space-y-3">
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <div className="flex items-center gap-2 text-green-500">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">Login Uber Ativo!</span>
                          </div>
                          <p className="text-sm text-gray-300 mt-1">
                            A sessão está configurada e pronta para sincronização.
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
                            onClick={() => testarSincronizacao(selectedParceiro.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            Testar Sincronização
                          </Button>
                        </div>
                      </div>
                    )}

                    {loginWindow && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-gray-300 mb-3">
                          Complete o login na janela popup. Depois clique aqui:
                        </p>
                        <Button 
                          onClick={confirmarLoginManual}
                          disabled={executando}
                          className="w-full bg-green-600 hover:bg-green-700"
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
                  </div>

                  {/* Status e Ações */}
                  {sessaoStatus[selectedParceiro.id]?.valida && (
                    <div className="border-t border-slate-700 pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => testarSincronizacao(selectedParceiro.id)}
                        className="w-full"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Testar Sincronização Uber
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informações */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Como funciona?</h4>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>As credenciais são guardadas de forma segura</li>
                  <li>O sistema faz login automático e guarda a sessão</li>
                  <li>A sessão dura aproximadamente 30 dias</li>
                  <li>Se a Uber pedir CAPTCHA, use o "Login Manual"</li>
                  <li>Após configurado, a sincronização funciona automaticamente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoUber;
