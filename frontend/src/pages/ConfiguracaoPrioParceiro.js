import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Fuel, Zap, CheckCircle, AlertCircle, Loader2, Shield, Key, 
  Lock, Clock, FileText, Calendar, Monitor, Play, Square, 
  RefreshCw, Keyboard, Download, Eye, EyeOff, MousePointer
} from 'lucide-react';

const ConfiguracaoPrioParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  
  // Estados do browser remoto
  const [browserAtivo, setBrowserAtivo] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [textoInput, setTextoInput] = useState('');
  const [codigoSMS, setCodigoSMS] = useState('');
  const [logado, setLogado] = useState(false);
  
  // Estado de extração
  const [semanaSelecionada, setSemanaSelecionada] = useState('');
  const [extraindo, setExtraindo] = useState(false);
  const [tipoExtracao, setTipoExtracao] = useState('combustivel');
  
  const imgRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    carregarStatus();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const carregarStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.get(`${API}/prio/browser/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatus(res.data);
      setBrowserAtivo(res.data.browser_ativo);
      
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  // === BROWSER REMOTO ===
  
  const iniciarBrowser = async () => {
    try {
      setAtualizando(true);
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/iniciar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.sucesso) {
        setBrowserAtivo(true);
        setScreenshot(res.data.screenshot);
        toast.success('Browser Prio iniciado!');
        
        // Iniciar atualização automática
        intervalRef.current = setInterval(atualizarScreenshot, 2000);
      } else {
        toast.error(res.data.erro || 'Erro ao iniciar browser');
      }
      
    } catch (error) {
      toast.error('Erro ao iniciar browser');
    } finally {
      setAtualizando(false);
    }
  };
  
  const fecharBrowser = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${API}/prio/browser/fechar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBrowserAtivo(false);
      setScreenshot(null);
      setLogado(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      toast.info('Browser Prio fechado');
      
    } catch (error) {
      console.error('Erro:', error);
    }
  };
  
  const atualizarScreenshot = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/screenshot`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        setLogado(res.data.logado || false);
      }
      
    } catch (error) {
      console.error('Erro screenshot:', error);
    }
  };
  
  const handleImageClick = async (e) => {
    if (!imgRef.current || !browserAtivo) return;
    
    // Mostrar indicador de loading
    setAtualizando(true);
    
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    console.log(`Clique na posição: x=${x}, y=${y}`);
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/clicar`, 
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        setLogado(res.data.logado || false);
        
        if (res.data.logado) {
          toast.success('Login Prio concluído! Sessão guardada.');
        }
      } else {
        toast.error(res.data.erro || 'Erro ao clicar');
      }
      
    } catch (error) {
      console.error('Erro ao clicar:', error);
      toast.error('Erro ao processar clique');
    } finally {
      setAtualizando(false);
    }
  };
  
  const enviarTexto = async () => {
    if (!textoInput || !browserAtivo) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/digitar`, 
        { texto: textoInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        setTextoInput('');
      }
      
    } catch (error) {
      console.error('Erro ao digitar:', error);
    }
  };
  
  const enviarTecla = async (tecla) => {
    if (!browserAtivo) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/digitar`, 
        { tecla },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
      }
      
    } catch (error) {
      console.error('Erro tecla:', error);
    }
  };
  
  const preencherEmail = async () => {
    if (!browserAtivo) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/preencher-email`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        toast.success('Utilizador preenchido!');
      } else {
        toast.error(res.data.erro || 'Erro ao preencher utilizador');
      }
      
    } catch (error) {
      console.error('Erro ao preencher email:', error);
      toast.error('Erro ao preencher utilizador');
    }
  };
  
  const preencherPassword = async () => {
    if (!browserAtivo) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/preencher-password`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        toast.success('Password preenchida!');
      } else {
        toast.error(res.data.erro || 'Erro ao preencher password');
      }
      
    } catch (error) {
      console.error('Erro ao preencher password:', error);
      toast.error('Erro ao preencher password');
    }
  };
  
  const preencherSMS = async () => {
    if (!browserAtivo || !codigoSMS) {
      toast.error('Introduza o código SMS');
      return;
    }
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/preencher-sms`, 
        { codigo: codigoSMS },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        setLogado(res.data.logado || false);
        setCodigoSMS('');
        toast.success('Código SMS preenchido!');
        
        if (res.data.logado) {
          toast.success('Login concluído! Sessão guardada.');
        }
      } else {
        toast.error(res.data.erro || 'Erro ao preencher código SMS');
      }
      
    } catch (error) {
      console.error('Erro ao preencher SMS:', error);
      toast.error('Erro ao preencher código SMS');
    } finally {
      setAtualizando(false);
    }
  };
  
  const clicarIniciarSessao = async () => {
    if (!browserAtivo) return;
    
    setAtualizando(true);
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.post(`${API}/prio/browser/clicar-iniciar-sessao`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.sucesso) {
        setScreenshot(res.data.screenshot);
        setLogado(res.data.logado || false);
        toast.success('Botão "Iniciar Sessão" clicado!');
        
        if (res.data.logado) {
          toast.success('Login concluído! Sessão guardada.');
        }
      } else {
        toast.error(res.data.erro || 'Erro ao clicar no botão');
      }
      
    } catch (error) {
      console.error('Erro ao clicar iniciar sessão:', error);
      toast.error('Erro ao clicar no botão');
    } finally {
      setAtualizando(false);
    }
  };

  // === EXTRAÇÃO DE DADOS ===
  
  const extrairDados = async (tipo = null) => {
    const tipoFinal = tipo || tipoExtracao;
    
    if (!semanaSelecionada || !logado) {
      toast.error('Selecione uma semana e certifique-se que está logado');
      return;
    }
    
    try {
      setExtraindo(true);
      if (tipo) setTipoExtracao(tipo);
      
      const token = localStorage.getItem('token');
      
      const [semana, ano] = semanaSelecionada.split('/');
      
      toast.info(`Iniciando extração de ${tipoFinal}...`);
      
      const res = await axios.post(`${API}/prio/extrair`, {
        tipo: tipoFinal,
        semana: parseInt(semana),
        ano: parseInt(ano)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.sucesso) {
        const proc = res.data.processamento;
        if (proc) {
          toast.success(
            `${tipoFinal === 'combustivel' ? 'Combustível' : 'Elétrico'} sincronizado! ` +
            `${proc.registos_processados || 0} registos (${proc.registos_inseridos || 0} novos)`
          );
        } else {
          toast.success(`Dados de ${tipoFinal} extraídos com sucesso!`);
        }
        atualizarScreenshot();
      } else {
        toast.error(res.data.erro || 'Erro na extração');
      }
      
    } catch (error) {
      console.error('Erro na extração:', error);
      toast.error('Erro ao extrair dados: ' + (error.response?.data?.detail || error.message));
    } finally {
      setExtraindo(false);
    }
  };

  // Gerar opções de semanas
  const gerarSemanas = () => {
    const semanas = [];
    const hoje = new Date();
    const ano = hoje.getFullYear();
    
    // Última 8 semanas
    for (let i = 0; i < 8; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - (i * 7));
      const semana = getWeekNumber(data);
      semanas.push(`${semana}/${ano}`);
    }
    
    return semanas;
  };
  
  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuração Prio</h1>
          <p className="text-slate-600">Login e extração de dados de combustível e carregamentos elétricos</p>
        </div>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Estado da Sessão Prio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Browser</p>
                <p className={`font-semibold ${browserAtivo ? 'text-green-600' : 'text-slate-400'}`}>
                  {browserAtivo ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Login</p>
                <p className={`font-semibold ${logado ? 'text-green-600' : 'text-orange-500'}`}>
                  {logado ? 'Autenticado' : 'Não logado'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Sessão Guardada</p>
                <p className={`font-semibold ${status?.sessao_existe ? 'text-green-600' : 'text-slate-400'}`}>
                  {status?.sessao_existe ? 'Sim' : 'Não'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Utilizador</p>
                <p className="font-semibold text-slate-700">
                  {status?.prio_usuario || 'Não configurado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Browser Remoto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-600" />
              Browser Remoto - Login Prio
            </CardTitle>
            <CardDescription>
              Faça login manual no portal Prio. O sistema irá guardar a sessão para extracções automáticas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controlos do Browser */}
            <div className="flex gap-2">
              {!browserAtivo ? (
                <Button onClick={iniciarBrowser} disabled={atualizando}>
                  {atualizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Iniciar Browser
                </Button>
              ) : (
                <>
                  <Button variant="destructive" onClick={fecharBrowser}>
                    <Square className="w-4 h-4 mr-2" />
                    Fechar
                  </Button>
                  <Button variant="outline" onClick={atualizarScreenshot}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                </>
              )}
            </div>

            {/* Botões de preenchimento automático - Sempre visíveis quando browser ativo */}
            {browserAtivo && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">1. Preencher Credenciais:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={preencherEmail} className="bg-white hover:bg-blue-100">
                      📧 Preencher Utilizador
                    </Button>
                    <Button size="sm" variant="outline" onClick={preencherPassword} className="bg-white hover:bg-blue-100">
                      🔑 Preencher Password
                    </Button>
                    <Button size="sm" onClick={clicarIniciarSessao} disabled={atualizando} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {atualizando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      🚀 Iniciar Sessão
                    </Button>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">2. Código SMS (após clicar Iniciar Sessão):</p>
                  <div className="flex gap-2">
                    <Input
                      value={codigoSMS}
                      onChange={(e) => setCodigoSMS(e.target.value)}
                      placeholder="Introduza o código SMS..."
                      className="max-w-[200px] bg-white"
                      onKeyDown={(e) => e.key === 'Enter' && preencherSMS()}
                    />
                    <Button size="sm" onClick={preencherSMS} disabled={atualizando || !codigoSMS} className="bg-green-600 hover:bg-green-700 text-white">
                      {atualizando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      📱 Enviar SMS
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap pt-2 border-t border-blue-200">
                  <span className="text-xs text-blue-600 mr-2">Teclas:</span>
                  <Button size="sm" variant="outline" onClick={() => enviarTecla('Tab')} className="h-7 px-2 bg-white">Tab</Button>
                  <Button size="sm" variant="outline" onClick={() => enviarTecla('Enter')} className="h-7 px-2 bg-white">Enter</Button>
                  <Button size="sm" variant="outline" onClick={() => enviarTecla('Backspace')} className="h-7 px-2 bg-white">⌫</Button>
                </div>
              </div>
            )}

            {/* Screenshot */}
            {browserAtivo && screenshot && (
              <div className="space-y-3">
                <div className="bg-slate-100 p-2 rounded-lg relative">
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <MousePointer className="w-3 h-3" />
                    Clique na imagem para interagir (ex: botão "INICIAR SESSÃO")
                  </p>
                  <div className="relative">
                    <img
                      ref={imgRef}
                      src={`data:image/jpeg;base64,${screenshot}`}
                      alt="Browser Prio"
                      className={`w-full rounded border cursor-crosshair ${atualizando ? 'opacity-50' : ''}`}
                      onClick={handleImageClick}
                      style={{ maxHeight: '500px', objectFit: 'contain' }}
                    />
                    {atualizando && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                        <div className="bg-white px-4 py-2 rounded-lg shadow flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm font-medium">A processar clique...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Input de texto para digitar manualmente */}
                <div className="flex gap-2">
                  <Input
                    value={textoInput}
                    onChange={(e) => setTextoInput(e.target.value)}
                    placeholder="Digite texto (ex: código SMS)..."
                    onKeyDown={(e) => e.key === 'Enter' && enviarTexto()}
                  />
                  <Button onClick={enviarTexto} size="icon">
                    <Keyboard className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Indicador de login */}
                {logado && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-700 font-medium">
                      Login Prio concluído! A sessão foi guardada para extracções automáticas.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Instruções */}
            {!browserAtivo && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Instruções de Login Prio:</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Clique em "Iniciar Browser" para abrir o portal Prio</li>
                  <li>Use os botões "Preencher Utilizador" e "Preencher Password" para preencher automaticamente</li>
                  <li>Clique em "Iniciar Sessão" na imagem</li>
                  <li>Aguarde o código SMS e introduza-o no campo</li>
                  <li>Após login bem sucedido, a sessão é guardada automaticamente</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extração de Dados - Sempre visível mas com aviso se não logado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-green-600" />
              Extrair Dados da Prio
            </CardTitle>
            <CardDescription>
              Sincronize dados de combustível e carregamentos elétricos separadamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!logado && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                <p className="text-sm text-orange-700">
                  ⚠️ Faça login no portal Prio acima antes de extrair dados. Após o login bem sucedido, 
                  poderá sincronizar os dados de combustível e elétrico.
                </p>
              </div>
            )}
            
            {/* Selector de Semana */}
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Semana a Sincronizar</label>
              <select
                value={semanaSelecionada}
                onChange={(e) => setSemanaSelecionada(e.target.value)}
                className="w-full max-w-xs p-2 border rounded-lg"
              >
                <option value="">Selecione uma semana...</option>
                {gerarSemanas().map(s => (
                  <option key={s} value={s}>Semana {s}</option>
                ))}
              </select>
            </div>
            
            {/* Botões de Extração Separados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Combustível */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">Combustível</span>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  Extrai ficheiro Excel (.xls) com abastecimentos de veículos a combustão (gasolina, diesel) da página "Transações Frota"
                </p>
                <Button 
                  onClick={() => {
                    setTipoExtracao('combustivel');
                    extrairDados('combustivel');
                  }} 
                  disabled={extraindo || !semanaSelecionada || !logado}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  variant="default"
                >
                  {extraindo && tipoExtracao === 'combustivel' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Fuel className="w-4 h-4 mr-2" />
                  )}
                  Sincronizar Combustível
                </Button>
              </div>
              
              {/* Elétrico */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Elétrico</span>
                </div>
                <p className="text-xs text-green-700 mb-3">
                  Extrai ficheiro CSV com carregamentos de veículos elétricos da página "Transações Electric"
                </p>
                <Button 
                  onClick={() => {
                    setTipoExtracao('eletrico');
                    extrairDados('eletrico');
                  }} 
                  disabled={extraindo || !semanaSelecionada || !logado}
                  className="w-full bg-green-600 hover:bg-green-700"
                  variant="default"
                >
                  {extraindo && tipoExtracao === 'eletrico' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Sincronizar Elétrico
                </Button>
              </div>
            </div>
            
            {/* Indicador de sucesso após extração */}
            {logado && semanaSelecionada && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  ✓ Pronto para extrair dados da <strong>Semana {semanaSelecionada}</strong>. 
                  Selecione o tipo de dados acima.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoPrioParceiro;
