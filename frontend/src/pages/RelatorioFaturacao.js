import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, Download, Calendar, DollarSign, TrendingUp, 
  Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';

const RelatorioFaturacao = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [faturas, setFaturas] = useState([]);
  const [filteredFaturas, setFilteredFaturas] = useState([]);
  const [stats, setStats] = useState({
    total_faturado: 0,
    total_pendente: 0,
    total_pago: 0,
    total_faturas: 0
  });
  const [mesFilter, setMesFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    fetchFaturas();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [mesFilter, statusFilter, faturas]);

  const fetchFaturas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(
        `${API}/faturas/${user.role === 'parceiro' ? user.id : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => ({ data: [] }));
      
      const faturasData = response.data || [];
      setFaturas(faturasData);
      
      // Calcular estatísticas
      const totalFaturado = faturasData.reduce((sum, f) => sum + (f.valor || 0), 0);
      const totalPendente = faturasData.filter(f => f.status === 'pendente').reduce((sum, f) => sum + (f.valor || 0), 0);
      const totalPago = faturasData.filter(f => f.status === 'pago').reduce((sum, f) => sum + (f.valor || 0), 0);
      
      setStats({
        total_faturado: totalFaturado,
        total_pendente: totalPendente,
        total_pago: totalPago,
        total_faturas: faturasData.length
      });
      
    } catch (error) {
      console.error('Error fetching faturas:', error);
      toast.error('Erro ao carregar faturas');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...faturas];
    
    // Filtro por mês
    if (mesFilter !== 'todos') {
      const [ano, mes] = mesFilter.split('-');
      filtered = filtered.filter(f => {
        const dataFatura = new Date(f.data_emissao || f.created_at);
        return dataFatura.getFullYear() === parseInt(ano) && 
               dataFatura.getMonth() + 1 === parseInt(mes);
      });
    }
    
    // Filtro por status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    
    setFilteredFaturas(filtered);
  };

  const handleDownloadFatura = async (faturaId) => {
    try {
      const token = localStorage.getItem('token');
      window.open(`${API}/faturas/${faturaId}/download?token=${token}`, '_blank');
    } catch (error) {
      console.error('Error downloading fatura:', error);
      toast.error('Erro ao baixar fatura');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pago: { label: 'Pago', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
      pendente: { label: 'Pendente', icon: Clock, color: 'bg-amber-100 text-amber-800' },
      cancelado: { label: 'Cancelado', icon: XCircle, color: 'bg-red-100 text-red-800' },
      processando: { label: 'Processando', icon: AlertCircle, color: 'bg-blue-100 text-blue-800' }
    };
    
    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatMes = (data) => {
    const date = new Date(data);
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };

  const getMesesDisponiveis = () => {
    const meses = new Set();
    faturas.forEach(f => {
      const date = new Date(f.data_emissao || f.created_at);
      const mesAno = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      meses.add(mesAno);
    });
    return Array.from(meses).sort().reverse();
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <span>Relatório de Faturação</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Histórico de faturas e cobranças
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Total Faturado</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    €{stats.total_faturado.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Total Pago</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    €{stats.total_pago.toFixed(2)}
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700 font-medium">Pendente</p>
                  <p className="text-3xl font-bold text-amber-900 mt-1">
                    €{stats.total_pendente.toFixed(2)}
                  </p>
                </div>
                <Clock className="w-12 h-12 text-amber-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Total Faturas</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">
                    {stats.total_faturas}
                  </p>
                </div>
                <FileText className="w-12 h-12 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mês Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Mês</label>
                <Select value={mesFilter} onValueChange={setMesFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os meses</SelectItem>
                    {getMesesDisponiveis().map(mes => {
                      const [ano, mesNum] = mes.split('-');
                      const date = new Date(ano, mesNum - 1);
                      const label = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                      return (
                        <SelectItem key={mes} value={mes}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Faturas List */}
        <Card>
          <CardHeader>
            <CardTitle>Faturas ({filteredFaturas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaturas.length > 0 ? (
              <div className="space-y-3">
                {filteredFaturas.map((fatura) => (
                  <div key={fatura.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 rounded-full p-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          Fatura #{fatura.numero_fatura || fatura.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatMes(fatura.data_emissao || fatura.created_at)}
                        </p>
                        {fatura.descricao && (
                          <p className="text-xs text-slate-400 mt-1">{fatura.descricao}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-800">
                          €{(fatura.valor || 0).toFixed(2)}
                        </p>
                        {getStatusBadge(fatura.status)}
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadFatura(fatura.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nenhuma fatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RelatorioFaturacao;
