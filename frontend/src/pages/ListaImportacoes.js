import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ListaImportacoes = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [importacoes, setImportacoes] = useState([]);
  const [resumoPorPlataforma, setResumoPorPlataforma] = useState({});
  const [activeTab, setActiveTab] = useState('todas');
  
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
      
      let url = `${API}/api/importacoes/historico`;
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Lista de Importações
              </h1>
              <p className="text-slate-600">
                Histórico de ficheiros importados e dados resumidos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={fetchImportacoes}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button 
              onClick={() => navigate('/importar-ficheiros')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Nova Importação
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">Filtrar por:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filtroTipo === 'semana' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFiltroTipo('semana')}
                >
                  Semana
                </Button>
                <Button
                  variant={filtroTipo === 'periodo' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFiltroTipo('periodo')}
                >
                  Período
                </Button>
              </div>
            </div>

            {filtroTipo === 'semana' ? (
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePreviousWeek}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-lg font-semibold">
                    Semana {semana}/{ano}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNextWeek}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
              <div className="space-y-4">
                {filteredImportacoes.map((imp, index) => (
                  <Card key={imp.id || index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge className={getPlataformaColor(imp.plataforma)}>
                            <span className="flex items-center gap-1">
                              {getPlataformaIcon(imp.plataforma)}
                              {imp.plataforma?.toUpperCase() || 'N/A'}
                            </span>
                          </Badge>
                          <div>
                            <p className="font-semibold">{imp.ficheiro_nome || 'Ficheiro importado'}</p>
                            <p className="text-sm text-slate-500">
                              Importado em: {formatDate(imp.data_importacao)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Registos</p>
                            <p className="font-bold text-lg">{imp.total_registos || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="font-bold text-lg text-blue-600">
                              {formatCurrency(imp.total_valor)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-500">Semana</p>
                            <p className="font-semibold">
                              {imp.semana || '-'}/{imp.ano || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detalhes adicionais */}
                      {imp.detalhes && (
                        <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-4 text-sm">
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
    </div>
  );
};

export default ListaImportacoes;
