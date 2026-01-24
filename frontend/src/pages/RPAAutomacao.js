import { useState, useEffect } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Bot,
  Play,
  Pause,
  Settings,
  Key,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  History,
  Zap,
  Car,
  Fuel,
  MapPin,
  Shield,
  ChevronRight
} from 'lucide-react';

const RPAAutomacao = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('plataformas');
  const [loading, setLoading] = useState(true);
  
  // Estados principais
  const [plataformas, setPlataformas] = useState([]);
  const [credenciais, setCredenciais] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  
  // Modal states
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [showExecutarModal, setShowExecutarModal] = useState(false);
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNovaPlataformaModal, setShowNovaPlataformaModal] = useState(false);
  const [showDeletePlataformaModal, setShowDeletePlataformaModal] = useState(false);
  
  // Form states
  const [selectedPlataforma, setSelectedPlataforma] = useState(null);
  const [selectedExecucao, setSelectedExecucao] = useState(null);
  const [credForm, setCredForm] = useState({ email: '', password: '' });
  const [execForm, setExecForm] = useState({ tipo_extracao: 'todos', data_inicio: '', data_fim: '' });
  const [agendForm, setAgendForm] = useState({ 
    frequencia: 'semanal', 
    dia_semana: 1, 
    hora: '06:00',
    tipo_extracao: 'todos',
    ativo: true 
  });
  const [novaPlataformaForm, setNovaPlataformaForm] = useState({
    nome: '',
    icone: '🔧',
    cor: '#6B7280',
    descricao: '',
    url_login: '',
    tipos_extracao: ['todos'],
    campos_credenciais: ['email', 'password'],
    requer_2fa: false,
    notas: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Buscar plataformas (agora inclui pré-definidas + personalizadas)
      const platRes = await axios.get(`${API}/rpa-auto/plataformas`);
      let todasPlataformas = platRes.data || [];
      
      // Buscar plataformas customizadas do RPA Designer
      try {
        const customRes = await axios.get(`${API}/rpa-designer/plataformas-disponiveis`, { headers });
        const plataformasCustom = customRes.data || [];
        // Adicionar às plataformas (evitar duplicados pelo id)
        const idsExistentes = new Set(todasPlataformas.map(p => p.id));
        for (const pc of plataformasCustom) {
          if (!idsExistentes.has(pc.id)) {
            todasPlataformas.push(pc);
          }
        }
      } catch (e) {
        console.log('Sem plataformas customizadas');
      }
      
      setPlataformas(todasPlataformas);
      
      // Buscar credenciais
      try {
        const credRes = await axios.get(`${API}/rpa-auto/credenciais`, { headers });
        setCredenciais(credRes.data || []);
      } catch (e) {
        setCredenciais([]);
      }
      
      // Buscar execuções
      try {
        const execRes = await axios.get(`${API}/rpa-auto/execucoes?limit=20`, { headers });
        setExecucoes(execRes.data || []);
      } catch (e) {
        setExecucoes([]);
      }
      
      // Buscar agendamentos
      try {
        const agendRes = await axios.get(`${API}/rpa-auto/agendamentos`, { headers });
        setAgendamentos(agendRes.data || []);
      } catch (e) {
        setAgendamentos([]);
      }
      
      // Buscar estatísticas
      try {
        const statsRes = await axios.get(`${API}/rpa-auto/estatisticas`, { headers });
        setEstatisticas(statsRes.data);
      } catch (e) {
        setEstatisticas(null);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarPlataforma = async () => {
    if (!novaPlataformaForm.nome) {
      toast.error('Nome da plataforma é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa-auto/plataformas`, novaPlataformaForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Plataforma criada com sucesso!');
      setShowNovaPlataformaModal(false);
      setNovaPlataformaForm({
        nome: '',
        icone: '🔧',
        cor: '#6B7280',
        descricao: '',
        url_login: '',
        tipos_extracao: ['todos'],
        campos_credenciais: ['email', 'password'],
        requer_2fa: false,
        notas: ''
      });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar plataforma');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarPlataforma = async () => {
    if (!selectedPlataforma) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/rpa-auto/plataformas/${selectedPlataforma.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Plataforma eliminada com sucesso!');
      setShowDeletePlataformaModal(false);
      setSelectedPlataforma(null);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao eliminar plataforma');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredenciais = async () => {
    if (!selectedPlataforma || !credForm.email || !credForm.password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa-auto/credenciais`, {
        plataforma: selectedPlataforma.id,
        email: credForm.email,
        password: credForm.password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Credenciais guardadas com sucesso!');
      setShowCredenciaisModal(false);
      setCredForm({ email: '', password: '' });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar credenciais');
    } finally {
      setSaving(false);
    }
  };

  const handleExecutar = async () => {
    if (!selectedPlataforma) return;

    setExecuting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/rpa-auto/executar`, {
        plataforma: selectedPlataforma.id,
        tipo_extracao: execForm.tipo_extracao,
        data_inicio: execForm.data_inicio || null,
        data_fim: execForm.data_fim || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Execução iniciada! Acompanhe o progresso no histórico.');
      setShowExecutarModal(false);
      setExecForm({ tipo_extracao: 'todos', data_inicio: '', data_fim: '' });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar execução');
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveAgendamento = async () => {
    if (!selectedPlataforma) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rpa-auto/agendamentos`, {
        plataforma: selectedPlataforma.id,
        ...agendForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Agendamento criado com sucesso!');
      setShowAgendamentoModal(false);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar agendamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredenciais = async (plataforma) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/rpa-auto/credenciais/${plataforma}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais eliminadas');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao eliminar credenciais');
    }
  };

  const handleDeleteAgendamento = async (agendamentoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/rpa-auto/agendamentos/${agendamentoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agendamento eliminado');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao eliminar agendamento');
    }
  };

  const getPlataformaIcon = (id) => {
    switch (id) {
      case 'uber': return <Car className="w-6 h-6" />;
      case 'bolt': return <Zap className="w-6 h-6" />;
      case 'viaverde': return <MapPin className="w-6 h-6" />;
      case 'prio': return <Fuel className="w-6 h-6" />;
      default: return <Bot className="w-6 h-6" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sucesso':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
      case 'sucesso_parcial':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3 mr-1" />Parcial</Badge>;
      case 'erro':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'em_execucao':
        return <Badge className="bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Em execução</Badge>;
      case 'pendente':
        return <Badge className="bg-slate-100 text-slate-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const isPlataformaConfigurada = (plataformaId) => {
    return credenciais.some(c => c.plataforma === plataformaId);
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
                <Bot className="w-6 h-6" />
                Automação RPA
              </h1>
              <p className="text-slate-600">Extração automática de dados de plataformas</p>
            </div>
          </div>
          <div className="flex gap-2">
            {user?.role === 'admin' && (
              <Button onClick={() => setShowNovaPlataformaModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Plataforma
              </Button>
            )}
            <Button variant="outline" onClick={fetchDados}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Plataformas Configuradas</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticas.credenciais_configuradas}</p>
                  </div>
                  <Key className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Execuções</p>
                    <p className="text-2xl font-bold text-slate-700">{estatisticas.total_execucoes}</p>
                  </div>
                  <Play className="w-8 h-8 text-slate-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Sucesso</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticas.execucoes_sucesso}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Erros</p>
                    <p className="text-2xl font-bold text-red-600">{estatisticas.execucoes_erro}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Agendamentos</p>
                    <p className="text-2xl font-bold text-purple-600">{estatisticas.agendamentos_ativos}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="plataformas" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Plataformas
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="agendamentos" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Agendamentos
            </TabsTrigger>
          </TabsList>

          {/* Tab Plataformas */}
          <TabsContent value="plataformas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plataformas.map((plat) => {
                const configurada = isPlataformaConfigurada(plat.id);
                const credencial = credenciais.find(c => c.plataforma === plat.id);
                const isPredefinida = plat.tipo === 'predefinida' || !plat.tipo;
                
                return (
                  <Card key={plat.id} className={`transition-shadow ${configurada ? 'border-green-200' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl"
                            style={{ backgroundColor: plat.cor }}
                          >
                            {plat.is_custom ? plat.icone : getPlataformaIcon(plat.id)}
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {plat.nome}
                              {configurada && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {(plat.is_custom || plat.tipo === 'personalizada') && (
                                <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                                  Personalizada
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription>{plat.descricao}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {plat.requer_2fa && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <Shield className="w-3 h-3 mr-1" />
                              2FA
                            </Badge>
                          )}
                          {user?.role === 'admin' && !isPredefinida && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedPlataforma(plat);
                                setShowDeletePlataformaModal(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Tipos de extração */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {plat.tipos_extracao?.map((tipo) => (
                          <Badge key={tipo} variant="secondary">{tipo}</Badge>
                        ))}
                      </div>
                      
                      {/* Status das credenciais */}
                      {configurada ? (
                        <div className="p-3 bg-green-50 rounded-lg mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-800">Credenciais Configuradas</p>
                              <p className="text-xs text-green-600">{credencial?.email}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteCredenciais(plat.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 rounded-lg mb-4">
                          <p className="text-sm text-amber-800">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            Configure as credenciais para ativar
                          </p>
                        </div>
                      )}
                      
                      {/* Botões de ação */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedPlataforma(plat);
                            setCredForm({ email: '', password: '' });
                            setShowCredenciaisModal(true);
                          }}
                        >
                          <Key className="w-4 h-4 mr-2" />
                          {configurada ? 'Atualizar' : 'Configurar'}
                        </Button>
                        
                        {configurada && (
                          <>
                            <Button
                              className="flex-1"
                              onClick={() => {
                                setSelectedPlataforma(plat);
                                setExecForm({ tipo_extracao: 'todos', data_inicio: '', data_fim: '' });
                                setShowExecutarModal(true);
                              }}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Executar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedPlataforma(plat);
                                setShowAgendamentoModal(true);
                              }}
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
                <CardDescription>Últimas execuções de automação</CardDescription>
              </CardHeader>
              <CardContent>
                {execucoes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma execução registada</p>
                    <p className="text-sm">Execute uma automação para ver o histórico</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Plataforma</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Registos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {execucoes.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell className="text-sm">{formatDate(exec.created_at)}</TableCell>
                          <TableCell className="font-medium">{exec.plataforma_nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{exec.tipo_extracao}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              {exec.total_registos || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(exec.status)}</TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {exec.terminado_em && exec.created_at ? (
                              `${Math.round((new Date(exec.terminado_em) - new Date(exec.created_at)) / 1000)}s`
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token');
                                  const res = await axios.get(`${API}/rpa-auto/execucoes/${exec.id}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  setSelectedExecucao(res.data);
                                  setShowDetalhesModal(true);
                                } catch (e) {
                                  toast.error('Erro ao carregar detalhes');
                                }
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Agendamentos */}
          <TabsContent value="agendamentos">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Agendamentos Automáticos</CardTitle>
                    <CardDescription>Configure execuções automáticas periódicas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {agendamentos.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum agendamento configurado</p>
                    <p className="text-sm">Configure uma plataforma e crie um agendamento</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agendamentos.map((agend) => (
                      <div 
                        key={agend.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: plataformas.find(p => p.id === agend.plataforma)?.cor || '#6B7280' }}
                          >
                            {getPlataformaIcon(agend.plataforma)}
                          </div>
                          <div>
                            <p className="font-medium">{agend.plataforma_nome}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="w-3 h-3" />
                              <span>
                                {agend.frequencia === 'diario' && 'Todos os dias'}
                                {agend.frequencia === 'semanal' && `Semanalmente (${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][agend.dia_semana]})`}
                                {agend.frequencia === 'mensal' && 'Mensalmente'}
                                {' às '}{agend.hora}
                              </span>
                            </div>
                            {agend.proxima_execucao && (
                              <p className="text-xs text-slate-400">
                                Próxima: {formatDate(agend.proxima_execucao)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={agend.ativo ? "default" : "secondary"}>
                            {agend.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500"
                            onClick={() => handleDeleteAgendamento(agend.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Modal Credenciais */}
      <Dialog open={showCredenciaisModal} onOpenChange={setShowCredenciaisModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Configurar Credenciais
            </DialogTitle>
            <DialogDescription>
              {selectedPlataforma?.nome} - Insira as credenciais de acesso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Aviso de segurança */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <Shield className="w-4 h-4 inline mr-1" />
                As credenciais são encriptadas e guardadas de forma segura.
              </p>
            </div>

            <div className="space-y-2">
              <Label>{selectedPlataforma?.campos_credenciais?.includes('username') ? 'Username' : 'Email'}</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={credForm.email}
                onChange={(e) => setCredForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={credForm.password}
                  onChange={(e) => setCredForm(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {selectedPlataforma?.requer_2fa && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Esta plataforma pode requerer autenticação de 2 fatores. 
                  A automação pode ser interrompida se 2FA for solicitado.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredenciaisModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCredenciais} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Executar */}
      <Dialog open={showExecutarModal} onOpenChange={setShowExecutarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Executar Automação
            </DialogTitle>
            <DialogDescription>
              {selectedPlataforma?.nome} - Configure e inicie a extração
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Extração</Label>
              <Select 
                value={execForm.tipo_extracao} 
                onValueChange={(v) => setExecForm(prev => ({ ...prev, tipo_extracao: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedPlataforma?.tipos_extracao?.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início (opcional)</Label>
                <Input
                  type="date"
                  value={execForm.data_inicio}
                  onChange={(e) => setExecForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={execForm.data_fim}
                  onChange={(e) => setExecForm(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                A automação será executada em background. 
                Pode acompanhar o progresso no histórico.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecutarModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExecutar} disabled={executing}>
              {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Agendamento */}
      <Dialog open={showAgendamentoModal} onOpenChange={setShowAgendamentoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Criar Agendamento
            </DialogTitle>
            <DialogDescription>
              {selectedPlataforma?.nome} - Configure execução automática
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select 
                value={agendForm.frequencia} 
                onValueChange={(v) => setAgendForm(prev => ({ ...prev, frequencia: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {agendForm.frequencia === 'semanal' && (
              <div className="space-y-2">
                <Label>Dia da Semana</Label>
                <Select 
                  value={String(agendForm.dia_semana)} 
                  onValueChange={(v) => setAgendForm(prev => ({ ...prev, dia_semana: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Segunda-feira</SelectItem>
                    <SelectItem value="1">Terça-feira</SelectItem>
                    <SelectItem value="2">Quarta-feira</SelectItem>
                    <SelectItem value="3">Quinta-feira</SelectItem>
                    <SelectItem value="4">Sexta-feira</SelectItem>
                    <SelectItem value="5">Sábado</SelectItem>
                    <SelectItem value="6">Domingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Hora de Execução</Label>
              <Input
                type="time"
                value={agendForm.hora}
                onChange={(e) => setAgendForm(prev => ({ ...prev, hora: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Extração</Label>
              <Select 
                value={agendForm.tipo_extracao} 
                onValueChange={(v) => setAgendForm(prev => ({ ...prev, tipo_extracao: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedPlataforma?.tipos_extracao?.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={agendForm.ativo}
                onCheckedChange={(checked) => setAgendForm(prev => ({ ...prev, ativo: checked }))}
              />
              <Label>Ativar agendamento</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgendamentoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAgendamento} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes Execução */}
      <Dialog open={showDetalhesModal} onOpenChange={setShowDetalhesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalhes da Execução
            </DialogTitle>
          </DialogHeader>

          {selectedExecucao && (
            <div className="space-y-4">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Plataforma</Label>
                  <p className="font-medium">{selectedExecucao.plataforma_nome}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedExecucao.status)}</div>
                </div>
                <div>
                  <Label className="text-slate-500">Iniciado</Label>
                  <p>{formatDate(selectedExecucao.created_at)}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Terminado</Label>
                  <p>{formatDate(selectedExecucao.terminado_em)}</p>
                </div>
              </div>

              {/* Registos extraídos */}
              <div>
                <Label className="text-slate-500">Registos Extraídos</Label>
                <p className="text-2xl font-bold text-blue-600">{selectedExecucao.total_registos || 0}</p>
              </div>

              {/* Erros */}
              {selectedExecucao.erros?.length > 0 && (
                <div>
                  <Label className="text-slate-500">Erros</Label>
                  <div className="mt-2 p-3 bg-red-50 rounded-lg">
                    {selectedExecucao.erros.map((erro, idx) => (
                      <p key={idx} className="text-sm text-red-700">{erro}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs */}
              {selectedExecucao.logs?.length > 0 && (
                <div>
                  <Label className="text-slate-500">Logs de Execução</Label>
                  <div className="mt-2 p-3 bg-slate-900 rounded-lg max-h-60 overflow-y-auto">
                    {selectedExecucao.logs.map((log, idx) => (
                      <p 
                        key={idx} 
                        className={`text-xs font-mono ${
                          log.nivel === 'error' ? 'text-red-400' : 
                          log.nivel === 'warning' ? 'text-yellow-400' : 'text-green-400'
                        }`}
                      >
                        [{log.timestamp?.split('T')[1]?.split('.')[0]}] {log.mensagem}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Dados extraídos (amostra) */}
              {selectedExecucao.dados_extraidos?.length > 0 && (
                <div>
                  <Label className="text-slate-500">Amostra de Dados ({selectedExecucao.dados_extraidos.length} registos)</Label>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg max-h-40 overflow-y-auto">
                    <pre className="text-xs">
                      {JSON.stringify(selectedExecucao.dados_extraidos.slice(0, 3), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Nova Plataforma */}
      <Dialog open={showNovaPlataformaModal} onOpenChange={setShowNovaPlataformaModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nova Plataforma
            </DialogTitle>
            <DialogDescription>
              Adicione uma nova plataforma para automação RPA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <Label>Nome da Plataforma *</Label>
                <Input
                  placeholder="Ex: Galp Frota"
                  value={novaPlataformaForm.nome}
                  onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div>
                <Label>Ícone</Label>
                <Input
                  placeholder="🔧"
                  value={novaPlataformaForm.icone}
                  onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, icone: e.target.value }))}
                  className="text-center text-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={novaPlataformaForm.cor}
                    onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, cor: e.target.value }))}
                    className="w-14 h-9 p-1"
                  />
                  <Input
                    value={novaPlataformaForm.cor}
                    onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, cor: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Requer 2FA?</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={novaPlataformaForm.requer_2fa}
                    onCheckedChange={(checked) => setNovaPlataformaForm(prev => ({ ...prev, requer_2fa: checked }))}
                  />
                  <span className="text-sm text-slate-600">
                    {novaPlataformaForm.requer_2fa ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <Label>URL de Login</Label>
              <Input
                placeholder="https://portal.exemplo.com/login"
                value={novaPlataformaForm.url_login}
                onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, url_login: e.target.value }))}
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição da plataforma e tipo de dados a extrair"
                value={novaPlataformaForm.descricao}
                onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, descricao: e.target.value }))}
              />
            </div>

            <div>
              <Label>Tipos de Extração (separados por vírgula)</Label>
              <Input
                placeholder="ganhos, portagens, combustivel"
                value={novaPlataformaForm.tipos_extracao.join(', ')}
                onChange={(e) => setNovaPlataformaForm(prev => ({ 
                  ...prev, 
                  tipos_extracao: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                }))}
              />
            </div>

            <div>
              <Label>Notas Adicionais</Label>
              <Input
                placeholder="Instruções especiais para login ou extração"
                value={novaPlataformaForm.notas}
                onChange={(e) => setNovaPlataformaForm(prev => ({ ...prev, notas: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaPlataformaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarPlataforma} disabled={saving || !novaPlataformaForm.nome}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Plataforma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminação de Plataforma */}
      <AlertDialog open={showDeletePlataformaModal} onOpenChange={setShowDeletePlataformaModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar a plataforma &quot;{selectedPlataforma?.nome}&quot;?
              {selectedPlataforma && (
                <span className="block mt-2 text-amber-600">
                  Se existirem credenciais associadas, a plataforma será apenas desactivada.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarPlataforma}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default RPAAutomacao;
