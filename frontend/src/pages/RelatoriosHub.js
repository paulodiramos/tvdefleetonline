import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  FileText, Plus, Edit, Check, X, Download, ArrowLeft,
  Calendar, User, DollarSign, TrendingUp, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RelatoriosHub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('todos');
  const [relatorios, setRelatorios] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de criação rápida
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [novoRelatorio, setNovoRelatorio] = useState({
    motorista_id: '',
    semana: '',
    ano: new Date().getFullYear(),
    ganhos_uber: 0,
    ganhos_bolt: 0,
    combustivel_total: 0,
    via_verde_total: 0,
    caucao_semanal: 0,
    outros: 0,
    divida_anterior: 0
  });

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  // Modal de edição rápida
  const [showEditModal, setShowEditModal] = useState(false);
  const [relatorioEditando, setRelatorioEditando] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [relRes, motRes] = await Promise.all([
        axios.get(`${API_URL}/api/relatorios/semanais-todos`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setRelatorios(relRes.data || []);
      setMotoristas(motRes.data || []);
      console.log('Motoristas carregados:', motRes.data?.length || 0);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
      setRelatorios([]);
      setMotoristas([]);
    } finally {
      setLoading(false);
    }
  };

  const calcularTotais = (dados) => {
    const ganhos = parseFloat(dados.ganhos_uber || 0) + parseFloat(dados.ganhos_bolt || 0);
    const despesas = 
      parseFloat(dados.combustivel_total || 0) +
      parseFloat(dados.via_verde_total || 0) +
      parseFloat(dados.caucao_semanal || 0) +
      parseFloat(dados.outros || 0);
    const dividaAnterior = parseFloat(dados.divida_anterior || 0);
    const total = ganhos - despesas - dividaAnterior;
    
    return { 
      ganhos, 
      despesas, 
      dividaAnterior,
      total,
      proximaDivida: total < 0 ? Math.abs(total) : 0
    };
  };

  const handleCriarRapido = async () => {
    console.log('=== Iniciando criação de relatório ===');
    console.log('Dados do formulário:', novoRelatorio);
    console.log('Total de motoristas disponíveis:', motoristas.length);
    
    if (!novoRelatorio.motorista_id) {
      toast.error('Selecione um motorista');
      return;
    }
    
    if (!novoRelatorio.semana) {
      toast.error('Preencha a semana');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais(novoRelatorio);
      const motorista = motoristas.find(m => m.id === novoRelatorio.motorista_id);
      
      console.log('Motorista encontrado:', motorista);
      console.log('Totais calculados:', totais);

      const payload = {
        motorista_id: novoRelatorio.motorista_id,
        semana: parseInt(novoRelatorio.semana),
        ano: parseInt(novoRelatorio.ano),
        ganhos_uber: parseFloat(novoRelatorio.ganhos_uber) || 0,
        ganhos_bolt: parseFloat(novoRelatorio.ganhos_bolt) || 0,
        combustivel_total: parseFloat(novoRelatorio.combustivel_total) || 0,
        via_verde_total: parseFloat(novoRelatorio.via_verde_total) || 0,
        caucao_semanal: parseFloat(novoRelatorio.caucao_semanal) || 0,
        outros: parseFloat(novoRelatorio.outros) || 0,
        divida_anterior: parseFloat(novoRelatorio.divida_anterior) || 0,
        ganhos_totais: totais.ganhos,
        total_despesas: totais.despesas,
        total_recibo: totais.total,
        proxima_divida: totais.proximaDivida,
        motorista_nome: motorista?.name || motorista?.nome || motorista?.email || '',
        veiculo_matricula: motorista?.veiculo_matricula || motorista?.matricula || '',
        status: 'pendente_aprovacao',
        estado: 'pendente_aprovacao',
        parceiro_id: user.id
      };
      
      console.log('Payload a enviar:', payload);

      const response = await axios.post(`${API_URL}/api/relatorios/criar-manual`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Resposta do servidor:', response.data);

      toast.success('Relatório criado com sucesso!');
      setShowCriarModal(false);
      setNovoRelatorio({
        motorista_id: '',
        semana: '',
        ano: new Date().getFullYear(),
        ganhos_uber: 0,
        ganhos_bolt: 0,
        combustivel_total: 0,
        via_verde_total: 0,
        caucao_semanal: 0,
        outros: 0,
        divida_anterior: 0
      });
      fetchData();
    } catch (error) {
      console.error('=== ERRO COMPLETO ===');
      console.error('Error object:', error);
      console.error('Response:', error.response);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      const errorMsg = error.response?.data?.detail || error.message || 'Erro ao criar relatório';
      toast.error(errorMsg);
    }
  };

  const handleEditar = (relatorio) => {
    setRelatorioEditando({ ...relatorio });
    setShowEditModal(true);
  };

  const handleSalvarEdicao = async () => {
    try {
      const token = localStorage.getItem('token');
      const totais = calcularTotais(relatorioEditando);

      await axios.put(`${API_URL}/api/relatorios/semanal/${relatorioEditando.id}`, {
        ...relatorioEditando,
        ganhos_totais: totais.ganhos,
        total_despesas: totais.despesas,
        divida_anterior: totais.dividaAnterior,
        total_recibo: totais.total,
        proxima_divida: totais.proximaDivida,
        status: relatorioEditando.status,
        estado: relatorioEditando.estado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Relatório atualizado!');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleAprovar = async (relatorioId) => {
    if (!window.confirm('Aprovar este relatório?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioId}/aprovar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Relatório aprovado!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao aprovar');
    }
  };

  const handleRejeitar = async (relatorioId) => {
    if (!window.confirm('Rejeitar este relatório?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/relatorios/semanal/${relatorioId}/rejeitar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Relatório rejeitado');
      fetchData();
    } catch (error) {
      toast.error('Erro ao rejeitar');
    }
  };

  const handleDownloadPDF = async (relatorioId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/semanal/${relatorioId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${relatorioId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF baixado!');
    } catch (error) {
      toast.error('Erro ao baixar PDF');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      'rascunho': { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
      'pendente_aprovacao': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
      'aguarda_recibo': { label: 'Aguarda Recibo', color: 'bg-orange-100 text-orange-700' },
      'verificado': { label: 'Verificado', color: 'bg-green-100 text-green-700' },
      'pago': { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
      'rejeitado': { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  const filtrarRelatorios = (status) => {
    let filtrados = relatorios;
    
    // Filtro por status (tab)
    if (status === 'pendentes') filtrados = filtrados.filter(r => r.status === 'pendente_aprovacao');
    else if (status === 'aguarda') filtrados = filtrados.filter(r => r.status === 'aguarda_recibo');
    else if (status === 'pagamentos') filtrados = filtrados.filter(r => r.status === 'verificado' || r.status === 'pago');
    
    // Filtro por data
    if (filtroDataInicio) {
      filtrados = filtrados.filter(r => {
        const dataRel = new Date(r.data_inicio || r.data_emissao);
        return dataRel >= new Date(filtroDataInicio);
      });
    }
    if (filtroDataFim) {
      filtrados = filtrados.filter(r => {
        const dataRel = new Date(r.data_fim || r.data_emissao);
        return dataRel <= new Date(filtroDataFim);
      });
    }
    
    // Filtro por semana/ano
    if (filtroSemana) {
      filtrados = filtrados.filter(r => r.semana?.toString() === filtroSemana);
    }
    if (filtroAno) {
      filtrados = filtrados.filter(r => r.ano?.toString() === filtroAno);
    }
    
    return filtrados;
  };

  const relatoriosFiltrados = filtrarRelatorios(activeTab);

  const stats = {
    total: relatorios.length,
    pendentes: relatorios.filter(r => r.status === 'pendente_aprovacao').length,
    aguardaRecibo: relatorios.filter(r => r.status === 'aguarda_recibo').length,
    paraPagar: relatorios.filter(r => r.status === 'verificado').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Relatórios Semanais
              </h1>
              <p className="text-slate-600">
                Gerir todos os relatórios num único lugar
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCriarModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Relatório
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Aguarda Recibo</p>
              <p className="text-2xl font-bold text-orange-600">{stats.aguardaRecibo}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600">Para Pagar</p>
              <p className="text-2xl font-bold text-green-600">{stats.paraPagar}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
              <div>
                <Label>Semana</Label>
                <Input
                  type="number"
                  placeholder="1-52"
                  min="1"
                  max="52"
                  value={filtroSemana}
                  onChange={(e) => setFiltroSemana(e.target.value)}
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setFiltroDataInicio('');
                    setFiltroDataFim('');
                    setFiltroSemana('');
                    setFiltroAno('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes ({stats.pendentes})</TabsTrigger>
            <TabsTrigger value="aguarda">Aguarda Recibo ({stats.aguardaRecibo})</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos ({stats.paraPagar})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {relatoriosFiltrados.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum relatório</h3>
                  <p className="text-slate-600 mb-4">
                    Crie o primeiro relatório para começar
                  </p>
                  <Button onClick={() => setShowCriarModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Relatório
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {relatoriosFiltrados.map((rel) => (
                  <Card key={rel.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold">{rel.motorista_nome}</h3>
                            {getStatusBadge(rel.status)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-600">Período</p>
                              <p className="font-semibold">S{rel.semana}/{rel.ano}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Ganhos</p>
                              <p className="font-semibold text-green-600">
                                €{(rel.ganhos_totais || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">Despesas</p>
                              <p className="font-semibold text-red-600">
                                €{(rel.total_despesas || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">Total</p>
                              <p className="text-lg font-bold text-blue-600">
                                €{(rel.total_recibo || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditar(rel)}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          {rel.status === 'pendente_aprovacao' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAprovar(rel.id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Aprovar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(rel.id)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal Criar */}
        <Dialog open={showCriarModal} onOpenChange={setShowCriarModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Relatório Rápido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <Label>Motorista *</Label>
                  <select
                    value={novoRelatorio.motorista_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedMotorista = motoristas.find(m => m.id === selectedId);
                      console.log('Motorista selecionado:', selectedMotorista);
                      setNovoRelatorio({ ...novoRelatorio, motorista_id: selectedId });
                    }}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="">Selecione um motorista</option>
                    {motoristas && motoristas.length > 0 ? (
                      motoristas.map(m => {
                        const nome = m.name || m.nome || m.email || 'Sem nome';
                        const matricula = m.veiculo_matricula || m.matricula || 'S/M';
                        return (
                          <option key={m.id} value={m.id}>
                            {nome} {matricula !== 'S/M' ? `- ${matricula}` : ''}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>Nenhum motorista disponível</option>
                    )}
                  </select>
                  {motoristas.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Nenhum motorista encontrado. Verifique se existem motoristas cadastrados.
                    </p>
                  )}
                  {motoristas.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Total: {motoristas.length} motorista(s) disponível(is)
                    </p>
                  )}
                </div>
                <div>
                  <Label>Semana *</Label>
                  <Input
                    type="number"
                    value={novoRelatorio.semana}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, semana: e.target.value })}
                    placeholder="1-52"
                  />
                </div>
                <div>
                  <Label>Ano *</Label>
                  <Input
                    type="number"
                    value={novoRelatorio.ano}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ano: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ganhos Uber (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.ganhos_uber}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ganhos_uber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ganhos Bolt (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.ganhos_bolt}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, ganhos_bolt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Combustível (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.combustivel_total}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, combustivel_total: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Via Verde (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.via_verde_total}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, via_verde_total: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Caução (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.caucao_semanal}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, caucao_semanal: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Outros (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.outros}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, outros: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dívida Anterior (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoRelatorio.divida_anterior}
                    onChange={(e) => setNovoRelatorio({ ...novoRelatorio, divida_anterior: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Dívida da semana anterior (se existir)
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Ganhos:</span>
                  <span className="font-bold text-green-600">
                    €{calcularTotais(novoRelatorio).ganhos.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Despesas:</span>
                  <span className="font-bold text-red-600">
                    €{calcularTotais(novoRelatorio).despesas.toFixed(2)}
                  </span>
                </div>
                {calcularTotais(novoRelatorio).dividaAnterior > 0 && (
                  <div className="flex justify-between text-sm mb-2">
                    <span>Dívida Anterior:</span>
                    <span className="font-bold text-orange-600">
                      €{calcularTotais(novoRelatorio).dividaAnterior.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className={`text-lg font-bold ${calcularTotais(novoRelatorio).total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    €{calcularTotais(novoRelatorio).total.toFixed(2)}
                  </span>
                </div>
                {calcularTotais(novoRelatorio).total < 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      ⚠️ Valor negativo! Próxima dívida: €{calcularTotais(novoRelatorio).proximaDivida.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCriarModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarRapido}>
                Criar Relatório
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Editar */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Relatório</DialogTitle>
            </DialogHeader>
            {relatorioEditando && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded">
                  <p className="font-semibold">{relatorioEditando.motorista_nome}</p>
                  <p className="text-sm text-slate-600">
                    Semana {relatorioEditando.semana}/{relatorioEditando.ano}
                  </p>
                </div>

                <div>
                  <Label>Estado do Relatório</Label>
                  <select
                    value={relatorioEditando.status || relatorioEditando.estado}
                    onChange={(e) => setRelatorioEditando({ 
                      ...relatorioEditando, 
                      status: e.target.value,
                      estado: e.target.value
                    })}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="pendente_aprovacao">Pendente Aprovação</option>
                    <option value="aguarda_recibo">Aguarda Recibo</option>
                    <option value="verificado">Verificado</option>
                    <option value="pago">Pago</option>
                    <option value="rejeitado">Rejeitado</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ganhos Uber (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_uber || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, ganhos_uber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Ganhos Bolt (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_bolt || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, ganhos_bolt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Combustível (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.combustivel_total || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, combustivel_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Via Verde (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.via_verde_total || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, via_verde_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Caução (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.caucao_semanal || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, caucao_semanal: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Outros (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.outros || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, outros: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Dívida Anterior (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.divida_anterior || 0}
                      onChange={(e) => setRelatorioEditando({ ...relatorioEditando, divida_anterior: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Ajustar dívida da semana anterior manualmente
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Ganhos:</span>
                    <span className="font-bold text-green-600">
                      €{calcularTotais(relatorioEditando).ganhos.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Despesas:</span>
                    <span className="font-bold text-red-600">
                      €{calcularTotais(relatorioEditando).despesas.toFixed(2)}
                    </span>
                  </div>
                  {calcularTotais(relatorioEditando).dividaAnterior > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span>Dívida Anterior:</span>
                      <span className="font-bold text-orange-600">
                        €{calcularTotais(relatorioEditando).dividaAnterior.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total:</span>
                    <span className={`text-lg font-bold ${calcularTotais(relatorioEditando).total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      €{calcularTotais(relatorioEditando).total.toFixed(2)}
                    </span>
                  </div>
                  {calcularTotais(relatorioEditando).total < 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-700">
                        ⚠️ Valor negativo! Próxima dívida: €{calcularTotais(relatorioEditando).proximaDivida.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarEdicao}>
                Guardar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RelatoriosHub;
