import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Archive, User, Car, Euro, Calendar, Search, 
  Eye, RotateCcw, FileText, TrendingUp, TrendingDown,
  Loader2, ArrowLeft, Filter, Download
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ArquivoExMotoristas = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exMotoristas, setExMotoristas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [motoristaDetails, setMotoristaDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchExMotoristas();
  }, []);

  const fetchExMotoristas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/arquivo/ex-motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExMotoristas(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar ex-motoristas:', error);
      // Fallback: buscar motoristas inativos
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/api/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const inativos = (response.data || []).filter(m => 
          m.status === 'inativo' || 
          m.status_motorista === 'desativo' || 
          m.deleted === true
        );
        setExMotoristas(inativos);
      } catch (e) {
        toast.error('Erro ao carregar arquivo');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMotoristaDetails = async (motoristaId) => {
    setLoadingDetails(true);
    try {
      const token = localStorage.getItem('token');
      
      // Buscar dados do motorista
      const motoristaRes = await axios.get(`${API}/api/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Buscar histórico de ganhos
      let ganhos = { total_uber: 0, total_bolt: 0, total_geral: 0 };
      try {
        const ganhosRes = await axios.get(`${API}/api/relatorios/motorista/${motoristaId}/historico-ganhos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        ganhos = ganhosRes.data || ganhos;
      } catch (e) {
        console.log('Sem histórico de ganhos');
      }
      
      // Buscar despesas extras
      let despesas = [];
      try {
        const despesasRes = await axios.get(`${API}/api/motoristas/${motoristaId}/despesas-extras`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        despesas = despesasRes.data || [];
      } catch (e) {
        console.log('Sem despesas extras');
      }
      
      // Buscar veículos usados
      let veiculos = [];
      try {
        const veiculosRes = await axios.get(`${API}/api/motoristas/${motoristaId}/historico-veiculos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        veiculos = veiculosRes.data || [];
      } catch (e) {
        // Se não tiver histórico, buscar veículo atual/último
        if (motoristaRes.data?.veiculo_atribuido) {
          try {
            const veiculoRes = await axios.get(`${API}/api/vehicles/${motoristaRes.data.veiculo_atribuido}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            veiculos = [veiculoRes.data];
          } catch (e2) {}
        }
      }
      
      setMotoristaDetails({
        ...motoristaRes.data,
        ganhos,
        despesas,
        veiculos_historico: veiculos
      });
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes do motorista');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleReativar = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/motoristas/${motoristaId}`, 
        { status: 'ativo', status_motorista: 'ativo' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Motorista reativado com sucesso!');
      fetchExMotoristas();
      setShowDetailsModal(false);
    } catch (error) {
      toast.error('Erro ao reativar motorista');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-PT');
  };

  // Filtrar por pesquisa
  const filteredMotoristas = exMotoristas.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term) ||
      (m.phone || '').includes(term)
    );
  });

  // Calcular totais
  const totalDespesas = exMotoristas.reduce((sum, m) => sum + (m.total_despesas || 0), 0);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="arquivo-ex-motoristas">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/motoristas')}
              data-testid="btn-voltar"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Archive className="w-7 h-7" />
                Arquivo de Ex-Motoristas
              </h1>
              <p className="text-slate-500">Histórico de motoristas inativos com ganhos e despesas</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {exMotoristas.length} ex-motorista(s)
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-slate-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-600">Total Ex-Motoristas</span>
              </div>
              <p className="text-2xl font-bold text-slate-700">{exMotoristas.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-sm text-slate-600">Total Despesas Pendentes</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-slate-600">Período</span>
              </div>
              <p className="text-lg font-bold text-blue-700">Histórico Completo</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar por nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              <Button variant="outline" onClick={fetchExMotoristas}>
                <Filter className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Ex-Motoristas Arquivados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : filteredMotoristas.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Arquivo Vazio</h3>
                <p className="text-slate-600">
                  {searchTerm ? 'Nenhum resultado encontrado para a pesquisa.' : 'Não há ex-motoristas arquivados.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Último Veículo</TableHead>
                    <TableHead>Data Saída</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMotoristas.map((motorista) => (
                    <TableRow key={motorista.id} data-testid={`ex-motorista-${motorista.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium">{motorista.name}</p>
                            <p className="text-xs text-slate-500">{motorista.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{motorista.phone || '-'}</p>
                      </TableCell>
                      <TableCell>
                        {motorista.ultimo_veiculo ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Car className="w-4 h-4 text-slate-400" />
                            {motorista.ultimo_veiculo}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(motorista.data_saida || motorista.updated_at)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {motorista.motivo_saida || 'Não especificado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMotorista(motorista);
                              fetchMotoristaDetails(motorista.id);
                            }}
                            disabled={loadingDetails}
                            data-testid={`btn-ver-detalhes-${motorista.id}`}
                          >
                            {loadingDetails && selectedMotorista?.id === motorista.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4 mr-1" />
                            )}
                            Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <h4 className="font-semibold text-slate-700 mb-2">📁 Sobre o Arquivo</h4>
            <p className="text-sm text-slate-600">
              Este arquivo contém o histórico completo dos motoristas que deixaram de estar ativos no parceiro. 
              Pode consultar os ganhos, despesas e veículos utilizados durante o período de atividade.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Detalhes */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Detalhes do Ex-Motorista
            </DialogTitle>
          </DialogHeader>
          
          {motoristaDetails && (
            <div className="space-y-6">
              {/* Info Básica */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg">{motoristaDetails.name}</h3>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div>
                    <span className="text-slate-500">Email:</span>
                    <p>{motoristaDetails.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Telefone:</span>
                    <p>{motoristaDetails.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">NIF:</span>
                    <p>{motoristaDetails.nif || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">IBAN:</span>
                    <p>{motoristaDetails.iban || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Ganhos */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Histórico de Ganhos
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-slate-500">Uber</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(motoristaDetails.ganhos?.total_uber || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-slate-500">Bolt</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(motoristaDetails.ganhos?.total_bolt || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-xl font-bold text-blue-600">
                        {formatCurrency(motoristaDetails.ganhos?.total_geral || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Veículos */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-600" />
                  Veículos Utilizados
                </h4>
                {motoristaDetails.veiculos_historico?.length > 0 ? (
                  <div className="space-y-2">
                    {motoristaDetails.veiculos_historico.map((v, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{v.matricula || v.license_plate}</span>
                          <span className="text-slate-500">{v.marca} {v.modelo}</span>
                        </div>
                        <Badge variant="outline">{v.ano || '-'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Sem histórico de veículos</p>
                )}
              </div>

              {/* Despesas */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Despesas/Extras Pendentes
                </h4>
                {motoristaDetails.despesas?.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {motoristaDetails.despesas.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-red-50 p-3 rounded">
                        <div>
                          <span className="font-medium">{d.descricao || d.tipo}</span>
                          <p className="text-xs text-slate-500">{formatDate(d.data)}</p>
                        </div>
                        <Badge variant="destructive">{formatCurrency(d.valor)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-600">Sem despesas pendentes</p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Fechar
            </Button>
            <Button 
              onClick={() => handleReativar(motoristaDetails?.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reativar Motorista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ArquivoExMotoristas;
