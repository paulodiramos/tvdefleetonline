import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Upload, CheckCircle, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';

const Pagamentos = ({ user, onLogout }) => {
  const [pagamentos, setPagamentos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPagamento, setNewPagamento] = useState({
    motorista_id: '',
    valor: 0,
    periodo_inicio: '',
    periodo_fim: '',
    tipo_documento: 'recibo_verde',
    notas: ''
  });

  useEffect(() => {
    fetchPagamentos();
    fetchMotoristas();
  }, []);

  const fetchPagamentos = async () => {
    try {
      const response = await axios.get(`${API}/pagamentos/semana-atual`);
      setPagamentos(response.data.pagamentos);
      setSummary({
        total_pagar: response.data.total_pagar,
        total_pago: response.data.total_pago,
        periodo: response.data.periodo
      });
    } catch (error) {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchMotoristas = async () => {
    try {
      const response = await axios.get(`${API}/motoristas`);
      setMotoristas(response.data);
    } catch (error) {
      console.error('Erro ao carregar motoristas');
    }
  };

  const handleAddPagamento = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/pagamentos`, newPagamento);
      toast.success('Pagamento criado! Aguardando recibo do motorista.');
      setShowAddDialog(false);
      fetchPagamentos();
      setNewPagamento({
        motorista_id: '',
        valor: 0,
        periodo_inicio: '',
        periodo_fim: '',
        tipo_documento: 'recibo_verde',
        notas: ''
      });
    } catch (error) {
      toast.error('Erro ao criar pagamento');
    }
  };

  const handleUploadDocumento = async (pagamentoId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API}/pagamentos/${pagamentoId}/upload-documento`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Documento carregado e analisado com sucesso!');
      fetchPagamentos();
    } catch (error) {
      toast.error('Erro ao carregar documento');
    }
  };

  const handleMarcarPago = async (pagamentoId) => {
    try {
      await axios.put(`${API}/pagamentos/${pagamentoId}/marcar-pago`);
      toast.success('Pagamento marcado como pago!');
      fetchPagamentos();
    } catch (error) {
      toast.error('Erro ao marcar como pago');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
      pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
      rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' }
    };
    const badge = badges[status] || badges.pendente;
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="pagamentos-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Pagamentos</h1>
            <p className="text-slate-600">Gerir pagamentos a motoristas</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-pagamento-button">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-pagamento-dialog">
              <DialogHeader>
                <DialogTitle>Criar Pagamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPagamento} className="space-y-4">
                <div className="space-y-2">
                  <Label>Motorista *</Label>
                  <Select value={newPagamento.motorista_id} onValueChange={(value) => setNewPagamento({...newPagamento, motorista_id: value})} required>
                    <SelectTrigger data-testid="pagamento-motorista-select">
                      <SelectValue placeholder="Selecionar motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} - {m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (€) *</Label>
                  <Input type="number" step="0.01" value={newPagamento.valor} onChange={(e) => setNewPagamento({...newPagamento, valor: parseFloat(e.target.value)})} required data-testid="pagamento-valor-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Período Início *</Label>
                    <Input type="date" value={newPagamento.periodo_inicio} onChange={(e) => setNewPagamento({...newPagamento, periodo_inicio: e.target.value})} required data-testid="pagamento-inicio-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Período Fim *</Label>
                    <Input type="date" value={newPagamento.periodo_fim} onChange={(e) => setNewPagamento({...newPagamento, periodo_fim: e.target.value})} required data-testid="pagamento-fim-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo Documento *</Label>
                  <Select value={newPagamento.tipo_documento} onValueChange={(value) => setNewPagamento({...newPagamento, tipo_documento: value})}>
                    <SelectTrigger data-testid="pagamento-tipo-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fatura">Fatura</SelectItem>
                      <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={newPagamento.notas} onChange={(e) => setNewPagamento({...newPagamento, notas: e.target.value})} placeholder="Observações..." data-testid="pagamento-notas-input" />
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-pagamento-button">
                  Criar Pagamento
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Semana Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{summary.periodo}</p>
              </CardContent>
            </Card>
            <Card className="card-hover" data-testid="total-pagar-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total a Pagar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span className="text-3xl font-bold text-amber-600">€{summary.total_pagar.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover" data-testid="total-pago-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-3xl font-bold text-emerald-600">€{summary.total_pago.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pagamentos List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentos.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p>Nenhum pagamento nesta semana</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pagamentos.map((pagamento) => (
                  <div key={pagamento.id} className="p-4 bg-slate-50 rounded-lg border" data-testid={`pagamento-${pagamento.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold text-slate-800">{pagamento.motorista_nome}</h4>
                          {getStatusBadge(pagamento.status)}
                        </div>
                        <p className="text-sm text-slate-600">Período: {new Date(pagamento.periodo_inicio).toLocaleDateString('pt-PT')} a {new Date(pagamento.periodo_fim).toLocaleDateString('pt-PT')}</p>
                        <p className="text-sm text-slate-500 capitalize">Tipo: {pagamento.tipo_documento.replace('_', ' ')}</p>
                        {pagamento.notas && (
                          <p className="text-xs text-slate-500 mt-1">Notas: {pagamento.notas}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">€{pagamento.valor.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Document Upload Section */}
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      {!pagamento.documento_url ? (
                        <div className="flex items-center space-x-2 text-sm text-amber-600">
                          <Clock className="w-4 h-4" />
                          <span>Aguardando recibo do motorista</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Documento carregado e analisado</span>
                          </div>
                          {pagamento.analise_documento && (
                            <div className="p-3 bg-blue-50 rounded text-xs space-y-1">
                              <p><strong>Análise do Documento:</strong></p>
                              <p>Tipo detectado: {pagamento.analise_documento.tipo_detectado}</p>
                              <p>Valor detectado: €{pagamento.analise_documento.valor_detectado}</p>
                              <p>Confiança: {(pagamento.analise_documento.confianca * 100).toFixed(0)}%</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex space-x-2">
                        {pagamento.status === 'pendente' && pagamento.documento_url && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleMarcarPago(pagamento.id)}
                            data-testid={`marcar-pago-${pagamento.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar como Pago
                          </Button>
                        )}
                        {!pagamento.documento_url && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) handleUploadDocumento(pagamento.id, file);
                              }}
                              data-testid={`upload-doc-${pagamento.id}`}
                            />
                            <Button size="sm" variant="outline" as="span">
                              <Upload className="w-4 h-4 mr-2" />
                              Carregar Recibo
                            </Button>
                          </label>
                        )}
                      </div>
                    </div>

                    {pagamento.status === 'pago' && pagamento.pago_em && (
                      <div className="mt-3 pt-3 border-t border-emerald-200 bg-emerald-50 p-2 rounded text-sm text-emerald-700">
                        Pago em {new Date(pagamento.pago_em).toLocaleDateString('pt-PT')} às {new Date(pagamento.pago_em).toLocaleTimeString('pt-PT')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Pagamentos;