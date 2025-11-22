import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Download, Eye, Search, Filter, Calendar, User, Car, Building, Euro, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TIPOS_CONTRATO = {
  'aluguer_sem_caucao': 'Aluguer sem Caução',
  'aluguer_com_caucao': 'Aluguer com Caução',
  'aluguer_caucao_parcelada': 'Aluguer com Caução Parcelada',
  'periodo_epoca': 'Período de Época',
  'aluguer_epocas_sem_caucao': 'Aluguer com Épocas sem Caução',
  'aluguer_epocas_caucao': 'Aluguer com Épocas e Caução',
  'aluguer_epoca_caucao_parcelada': 'Aluguer Época com Caução Parcelada',
  'compra_veiculo': 'Compra de Veículo',
  'comissao': 'Comissão',
  'motorista_privado': 'Motorista Privado',
  'outros': 'Outros'
};

const STATUS_COLORS = {
  'ativo': 'bg-green-100 text-green-800 border-green-200',
  'terminado': 'bg-slate-100 text-slate-800 border-slate-200',
  'cancelado': 'bg-red-100 text-red-800 border-red-200'
};

const Contratos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  
  // Modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  const [parceiroDetalhes, setParceiroDetalhes] = useState(null);
  const [motoristaDetalhes, setMotoristaDetalhes] = useState(null);
  const [veiculoDetalhes, setVeiculoDetalhes] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch contratos
      const contratosRes = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContratos(contratosRes.data);

      // Fetch parceiros
      const parceirosRes = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(parceirosRes.data);

      // Fetch motoristas
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(motoristasRes.data);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (contrato) => {
    setContratoSelecionado(contrato);
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch parceiro details
      const parceiroRes = await axios.get(`${API}/parceiros/${contrato.parceiro_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiroDetalhes(parceiroRes.data);
      
      // Fetch motorista details
      const motorista = motoristas.find(m => m.id === contrato.motorista_id);
      setMotoristaDetalhes(motorista);
      
      // Fetch veiculo details if exists
      if (contrato.veiculo_id) {
        const veiculoRes = await axios.get(`${API}/vehicles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const veiculo = veiculoRes.data.find(v => v.id === contrato.veiculo_id);
        setVeiculoDetalhes(veiculo);
      } else {
        setVeiculoDetalhes(null);
      }
      
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Erro ao carregar detalhes');
    }
  };

  const handleDownloadPDF = (contrato) => {
    if (contrato.pdf_url) {
      window.open(`${API}${contrato.pdf_url}`, '_blank');
    } else {
      toast.error('PDF não disponível');
    }
  };

  const handleGerarPDF = async (contratoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/contratos/${contratoId}/gerar-pdf`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('PDF gerado com sucesso!');
      fetchData(); // Refresh to get updated PDF URL
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  // Filtrar contratos
  const contratosFiltrados = contratos.filter(contrato => {
    // Filtro por status
    if (filtroStatus !== 'todos' && contrato.status !== filtroStatus) return false;
    
    // Filtro por parceiro
    if (filtroParceiro && contrato.parceiro_id !== filtroParceiro) return false;
    
    // Filtro por motorista
    if (filtroMotorista && contrato.motorista_id !== filtroMotorista) return false;
    
    // Busca por texto
    if (filtroBusca) {
      const motorista = motoristas.find(m => m.id === contrato.motorista_id);
      const searchText = `${contrato.nome_template} ${motorista?.name || ''} ${contrato.id}`.toLowerCase();
      if (!searchText.includes(filtroBusca.toLowerCase())) return false;
    }
    
    return true;
  });

  const getMotoristaName = (motoristaId) => {
    const motorista = motoristas.find(m => m.id === motoristaId);
    return motorista?.name || 'N/A';
  };

  const getParceiroName = (parceiroId) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    return parceiro?.nome_empresa || parceiro?.name || 'N/A';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Contratos</h1>
            <p className="text-slate-600 mt-2">
              Gerencie e visualize todos os contratos de motoristas
            </p>
          </div>
          <Button onClick={() => navigate('/criar-contrato')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Contrato
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Busca */}
              <div>
                <Label htmlFor="busca">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="busca"
                    placeholder="Nome, template, ID..."
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="terminado">Terminado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parceiro */}
              {(user.role === 'admin' || user.role === 'gestao') && (
                <div>
                  <Label htmlFor="parceiro">Parceiro</Label>
                  <Select value={filtroParceiro || 'all'} onValueChange={(val) => setFiltroParceiro(val === 'all' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {parceiros.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_empresa || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Motorista */}
              <div>
                <Label htmlFor="motorista">Motorista</Label>
                <Select value={filtroMotorista || 'all'} onValueChange={(val) => setFiltroMotorista(val === 'all' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {motoristas.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Limpar filtros */}
            {(filtroBusca || filtroStatus !== 'todos' || filtroParceiro || filtroMotorista) && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setFiltroBusca('');
                    setFiltroStatus('todos');
                    setFiltroParceiro('');
                    setFiltroMotorista('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Contratos */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">Carregando contratos...</p>
            </CardContent>
          </Card>
        ) : contratosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg font-medium">Nenhum contrato encontrado</p>
              <p className="text-slate-400 text-sm mt-2">
                {contratos.length === 0 
                  ? 'Crie o primeiro contrato clicando em "Novo Contrato"'
                  : 'Tente ajustar os filtros'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {contratosFiltrados.map((contrato) => (
              <Card key={contrato.id} className="hover:shadow-md transition">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <Badge className={STATUS_COLORS[contrato.status]}>
                          {contrato.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          ID: {contrato.id.substring(0, 8)}...
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold mb-2">
                        {contrato.nome_template}
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Parceiro</p>
                            <p className="font-medium">{getParceiroName(contrato.parceiro_id)}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Motorista</p>
                            <p className="font-medium">{getMotoristaName(contrato.motorista_id)}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Tipo</p>
                            <p className="font-medium text-xs">
                              {TIPOS_CONTRATO[contrato.tipo_contrato]}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Euro className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Valor</p>
                            <p className="font-medium">
                              €{contrato.valor_aplicado} ({contrato.periodicidade})
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 mt-3 text-xs text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Início: {contrato.data_inicio}</span>
                        </div>
                        {contrato.data_fim && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>Fim: {contrato.data_fim}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewDetails(contrato)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Detalhes
                      </Button>
                      
                      {contrato.pdf_url ? (
                        <Button 
                          size="sm"
                          onClick={() => handleDownloadPDF(contrato)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => handleGerarPDF(contrato.id)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Gerar PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{contratos.length}</p>
                <p className="text-sm text-slate-600">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {contratos.filter(c => c.status === 'ativo').length}
                </p>
                <p className="text-sm text-slate-600">Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-600">
                  {contratos.filter(c => c.status === 'terminado').length}
                </p>
                <p className="text-sm text-slate-600">Terminados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {contratos.filter(c => c.status === 'cancelado').length}
                </p>
                <p className="text-sm text-slate-600">Cancelados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>

          {contratoSelecionado && (
            <div className="space-y-6 mt-4">
              {/* Status e Tipo */}
              <div className="flex items-center space-x-3">
                <Badge className={STATUS_COLORS[contratoSelecionado.status]} className="text-base px-3 py-1">
                  {contratoSelecionado.status.toUpperCase()}
                </Badge>
                <span className="text-slate-600">
                  {TIPOS_CONTRATO[contratoSelecionado.tipo_contrato]}
                </span>
              </div>

              {/* Informações Principais */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <Building className="w-4 h-4 mr-2" />
                      Parceiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{parceiroDetalhes?.nome_empresa || parceiroDetalhes?.name}</p>
                    <p className="text-sm text-slate-600">{parceiroDetalhes?.email}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Motorista
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{motoristaDetalhes?.name}</p>
                    <p className="text-sm text-slate-600">{motoristaDetalhes?.email}</p>
                    <p className="text-sm text-slate-600">{motoristaDetalhes?.phone}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Veículo (se houver) */}
              {veiculoDetalhes && (
                <Card className="bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <Car className="w-4 h-4 mr-2" />
                      Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">
                      {veiculoDetalhes.marca} {veiculoDetalhes.modelo}
                    </p>
                    <p className="text-sm text-slate-600">Matrícula: {veiculoDetalhes.matricula}</p>
                    <p className="text-sm text-slate-600">Ano: {veiculoDetalhes.ano}</p>
                  </CardContent>
                </Card>
              )}

              {/* Valores e Condições */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Valores e Condições</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Periodicidade</p>
                      <p className="font-semibold capitalize">{contratoSelecionado.periodicidade}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Valor</p>
                      <p className="font-semibold">€{contratoSelecionado.valor_aplicado}</p>
                    </div>
                  </div>

                  {contratoSelecionado.valor_caucao_aplicado && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Caução</p>
                        <p className="font-semibold">€{contratoSelecionado.valor_caucao_aplicado}</p>
                      </div>
                      {contratoSelecionado.numero_parcelas_caucao_aplicado && (
                        <div>
                          <p className="text-sm text-slate-600">Parcelas de Caução</p>
                          <p className="font-semibold">
                            {contratoSelecionado.numero_parcelas_caucao_aplicado}x 
                            €{contratoSelecionado.valor_parcela_caucao_aplicado}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {contratoSelecionado.percentagem_motorista_aplicado && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Comissão Motorista</p>
                        <p className="font-semibold">{contratoSelecionado.percentagem_motorista_aplicado}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Comissão Parceiro</p>
                        <p className="font-semibold">{contratoSelecionado.percentagem_parceiro_aplicado}%</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Data Início</p>
                      <p className="font-semibold">{contratoSelecionado.data_inicio}</p>
                    </div>
                    {contratoSelecionado.data_fim && (
                      <div>
                        <p className="text-sm text-slate-600">Data Fim</p>
                        <p className="font-semibold">{contratoSelecionado.data_fim}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cláusulas */}
              {contratoSelecionado.clausulas_texto && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cláusulas Contratuais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded">
                      {contratoSelecionado.clausulas_texto}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                  Fechar
                </Button>
                {contratoSelecionado.pdf_url && (
                  <Button onClick={() => handleDownloadPDF(contratoSelecionado)}>
                    <Download className="w-4 h-4 mr-2" />
                    Descarregar PDF
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Contratos;
