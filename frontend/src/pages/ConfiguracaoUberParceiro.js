import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, Loader2, Shield, Key, 
  Lock, Clock, FileText, Calendar, Users, DollarSign,
  Monitor, Play, Square, RefreshCw, Keyboard, Download,
  Eye, EyeOff, User, Phone
} from 'lucide-react';

const ConfiguracaoUberParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [credenciais, setCredenciais] = useState({ email: '', password: '', telefone: '' });
  const [sessao, setSessao] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  
  // Estados do browser remoto
  const [browserAtivo, setBrowserAtivo] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [textoInput, setTextoInput] = useState('');
  const [codigoSMS, setCodigoSMS] = useState('');
  const [loginConfirmado, setLoginConfirmado] = useState(false);
  
  // Estado de extração
  const [semanaSelecionada, setSemanaSelecionada] = useState('0');
  const [extraindo, setExtraindo] = useState(false);
  
  const imgRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    carregarDados();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Carregar credenciais (sem password por segurança)
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

  // Carregar password quando utilizador clica no olho
  const toggleMostrarPassword = async () => {
    if (!mostrarPassword && !credenciais.password) {
      // Carregar password do servidor
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/uber/minhas-credenciais?incluir_password=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.password) {
          setCredenciais(prev => ({ ...prev, password: res.data.password }));
        }
      } catch (error) {
        console.error('Erro ao carregar password:', error);
      }
    }
    setMostrarPassword(!mostrarPassword);
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

  // ===== FUNÇÕES DO BROWSER REMOTO =====
  
  const iniciarBrowser = async () => {
    // Guardar credenciais primeiro
    if (credenciais.email && credenciais.password) {
      await guardarCredenciais();
    }
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/iniciar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setBrowserAtivo(true);
        setScreenshot(response.data.screenshot);
        toast.success('Browser iniciado! Complete o login.');
        
        // Atualizar screenshots a cada 2 segundos
        intervalRef.current = setInterval(atualizarScreenshot, 2000);
      } else {
        toast.error(response.data.erro || 'Erro ao iniciar browser');
      }
    } catch (error) {
      toast.error('Erro ao iniciar browser');
    } finally {
      setAtualizando(false);
    }
  };
  
  const atualizarScreenshot = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/screenshot`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        
        // Verificar se está logado
        if (response.data.logado) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          toast.success('Login detectado! Sessão guardada por 30 dias.');
          carregarDados();
        }
      }
    } catch (error) {
      console.error('Erro no screenshot:', error);
    }
  };
  
  const handleImageClick = async (event) => {
    if (!browserAtivo || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/clicar`, { x, y }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        if (response.data.logado) {
          toast.success('Login confirmado!');
          carregarDados();
        }
      }
    } catch (error) {
      toast.error('Erro ao clicar');
    } finally {
      setAtualizando(false);
    }
  };
  
  const enviarTexto = async () => {
    if (!textoInput) return;
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/escrever`, { texto: textoInput }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        setTextoInput('');
      }
    } catch (error) {
      toast.error('Erro ao escrever');
    } finally {
      setAtualizando(false);
    }
  };
  
  const enviarTecla = async (tecla) => {
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/escrever`, { tecla }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
      }
    } catch (error) {
      toast.error('Erro');
    } finally {
      setAtualizando(false);
    }
  };
  
  const preencherEmail = async () => {
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/preencher-email`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        toast.success('Email preenchido!');
      } else {
        toast.error(response.data.erro || 'Erro');
      }
    } catch (error) {
      toast.error('Erro ao preencher email');
    } finally {
      setAtualizando(false);
    }
  };
  
  const preencherPassword = async () => {
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/preencher-password`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        toast.success('Password preenchida!');
      } else {
        toast.error(response.data.erro || 'Erro');
      }
    } catch (error) {
      toast.error('Erro ao preencher password');
    } finally {
      setAtualizando(false);
    }
  };
  
  const enviarCodigoSMS = async () => {
    if (!codigoSMS || codigoSMS.length !== 4) {
      toast.error('Introduza um código de 4 dígitos');
      return;
    }
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      // Usar endpoint específico para preencher SMS nos 4 campos
      const response = await axios.post(`${API}/browser/preencher-sms`, { 
        codigo: codigoSMS 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setScreenshot(response.data.screenshot);
        setCodigoSMS('');
        toast.success(response.data.mensagem || 'Código enviado!');
      } else {
        toast.error(response.data.erro || 'Erro ao enviar código');
      }
    } catch (error) {
      console.error('Erro ao enviar código SMS:', error);
      toast.error('Erro ao enviar código');
    } finally {
      setAtualizando(false);
    }
  };
  
  const verificarLogin = async () => {
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/verificar-login`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.logado) {
        setLoginConfirmado(true);
        toast.success('✅ Login confirmado com sucesso! Sessão ativa.');
        // Esperar 2 segundos para mostrar a confirmação visual
        setTimeout(() => {
          fecharBrowser();
          carregarDados();
        }, 2000);
      } else {
        setLoginConfirmado(false);
        toast.warning('⏳ Login ainda não detectado. Continue o processo de login na página.');
      }
    } catch (error) {
      setLoginConfirmado(false);
      toast.error('Erro ao verificar estado do login');
    } finally {
      setAtualizando(false);
    }
  };
  
  const extrairRendimentos = async () => {
    setExtraindo(true);
    try {
      const token = localStorage.getItem('token');
      toast.info('A extrair rendimentos da Uber... aguarde.');
      
      const response = await axios.post(`${API}/uber/sincronizar`, {
        semana_index: parseInt(semanaSelecionada)
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 180000
      });
      
      if (response.data.sucesso) {
        toast.success(`Extração concluída! ${response.data.total_motoristas} motoristas, €${response.data.total_rendimentos?.toFixed(2)}`);
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Erro na extração');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.response?.data?.erro || 'Erro na extração');
    } finally {
      setExtraindo(false);
    }
  };
  
  const fecharBrowser = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/browser/fechar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Erro:', error);
    }
    
    setBrowserAtivo(false);
    setScreenshot(null);
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
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-7 h-7 text-blue-500" />
            Sincronização Uber Fleet
          </h1>
          <p className="text-gray-500 mt-1">
            Faça login uma vez - sessão dura ~30 dias
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
                      ? `✓ Ativa - expira em ${sessao.dias_restantes} dias` 
                      : '✗ Sessão expirada - faça login manual abaixo'}
                  </p>
                </div>
              </div>
              {sessao?.ativa ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            
            {/* Botão de Extração quando sessão ativa */}
            {sessao?.ativa && (
              <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-sm text-green-700 mb-1 block">Semana a Sincronizar</label>
                    <select
                      value={semanaSelecionada}
                      onChange={(e) => setSemanaSelecionada(e.target.value)}
                      className="w-full p-2 border border-green-300 rounded-lg bg-white"
                    >
                      <option value="0">Semana Atual</option>
                      <option value="1">Semana Passada</option>
                      <option value="2">Há 2 Semanas</option>
                      <option value="3">Há 3 Semanas</option>
                      <option value="4">Há 4 Semanas</option>
                    </select>
                  </div>
                  <Button 
                    onClick={extrairRendimentos}
                    disabled={extraindo}
                    className="bg-green-600 hover:bg-green-700 px-6"
                  >
                    {extraindo ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Sincronizar Uber
                  </Button>
                </div>
                <p className="text-xs text-green-600 text-center">
                  Os dados serão importados automaticamente para o Resumo Semanal
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-500" />
              Credenciais Uber Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Email</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={credenciais.email}
                  onChange={(e) => setCredenciais({ ...credenciais, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Password</label>
                <div className="relative">
                  <Input
                    type={mostrarPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={credenciais.password}
                    onChange={(e) => setCredenciais({ ...credenciais, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={toggleMostrarPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    title={mostrarPassword ? "Esconder password" : "Mostrar password"}
                  >
                    {mostrarPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Telefone</label>
                <Input
                  type="tel"
                  placeholder="910000000"
                  value={credenciais.telefone}
                  onChange={(e) => setCredenciais({ ...credenciais, telefone: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={guardarCredenciais} variant="outline">
              Guardar Credenciais
            </Button>
          </CardContent>
        </Card>

        {/* Login Manual via Browser Remoto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              Login Manual (Browser Remoto)
            </CardTitle>
            <CardDescription>
              Clique na imagem para interagir. Resolva o CAPTCHA e complete o login normalmente.
              A sessão fica guardada por ~30 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!browserAtivo ? (
              <Button 
                onClick={iniciarBrowser} 
                disabled={atualizando}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {atualizando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Iniciar Login Manual
              </Button>
            ) : (
              <div className="space-y-4">
                {/* Área do Screenshot - MAIOR */}
                <div className={`relative rounded-xl overflow-hidden shadow-2xl border-4 ${loginConfirmado ? 'border-green-500 bg-green-900' : 'border-slate-700 bg-slate-900'}`}>
                  {screenshot ? (
                    <>
                      <img
                        ref={imgRef}
                        src={`data:image/jpeg;base64,${screenshot}`}
                        alt="Uber Fleet"
                        className={`w-full cursor-crosshair ${loginConfirmado ? 'opacity-50' : ''}`}
                        onClick={handleImageClick}
                        style={{ minHeight: '450px', maxHeight: '600px', objectFit: 'contain', backgroundColor: '#1a1a2e' }}
                      />
                      
                      {/* Overlay de Login Confirmado */}
                      {loginConfirmado && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-600/80">
                          <div className="text-center text-white">
                            <CheckCircle className="w-24 h-24 mx-auto mb-4 animate-pulse" />
                            <h3 className="text-3xl font-bold mb-2">LOGIN CONFIRMADO!</h3>
                            <p className="text-xl">Sessão ativa com sucesso</p>
                            <p className="text-sm mt-2 opacity-75">A fechar browser...</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-96 flex items-center justify-center bg-slate-800">
                      <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-3" />
                        <p className="text-slate-400">A carregar browser...</p>
                      </div>
                    </div>
                  )}
                  
                  {atualizando && !loginConfirmado && (
                    <div className="absolute top-3 right-3 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      A processar...
                    </div>
                  )}
                  
                  {/* Botão refresh flutuante */}
                  {!loginConfirmado && (
                    <Button 
                      onClick={atualizarScreenshot} 
                      variant="secondary" 
                      size="icon"
                      className="absolute top-3 left-3 bg-white/90 hover:bg-white shadow-lg"
                      title="Atualizar imagem"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                {/* PAINEL DE CONTROLOS - esconder quando login confirmado */}
                {!loginConfirmado && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Coluna Esquerda - Navegação/Setas */}
                  <div className="space-y-3">
                    {/* Setas para CAPTCHA - Design Simples */}
                    <div className="p-5 bg-white rounded-xl shadow-lg border-2 border-slate-200">
                      <h4 className="text-slate-800 font-bold mb-4 text-center text-lg">
                        Controlos de Navegação
                      </h4>
                      
                      {/* Layout em Cruz */}
                      <div className="flex flex-col items-center gap-2">
                        {/* Seta CIMA */}
                        <Button 
                          onClick={() => enviarTecla('ArrowUp')} 
                          className="w-20 h-14 text-4xl bg-blue-500 hover:bg-blue-600 text-white font-black shadow-md rounded-xl"
                        >
                          ↑
                        </Button>
                        
                        {/* Linha do meio: ESQUERDA + DIREITA */}
                        <div className="flex gap-3">
                          <Button 
                            onClick={() => enviarTecla('ArrowLeft')} 
                            className="w-20 h-14 text-4xl bg-blue-500 hover:bg-blue-600 text-white font-black shadow-md rounded-xl"
                          >
                            ←
                          </Button>
                          <Button 
                            onClick={() => enviarTecla('ArrowRight')} 
                            className="w-20 h-14 text-4xl bg-blue-500 hover:bg-blue-600 text-white font-black shadow-md rounded-xl"
                          >
                            →
                          </Button>
                        </div>
                        
                        {/* Seta BAIXO */}
                        <Button 
                          onClick={() => enviarTecla('ArrowDown')} 
                          className="w-20 h-14 text-4xl bg-blue-500 hover:bg-blue-600 text-white font-black shadow-md rounded-xl"
                        >
                          ↓
                        </Button>
                      </div>
                      
                      <p className="text-slate-500 text-sm text-center mt-4">
                        Clique nas setas para mover no puzzle
                      </p>
                    </div>
                    
                    {/* Teclas Especiais - Simples */}
                    <div className="p-4 bg-slate-100 rounded-xl border-2 border-slate-200">
                      <h4 className="text-slate-700 font-bold mb-3 text-center">
                        Teclas
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          onClick={() => enviarTecla('Enter')} 
                          className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg"
                        >
                          ENTER
                        </Button>
                        <Button 
                          onClick={() => enviarTecla('Tab')} 
                          className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-4 rounded-xl text-lg"
                        >
                          TAB
                        </Button>
                        <Button 
                          onClick={() => enviarTecla('Escape')} 
                          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg"
                        >
                          ESC
                        </Button>
                        <Button 
                          onClick={() => enviarTecla('Backspace')} 
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-lg"
                        >
                          APAGAR
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Coluna Direita - Login/SMS */}
                  <div className="space-y-3">
                    {/* Preenchimento Automático */}
                    <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Preenchimento Automático
                      </h4>
                      <div className="flex gap-2">
                        <Button 
                          onClick={preencherEmail} 
                          className="flex-1 bg-white text-blue-600 hover:bg-blue-50 font-semibold"
                          size="lg"
                        >
                          📧 Email
                        </Button>
                        <Button 
                          onClick={preencherPassword} 
                          className="flex-1 bg-white text-blue-600 hover:bg-blue-50 font-semibold"
                          size="lg"
                        >
                          🔑 Password
                        </Button>
                      </div>
                    </div>
                    
                    {/* Código SMS */}
                    <div className="p-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl shadow-lg">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Phone className="w-5 h-5" />
                        Código SMS (4 dígitos)
                      </h4>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          placeholder="0000"
                          value={codigoSMS}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setCodigoSMS(val);
                          }}
                          onKeyPress={(e) => e.key === 'Enter' && enviarCodigoSMS()}
                          className="w-28 text-center text-2xl font-mono tracking-[0.5em] bg-white border-0 shadow-inner"
                        />
                        <Button 
                          onClick={enviarCodigoSMS} 
                          className="flex-1 bg-white text-orange-600 hover:bg-orange-50 font-semibold"
                          size="lg"
                          disabled={codigoSMS.length !== 4 || atualizando}
                        >
                          Enviar →
                        </Button>
                      </div>
                    </div>
                    
                    {/* Texto Manual */}
                    <div className="p-4 bg-slate-100 rounded-xl border-2 border-slate-200">
                      <h4 className="text-slate-700 font-semibold mb-3 flex items-center gap-2">
                        <Keyboard className="w-5 h-5" />
                        Escrever Manualmente
                      </h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite aqui..."
                          value={textoInput}
                          onChange={(e) => setTextoInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && enviarTexto()}
                          className="flex-1"
                        />
                        <Button onClick={enviarTexto} className="bg-slate-700 hover:bg-slate-800">
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Ações Principais */}
                <div className="flex gap-3">
                  <Button 
                    onClick={verificarLogin} 
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-6 text-lg shadow-lg"
                    disabled={atualizando}
                  >
                    <CheckCircle className="w-6 h-6 mr-2" />
                    Confirmar Login
                  </Button>
                  <Button 
                    onClick={fecharBrowser} 
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-6 px-8"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Fechar
                  </Button>
                </div>
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
                <h4 className="font-medium mb-2">Como funciona?</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Clique em <strong>"Iniciar Login Manual"</strong></li>
                  <li>Clique no campo de email na imagem e escreva o email</li>
                  <li>Resolva o puzzle CAPTCHA clicando na imagem</li>
                  <li>Complete o login (SMS se necessário)</li>
                  <li>Clique em <strong>"Confirmar Login"</strong></li>
                  <li>A sessão fica ativa por ~30 dias</li>
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
