import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Play,
  Square,
  Circle,
  Save,
  Trash2,
  Monitor,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Loader2,
  Eye,
  EyeOff,
  X,
  Settings,
  RotateCcw,
  CheckCircle,
  XCircle,
  Key,
  User,
  Lock
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BrowserVirtualEmbutido = ({ 
  plataformaId, 
  plataformaNome,
  urlInicial,
  onPassosGravados,
  onClose 
}) => {
  const [sessionId, setSessionId] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [urlAtual, setUrlAtual] = useState('');
  const [loading, setLoading] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [passosGravados, setPassosGravados] = useState([]);
  const [textoInput, setTextoInput] = useState('');
  const [conectado, setConectado] = useState(false);
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false);
  
  // Selector de credenciais do parceiro
  const [parceiros, setParceiros] = useState([]);
  const [parceiroSelecionado, setParceiroSelecionado] = useState(null);
  const [loadingParceiros, setLoadingParceiros] = useState(true);
  // Flag para controlar se o utilizador já iniciou manualmente o browser
  const [hasManuallyStarted, setHasManuallyStarted] = useState(false);
  // Credenciais disponíveis na sessão
  const [temCredenciais, setTemCredenciais] = useState(false);
  const [parceiroNomeSessao, setParceiroNomeSessao] = useState(null);
  const [camposCredenciais, setCamposCredenciais] = useState([]);
  
  const wsRef = useRef(null);
  const imgRef = useRef(null);
  const token = localStorage.getItem('token');

  // Carregar parceiros com credenciais para esta plataforma
  useEffect(() => {
    const carregarParceiros = async () => {
      try {
        const response = await axios.get(
          `${API}/plataformas/${plataformaId}/parceiros-com-credenciais`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const lista = response.data || [];
        setParceiros(lista);
      } catch (error) {
        console.error('Erro ao carregar parceiros:', error);
        // Em caso de erro, definir lista vazia
        setParceiros([]);
      } finally {
        setLoadingParceiros(false);
      }
    };
    
    if (plataformaId && token) {
      carregarParceiros();
    }
  }, [plataformaId, token]);

  // Iniciar sessão
  const iniciarSessao = async () => {
    if (sessionId) {
      toast.info('Sessão já activa');
      return;
    }
    
    // Marcar que foi iniciado manualmente
    setHasManuallyStarted(true);
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/admin/browser-virtual/sessao/iniciar`,
        {
          plataforma_id: plataformaId,
          url_inicial: urlInicial,
          parceiro_id: parceiroSelecionado || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.sucesso) {
        setSessionId(response.data.session_id);
        setScreenshot(response.data.screenshot);
        setUrlAtual(response.data.url);
        
        // Verificar se há rascunho recuperado
        if (response.data.rascunho_carregado && response.data.passos_recuperados > 0) {
          setRascunhoRecuperado(true);
          toast.info(`Recuperados ${response.data.passos_recuperados} passos do rascunho anterior`, {
            duration: 5000,
            action: {
              label: 'Limpar',
              onClick: () => limparPassos()
            }
          });
          // Carregar passos do rascunho
          const passosResponse = await axios.get(
            `${API}/admin/browser-virtual/sessao/${response.data.session_id}/passos`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (passosResponse.data.passos) {
            setPassosGravados(passosResponse.data.passos);
          }
        } else {
          const parceiroNome = parceiroSelecionado ? parceiros.find(p => p.id === parceiroSelecionado)?.nome : null;
          toast.success(`Browser iniciado${parceiroNome ? ` (credenciais: ${parceiroNome})` : ''}`);
        }
        
        // Verificar se há credenciais na sessão
        if (response.data.tem_credenciais) {
          try {
            const credResp = await axios.get(
              `${API}/admin/browser-virtual/sessao/${response.data.session_id}/tem-credenciais`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setTemCredenciais(credResp.data.tem_credenciais);
            setParceiroNomeSessao(credResp.data.parceiro_nome);
            setCamposCredenciais(credResp.data.campos_disponiveis || []);
          } catch (e) {
            console.error('Erro ao verificar credenciais:', e);
          }
        }
        
        // Conectar WebSocket
        conectarWebSocket(response.data.session_id);
      }
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      toast.error('Erro ao iniciar browser virtual');
    } finally {
      setLoading(false);
    }
  };

  // Inserir credencial do parceiro (email ou password)
  const inserirCredencial = async (campo) => {
    if (!sessionId) {
      toast.error('Sessão não iniciada');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/admin/browser-virtual/sessao/${sessionId}/inserir-credencial?campo=${campo}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.sucesso) {
        toast.success(`${campo === 'email' ? 'Email' : 'Password'} inserido`);
        if (response.data.screenshot) {
          setScreenshot(response.data.screenshot);
        }
        if (response.data.url) {
          setUrlAtual(response.data.url);
        }
        if (response.data.passo_gravado) {
          setPassosGravados(prev => [...prev, response.data.passo_gravado]);
        }
      }
    } catch (error) {
      console.error('Erro ao inserir credencial:', error);
      toast.error(error.response?.data?.detail || 'Erro ao inserir credencial');
    }
  };

  // Conectar WebSocket
  const conectarWebSocket = (sid) => {
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/admin/browser-virtual/ws/${sid}`);
    
    ws.onopen = () => {
      console.log('WebSocket conectado');
      setConectado(true);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.tipo === 'screenshot') {
        setScreenshot(data.data);
        if (data.url) setUrlAtual(data.url);
      } else if (data.tipo === 'passo_gravado') {
        setPassosGravados(prev => [...prev, data.passo]);
      } else if (data.tipo === 'gravacao') {
        setGravando(data.gravando);
      } else if (data.tipo === 'passos_limpos') {
        setPassosGravados([]);
      } else if (data.erro) {
        toast.error(data.erro);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setConectado(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      setConectado(false);
    };
    
    wsRef.current = ws;
  };

  // Enviar acção via WebSocket ou REST API
  const enviarAcao = useCallback(async (tipo, dados = {}) => {
    // Tentar WebSocket primeiro
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo, ...dados }));
    } else {
      // Fallback para REST API
      if (!sessionId) {
        toast.error('Sessão não iniciada');
        return;
      }
      try {
        const response = await axios.post(
          `${API}/admin/browser-virtual/sessao/${sessionId}/acao`,
          { tipo, ...dados },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.sucesso) {
          if (response.data.screenshot) {
            setScreenshot(response.data.screenshot);
          }
          if (response.data.url) {
            setUrlAtual(response.data.url);
          }
          if (response.data.passo_gravado) {
            setPassosGravados(prev => [...prev, response.data.passo_gravado]);
          }
        } else if (response.data.erro) {
          toast.error(response.data.erro);
        }
      } catch (error) {
        console.error('Erro ao enviar acção:', error);
        toast.error('Erro ao executar acção');
      }
    }
  }, [sessionId, token]);

  // Handler de clique no screenshot - funciona mesmo sem WebSocket
  const handleImageClick = async (e) => {
    if (!imgRef.current || !sessionId) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    enviarAcao('click', { x, y });
  };

  // Terminar sessão
  const terminarSessao = async () => {
    if (!sessionId) return;
    
    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      await axios.delete(
        `${API}/admin/browser-virtual/sessao/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSessionId(null);
      setScreenshot(null);
      setConectado(false);
      toast.info('Sessão terminada');
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
    }
  };

  // Toggle gravação - via REST API (WebSocket pode estar bloqueado)
  const toggleGravacao = async () => {
    if (!sessionId) {
      toast.error('Sessão não iniciada');
      return;
    }
    
    const novoEstado = !gravando;
    
    try {
      const response = await axios.post(
        `${API}/admin/browser-virtual/sessao/${sessionId}/gravar?ativar=${novoEstado}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.sucesso) {
        setGravando(novoEstado);
        toast.success(novoEstado ? 'Gravação iniciada!' : 'Gravação parada');
      }
    } catch (error) {
      console.error('Erro ao toggle gravação:', error);
      toast.error('Erro ao alterar estado de gravação');
    }
  };

  // Guardar passos na plataforma
  const guardarPassos = async (tipo = 'extracao') => {
    if (!sessionId || passosGravados.length === 0) {
      toast.error('Sem passos para guardar');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/admin/browser-virtual/sessao/${sessionId}/passos/guardar?tipo=${tipo}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.sucesso) {
        toast.success(`${response.data.passos_guardados} passos de ${tipo} guardados!`);
        setRascunhoRecuperado(false); // Limpar flag de rascunho
        if (onPassosGravados) {
          onPassosGravados(passosGravados, tipo);
        }
      }
    } catch (error) {
      console.error('Erro ao guardar passos:', error);
      toast.error('Erro ao guardar passos');
    }
  };

  // Executar replay dos passos
  const [replayEmProgresso, setReplayEmProgresso] = useState(false);
  const [resultadoReplay, setResultadoReplay] = useState(null);

  const executarReplay = async () => {
    if (!sessionId || passosGravados.length === 0) {
      toast.error('Sem passos para executar');
      return;
    }
    
    setReplayEmProgresso(true);
    setResultadoReplay(null);
    toast.info('A executar replay dos passos...');
    
    try {
      const response = await axios.post(
        `${API}/admin/browser-virtual/sessao/${sessionId}/replay`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setResultadoReplay(response.data);
      
      if (response.data.sucesso) {
        toast.success(`Replay concluído! ${response.data.passos_sucesso}/${response.data.total_passos} passos OK`);
        // Actualizar screenshot
        if (response.data.screenshot_final) {
          setScreenshot(response.data.screenshot_final);
        }
        if (response.data.url_final) {
          setUrlAtual(response.data.url_final);
        }
      } else {
        toast.error(`Replay com erros: ${response.data.passos_erro} passos falharam`);
      }
    } catch (error) {
      console.error('Erro no replay:', error);
      toast.error('Erro ao executar replay');
    } finally {
      setReplayEmProgresso(false);
    }
  };

  // Limpar passos
  const limparPassos = () => {
    enviarAcao('limpar_passos');
    setPassosGravados([]);
    setResultadoReplay(null);
  };

  // Enviar texto
  const enviarTexto = () => {
    if (!textoInput.trim()) return;
    enviarAcao('inserir_texto', { texto: textoInput });
    setTextoInput('');
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (sessionId) {
        axios.delete(
          `${API}/admin/browser-virtual/sessao/${sessionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(console.error);
      }
    };
  }, [sessionId, token]);

  // Iniciar sessão automaticamente APENAS se:
  // 1. Não há parceiros disponíveis para seleccionar
  // 2. Não há rascunho guardado (o que implica que é uma sessão nova)
  // 3. O utilizador ainda não iniciou manualmente
  useEffect(() => {
    const autoStart = async () => {
      // Verificar se há rascunho guardado antes de auto-iniciar
      let temRascunho = false;
      try {
        const response = await axios.get(
          `${API}/admin/browser-virtual/rascunho/${plataformaId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        temRascunho = response.data?.tem_rascunho || false;
      } catch (e) {
        // Ignorar erro na verificação de rascunho
      }
      
      // Só auto-iniciar se:
      // - Não há sessão activa
      // - Não há parceiros (ou seja, nada para seleccionar)
      // - Não há rascunho (para dar oportunidade de escolher parceiro antes de continuar)
      // - O utilizador não iniciou manualmente
      if (!sessionId && parceiros.length === 0 && !temRascunho && !hasManuallyStarted) {
        await iniciarSessao();
      }
    };
    
    // Aguardar o carregamento dos parceiros antes de decidir
    if (!loadingParceiros && plataformaId && token) {
      autoStart();
    }
  }, [plataformaId, token, loadingParceiros, parceiros.length, hasManuallyStarted]); // eslint-disable-line

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden" data-testid="browser-virtual-container">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        {/* Info lado esquerdo */}
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium text-sm">{plataformaNome}</span>
          {conectado ? (
            <Badge variant="default" className="bg-green-600 text-xs">Conectado</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Desconectado</Badge>
          )}
        </div>
        
        {/* Controlos centro - Gravação e Credenciais */}
        <div className="flex items-center gap-2">
          {/* Botão Gravação */}
          {sessionId && (
            <Button 
              size="sm"
              variant={gravando ? "destructive" : "outline"}
              onClick={toggleGravacao}
              className={`h-7 px-3 text-xs ${gravando ? '' : 'border-red-600 text-red-400 hover:bg-red-900/30'}`}
              data-testid="toggle-gravacao-btn"
            >
              {gravando ? (
                <>
                  <Square className="w-3 h-3 mr-1" /> Parar
                </>
              ) : (
                <>
                  <Circle className="w-3 h-3 mr-1" /> Gravar
                </>
              )}
            </Button>
          )}
          
          {/* Badge A Gravar */}
          {gravando && (
            <Badge variant="destructive" className="animate-pulse text-xs">
              <Circle className="w-2 h-2 mr-1 fill-current" /> REC
            </Badge>
          )}
          
          {/* Credenciais do Parceiro */}
          {temCredenciais && sessionId && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-900/40 border border-green-700 rounded">
              <Key className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-300">{parceiroNomeSessao}:</span>
              {camposCredenciais.includes('email') && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => inserirCredencial('email')}
                  className="h-6 px-2 text-xs text-green-300 border-green-600 hover:bg-green-800 bg-green-900/50"
                  data-testid="inserir-email-btn"
                >
                  <User className="w-3 h-3 mr-1" /> Email
                </Button>
              )}
              {camposCredenciais.includes('password') && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => inserirCredencial('password')}
                  className="h-6 px-2 text-xs text-green-300 border-green-600 hover:bg-green-800 bg-green-900/50"
                  data-testid="inserir-password-btn"
                >
                  <Lock className="w-3 h-3 mr-1" /> Pass
                </Button>
              )}
            </div>
          )}
          
          {/* Guardar como Login/Extração - só aparece quando há passos */}
          {sessionId && passosGravados.length > 0 && (
            <div className="flex items-center gap-1">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => guardarPassos('login')}
                className="h-6 px-2 text-xs text-blue-300 border-blue-600 hover:bg-blue-800 bg-blue-900/50"
              >
                <Save className="w-3 h-3 mr-1" /> Login
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => guardarPassos('extracao')}
                className="h-6 px-2 text-xs text-purple-300 border-purple-600 hover:bg-purple-800 bg-purple-900/50"
              >
                <Save className="w-3 h-3 mr-1" /> Extração
              </Button>
            </div>
          )}
        </div>
        
        {/* Controlos lado direito - Terminar e Fechar */}
        <div className="flex items-center gap-2">
          {sessionId && (
            <Button 
              size="sm"
              variant="destructive"
              onClick={terminarSessao}
              className="h-7 px-3 text-xs"
            >
              <Square className="w-3 h-3 mr-1" /> Terminar
            </Button>
          )}
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
              <X className="w-4 h-4 text-slate-400" />
            </Button>
          )}
        </div>
      </div>

      {/* URL Bar */}
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-300 truncate">
            {urlAtual || 'Nenhuma URL'}
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => enviarAcao('screenshot')}
            disabled={!conectado}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Browser Preview */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-auto min-h-0">
            {loadingParceiros ? (
              /* Estado de carregamento inicial */
              <div className="text-center space-y-4">
                <Loader2 className="w-16 h-16 mx-auto text-blue-500 animate-spin" />
                <p className="text-slate-400">A verificar parceiros com credenciais...</p>
              </div>
            ) : !sessionId ? (
              <div className="text-center space-y-4" data-testid="browser-not-started">
                <Monitor className="w-24 h-24 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Browser virtual não iniciado</p>
                
                {/* Selector de Parceiro - Mostra se houver parceiros disponíveis */}
                {parceiros.length > 0 && (
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 max-w-sm mx-auto" data-testid="partner-selector">
                    <label className="text-sm text-slate-300 mb-2 block">
                      Testar com credenciais de:
                    </label>
                    <Select 
                      value={parceiroSelecionado || "none"} 
                      onValueChange={(v) => setParceiroSelecionado(v === "none" ? null : v)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="partner-select-trigger">
                        <SelectValue placeholder="Seleccionar parceiro (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem credenciais</SelectItem>
                        {parceiros.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} ({p.email_login || 'email não definido'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parceiroSelecionado && (
                      <p className="text-xs text-green-400 mt-2">
                        As credenciais serão usadas automaticamente no login
                      </p>
                    )}
                  </div>
                )}
                
                <Button onClick={iniciarSessao} disabled={loading} size="lg" data-testid="start-browser-btn">
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Iniciar Browser
                </Button>
              </div>
            ) : screenshot ? (
              <img
                ref={imgRef}
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Browser Preview"
                className="max-w-full max-h-full object-contain cursor-crosshair rounded shadow-lg"
                onClick={handleImageClick}
                data-testid="browser-screenshot"
              />
            ) : (
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                <p className="text-slate-400">A carregar...</p>
              </div>
            )}
          </div>

          {/* Controls */}
          {sessionId && (
            <div className="p-3 bg-slate-800 border-t border-slate-700 space-y-2 shrink-0">
              {/* Texto Input */}
              <div className="flex gap-2">
                <Input
                  value={textoInput}
                  onChange={(e) => setTextoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      enviarTexto();
                    }
                  }}
                  placeholder="Digite texto e pressione Enter..."
                  className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                <Button onClick={enviarTexto} className="text-white">
                  Enviar
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => enviarAcao('tecla', { tecla: 'Enter' })}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  <CornerDownLeft className="w-4 h-4 mr-1" /> Enter
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => enviarAcao('tecla', { tecla: 'Tab' })}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  Tab
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => enviarAcao('scroll', { direcao: 'down' })}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  <ArrowDown className="w-4 h-4 mr-1" /> Scroll
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => enviarAcao('scroll', { direcao: 'up' })}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  <ArrowUp className="w-4 h-4 mr-1" /> Scroll
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => enviarAcao('espera', { segundos: 2 })}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  +Espera
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Passos Gravados */}
        {sessionId && (
          <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium text-sm">
                  Passos Gravados ({passosGravados.length})
                </h3>
                {passosGravados.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={limparPassos}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                )}
              </div>
              {gravando && (
                <p className="text-xs text-amber-400">
                  Clique na página para gravar passos
                </p>
              )}
              {rascunhoRecuperado && passosGravados.length > 0 && (
                <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  <Save className="w-3 h-3 inline mr-1" />
                  Passos recuperados do rascunho anterior
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {passosGravados.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Active a gravação e interaja com a página
                </p>
              ) : (
                passosGravados.map((passo, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-slate-700/50 rounded text-sm"
                  >
                    <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs text-white font-medium">
                      {passo.ordem}
                    </span>
                    <span className="text-slate-300 truncate flex-1">
                      {passo.descricao}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Guardar Passos */}
            {passosGravados.length > 0 && (
              <div className="p-3 border-t border-slate-700 space-y-2">
                <p className="text-xs text-slate-400 text-center">
                  <Save className="w-3 h-3 inline mr-1" />
                  Auto-save activo
                </p>
                
                {/* Resultado do Replay */}
                {resultadoReplay && (
                  <div className={`p-2 rounded text-xs ${resultadoReplay.sucesso ? 'bg-green-900/50 border border-green-700 text-green-300' : 'bg-red-900/50 border border-red-700 text-red-300'}`}>
                    {resultadoReplay.sucesso ? (
                      <><CheckCircle className="w-3 h-3 inline mr-1" /> Replay OK!</>
                    ) : (
                      <><XCircle className="w-3 h-3 inline mr-1" /> {resultadoReplay.passos_erro} erros</>
                    )}
                  </div>
                )}
                
                {/* Botão Replay */}
                <Button 
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={executarReplay}
                  disabled={replayEmProgresso}
                  data-testid="replay-btn"
                >
                  {replayEmProgresso ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A executar...</>
                  ) : (
                    <><RotateCcw className="w-4 h-4 mr-2" /> Testar Replay</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserVirtualEmbutido;
