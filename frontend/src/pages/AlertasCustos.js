import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Bell,
  Settings,
  Euro,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Fuel,
  Zap,
  MapPin,
  Shield,
  Wrench,
  Car,
  Building2,
  Save,
  RefreshCw,
  History,
  AlertCircle,
  Mail,
  Smartphone
} from 'lucide-react';

const CATEGORIAS_CUSTO = [
  { id: 'combustivel_fossil', nome: 'Combustível Fóssil', icon: Fuel, cor: 'bg-orange-500' },
  { id: 'combustivel_eletrico', nome: 'Combustível Elétrico', icon: Zap, cor: 'bg-emerald-500' },
  { id: 'via_verde', nome: 'Via Verde', icon: MapPin, cor: 'bg-green-500' },
  { id: 'portagem', nome: 'Portagens', icon: MapPin, cor: 'bg-teal-500' },
  { id: 'gps', nome: 'GPS/Tracking', icon: MapPin, cor: 'bg-blue-500' },
  { id: 'seguros', nome: 'Seguros', icon: Shield, cor: 'bg-purple-500' },
  { id: 'manutencao', nome: 'Manutenção', icon: Wrench, cor: 'bg-yellow-500' },
  { id: 'lavagem', nome: 'Lavagem', icon: Car, cor: 'bg-cyan-500' },
  { id: 'pneus', nome: 'Pneus', icon: Car, cor: 'bg-slate-500' },
  { id: 'estacionamento', nome: 'Estacionamento', icon: Car, cor: 'bg-indigo-500' },
  { id: 'outros', nome: 'Outros', icon: Building2, cor: 'bg-gray-500' },
];

