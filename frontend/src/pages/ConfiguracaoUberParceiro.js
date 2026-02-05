import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, RefreshCw, Loader2,
  Shield, Monitor, MousePointer, Keyboard, Download, 
  Users, DollarSign, FileText, Calendar, Play, Square, Eye
} from 'lucide-react';

const ConfiguracaoUberParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [sessaoStatus, setSessaoStatus] = useState(null);
  const [historico, setHistorico] = useState([]);
  
  // Estados do browser interativo
  const [browserAtivo, setBrowserAtivo] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [logado, setLogado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [textoInput, setTextoInput] = useState('');
  const [extraindo, setExtraindo] = useState(false);
  const [resultadoExtracao, setResultadoExtracao] = useState(null);
  
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
      
      // Verificar status da sessão
      const statusRes = await axios.get(`${API}/rpa/uber/minha-sessao-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessaoStatus(statusRes.data);
      
      // Carregar histórico
      try {
        const histRes = await axios.get(`${API}/rpa/uber/meu-historico`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistorico(histRes.data || []);
      } catch (e) {
        setHistorico([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== FUNÇÕES DO BROWSER INTERATIVO =====
  
  const iniciarBrowser = async () => {
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/browser/iniciar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.sucesso) {
        setBrowserAtivo(true);
        setScreenshot(response.data.screenshot);
        toast.success('Browser iniciado! Faça login na Uber.');
        
        // Iniciar atualização automática de screenshots
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
        setLogado(response.data.logado);
        
        if (response.data.logado && intervalRef.current) {
          // Parar atualização automática quando logado
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          toast.success('Login detectado! Sessão guardada.');
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
        setLogado(response.data.logado);
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
        setLogado(response.data.logado);
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
        setLogado(response.data.logado);
      }
    } catch (error) {
      toast.error('Erro ao pressionar tecla');
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
        setLogado(true);
        toast.success('Login confirmado! Sessão guardada.');
        carregarDados();
      } else {
        toast.info('Ainda não está logado. Continue o processo.');
      }
    } catch (error) {
      toast.error('Erro ao verificar login');
    } finally {
      setAtualizando(false);
    }
  };
  
  const extrairRendimentos = async () => {
    setExtraindo(true);
    setResultadoExtracao(null);
    
    try {
      const token = localStorage.getItem('token');
      toast.info('A extrair rendimentos... aguarde.');
      
      const response = await axios.post(`${API}/browser/extrair`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      });
      
      if (response.data.sucesso) {
        setResultadoExtracao(response.data);
        toast.success(`Extração concluída! ${response.data.total_motoristas} motoristas`);
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Erro na extração');
      }
    } catch (error) {
      toast.error('Erro na extração de rendimentos');
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
      console.error('Erro ao fechar browser:', error);
    }
    
    setBrowserAtivo(false);
    setScreenshot(null);
    setLogado(false);
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
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-7 h-7 text-blue-500" />
            Sincronização Uber Fleet
          </h1>
          <p className="text-gray-500 mt-1">
            Faça login e extraia os rendimentos automaticamente
          </p>
        </div>

        {/* Status da Sessão */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className={`w-6 h-6 ${sessaoStatus?.valida ? 'text-green-500' : 'text-red-500'}`} />
                <div>
                  <p className="font-medium">Estado da Sessão</p>
                  <p className="text-sm text-gray-500">
                    {sessaoStatus?.valida 
                      ? `Ativa até ${new Date(sessaoStatus.expira).toLocaleDateString('pt-PT')}` 
                      : 'Sessão expirada - faça login'}
                  </p>
                </div>
              </div>
              {sessaoStatus?.valida ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Browser Interativo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              Login Uber (Browser Remoto)
            </CardTitle>
            <CardDescription>
              Clique para iniciar o browser. Faça login normalmente (incluindo CAPTCHA). 
              A sessão será guardada automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!browserAtivo ? (
              <Button onClick={iniciarBrowser} disabled={atualizando} className="w-full">
                {atualizando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Iniciar Browser para Login
              </Button>
            ) : (
              <>
                {/* Área do Screenshot */}
                <div className="relative border rounded-lg overflow-hidden bg-gray-100">
                  {screenshot ? (
                    <img
                      ref={imgRef}
                      src={`data:image/jpeg;base64,${screenshot}`}
                      alt="Uber Fleet"
                      className="w-full cursor-crosshair"
                      onClick={handleImageClick}
                      style={{ maxHeight: '500px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  )}
                  
                  {atualizando && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                      A atualizar...
                    </div>
                  )}
                  
                  {logado && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Logado
                    </div>
                  )}
                </div>
                
                {/* Controlos */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Escrever texto..."
                      value={textoInput}
                      onChange={(e) => setTextoInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && enviarTexto()}
                    />
                    <Button onClick={enviarTexto} variant="outline" size="icon">
                      <Keyboard className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button onClick={() => enviarTecla('Enter')} variant="outline" size="sm">
                    Enter
                  </Button>
                  <Button onClick={() => enviarTecla('Tab')} variant="outline" size="sm">
                    Tab
                  </Button>
                  <Button onClick={atualizarScreenshot} variant="outline" size="icon">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Ações */}
                <div className="flex gap-2">
                  <Button 
                    onClick={verificarLogin} 
                    variant="outline" 
                    className="flex-1"
                    disabled={atualizando}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Verificar Login
                  </Button>
                  
                  {logado && (
                    <Button 
                      onClick={extrairRendimentos} 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={extraindo}
                    >
                      {extraindo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Extrair Rendimentos
                    </Button>
                  )}
                  
                  <Button onClick={fecharBrowser} variant="destructive">
                    <Square className="w-4 h-4 mr-2" />
                    Fechar
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  💡 Clique na imagem para interagir. Use os campos acima para escrever texto.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Resultado da Extração */}
        {resultadoExtracao && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Extração Concluída!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Users className="w-4 h-4" />
                    Motoristas
                  </div>
                  <div className="text-2xl font-bold">{resultadoExtracao.total_motoristas}</div>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <DollarSign className="w-4 h-4" />
                    Total
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    €{resultadoExtracao.total_rendimentos?.toFixed(2)}
                  </div>
                </div>
              </div>
              
              {resultadoExtracao.motoristas?.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {resultadoExtracao.motoristas.map((m, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-white rounded border text-sm">
                      <span>{m.nome}</span>
                      <span className="font-medium text-green-600">€{m.rendimentos_liquidos?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        {historico.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Histórico de Importações
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
                      <span className="text-sm text-gray-600">{imp.total_motoristas} motoristas</span>
                      <span className="text-sm font-semibold text-green-600">€{imp.total_rendimentos?.toFixed(2)}</span>
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
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Como funciona?</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Clique em "Iniciar Browser para Login"</li>
                  <li>Faça login normalmente na Uber (resolva CAPTCHA se necessário)</li>
                  <li>Clique na imagem para interagir, use o campo de texto para escrever</li>
                  <li>Quando estiver logado, clique em "Extrair Rendimentos"</li>
                  <li>Os dados serão importados automaticamente</li>
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
