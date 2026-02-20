import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  HardDrive, Cloud, CloudOff, RefreshCw, Loader2, CheckCircle, 
  XCircle, Settings, Link2, Unlink, FolderSync, Database,
  FileText, Car, Users, Receipt, ClipboardCheck, FileCheck,
  Building2, Eye
} from 'lucide-react';

const StorageConfig = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [providers, setProviders] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [connectForm, setConnectForm] = useState({ email: '', access_token: '', api_key: '' });
  
  // Admin/Gestão: partner selection
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [allConfigs, setAllConfigs] = useState([]);
  const [activeTab, setActiveTab] = useState('config');

  const isAdmin = user?.role === 'admin';
  const isGestao = user?.role === 'gestao';
  const canSelectPartner = isAdmin || isGestao;

  // Fetch list of partners for admin/gestão
  const fetchParceiros = async () => {
    if (!canSelectPartner) return;
    
    try {
      const token = localStorage.getItem('token');
      let endpoint = `${API}/parceiros`;
      
      if (isGestao) {
        endpoint = `${API}/gestores/${user.id}/parceiros`;
      }
      
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const lista = data.parceiros || data || [];
        setParceiros(lista);
      }
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  // Fetch all configs for admin view
  const fetchAllConfigs = async () => {
    if (!isAdmin) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error fetching all configs:', error);
    }
  };

  const fetchConfig = async (parceiroId = null) => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/storage-config`;
      
      // If admin/gestão selected a specific partner
      if (parceiroId && canSelectPartner) {
        url = `${API}/storage-config?parceiro_id=${parceiroId}`;
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config/sync-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchParceiros();
      await fetchAllConfigs();
      await Promise.all([fetchConfig(), fetchProviders(), fetchSyncStatus()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // When partner selection changes
  const handleParceiroChange = async (parceiroId) => {
    setSelectedParceiro(parceiroId);
    setLoading(true);
    await fetchConfig(parceiroId);
    await fetchProviders();
    await fetchSyncStatus();
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success('Configuração guardada com sucesso');
        fetchConfig(selectedParceiro);
        fetchAllConfigs();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao guardar configuração');
      }
    } catch (error) {
      toast.error('Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectProvider = async () => {
    if (!selectedProvider) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // For OAuth providers, get the auth URL
      if (['google_drive', 'onedrive', 'dropbox'].includes(selectedProvider.id)) {
        const response = await fetch(`${API}/storage-config/oauth/${selectedProvider.id}/url`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authorization_url) {
            window.open(data.authorization_url, '_blank', 'width=600,height=700');
            toast.info('Complete a autenticação na janela que abriu');
            setShowConnectModal(false);
            return;
          }
        }
      }
      
      // For Terabox or manual connection
      const response = await fetch(`${API}/storage-config/connect/${selectedProvider.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider.id,
          email: connectForm.email,
          access_token: connectForm.access_token,
          api_key: connectForm.api_key
        })
      });
      
      if (response.ok) {
        toast.success(`${selectedProvider.nome} conectado com sucesso`);
        setShowConnectModal(false);
        setConnectForm({ email: '', access_token: '', api_key: '' });
        fetchProviders();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao conectar');
      }
    } catch (error) {
      toast.error('Erro ao conectar serviço');
    }
  };

  const handleDisconnectProvider = async (providerId) => {
    if (!confirm('Tem certeza que quer desconectar este serviço?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config/disconnect/${providerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Serviço desconectado');
        fetchProviders();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao desconectar');
      }
    } catch (error) {
      toast.error('Erro ao desconectar serviço');
    }
  };

  const handleTriggerSync = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/storage-config/sync-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchSyncStatus();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erro ao sincronizar');
      }
    } catch (error) {
      toast.error('Erro ao iniciar sincronização');
    }
  };

  const getProviderIcon = (providerId) => {
    switch (providerId) {
      case 'terabox': return '📦';
      case 'google_drive': return '🔵';
      case 'onedrive': return '☁️';
      case 'dropbox': return '📁';
      default: return '☁️';
    }
  };

  const getModeLabel = (modo) => {
    switch (modo) {
      case 'local': return 'Local';
      case 'cloud': return 'Cloud';
      case 'both': return 'Ambos';
      default: return modo || 'Local';
    }
  };

  const getModeColor = (modo) => {
    switch (modo) {
      case 'local': return 'bg-slate-100 text-slate-800';
      case 'cloud': return 'bg-green-100 text-green-800';
      case 'both': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
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
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              Armazenamento de Documentos
            </h1>
            <p className="text-slate-600">Configure onde os documentos são guardados</p>
          </div>
          
          {/* Partner Selector for Admin/Gestão */}
          {canSelectPartner && parceiros.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              <Select
                value={selectedParceiro || ''}
                onValueChange={handleParceiroChange}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione um parceiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Minha Configuração --</SelectItem>
                  {parceiros.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.empresa || p.name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Admin: Tabs for Overview vs Config */}
        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuração
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Visão Geral
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Todos os Parceiros</CardTitle>
                  <CardDescription>
                    Veja como cada parceiro tem configurado o armazenamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parceiro</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Cloud</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allConfigs.map((cfg, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {cfg.parceiro_nome || '-'}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {cfg.parceiro_email || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getModeColor(cfg.modo)}>
                              {getModeLabel(cfg.modo)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {cfg.cloud_provider && cfg.cloud_provider !== 'none' ? (
                              <span className="flex items-center gap-1">
                                {getProviderIcon(cfg.cloud_provider)}
                                {cfg.cloud_provider}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {cfg.cloud_connected ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Conectado
                              </Badge>
                            ) : cfg.modo !== 'local' ? (
                              <Badge variant="outline">
                                <CloudOff className="w-3 h-3 mr-1" />
                                Não conectado
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedParceiro(cfg.parceiro_id);
                                setActiveTab('config');
                                handleParceiroChange(cfg.parceiro_id);
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {allConfigs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                            Nenhuma configuração encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config">
              {renderConfigSection()}
            </TabsContent>
          </Tabs>
        ) : (
          renderConfigSection()
        )}
      </div>
    </Layout>
  );

  function renderConfigSection() {
    return (
      <>
        {selectedParceiro && canSelectPartner && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Building2 className="w-4 h-4" />
                <span>A configurar para: <strong>{parceiros.find(p => p.id === selectedParceiro)?.empresa || parceiros.find(p => p.id === selectedParceiro)?.name || 'Parceiro'}</strong></span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Storage Mode Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Modo de Armazenamento
            </CardTitle>
            <CardDescription>
              Escolha onde os documentos são guardados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={config?.modo || 'local'}
              onValueChange={(value) => setConfig({ ...config, modo: value })}
              className="space-y-4"
            >
              <div className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-colors ${
                config?.modo === 'local' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}>
                <RadioGroupItem value="local" id="local" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="local" className="flex items-center gap-2 cursor-pointer">
                    <HardDrive className="w-5 h-5 text-slate-600" />
                    <span className="font-medium">Local (Servidor)</span>
                  </Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Documentos ficam apenas no servidor. Opção padrão, não requer configuração adicional.
                  </p>
                </div>
              </div>

              <div className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-colors ${
                config?.modo === 'cloud' ? 'border-green-500 bg-green-50' : 'border-slate-200'
              }`}>
                <RadioGroupItem value="cloud" id="cloud" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="cloud" className="flex items-center gap-2 cursor-pointer">
                    <Cloud className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Cloud (Apenas)</span>
                    <Badge className="bg-green-100 text-green-800">Recomendado</Badge>
                  </Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Documentos vão diretamente para o seu cloud. Servidor leve, você controla os ficheiros.
                  </p>
                </div>
              </div>

              <div className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-colors ${
                config?.modo === 'both' ? 'border-purple-500 bg-purple-50' : 'border-slate-200'
              }`}>
                <RadioGroupItem value="both" id="both" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                    <FolderSync className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Ambos (Backup)</span>
                  </Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Documentos ficam no servidor E são sincronizados para o seu cloud como backup.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Cloud Providers */}
        {(config?.modo === 'cloud' || config?.modo === 'both') && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Serviço de Cloud
              </CardTitle>
              <CardDescription>
                Conecte a sua conta de armazenamento cloud
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => (
                  <div
                    key={provider.id}
                    className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                      config?.cloud_provider === provider.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => {
                      if (provider.connected) {
                        setConfig({ ...config, cloud_provider: provider.id });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getProviderIcon(provider.id)}</span>
                        <span className="font-medium">{provider.nome}</span>
                      </div>
                      {provider.connected ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <CloudOff className="w-3 h-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{provider.descricao}</p>
                    {provider.connected ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{provider.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnectProvider(provider.id);
                          }}
                        >
                          <Unlink className="w-4 h-4 mr-1" />
                          Desconectar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProvider(provider);
                          setShowConnectModal(true);
                        }}
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Conectar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Settings */}
        {(config?.modo === 'cloud' || config?.modo === 'both') && config?.cloud_provider && config?.cloud_provider !== 'none' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Tipos de Documentos a Sincronizar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Relatórios Semanais</span>
                  </div>
                  <Switch
                    checked={config?.sync_relatorios}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_relatorios: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <span>Recibos</span>
                  </div>
                  <Switch
                    checked={config?.sync_recibos}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_recibos: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-orange-600" />
                    <span>Vistorias</span>
                  </div>
                  <Switch
                    checked={config?.sync_vistorias}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_vistorias: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-purple-600" />
                    <span>Documentos Veículos</span>
                  </div>
                  <Switch
                    checked={config?.sync_documentos_veiculos}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_documentos_veiculos: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-600" />
                    <span>Documentos Motoristas</span>
                  </div>
                  <Switch
                    checked={config?.sync_documentos_motoristas}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_documentos_motoristas: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                    <span>Contratos</span>
                  </div>
                  <Switch
                    checked={config?.sync_contratos}
                    onCheckedChange={(checked) => setConfig({ ...config, sync_contratos: checked })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label>Pasta Raiz no Cloud</Label>
                <Input
                  value={config?.pasta_raiz || '/TVDEFleet'}
                  onChange={(e) => setConfig({ ...config, pasta_raiz: e.target.value })}
                  placeholder="/TVDEFleet"
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Os documentos serão organizados em subpastas dentro desta pasta
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Status */}
        {syncStatus && (config?.modo === 'cloud' || config?.modo === 'both') && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Estado da Sincronização
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleTriggerSync}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Agora
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{syncStatus.pending_files || 0}</p>
                  <p className="text-sm text-slate-600">Pendentes</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{syncStatus.last_sync_files || 0}</p>
                  <p className="text-sm text-slate-600">Última Sync</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{syncStatus.failed_last_24h || 0}</p>
                  <p className="text-sm text-slate-600">Erros (24h)</p>
                </div>
              </div>
              {syncStatus.last_sync && (
                <p className="text-xs text-slate-500 text-center mt-4">
                  Última sincronização: {new Date(syncStatus.last_sync).toLocaleString('pt-PT')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveConfig} disabled={saving} className="px-8">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar Configuração
          </Button>
        </div>

        {/* Connect Provider Modal */}
        <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProvider && getProviderIcon(selectedProvider.id)}
                Conectar {selectedProvider?.nome}
              </DialogTitle>
              <DialogDescription>
                {selectedProvider?.id === 'terabox' 
                  ? 'Introduza as credenciais da sua conta Terabox'
                  : 'Será redirecionado para autorizar o acesso'}
              </DialogDescription>
            </DialogHeader>
            
            {selectedProvider?.id === 'terabox' ? (
              <div className="space-y-4">
                <div>
                  <Label>Email Terabox</Label>
                  <Input
                    value={connectForm.email}
                    onChange={(e) => setConnectForm({ ...connectForm, email: e.target.value })}
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <Label>API Key ou Token de Sessão</Label>
                  <Input
                    value={connectForm.access_token}
                    onChange={(e) => setConnectForm({ ...connectForm, access_token: e.target.value })}
                    placeholder="Token de acesso"
                    type="password"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Obtenha o token nas definições da sua conta Terabox
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Cloud className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                <p className="text-slate-600">
                  Clique em "Conectar" para ser redirecionado para {selectedProvider?.nome} 
                  e autorizar o acesso aos seus ficheiros.
                </p>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConnectModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConnectProvider}>
                <Link2 className="w-4 h-4 mr-2" />
                Conectar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
};

export default StorageConfig;