const AlertasCustos = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('configurar');
  
  // Configuração
  const [config, setConfig] = useState({
    ativo: false,
    limites: {},
    periodo: 'semanal',
    notificar_email: false,
    notificar_app: true,
    percentual_aviso: 80
  });
  
  // Alertas atuais
  const [alertasAtuais, setAlertasAtuais] = useState(null);
  const [historico, setHistorico] = useState([]);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/alertas/config-limites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchAlertasAtuais = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/alertas/custos/verificar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlertasAtuais(response.data);
    } catch (error) {
      console.error('Error fetching alertas:', error);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/alertas/custos/historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(response.data);
    } catch (error) {
      console.error('Error fetching historico:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchAlertasAtuais(), fetchHistorico()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/alertas/config-limites`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuração guardada com sucesso');
      // Verificar alertas após salvar
      await fetchAlertasAtuais();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleLimiteChange = (categoriaId, valor) => {
    setConfig(prev => ({
      ...prev,
      limites: {
        ...prev.limites,
        [categoriaId]: parseFloat(valor) || 0
      }
    }));
  };

  const getCategoriaConfig = (id) => {
    return CATEGORIAS_CUSTO.find(c => c.id === id) || CATEGORIAS_CUSTO[CATEGORIAS_CUSTO.length - 1];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">A carregar...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="alertas-custos-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Alertas de Custos</h1>
              <p className="text-slate-600">Configure limites e receba alertas automáticos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={config.ativo ? 'bg-green-500' : 'bg-slate-400'}>
              {config.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
            <Button variant="outline" size="icon" onClick={() => {
              fetchAlertasAtuais();
              fetchHistorico();
            }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Alerts Summary */}
        {alertasAtuais?.alertas?.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">
                    {alertasAtuais.resumo.criticos > 0 
                      ? `${alertasAtuais.resumo.criticos} limite(s) ultrapassado(s)!`
                      : `${alertasAtuais.resumo.avisos} aviso(s) de limite`
                    }
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {alertasAtuais.alertas.map((alerta, idx) => {
                      const cat = getCategoriaConfig(alerta.categoria);
                      return (
                        <Badge 
                          key={idx}
                          variant={alerta.severidade === 'critico' ? 'destructive' : 'secondary'}
                        >
                          {cat.nome}: {alerta.percentual}%
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="configurar">
              <Settings className="w-4 h-4 mr-2" />
              Configurar Limites
            </TabsTrigger>
            <TabsTrigger value="estado">
              <TrendingUp className="w-4 h-4 mr-2" />
              Estado Atual
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab: Configurar */}
          <TabsContent value="configurar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Definições Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alertas Ativos</Label>
                      <p className="text-xs text-slate-500">Ativar sistema de alertas</p>
                    </div>
                    <Switch
                      checked={config.ativo}
                      onCheckedChange={(checked) => setConfig({...config, ativo: checked})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Período de Análise</Label>
                    <Select 
                      value={config.periodo} 
                      onValueChange={(v) => setConfig({...config, periodo: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Percentual de Aviso: {config.percentual_aviso}%</Label>
                    <Slider
                      value={[config.percentual_aviso]}
                      onValueChange={([v]) => setConfig({...config, percentual_aviso: v})}
                      min={50}
                      max={95}
                      step={5}
                    />
                    <p className="text-xs text-slate-500">
                      Receber aviso quando atingir este percentual do limite
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <Label>Notificações</Label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">Notificar na App</span>
                      </div>
                      <Switch
                        checked={config.notificar_app}
                        onCheckedChange={(checked) => setConfig({...config, notificar_app: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">Notificar por Email</span>
                      </div>
                      <Switch
                        checked={config.notificar_email}
                        onCheckedChange={(checked) => setConfig({...config, notificar_email: checked})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Limits Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Euro className="w-5 h-5" />
                    Limites por Categoria
                  </CardTitle>
                  <CardDescription>
                    Defina o valor máximo {config.periodo === 'semanal' ? 'semanal' : 'mensal'} para cada categoria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CATEGORIAS_CUSTO.map((categoria) => {
                      const Icon = categoria.icon;
                      const limite = config.limites[categoria.id] || 0;
                      return (
                        <div key={categoria.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className={`w-10 h-10 ${categoria.cor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <Label className="text-sm">{categoria.nome}</Label>
                            <div className="relative mt-1">
                              <Euro className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                type="number"
                                value={limite || ''}
                                onChange={(e) => handleLimiteChange(categoria.id, e.target.value)}
                                placeholder="0.00"
                                className="pl-8"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>A guardar...</>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Configuração
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Estado Atual */}
          <TabsContent value="estado">
            <Card>
              <CardHeader>
                <CardTitle>Estado Atual dos Custos</CardTitle>
                <CardDescription>
                  Período: {alertasAtuais?.periodo?.inicio} a {alertasAtuais?.periodo?.fim}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!config.ativo ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">Alertas de custos não estão ativos</p>
                    <Button className="mt-4" onClick={() => setActiveTab('configurar')}>
                      Configurar Agora
                    </Button>
                  </div>
                ) : alertasAtuais?.alertas?.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium text-green-700">Tudo sob controlo!</p>
                    <p className="text-slate-500 mt-2">Nenhum limite de custos ultrapassado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alertasAtuais?.alertas?.map((alerta, idx) => {
                      const cat = getCategoriaConfig(alerta.categoria);
                      const Icon = cat.icon;
                      const isCritico = alerta.severidade === 'critico';
                      
                      return (
                        <div 
                          key={idx}
                          className={`p-4 rounded-lg border ${
                            isCritico 
                              ? 'border-red-200 bg-red-50' 
                              : 'border-yellow-200 bg-yellow-50'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 ${cat.cor} rounded-lg flex items-center justify-center`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{cat.nome}</h4>
                                <Badge variant={isCritico ? 'destructive' : 'secondary'}>
                                  {isCritico ? 'Limite Ultrapassado' : 'Aviso'}
                                </Badge>
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-slate-500">Gasto Atual</p>
                                  <p className="font-bold">{formatCurrency(alerta.total_atual)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Limite</p>
                                  <p className="font-medium">{formatCurrency(alerta.limite)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">
                                    {isCritico ? 'Excesso' : 'Restante'}
                                  </p>
                                  <p className={`font-medium ${isCritico ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(isCritico ? alerta.excesso : alerta.restante)}
                                  </p>
                                </div>
                              </div>
                              {/* Progress Bar */}
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span>{alerta.percentual}% utilizado</span>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${isCritico ? 'bg-red-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${Math.min(alerta.percentual, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Alertas</CardTitle>
                <CardDescription>Últimos alertas de custos gerados</CardDescription>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">Nenhum alerta no histórico</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historico.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          item.prioridade === 'alta' ? 'bg-red-100' : 'bg-yellow-100'
                        }`}>
                          {item.prioridade === 'alta' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.titulo}</p>
                          <p className="text-sm text-slate-600 mt-1">{item.mensagem}</p>
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(item.created_at).toLocaleString('pt-PT')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AlertasCustos;
