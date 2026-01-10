import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileSpreadsheet, 
  ArrowLeft,
  Calendar,
  Download,
  Upload,
  Filter,
  FileText,
  Car,
  Fuel,
  Zap,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ListaImportacoes = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [importacoes, setImportacoes] = useState([]);
  const [resumoPorPlataforma, setResumoPorPlataforma] = useState({});
  const [activeTab, setActiveTab] = useState('todas');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showStatusMenu, setShowStatusMenu] = useState(null);
  
  // Filtros
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('semana'); // 'semana' ou 'periodo'

  useEffect(() => {
    // Initialize with current week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    
    setSemana(currentWeek);
    setAno(now.getFullYear());
  }, []);

  useEffect(() => {
    if ((filtroTipo === 'semana' && semana && ano) || 
        (filtroTipo === 'periodo' && dataInicio && dataFim)) {
      fetchImportacoes();
    }
  }, [semana, ano, dataInicio, dataFim, filtroTipo]);

  const fetchImportacoes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${API}/api/relatorios/importacoes/historico`;
      const params = new URLSearchParams();
      
      if (filtroTipo === 'semana') {
        params.append('semana', semana);
        params.append('ano', ano);
      } else {
        params.append('data_inicio', dataInicio);
        params.append('data_fim', dataFim);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setImportacoes(response.data.importacoes || []);
      setResumoPorPlataforma(response.data.resumo_por_plataforma || {});
    } catch (error) {
      console.error('Erro ao carregar importações:', error);
      // Se o endpoint não existir, usar dados mock
      setImportacoes([]);
      setResumoPorPlataforma({});
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    if (semana > 1) {
      setSemana(semana - 1);
    } else {
      setSemana(52);
      setAno(ano - 1);
    }
  };

  const handleNextWeek = () => {
    if (semana < 52) {
      setSemana(semana + 1);
    } else {
      setSemana(1);
      setAno(ano + 1);
    }
  };

  const getPlataformaIcon = (plataforma) => {
    const icons = {
      'uber': <Car className="w-4 h-4" />,
      'bolt': <Zap className="w-4 h-4" />,
      'viaverde': <CreditCard className="w-4 h-4" />,
      'via_verde': <CreditCard className="w-4 h-4" />,
      'combustivel': <Fuel className="w-4 h-4" />,
      'eletrico': <Zap className="w-4 h-4" />,
      'gps': <FileText className="w-4 h-4" />
    };
    return icons[plataforma?.toLowerCase()] || <FileSpreadsheet className="w-4 h-4" />;
  };

  const getPlataformaColor = (plataforma) => {
    const colors = {
      'uber': 'bg-black text-white',
      'bolt': 'bg-green-500 text-white',
      'viaverde': 'bg-blue-500 text-white',
      'via_verde': 'bg-blue-500 text-white',
      'combustivel': 'bg-orange-500 text-white',
      'eletrico': 'bg-yellow-500 text-black',
      'gps': 'bg-purple-500 text-white'
    };
    return colors[plataforma?.toLowerCase()] || 'bg-slate-500 text-white';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredImportacoes = activeTab === 'todas' 
    ? importacoes 
    : importacoes.filter(imp => imp.plataforma?.toLowerCase() === activeTab);

  const handleDeleteImportacao = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/importacoes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Importação eliminada com sucesso!');
      setShowDeleteConfirm(null);
      fetchImportacoes();
    } catch (error) {
      console.error('Erro ao eliminar:', error);
      toast.error('Erro ao eliminar importação');
    }
  };

  const handleChangeStatus = async (id, novoEstado) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/importacoes/${id}/estado`, 
        { estado: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Estado atualizado!');
      setShowStatusMenu(null);
      fetchImportacoes();
    } catch (error) {
      console.error('Erro ao alterar estado:', error);
      toast.error('Erro ao alterar estado');
    }
  };

  const getStatusBadge = (estado) => {
    const estados = {
      'processado': { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Processado' },
      'pendente': { icon: Clock, color: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
      'erro': { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Erro' },
      'revisto': { icon: CheckCircle, color: 'bg-blue-100 text-blue-700', label: 'Revisto' }
    };
    const status = estados[estado?.toLowerCase()] || estados['processado'];
    const Icon = status.icon;
    return (
      <Badge className={`${status.color} text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.label}
      </Badge>
    );
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Lista de Importações</h1>
              <p className="text-xs text-slate-500">Histórico de ficheiros importados</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Seletor de semana */}
            <div className="flex items-center gap-1 bg-white rounded border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek} className="h-6 w-6 p-0">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium min-w-[80px] text-center">S{semana}/{ano}</span>
              <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-6 w-6 p-0">
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={fetchImportacoes} className="h-8">
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => navigate('/importar-ficheiros')} className="h-8">
              <Upload className="w-3 h-3 mr-1" />
              Importar
            </Button>
          </div>
        </div>

        {/* Modal de confirmação de eliminação */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-sm mx-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <Trash2 className="w-4 h-4" />
                  Eliminar Importação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">Tem a certeza que deseja eliminar esta importação?</p>
                <p className="text-xs text-slate-500">Esta ação irá remover todos os registos associados.</p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteImportacao(showDeleteConfirm)}>Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resumo por Plataforma */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {['uber', 'bolt', 'viaverde', 'combustivel', 'eletrico'].map((plat) => {
            const dados = resumoPorPlataforma[plat] || { total: 0, registos: 0, ficheiros: 0 };
            return (
              <Card key={plat} className={`border-t-4 ${plat === 'uber' ? 'border-t-black' : plat === 'bolt' ? 'border-t-green-500' : plat === 'viaverde' ? 'border-t-blue-500' : plat === 'combustivel' ? 'border-t-orange-500' : 'border-t-yellow-500'}`}>
                <CardContent className="pt-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {getPlataformaIcon(plat)}
                    <span className="text-sm font-medium capitalize">{plat === 'viaverde' ? 'Via Verde' : plat}</span>
                  </div>
                  <p className="text-xl font-bold text-slate-800">
                    {formatCurrency(dados.total)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {dados.registos} registos | {dados.ficheiros} ficheiro(s)
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs por Plataforma */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="uber">Uber</TabsTrigger>
            <TabsTrigger value="bolt">Bolt</TabsTrigger>
            <TabsTrigger value="viaverde">Via Verde</TabsTrigger>
            <TabsTrigger value="combustivel">Combustível</TabsTrigger>
            <TabsTrigger value="eletrico">Elétrico</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredImportacoes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSpreadsheet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhuma importação encontrada</h3>
                  <p className="text-slate-600 mb-4">
                    Não existem importações para o período selecionado.
                  </p>
                  <Button onClick={() => navigate('/importar-ficheiros')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Ficheiros
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredImportacoes.map((imp, index) => (
                  <Card key={imp.id || index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={getPlataformaColor(imp.plataforma)}>
                            <span className="flex items-center gap-1 text-xs">
                              {getPlataformaIcon(imp.plataforma)}
                              {imp.plataforma?.toUpperCase() || 'N/A'}
                            </span>
                          </Badge>
                          <div>
                            <p className="font-medium text-sm">{imp.ficheiro_nome || 'Ficheiro importado'}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(imp.data_importacao)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Estado */}
                          <div className="relative">
                            <button 
                              onClick={() => setShowStatusMenu(showStatusMenu === imp.id ? null : imp.id)}
                              className="cursor-pointer"
                            >
                              {getStatusBadge(imp.estado || 'processado')}
                            </button>
                            {showStatusMenu === imp.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                                <button 
                                  onClick={() => handleChangeStatus(imp.id, 'processado')}
                                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-3 h-3 text-green-600" /> Processado
                                </button>
                                <button 
                                  onClick={() => handleChangeStatus(imp.id, 'pendente')}
                                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Clock className="w-3 h-3 text-yellow-600" /> Pendente
                                </button>
                                <button 
                                  onClick={() => handleChangeStatus(imp.id, 'revisto')}
                                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-3 h-3 text-blue-600" /> Revisto
                                </button>
                                <button 
                                  onClick={() => handleChangeStatus(imp.id, 'erro')}
                                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <XCircle className="w-3 h-3 text-red-600" /> Erro
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Dados */}
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Registos</p>
                            <p className="font-bold text-sm">{imp.total_registos || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="font-bold text-sm text-blue-600">
                              {formatCurrency(imp.total_valor)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Semana</p>
                            <p className="font-medium text-sm">
                              S{imp.semana || '-'}/{imp.ano || '-'}
                            </p>
                          </div>
                          
                          {/* Ações */}
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-7 w-7 p-0"
                              onClick={() => setShowDeleteConfirm(imp.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detalhes adicionais */}
                      {imp.detalhes && (
                        <div className="mt-2 pt-2 border-t grid grid-cols-4 gap-4 text-xs">
                          {imp.detalhes.motoristas_afetados && (
                            <div>
                              <span className="text-slate-500">Motoristas:</span>
                              <span className="ml-1 font-medium">{imp.detalhes.motoristas_afetados}</span>
                            </div>
                          )}
                          {imp.detalhes.veiculos_afetados && (
                            <div>
                              <span className="text-slate-500">Veículos:</span>
                              <span className="ml-1 font-medium">{imp.detalhes.veiculos_afetados}</span>
                            </div>
                          )}
                          {imp.detalhes.erros > 0 && (
                            <div>
                              <span className="text-red-500">Erros:</span>
                              <span className="ml-1 font-medium text-red-600">{imp.detalhes.erros}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ListaImportacoes;
