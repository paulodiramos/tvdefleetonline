import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, CheckCircle, Clock, DollarSign, Upload, Eye, Plus } from 'lucide-react';

const RecibosPagamentos = ({ user, onLogout }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    motorista_id: '',
    periodo_inicio: '',
    periodo_fim: '',
    valor_total: '',
    detalhes_uber: '',
    detalhes_bolt: '',
    detalhes_outros: '',
    notas: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch motoristas
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(motoristasRes.data);

      // Fetch relatórios de ganhos
      const relatoriosRes = await axios.get(`${API}/relatorios-ganhos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRelatorios(relatoriosRes.data);
      
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRelatorio = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      
      const detalhes = {
        uber: parseFloat(formData.detalhes_uber) || 0,
        bolt: parseFloat(formData.detalhes_bolt) || 0,
        outros: parseFloat(formData.detalhes_outros) || 0
      };

      const payload = {
        motorista_id: formData.motorista_id,
        periodo_inicio: formData.periodo_inicio,
        periodo_fim: formData.periodo_fim,
        valor_total: parseFloat(formData.valor_total),
        detalhes: detalhes,
        notas: formData.notas || null
      };

      await axios.post(`${API}/relatorios-ganhos`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: 'Relatório de ganhos criado com sucesso!' });
      setShowCreateForm(false);
      setFormData({
        motorista_id: '',
        periodo_inicio: '',
        periodo_fim: '',
        valor_total: '',
        detalhes_uber: '',
        detalhes_bolt: '',
        detalhes_outros: '',
        notas: ''
      });
      fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao criar relatório' 
      });
    }
  };

  const handleUploadRecibo = async (relatorioId, file) => {
    if (!file) return;

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/relatorios-ganhos/${relatorioId}/upload-recibo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage({ type: 'success', text: 'Recibo enviado com sucesso!' });
      fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao enviar recibo' 
      });
    }
  };

  const handleAprovarPagamento = async (relatorioId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/relatorios-ganhos/${relatorioId}/aprovar-pagamento`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: 'Pagamento aprovado!' });
      fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao aprovar pagamento' 
      });
    }
  };

  const handleMarcarPago = async (relatorioId, file) => {
    if (!file) {
      setMessage({ type: 'error', text: 'Anexe comprovativo de pagamento' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/relatorios-ganhos/${relatorioId}/marcar-pago`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage({ type: 'success', text: 'Pagamento registrado como pago!' });
      fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao marcar como pago' 
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente_recibo': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Aguardando Recibo' },
      'recibo_emitido': { color: 'bg-blue-100 text-blue-800', icon: FileText, label: 'Recibo Emitido' },
      'aguardando_pagamento': { color: 'bg-purple-100 text-purple-800', icon: DollarSign, label: 'Aguardando Pagamento' },
      'pago': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Pago' }
    };

    const config = statusConfig[status] || statusConfig['pendente_recibo'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const canCreateRelatorio = user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional';
  const canApprovePayment = user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional' || user.role === 'parceiro';
  const canMarkPaid = user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional' || user.role === 'parceiro';

  if (loading) return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Recibos e Pagamentos</h1>
          {canCreateRelatorio && (
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Relatório de Ganhos
            </Button>
          )}
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form de Criação */}
        {showCreateForm && canCreateRelatorio && (
          <Card>
            <CardHeader>
              <CardTitle>Criar Relatório de Ganhos</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateRelatorio} className="space-y-4">
                <div>
                  <Label htmlFor="motorista">Motorista *</Label>
                  <select
                    id="motorista"
                    value={formData.motorista_id}
                    onChange={(e) => setFormData({...formData, motorista_id: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Selecione um motorista</option>
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="periodo_inicio">Período Início *</Label>
                    <Input
                      id="periodo_inicio"
                      type="date"
                      value={formData.periodo_inicio}
                      onChange={(e) => setFormData({...formData, periodo_inicio: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="periodo_fim">Período Fim *</Label>
                    <Input
                      id="periodo_fim"
                      type="date"
                      value={formData.periodo_fim}
                      onChange={(e) => setFormData({...formData, periodo_fim: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="valor_total">Valor Total (€) *</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({...formData, valor_total: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="detalhes_uber">Ganhos Uber (€)</Label>
                    <Input
                      id="detalhes_uber"
                      type="number"
                      step="0.01"
                      value={formData.detalhes_uber}
                      onChange={(e) => setFormData({...formData, detalhes_uber: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="detalhes_bolt">Ganhos Bolt (€)</Label>
                    <Input
                      id="detalhes_bolt"
                      type="number"
                      step="0.01"
                      value={formData.detalhes_bolt}
                      onChange={(e) => setFormData({...formData, detalhes_bolt: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="detalhes_outros">Outros Ganhos (€)</Label>
                    <Input
                      id="detalhes_outros"
                      type="number"
                      step="0.01"
                      value={formData.detalhes_outros}
                      onChange={(e) => setFormData({...formData, detalhes_outros: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notas">Notas</Label>
                  <textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({...formData, notas: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    rows="3"
                    placeholder="Observações adicionais..."
                  />
                </div>

                <div className="flex space-x-2">
                  <Button type="submit">Criar Relatório</Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Relatórios */}
        <Card>
          <CardHeader>
            <CardTitle>Relatórios de Ganhos</CardTitle>
          </CardHeader>
          <CardContent>
            {relatorios.length > 0 ? (
              <div className="space-y-4">
                {relatorios.map((relatorio) => (
                  <div key={relatorio.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg">{relatorio.motorista_nome}</p>
                        <p className="text-sm text-slate-600">
                          Período: {new Date(relatorio.periodo_inicio).toLocaleDateString('pt-BR')} - {new Date(relatorio.periodo_fim).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">€{relatorio.valor_total.toFixed(2)}</p>
                        {getStatusBadge(relatorio.status)}
                      </div>
                    </div>

                    {/* Detalhes de Ganhos */}
                    <div className="grid grid-cols-3 gap-4 text-sm bg-slate-50 p-3 rounded">
                      <div>
                        <p className="text-slate-500">Uber</p>
                        <p className="font-medium">€{relatorio.detalhes.uber?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Bolt</p>
                        <p className="font-medium">€{relatorio.detalhes.bolt?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Outros</p>
                        <p className="font-medium">€{relatorio.detalhes.outros?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Upload de Recibo (Motorista) */}
                      {user.role === 'motorista' && relatorio.status === 'pendente_recibo' && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleUploadRecibo(relatorio.id, e.target.files[0])}
                            className="hidden"
                          />
                          <Button as="span" size="sm">
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar Recibo
                          </Button>
                        </label>
                      )}

                      {/* Ver Recibo */}
                      {relatorio.recibo_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`${API}/${relatorio.recibo_url}`, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Recibo
                        </Button>
                      )}

                      {/* Download Recibo */}
                      {relatorio.recibo_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `${API}/${relatorio.recibo_url}`;
                            link.download = `recibo_${relatorio.id}.pdf`;
                            link.click();
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}

                      {/* Aprovar Pagamento */}
                      {canApprovePayment && relatorio.status === 'recibo_emitido' && !relatorio.aprovado_pagamento && (
                        <Button
                          size="sm"
                          onClick={() => handleAprovarPagamento(relatorio.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aprovar Pagamento
                        </Button>
                      )}

                      {/* Marcar como Pago */}
                      {canMarkPaid && relatorio.aprovado_pagamento && !relatorio.pago && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleMarcarPago(relatorio.id, e.target.files[0])}
                            className="hidden"
                          />
                          <Button as="span" size="sm" variant="outline">
                            <Upload className="w-4 h-4 mr-2" />
                            Marcar Pago + Comprovativo
                          </Button>
                        </label>
                      )}

                      {/* Ver Comprovativo */}
                      {relatorio.comprovativo_pagamento_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`${API}/${relatorio.comprovativo_pagamento_url}`, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Comprovativo
                        </Button>
                      )}
                    </div>

                    {/* Info de Aprovação/Pagamento */}
                    {(relatorio.aprovado_pagamento || relatorio.pago) && (
                      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                        {relatorio.aprovado_pagamento && (
                          <p>✓ Aprovado em: {new Date(relatorio.aprovado_pagamento_em).toLocaleString('pt-BR')}</p>
                        )}
                        {relatorio.pago && (
                          <p>✓ Pago em: {new Date(relatorio.pago_em).toLocaleString('pt-BR')}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">Nenhum relatório de ganhos criado ainda</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RecibosPagamentos;
