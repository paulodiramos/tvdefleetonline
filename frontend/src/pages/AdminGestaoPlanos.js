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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Sparkles,
  FileText,
  CreditCard,
  Folder,
  DollarSign
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
  const [categorias, setCategorias] = useState([]);
  
  // Modal states
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [showPromocaoModal, setShowPromocaoModal] = useState(false);
  const [showPrecoEspecialModal, setShowPrecoEspecialModal] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showPrecoFixoModal, setShowPrecoFixoModal] = useState(false);
  
  // Form states
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [selectedModulo, setSelectedModulo] = useState(null);
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Categoria form
  const [categoriaForm, setCategoriaForm] = useState({
    nome: '',
    descricao: '',
    icone: '📁',
    cor: '#3B82F6',
    ordem: 0
  });
  
  // Preço fixo form
  const [precoFixoForm, setPrecoFixoForm] = useState({
    user_id: '',
    preco_fixo: 0,
    motivo: ''
  });
  
  // Plano form
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    tipo_usuario: 'parceiro',
    categoria: 'standard',
    categoria_id: '',
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
      setup: 0,
      renovacao_semanal: 0,
      renovacao_mensal: 0,
      renovacao_anual: 0
    },
    limites: { max_veiculos: null, max_motoristas: null },
    modulos_incluidos: [],
    icone: '📦',
    cor: '#3B82F6',
    permite_trial: false,
    dias_trial: 0,
    features_destaque: [],
    taxa_iva: 23,
    referencia_faturacao: '',
    trial_config: {
      ativo: false,
      dias: 14,
      requer_cartao: false,
      automatico: false
    }
  });

  // Funções de cálculo de preços interligados (bidirecional)
  const calcularPrecosBase = (campo, valor) => {
    const v = parseFloat(valor) || 0;
    let semanal, mensal, anual;
    
    switch(campo) {
      case 'semanal':
        semanal = v;
        mensal = Math.round(v * 4 * 100) / 100;
        anual = Math.round(v * 52 * 100) / 100;
        break;
      case 'mensal':
        mensal = v;
        semanal = Math.round(v / 4 * 100) / 100;
        anual = Math.round(v * 12 * 100) / 100;
        break;
      case 'anual':
        anual = v;
        mensal = Math.round(v / 12 * 100) / 100;
        semanal = Math.round(v / 52 * 100) / 100;
        break;
      default:
        return {};
    }
    
    return { base_semanal: semanal, base_mensal: mensal, base_anual: anual };
  };

  const calcularPrecosVeiculo = (campo, valor) => {
    const v = parseFloat(valor) || 0;
    let semanal, mensal, anual;
    
    switch(campo) {
      case 'semanal':
        semanal = v;
        mensal = Math.round(v * 4 * 100) / 100;
        anual = Math.round(v * 52 * 100) / 100;
        break;
      case 'mensal':
        mensal = v;
        semanal = Math.round(v / 4 * 100) / 100;
        anual = Math.round(v * 12 * 100) / 100;
        break;
      case 'anual':
        anual = v;
        mensal = Math.round(v / 12 * 100) / 100;
        semanal = Math.round(v / 52 * 100) / 100;
        break;
      default:
        return {};
    }
    
    return { por_veiculo_semanal: semanal, por_veiculo_mensal: mensal, por_veiculo_anual: anual };
  };

  const calcularPrecosMotorista = (campo, valor) => {
    const v = parseFloat(valor) || 0;
    let semanal, mensal, anual;
    
    switch(campo) {
      case 'semanal':
        semanal = v;
        mensal = Math.round(v * 4 * 100) / 100;
        anual = Math.round(v * 52 * 100) / 100;
        break;
      case 'mensal':
        mensal = v;
        semanal = Math.round(v / 4 * 100) / 100;
        anual = Math.round(v * 12 * 100) / 100;
        break;
      case 'anual':
        anual = v;
        mensal = Math.round(v / 12 * 100) / 100;
        semanal = Math.round(v / 52 * 100) / 100;
        break;
      default:
        return {};
    }
    
    return { por_motorista_semanal: semanal, por_motorista_mensal: mensal, por_motorista_anual: anual };
  };

  const calcularPrecosSimples = (campo, valor) => {
    const v = parseFloat(valor) || 0;
    let semanal, mensal, anual;
    
    switch(campo) {
      case 'semanal':
        semanal = v;
        mensal = Math.round(v * 4 * 100) / 100;
        anual = Math.round(v * 52 * 100) / 100;
        break;
      case 'mensal':
        mensal = v;
        semanal = Math.round(v / 4 * 100) / 100;
        anual = Math.round(v * 12 * 100) / 100;
        break;
      case 'anual':
        anual = v;
        mensal = Math.round(v / 12 * 100) / 100;
        semanal = Math.round(v / 52 * 100) / 100;
        break;
      default:
        return {};
    }
    
    return { semanal, mensal, anual };
  };
  
  // Configurações globais
  const [configIva, setConfigIva] = useState(23);
  
  // Oferta de plano gratuito form
  const [ofertaForm, setOfertaForm] = useState({
    user_id: '',
    user_tipo: 'parceiro',
    plano_id: '',
    dias_gratis: 30,
    motivo: ''
  });
  
  // Módulo form
  const [moduloForm, setModuloForm] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    tipo_usuario: 'parceiro',
    tipo_cobranca: 'fixo',
    precos: { 
      semanal: 0, 
      mensal: 0, 
      anual: 0,
      por_veiculo_semanal: 0,
      por_veiculo_mensal: 0,
      por_veiculo_anual: 0,
      por_motorista_semanal: 0,
      por_motorista_mensal: 0,
      por_motorista_anual: 0
    },
    icone: '📦',
    cor: '#6B7280',
    funcionalidades: [],
    destaque: false
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
  
  // Desconto form
  const [descontoForm, setDescontoForm] = useState({
    parceiro_id: '',
    percentagem: 0,
    motivo: '',
    data_inicio: '',
    data_fim: ''
  });

  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [planosRes, modulosRes, subscricoesRes, statsRes, categoriasRes] = await Promise.all([
        axios.get(`${API}/gestao-planos/planos?apenas_ativos=false`, { headers }),
        axios.get(`${API}/gestao-planos/modulos?apenas_ativos=false`, { headers }),
        axios.get(`${API}/gestao-planos/subscricoes`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/gestao-planos/estatisticas`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/gestao-planos/categorias?apenas_ativas=false`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setPlanos(planosRes.data || []);
      setModulos(modulosRes.data || []);
      setSubscricoes(subscricoesRes.data || []);
      setEstatisticas(statsRes.data);
      setCategorias(categoriasRes.data || []);
      
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

  // ==================== CATEGORIAS ====================
  
  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gestao-planos/categorias?apenas_ativas=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategorias(response.data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleSaveCategoria = async () => {
    if (!categoriaForm.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      if (selectedCategoria) {
        await axios.put(`${API}/gestao-planos/categorias/${selectedCategoria.id}`, categoriaForm, { headers });
        toast.success('Categoria atualizada!');
      } else {
        await axios.post(`${API}/gestao-planos/categorias`, categoriaForm, { headers });
        toast.success('Categoria criada!');
      }
      
      setShowCategoriaModal(false);
      setSelectedCategoria(null);
      setCategoriaForm({ nome: '', descricao: '', icone: '📁', cor: '#3B82F6', ordem: 0 });
      fetchCategorias();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategoria = async (categoriaId) => {
    if (!confirm('Tem certeza que deseja eliminar esta categoria?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/gestao-planos/categorias/${categoriaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Categoria eliminada!');
      fetchCategorias();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao eliminar categoria');
    }
  };

  const openCategoriaModal = (categoria = null) => {
    if (categoria) {
      setSelectedCategoria(categoria);
      setCategoriaForm({
        nome: categoria.nome || '',
        descricao: categoria.descricao || '',
        icone: categoria.icone || '📁',
        cor: categoria.cor || '#3B82F6',
        ordem: categoria.ordem || 0
      });
    } else {
      setSelectedCategoria(null);
      setCategoriaForm({ nome: '', descricao: '', icone: '📁', cor: '#3B82F6', ordem: 0 });
    }
    setShowCategoriaModal(true);
  };

  // ==================== PREÇO FIXO ====================
  
  const handleSavePrecoFixo = async () => {
    if (!precoFixoForm.user_id || precoFixoForm.preco_fixo < 0) {
      toast.error('Selecione um utilizador e defina um preço válido');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gestao-planos/subscricoes/preco-fixo`, precoFixoForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Preço fixo definido com sucesso!');
      setShowPrecoFixoModal(false);
      setPrecoFixoForm({ user_id: '', preco_fixo: 0, motivo: '' });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao definir preço fixo');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePrecoFixo = async (userId) => {
    if (!confirm('Remover preço fixo e restaurar cálculo normal?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/gestao-planos/subscricoes/user/${userId}/preco-fixo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Preço fixo removido!');
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao remover preço fixo');
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
          setup: 0,
          renovacao_semanal: 0,
          renovacao_mensal: 0,
          renovacao_anual: 0
        },
        limites: plano.limites || { max_veiculos: null, max_motoristas: null },
        modulos_incluidos: plano.modulos_incluidos || [],
        icone: plano.icone || '📦',
        cor: plano.cor || '#3B82F6',
        permite_trial: plano.permite_trial || false,
        dias_trial: plano.dias_trial || 0,
        features_destaque: plano.features_destaque || [],
        taxa_iva: plano.taxa_iva || 23,
        referencia_faturacao: plano.referencia_faturacao || '',
        trial_config: plano.trial_config || {
          ativo: false,
          dias: 14,
          requer_cartao: false,
          automatico: false
        }
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
          setup: 0,
          renovacao_semanal: 0,
          renovacao_mensal: 0,
          renovacao_anual: 0
        },
        limites: { max_veiculos: null, max_motoristas: null },
        modulos_incluidos: [],
        icone: '📦',
        cor: '#3B82F6',
        permite_trial: false,
        dias_trial: 0,
        features_destaque: [],
        taxa_iva: 23,
        referencia_faturacao: '',
        trial_config: {
          ativo: false,
          dias: 14,
          requer_cartao: false,
          automatico: false
        }
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
        precos: modulo.precos || { 
          semanal: 0, 
          mensal: 0, 
          anual: 0,
          por_veiculo_semanal: 0,
          por_veiculo_mensal: 0,
          por_veiculo_anual: 0,
          por_motorista_semanal: 0,
          por_motorista_mensal: 0,
          por_motorista_anual: 0
        },
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
        precos: { 
          semanal: 0, 
          mensal: 0, 
          anual: 0,
          por_veiculo_semanal: 0,
          por_veiculo_mensal: 0,
          por_veiculo_anual: 0,
          por_motorista_semanal: 0,
          por_motorista_mensal: 0,
          por_motorista_anual: 0
        },
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
      case 'por_veiculo_motorista': return 'Por Veículo + Motorista';
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
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="subscricoes" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Subscrições
            </TabsTrigger>
            <TabsTrigger value="descontos" className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Descontos
            </TabsTrigger>
            <TabsTrigger value="promocoes" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Promoções
            </TabsTrigger>
            <TabsTrigger value="precos-especiais" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Preços Especiais
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
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-500 font-medium">Preços</p>
                          </div>
                          {/* Base */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-600 font-medium">Base:</span>
                            <div className="text-right">
                              <div className="font-semibold">€{formatarEuros(plano.precos_plano?.base_mensal || plano.precos?.mensal || 0)}/mês</div>
                              <div className="text-[10px] text-slate-400">€{formatarEuros(calcularSemIva(plano.precos_plano?.base_mensal || plano.precos?.mensal || 0))} s/IVA</div>
                            </div>
                          </div>
                          {/* Por Veículo */}
                          {(plano.precos_plano?.por_veiculo_mensal > 0 || plano.precos_plano?.por_veiculo_anual > 0) && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <Car className="w-3 h-3 text-green-600" />
                                <span className="text-green-600 font-medium">Por Veículo:</span>
                              </span>
                              <div className="text-right">
                                <div className="font-semibold">+€{formatarEuros(plano.precos_plano?.por_veiculo_mensal || 0)}/mês</div>
                                <div className="text-[10px] text-slate-400">€{formatarEuros(calcularSemIva(plano.precos_plano?.por_veiculo_mensal || 0))} s/IVA</div>
                              </div>
                            </div>
                          )}
                          {/* Por Motorista */}
                          {(plano.precos_plano?.por_motorista_mensal > 0 || plano.precos_plano?.por_motorista_anual > 0) && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-purple-600" />
                                <span className="text-purple-600 font-medium">Por Motorista:</span>
                              </span>
                              <div className="text-right">
                                <div className="font-semibold">+€{formatarEuros(plano.precos_plano?.por_motorista_mensal || 0)}/mês</div>
                                <div className="text-[10px] text-slate-400">€{formatarEuros(calcularSemIva(plano.precos_plano?.por_motorista_mensal || 0))} s/IVA</div>
                              </div>
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

          {/* Tab Categorias */}
          <TabsContent value="categorias">
            {/* Dashboard Resumo de Categorias */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Total Categorias</p>
                      <p className="text-2xl font-bold text-blue-700">{categorias.length}</p>
                    </div>
                    <Folder className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600 font-medium">Categorias Ativas</p>
                      <p className="text-2xl font-bold text-green-700">{categorias.filter(c => c.ativo).length}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Total Planos</p>
                      <p className="text-2xl font-bold text-purple-700">{planos.length}</p>
                    </div>
                    <Crown className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-600 font-medium">Sem Categoria</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {planos.filter(p => !p.categoria_id && !categorias.some(c => c.nome?.toLowerCase() === p.categoria?.toLowerCase())).length}
                      </p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribuição por Categoria */}
            {categorias.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Distribuição de Planos por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categorias.filter(c => c.ativo).map(categoria => {
                      const planosNaCategoria = planos.filter(p => 
                        p.categoria_id === categoria.id || 
                        p.categoria?.toLowerCase() === categoria.nome?.toLowerCase()
                      ).length;
                      const percentagem = planos.length > 0 ? (planosNaCategoria / planos.length) * 100 : 0;
                      
                      return (
                        <div key={`dist-${categoria.id}`} className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: categoria.cor + '20' }}
                          >
                            {categoria.icone}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{categoria.nome}</span>
                              <span className="text-xs text-slate-500">{planosNaCategoria} plano(s)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${percentagem}%`, 
                                  backgroundColor: categoria.cor 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-slate-700">Gerir Categorias</h3>
              <Button onClick={() => openCategoriaModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Categoria
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorias.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-500">
                  <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma categoria criada</p>
                  <p className="text-sm">Crie categorias para organizar os planos</p>
                </div>
              ) : (
                categorias.map((categoria) => (
                  <Card key={categoria.id} className={`${!categoria.ativo ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: categoria.cor + '20' }}
                          >
                            {categoria.icone}
                          </div>
                          <div>
                            <CardTitle className="text-base">{categoria.nome}</CardTitle>
                            {categoria.descricao && (
                              <CardDescription className="text-xs mt-1 line-clamp-2">
                                {categoria.descricao}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openCategoriaModal(categoria)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteCategoria(categoria.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Ordem: {categoria.ordem}</span>
                        <Badge variant={categoria.ativo ? 'success' : 'secondary'} className="text-xs">
                          {categoria.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-400">Cor:</span>
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: categoria.cor }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Tab Módulos */}
          <TabsContent value="modulos">
            {/* Dashboard Resumo de Módulos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-indigo-600 font-medium">Total Módulos</p>
                      <p className="text-2xl font-bold text-indigo-700">{modulos.length}</p>
                    </div>
                    <Zap className="w-8 h-8 text-indigo-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">Ativos</p>
                      <p className="text-2xl font-bold text-emerald-700">{modulos.filter(m => m.ativo).length}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-600 font-medium">Em Destaque</p>
                      <p className="text-2xl font-bold text-amber-700">{modulos.filter(m => m.destaque).length}</p>
                    </div>
                    <Star className="w-8 h-8 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-rose-600 font-medium">Tipos de Cobrança</p>
                      <p className="text-2xl font-bold text-rose-700">
                        {new Set(modulos.map(m => m.tipo_cobranca)).size}
                      </p>
                    </div>
                    <Euro className="w-8 h-8 text-rose-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros por Tipo de Cobrança */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">Todos ({modulos.length})</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-green-100 text-green-700">
                Fixo ({modulos.filter(m => m.tipo_cobranca === 'fixo').length})
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-blue-100 text-blue-700">
                Por Veículo ({modulos.filter(m => m.tipo_cobranca === 'por_veiculo').length})
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-purple-100 text-purple-700">
                Por Motorista ({modulos.filter(m => m.tipo_cobranca === 'por_motorista').length})
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-pink-100 text-pink-700">
                Combinado ({modulos.filter(m => m.tipo_cobranca === 'por_veiculo_motorista').length})
              </Badge>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-slate-700">Gerir Módulos</h3>
              <Button onClick={() => openModuloModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Módulo
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulos.map((modulo) => (
                <Card key={modulo.id} className={`${!modulo.ativo ? 'opacity-50' : ''} ${modulo.destaque ? 'ring-2 ring-amber-300' : ''}`}>
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
                    <p className="text-sm text-slate-600 line-clamp-2">{modulo.descricao}</p>
                    
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant="secondary">{getTipoCobrancaLabel(modulo.tipo_cobranca)}</Badge>
                      {modulo.destaque && (
                        <Badge className="bg-amber-100 text-amber-700">
                          <Star className="w-3 h-3 mr-1" />
                          Destaque
                        </Badge>
                      )}
                      {modulo.brevemente && (
                        <Badge className="bg-slate-100 text-slate-700">
                          <Clock className="w-3 h-3 mr-1" />
                          Brevemente
                        </Badge>
                      )}
                    </div>
                    
                    {modulo.precos && (
                      <div className="p-2 bg-slate-50 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500">Base mensal:</span>
                          <div className="text-right">
                            <div className="font-semibold">€{formatarEuros(modulo.precos.mensal || 0)}</div>
                            <div className="text-[10px] text-slate-400">€{formatarEuros(calcularSemIva(modulo.precos.mensal || 0))} s/IVA</div>
                          </div>
                        </div>
                        {modulo.tipo_cobranca === 'por_veiculo' && modulo.precos.por_veiculo_mensal > 0 && (
                          <div className="flex justify-between items-start text-green-700">
                            <span>Por veículo:</span>
                            <div className="text-right">
                              <div className="font-semibold">+€{formatarEuros(modulo.precos.por_veiculo_mensal)}</div>
                              <div className="text-[10px] text-green-500">€{formatarEuros(calcularSemIva(modulo.precos.por_veiculo_mensal))} s/IVA</div>
                            </div>
                          </div>
                        )}
                        {modulo.tipo_cobranca === 'por_motorista' && modulo.precos.por_motorista_mensal > 0 && (
                          <div className="flex justify-between items-start text-purple-700">
                            <span>Por motorista:</span>
                            <div className="text-right">
                              <div className="font-semibold">+€{formatarEuros(modulo.precos.por_motorista_mensal)}</div>
                              <div className="text-[10px] text-purple-500">€{formatarEuros(calcularSemIva(modulo.precos.por_motorista_mensal))} s/IVA</div>
                            </div>
                          </div>
                        )}
                        {modulo.tipo_cobranca === 'por_veiculo_motorista' && (
                          <>
                            {modulo.precos.por_veiculo_mensal > 0 && (
                              <div className="flex justify-between items-start text-green-700">
                                <span>Por veículo:</span>
                                <div className="text-right">
                                  <div className="font-semibold">+€{formatarEuros(modulo.precos.por_veiculo_mensal)}</div>
                                  <div className="text-[10px] text-green-500">€{formatarEuros(calcularSemIva(modulo.precos.por_veiculo_mensal))} s/IVA</div>
                                </div>
                              </div>
                            )}
                            {modulo.precos.por_motorista_mensal > 0 && (
                              <div className="flex justify-between items-start text-purple-700">
                                <span>Por motorista:</span>
                                <div className="text-right">
                                  <div className="font-semibold">+€{formatarEuros(modulo.precos.por_motorista_mensal)}</div>
                                  <div className="text-[10px] text-purple-500">€{formatarEuros(calcularSemIva(modulo.precos.por_motorista_mensal))} s/IVA</div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    
                    {modulo.funcionalidades && modulo.funcionalidades.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {modulo.funcionalidades.slice(0, 3).map((func, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {func.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {modulo.funcionalidades.length > 3 && (
                          <Badge variant="outline" className="text-xs text-slate-400">
                            +{modulo.funcionalidades.length - 3}
                          </Badge>
                        )}
                      </div>
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

          {/* Tab Descontos */}
          <TabsContent value="descontos">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      Descontos e Preços Especiais
                    </CardTitle>
                    <CardDescription>Gerir descontos percentuais e preços fixos para parceiros</CardDescription>
                  </div>
                  <Button onClick={() => setShowPrecoFixoModal(true)} className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Definir Preço Fixo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Preços Fixos Ativos */}
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    Preços Fixos Ativos
                  </h4>
                  <div className="space-y-2">
                    {subscricoes.filter(s => s.preco_fixo?.ativo).length > 0 ? (
                      subscricoes.filter(s => s.preco_fixo?.ativo).map(sub => (
                        <div key={`fixo-${sub.id}`} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                              <p className="text-sm text-slate-500">{sub.plano_nome}</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700">
                              Preço Fixo
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">€{sub.preco_fixo.valor}</p>
                              <p className="text-xs text-slate-500">{sub.preco_fixo.motivo || 'Sem motivo'}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleRemovePrecoFixo(sub.user_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 py-2">Nenhum preço fixo definido</p>
                    )}
                  </div>
                </div>
                
                {/* Descontos Percentuais Ativos */}
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Descontos Percentuais Ativos
                  </h4>
                  <div className="space-y-2">
                    {subscricoes.filter(s => s.desconto_especial?.ativo).length > 0 ? (
                      subscricoes.filter(s => s.desconto_especial?.ativo).map(sub => (
                        <div key={`desc-${sub.id}`} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{sub.user_nome || sub.user_id}</p>
                              <p className="text-sm text-slate-500">{sub.plano_nome}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-700">
                              -{sub.desconto_especial.percentagem}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-green-600">€{sub.preco_final}</p>
                              <p className="text-xs text-slate-500">{sub.desconto_especial.motivo}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700"
                              onClick={async () => {
                                if (!confirm('Remover desconto deste parceiro?')) return;
                                try {
                                  const token = localStorage.getItem('token');
                                  await axios.delete(`${API}/gestao-planos/subscricoes/user/${sub.user_id}/desconto`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success('Desconto removido');
                                  fetchDados();
                                } catch (error) {
                                  toast.error('Erro ao remover desconto');
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm p-4 bg-slate-50 rounded-lg text-center">
                        Nenhum desconto ativo no momento
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Aplicar novo desconto */}
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    Aplicar Novo Desconto
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="md:col-span-1">
                      <Label className="text-sm mb-2 block">Parceiro/Gestor</Label>
                      <Select 
                        value={descontoForm?.parceiro_id || ''} 
                        onValueChange={(v) => setDescontoForm(prev => ({ ...prev, parceiro_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {subscricoes.filter(s => (s.user_tipo === 'parceiro' || s.user_tipo === 'gestao') && !s.desconto_especial?.ativo).map((sub, idx) => (
                            <SelectItem key={`desconto-${sub.id || sub.user_id}-${idx}`} value={sub.user_id}>
                              {sub.user_nome || sub.user_id} ({sub.user_tipo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Desconto (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="Ex: 15"
                        value={descontoForm?.percentagem || ''}
                        onChange={(e) => setDescontoForm(prev => ({ ...prev, percentagem: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Motivo</Label>
                      <Input
                        placeholder="Ex: Parceiro pioneiro"
                        value={descontoForm?.motivo || ''}
                        onChange={(e) => setDescontoForm(prev => ({ ...prev, motivo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Data Início</Label>
                      <Input
                        type="date"
                        value={descontoForm?.data_inicio || ''}
                        onChange={(e) => setDescontoForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Data Fim</Label>
                      <Input
                        type="date"
                        value={descontoForm?.data_fim || ''}
                        onChange={(e) => setDescontoForm(prev => ({ ...prev, data_fim: e.target.value }))}
                      />
                      <span className="text-xs text-slate-400">Vazio = sem expiração</span>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        className="w-full"
                        disabled={!descontoForm?.parceiro_id || !descontoForm?.percentagem}
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            const params = new URLSearchParams({
                              desconto_percentagem: descontoForm.percentagem
                            });
                            if (descontoForm.motivo) params.append('motivo', descontoForm.motivo);
                            if (descontoForm.data_inicio) params.append('data_inicio', descontoForm.data_inicio);
                            if (descontoForm.data_fim) params.append('data_fim', descontoForm.data_fim);
                            
                            await axios.post(
                              `${API}/gestao-planos/subscricoes/user/${descontoForm.parceiro_id}/desconto?${params.toString()}`,
                              {},
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            toast.success(`Desconto de ${descontoForm.percentagem}% aplicado!`);
                            setDescontoForm({ parceiro_id: '', percentagem: 0, motivo: '', data_inicio: '', data_fim: '' });
                            fetchDados();
                          } catch (error) {
                            toast.error(error.response?.data?.detail || 'Erro ao aplicar desconto');
                          }
                        }}
                      >
                        <Percent className="w-4 h-4 mr-2" />
                        Aplicar Desconto
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Oferecer Plano Gratuito */}
                <div className="border-t pt-6 mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-600" />
                    Oferecer Plano Gratuito por Período
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-purple-50 rounded-lg">
                    <div>
                      <Label className="text-sm mb-2 block">Parceiro/Gestor</Label>
                      <Select 
                        value={ofertaForm?.user_id || ''} 
                        onValueChange={(v) => setOfertaForm(prev => ({ ...prev, user_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {subscricoes.filter(s => s.user_tipo === 'parceiro' || s.user_tipo === 'gestao').map(sub => (
                            <SelectItem key={`oferta-${sub.user_id}`} value={sub.user_id}>
                              {sub.user_nome || sub.user_id} ({sub.user_tipo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Plano</Label>
                      <Select 
                        value={ofertaForm?.plano_id || ''} 
                        onValueChange={(v) => setOfertaForm(prev => ({ ...prev, plano_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {planos.filter(p => p.tipo_usuario === 'parceiro' || p.tipo_usuario === 'gestao').map(plano => (
                            <SelectItem key={`plano-${plano.id}`} value={plano.id}>
                              {plano.nome} ({plano.tipo_usuario})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Dias Grátis</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={ofertaForm?.dias_gratis || 30}
                        onChange={(e) => setOfertaForm(prev => ({ ...prev, dias_gratis: parseInt(e.target.value) || 30 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Motivo</Label>
                      <Input
                        placeholder="Ex: Parceiro VIP"
                        value={ofertaForm?.motivo || ''}
                        onChange={(e) => setOfertaForm(prev => ({ ...prev, motivo: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        disabled={!ofertaForm?.user_id || !ofertaForm?.plano_id}
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(
                              `${API}/gestao-planos/ofertas/plano-gratuito`,
                              {
                                user_id: ofertaForm.user_id,
                                plano_id: ofertaForm.plano_id,
                                dias_gratis: ofertaForm.dias_gratis || 30,
                                motivo: ofertaForm.motivo
                              },
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            toast.success(`Plano oferecido por ${ofertaForm.dias_gratis} dias!`);
                            setOfertaForm({ user_id: '', plano_id: '', dias_gratis: 30, motivo: '' });
                            fetchDados();
                          } catch (error) {
                            toast.error(error.response?.data?.detail || 'Erro ao oferecer plano');
                          }
                        }}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Oferecer Plano
                      </Button>
                    </div>
                  </div>
                </div>
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

          {/* Tab Preços Especiais */}
          <TabsContent value="precos-especiais">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      Preços Especiais
                    </CardTitle>
                    <CardDescription>
                      Configure preços especiais para parceiros específicos
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => navigate('/admin/precos-especiais')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar Preços Especiais
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <DollarSign className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Gestão de Preços Especiais
                  </h3>
                  <p className="text-green-700 mb-4">
                    Defina preços personalizados para parceiros específicos, incluindo:
                  </p>
                  <ul className="text-sm text-green-600 space-y-1 mb-4">
                    <li>• Descontos por percentagem</li>
                    <li>• Preços fixos por plano</li>
                    <li>• Preços por veículo</li>
                    <li>• Preços por motorista</li>
                    <li>• Combinações personalizadas</li>
                  </ul>
                  <Button 
                    onClick={() => navigate('/admin/precos-especiais')}
                    variant="outline"
                    className="border-green-500 text-green-700 hover:bg-green-100"
                  >
                    Ir para Configuração Completa →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Plano */}
      <Dialog open={showPlanoModal} onOpenChange={setShowPlanoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="plano-modal-description">
          <DialogHeader>
            <DialogTitle>{selectedPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            <DialogDescription id="plano-modal-description">
              {selectedPlano ? 'Edite as configurações do plano existente' : 'Configure um novo plano de subscrição'}
            </DialogDescription>
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
                  value={planoForm.categoria_id || planoForm.categoria} 
                  onValueChange={(v) => {
                    const cat = categorias.find(c => c.id === v);
                    setPlanoForm(prev => ({ 
                      ...prev, 
                      categoria_id: v,
                      categoria: cat?.nome || v
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gratuito">Gratuito</SelectItem>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    {categorias.filter(c => c.ativo).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icone}</span>
                          <span>{cat.nome}</span>
                        </span>
                      </SelectItem>
                    ))}
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    Ícone 
                    <span className="text-xs text-slate-400">(emoji)</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-12 text-2xl justify-start gap-3"
                      >
                        <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          {planoForm.icone || '📦'}
                        </span>
                        <span className="text-sm text-slate-500">Clique para escolher</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <div className="space-y-2">
                        <Input
                          value={planoForm.icone}
                          onChange={(e) => setPlanoForm(prev => ({ ...prev, icone: e.target.value }))}
                          className="text-center text-xl h-10"
                          placeholder="📦"
                        />
                        <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
                          {['📦', '👑', '⭐', '🚀', '💎', '🏆', '🎯', '💼', '📊', '🔥', '🌟', '⚡', '🛡️', '🎁', '🏅', '🚗', '🚙', '🚐', '💳', '💰', '📈', '✅', '🔔', '🏢'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setPlanoForm(prev => ({ ...prev, icone: emoji }))}
                              className={`w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors text-lg flex items-center justify-center ${planoForm.icone === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="mb-2 block">Cor do Plano</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-12 justify-start gap-3"
                      >
                        <span 
                          className="w-10 h-10 rounded-lg border"
                          style={{ backgroundColor: planoForm.cor || '#3B82F6' }}
                        />
                        <span className="text-sm text-slate-500">{planoForm.cor || '#3B82F6'}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" align="start">
                      <div className="space-y-3">
                        <Input
                          type="color"
                          value={planoForm.cor || '#3B82F6'}
                          onChange={(e) => setPlanoForm(prev => ({ ...prev, cor: e.target.value }))}
                          className="w-full h-8 cursor-pointer"
                        />
                        <div className="grid grid-cols-5 gap-2">
                          {['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#14B8A6', '#6366F1', '#0EA5E9', '#64748B'].map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setPlanoForm(prev => ({ ...prev, cor: color }))}
                              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${planoForm.cor === color ? 'ring-2 ring-offset-2 ring-slate-600' : ''}`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            
            {/* Preços */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Euro className="w-4 h-4" />
                  Preços (valores sem IVA)
                </h4>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    Introduza valores SEM IVA
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">IVA:</Label>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs"
                      value={planoForm.taxa_iva || 23}
                      onChange={(e) => setPlanoForm(prev => ({ ...prev, taxa_iva: parseFloat(e.target.value) || 23 }))}
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>
              </div>
              
              {/* Preços para Parceiros - modelo base + por veículo + por motorista */}
              {planoForm.tipo_usuario === 'parceiro' ? (
                <>
                  {/* Preço Base */}
                  <div>
                    <Label className="text-sm font-medium text-blue-700 mb-2 block">Preço Base do Plano (s/IVA)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="s/IVA"
                          className="border-blue-300 focus:border-blue-500"
                          value={planoForm.precos_plano?.base_semanal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosBase('semanal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.base_semanal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.base_semanal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="s/IVA"
                          className="border-blue-200 focus:border-blue-400"
                          value={planoForm.precos_plano?.base_mensal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosBase('mensal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.base_mensal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.base_mensal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="s/IVA"
                          className="border-blue-200 focus:border-blue-400"
                          value={planoForm.precos_plano?.base_anual || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosBase('anual', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.base_anual > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.base_anual * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preço por Veículo */}
                  <div className="pt-3 border-t border-slate-200">
                    <Label className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Preço por Veículo (s/IVA)
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="s/IVA"
                          className="border-green-300 focus:border-green-500"
                          value={planoForm.precos_plano?.por_veiculo_semanal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosVeiculo('semanal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_veiculo_semanal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_veiculo_semanal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="border-green-200 focus:border-green-400"
                          value={planoForm.precos_plano?.por_veiculo_mensal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosVeiculo('mensal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_veiculo_mensal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_veiculo_mensal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="border-green-200 focus:border-green-400"
                          value={planoForm.precos_plano?.por_veiculo_anual || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosVeiculo('anual', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_veiculo_anual > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_veiculo_anual * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preço por Motorista */}
                  <div className="pt-3 border-t border-slate-200">
                    <Label className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Preço por Motorista (s/IVA)
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Semanal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="s/IVA"
                          className="border-purple-300 focus:border-purple-500"
                          value={planoForm.precos_plano?.por_motorista_semanal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosMotorista('semanal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_motorista_semanal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_motorista_semanal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mensal (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="border-purple-200 focus:border-purple-400"
                          value={planoForm.precos_plano?.por_motorista_mensal || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosMotorista('mensal', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_motorista_mensal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_motorista_mensal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Anual (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="border-purple-200 focus:border-purple-400"
                          value={planoForm.precos_plano?.por_motorista_anual || ''}
                          onChange={(e) => {
                            const precos = calcularPrecosMotorista('anual', e.target.value);
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { ...prev.precos_plano, ...precos }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.por_motorista_anual > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.por_motorista_anual * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Taxa de Setup e Renovação */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-2 block">Taxa de Setup (€ s/IVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={planoForm.precos_plano?.setup || ''}
                          onChange={(e) => setPlanoForm(prev => ({ 
                            ...prev, 
                            precos_plano: { ...prev.precos_plano, setup: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                        {planoForm.precos_plano?.setup > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.setup * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Preço Renovação Mensal (€ s/IVA)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Igual ao mensal se vazio"
                          value={planoForm.precos_plano?.renovacao_mensal || ''}
                          onChange={(e) => {
                            const mensal = parseFloat(e.target.value) || 0;
                            setPlanoForm(prev => ({ 
                              ...prev, 
                              precos_plano: { 
                                ...prev.precos_plano, 
                                renovacao_mensal: mensal,
                                renovacao_semanal: Math.round(mensal / 4 * 100) / 100,
                                renovacao_anual: Math.round(mensal * 12 * 100) / 100
                              }
                            }));
                          }}
                        />
                        {planoForm.precos_plano?.renovacao_mensal > 0 && (
                          <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos_plano.renovacao_mensal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                        )}
                        <span className="text-xs text-slate-400 block">Preço após 1ª fatura (sem setup)</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Preços simples para Motoristas */
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Semanal (€ s/IVA)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Insira aqui"
                      className="border-blue-300 focus:border-blue-500"
                      value={planoForm.precos?.semanal || ''}
                      onChange={(e) => {
                        const precos = calcularPrecosSimples('semanal', e.target.value);
                        setPlanoForm(prev => ({ 
                          ...prev, 
                          precos: { ...prev.precos, ...precos }
                        }));
                      }}
                    />
                    {planoForm.precos?.semanal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos.semanal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label>Mensal (€ s/IVA)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-blue-200 focus:border-blue-400"
                      value={planoForm.precos?.mensal || ''}
                      onChange={(e) => {
                        const precos = calcularPrecosSimples('mensal', e.target.value);
                        setPlanoForm(prev => ({ 
                          ...prev, 
                          precos: { ...prev.precos, ...precos }
                        }));
                      }}
                    />
                    {planoForm.precos?.mensal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos.mensal * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label>Anual (€ s/IVA)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-blue-200 focus:border-blue-400"
                      value={planoForm.precos?.anual || ''}
                      onChange={(e) => {
                        const precos = calcularPrecosSimples('anual', e.target.value);
                        setPlanoForm(prev => ({ 
                          ...prev, 
                          precos: { ...prev.precos, ...precos }
                        }));
                      }}
                    />
                    {planoForm.precos?.anual > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(planoForm.precos.anual * (1 + (planoForm.taxa_iva || 23) / 100)).toFixed(2)}</span>
                    )}
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
            
            {/* Configuração Avançada de Trial */}
            {planoForm.permite_trial && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                  <Gift className="w-4 h-4" />
                  Configuração de Trial
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={planoForm.trial_config?.automatico || false}
                      onCheckedChange={(checked) => setPlanoForm(prev => ({ 
                        ...prev, 
                        trial_config: { ...prev.trial_config, automatico: checked }
                      }))}
                    />
                    <Label className="text-sm">Trial Automático</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={planoForm.trial_config?.requer_cartao || false}
                      onCheckedChange={(checked) => setPlanoForm(prev => ({ 
                        ...prev, 
                        trial_config: { ...prev.trial_config, requer_cartao: checked }
                      }))}
                    />
                    <Label className="text-sm flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Requer Cartão
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  Trial automático: novos utilizadores recebem trial sem necessidade de aprovação. 
                  Requer cartão: utilizador deve registar método de pagamento para iniciar trial.
                </p>
              </div>
            )}
            
            {/* Referência de Faturação */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Referência Interna de Faturação
              </Label>
              <Input
                placeholder="Ex: PLAN-PRO-001, SKU-123"
                value={planoForm.referencia_faturacao || ''}
                onChange={(e) => setPlanoForm(prev => ({ ...prev, referencia_faturacao: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Código interno para integração com o programa de faturação (Moloni, InvoiceXpress, etc.)</p>
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
        <DialogContent className="max-w-lg" aria-describedby="modulo-modal-description">
          <DialogHeader>
            <DialogTitle>{selectedModulo ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
            <DialogDescription id="modulo-modal-description">
              {selectedModulo ? 'Edite as configurações do módulo existente' : 'Configure um novo módulo adicional'}
            </DialogDescription>
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
                    <SelectItem value="por_veiculo_motorista">Por Veículo + Motorista</SelectItem>
                  </SelectContent>
                </Select>
                {moduloForm.tipo_cobranca === 'por_veiculo_motorista' && (
                  <p className="text-xs text-blue-600 mt-1">Cobrança combinada: preço por veículo + preço por motorista</p>
                )}
              </div>
            </div>
            
            {/* Preços Base - valores sem IVA */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-blue-700">Preços Base (s/IVA)</Label>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Introduza valores SEM IVA
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Semanal (€ s/IVA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={moduloForm.precos?.semanal || ''}
                    onChange={(e) => setModuloForm(prev => ({ 
                      ...prev, 
                      precos: { ...prev.precos, semanal: parseFloat(e.target.value) || 0 }
                    }))}
                  />
                  {moduloForm.precos?.semanal > 0 && (
                    <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.semanal * 1.23).toFixed(2)}</span>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Mensal (€ s/IVA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={moduloForm.precos?.mensal || ''}
                    onChange={(e) => setModuloForm(prev => ({ 
                      ...prev, 
                      precos: { ...prev.precos, mensal: parseFloat(e.target.value) || 0 }
                    }))}
                  />
                  {moduloForm.precos?.mensal > 0 && (
                    <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.mensal * 1.23).toFixed(2)}</span>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Anual (€ s/IVA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={moduloForm.precos?.anual || ''}
                    onChange={(e) => setModuloForm(prev => ({ 
                      ...prev, 
                      precos: { ...prev.precos, anual: parseFloat(e.target.value) || 0 }
                    }))}
                  />
                  {moduloForm.precos?.anual > 0 && (
                    <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.anual * 1.23).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Preços por Veículo (para tipo_cobranca combinado) */}
            {(moduloForm.tipo_cobranca === 'por_veiculo' || moduloForm.tipo_cobranca === 'por_veiculo_motorista') && (
              <div className="p-3 bg-green-50 rounded-lg">
                <Label className="text-green-700 font-medium mb-2 flex items-center gap-1">
                  <Car className="w-4 h-4" />
                  Preço por Veículo (€ s/IVA)
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Semanal</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-green-300"
                      value={moduloForm.precos?.por_veiculo_semanal || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_veiculo_semanal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_veiculo_semanal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_veiculo_semanal * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Mensal</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-green-300"
                      value={moduloForm.precos?.por_veiculo_mensal || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_veiculo_mensal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_veiculo_mensal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_veiculo_mensal * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Anual</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-green-300"
                      value={moduloForm.precos?.por_veiculo_anual || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_veiculo_anual: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_veiculo_anual > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_veiculo_anual * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Preços por Motorista (para tipo_cobranca combinado) */}
            {(moduloForm.tipo_cobranca === 'por_motorista' || moduloForm.tipo_cobranca === 'por_veiculo_motorista') && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <Label className="text-purple-700 font-medium mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Preço por Motorista (€ s/IVA)
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Semanal</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-purple-300"
                      value={moduloForm.precos?.por_motorista_semanal || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_motorista_semanal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_motorista_semanal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_motorista_semanal * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Mensal</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-purple-300"
                      value={moduloForm.precos?.por_motorista_mensal || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_motorista_mensal: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_motorista_mensal > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_motorista_mensal * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Anual</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-purple-300"
                      value={moduloForm.precos?.por_motorista_anual || ''}
                      onChange={(e) => setModuloForm(prev => ({ 
                        ...prev, 
                        precos: { ...prev.precos, por_motorista_anual: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                    {moduloForm.precos?.por_motorista_anual > 0 && (
                      <span className="text-xs text-green-600 font-medium">c/IVA: €{(moduloForm.precos.por_motorista_anual * 1.23).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Destaque do Módulo */}
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <div>
                  <Label className="font-medium text-amber-800">Módulo em Destaque</Label>
                  <p className="text-xs text-amber-600">Destacar este módulo na lista para clientes</p>
                </div>
              </div>
              <Switch
                checked={moduloForm.destaque || false}
                onCheckedChange={(checked) => setModuloForm(prev => ({ ...prev, destaque: checked }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  Ícone 
                  <span className="text-xs text-slate-400">(emoji)</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-11 text-xl justify-start gap-3"
                    >
                      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        {moduloForm.icone || '📦'}
                      </span>
                      <span className="text-sm text-slate-500">Clique para escolher</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start">
                    <div className="space-y-2">
                      <Input
                        value={moduloForm.icone}
                        onChange={(e) => setModuloForm(prev => ({ ...prev, icone: e.target.value }))}
                        className="text-center text-xl h-9"
                        placeholder="📦"
                      />
                      <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto">
                        {['📦', '📧', '🔧', '📅', '📢', '📄', '💬', '📊', '🤖', '🔍', '📚', '💰', '🚗', '👤', '⚙️', '🔔', '⚠️', '✅', '🪪', '💳', '📈', '🏦', '💵', '📝'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setModuloForm(prev => ({ ...prev, icone: emoji }))}
                            className={`w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors text-base flex items-center justify-center ${moduloForm.icone === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="mb-2 block">Cor do Módulo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-11 justify-start gap-3"
                    >
                      <span 
                        className="w-8 h-8 rounded-lg border"
                        style={{ backgroundColor: moduloForm.cor || '#3B82F6' }}
                      />
                      <span className="text-sm text-slate-500">{moduloForm.cor || '#3B82F6'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-3" align="start">
                    <div className="space-y-3">
                      <Input
                        type="color"
                        value={moduloForm.cor || '#3B82F6'}
                        onChange={(e) => setModuloForm(prev => ({ ...prev, cor: e.target.value }))}
                        className="w-full h-8 cursor-pointer"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        {['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6', '#25D366', '#EC4899', '#6366F1', '#14B8A6', '#0EA5E9'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setModuloForm(prev => ({ ...prev, cor: color }))}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${moduloForm.cor === color ? 'ring-2 ring-offset-2 ring-slate-600' : ''}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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

      {/* Modal Categoria */}
      <Dialog open={showCategoriaModal} onOpenChange={setShowCategoriaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCategoria ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              Categorias ajudam a organizar os planos para os utilizadores
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={categoriaForm.nome}
                onChange={(e) => setCategoriaForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Premium, Empresarial, Starter"
              />
            </div>
            
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={categoriaForm.descricao}
                onChange={(e) => setCategoriaForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Breve descrição da categoria"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  Ícone
                </Label>
                <div className="space-y-2">
                  <Input
                    value={categoriaForm.icone}
                    onChange={(e) => setCategoriaForm(prev => ({ ...prev, icone: e.target.value }))}
                    className="text-center text-xl"
                    placeholder="📁"
                  />
                  <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded border">
                    {['📁', '⭐', '👑', '🏆', '💼', '🚀', '💎', '🔥', '🎯', '✨', '🏅', '🥇', '🥈', '🥉', '💡', '🎊', '🎁', '📊', '🏢', '🌟'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCategoriaForm(prev => ({ ...prev, icone: emoji }))}
                        className={`w-7 h-7 rounded hover:bg-slate-200 transition-colors text-base flex items-center justify-center ${categoriaForm.icone === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Cor</Label>
                <div className="space-y-2">
                  <Input
                    type="color"
                    value={categoriaForm.cor}
                    onChange={(e) => setCategoriaForm(prev => ({ ...prev, cor: e.target.value }))}
                    className="w-full h-10"
                  />
                  <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded border">
                    {['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#14B8A6', '#6366F1'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoriaForm(prev => ({ ...prev, cor: color }))}
                        className={`w-6 h-6 rounded-full border-2 ${categoriaForm.cor === color ? 'ring-2 ring-offset-1 ring-slate-600' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <Label>Ordem de Exibição</Label>
              <Input
                type="number"
                value={categoriaForm.ordem}
                onChange={(e) => setCategoriaForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">Categorias com menor número aparecem primeiro</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoriaModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategoria} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preço Fixo */}
      <Dialog open={showPrecoFixoModal} onOpenChange={setShowPrecoFixoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Definir Preço Fixo
            </DialogTitle>
            <DialogDescription>
              Define um preço fixo que sobrepõe qualquer cálculo de plano
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Utilizador *</Label>
              <Select 
                value={precoFixoForm.user_id} 
                onValueChange={(v) => setPrecoFixoForm(prev => ({ ...prev, user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar utilizador..." />
                </SelectTrigger>
                <SelectContent>
                  {subscricoes.filter(s => !s.preco_fixo?.ativo).map((sub, idx) => (
                    <SelectItem key={`preco-fixo-${sub.id || sub.user_id}-${idx}`} value={sub.user_id}>
                      {sub.user_nome || sub.user_email || sub.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Preço Fixo Mensal (€) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={precoFixoForm.preco_fixo}
                onChange={(e) => setPrecoFixoForm(prev => ({ ...prev, preco_fixo: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500 mt-1">Este valor substitui o preço calculado do plano</p>
            </div>
            
            <div>
              <Label>Motivo</Label>
              <Textarea
                value={precoFixoForm.motivo}
                onChange={(e) => setPrecoFixoForm(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ex: Acordo especial, cliente VIP, promoção..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrecoFixoModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePrecoFixo} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminGestaoPlanos;
