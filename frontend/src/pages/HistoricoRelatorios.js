import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Clock, Download, Eye, FileText, Calendar, 
  User, Search, Filter, ArrowLeft, Receipt 
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const HistoricoRelatorios = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroAno, setFiltroAno] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('todos');

  useEffect(() => {
    fetchHistorico();
  }, []);

  const fetchHistorico = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/historico`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorico(response.data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
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

  const handleDownloadRecibo = async (reciboUrl) => {
    try {
      window.open(reciboUrl, '_blank');
      toast.success('Recibo aberto!');
    } catch (error) {
      console.error('Erro ao abrir recibo:', error);
      toast.error('Erro ao abrir recibo');
    }
  };

  const historicoFiltrado = historico.filter(item => {
    const matchSearch = item.motorista_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.numero_relatorio?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAno = filtroAno === 'todos' || item.ano?.toString() === filtroAno;
    const matchMes = filtroMes === 'todos' || item.semana?.toString() === filtroMes;
    return matchSearch && matchAno && matchMes;
  });

  const anos = [...new Set(historico.map(h => h.ano))].sort((a, b) => b - a);

  const estatisticas = {
    total: historico.length,
    totalPago: historico
      .filter(h => h.status === 'pago')
      .reduce((sum, h) => sum + (h.total_recibo || 0), 0),
    totalPendente: historico
      .filter(h => h.status !== 'pago' && h.status !== 'rejeitado')
      .reduce((sum, h) => sum + (h.total_recibo || 0), 0),
  };

  const getStatusBadge = (status) => {
    const config = {
      'pago': { label: 'Pago', color: 'bg-green-100 text-green-700' },
      'verificado': { label: 'Verificado', color: 'bg-blue-100 text-blue-700' },
      'aguarda_recibo': { label: 'Aguarda Recibo', color: 'bg-orange-100 text-orange-700' },
      'rejeitado': { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={c.color}>{c.label}</Badge>;
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
          Voltar ao Dashboard
        </Button>

        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <Clock className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Histórico de Relatórios e Pagamentos
              </h1>
              <p className="text-slate-600">
                Todos os relatórios, recibos e pagamentos realizados
              </p>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total de Relatórios</p>
                <p className="text-2xl font-bold">{estatisticas.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total Pago</p>
                <p className="text-2xl font-bold text-green-600">€{estatisticas.totalPago.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total Pendente</p>
                <p className="text-2xl font-bold text-orange-600">€{estatisticas.totalPendente.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Pesquisar por motorista ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <select
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="todos">Todos os Anos</option>
                  {anos.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="todos">Todas as Semanas</option>
                  {[...Array(52)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Semana {i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Histórico */}
        {historicoFiltrado.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum registo encontrado</h3>
              <p className="text-slate-600">
                Tente ajustar os filtros ou criar novos relatórios
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Registos ({historicoFiltrado.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm text-slate-600">
                      <th className="pb-3 font-semibold">Data</th>
                      <th className="pb-3 font-semibold">Motorista</th>
                      <th className="pb-3 font-semibold">Relatório</th>
                      <th className="pb-3 font-semibold">Período</th>
                      <th className="pb-3 font-semibold">Valor</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoFiltrado.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {item.data_pagamento ? 
                              new Date(item.data_pagamento).toLocaleDateString('pt-PT') :
                              new Date(item.created_at || item.data_emissao).toLocaleDateString('pt-PT')
                            }
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{item.motorista_nome}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm">{item.numero_relatorio}</td>
                        <td className="py-3 text-sm">
                          Semana {item.semana}/{item.ano}
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-blue-600">
                            €{(item.total_recibo || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(item.id)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              PDF
                            </Button>
                            {item.recibo_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadRecibo(item.recibo_url)}
                              >
                                <Receipt className="w-3 h-3 mr-1" />
                                Recibo
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HistoricoRelatorios;
