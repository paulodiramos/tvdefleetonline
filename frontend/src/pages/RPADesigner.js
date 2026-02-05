import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Square, Save, Plus, Trash2, Settings, 
  Monitor, MousePointer, Type, Clock, Download, Eye,
  ChevronRight, RefreshCw, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import Layout from '../components/Layout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIPOS_PASSO = [
  { value: 'goto', label: 'Navegar URL', icon: '🌐' },
  { value: 'click', label: 'Clicar', icon: '🖱️' },
  { value: 'type', label: 'Escrever Texto', icon: '⌨️' },
  { value: 'fill_credential', label: 'Preencher Credencial', icon: '🔐' },
  { value: 'select', label: 'Selecionar Opção', icon: '📋' },
  { value: 'wait', label: 'Esperar', icon: '⏳' },
  { value: 'wait_selector', label: 'Esperar Elemento', icon: '👁️' },
  { value: 'press', label: 'Pressionar Tecla', icon: '⏎' },
  { value: 'scroll', label: 'Scroll', icon: '📜' },
  { value: 'download', label: 'Download', icon: '📥' },
  { value: 'screenshot', label: 'Screenshot', icon: '📸' },
];

const SELETORES_TIPO = [
  { value: 'css', label: 'CSS' },
  { value: 'xpath', label: 'XPath' },
  { value: 'text', label: 'Texto' },
  { value: 'role', label: 'Role (button, link...)' },
];

