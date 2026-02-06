import React, { useState, useEffect, useRef } from 'react';
import { 
  LogIn, CheckCircle, XCircle, Clock, RefreshCw, 
  Save, Eye, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import Layout from '../components/Layout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATAFORMAS = [
  { id: 'uber', nome: 'Uber Fleet', icone: '🚗', cor: 'bg-black' },
  { id: 'bolt', nome: 'Bolt Fleet', icone: '⚡', cor: 'bg-green-600' },
  { id: 'viaverde', nome: 'Via Verde', icone: '🛣️', cor: 'bg-emerald-600' },
  { id: 'prio', nome: 'Prio', icone: '⛽', cor: 'bg-red-600' }
];

export default function LoginPlataformas({ user, onLogout }) {
  const [sessoes, setSessoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginAtivo, setLoginAtivo] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [urlAtual, setUrlAtual] = useState('');
  const [status, setStatus] = useState('');
  const [podeGuardar, setPodeGuardar] = useState(false);
  const [credenciais, setCredenciais] = useState({ email: '', password: '' });
  
  const wsRef = useRef(null);
  const canvasRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    carregarSessoes();
  }, []);

  const carregarSessoes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/parceiro/sessoes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSessoes(data.sessoes || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const iniciarLogin = async (plataforma) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/parceiro/iniciar-login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plataforma })
      });
      
      const data = await res.json();
      
      if (data.session_id) {
        setSessionId(data.session_id);
        setLoginAtivo(plataforma);
        setStatus('aguardando_login');
        setPodeGuardar(false);
        
        // Conectar WebSocket
        conectarWebSocket(data.session_id);
        
        toast.success(`A iniciar login ${plataforma}...`);
      }
    } catch (error) {
      toast.error('Erro ao iniciar login');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const conectarWebSocket = (sid) => {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/rpa-designer/ws/parceiro-login/${sid}`);
    
    ws.onopen = () => {
      console.log('WebSocket conectado');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.tipo === 'screenshot') {
        setScreenshot(`data:image/jpeg;base64,${data.data}`);
        if (data.url) setUrlAtual(data.url);
        if (data.status) setStatus(data.status);
        if (data.pode_guardar !== undefined) setPodeGuardar(data.pode_guardar);
      } else if (data.tipo === 'sessao_guardada') {
        toast.success(data.mensagem);
        setLoginAtivo(null);
        setSessionId(null);
        setScreenshot(null);
        carregarSessoes();
      } else if (data.erro) {
        toast.error(data.erro);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket desconectado');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      toast.error('Erro na conexão');
    };
    
    wsRef.current = ws;
  };

  const enviarAcao = (tipo, dados = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo, ...dados }));
    }
  };

  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    enviarAcao('click', { x, y });
  };

  const guardarSessao = () => {
    enviarAcao('guardar_sessao');
  };

  const cancelarLogin = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setLoginAtivo(null);
    setSessionId(null);
    setScreenshot(null);
    setStatus('');
    setPodeGuardar(false);
  };

  const getSessaoPlataforma = (platId) => {
    return sessoes.find(s => s.plataforma === platId);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LogIn className="w-6 h-6" />
              Login nas Plataformas
            </h1>
            <p className="text-gray-400 mt-1">
              Faça login manual para evitar CAPTCHA nas sincronizações automáticas
            </p>
          </div>

          {!loginAtivo ? (
            <>
              {/* Info */}
              <Card className="bg-yellow-900/30 border-yellow-600 mb-6">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-semibold mb-1">Como funciona:</p>
                      <ol className="list-decimal list-inside space-y-1 text-yellow-300">
                        <li>Clique numa plataforma para iniciar o login</li>
                        <li>Faça login normalmente (resolva o CAPTCHA se aparecer)</li>
                        <li>Quando entrar na conta, clique em "Guardar Sessão"</li>
                        <li>A sessão fica guardada por ~7 dias</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Plataformas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATAFORMAS.map(plat => {
                  const sessao = getSessaoPlataforma(plat.id);
                  return (
                    <Card key={plat.id} className="bg-gray-800 border-gray-700">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 ${plat.cor} rounded-lg flex items-center justify-center text-2xl`}>
                              {plat.icone}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{plat.nome}</h3>
                              {sessao ? (
                                <div className="flex items-center gap-2 mt-1">
                                  {sessao.valida ? (
                                    <>
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                      <span className="text-sm text-green-400">
                                        Sessão válida ({sessao.idade_dias}d)
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 text-red-400" />
                                      <span className="text-sm text-red-400">
                                        Sessão expirada
                                      </span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">Sem sessão guardada</span>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            onClick={() => iniciarLogin(plat.id)}
                            disabled={loading}
                            className={sessao?.valida ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}
                          >
                            {sessao?.valida ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Renovar
                              </>
                            ) : (
                              <>
                                <LogIn className="w-4 h-4 mr-2" />
                                Login
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            /* Interface de Login */
            <div className="grid grid-cols-12 gap-4">
              {/* Preview */}
              <div className="col-span-9">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        {PLATAFORMAS.find(p => p.id === loginAtivo)?.nome} - Login Manual
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {status === 'login_concluido' ? (
                          <span className="text-green-400 text-sm flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Login OK!
                          </span>
                        ) : (
                          <span className="text-yellow-400 text-sm flex items-center gap-1">
                            <Clock className="w-4 h-4" /> A aguardar login...
                          </span>
                        )}
                      </div>
                    </div>
                    {urlAtual && (
                      <p className="text-xs text-blue-400 truncate mt-1">{urlAtual}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div
                      ref={canvasRef}
                      className="relative bg-gray-900 rounded-lg overflow-hidden cursor-crosshair"
                      style={{ aspectRatio: '16/9' }}
                      onClick={handleCanvasClick}
                    >
                      {screenshot ? (
                        <img 
                          src={screenshot} 
                          alt="Login" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                            <p>A carregar...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Controlos */}
              <div className="col-span-3 space-y-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Credenciais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400">Email</label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          value={credenciais.email}
                          onChange={(e) => setCredenciais(prev => ({...prev, email: e.target.value}))}
                          placeholder="Email..."
                          className="bg-gray-700 border-gray-600 text-sm"
                        />
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (credenciais.email) {
                              enviarAcao('inserir_texto', { texto: credenciais.email });
                            }
                          }}
                        >
                          Inserir
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-400">Senha</label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="password"
                          value={credenciais.password}
                          onChange={(e) => setCredenciais(prev => ({...prev, password: e.target.value}))}
                          placeholder="Senha..."
                          className="bg-gray-700 border-gray-600 text-sm"
                        />
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (credenciais.password) {
                              enviarAcao('inserir_texto', { texto: credenciais.password });
                            }
                          }}
                        >
                          Inserir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Ações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('tecla', { tecla: 'Enter' })}>
                        Enter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('tecla', { tecla: 'Tab' })}>
                        Tab
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('scroll', { direcao: 'down' })}>
                        ↓ Scroll
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('scroll', { direcao: 'up' })}>
                        ↑ Scroll
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4 space-y-2">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={guardarSessao}
                      disabled={!podeGuardar}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {podeGuardar ? 'Guardar Sessão' : 'Faça login primeiro'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={cancelarLogin}
                    >
                      Cancelar
                    </Button>
                  </CardContent>
                </Card>

                {podeGuardar && (
                  <div className="text-sm text-green-400 bg-green-900/30 p-3 rounded">
                    ✓ Login detetado! Clique em "Guardar Sessão" para usar nas sincronizações automáticas.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
