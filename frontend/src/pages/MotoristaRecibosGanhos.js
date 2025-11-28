import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DollarSign, FileText, Download, Calendar, TrendingUp, Upload, Eye, CheckCircle } from 'lucide-react';

const MotoristaRecibosGanhos = ({ user, onLogout }) => {
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadingComprovativoId, setUploadingComprovativoId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [stats, setStats] = useState({
    totalGanhos: 0,
    totalRecibos: 0,
    mesAtual: 0
  });

  // Check URL params for highlight
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const relatorioId = params.get('relatorio');
    if (relatorioId) {
      setHighlightId(relatorioId);
      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightId(null), 3000);
    }
  }, []);

  useEffect(() => {
    fetchRelatorios();
  }, []);

  const fetchRelatorios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/relatorios-ganhos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRelatorios(response.data);
      
      // Calcular estatísticas
      const total = response.data.reduce((sum, r) => sum + (r.valor_total || 0), 0);
      const mesAtualData = response.data.filter(r => {
        const dataRelatorio = new Date(r.data_relatorio || r.created_at);
        const agora = new Date();
        return dataRelatorio.getMonth() === agora.getMonth() && dataRelatorio.getFullYear() === agora.getFullYear();
      });
      const mesAtualTotal = mesAtualData.reduce((sum, r) => sum + (r.valor_total || 0), 0);
      
      setStats({
        totalGanhos: total,
        totalRecibos: response.data.length,
        mesAtual: mesAtualTotal
      });
    } catch (error) {
      console.error('Error fetching relatorios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRecibo = async (relatorioId, file) => {
    if (!file) return;
    
    setUploadingId(relatorioId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/relatorios-ganhos/${relatorioId}/upload-recibo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );
      toast.success('Recibo enviado com sucesso!');
      fetchRelatorios();
    } catch (error) {
      console.error('Error uploading recibo:', error);
      toast.error('Erro ao enviar recibo');
    } finally {
      setUploadingId(null);
    }
  };

  const handleUploadComprovativo = async (relatorioId, file) => {
    if (!file) return;
    
    setUploadingComprovativoId(relatorioId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/relatorios-ganhos/${relatorioId}/comprovativo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );
      toast.success('Comprovativo enviado com sucesso!');
      fetchRelatorios();
    } catch (error) {
      console.error('Error uploading comprovativo:', error);
      toast.error('Erro ao enviar comprovativo');
    } finally {
      setUploadingComprovativoId(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente_recibo': { label: 'Pendente Recibo', class: 'bg-yellow-100 text-yellow-800' },
      'recibo_enviado': { label: 'Recibo Enviado', class: 'bg-blue-100 text-blue-800' },
      'recibo_emitido': { label: 'Recibo Enviado', class: 'bg-blue-100 text-blue-800' },
      'aprovado_pagamento': { label: 'Aprovado', class: 'bg-green-100 text-green-800' },
      'aprovado': { label: 'Aprovado', class: 'bg-green-100 text-green-800' },
      'pago': { label: 'Pago', class: 'bg-emerald-100 text-emerald-800' },
      'rejeitado': { label: 'Rejeitado', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status] || { label: status, class: 'bg-slate-100 text-slate-800' };
    return <Badge className={config.class}>{config.label}</Badge>;
  };

  const handleDownload = async (relatorioUrl) => {
    if (!relatorioUrl) {
      toast.error('Recibo não disponível');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(relatorioUrl, {
        baseURL: process.env.REACT_APP_BACKEND_URL,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download iniciado!');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Erro ao fazer download');
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">A carregar recibos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Ganhos</h1>
          <p className="text-slate-600 mt-1">Histórico de ganhos e relatórios</p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Ganhos</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">€{stats.totalGanhos.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">Total acumulado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Mês Atual</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">€{stats.mesAtual.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">Este mês</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Recibos</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRecibos}</div>
              <p className="text-xs text-slate-500 mt-1">Registados</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Recibos */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Recibos</CardTitle>
          </CardHeader>
          <CardContent>
            {relatorios.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">Nenhum recibo registado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {relatorios.map((relatorio) => (
                  <div key={relatorio.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-slate-800">
                            Período: {relatorio.periodo_inicio} - {relatorio.periodo_fim}
                          </h3>
                          {getStatusBadge(relatorio.status)}
                        </div>
                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">Valor Total</p>
                            <p className="font-semibold text-green-600">€{(relatorio.valor_total || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Valor Líquido</p>
                            <p className="font-semibold text-blue-600">€{(relatorio.valor_liquido || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Uber</p>
                            <p className="font-semibold">€{(relatorio.detalhes?.uber || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Bolt</p>
                            <p className="font-semibold">€{(relatorio.detalhes?.bolt || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        {relatorio.notas && (
                          <div className="mt-2">
                            <p className="text-xs text-slate-500">Notas: {relatorio.notas}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col space-y-2">
                        {/* Recibo */}
                        {relatorio.status === 'pendente_recibo' && user.role === 'motorista' ? (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleUploadRecibo(relatorio.id, e.target.files[0])}
                              disabled={uploadingId === relatorio.id}
                            />
                            <Button
                              size="sm"
                              disabled={uploadingId === relatorio.id}
                              asChild
                            >
                              <span>
                                <Upload className="w-4 h-4 mr-2" />
                                {uploadingId === relatorio.id ? 'Enviando...' : 'Enviar Recibo'}
                              </span>
                            </Button>
                          </label>
                        ) : relatorio.recibo_url ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(relatorio.recibo_url)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Recibo
                          </Button>
                        ) : null}
                        
                        {/* Comprovativo de Pagamento - só admin/gestor/parceiro/operacional */}
                        {(user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro' || user.role === 'operacional') && (
                          <>
                            {(relatorio.status === 'recibo_enviado' || relatorio.status === 'recibo_emitido' || relatorio.status === 'aprovado_pagamento') && !relatorio.comprovativo_pagamento_url ? (
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleUploadComprovativo(relatorio.id, e.target.files[0])}
                                  disabled={uploadingComprovativoId === relatorio.id}
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={uploadingComprovativoId === relatorio.id}
                                  asChild
                                >
                                  <span>
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploadingComprovativoId === relatorio.id ? 'Enviando...' : 'Upload Comprovativo'}
                                  </span>
                                </Button>
                              </label>
                            ) : relatorio.comprovativo_pagamento_url ? (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleDownload(relatorio.comprovativo_pagamento_url)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Comprovativo
                              </Button>
                            ) : null}
                          </>
                        )}
                        
                        {/* Motorista pode ver comprovativo se existir */}
                        {user.role === 'motorista' && relatorio.comprovativo_pagamento_url && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleDownload(relatorio.comprovativo_pagamento_url)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Comprovativo
                          </Button>
                        )}
                      </div>
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

export default MotoristaRecibosGanhos;