import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  DollarSign, CheckCircle, Eye, Send, ArrowLeft, FileText, 
  Calendar, User, Car, Clock, Check, X 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PagamentosRelatoriosSemanais = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, verificado, pago
  const [showMarcarPagoModal, setShowMarcarPagoModal] = useState(false);
  const [relatorioSelecionado, setRelatorioSelecionado] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState('transferencia');
  const [observacoesPagamento, setObservacoesPagamento] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    fetchRelatorios();
  }, []);

  const fetchRelatorios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/semanais-para-pagamento`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRelatorios(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios para pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarComoPago = async () => {
    if (!dataPagamento) {
      toast.error('Por favor, insira a data de pagamento');
      return;
    }

    setProcessando(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/relatorios/semanal/${relatorioSelecionado.id}/marcar-pago`,
        {
          data_pagamento: dataPagamento,
          metodo_pagamento: metodoPagamento,
          observacoes: observacoesPagamento
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Relatório marcado como pago com sucesso!');
      setShowMarcarPagoModal(false);
      setRelatorioSelecionado(null);
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setMetodoPagamento('transferencia');
      setObservacoesPagamento('');
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      toast.error(error.response?.data?.detail || 'Erro ao marcar como pago');
    } finally {
      setProcessando(false);
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
      
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      toast.error('Erro ao baixar PDF');
    }
  };

  const openMarcarPagoModal = (relatorio) => {
    setRelatorioSelecionado(relatorio);
    setShowMarcarPagoModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'gerado': { label: 'Gerado', color: 'bg-blue-100 text-blue-700' },
      'enviado': { label: 'Enviado', color: 'bg-purple-100 text-purple-700' },
      'recibo_anexado': { label: 'Recibo Anexado', color: 'bg-orange-100 text-orange-700' },
      'verificado': { label: 'Verificado', color: 'bg-green-100 text-green-700' },
      'pago': { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
    };
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const relatoriosFiltrados = relatorios.filter(rel => {
    if (filtroStatus === 'todos') return true;
    if (filtroStatus === 'verificado') return rel.status === 'verificado';
    if (filtroStatus === 'pago') return rel.status === 'pago';
    return true;
  });

  const estatisticas = {
    total: relatorios.length,
    verificados: relatorios.filter(r => r.status === 'verificado').length,
    pagos: relatorios.filter(r => r.status === 'pago').length,
    valorTotal: relatorios
      .filter(r => r.status === 'verificado')
      .reduce((sum, r) => sum + (r.total_recibo || 0), 0),
    valorPago: relatorios
      .filter(r => r.status === 'pago')
      .reduce((sum, r) => sum + (r.total_recibo || 0), 0),
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
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center space-x-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Pagamentos de Relatórios
              </h1>
              <p className="text-slate-600">
                Gerir pagamentos dos relatórios semanais
              </p>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-slate-800">{estatisticas.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Verificados</p>
                <p className="text-2xl font-bold text-green-600">{estatisticas.verificados}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Pagos</p>
                <p className="text-2xl font-bold text-emerald-600">{estatisticas.pagos}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">A Pagar</p>
                <p className="text-2xl font-bold text-orange-600">€{estatisticas.valorTotal.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Pago</p>
                <p className="text-2xl font-bold text-green-600">€{estatisticas.valorPago.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={filtroStatus === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('todos')}
          >
            Todos ({relatorios.length})
          </Button>
          <Button
            variant={filtroStatus === 'verificado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('verificado')}
          >
            Verificados ({estatisticas.verificados})
          </Button>
          <Button
            variant={filtroStatus === 'pago' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('pago')}
          >
            Pagos ({estatisticas.pagos})
          </Button>
        </div>

        {/* Lista de Relatórios */}
        {relatoriosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum relatório encontrado</h3>
              <p className="text-slate-600">
                Não há relatórios {filtroStatus === 'verificado' ? 'verificados' : filtroStatus === 'pago' ? 'pagos' : ''} no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {relatoriosFiltrados.map((relatorio) => (
              <Card key={relatorio.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Info do Relatório */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            {relatorio.motorista_nome}
                          </h3>
                          <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                            <FileText className="w-4 h-4" />
                            {relatorio.numero_relatorio}
                          </p>
                        </div>
                        {getStatusBadge(relatorio.status)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Período:</span>
                          <span className="font-semibold">
                            Semana {relatorio.semana}/{relatorio.ano}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Datas:</span>
                          <span className="font-semibold">
                            {new Date(relatorio.data_inicio).toLocaleDateString('pt-PT')} - {new Date(relatorio.data_fim).toLocaleDateString('pt-PT')}
                          </span>
                        </div>
                        {relatorio.veiculo_matricula && (
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">Veículo:</span>
                            <span className="font-semibold">
                              {relatorio.veiculo_marca} {relatorio.veiculo_modelo} ({relatorio.veiculo_matricula})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info de Pagamento (se pago) */}
                      {relatorio.status === 'pago' && relatorio.data_pagamento && (
                        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Pagamento Realizado
                          </p>
                          <div className="text-xs text-green-700 space-y-1">
                            <p>Data: {new Date(relatorio.data_pagamento).toLocaleDateString('pt-PT')}</p>
                            {relatorio.metodo_pagamento && (
                              <p>Método: {relatorio.metodo_pagamento}</p>
                            )}
                            {relatorio.observacoes_pagamento && (
                              <p>Obs: {relatorio.observacoes_pagamento}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Info de Recibo (se verificado) */}
                      {relatorio.status === 'verificado' && relatorio.recibo_url && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Recibo Anexado</p>
                          <a 
                            href={relatorio.recibo_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver recibo →
                          </a>
                          {relatorio.observacoes_recibo && (
                            <p className="text-xs text-blue-700 mt-1">
                              {relatorio.observacoes_recibo}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Valores */}
                    <div className="border-l pl-6">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Valores</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Viagens:</span>
                          <span className="font-bold">{relatorio.viagens_totais || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Ganhos:</span>
                          <span className="font-bold text-green-600">€{(relatorio.ganhos_totais || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Despesas:</span>
                          <span className="font-bold text-red-600">€{(relatorio.total_despesas || 0).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between items-center">
                          <span className="text-sm font-semibold">Total:</span>
                          <span className="text-lg font-bold text-blue-600">
                            €{(relatorio.total_recibo || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detalhes de Despesas */}
                    <div className="border-l pl-6">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Despesas</h4>
                      <div className="space-y-2 text-xs">
                        {relatorio.combustivel_total > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Combustível:</span>
                            <span className="font-semibold">€{relatorio.combustivel_total.toFixed(2)}</span>
                          </div>
                        )}
                        {relatorio.via_verde_total > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Via Verde:</span>
                            <span className="font-semibold">€{relatorio.via_verde_total.toFixed(2)}</span>
                          </div>
                        )}
                        {relatorio.caucao_semanal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Caução:</span>
                            <span className="font-semibold">€{relatorio.caucao_semanal.toFixed(2)}</span>
                          </div>
                        )}
                        {relatorio.outros > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Outros:</span>
                            <span className="font-semibold">€{relatorio.outros.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(relatorio.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver PDF
                      </Button>

                      {relatorio.status === 'verificado' && (
                        <Button
                          size="sm"
                          onClick={() => openMarcarPagoModal(relatorio)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Marcar como Pago
                        </Button>
                      )}

                      {relatorio.status === 'pago' && (
                        <div className="p-2 bg-green-50 rounded text-center">
                          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                          <p className="text-xs font-semibold text-green-700">Pago</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Marcar como Pago */}
        <Dialog open={showMarcarPagoModal} onOpenChange={setShowMarcarPagoModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar Relatório como Pago</DialogTitle>
            </DialogHeader>
            
            {relatorioSelecionado && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-semibold">{relatorioSelecionado.motorista_nome}</p>
                  <p className="text-xs text-slate-600">{relatorioSelecionado.numero_relatorio}</p>
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    €{(relatorioSelecionado.total_recibo || 0).toFixed(2)}
                  </p>
                </div>

                <div>
                  <Label>Data de Pagamento *</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Método de Pagamento *</Label>
                  <select
                    value={metodoPagamento}
                    onChange={(e) => setMetodoPagamento(e.target.value)}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="mbway">MB Way</option>
                    <option value="multibanco">Multibanco</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Observações opcionais sobre o pagamento"
                    value={observacoesPagamento}
                    onChange={(e) => setObservacoesPagamento(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMarcarPagoModal(false);
                  setRelatorioSelecionado(null);
                }}
                disabled={processando}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleMarcarComoPago}
                disabled={processando || !dataPagamento}
                className="bg-green-600 hover:bg-green-700"
              >
                {processando ? 'A processar...' : 'Confirmar Pagamento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PagamentosRelatoriosSemanais;
