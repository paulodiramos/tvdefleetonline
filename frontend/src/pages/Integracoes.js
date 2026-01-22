import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Check, X, AlertCircle, Mail, MessageSquare, CreditCard, Cloud, RefreshCw, QrCode, LogOut, Smartphone, Eye, EyeOff, FolderSync, HelpCircle, ExternalLink, Copy, Monitor, Cookie, MousePointer, CheckCircle2 } from 'lucide-react';

// Componente do Guia Visual do Terabox
const TeraboxGuideModal = ({ onCookieObtained }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [open, setOpen] = useState(false);
  
  const steps = [
    {
      number: 1,
      title: "Abrir o Terabox",
      description: "Clique no botão abaixo para abrir o Terabox numa nova janela e faça login na sua conta.",
      icon: <ExternalLink className="w-8 h-8" />,
      action: (
        <Button 
          onClick={() => window.open('https://www.terabox.com', '_blank')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Abrir Terabox
        </Button>
      )
    },
    {
      number: 2,
      title: "Abrir Ferramentas de Desenvolvedor",
      description: "Depois de fazer login, pressione F12 no teclado (ou clique com botão direito → 'Inspecionar').",
      icon: <Monitor className="w-8 h-8" />,
      tip: "Em Mac: Cmd + Option + I"
    },
    {
      number: 3,
      title: "Ir para Application → Cookies",
      description: "Na janela que abriu, clique no separador 'Application' (ou 'Aplicação'). Depois, no menu lateral esquerdo, expanda 'Cookies' e clique em 'www.terabox.com'.",
      icon: <Cookie className="w-8 h-8" />,
      tip: "Se não vir 'Application', clique nas setas >> para ver mais opções"
    },
    {
      number: 4,
      title: "Encontrar o cookie 'ndus'",
      description: "Na lista de cookies, procure a linha com o nome 'ndus'. O valor está na coluna ao lado (começa com letras e números).",
      icon: <MousePointer className="w-8 h-8" />,
      tip: "Use Ctrl+F para pesquisar 'ndus' se a lista for grande"
    },
    {
      number: 5,
      title: "Copiar o valor",
      description: "Faça duplo-clique no valor do cookie 'ndus' para selecionar, depois Ctrl+C para copiar. Cole no campo 'Cookie de Sessão' na página de Integrações.",
      icon: <Copy className="w-8 h-8" />,
      action: (
        <Button 
          onClick={() => {
            setOpen(false);
            toast.success('Agora cole o cookie no campo abaixo!');
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Já copiei, fechar guia
        </Button>
      )
    }
  ];

  const currentStepData = steps[currentStep - 1];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
          <HelpCircle className="w-4 h-4 mr-2" />
          Como obter o cookie?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Cloud className="w-6 h-6 text-blue-600" />
            Guia: Obter Cookie do Terabox
          </DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para obter o cookie de autenticação
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  currentStep === step.number 
                    ? 'bg-blue-600 text-white scale-110' 
                    : currentStep > step.number 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-1 mx-1 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="bg-slate-50 rounded-xl p-6 min-h-[250px]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              {currentStepData.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">
                Passo {currentStepData.number}: {currentStepData.title}
              </h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                {currentStepData.description}
              </p>
              
              {currentStepData.tip && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-amber-800 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <strong>Dica:</strong> {currentStepData.tip}
                  </p>
                </div>
              )}
              
              {currentStepData.action && (
                <div className="mt-4">
                  {currentStepData.action}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual Aid - Browser Screenshot Placeholder */}
        {currentStep >= 2 && currentStep <= 4 && (
          <div className="bg-gray-900 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs ml-2">DevTools - www.terabox.com</span>
            </div>
            <div className="bg-gray-800 rounded p-3 font-mono text-sm">
              {currentStep === 2 && (
                <div className="text-gray-300">
                  <span className="text-blue-400">Pressione</span> <kbd className="bg-gray-700 px-2 py-1 rounded text-white">F12</kbd> <span className="text-blue-400">para abrir</span>
                </div>
              )}
              {currentStep === 3 && (
                <div className="text-gray-300">
                  <div className="flex gap-4 border-b border-gray-700 pb-2 mb-2">
                    <span className="text-gray-500">Elements</span>
                    <span className="text-gray-500">Console</span>
                    <span className="text-gray-500">Sources</span>
                    <span className="text-white bg-blue-600 px-2 rounded">Application</span>
                    <span className="text-gray-500">Network</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-gray-500 border-r border-gray-700 pr-4">
                      <div>▼ Storage</div>
                      <div className="ml-2">▼ Cookies</div>
                      <div className="ml-4 text-blue-400">→ www.terabox.com</div>
                    </div>
                  </div>
                </div>
              )}
              {currentStep === 4 && (
                <div className="text-gray-300">
                  <div className="grid grid-cols-3 gap-2 text-xs border-b border-gray-700 pb-1 mb-2">
                    <span className="text-gray-500">Name</span>
                    <span className="text-gray-500">Value</span>
                    <span className="text-gray-500">Domain</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span className="text-gray-400">lang</span>
                    <span className="text-gray-400">en</span>
                    <span className="text-gray-500">.terabox.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs bg-blue-900/50 rounded p-1 mt-1">
                    <span className="text-yellow-400 font-bold">ndus</span>
                    <span className="text-green-400">Y2xvdWRf...</span>
                    <span className="text-gray-500">.terabox.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                    <span className="text-gray-400">csrfToken</span>
                    <span className="text-gray-400">abc123...</span>
                    <span className="text-gray-500">.terabox.com</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            ← Anterior
          </Button>
          
          <div className="flex gap-2">
            {currentStep < steps.length && (
              <Button 
                onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo →
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Integracoes = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [teraboxCredentials, setTeraboxCredentials] = useState({
    email: '',
    password: '',
    api_key: '',
    session_cookie: '',  // Cookie de sessão do Terabox
    folder_path: '/TVDEFleet',
    sync_enabled: true,
    sync_contratos: true,
    sync_recibos: true,
    sync_vistorias: true,
    sync_relatorios: true,
    sync_documentos: true
  });
  const [teraboxConnectionStatus, setTeraboxConnectionStatus] = useState(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchTeraboxCredentials();
    
    // Poll WhatsApp status every 5 seconds while not connected
    const interval = setInterval(() => {
      if (!whatsappStatus?.pronto) {
        fetchWhatsAppStatus();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchTeraboxCredentials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/terabox/credentials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setTeraboxCredentials(prev => ({
          ...prev,
          ...response.data,
          password: '' // Não mostrar password
        }));
      }
    } catch (error) {
      console.error('Error fetching Terabox credentials:', error);
    }
  };

  const saveTeraboxCredentials = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Só enviar password se foi alterada
      const dataToSend = { ...teraboxCredentials };
      if (!dataToSend.password) {
        delete dataToSend.password;
      }
      
      await axios.post(`${API}/terabox/credentials`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais Terabox guardadas com sucesso!');
      fetchTeraboxCredentials();
    } catch (error) {
      console.error('Error saving Terabox credentials:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar credenciais');
    } finally {
      setLoading(false);
    }
  };

  const testTeraboxConnection = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/terabox/cloud/test-connection`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTeraboxConnectionStatus(response.data);
      
      if (response.data.success) {
        toast.success('Conexão com Terabox estabelecida!');
      } else {
        toast.error(response.data.error || 'Falha na conexão');
      }
    } catch (error) {
      console.error('Error testing Terabox connection:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
      setTeraboxConnectionStatus({ success: false, error: error.response?.data?.detail });
    } finally {
      setLoading(false);
    }
  };

  const syncToTeraboxCloud = async () => {
    try {
      setSyncingCloud(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/terabox/cloud/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const detalhes = response.data.detalhes;
        toast.success(`Sincronização concluída! ${detalhes.pastas_criadas} pastas, ${detalhes.ficheiros_enviados} ficheiros`);
      } else {
        toast.error('Erro na sincronização');
      }
    } catch (error) {
      console.error('Error syncing to Terabox Cloud:', error);
      toast.error(error.response?.data?.detail || 'Erro ao sincronizar com Terabox Cloud');
    } finally {
      setSyncingCloud(false);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWhatsappStatus(response.data);
      
      // Se conectou, limpar QR code
      if (response.data.pronto) {
        setQrCode(null);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
      setWhatsappStatus({ conectado: false, pronto: false, servico_ativo: false });
    }
  };

  const fetchQrCode = async () => {
    try {
      setLoadingQr(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/whatsapp/qr`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.connected) {
        toast.success('Já está conectado ao WhatsApp!');
        setQrCode(null);
        fetchWhatsAppStatus();
      } else if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
        toast.info('Escaneie o QR Code com o WhatsApp do seu telemóvel');
      } else {
        toast.info(response.data.message || 'A inicializar... aguarde');
      }
    } catch (error) {
      console.error('Error fetching QR:', error);
      toast.error(error.response?.data?.detail || 'Erro ao obter QR Code');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleWhatsAppLogout = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Desconectado do WhatsApp');
      setWhatsappStatus({ conectado: false, pronto: false });
      setQrCode(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao desconectar');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppRestart = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/restart`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.info('A reiniciar serviço WhatsApp...');
      setWhatsappStatus({ conectado: false, pronto: false });
      setQrCode(null);
      
      // Aguardar e buscar novo QR
      setTimeout(fetchQrCode, 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao reiniciar');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/terabox/sync-documents`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const detalhes = response.data.detalhes;
      toast.success(`Sincronização concluída! ${detalhes.total_sincronizados} documentos sincronizados.`);
    } catch (error) {
      console.error('Error syncing Terabox:', error);
      toast.error(error.response?.data?.detail || 'Erro ao sincronizar documentos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-slate-600 mt-1">Configure integrações com serviços externos</p>
        </div>

        {/* WhatsApp Web Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>WhatsApp Web</CardTitle>
                  <CardDescription>Enviar relatórios e notificações via WhatsApp</CardDescription>
                </div>
              </div>
              <Badge variant={whatsappStatus?.pronto ? "default" : "secondary"} className={whatsappStatus?.pronto ? "bg-green-500" : ""}>
                {whatsappStatus?.pronto ? (
                  <><Check className="w-3 h-3 mr-1" /> Conectado</>
                ) : whatsappStatus?.servico_ativo === false ? (
                  <><X className="w-3 h-3 mr-1" /> Serviço Offline</>
                ) : (
                  <><AlertCircle className="w-3 h-3 mr-1" /> Desconectado</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Info */}
            {whatsappStatus?.pronto && whatsappStatus?.info && (
              <Alert className="bg-green-50 border-green-200">
                <Smartphone className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <p className="font-semibold">Conectado como: {whatsappStatus.info.pushname}</p>
                  <p className="text-sm">Número: {whatsappStatus.info.wid}</p>
                </AlertDescription>
              </Alert>
            )}

            {/* QR Code Section */}
            {!whatsappStatus?.pronto && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Como conectar:</p>
                    <ol className="text-sm space-y-1 ml-4 list-decimal">
                      <li>Clique em "Mostrar QR Code"</li>
                      <li>Abra o WhatsApp no seu telemóvel</li>
                      <li>Vá a Configurações → Dispositivos conectados → Conectar dispositivo</li>
                      <li>Escaneie o QR Code com a câmara do telemóvel</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {qrCode && (
                  <div className="flex flex-col items-center p-6 bg-white border rounded-lg">
                    <p className="text-sm text-slate-600 mb-4">Escaneie este QR Code com o WhatsApp:</p>
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    <p className="text-xs text-slate-500 mt-4">O QR Code expira em poucos minutos. Clique novamente se expirar.</p>
                  </div>
                )}

                <div className="flex items-center space-x-3 flex-wrap gap-2">
                  <Button 
                    onClick={fetchQrCode}
                    disabled={loadingQr}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loadingQr ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    {qrCode ? 'Atualizar QR Code' : 'Mostrar QR Code'}
                  </Button>
                  
                  <Button 
                    onClick={handleWhatsAppRestart}
                    variant="outline"
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reiniciar Serviço
                  </Button>
                </div>
              </div>
            )}

            {/* Connected Actions */}
            {whatsappStatus?.pronto && (
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <p className="font-semibold mb-2">Funcionalidades disponíveis:</p>
                    <ul className="text-sm space-y-1 ml-4 list-disc">
                      <li>Envio de relatórios semanais para motoristas</li>
                      <li>Notificações de alteração de status</li>
                      <li>Comunicação de vistorias agendadas</li>
                      <li>Envio em massa para múltiplos motoristas</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="flex items-center space-x-3 flex-wrap gap-2">
                  <Button 
                    onClick={handleWhatsAppRestart}
                    variant="outline"
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reiniciar Serviço
                  </Button>
                  
                  <Button 
                    onClick={handleWhatsAppLogout}
                    variant="outline"
                    disabled={loading}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {whatsappStatus?.erro && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{whatsappStatus.erro}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Terabox Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Terabox - Armazenamento em Cloud</CardTitle>
                  <CardDescription>Guardar documentos e fotos organizados por parceiro</CardDescription>
                </div>
              </div>
              <Badge variant="default" className={teraboxCredentials.configurado ? "bg-green-500" : "bg-yellow-500"}>
                {teraboxCredentials.configurado ? (
                  <><Check className="w-3 h-3 mr-1" /> Configurado</>
                ) : (
                  <><AlertCircle className="w-3 h-3 mr-1" /> Não Configurado</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Estrutura de pastas:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Contratos</strong> - Contratos dos motoristas</li>
                  <li><strong>Recibos</strong> - Recibos verdes organizados por semana</li>
                  <li><strong>Vistorias</strong> - Documentos de inspeção dos veículos</li>
                  <li><strong>Relatórios</strong> - PDFs de relatórios semanais</li>
                  <li><strong>Motoristas</strong> - Documentos pessoais (CC, Carta, etc.)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Credenciais Terabox */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Credenciais da sua conta Terabox</h3>
                <TeraboxGuideModal />
              </div>
              
              <div>
                <Label htmlFor="terabox-cookie">Cookie de Sessão (ndus)</Label>
                <Input
                  id="terabox-cookie"
                  type="text"
                  value={teraboxCredentials.session_cookie || ''}
                  onChange={(e) => setTeraboxCredentials({...teraboxCredentials, session_cookie: e.target.value})}
                  placeholder="Cole aqui o cookie 'ndus' do Terabox..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Não sabe como obter? Clique em "Como obter o cookie?" acima
                </p>
              </div>
              
              <div>
                <Label htmlFor="terabox-folder">Pasta de Destino</Label>
                <Input
                  id="terabox-folder"
                  type="text"
                  value={teraboxCredentials.folder_path || '/TVDEFleet'}
                  onChange={(e) => setTeraboxCredentials({...teraboxCredentials, folder_path: e.target.value})}
                  placeholder="/TVDEFleet"
                />
                <p className="text-xs text-slate-500 mt-1">Pasta raiz no Terabox onde os documentos serão guardados</p>
              </div>

              {/* Status da Conexão */}
              {teraboxConnectionStatus && (
                <Alert className={teraboxConnectionStatus.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                  <AlertCircle className={`h-4 w-4 ${teraboxConnectionStatus.success ? 'text-green-600' : 'text-red-600'}`} />
                  <AlertDescription className={teraboxConnectionStatus.success ? 'text-green-800' : 'text-red-800'}>
                    {teraboxConnectionStatus.success ? (
                      <>Conexão estabelecida com sucesso!</>
                    ) : (
                      <>{teraboxConnectionStatus.error}</>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Opções de Sincronização */}
              <h4 className="font-medium">Sincronização Automática</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sincronização Ativa</Label>
                  <p className="text-sm text-slate-500">Ativar sincronização automática de documentos</p>
                </div>
                <Switch
                  checked={teraboxCredentials.sync_enabled}
                  onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_enabled: checked})}
                />
              </div>

              {teraboxCredentials.sync_enabled && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-4 border-l-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-contratos"
                      checked={teraboxCredentials.sync_contratos}
                      onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_contratos: checked})}
                    />
                    <Label htmlFor="sync-contratos">Contratos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-recibos"
                      checked={teraboxCredentials.sync_recibos}
                      onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_recibos: checked})}
                    />
                    <Label htmlFor="sync-recibos">Recibos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-vistorias"
                      checked={teraboxCredentials.sync_vistorias}
                      onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_vistorias: checked})}
                    />
                    <Label htmlFor="sync-vistorias">Vistorias</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-relatorios"
                      checked={teraboxCredentials.sync_relatorios}
                      onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_relatorios: checked})}
                    />
                    <Label htmlFor="sync-relatorios">Relatórios</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-documentos"
                      checked={teraboxCredentials.sync_documentos}
                      onCheckedChange={(checked) => setTeraboxCredentials({...teraboxCredentials, sync_documentos: checked})}
                    />
                    <Label htmlFor="sync-documentos">Documentos</Label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-4 flex-wrap gap-2">
              <Button 
                onClick={saveTeraboxCredentials}
                disabled={loading}
              >
                Guardar Credenciais
              </Button>
              
              <Button 
                onClick={testTeraboxConnection}
                variant="outline"
                disabled={loading || !teraboxCredentials.session_cookie}
              >
                <Cloud className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Testar Conexão Cloud
              </Button>
              
              <Button 
                onClick={syncToTeraboxCloud}
                variant="outline"
                disabled={syncingCloud || !teraboxCredentials.session_cookie}
                className="bg-blue-50 hover:bg-blue-100 border-blue-200"
              >
                <FolderSync className={`w-4 h-4 mr-2 ${syncingCloud ? 'animate-spin' : ''}`} />
                {syncingCloud ? 'A sincronizar...' : 'Sincronizar Cloud'}
              </Button>
              
              <Button 
                onClick={handleSyncDocuments}
                variant="outline"
                disabled={loading}
              >
                <FolderSync className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar Local
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/terabox'}
                variant="outline"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Ficheiros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Outras Integrações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>Configurado via variáveis de ambiente</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Para configurar, aceda a Configurações do Parceiro → Email & Credenciais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Moloni</CardTitle>
              <CardDescription>Faturação automática</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Em desenvolvimento</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Integracoes;