export default function RPADesigner({ user, onLogout }) {
  const navigate = useNavigate();
  const [plataformas, setPlataformas] = useState([]);
  const [plataformaSelecionada, setPlataformaSelecionada] = useState(null);
  const [semanaSelecionada, setSemanaSelecionada] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [passos, setPassos] = useState([]);
  const [gravando, setGravando] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [urlAtual, setUrlAtual] = useState('');
  const [loading, setLoading] = useState(false);
  const [designs, setDesigns] = useState([]);
  const [showNovoPassoModal, setShowNovoPassoModal] = useState(false);
  const [novoPasso, setNovoPasso] = useState({
    tipo: 'click',
    seletor: '',
    seletor_tipo: 'css',
    valor: '',
    timeout: 2000,
    campo_credencial: ''
  });
  
  const wsRef = useRef(null);
  const canvasRef = useRef(null);

  const token = localStorage.getItem('token');

  // Carregar plataformas
  useEffect(() => {
    carregarPlataformas();
  }, []);

  const carregarPlataformas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/plataformas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPlataformas(data);
    } catch (error) {
      console.error('Erro ao carregar plataformas:', error);
    }
  };

  // Carregar designs quando plataforma muda
  useEffect(() => {
    if (plataformaSelecionada) {
      carregarDesigns();
    }
  }, [plataformaSelecionada]);

  const carregarDesigns = async () => {
    if (!plataformaSelecionada) return;
    
    try {
      const res = await fetch(
        `${API_URL}/api/rpa-designer/designs?plataforma_id=${plataformaSelecionada.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      setDesigns(data);
      
      // Carregar passos do design da semana selecionada
      const designAtual = data.find(d => d.semana_offset === semanaSelecionada);
      if (designAtual) {
        setPassos(designAtual.passos || []);
      } else {
        setPassos([]);
      }
    } catch (error) {
      console.error('Erro ao carregar designs:', error);
    }
  };

  // Iniciar sessão de design
  const iniciarSessao = async () => {
    if (!plataformaSelecionada) {
      toast.error('Selecione uma plataforma primeiro');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/rpa-designer/sessao/iniciar?plataforma_id=${plataformaSelecionada.id}&semana_offset=${semanaSelecionada}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await res.json();
      
      if (data.session_id) {
        setSessionId(data.session_id);
        setGravando(true);
        toast.success('Sessão iniciada! Browser a carregar...');
        
        // Conectar WebSocket
        conectarWebSocket(data.session_id);
      }
    } catch (error) {
      toast.error('Erro ao iniciar sessão');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Conectar WebSocket
  const conectarWebSocket = (sid) => {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/rpa-designer/ws/design/${sid}`);
    
    ws.onopen = () => {
      console.log('WebSocket conectado');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.tipo === 'screenshot') {
        setScreenshot(`data:image/jpeg;base64,${data.data}`);
        if (data.url) setUrlAtual(data.url);
      } else if (data.tipo === 'passo_detectado') {
        // Adicionar passo detectado automaticamente
        const novoPasso = {
          ordem: passos.length + 1,
          ...data.passo,
          descricao: `${data.passo.tipo}: ${data.passo.seletor || ''}`
        };
        setPassos(prev => [...prev, novoPasso]);
      } else if (data.erro) {
        toast.error(data.erro);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setGravando(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      toast.error('Erro na conexão com o browser');
    };
    
    wsRef.current = ws;
  };

  // Enviar ação para o browser
  const enviarAcao = (tipo, dados = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo, ...dados }));
    }
  };

  // Handler de click no canvas
  const handleCanvasClick = (e) => {
    if (!gravando || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    enviarAcao('click', { x, y });
  };

  // Parar sessão
  const pararSessao = async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (sessionId) {
      try {
        await fetch(`${API_URL}/api/rpa-designer/sessao/${sessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Erro ao cancelar sessão:', error);
      }
    }
    
    setSessionId(null);
    setGravando(false);
    setScreenshot(null);
    toast.info('Sessão terminada');
  };

  // Guardar design
  const guardarDesign = async () => {
    if (passos.length === 0) {
      toast.error('Adicione pelo menos um passo antes de guardar');
      return;
    }

    const nome = prompt(
      'Nome do design:',
      `${plataformaSelecionada?.nome} - Semana ${semanaSelecionada === 0 ? 'Atual' : `-${semanaSelecionada}`}`
    );
    
    if (!nome) return;

    setLoading(true);
    try {
      // Se tiver sessão ativa, guardar via sessão
      if (sessionId) {
        const res = await fetch(
          `${API_URL}/api/rpa-designer/sessao/${sessionId}/guardar?nome=${encodeURIComponent(nome)}`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        const data = await res.json();
        
        if (data.sucesso) {
          toast.success('Design guardado com sucesso!');
          pararSessao();
          carregarDesigns();
        } else {
          toast.error(data.detail || 'Erro ao guardar');
        }
      } else {
        // Guardar design diretamente
        const res = await fetch(`${API_URL}/api/rpa-designer/designs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plataforma_id: plataformaSelecionada.id,
            nome: nome,
            semana_offset: semanaSelecionada,
            passos: passos,
            variaveis: ['SEMANA_INICIO', 'SEMANA_FIM']
          })
        });
        
        const data = await res.json();
        
        if (data.sucesso || data.design_id) {
          toast.success('Design guardado com sucesso!');
          carregarDesigns();
        } else {
          toast.error(data.detail || 'Erro ao guardar');
        }
      }
    } catch (error) {
      toast.error('Erro ao guardar design');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar passo manual
  const adicionarPassoManual = () => {
    const passo = {
      ordem: passos.length + 1,
      tipo: novoPasso.tipo,
      seletor: novoPasso.seletor,
      seletor_tipo: novoPasso.seletor_tipo,
      valor: novoPasso.valor,
      timeout: novoPasso.timeout,
      campo_credencial: novoPasso.campo_credencial,
      descricao: `${novoPasso.tipo}: ${novoPasso.seletor || novoPasso.valor || novoPasso.campo_credencial || ''}`
    };
    
    setPassos([...passos, passo]);
    setShowNovoPassoModal(false);
    setNovoPasso({
      tipo: 'click',
      seletor: '',
      seletor_tipo: 'css',
      valor: '',
      timeout: 2000,
      campo_credencial: ''
    });
    toast.success('Passo adicionado');
  };

  // Remover passo
  const removerPasso = (ordem) => {
    setPassos(passos.filter(p => p.ordem !== ordem).map((p, i) => ({ ...p, ordem: i + 1 })));
  };

  // Criar plataforma predefinida
  const criarPlataformasPredefinidas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/seed-plataformas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(`${data.plataformas_criadas} plataformas criadas`);
      carregarPlataformas();
    } catch (error) {
      toast.error('Erro ao criar plataformas');
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">🎨 RPA Designer</h1>
            <p className="text-gray-400">Grave fluxos de automação para extração de dados</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-white border-gray-600 hover:bg-gray-800" onClick={() => navigate('/gestao-plataformas-rpa')}>
              <Settings className="w-4 h-4 mr-2" /> Gerir Plataformas
            </Button>
            {plataformas.length === 0 && (
              <Button onClick={criarPlataformasPredefinidas}>
                <Plus className="w-4 h-4 mr-2" /> Criar Plataformas Base
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Painel Esquerdo - Configuração */}
          <div className="col-span-3 space-y-4">
            {/* Seleção de Plataforma */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300">Plataforma</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full bg-gray-700 border-gray-600 rounded p-2 text-white"
                  value={plataformaSelecionada?.id || ''}
                  onChange={(e) => {
                    const plat = plataformas.find(p => p.id === e.target.value);
                    setPlataformaSelecionada(plat);
                    setPassos([]);
                  }}
                >
                  <option value="">Selecione...</option>
                  {plataformas.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.icone} {p.nome}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Seleção de Semana */}
            {plataformaSelecionada && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Semana do Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(s => {
                      const designExiste = designs.find(d => d.semana_offset === s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setSemanaSelecionada(s);
                            if (designExiste) {
                              setPassos(designExiste.passos || []);
                            } else {
                              setPassos([]);
                            }
                          }}
                          className={`p-2 rounded text-sm flex items-center justify-between ${
                            semanaSelecionada === s
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          }`}
                        >
                          <span>{s === 0 ? 'Atual' : `Semana -${s}`}</span>
                          {designExiste ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-orange-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Controles */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300">Controles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!gravando ? (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={iniciarSessao}
                    disabled={!plataformaSelecionada || loading}
                  >
                    <Play className="w-4 h-4 mr-2" /> Iniciar Gravação
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={pararSessao}
                  >
                    <Square className="w-4 h-4 mr-2" /> Parar
                  </Button>
                )}
                
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowNovoPassoModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Passo
                </Button>
                
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={guardarDesign}
                  disabled={passos.length === 0 || loading}
                >
                  <Save className="w-4 h-4 mr-2" /> Guardar Design
                </Button>
              </CardContent>
            </Card>

            {/* Info */}
            {plataformaSelecionada && (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Designs:</span>
                      <span>{designs.length}/{plataformaSelecionada.max_semanas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">URL Base:</span>
                      <span className="truncate ml-2 text-blue-400">
                        {plataformaSelecionada.url_base}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Painel Central - Browser/Preview */}
          <div className="col-span-6">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-gray-300 flex items-center">
                    <Monitor className="w-4 h-4 mr-2" />
                    {gravando ? 'Browser Interativo' : 'Preview'}
                  </CardTitle>
                  {urlAtual && (
                    <span className="text-xs text-blue-400 truncate max-w-md">
                      {urlAtual}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  ref={canvasRef}
                  className="relative bg-gray-800 rounded-lg overflow-hidden"
                  style={{ aspectRatio: '16/9', minHeight: '400px' }}
                  onClick={handleCanvasClick}
                >
                  {screenshot ? (
                    <img 
                      src={screenshot} 
                      alt="Browser" 
                      className="w-full h-full object-contain cursor-crosshair"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">
                          {plataformaSelecionada 
                            ? 'Clique em "Iniciar Gravação" para começar'
                            : 'Selecione uma plataforma primeiro'
                          }
                        </p>
                        <p className="text-sm mt-2 text-gray-500">
                          O browser irá carregar a página da plataforma
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {gravando && (
                    <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-600 px-2 py-1 rounded text-xs text-white">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      A GRAVAR
                    </div>
                  )}
                </div>

                {/* Controlos do browser */}
                {gravando && (
                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="Digite texto e pressione Enter..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          enviarAcao('type', { texto: e.target.value });
                          e.target.value = '';
                        }
                      }}
                      className="bg-gray-700 border-gray-600"
                    />
                    <Button variant="outline" onClick={() => enviarAcao('press', { tecla: 'Enter' })}>
                      Enter
                    </Button>
                    <Button variant="outline" onClick={() => enviarAcao('scroll', { delta: 300 })}>
                      ↓
                    </Button>
                    <Button variant="outline" onClick={() => enviarAcao('scroll', { delta: -300 })}>
                      ↑
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Painel Direito - Passos */}
          <div className="col-span-3">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300 flex items-center justify-between">
                  <span>📝 Passos Gravados ({passos.length})</span>
                  {passos.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setPassos([])}
                      className="text-red-400 hover:text-red-300"
                    >
                      Limpar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {passos.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Nenhum passo gravado</p>
                      <p className="text-sm mt-2">
                        Inicie a gravação e clique na página para gravar passos
                      </p>
                    </div>
                  ) : (
                    passos.map((passo, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-gray-700 rounded text-sm group"
                      >
                        <span className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs">
                          {passo.ordem}
                        </span>
                        <div className="flex-1 truncate">
                          <span className="mr-2">
                            {TIPOS_PASSO.find(t => t.value === passo.tipo)?.icon || '❓'}
                          </span>
                          <span className="text-gray-300">
                            {passo.descricao || passo.tipo}
                          </span>
                        </div>
                        <button
                          onClick={() => removerPasso(passo.ordem)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal Adicionar Passo */}
        {showNovoPassoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Adicionar Passo Manual</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300">Tipo de Passo</label>
                  <select
                    className="w-full bg-gray-700 border-gray-600 rounded p-2 mt-1"
                    value={novoPasso.tipo}
                    onChange={(e) => setNovoPasso({ ...novoPasso, tipo: e.target.value })}
                  >
                    {TIPOS_PASSO.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {['click', 'type', 'select', 'wait_selector', 'hover'].includes(novoPasso.tipo) && (
                  <>
                    <div>
                      <label className="text-sm text-gray-300">Tipo de Seletor</label>
                      <select
                        className="w-full bg-gray-700 border-gray-600 rounded p-2 mt-1"
                        value={novoPasso.seletor_tipo}
                        onChange={(e) => setNovoPasso({ ...novoPasso, seletor_tipo: e.target.value })}
                      >
                        {SELETORES_TIPO.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-300">Seletor</label>
                      <Input
                        placeholder="Ex: #botao-login, button.submit"
                        value={novoPasso.seletor}
                        onChange={(e) => setNovoPasso({ ...novoPasso, seletor: e.target.value })}
                        className="bg-gray-700 border-gray-600 mt-1"
                      />
                    </div>
                  </>
                )}

                {['type', 'goto', 'screenshot'].includes(novoPasso.tipo) && (
                  <div>
                    <label className="text-sm text-gray-300">
                      {novoPasso.tipo === 'goto' ? 'URL' : novoPasso.tipo === 'type' ? 'Texto' : 'Nome'}
                    </label>
                    <Input
                      placeholder={novoPasso.tipo === 'goto' ? 'https://...' : '...'}
                      value={novoPasso.valor}
                      onChange={(e) => setNovoPasso({ ...novoPasso, valor: e.target.value })}
                      className="bg-gray-700 border-gray-600 mt-1"
                    />
                  </div>
                )}

                {novoPasso.tipo === 'fill_credential' && (
                  <div>
                    <label className="text-sm text-gray-300">Campo de Credencial</label>
                    <select
                      className="w-full bg-gray-700 border-gray-600 rounded p-2 mt-1"
                      value={novoPasso.campo_credencial}
                      onChange={(e) => setNovoPasso({ ...novoPasso, campo_credencial: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      <option value="email">Email</option>
                      <option value="password">Password</option>
                      <option value="telefone">Telefone</option>
                    </select>
                  </div>
                )}

                {['wait', 'wait_selector', 'download'].includes(novoPasso.tipo) && (
                  <div>
                    <label className="text-sm text-gray-300">Timeout (ms)</label>
                    <Input
                      type="number"
                      value={novoPasso.timeout}
                      onChange={(e) => setNovoPasso({ ...novoPasso, timeout: parseInt(e.target.value) })}
                      className="bg-gray-700 border-gray-600 mt-1"
                    />
                  </div>
                )}

                {novoPasso.tipo === 'press' && (
                  <div>
                    <label className="text-sm text-gray-300">Tecla</label>
                    <select
                      className="w-full bg-gray-700 border-gray-600 rounded p-2 mt-1"
                      value={novoPasso.valor}
                      onChange={(e) => setNovoPasso({ ...novoPasso, valor: e.target.value })}
                    >
                      <option value="Enter">Enter</option>
                      <option value="Tab">Tab</option>
                      <option value="Escape">Escape</option>
                      <option value="ArrowDown">Seta Baixo</option>
                      <option value="ArrowUp">Seta Cima</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNovoPassoModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={adicionarPassoManual}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
}
