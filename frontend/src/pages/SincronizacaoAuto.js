import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Zap, Settings, Play, Clock, CheckCircle, XCircle, 
  AlertCircle, Eye, EyeOff, RefreshCw 
} from 'lucide-react';

const SincronizacaoAuto = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [configForm, setConfigForm] = useState({
    plataforma: '',
    email: '',
    password: '',
    sincronizacao_automatica: false,
    horario_sincronizacao: '09:00',
    frequencia_dias: 7
  });

  const plataformas = [
    { id: 'uber', name: 'Uber', icon: '🚕', color: 'bg-black' },
    { id: 'bolt', name: 'Bolt', icon: '⚡', color: 'bg-green-600' },
    { id: 'via_verde', name: 'Via Verde', icon: '🛣️', color: 'bg-blue-600' },
    { id: 'combustivel', name: 'Combustível', icon: '⛽', color: 'bg-red-600' },
    { id: 'gps', name: 'GPS', icon: '📍', color: 'bg-purple-600' }
  ];

  useEffect(() => {
    fetchParceiros();
  }, []);

  useEffect(() => {
    if (selectedParceiro) {
      fetchCredenciais();
      fetchLogs();
    }
  }, [selectedParceiro]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      if (response.data.length > 0) {
        setSelectedParceiro(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchCredenciais = async () => {
    if (!selectedParceiro) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/credenciais-plataforma?parceiro_id=${selectedParceiro.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredenciais(response.data);
    } catch (error) {
      console.error('Error fetching credenciais:', error);
    }
  };

  const fetchLogs = async () => {
    if (!selectedParceiro) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/logs-sincronizacao?parceiro_id=${selectedParceiro.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleConfigureClick = (platform) => {
    const existingCred = credenciais.find(c => c.plataforma === platform.id);
    
    if (existingCred) {
      setConfigForm({
        plataforma: existingCred.plataforma,
        email: existingCred.email,
        password: '',  // Não mostrar password
        sincronizacao_automatica: existingCred.sincronizacao_automatica || false,
        horario_sincronizacao: existingCred.horario_sincronizacao || '09:00',
        frequencia_dias: existingCred.frequencia_dias || 7
      });
    } else {
      setConfigForm({
        plataforma: platform.id,
        email: '',
        password: '',
        sincronizacao_automatica: false,
        horario_sincronizacao: '09:00',
        frequencia_dias: 7
      });
    }
    
    setSelectedPlatform(platform);
    setShowConfigDialog(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    
    if (!selectedParceiro) {
      toast.error('Selecione um parceiro primeiro');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('parceiro_id', selectedParceiro.id);
      formData.append('plataforma', configForm.plataforma);
      formData.append('email', configForm.email);
      formData.append('password', configForm.password);
      formData.append('sincronizacao_automatica', configForm.sincronizacao_automatica);
      formData.append('horario_sincronizacao', configForm.horario_sincronizacao);
      formData.append('frequencia_dias', configForm.frequencia_dias);

      await axios.post(`${API}/credenciais-plataforma`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Configuração salva com sucesso!');
      setShowConfigDialog(false);
      fetchCredenciais();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar configuração');
    }
  };

  const handleSyncManual = async (plataforma) => {
    if (!selectedParceiro) {
      toast.error('Selecione um parceiro primeiro');
      return;
    }
    
    setSyncing({ ...syncing, [plataforma]: true });
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/sincronizar/${selectedParceiro.id}/${plataforma}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(`${plataforma} sincronizado com sucesso!`);
        fetchLogs();
        fetchCredenciais();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao sincronizar');
    } finally {
      setSyncing({ ...syncing, [plataforma]: false });
    }
  };

  const getPlatformCred = (platformId) => {
    return credenciais.find(c => c.plataforma === platformId);
  };

  const getPlatformLogs = (platformId) => {
    return logs.filter(l => l.plataforma === platformId).slice(0, 3);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-PT');
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            <span>Sincronização Automática</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Configure credenciais e sincronize dados automaticamente das plataformas
          </p>
        </div>

        {/* Seletor de Parceiro - Apenas para Admin/Gestao */}
        {user.role !== 'parceiro' && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <Label className="text-base font-semibold min-w-[120px]">Parceiro:</Label>
                <select
                  className="flex-1 p-2 border rounded-md"
                  value={selectedParceiro?.id || ''}
                  onChange={(e) => {
                    const parceiro = parceiros.find(p => p.id === e.target.value);
                    setSelectedParceiro(parceiro);
                  }}
                >
                  <option value="">Selecione um parceiro</option>
                  {parceiros.map((parceiro) => (
                    <option key={parceiro.id} value={parceiro.id}>
                      {parceiro.nome_empresa || parceiro.email}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard de Ganhos/Despesas - Para Parceiro */}
        {user.role === 'parceiro' && selectedParceiro && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">Dashboard de Sincronização</span>
                <Button
                  onClick={() => handleSincronizarManual()}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={syncing['manual']}
                >
                  {syncing['manual'] ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      A sincronizar...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sincronizar Agora
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Ganhos */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Total Ganhos</span>
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 text-lg">€</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">€0.00</p>
                  <p className="text-xs text-slate-500 mt-1">Esta semana</p>
                </div>

                {/* Total Despesas */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Total Despesas</span>
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 text-lg">€</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">€0.00</p>
                  <p className="text-xs text-slate-500 mt-1">Esta semana</p>
                </div>

                {/* Saldo */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Saldo</span>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-lg">€</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">€0.00</p>
                  <p className="text-xs text-slate-500 mt-1">Esta semana</p>
                </div>
              </div>

              {/* Info sobre dados semanais */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  ℹ️ Os dados são guardados semanalmente. Use o botão "Sincronizar Agora" para atualizar com os dados mais recentes das plataformas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de Plataformas */}
        {!selectedParceiro ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <p className="text-lg text-slate-600">Selecione um parceiro para configurar as sincronizações</p>
            </CardContent>
          </Card>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plataformas.map((platform) => {
            const cred = getPlatformCred(platform.id);
            const platformLogs = getPlatformLogs(platform.id);
            const isConfigured = !!cred;
            const lastSync = cred?.ultima_sincronizacao;
            const isSyncing = syncing[platform.id];

            return (
              <Card key={platform.id} className="relative">
                <CardHeader className={`${platform.color} text-white`}>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <span className="text-2xl">{platform.icon}</span>
                      <span>{platform.name}</span>
                    </span>
                    {isConfigured && (
                      <CheckCircle className="w-5 h-5" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Status */}
                  <div className="space-y-3 mb-4">
                    {isConfigured ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-medium">{cred.email}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Última Sync:</span>
                          <span className="text-xs">{lastSync ? formatDateTime(lastSync) : 'Nunca'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Auto Sync:</span>
                          <span className={`font-medium ${cred.sincronizacao_automatica ? 'text-green-600' : 'text-slate-400'}`}>
                            {cred.sincronizacao_automatica ? `✓ ${cred.horario_sincronizacao}` : '✗ Desativado'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-slate-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                        <p className="text-sm">Não configurado</p>
                      </div>
                    )}
                  </div>

                  {/* Últimos Logs */}
                  {platformLogs.length > 0 && (
                    <div className="border-t pt-3 mb-3">
                      <p className="text-xs text-slate-500 mb-2">Últimas Sincronizações:</p>
                      <div className="space-y-1">
                        {platformLogs.map((log, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{formatDateTime(log.data_inicio)}</span>
                            {log.status === 'sucesso' ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : log.status === 'erro' ? (
                              <XCircle className="w-3 h-3 text-red-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConfigureClick(platform)}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Config
                    </Button>
                    {isConfigured && (
                      <Button
                        size="sm"
                        className={`flex-1 ${platform.color}`}
                        onClick={() => handleSyncManual(platform.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 mr-1" />
                        )}
                        Sincronizar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        {/* Dialog de Configuração */}
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Configurar {selectedPlatform?.name}</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <Label>Email/Utilizador *</Label>
                <Input
                  type="text"
                  value={configForm.email}
                  onChange={(e) => setConfigForm({...configForm, email: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Password *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={configForm.password}
                    onChange={(e) => setConfigForm({...configForm, password: e.target.value})}
                    required={!configForm.plataforma}
                    placeholder={configForm.plataforma ? 'Deixe vazio para não alterar' : ''}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="auto_sync"
                    checked={configForm.sincronizacao_automatica}
                    onChange={(e) => setConfigForm({...configForm, sincronizacao_automatica: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="auto_sync" className="cursor-pointer">
                    Ativar Sincronização Automática
                  </Label>
                </div>

                {configForm.sincronizacao_automatica && (
                  <div className="grid grid-cols-2 gap-3 ml-6">
                    <div>
                      <Label className="text-xs">Horário</Label>
                      <Input
                        type="time"
                        value={configForm.horario_sincronizacao}
                        onChange={(e) => setConfigForm({...configForm, horario_sincronizacao: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">A cada (dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={configForm.frequencia_dias}
                        onChange={(e) => setConfigForm({...configForm, frequencia_dias: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfigDialog(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SincronizacaoAuto;
