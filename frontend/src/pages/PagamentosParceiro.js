import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, Upload, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const PagamentosParceiro = ({ user, onLogout }) => {
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [novoEstado, setNovoEstado] = useState('');

  useEffect(() => {
    fetchPagamentos();
  }, []);

  const fetchPagamentos = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch relatórios de ganhos dos motoristas (recibos/faturas semanais)
      const relatoriosRes = await axios.get(`${API}/relatorios-ganhos`, { 
        headers: { Authorization: `Bearer ${token}` } 
      }).catch(() => ({ data: [] }));

      // Fetch all other payment types
      const [combustivelRes, viaVerdeRes, gestaoRes, contabilistaRes] = await Promise.all([
        axios.get(`${API}/pagamentos/combustivel`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/pagamentos/via-verde`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/pagamentos/gestao`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API}/pagamentos/contabilista`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);

      const allPagamentos = [
        ...relatoriosRes.data.map(r => ({ 
          ...r, 
          tipo: 'Motorista',
          valor: r.valor_liquido || r.valor_total || 0,
          nome: r.motorista_nome,
          status: r.status || 'por_enviar',
          data_vencimento: r.periodo_fim
        })),
        ...combustivelRes.data.map(p => ({ ...p, tipo: 'Combustível' })),
        ...viaVerdeRes.data.map(p => ({ ...p, tipo: 'Via Verde' })),
        ...gestaoRes.data.map(p => ({ ...p, tipo: 'Gestão' })),
        ...contabilistaRes.data.map(p => ({ ...p, tipo: 'Contabilista' }))
      ];

      setPagamentos(allPagamentos);
    } catch (error) {
      console.error('Error fetching pagamentos:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarEstado = async () => {
    if (!novoEstado) {
      toast.error('Selecione um novo estado');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/relatorios-ganhos/${selectedRelatorio.id}/alterar-estado`,
        { status: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Estado alterado com sucesso!');
      setShowEstadoModal(false);
      setSelectedRelatorio(null);
      setNovoEstado('');
      fetchPagamentos();
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Erro ao alterar estado');
    }
  };

  const handleUploadComprovativo = async () => {
    if (!selectedFile) {
      toast.error('Selecione um ficheiro');
      return;
    }

    setUploadingFile(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      // For relatórios (motoristas)
      if (selectedPagamento.tipo === 'Motorista') {
        await axios.post(
          `${API}/relatorios-ganhos/${selectedPagamento.id}/comprovativo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      } else {
        // For other payment types
        await axios.post(
          `${API}/pagamentos/${selectedPagamento.id}/comprovativo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      toast.success('Comprovativo enviado com sucesso!');
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedPagamento(null);
      fetchPagamentos();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar comprovativo');
    } finally {
      setUploadingFile(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'pago': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'atrasado': { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const config = statusConfig[status] || statusConfig['pendente'];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center space-x-1`}>
        <Icon className="w-3 h-3" />
        <span>{status}</span>
      </Badge>
    );
  };

  const totalPendente = pagamentos
    .filter(p => p.status === 'pendente')
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  const totalPago = pagamentos
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <p>A carregar...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Pagamentos a Efetuar</h1>
          <p className="text-slate-600 mt-2">Gerir pagamentos de motoristas, despesas e serviços</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600">Total Pendente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                €{totalPendente.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {pagamentos.filter(p => p.status === 'pendente').length} pagamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600">Total Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                €{totalPago.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {pagamentos.filter(p => p.status === 'pago').length} pagamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600">Total Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                €{(totalPendente + totalPago).toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {pagamentos.length} pagamentos totais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentos.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum pagamento registado</p>
            ) : (
              <div className="space-y-3">
                {pagamentos.map((pagamento) => (
                  <div key={pagamento.id} className="border rounded-lg p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{pagamento.tipo}</Badge>
                        <div>
                          <p className="font-semibold">
                            {pagamento.nome || pagamento.descricao || `Pagamento ${pagamento.tipo}`}
                          </p>
                          <p className="text-sm text-slate-600">
                            {pagamento.referencia && `Ref: ${pagamento.referencia}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-800">€{pagamento.valor?.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">
                            Vencimento: {pagamento.data_vencimento ? new Date(pagamento.data_vencimento).toLocaleDateString('pt-PT') : 'N/A'}
                          </p>
                        </div>
                        {getStatusBadge(pagamento.status)}
                      </div>
                    </div>

                    {/* Dados do Parceiro (se for pagamento de motorista) */}
                    {pagamento.tipo === 'Motorista' && (
                      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-800 mb-1">Dados para Recibo:</p>
                        <div className="text-xs text-slate-700 space-y-0.5">
                          <p><strong>Parceiro:</strong> {pagamento.parceiro_nome || 'N/A'}</p>
                          <p><strong>NIF:</strong> {pagamento.parceiro_nif || 'N/A'}</p>
                          <p><strong>Morada:</strong> {pagamento.parceiro_morada || 'N/A'}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 mt-3">
                      {/* Botão Alterar Estado (apenas para motoristas) */}
                      {pagamento.tipo === 'Motorista' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRelatorio(pagamento);
                            setNovoEstado(pagamento.status);
                            setShowEstadoModal(true);
                          }}
                        >
                          Alterar Estado
                        </Button>
                      )}

                      {/* Botão Ver Recibo (se disponível) */}
                      {pagamento.recibo_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`${API}/${pagamento.recibo_url}`, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Ver Recibo
                        </Button>
                      )}

                      {/* Botão Comprovativo */}
                      {pagamento.comprovativo_pagamento_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`${API}/${pagamento.comprovativo_pagamento_url}`, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Ver Comprovativo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPagamento(pagamento);
                            setShowUploadModal(true);
                          }}
                          disabled={pagamento.status === 'liquidado'}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Adicionar Comprovativo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Alterar Estado */}
        <Dialog open={showEstadoModal} onOpenChange={setShowEstadoModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Estado do Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Motorista</Label>
                <p className="text-sm text-slate-600">{selectedRelatorio?.motorista_nome || selectedRelatorio?.nome}</p>
              </div>

              <div>
                <Label>Valor</Label>
                <p className="text-sm font-semibold">€{selectedRelatorio?.valor?.toFixed(2)}</p>
              </div>

              <div>
                <Label>Novo Estado</Label>
                <select
                  value={novoEstado}
                  onChange={(e) => setNovoEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="por_enviar">Por Enviar</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="a_pagamento">A Pagamento</option>
                  <option value="liquidado">Liquidado</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs font-semibold mb-1">Estados:</p>
                <ul className="text-xs space-y-1">
                  <li>🟡 <strong>Por Enviar:</strong> Recibo enviado pelo sistema</li>
                  <li>🔵 <strong>Em Análise:</strong> A rever recibo</li>
                  <li>🟠 <strong>A Pagamento:</strong> Aprovado, a processar pagamento</li>
                  <li>🟢 <strong>Liquidado:</strong> Pago (adicione comprovativo)</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEstadoModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAlterarEstado}>
                Confirmar Alteração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Modal */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Comprovativo de Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Pagamento</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedPagamento?.tipo} - €{selectedPagamento?.valor?.toFixed(2)}
                </p>
              </div>

              <div>
                <Label>Selecionar Ficheiro (PDF/Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUploadComprovativo} disabled={uploadingFile || !selectedFile}>
                <Upload className="w-4 h-4 mr-2" />
                {uploadingFile ? 'A enviar...' : 'Enviar Comprovativo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PagamentosParceiro;
