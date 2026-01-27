import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { calcularSemIva, formatarEuros } from '@/utils/iva';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Package,
  Crown,
  Star,
  Gift,
  Zap,
  Users,
  Car,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Tag,
  Calendar,
  Percent,
  Euro,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';

const AdminGestaoPlanos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('planos');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [subscricoes, setSubscricoes] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  
  // Modal states
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [showPromocaoModal, setShowPromocaoModal] = useState(false);
  const [showPrecoEspecialModal, setShowPrecoEspecialModal] = useState(false);
  
  // Form states
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [selectedModulo, setSelectedModulo] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Plano form
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    tipo_usuario: 'parceiro',
    categoria: 'standard',
    tipo_cobranca: 'fixo',
    precos: { semanal: 0, mensal: 0, anual: 0 },
    precos_plano: {
      base_semanal: 0,
      base_mensal: 0,
      base_anual: 0,
      por_veiculo_semanal: 0,
      por_veiculo_mensal: 0,
      por_veiculo_anual: 0,
      por_motorista_semanal: 0,
      por_motorista_mensal: 0,
      por_motorista_anual: 0,
      setup: 0
    },
    limites: { max_veiculos: null, max_motoristas: null },
    modulos_incluidos: [],
    icone: '📦',
    cor: '#3B82F6',
    permite_trial: false,
    dias_trial: 0,
    features_destaque: []
  });
  
  // Módulo form
  const [moduloForm, setModuloForm] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    tipo_usuario: 'parceiro',
    tipo_cobranca: 'fixo',
    precos: { semanal: 0, mensal: 0, anual: 0 },
    icone: '📦',
    cor: '#6B7280',
    funcionalidades: []
  });
  
  // Promoção form
  const [promocaoForm, setPromocaoForm] = useState({
    nome: '',
    descricao: '',
    tipo: 'normal',
    desconto_percentagem: 0,
    data_inicio: '',
    data_fim: '',
    codigo_promocional: '',
    max_utilizacoes: null
  });

  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [planosRes, modulosRes, subscricoesRes, statsRes] = await Promise.all([
        axios.get(`${API}/gestao-planos/planos?apenas_ativos=false`, { headers }),
        axios.get(`${API}/gestao-planos/modulos?apenas_ativos=false`, { headers }),
        axios.get(`${API}/gestao-planos/subscricoes`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/gestao-planos/estatisticas`, { headers }).catch(() => ({ data: null }))
      ]);
      
      setPlanos(planosRes.data || []);
      setModulos(modulosRes.data || []);
      setSubscricoes(subscricoesRes.data || []);
      setEstatisticas(statsRes.data);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const handleSavePlano = async () => {
    if (!planoForm.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      if (selectedPlano) {
        await axios.put(`${API}/gestao-planos/planos/${selectedPlano.id}`, planoForm, { headers });
        toast.success('Plano atualizado com sucesso!');
      } else {
        await axios.post(`${API}/gestao-planos/planos`, planoForm, { headers });
        toast.success('Plano criado com sucesso!');
      }
      
      setShowPlanoModal(false);
      setSelectedPlano(null);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar plano');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModulo = async () => {
    if (!moduloForm.nome || !moduloForm.codigo) {
      toast.error('Nome e código são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      if (selectedModulo) {
        await axios.put(`${API}/gestao-planos/modulos/${selectedModulo.id}`, moduloForm, { headers });
        toast.success('Módulo atualizado com sucesso!');
      } else {
        await axios.post(`${API}/gestao-planos/modulos`, moduloForm, { headers });
        toast.success('Módulo criado com sucesso!');
      }
      
      setShowModuloModal(false);
      setSelectedModulo(null);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar módulo');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPromocao = async () => {
    if (!selectedPlano || !promocaoForm.nome) {
      toast.error('Dados incompletos');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/gestao-planos/planos/${selectedPlano.id}/promocoes`,
        promocaoForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Promoção adicionada!');
      setShowPromocaoModal(false);
      setPromocaoForm({
        nome: '',
        descricao: '',
        tipo: 'normal',
        desconto_percentagem: 0,
        data_inicio: '',
        data_fim: '',
        codigo_promocional: '',
        max_utilizacoes: null
      });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar promoção');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlano = async (planoId) => {
    if (!confirm('Tem certeza que deseja desativar este plano?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/gestao-planos/planos/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano desativado');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao desativar plano');
    }
  };

  const handleDeleteModulo = async (moduloId) => {
    if (!confirm('Tem certeza que deseja desativar este módulo?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/gestao-planos/modulos/${moduloId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Módulo desativado');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao desativar módulo');
    }
  };

  const openPlanoModal = (plano = null) => {
    if (plano) {
      setSelectedPlano(plano);
      setPlanoForm({
        nome: plano.nome || '',
        descricao: plano.descricao || '',
        tipo_usuario: plano.tipo_usuario || 'parceiro',
        categoria: plano.categoria || 'standard',
        tipo_cobranca: plano.tipo_cobranca || 'fixo',
        precos: plano.precos || { semanal: 0, mensal: 0, anual: 0 },
        precos_plano: plano.precos_plano || {
          base_semanal: 0,
          base_mensal: 0,
          base_anual: 0,
          por_veiculo_semanal: 0,
          por_veiculo_mensal: 0,
          por_veiculo_anual: 0,
          por_motorista_semanal: 0,
          por_motorista_mensal: 0,
          por_motorista_anual: 0,
          setup: 0
        },
        limites: plano.limites || { max_veiculos: null, max_motoristas: null },
        modulos_incluidos: plano.modulos_incluidos || [],
        icone: plano.icone || '📦',
        cor: plano.cor || '#3B82F6',
        permite_trial: plano.permite_trial || false,
        dias_trial: plano.dias_trial || 0,
        features_destaque: plano.features_destaque || []
      });
    } else {
      setSelectedPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        tipo_usuario: 'parceiro',
        categoria: 'standard',
        tipo_cobranca: 'fixo',
        precos: { semanal: 0, mensal: 0, anual: 0 },
        precos_plano: {
          base_semanal: 0,
          base_mensal: 0,
          base_anual: 0,
          por_veiculo_semanal: 0,
          por_veiculo_mensal: 0,
          por_veiculo_anual: 0,
          por_motorista_semanal: 0,
          por_motorista_mensal: 0,
          por_motorista_anual: 0,
          setup: 0
        },
        limites: { max_veiculos: null, max_motoristas: null },
        modulos_incluidos: [],
        icone: '📦',
        cor: '#3B82F6',
        permite_trial: false,
        dias_trial: 0,
        features_destaque: []
      });
    }
    setShowPlanoModal(true);
  };

  const openModuloModal = (modulo = null) => {
    if (modulo) {
      setSelectedModulo(modulo);
      setModuloForm({
        codigo: modulo.codigo || '',
        nome: modulo.nome || '',
        descricao: modulo.descricao || '',
        tipo_usuario: modulo.tipo_usuario || 'parceiro',
        tipo_cobranca: modulo.tipo_cobranca || 'fixo',
        precos: modulo.precos || { semanal: 0, mensal: 0, anual: 0 },
        icone: modulo.icone || '📦',
        cor: modulo.cor || '#6B7280',
        funcionalidades: modulo.funcionalidades || []
      });
    } else {
      setSelectedModulo(null);
      setModuloForm({
        codigo: '',
        nome: '',
        descricao: '',
        tipo_usuario: 'parceiro',
        tipo_cobranca: 'fixo',
        precos: { semanal: 0, mensal: 0, anual: 0 },
        icone: '📦',
        cor: '#6B7280',
        funcionalidades: []
      });
    }
    setShowModuloModal(true);
  };

  const getTipoCobrancaLabel = (tipo) => {
    switch (tipo) {
      case 'por_veiculo': return 'Por Veículo';
      case 'por_motorista': return 'Por Motorista';
      case 'fixo': return 'Preço Fixo';
      default: return tipo;
    }
  };

  const getCategoriaColor = (categoria) => {
    switch (categoria) {
      case 'gratuito': return 'bg-slate-100 text-slate-700';
      case 'basico': return 'bg-blue-100 text-blue-700';
      case 'profissional': return 'bg-purple-100 text-purple-700';
      case 'enterprise': return 'bg-amber-100 text-amber-700';
      case 'premium': return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white';
      default: return 'bg-slate-100 text-slate-700';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-6 h-6" />
                Gestão de Planos e Módulos
              </h1>
              <p className="text-slate-600">Configure planos, módulos, preços e promoções</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchDados}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Planos Ativos</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticas.planos?.total || 0}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Módulos</p>
                    <p className="text-2xl font-bold text-purple-600">{estatisticas.modulos?.total || 0}</p>
                  </div>
                  <Zap className="w-8 h-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Subscrições Ativas</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticas.subscricoes?.ativas || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Em Trial</p>
                    <p className="text-2xl font-bold text-amber-600">{estatisticas.subscricoes?.trial || 0}</p>
                  </div>
                  <Gift className="w-8 h-8 text-amber-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Receita Mensal</p>
                    <p className="text-2xl font-bold text-emerald-600">€{estatisticas.receita_mensal_estimada || 0}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-emerald-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="subscricoes" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Subscrições
            </TabsTrigger>
            <TabsTrigger value="promocoes" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Promoções
            </TabsTrigger>
          </TabsList>

          {/* Tab Planos */}
          <TabsContent value="planos">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openPlanoModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planos.filter(p => p.tipo_usuario === 'parceiro').length > 0 && (
                <>
                  <div className="col-span-full">
                    <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Planos para Parceiros
                    </h3>
                  </div>
                  {planos.filter(p => p.tipo_usuario === 'parceiro').map((plano) => (
                    <Card key={plano.id} className={`relative overflow-hidden ${!plano.ativo ? 'opacity-50' : ''}`}>
                      {plano.destaque && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-2 py-1 rounded-bl">
                          <Star className="w-3 h-3 inline mr-1" />
                          Destaque
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                            style={{ backgroundColor: plano.cor + '20', color: plano.cor }}
                          >
                            {plano.icone}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{plano.nome}</CardTitle>
                            <Badge className={getCategoriaColor(plano.categoria)}>
                              {plano.categoria}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-slate-600">{plano.descricao}</p>
                        
                        <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                          <p className="text-xs text-slate-500 font-medium">Preços</p>
                          {/* Base */}
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-600 font-medium">Base:</span>
                            <span>€{plano.precos_plano?.base_mensal || plano.precos?.mensal || 0}/mês</span>
                          </div>
                          {/* Por Veículo */}
                          {(plano.precos_plano?.por_veiculo_mensal > 0 || plano.precos_plano?.por_veiculo_anual > 0) && (
                            <div className="flex items-center gap-2 text-sm">
                              <Car className="w-3 h-3 text-green-600" />
                              <span className="text-green-600 font-medium">Por Veículo:</span>
                              <span>+€{plano.precos_plano?.por_veiculo_mensal || 0}/mês</span>
                            </div>
                          )}
                          {/* Por Motorista */}
                          {(plano.precos_plano?.por_motorista_mensal > 0 || plano.precos_plano?.por_motorista_anual > 0) && (
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-3 h-3 text-purple-600" />
                              <span className="text-purple-600 font-medium">Por Motorista:</span>
                              <span>+€{plano.precos_plano?.por_motorista_mensal || 0}/mês</span>
                            </div>
                          )}
                        </div>
                        
                        {plano.limites && (plano.limites.max_veiculos || plano.limites.max_motoristas) && (
                          <div className="flex gap-4 text-sm">
                            {plano.limites.max_veiculos && (
                              <span className="flex items-center gap-1">
                                <Car className="w-4 h-4 text-slate-400" />
                                {plano.limites.max_veiculos} veículos
                              </span>
                            )}
                            {plano.limites.max_motoristas && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-slate-400" />
                                {plano.limites.max_motoristas} motoristas
                              </span>
                            )}
                          </div>
                        )}
                        
                        {plano.modulos_incluidos?.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Módulos incluídos:</p>
                            <div className="flex flex-wrap gap-1">
                              {plano.modulos_incluidos.slice(0, 3).map(m => (
                                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                              ))}
                              {plano.modulos_incluidos.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{plano.modulos_incluidos.length - 3}</Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {plano.permite_trial && (
                          <Badge className="bg-green-100 text-green-700">
                            <Gift className="w-3 h-3 mr-1" />
                            Trial {plano.dias_trial} dias
                          </Badge>
                        )}
                      </CardContent>
                      <CardFooter className="pt-0 gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openPlanoModal(plano)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedPlano(plano);
                            setShowPromocaoModal(true);
                          }}
                        >
                          <Tag className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeletePlano(plano.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </>
              )}
              
              {planos.filter(p => p.tipo_usuario === 'motorista').length > 0 && (
                <>
                  <div className="col-span-full mt-6">
                    <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Planos para Motoristas
                    </h3>
                  </div>
                  {planos.filter(p => p.tipo_usuario === 'motorista').map((plano) => (
                    <Card key={plano.id} className={`relative ${!plano.ativo ? 'opacity-50' : ''}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: plano.cor + '20', color: plano.cor }}
                          >
                            {plano.icone}
                          </div>
                          <div>
                            <CardTitle className="text-base">{plano.nome}</CardTitle>
                            <Badge variant="outline" className="text-xs">{plano.categoria}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-600 mb-2">{plano.descricao}</p>
                        <p className="font-semibold">€{plano.precos?.mensal || 0}/mês</p>
                      </CardContent>
                      <CardFooter className="pt-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => openPlanoModal(plano)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500"
                          onClick={() => handleDeletePlano(plano.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab Módulos */}
          <TabsContent value="modulos">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openModuloModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Módulo
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulos.map((modulo) => (
                <Card key={modulo.id} className={`${!modulo.ativo ? 'opacity-50' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: modulo.cor + '20' }}
                        >
                          {modulo.icone}
                        </div>
                        <div>
                          <CardTitle className="text-base">{modulo.nome}</CardTitle>
                          <p className="text-xs text-slate-500">{modulo.codigo}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {modulo.tipo_usuario === 'parceiro' ? 'Parceiro' : 'Motorista'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-600">{modulo.descricao}</p>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{getTipoCobrancaLabel(modulo.tipo_cobranca)}</Badge>
                      {modulo.brevemente && (
                        <Badge className="bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3 mr-1" />
                          Brevemente
                        </Badge>
                      )}
                    </div>
                    
                    {modulo.precos && (modulo.precos.mensal || modulo.precos.semanal) && (
                      <p className="text-sm font-semibold">
                        €{modulo.precos.mensal || modulo.precos.semanal || 0}
                        {modulo.tipo_cobranca === 'por_veiculo' ? '/veículo/mês' : '/mês'}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openModuloModal(modulo)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500"
                      onClick={() => handleDeleteModulo(modulo.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Subscrições */}
          <TabsContent value="subscricoes">
            <Card>
              <CardHeader>
                <CardTitle>Subscrições Ativas</CardTitle>
                <CardDescription>Lista de todas as subscrições de planos e módulos</CardDescription>
              </CardHeader>
              <CardContent>
                {subscricoes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma subscrição encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilizador</TableHead>
                        <TableHead>Plano/Módulos</TableHead>
                        <TableHead>Periodicidade</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Próx. Cobrança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscricoes.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                              <p className="text-xs text-slate-500">{sub.user_tipo}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sub.plano_nome || 'Módulos individuais'}
                            {sub.modulos_individuais?.length > 0 && (
                              <span className="text-xs text-slate-500 ml-1">
                                +{sub.modulos_individuais.length} módulos
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sub.periodicidade}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">€{sub.preco_final}</TableCell>
                          <TableCell>
                            <Badge className={
                              sub.status === 'ativo' ? 'bg-green-100 text-green-700' :
                              sub.status === 'trial' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {sub.proxima_cobranca ? new Date(sub.proxima_cobranca).toLocaleDateString('pt-PT') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Promoções */}
          <TabsContent value="promocoes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Promoções e Campanhas</CardTitle>
                    <CardDescription>Gerir promoções ativas em planos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {planos.filter(p => p.promocoes?.length > 0).map(plano => (
                    <div key={plano.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {plano.icone} {plano.nome}
                      </h4>
                      <div className="space-y-2">
                        {plano.promocoes.map((promo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-3">
                              <Badge className={
                                promo.tipo === 'pioneiro' ? 'bg-purple-100 text-purple-700' :
                                promo.tipo === 'lancamento' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }>
                                {promo.tipo}
                              </Badge>
                              <span className="font-medium">{promo.nome}</span>
                              {promo.desconto_percentagem > 0 && (
                                <span className="text-green-600 font-semibold">-{promo.desconto_percentagem}%</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              {promo.codigo_promocional && (
                                <Badge variant="outline">{promo.codigo_promocional}</Badge>
                              )}
                              {promo.data_fim && (
                                <span>até {new Date(promo.data_fim).toLocaleDateString('pt-PT')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {planos.filter(p => p.promocoes?.length > 0).length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Nenhuma promoção ativa</p>
                      <p className="text-sm">Adicione promoções através da edição de planos</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Plano */}
      <Dialog open={showPlanoModal} onOpenChange={setShowPlanoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={planoForm.nome}
                  onChange={(e) => setPlanoForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do plano"
                />
              </div>
              
              <div>
                <Label>Tipo de Utilizador</Label>
                <Select 
                  value={planoForm.tipo_usuario} 
                  onValueChange={(v) => setPlanoForm(prev => ({ ...prev, tipo_usuario: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Categoria</Label>
                <Select 
                  value={planoForm.categoria} 
                  onValueChange={(v) => setPlanoForm(prev => ({ ...prev, categoria: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gratuito">Gratuito</SelectItem>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={planoForm.descricao}
                  onChange={(e) => setPlanoForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do plano"
                  rows={2}
                />
              </div>
              
              <div>
                <Label>Tipo de Cobrança</Label>
                <Select 
                  value={planoForm.tipo_cobranca} 
                  onValueChange={(v) => setPlanoForm(prev => ({ ...prev, tipo_cobranca: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Preço Fixo</SelectItem>
                    <SelectItem value="por_veiculo">Por Veículo</SelectItem>
                    <SelectItem value="por_motorista">Por Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ícone</Label>
                  <Input
                    value={planoForm.icone}
                    onChange={(e) => setPlanoForm(prev => ({ ...prev, icone: e.target.value }))}
                    className="text-center text-xl"
                  />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={planoForm.cor}
                    onChange={(e) => setPlanoForm(prev => ({ ...prev, cor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            
            {/* Preços */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Euro className="w-4 h-4" />
                Preços
              </h4>
              
              {/* Preços para Parceiros - modelo base + por veículo + por motorista */}
              {planoForm.tipo_usuario === 'parceiro' ? (
                <>
                  {/* Preço Base */}
                  <div>
                    <Label className="text-sm font-medium text-blue-700 mb-2 block">Preço Base do Plano</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.base_semanal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, base_semanal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.base_mensal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, base_mensal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.base_anual || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, base_anual: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Preço por Veículo */}
                  <div className="pt-3 border-t border-slate-200">
                    <Label className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Preço por Veículo
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_veiculo_semanal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_veiculo_semanal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_veiculo_mensal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_veiculo_mensal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_veiculo_anual || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_veiculo_anual: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Preço por Motorista */}
                  <div className="pt-3 border-t border-slate-200">
                    <Label className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Preço por Motorista
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_motorista_semanal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_motorista_semanal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_motorista_mensal || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_motorista_mensal: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.por_motorista_anual || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, por_motorista_anual: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Taxa de Setup */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="w-1/3">
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">Taxa de Setup (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={planoForm.precos_plano?.setup || ''}
                        onChange={(e) => setPlanoForm(prev => ({ 
                          ...prev, 
                          precos_plano: { ...prev.precos_plano, setup: parseFloat(e.target.value) || 0 }
                        }))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Preços simples para Motoristas */
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Semanal (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planoForm.precos?.semanal || ''}
                      onChange={(e) => setPlanoForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, semanal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Mensal (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planoForm.precos?.mensal || ''}
                      onChange={(e) => setPlanoForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, mensal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Anual (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planoForm.precos?.anual || ''}
                      onChange={(e) => setPlanoForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, anual: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Limites */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold mb-3">Limites</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Máx. Veículos (vazio = ilimitado)</Label>
                  <Input
                    type="number"
                    value={planoForm.limites?.max_veiculos || ''}
                    onChange={(e) => setPlanoForm(prev => ({ 
                      ...prev, 
                      limites: { ...prev.limites, max_veiculos: e.target.value ? parseInt(e.target.value) : null }
                    }))}
                  />
                </div>
                <div>
                  <Label>Máx. Motoristas (vazio = ilimitado)</Label>
                  <Input
                    type="number"
                    value={planoForm.limites?.max_motoristas || ''}
                    onChange={(e) => setPlanoForm(prev => ({ 
                      ...prev, 
                      limites: { ...prev.limites, max_motoristas: e.target.value ? parseInt(e.target.value) : null }
                    }))}
                  />
                </div>
              </div>
            </div>
            
            {/* Módulos Incluídos */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold mb-3">Módulos Incluídos</h4>
              <div className="flex flex-wrap gap-2">
                {modulos.filter(m => m.tipo_usuario === planoForm.tipo_usuario || m.tipo_usuario === 'ambos').map(modulo => (
                  <Badge 
                    key={modulo.codigo}
                    variant={planoForm.modulos_incluidos?.includes(modulo.codigo) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = planoForm.modulos_incluidos || [];
                      if (current.includes(modulo.codigo)) {
                        setPlanoForm(prev => ({
                          ...prev,
                          modulos_incluidos: current.filter(m => m !== modulo.codigo)
                        }));
                      } else {
                        setPlanoForm(prev => ({
                          ...prev,
                          modulos_incluidos: [...current, modulo.codigo]
                        }));
                      }
                    }}
                  >
                    {modulo.icone} {modulo.nome}
                  </Badge>
                ))}
              </div>
            </div>
            
            {/* Trial */}
            <div className="flex items-center gap-4">
              <Switch
                checked={planoForm.permite_trial}
                onCheckedChange={(checked) => setPlanoForm(prev => ({ ...prev, permite_trial: checked }))}
              />
              <Label>Permitir período trial</Label>
              {planoForm.permite_trial && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20"
                    value={planoForm.dias_trial}
                    onChange={(e) => setPlanoForm(prev => ({ ...prev, dias_trial: parseInt(e.target.value) || 0 }))}
                  />
                  <span className="text-sm text-slate-600">dias</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanoModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePlano} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Módulo */}
      <Dialog open={showModuloModal} onOpenChange={setShowModuloModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedModulo ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  value={moduloForm.codigo}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, codigo: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  placeholder="codigo_modulo"
                  disabled={!!selectedModulo}
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={moduloForm.nome}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do Módulo"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={moduloForm.descricao}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={2}
                />
              </div>
              
              <div>
                <Label>Tipo de Utilizador</Label>
                <Select 
                  value={moduloForm.tipo_usuario} 
                  onValueChange={(v) => setModuloForm(prev => ({ ...prev, tipo_usuario: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Tipo de Cobrança</Label>
                <Select 
                  value={moduloForm.tipo_cobranca} 
                  onValueChange={(v) => setModuloForm(prev => ({ ...prev, tipo_cobranca: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Preço Fixo</SelectItem>
                    <SelectItem value="por_veiculo">Por Veículo</SelectItem>
                    <SelectItem value="por_motorista">Por Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Preços */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Semanal (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={moduloForm.precos?.semanal || ''}
                  onChange={(e) => setModuloForm(prev => ({ 
                    ...prev, 
                    precos: { ...prev.precos, semanal: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Mensal (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={moduloForm.precos?.mensal || ''}
                  onChange={(e) => setModuloForm(prev => ({ 
                    ...prev, 
                    precos: { ...prev.precos, mensal: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Anual (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={moduloForm.precos?.anual || ''}
                  onChange={(e) => setModuloForm(prev => ({ 
                    ...prev, 
                    precos: { ...prev.precos, anual: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <Input
                  value={moduloForm.icone}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, icone: e.target.value }))}
                  className="text-center text-xl"
                />
              </div>
              <div>
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={moduloForm.cor}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, cor: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuloModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveModulo} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Promoção */}
      <Dialog open={showPromocaoModal} onOpenChange={setShowPromocaoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Promoção</DialogTitle>
            <DialogDescription>
              Plano: {selectedPlano?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome da Promoção *</Label>
              <Input
                value={promocaoForm.nome}
                onChange={(e) => setPromocaoForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Promoção de Lançamento"
              />
            </div>
            
            <div>
              <Label>Tipo</Label>
              <Select 
                value={promocaoForm.tipo} 
                onValueChange={(v) => setPromocaoForm(prev => ({ ...prev, tipo: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="pioneiro">Pioneiro (primeiros clientes)</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                value={promocaoForm.desconto_percentagem}
                onChange={(e) => setPromocaoForm(prev => ({ ...prev, desconto_percentagem: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            
            <div>
              <Label>Código Promocional (opcional)</Label>
              <Input
                value={promocaoForm.codigo_promocional}
                onChange={(e) => setPromocaoForm(prev => ({ ...prev, codigo_promocional: e.target.value.toUpperCase() }))}
                placeholder="PROMO2025"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={promocaoForm.data_inicio}
                  onChange={(e) => setPromocaoForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={promocaoForm.data_fim}
                  onChange={(e) => setPromocaoForm(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label>Máx. Utilizações (vazio = ilimitado)</Label>
              <Input
                type="number"
                value={promocaoForm.max_utilizacoes || ''}
                onChange={(e) => setPromocaoForm(prev => ({ ...prev, max_utilizacoes: e.target.value ? parseInt(e.target.value) : null }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromocaoModal(false)}>Cancelar</Button>
            <Button onClick={handleAddPromocao} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminGestaoPlanos;
