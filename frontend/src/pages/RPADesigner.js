import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, Pause, Square, Save, Plus, Trash2, Settings, 
  Monitor, MousePointer, Type, Clock, Download, Eye,
  ChevronRight, RefreshCw, CheckCircle, XCircle, AlertCircle,
  User, Key, ArrowLeft, List
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import axios from 'axios';

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
  const [searchParams] = useSearchParams();
  const [plataformas, setPlataformas] = useState([]);
  const [plataformaSelecionada, setPlataformaSelecionada] = useState(null);
  const [plataformaNovoSistema, setPlataformaNovoSistema] = useState(null);
  const [semanaSelecionada, setSemanaSelecionada] = useState(0);
  const [tipoDesign, setTipoDesign] = useState('login'); // 'login' ou 'extracao'
  const [sessionId, setSessionId] = useState(null);
  const [passos, setPassos] = useState([]);
  const [gravando, setGravando] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [urlAtual, setUrlAtual] = useState('');
  const [loading, setLoading] = useState(false);
  const [designs, setDesigns] = useState([]);
  const [designsLogin, setDesignsLogin] = useState([]);
  const [designsExtracao, setDesignsExtracao] = useState([]);
  const [showNovoPassoModal, setShowNovoPassoModal] = useState(false);
  const [novoPasso, setNovoPasso] = useState({
    tipo: 'click',
    seletor: '',
    seletor_tipo: 'css',
    valor: '',
    timeout: 2000,
    campo_credencial: ''
  });
  
  // Estado para sessões de parceiros
  const [sessoesParceiros, setSessoesParceiros] = useState([]);
  const [sessaoParceiroSelecionada, setSessaoParceiroSelecionada] = useState(null);
  const [urlInicial, setUrlInicial] = useState('');
  
  // Estado para credenciais de teste (antes de gravar)
  const [credenciaisTeste, setCredenciaisTeste] = useState({
    email: '',
    password: '',
    telefone: '',
    codigo_sms: '',
    texto_livre: '',
    usar_credenciais: false
  });
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [previewWindow, setPreviewWindow] = useState(null);
  
  const wsRef = useRef(null);
  const canvasRef = useRef(null);

  const token = localStorage.getItem('token');

  // Expor funções para o popup chamar
  useEffect(() => {
    window.pararSessaoFromPopup = () => {
      pararSessaoInternal();
    };
    window.guardarDesignFromPopup = (nome) => {
      guardarDesignInternal(nome);
    };
    return () => {
      delete window.pararSessaoFromPopup;
      delete window.guardarDesignFromPopup;
    };
  }, [sessionId, passos, plataformaSelecionada, semanaSelecionada]);

  // Funções internas para parar e guardar
  const pararSessaoInternal = async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (previewWindow && !previewWindow.closed) {
      previewWindow.close();
      setPreviewWindow(null);
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

  const guardarDesignInternal = async (nome) => {
    if (!nome) return;

    setLoading(true);
    try {
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
          pararSessaoInternal();
          carregarDesigns();
        } else {
          toast.error(data.detail || 'Erro ao guardar');
        }
      } else {
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

  // Atalho de teclado Ctrl+Z para anular último passo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (passos.length > 0) {
          setPassos(prev => prev.slice(0, -1).map((p, i) => ({...p, ordem: i + 1})));
          toast.info('Último passo anulado (Ctrl+Z)');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passos]);

  // Carregar plataformas
  useEffect(() => {
    carregarPlataformas();
    carregarSessoesParceiros();
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

  // Carregar sessões de parceiros disponíveis
  const carregarSessoesParceiros = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rpa-designer/sessoes-parceiros`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSessoesParceiros(data.sessoes || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  // Buscar credenciais de um parceiro específico
  const carregarCredenciaisParceiro = async (parceiroId, plataforma) => {
    try {
      // Tentar buscar credenciais Uber primeiro
      if (plataforma === 'uber' || plataforma?.toLowerCase().includes('uber')) {
        const res = await fetch(`${API_URL}/api/rpa-designer/credenciais-parceiro/${parceiroId}?plataforma=uber`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.email || data.password || data.telefone) {
            setCredenciaisTeste(prev => ({
              ...prev,
              email: data.email || prev.email,
              password: data.password || prev.password,
              telefone: data.telefone || prev.telefone
            }));
            toast.success(`Credenciais de ${data.parceiro_nome || 'parceiro'} carregadas`);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  // Carregar designs quando plataforma ou tipo muda
  useEffect(() => {
    if (plataformaSelecionada) {
      carregarDesigns();
    }
  }, [plataformaSelecionada, tipoDesign]);

  const carregarDesigns = async () => {
    if (!plataformaSelecionada) return;
    
    try {
      const res = await fetch(
        `${API_URL}/api/rpa-designer/designs?plataforma_id=${plataformaSelecionada.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      setDesigns(data);
      
      // Separar designs por tipo
      const login = data.filter(d => d.tipo_design === 'login');
      const extracao = data.filter(d => d.tipo_design === 'extracao' || !d.tipo_design);
      setDesignsLogin(login);
      setDesignsExtracao(extracao);
      
      // Carregar passos do design da semana e tipo selecionados
      const designAtual = data.find(d => 
        d.semana_offset === semanaSelecionada && 
        (d.tipo_design || 'extracao') === tipoDesign
      );
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
      // Construir body com parâmetros
      const body = {
        plataforma_id: plataformaSelecionada.id,
        semana_offset: semanaSelecionada,
        tipo_design: tipoDesign  // 'login' ou 'extracao'
      };
      
      // Adicionar sessão do parceiro se selecionada
      if (sessaoParceiroSelecionada) {
        body.parceiro_id = sessaoParceiroSelecionada.parceiro_id;
      }
      
      // Adicionar URL inicial se definida
      if (urlInicial) {
        body.url_inicial = urlInicial;
      }
      
      // Adicionar credenciais de teste se definidas
      if (credenciaisTeste.email || credenciaisTeste.password) {
        body.credenciais_teste = {
          email: credenciaisTeste.email,
          password: credenciaisTeste.password,
          telefone: credenciaisTeste.telefone,
          codigo_sms: credenciaisTeste.codigo_sms,
          texto_livre: credenciaisTeste.texto_livre
        };
      }
      
      const res = await fetch(`${API_URL}/api/rpa-designer/sessao/iniciar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (data.session_id) {
        setSessionId(data.session_id);
        setGravando(true);
        
        if (data.usando_sessao_parceiro) {
          toast.success('Sessão iniciada com cookies do parceiro! Browser a carregar...');
        } else if (credenciaisTeste.email || credenciaisTeste.password) {
          toast.success('Sessão iniciada com credenciais de teste! Browser a carregar...');
        } else {
          toast.success('Sessão iniciada! Browser a carregar...');
        }
        
        // Conectar WebSocket
        conectarWebSocket(data.session_id);
        
        // Abrir janela popup grande para preview
        abrirPreviewPopup(data.session_id);
      }
    } catch (error) {
      toast.error('Erro ao iniciar sessão');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir preview SEM iniciar gravação imediatamente
  // O utilizador pode ver a página, configurar opções, e depois clicar em "Iniciar Gravação" no popup
  const abrirPreviewSemGravar = async () => {
    if (!plataformaSelecionada) {
      toast.error('Selecione uma plataforma primeiro');
      return;
    }

    setLoading(true);
    try {
      // Construir body com parâmetros
      const body = {
        plataforma_id: plataformaSelecionada.id,
        semana_offset: semanaSelecionada,
        tipo_design: tipoDesign  // 'login' ou 'extracao'
      };
      
      // Adicionar sessão do parceiro se selecionada
      if (sessaoParceiroSelecionada) {
        body.parceiro_id = sessaoParceiroSelecionada.parceiro_id;
      }
      
      // Adicionar URL inicial se definida
      if (urlInicial) {
        body.url_inicial = urlInicial;
      }
      
      // Adicionar credenciais de teste se definidas
      if (credenciaisTeste.email || credenciaisTeste.password) {
        body.credenciais_teste = {
          email: credenciaisTeste.email,
          password: credenciaisTeste.password,
          telefone: credenciaisTeste.telefone,
          codigo_sms: credenciaisTeste.codigo_sms,
          texto_livre: credenciaisTeste.texto_livre
        };
      }

      const res = await fetch(`${API_URL}/api/rpa-designer/sessao/iniciar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Erro ao iniciar sessão');
      }
      
      if (data.session_id) {
        setSessionId(data.session_id);
        setGravando(true);
        
        // Conectar WebSocket
        conectarWebSocket(data.session_id);
        
        // Abrir janela popup com opção de iniciar gravação
        abrirPreviewPopupComOpcoes(data.session_id, body.tipo_design);
      }
    } catch (error) {
      toast.error('Erro ao abrir preview');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir preview numa janela popup grande COM opções de gravação
  const abrirPreviewPopupComOpcoes = (sid, tipoDesignAtual) => {
    // Preparar credenciais ANTES de abrir o popup
    const credenciaisParaPopup = {
      email: credenciaisTeste.email || '',
      password: credenciaisTeste.password || '',
      telefone: credenciaisTeste.telefone || '',
      codigo_sms: credenciaisTeste.codigo_sms || '',
      texto_livre: credenciaisTeste.texto_livre || ''
    };
    const credenciaisData = JSON.stringify(credenciaisParaPopup);
    
    console.log('Credenciais a passar para popup:', credenciaisParaPopup);
    
    const largura = Math.min(1400, window.screen.width - 100);
    const altura = Math.min(900, window.screen.height - 100);
    const esquerda = (window.screen.width - largura) / 2;
    const topo = (window.screen.height - altura) / 2;
    
    const popup = window.open(
      '', 
      'RPA_Preview',
      `width=${largura},height=${altura},left=${esquerda},top=${topo},scrollbars=yes,resizable=yes`
    );
    
    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>🎨 RPA Designer - Preview Interativo</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              background: #1a1a2e; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: white;
              height: 100vh;
              display: flex;
              flex-direction: column;
            }
            .header {
              background: #16213e;
              padding: 10px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid #0f3460;
            }
            .header h1 { font-size: 16px; color: #e94560; }
            .url-bar {
              flex: 1;
              margin: 0 20px;
              padding: 8px 15px;
              background: #0f3460;
              border-radius: 6px;
              color: #94a3b8;
              font-size: 13px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .status {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
            }
            .status-dot {
              width: 10px;
              height: 10px;
              background: #ef4444;
              border-radius: 50%;
              animation: pulse 1s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            .main-content {
              flex: 1;
              display: flex;
              overflow: hidden;
            }
            .preview-container {
              flex: 1;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 15px;
              overflow: auto;
              background: #0d1117;
            }
            #preview-img {
              max-width: 100%;
              max-height: 100%;
              border-radius: 8px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.5);
              cursor: crosshair;
            }
            .loading {
              text-align: center;
              color: #94a3b8;
            }
            .loading-spinner {
              width: 50px;
              height: 50px;
              border: 4px solid #0f3460;
              border-top-color: #e94560;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 15px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            
            /* Painel lateral de credenciais */
            .sidebar {
              width: 280px;
              min-width: 280px;
              background: #16213e;
              border-left: 1px solid #0f3460;
              padding: 12px;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
            }
            .sidebar h3 {
              font-size: 13px;
              color: #e94560;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .field-group {
              margin-bottom: 10px;
            }
            .field-group label {
              display: block;
              font-size: 12px;
              color: #94a3b8;
              margin-bottom: 5px;
            }
            .field-row {
              display: flex;
              gap: 6px;
            }
            .field-row input {
              flex: 1;
              padding: 10px 12px;
              background: #0f3460;
              border: 1px solid #1a3a5c;
              border-radius: 6px;
              color: white;
              font-size: 14px;
            }
            .field-row input:focus {
              outline: none;
              border-color: #e94560;
            }
            .field-row button {
              padding: 10px 14px;
              background: #3b82f6;
              border: none;
              border-radius: 6px;
              color: white;
              cursor: pointer;
              font-size: 13px;
              white-space: nowrap;
            }
            .field-row button:hover { background: #2563eb; }
            .field-row button.green { background: #22c55e; }
            .field-row button.green:hover { background: #16a34a; }
            
            /* Secção de ações rápidas */
            .quick-actions {
              margin-top: 15px;
              padding-top: 12px;
              border-top: 1px solid #0f3460;
            }
            .quick-actions h4 {
              font-size: 11px;
              color: #64748b;
              margin-bottom: 8px;
            }
            .action-buttons {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 5px;
            }
            .action-buttons button {
              padding: 10px 8px;
              background: #0f3460;
              border: none;
              border-radius: 6px;
              color: #94a3b8;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            }
            .action-buttons button:hover { 
              background: #1a4a7c; 
              color: white;
            }
            .action-buttons button.scroll-btn {
              background: #7c3aed;
              color: white;
            }
            .action-buttons button.scroll-btn:hover {
              background: #6d28d9;
            }
            
            /* Texto livre na parte inferior */
            .bottom-controls {
              background: #16213e;
              padding: 12px 20px;
              display: flex;
              gap: 10px;
              border-top: 1px solid #0f3460;
            }
            .bottom-controls input {
              flex: 1;
              padding: 12px 15px;
              background: #0f3460;
              border: 1px solid #1a3a5c;
              border-radius: 6px;
              color: white;
              font-size: 14px;
            }
            .bottom-controls input:focus {
              outline: none;
              border-color: #e94560;
            }
            .bottom-controls button {
              padding: 12px 20px;
              background: #e94560;
              border: none;
              border-radius: 6px;
              color: white;
              cursor: pointer;
              font-size: 14px;
            }
            .bottom-controls button:hover { background: #d1344f; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎨 RPA Preview</h1>
            <div class="url-bar" id="url-display">A carregar...</div>
            <div class="status">
              <div class="status-dot" style="background: #f59e0b;"></div>
              <span>PREVIEW</span>
            </div>
          </div>
          
          <div class="main-content">
            <div class="preview-container">
              <div class="loading" id="loading">
                <div class="loading-spinner"></div>
                <p>A iniciar browser...</p>
                <p style="font-size: 12px; margin-top: 10px; color: #64748b;">
                  Clique em "Iniciar Gravação" quando estiver pronto
                </p>
              </div>
              <img id="preview-img" style="display: none;" alt="Preview" />
            </div>
            
            <div class="sidebar">
              <h3>🔧 Dados para Design RPA</h3>
              
              <!-- Tipo de Design -->
              <div style="margin-bottom: 15px; padding: 10px; background: #0f3460; border-radius: 8px;">
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 8px;">📋 Tipo de Design</label>
                <div style="display: flex; gap: 6px;">
                  <button id="btn-tipo-login" onclick="selecionarTipoDesign('login')" style="flex: 1; padding: 10px; background: ${tipoDesignAtual === 'login' ? '#3b82f6' : '#1a3a5c'}; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; font-weight: bold;">
                    🔑 Login
                  </button>
                  <button id="btn-tipo-extracao" onclick="selecionarTipoDesign('extracao')" style="flex: 1; padding: 10px; background: ${tipoDesignAtual === 'extracao' ? '#22c55e' : '#1a3a5c'}; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; font-weight: bold;">
                    📊 Extração
                  </button>
                </div>
                <input type="hidden" id="tipo-design-selecionado" value="${tipoDesignAtual}" />
              </div>
              
              <!-- Botões de Controlo -->
              <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                <button id="btn-gravar" onclick="iniciarGravacao()" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">
                  ▶ Iniciar Gravação
                </button>
                <button onclick="guardarDesign()" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">
                  💾 Guardar
                </button>
              </div>
              
              <div class="field-group">
                <label>📧 Email</label>
                <div class="field-row">
                  <input type="text" id="campo-email" placeholder="Email..." value="${credenciaisParaPopup.email}" />
                  <button onclick="inserirCampo('email')">Inserir</button>
                </div>
              </div>
              
              <div class="field-group">
                <label>🔑 Senha</label>
                <div class="field-row">
                  <input type="password" id="campo-password" placeholder="Senha..." value="${credenciaisParaPopup.password}" />
                  <button onclick="inserirCampo('password')">Inserir</button>
                </div>
              </div>
              
              <div class="field-group">
                <label>📱 Telefone</label>
                <div class="field-row">
                  <input type="text" id="campo-telefone" placeholder="Telefone..." value="${credenciaisParaPopup.telefone}" />
                  <button onclick="inserirCampo('telefone')">Inserir</button>
                </div>
              </div>
              
              <div class="field-group">
                <label>📲 Código SMS</label>
                <div class="field-row">
                  <input type="text" id="campo-sms" placeholder="Código SMS..." value="${credenciaisParaPopup.codigo_sms}" />
                  <button class="green" onclick="inserirCampo('codigo_sms')">Enviar</button>
                </div>
              </div>
              
              <div class="quick-actions">
                <h4>⚡ Ações Rápidas</h4>
                <div class="action-buttons">
                  <button class="scroll-btn" onclick="fazerScroll('down')">↓ Scroll Down</button>
                  <button class="scroll-btn" onclick="fazerScroll('up')">↑ Scroll Up</button>
                  <button onclick="enviarTecla('Enter')">↵ Enter</button>
                  <button onclick="enviarTecla('Tab')">⇥ Tab</button>
                  <button onclick="enviarTecla('Escape')">✕ Esc</button>
                  <button onclick="adicionarEspera()">⏳ Espera</button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bottom-controls">
            <input type="text" id="text-input" placeholder="⌨️ Texto livre - Digite e pressione Enter..." />
            <button onclick="enviarTexto()">Enviar</button>
          </div>
          
          <script>
            const sessionId = '${sid}';
            const credenciais = ${credenciaisData};
            let ws = null;
            let gravando = false;
            
            // Selecionar tipo de design
            function selecionarTipoDesign(tipo) {
              document.getElementById('tipo-design-selecionado').value = tipo;
              const btnLogin = document.getElementById('btn-tipo-login');
              const btnExtracao = document.getElementById('btn-tipo-extracao');
              
              if (tipo === 'login') {
                btnLogin.style.background = '#3b82f6';
                btnExtracao.style.background = '#1a3a5c';
              } else {
                btnLogin.style.background = '#1a3a5c';
                btnExtracao.style.background = '#22c55e';
              }
            }
            
            // Iniciar/Parar gravação
            function iniciarGravacao() {
              const btn = document.getElementById('btn-gravar');
              
              if (!gravando) {
                // Iniciar gravação
                gravando = true;
                btn.innerHTML = '⏹ Parar';
                btn.style.background = '#ef4444';
                
                // Atualizar status
                document.querySelector('.status-dot').style.background = '#ef4444';
                document.querySelector('.status span').textContent = 'A GRAVAR';
                
                // Notificar o backend que está a gravar
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    tipo: 'iniciar_gravacao',
                    tipo_design: document.getElementById('tipo-design-selecionado').value
                  }));
                }
              } else {
                // Parar gravação
                pararSessao();
              }
            }
            
            // Preencher campos com credenciais pré-definidas imediatamente
            (function preencherCredenciais() {
              console.log('Preenchendo credenciais:', credenciais);
              setTimeout(function() {
                if (credenciais.email) {
                  var emailField = document.getElementById('campo-email');
                  if (emailField) emailField.value = credenciais.email;
                }
                if (credenciais.password) {
                  var passField = document.getElementById('campo-password');
                  if (passField) passField.value = credenciais.password;
                }
                if (credenciais.telefone) {
                  var telField = document.getElementById('campo-telefone');
                  if (telField) telField.value = credenciais.telefone;
                }
                if (credenciais.codigo_sms) {
                  var smsField = document.getElementById('campo-sms');
                  if (smsField) smsField.value = credenciais.codigo_sms;
                }
              }, 100);
            })();
            
            function conectar() {
              const wsUrl = '${API_URL}'.replace('https://', 'wss://').replace('http://', 'ws://');
              ws = new WebSocket(wsUrl + '/api/rpa-designer/ws/design/' + sessionId);
              
              ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                if (data.tipo === 'screenshot') {
                  document.getElementById('loading').style.display = 'none';
                  const img = document.getElementById('preview-img');
                  img.style.display = 'block';
                  img.src = 'data:image/jpeg;base64,' + data.data;
                  if (data.url) {
                    document.getElementById('url-display').textContent = data.url;
                  }
                }
              };
              
              ws.onclose = function() {
                document.querySelector('.status-dot').style.background = '#6b7280';
                document.querySelector('.status span').textContent = 'DESCONECTADO';
              };
            }
            
            document.getElementById('preview-img').onclick = function(e) {
              if (!ws || ws.readyState !== WebSocket.OPEN) return;
              const rect = this.getBoundingClientRect();
              const scaleX = 1280 / rect.width;
              const scaleY = 720 / rect.height;
              const x = Math.round((e.clientX - rect.left) * scaleX);
              const y = Math.round((e.clientY - rect.top) * scaleY);
              ws.send(JSON.stringify({ tipo: 'click', x: x, y: y }));
            };
            
            function inserirCampo(campo) {
              const ids = {
                'email': 'campo-email',
                'password': 'campo-password',
                'telefone': 'campo-telefone',
                'codigo_sms': 'campo-sms'
              };
              const input = document.getElementById(ids[campo]);
              
              if (!input) {
                alert('Campo não encontrado: ' + campo);
                return;
              }
              
              if (!input.value) {
                alert('Preencha o campo ' + campo + ' primeiro');
                input.focus();
                return;
              }
              
              if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('WebSocket não está conectado. Aguarde a conexão.');
                return;
              }
              
              // Enviar texto
              ws.send(JSON.stringify({ tipo: 'inserir_texto', texto: input.value }));
              
              // Feedback visual
              input.style.borderColor = '#22c55e';
              setTimeout(function() {
                input.style.borderColor = '#1a3a5c';
              }, 500);
            }
            
            function enviarTexto() {
              const input = document.getElementById('text-input');
              if (input.value && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ tipo: 'inserir_texto', texto: input.value }));
                input.value = '';
              }
            }
            
            function enviarTecla(tecla) {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ tipo: 'tecla', tecla: tecla }));
              }
            }
            
            function fazerScroll(direcao) {
              console.log('Scroll chamado:', direcao);
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ tipo: 'scroll', direcao: direcao }));
                console.log('Scroll enviado');
              } else {
                console.log('WebSocket não conectado');
              }
            }
            
            function adicionarEspera() {
              const segundos = prompt('Segundos de espera:', '3');
              if (segundos && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ tipo: 'espera', segundos: parseInt(segundos) }));
              }
            }
            
            function adicionarDownload() {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ tipo: 'aguardar_download' }));
              }
            }
            
            function pararSessao() {
              if (confirm('Tem a certeza que quer parar a gravação?')) {
                // Tentar comunicar com janela principal
                try {
                  if (window.opener && !window.opener.closed && window.opener.pararSessaoFromPopup) {
                    window.opener.pararSessaoFromPopup();
                  }
                } catch(e) {
                  console.log('Erro ao comunicar com janela principal:', e);
                }
                window.close();
              }
            }
            
            function guardarDesign() {
              const nome = prompt('Nome do design:', '${plataformaSelecionada?.nome || 'Design'} - Semana ${semanaSelecionada === 0 ? 'Atual' : '-' + semanaSelecionada}');
              if (nome) {
                // Tentar comunicar com janela principal
                try {
                  if (window.opener && !window.opener.closed && window.opener.guardarDesignFromPopup) {
                    window.opener.guardarDesignFromPopup(nome);
                    alert('Design guardado com sucesso!');
                  } else {
                    // Fallback: guardar diretamente via API
                    guardarDesignDireto(nome);
                  }
                } catch(e) {
                  console.log('Erro ao comunicar com janela principal:', e);
                  guardarDesignDireto(nome);
                }
              }
            }
            
            async function guardarDesignDireto(nome) {
              try {
                const response = await fetch('${API_URL}/api/rpa-designer/sessao/' + sessionId + '/guardar?nome=' + encodeURIComponent(nome), {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ${token}'
                  }
                });
                const data = await response.json();
                if (data.sucesso) {
                  alert('Design guardado com sucesso!');
                  window.close();
                } else {
                  alert('Erro ao guardar: ' + (data.detail || 'Erro desconhecido'));
                }
              } catch(e) {
                alert('Erro ao guardar design: ' + e.message);
              }
            }
            
            document.getElementById('text-input').onkeydown = function(e) {
              if (e.key === 'Enter') enviarTexto();
            };
            
            // Enter nos campos de credenciais
            ['campo-email', 'campo-password', 'campo-telefone', 'campo-sms'].forEach(function(id) {
              document.getElementById(id).onkeydown = function(e) {
                if (e.key === 'Enter') {
                  const campo = id.replace('campo-', '').replace('sms', 'codigo_sms');
                  inserirCampo(campo);
                }
              };
            });
            
            conectar();
          </script>
        </body>
        </html>
      `);
      
      setPreviewWindow(popup);
      
      // Fechar popup quando a sessão terminar
      popup.onbeforeunload = () => {
        // Não fazer nada aqui, deixar o utilizador fechar
      };
    } else {
      toast.error('Popup bloqueado! Permita popups para esta página.');
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
    await pararSessaoInternal();
  };

  // Guardar design
  const guardarDesign = async () => {
    const nome = prompt(
      'Nome do design:',
      `${plataformaSelecionada?.nome} - Semana ${semanaSelecionada === 0 ? 'Atual' : `-${semanaSelecionada}`}`
    );
    
    if (!nome) return;
    
    await guardarDesignInternal(nome);
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

        <div className="grid grid-cols-12 gap-4">
          {/* Painel Esquerdo - Configuração */}
          <div className="col-span-12 lg:col-span-3 space-y-3">
            {/* Seleção de Plataforma */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-gray-300">Plataforma</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <select
                  className="w-full bg-gray-700 border-gray-600 rounded-md p-2.5 text-white text-sm"
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
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-gray-300">Semana do Design</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(s => {
                      // Verificar se existe design para esta semana E tipo actual
                      const designExiste = designs.find(d => 
                        d.semana_offset === s && 
                        (d.tipo_design || 'extracao') === tipoDesign
                      );
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
                          className={`p-2 rounded-md text-xs flex items-center justify-between gap-1 ${
                            semanaSelecionada === s
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          }`}
                        >
                          <span>{s === 0 ? 'Atual' : `Semana -${s}`}</span>
                          {designExiste ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tipo de Design - Login vs Extração */}
            {plataformaSelecionada && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-gray-300">Tipo de Design</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setTipoDesign('login');
                        // Carregar passos de login se existirem
                        const designLogin = designsLogin.find(d => d.semana_offset === semanaSelecionada);
                        setPassos(designLogin?.passos || []);
                      }}
                      className={`p-3 rounded-md text-xs flex flex-col items-center gap-1.5 border-2 transition-all ${
                        tipoDesign === 'login'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      <Key className="w-5 h-5" />
                      <span className="font-medium">Login</span>
                      <span className="text-gray-400 text-[10px]">
                        {designsLogin.filter(d => d.plataforma_id === plataformaSelecionada?.id).length} gravados
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setTipoDesign('extracao');
                        // Carregar passos de extração se existirem
                        const designExtr = designsExtracao.find(d => d.semana_offset === semanaSelecionada);
                        setPassos(designExtr?.passos || []);
                      }}
                      className={`p-3 rounded-md text-xs flex flex-col items-center gap-1.5 border-2 transition-all ${
                        tipoDesign === 'extracao'
                          ? 'bg-green-600/30 border-green-500 text-green-300'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      <Download className="w-5 h-5" />
                      <span className="font-medium">Extração</span>
                      <span className="text-gray-400 text-[10px]">
                        {designsExtracao.filter(d => d.plataforma_id === plataformaSelecionada?.id).length} gravados
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {tipoDesign === 'login' 
                      ? '📝 Grave os passos para fazer login na plataforma' 
                      : '📊 Grave os passos para extrair dados semanais'
                    }
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Controles */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-gray-300">Controles</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-3">
                {!gravando ? (
                  <>
                    {/* Usar sessão de parceiro */}
                    {plataformaSelecionada && (
                      <div className="p-2.5 bg-gray-700/50 rounded-md space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Usar sessão de parceiro
                        </label>
                        <select
                          className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-sm text-white"
                          value={sessaoParceiroSelecionada?.parceiro_id || ''}
                          onChange={async (e) => {
                            const platNome = plataformaSelecionada?.nome?.toLowerCase() || '';
                            const plataforma = platNome.includes('uber') ? 'uber' : 
                                               platNome.includes('bolt') ? 'bolt' : 
                                               platNome.includes('via') ? 'viaverde' : '';
                            const sessao = sessoesParceiros.find(s => 
                              s.parceiro_id === e.target.value && s.plataforma === plataforma
                            );
                            setSessaoParceiroSelecionada(sessao || null);
                            
                            // Carregar credenciais do parceiro automaticamente
                            if (sessao) {
                              await carregarCredenciaisParceiro(sessao.parceiro_id, plataforma);
                            }
                          }}
                        >
                          <option value="">Não usar (começar do zero)</option>
                          {sessoesParceiros
                            .filter(s => {
                              const platNome = plataformaSelecionada?.nome?.toLowerCase() || '';
                              return (platNome.includes('uber') && s.plataforma === 'uber') ||
                                     (platNome.includes('bolt') && s.plataforma === 'bolt') ||
                                     (platNome.includes('via') && s.plataforma === 'viaverde');
                            })
                            .map(s => (
                              <option key={s.parceiro_id} value={s.parceiro_id}>
                                {s.parceiro_nome} ({s.idade_dias}d)
                              </option>
                            ))
                          }
                        </select>
                        
                        {sessaoParceiroSelecionada && (
                          <p className="text-xs text-green-400">
                            ✓ Vai usar cookies de {sessaoParceiroSelecionada.parceiro_nome} - sem CAPTCHA!
                          </p>
                        )}
                        
                        {!sessaoParceiroSelecionada && sessoesParceiros.length === 0 && (
                          <p className="text-xs text-orange-400">
                            Nenhum parceiro fez login recente. O design começará do zero.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* URL inicial customizada */}
                    {plataformaSelecionada && (
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">URL inicial (opcional)</label>
                        <Input
                          placeholder={plataformaSelecionada?.url_base || 'URL para começar...'}
                          value={urlInicial}
                          onChange={(e) => setUrlInicial(e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Deixe vazio para usar URL base da plataforma
                        </p>
                      </div>
                    )}
                    
                    {/* Credenciais de teste - Campos compactos antes de iniciar */}
                    {plataformaSelecionada && (
                      <div className="p-2.5 bg-gray-700/50 rounded-md border border-gray-600 space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5" /> Credenciais de teste (opcional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Email..."
                            value={credenciaisTeste.email}
                            onChange={(e) => setCredenciaisTeste(prev => ({...prev, email: e.target.value}))}
                            className="bg-gray-700 border-gray-600 text-white text-xs h-8"
                          />
                          <Input
                            type="password"
                            placeholder="Senha..."
                            value={credenciaisTeste.password}
                            onChange={(e) => setCredenciaisTeste(prev => ({...prev, password: e.target.value}))}
                            className="bg-gray-700 border-gray-600 text-white text-xs h-8"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Preencha aqui para usar no popup de gravação
                        </p>
                      </div>
                    )}
                    
                    {/* Botão principal - Abrir Preview */}
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => abrirPreviewSemGravar()}
                      disabled={!plataformaSelecionada || loading}
                    >
                      <Monitor className="w-4 h-4 mr-2" /> Abrir Preview
                    </Button>
                    
                    {/* Info sobre CAPTCHA */}
                    <div className="text-xs text-yellow-400 bg-yellow-900/30 p-2 rounded">
                      ⚠️ <strong>Uber/Bolt</strong>: Têm CAPTCHA. 
                      {sessaoParceiroSelecionada 
                        ? ' Usando sessão do parceiro evita o login!'
                        : ' Selecione uma sessão de parceiro acima para evitar.'
                      }
                    </div>
                    
                    {/* Botão adicionar passo manual */}
                    <Button 
                      variant="outline"
                      className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={() => setMostrarAdicionarPasso(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Passo Manual
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={pararSessao}
                    >
                      <Square className="w-4 h-4 mr-2" /> Parar
                    </Button>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={guardarDesign}
                      disabled={loading}
                    >
                      <Save className="w-4 h-4 mr-2" /> Guardar Design
                    </Button>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => abrirPreviewPopup(sessionId)}
                    >
                      <Eye className="w-4 h-4 mr-2" /> Abrir Preview Grande
                    </Button>
                  </>
                )}
                
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowNovoPassoModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Passo Manual
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
          <div className="col-span-12 lg:col-span-6">
            <Card className="bg-gray-800 border-gray-700 h-full min-h-[400px]">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
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
                  <div className="mt-4 space-y-3">
                    {/* Campos de credenciais */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">📧 Email</label>
                        <div className="flex gap-1">
                          <Input
                            id="campo-email"
                            placeholder="Email..."
                            className="bg-gray-700 border-gray-600 text-sm"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              const email = document.getElementById('campo-email').value;
                              if (email) {
                                enviarAcao('type', { texto: email });
                                const novoPasso = {
                                  ordem: passos.length + 1,
                                  tipo: 'fill_credential',
                                  campo_credencial: 'email',
                                  descricao: '🔐 email'
                                };
                                setPassos(prev => [...prev, novoPasso]);
                                document.getElementById('campo-email').value = '';
                                toast.success('Email inserido');
                              }
                            }}
                          >
                            Inserir
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">🔑 Senha</label>
                        <div className="flex gap-1">
                          <Input
                            id="campo-senha"
                            type="password"
                            placeholder="Senha..."
                            className="bg-gray-700 border-gray-600 text-sm"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              const senha = document.getElementById('campo-senha').value;
                              if (senha) {
                                enviarAcao('type', { texto: senha });
                                // Gravar como credencial
                                const novoPasso = {
                                  ordem: passos.length + 1,
                                  tipo: 'fill_credential',
                                  campo_credencial: 'password',
                                  descricao: '🔐 password'
                                };
                                setPassos(prev => [...prev, novoPasso]);
                                document.getElementById('campo-senha').value = '';
                                toast.success('Senha inserida e gravada');
                              }
                            }}
                          >
                            Inserir
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">📱 Telefone</label>
                        <div className="flex gap-1">
                          <Input
                            id="campo-telefone"
                            placeholder="Telefone..."
                            className="bg-gray-700 border-gray-600 text-sm"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              const tel = document.getElementById('campo-telefone').value;
                              if (tel) {
                                enviarAcao('type', { texto: tel });
                                const novoPasso = {
                                  ordem: passos.length + 1,
                                  tipo: 'fill_credential',
                                  campo_credencial: 'telefone',
                                  descricao: '🔐 telefone'
                                };
                                setPassos(prev => [...prev, novoPasso]);
                                document.getElementById('campo-telefone').value = '';
                                toast.success('Telefone inserido');
                              }
                            }}
                          >
                            Inserir
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">📲 Código SMS</label>
                        <div className="flex gap-1">
                          <Input
                            id="campo-sms"
                            placeholder="Código SMS..."
                            className="bg-gray-700 border-gray-600 text-sm"
                          />
                          <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              const codigo = document.getElementById('campo-sms').value;
                              if (codigo) {
                                // Enviar código caractere a caractere com delay
                                enviarAcao('type', { texto: codigo });
                                document.getElementById('campo-sms').value = '';
                                toast.success('Código SMS inserido');
                              } else {
                                toast.error('Preencha o código SMS primeiro');
                              }
                            }}
                          >
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Texto livre */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">⌨️ Texto livre</label>
                      <div className="flex gap-2">
                        <Input
                          id="campo-texto"
                          placeholder="Digite texto e pressione Enter ou clique Enviar..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              enviarAcao('type', { texto: e.target.value });
                              const novoPasso = {
                                ordem: passos.length + 1,
                                tipo: 'type',
                                valor: e.target.value,
                                descricao: `⌨️ "${e.target.value}"`
                              };
                              setPassos(prev => [...prev, novoPasso]);
                              e.target.value = '';
                            }
                          }}
                          className="bg-gray-700 border-gray-600"
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            const texto = document.getElementById('campo-texto').value;
                            if (texto) {
                              enviarAcao('type', { texto });
                              const novoPasso = {
                                ordem: passos.length + 1,
                                tipo: 'type',
                                valor: texto,
                                descricao: `⌨️ "${texto}"`
                              };
                              setPassos(prev => [...prev, novoPasso]);
                              document.getElementById('campo-texto').value = '';
                            }
                          }}
                        >
                          Enviar
                        </Button>
                      </div>
                    </div>
                    
                    {/* Botões de ação */}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('press', { tecla: 'Enter' })}>
                        ⏎ Enter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('press', { tecla: 'Tab' })}>
                        ⇥ Tab
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('scroll', { delta: 300 })}>
                        ↓ Scroll
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => enviarAcao('scroll', { delta: -300 })}>
                        ↑ Scroll
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          // Adicionar passo de espera
                          const novoPasso = {
                            ordem: passos.length + 1,
                            tipo: 'wait',
                            timeout: 2000,
                            descricao: '⏳ Esperar 2s'
                          };
                          setPassos(prev => [...prev, novoPasso]);
                          toast.info('Passo de espera adicionado');
                        }}
                      >
                        ⏳ +Espera
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          // Adicionar passo de download
                          const novoPasso = {
                            ordem: passos.length + 1,
                            tipo: 'download',
                            timeout: 60000,
                            descricao: '📥 Aguardar download'
                          };
                          setPassos(prev => [...prev, novoPasso]);
                          toast.info('Passo de download adicionado');
                        }}
                      >
                        📥 +Download
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Painel Direito - Passos */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-gray-300 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <List className="w-4 h-4" /> Passos Gravados ({passos.length})
                  </span>
                  {passos.length > 0 && (
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          if (passos.length > 0) {
                            setPassos(passos.slice(0, -1).map((p, i) => ({...p, ordem: i + 1})));
                            toast.info('Último passo removido');
                          }
                        }}
                        className="text-yellow-400 hover:text-yellow-300 text-xs h-7 px-2"
                      >
                        ↩️ Anular
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Limpar todos os passos?')) {
                            setPassos([]);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 text-xs h-7 px-2"
                      >
                        🗑️ Limpar
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {passos.length === 0 ? (
                    <div className="text-center text-gray-500 py-6">
                      <p className="text-sm">Nenhum passo gravado</p>
                      <p className="text-xs mt-1.5">
                        Inicie a gravação e clique na página para gravar passos
                      </p>
                    </div>
                  ) : (
                    passos.map((passo, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded text-xs group ${
                          passo.tipo === 'fill_credential' 
                            ? 'bg-yellow-900/50 border border-yellow-600' 
                            : 'bg-gray-700'
                        }`}
                      >
                        <span className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center text-xs text-white shrink-0">
                          {passo.ordem}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="shrink-0">
                              {TIPOS_PASSO.find(t => t.value === passo.tipo)?.icon || '❓'}
                            </span>
                            <span className="text-gray-300 truncate">
                              {passo.descricao || passo.tipo}
                            </span>
                          </div>
                          {passo.seletor && (
                            <div className="text-xs text-gray-500 truncate">
                              {passo.seletor}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                          {passo.tipo === 'type' && (
                            <button
                              onClick={() => {
                                // Converter para credencial
                                const campo = window.prompt('Converter para credencial:\n1 = email\n2 = password\n3 = telefone', '1');
                                if (campo) {
                                  const campos = {'1': 'email', '2': 'password', '3': 'telefone'};
                                  const novosPassos = [...passos];
                                  novosPassos[index] = {
                                    ...passo,
                                    tipo: 'fill_credential',
                                    campo_credencial: campos[campo] || 'email',
                                    descricao: `🔐 ${campos[campo] || 'email'}`
                                  };
                                  setPassos(novosPassos);
                                  toast.success('Convertido para credencial');
                                }
                              }}
                              className="text-yellow-400 hover:text-yellow-300"
                              title="Converter para credencial"
                            >
                              🔐
                            </button>
                          )}
                          <button
                            onClick={() => removerPasso(passo.ordem)}
                            className="text-red-400 hover:text-red-300"
                            title="Remover passo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Legenda */}
                {passos.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Dica: Passe o rato sobre um passo para ver opções</p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-yellow-400">🔐 = Credencial</span>
                      <span className="text-gray-400">🖱️ = Click</span>
                      <span className="text-gray-400">⌨️ = Texto</span>
                    </div>
                  </div>
                )}
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
