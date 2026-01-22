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
import { toast } from 'sonner';
import { FileText, Check, X, AlertCircle, Mail, MessageSquare, CreditCard, Cloud, RefreshCw, QrCode, LogOut, Smartphone, Eye, EyeOff, FolderSync } from 'lucide-react';

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
              <h3 className="font-semibold text-lg">Credenciais da sua conta Terabox</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="terabox-email">Email Terabox</Label>
                  <Input
                    id="terabox-email"
                    type="email"
                    value={teraboxCredentials.email || ''}
                    onChange={(e) => setTeraboxCredentials({...teraboxCredentials, email: e.target.value})}
                    placeholder="seu@email.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="terabox-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="terabox-password"
                      type={showPassword ? "text" : "password"}
                      value={teraboxCredentials.password || ''}
                      onChange={(e) => setTeraboxCredentials({...teraboxCredentials, password: e.target.value})}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Deixe em branco para manter a atual</p>
                </div>
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
                onClick={handleSyncDocuments}
                variant="outline"
                disabled={loading}
              >
                <FolderSync className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar Agora
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
