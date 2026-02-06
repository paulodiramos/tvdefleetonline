import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, StopCircle, CheckCircle, XCircle, Clock, 
  RefreshCw, Eye, ChevronRight, Users
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import Layout from '../components/Layout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ExecutarRPA({ user, onLogout }) {
  const [designs, setDesigns] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [designSelecionado, setDesignSelecionado] = useState(null);
  const [parceiroSelecionado, setParceiroSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [logs, setLogs] = useState([]);
  
  const wsRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar designs
      const resDesigns = await fetch(`${API_URL}/api/rpa-designer/designs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataDesigns = await resDesigns.json();
      if (Array.isArray(dataDesigns)) {
        setDesigns(dataDesigns.filter(d => d.passos && d.passos.length > 0));
      }
      
      // Carregar parceiros
      const resParceiros = await fetch(`${API_URL}/api/parceiros`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataParceiros = await resParceiros.json();
      if (Array.isArray(dataParceiros)) {
        setParceiros(dataParceiros);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const iniciarExecucao = async () => {
    if (!designSelecionado || !parceiroSelecionado) {
      toast.error('Selecione um design e um parceiro');
      return;
    }
    
    setExecutando(true);
    setLogs([]);
    setProgresso(null);
    
    try {
      // Iniciar execução
      const res = await fetch(`${API_URL}/api/rpa-designer/executar-design`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          design_id: designSelecionado.id,
          parceiro_id: parceiroSelecionado.id,
          usar_sessao: true
        })
      });
      
      const data = await res.json();
      
      if (data.erro) {
        toast.error(data.mensagem);
        setExecutando(false);
        return;
      }
      
      // Conectar WebSocket
      conectarWebSocket(data.execution_id, data);
      
    } catch (error) {
      toast.error('Erro ao iniciar execução');
      console.error(error);
      setExecutando(false);
    }
  };

  const conectarWebSocket = (executionId, params) => {
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/rpa-designer/ws/executar/${executionId}`);
    
    ws.onopen = () => {
      // Enviar parâmetros
      ws.send(JSON.stringify({
        design_id: params.design_id,
        parceiro_id: params.parceiro_id,
        session_path: params.session_path
      }));
      addLog('info', 'Conexão estabelecida');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.tipo === 'inicio') {
        addLog('info', `Iniciando: ${data.design} (${data.total_passos} passos)`);
      } else if (data.tipo === 'info') {
        addLog('info', data.mensagem);
      } else if (data.tipo === 'progresso') {
        setProgresso({
          passo: data.passo,
          total: data.total,
          descricao: data.descricao
        });
        addLog('step', data.descricao);
      } else if (data.tipo === 'screenshot') {
        setScreenshot(`data:image/jpeg;base64,${data.data}`);
      } else if (data.tipo === 'erro_passo') {
        addLog('error', `Erro no passo ${data.passo}: ${data.erro}`);
      } else if (data.tipo === 'concluido') {
        addLog('success', data.mensagem);
        toast.success(data.mensagem);
        setExecutando(false);
      } else if (data.tipo === 'erro') {
        addLog('error', data.mensagem);
        toast.error(data.mensagem);
        setExecutando(false);
      }
    };
    
    ws.onclose = () => {
      setExecutando(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket erro:', error);
      toast.error('Erro na conexão');
      setExecutando(false);
    };
    
    wsRef.current = ws;
  };

  const addLog = (type, message) => {
    setLogs(prev => [...prev, {
      type,
      message,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const pararExecucao = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setExecutando(false);
    addLog('warning', 'Execução cancelada');
  };

  const design = designs.find(d => d.id === designSelecionado?.id);
  const parceiro = parceiros.find(p => p.id === parceiroSelecionado?.id);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Play className="w-6 h-6" />
              Executar RPA
            </h1>
            <p className="text-gray-400 mt-1">
              Execute designs RPA para extrair dados das plataformas
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Painel de Controlo */}
            <div className="col-span-4 space-y-4">
              {/* Seleção de Design */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">1. Selecionar Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={designSelecionado?.id || ''} 
                    onValueChange={(val) => setDesignSelecionado(designs.find(d => d.id === val))}
                    disabled={executando}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600">
                      <SelectValue placeholder="Escolha um design..." />
                    </SelectTrigger>
                    <SelectContent>
                      {designs.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome} ({d.passos?.length || 0} passos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {designSelecionado && (
                    <div className="mt-3 p-2 bg-gray-700/50 rounded text-sm">
                      <p className="text-gray-400">Plataforma: <span className="text-white">{designSelecionado.plataforma_nome || 'N/A'}</span></p>
                      <p className="text-gray-400">Passos: <span className="text-white">{designSelecionado.passos?.length || 0}</span></p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seleção de Parceiro */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    2. Selecionar Parceiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={parceiroSelecionado?.id || ''} 
                    onValueChange={(val) => setParceiroSelecionado(parceiros.find(p => p.id === val))}
                    disabled={executando}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600">
                      <SelectValue placeholder="Escolha um parceiro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {parceiros.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {parceiroSelecionado && (
                    <div className="mt-3 p-2 bg-gray-700/50 rounded text-sm">
                      <p className="text-gray-400">Email: <span className="text-white">{parceiroSelecionado.email}</span></p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botões de Ação */}
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4 space-y-3">
                  {!executando ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={iniciarExecucao}
                      disabled={!designSelecionado || !parceiroSelecionado || loading}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Executar Design
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={pararExecucao}
                    >
                      <StopCircle className="w-4 h-4 mr-2" />
                      Parar Execução
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={carregarDados}
                    disabled={loading || executando}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </CardContent>
              </Card>

              {/* Progresso */}
              {progresso && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-300">Progresso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Passo {progresso.passo}/{progresso.total}</span>
                        <span className="text-blue-400">{Math.round((progresso.passo / progresso.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(progresso.passo / progresso.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{progresso.descricao}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Preview e Logs */}
            <div className="col-span-8 space-y-4">
              {/* Preview */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Preview da Execução
                    </CardTitle>
                    {executando && (
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        A executar...
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    className="relative bg-gray-900 rounded-lg overflow-hidden"
                    style={{ aspectRatio: '16/9' }}
                  >
                    {screenshot ? (
                      <img 
                        src={screenshot} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Inicie uma execução para ver o preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Logs */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Logs de Execução</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
                    {logs.length === 0 ? (
                      <p className="text-gray-500">Nenhum log ainda...</p>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <span className="text-gray-600">[{log.timestamp}]</span>
                          {log.type === 'error' && <XCircle className="w-3 h-3 text-red-400 mt-0.5" />}
                          {log.type === 'success' && <CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />}
                          {log.type === 'step' && <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5" />}
                          {log.type === 'info' && <Clock className="w-3 h-3 text-gray-400 mt-0.5" />}
                          <span className={
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                            log.type === 'step' ? 'text-blue-400' :
                            'text-gray-400'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
