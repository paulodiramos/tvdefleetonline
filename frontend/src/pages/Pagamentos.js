import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import FilterBar from '@/components/FilterBar';
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
  const [filters, setFilters] = useState({
    motorista: 'all',
    status: 'all',
    search: ''
  });
  const [newPagamento, setNewPagamento] = useState({
    motorista_id: '',
    valor: 0,
    periodo_inicio: '',
    periodo_fim: '',
    tipo_documento: 'recibo_verde',
    notas: ''
  });

  // Função para calcular número da semana
  const getWeekNumber = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  useEffect(() => {
    fetchPagamentos();
    fetchMotoristas();
  }, []);

  const fetchPagamentos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/pagamentos/semana-atual`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPagamentos(response.data.pagamentos);
      setSummary({
        total_pagar: response.data.total_pagar,
        total_pago: response.data.total_pago,
        periodo: response.data.periodo
      });
    } catch (error) {
      console.error('Error fetching pagamentos:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(response.data);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const handleAddPagamento = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/pagamentos`, newPagamento, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      console.error('Error adding pagamento:', error);
      toast.error('Erro ao criar pagamento');
    }
  };

  const handleUploadDocumento = async (pagamentoId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/pagamentos/${pagamentoId}/upload-documento`,
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          } 
        }
      );
      toast.success('Documento carregado e analisado com sucesso!');
      fetchPagamentos();
    } catch (error) {
      console.error('Error uploading documento:', error);
      toast.error('Erro ao carregar documento');
    }
  };

  const handleMarcarPago = async (pagamentoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/pagamentos/${pagamentoId}/marcar-pago`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Pagamento marcado como pago!');
      fetchPagamentos();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao marcar como pago');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pendente: <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>,
      recibo_enviado: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><FileText className="w-3 h-3 mr-1" />Recibo Enviado</Badge>,
      aguardando_recibo: <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300"><AlertCircle className="w-3 h-3 mr-1" />Aguardando Recibo</Badge>,
      pago: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>
    };
    return statusMap[status] || <Badge>{status}</Badge>;
  };

  // Filter pagamentos
  const filteredPagamentos = useMemo(() => {
    return pagamentos.filter(pagamento => {
      if (filters.motorista && filters.motorista !== 'all' && pagamento.motorista_id !== filters.motorista) return false;
      if (filters.status && filters.status !== 'all' && pagamento.status !== filters.status) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = `${pagamento.motorista_nome || ''} ${pagamento.periodo_inicio || ''} ${pagamento.periodo_fim || ''}`.toLowerCase();
        if (!searchableText.includes(searchLower)) return false;
      }
      return true;
    });
  }, [pagamentos, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      motorista: 'all',
      status: 'all',
      search: ''
    });
  };

  const filterOptions = {
    search: {
      type: 'text',
      label: 'Pesquisar',
      placeholder: 'Nome do motorista ou período...'
    },
    motorista: {
      type: 'select',
      label: 'Motorista',
      placeholder: 'Todos os motoristas',
      items: motoristas.map(m => ({ value: m.id, label: m.name }))
    },
    status: {
      type: 'select',
      label: 'Status',
      placeholder: 'Todos os status',
      items: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'aguardando_recibo', label: 'Aguardando Recibo' },
        { value: 'recibo_enviado', label: 'Recibo Enviado' },
        { value: 'pago', label: 'Pago' }
      ]
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pagamentos a Motoristas</h1>
            <p className="text-slate-600 mt-1">Gerir pagamentos e recibos</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Pagamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPagamento} className="space-y-4">
                <div>
                  <Label>Motorista</Label>
                  <Select 
                    value={newPagamento.motorista_id} 
                    onValueChange={(value) => setNewPagamento({...newPagamento, motorista_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (€)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={newPagamento.valor}
                    onChange={(e) => setNewPagamento({...newPagamento, valor: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Período Início</Label>
                    <Input 
                      type="date"
                      value={newPagamento.periodo_inicio}
                      onChange={(e) => setNewPagamento({...newPagamento, periodo_inicio: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Período Fim</Label>
                    <Input 
                      type="date"
                      value={newPagamento.periodo_fim}
                      onChange={(e) => setNewPagamento({...newPagamento, periodo_fim: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Tipo de Documento</Label>
                  <Select 
                    value={newPagamento.tipo_documento}
                    onValueChange={(value) => setNewPagamento({...newPagamento, tipo_documento: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                      <SelectItem value="fatura">Fatura</SelectItem>
                      <SelectItem value="recibo_simples">Recibo Simples</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notas (opcional)</Label>
                  <Input 
                    value={newPagamento.notas}
                    onChange={(e) => setNewPagamento({...newPagamento, notas: e.target.value})}
                    placeholder="Notas adicionais"
                  />
                </div>
                <Button type="submit" className="w-full">Criar Pagamento</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total a Pagar</p>
                    <p className="text-2xl font-bold">€{summary.total_pagar?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Pago</p>
                    <p className="text-2xl font-bold">€{summary.total_pago?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Período</p>
                    <p className="text-lg font-semibold">{summary.periodo || 'Semana Atual'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          options={filterOptions}
        />

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600">
            Mostrando {filteredPagamentos.length} de {pagamentos.length} pagamentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">A carregar...</div>
            ) : filteredPagamentos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Nenhum pagamento encontrado</div>
            ) : (
              <div className="space-y-4">
                {filteredPagamentos.map((pagamento) => (
                  <div key={pagamento.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <p className="font-semibold">{pagamento.motorista_nome}</p>
                        {getStatusBadge(pagamento.status)}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>Período: {pagamento.periodo_inicio} - {pagamento.periodo_fim}</p>
                        <p>Valor: <span className="font-semibold text-slate-900">€{pagamento.valor?.toFixed(2)}</span></p>
                        {pagamento.notas && <p>Notas: {pagamento.notas}</p>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {pagamento.status === 'aguardando_recibo' && (
                        <label className="cursor-pointer">
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleUploadDocumento(pagamento.id, e.target.files[0])}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Recibo
                            </span>
                          </Button>
                        </label>
                      )}
                      {pagamento.status === 'recibo_enviado' && (
                        <Button onClick={() => handleMarcarPago(pagamento.id)} size="sm">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar Pago
                        </Button>
                      )}
                    </div>
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