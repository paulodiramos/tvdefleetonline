import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Calendar,
  User,
  FileSpreadsheet
} from 'lucide-react';

const FicheirosImportados = ({ user, onLogout }) => {
  const [ficheiros, setFicheiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroPlataforma, setFiltroPlataforma] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalRejeitar, setModalRejeitar] = useState(null);
  const [observacoesRejeicao, setObservacoesRejeicao] = useState('');
  const [processando, setProcessando] = useState({});

  const plataformas = [
    { value: 'todos', label: 'Todas as Plataformas' },
    { value: 'uber', label: 'Uber' },
    { value: 'bolt', label: 'Bolt' },
    { value: 'viaverde', label: 'Via Verde' },
    { value: 'gps', label: 'GPS' },
    { value: 'combustivel', label: 'Combustível' },
  ];

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  useEffect(() => {
    fetchFicheiros();
  }, [filtroPlataforma, filtroStatus]);

  const fetchFicheiros = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${API}/ficheiros-importados`;
      const params = [];
      
      if (filtroPlataforma !== 'todos') {
        params.push(`plataforma=${filtroPlataforma}`);
      }
      if (filtroStatus !== 'todos') {
        params.push(`status=${filtroStatus}`);
      }
      
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFicheiros(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar ficheiros:', error);
      toast.error('Erro ao carregar ficheiros importados');
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (ficheiro) => {
    if (!window.confirm(`Tem certeza que deseja aprovar o ficheiro "${ficheiro.nome_ficheiro}"?`)) {
      return;
    }
    
    setProcessando(prev => ({ ...prev, [ficheiro.id]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/ficheiros-importados/${ficheiro.id}/aprovar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Ficheiro aprovado com sucesso!');
      fetchFicheiros();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error(error.response?.data?.detail || 'Erro ao aprovar ficheiro');
    } finally {
      setProcessando(prev => ({ ...prev, [ficheiro.id]: false }));
    }
  };

  const handleRejeitar = async () => {
    if (!observacoesRejeicao.trim()) {
      toast.error('Por favor, indique o motivo da rejeição');
      return;
    }
    
    setProcessando(prev => ({ ...prev, [modalRejeitar.id]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/ficheiros-importados/${modalRejeitar.id}/rejeitar`,
        null,
        { 
          headers: { Authorization: `Bearer ${token}` },
          params: { observacoes: observacoesRejeicao }
        }
      );
      
      toast.success('Ficheiro rejeitado');
      setModalRejeitar(null);
      setObservacoesRejeicao('');
      fetchFicheiros();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast.error(error.response?.data?.detail || 'Erro ao rejeitar ficheiro');
    } finally {
      setProcessando(prev => ({ ...prev, [modalRejeitar?.id]: false }));
    }
  };

  const handleDeletar = async (ficheiro) => {
    if (!window.confirm(`Tem certeza que deseja ELIMINAR permanentemente o ficheiro "${ficheiro.nome_ficheiro}"?`)) {
      return;
    }
    
    setProcessando(prev => ({ ...prev, [ficheiro.id]: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/ficheiros-importados/${ficheiro.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Ficheiro eliminado');
      fetchFicheiros();
    } catch (error) {
      console.error('Erro ao eliminar:', error);
      toast.error(error.response?.data?.detail || 'Erro ao eliminar ficheiro');
    } finally {
      setProcessando(prev => ({ ...prev, [ficheiro.id]: false }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getPlataformaIcon = (plataforma) => {
    const icons = {
      uber: '🚗',
      bolt: '⚡',
      viaverde: '🛣️',
      gps: '📍',
      combustivel: '⛽'
    };
    return icons[plataforma] || '📄';
  };

  const estatisticas = {
    total: ficheiros.length,
    pendentes: ficheiros.filter(f => f.status === 'pendente').length,
    aprovados: ficheiros.filter(f => f.status === 'aprovado').length,
    rejeitados: ficheiros.filter(f => f.status === 'rejeitado').length,
  };

  const canManage = ['admin', 'gestao', 'parceiro'].includes(user?.role);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Ficheiros Importados</h1>
            <p className="text-slate-500">Gerir e aprovar ficheiros de importação de dados</p>
          </div>
          <Button onClick={fetchFicheiros} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold">{estatisticas.total}</p>
                </div>
                <FileSpreadsheet className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{estatisticas.pendentes}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Aprovados</p>
                  <p className="text-2xl font-bold text-green-600">{estatisticas.aprovados}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Rejeitados</p>
                  <p className="text-2xl font-bold text-red-600">{estatisticas.rejeitados}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Filtros:</span>
              </div>
              <div className="flex flex-wrap gap-4">
                <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    {plataformas.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="aprovado">Aprovados</SelectItem>
                    <SelectItem value="rejeitado">Rejeitados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Ficheiros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ficheiros ({ficheiros.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : ficheiros.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum ficheiro encontrado</p>
                <p className="text-sm mt-1">Importe ficheiros na página de Importação de Dados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ficheiros.map((ficheiro) => {
                  const StatusIcon = statusConfig[ficheiro.status]?.icon || Clock;
                  return (
                    <div 
                      key={ficheiro.id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <span className="text-2xl">{getPlataformaIcon(ficheiro.plataforma)}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-800">{ficheiro.nome_ficheiro}</h3>
                              <Badge className={statusConfig[ficheiro.status]?.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig[ficheiro.status]?.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-500 mt-1 space-y-1">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(ficheiro.data_importacao)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {ficheiro.importado_por_nome || 'Sistema'}
                                </span>
                              </div>
                              {ficheiro.periodo_inicio && ficheiro.periodo_fim && (
                                <span>
                                  Período: {ficheiro.periodo_inicio} a {ficheiro.periodo_fim}
                                </span>
                              )}
                              {ficheiro.total_registos > 0 && (
                                <span className="ml-2">• {ficheiro.total_registos} registos</span>
                              )}
                              {ficheiro.registos_sucesso > 0 && (
                                <span className="text-green-600"> ({ficheiro.registos_sucesso} com sucesso)</span>
                              )}
                              {ficheiro.registos_erro > 0 && (
                                <span className="text-red-600"> ({ficheiro.registos_erro} com erro)</span>
                              )}
                            </div>
                            {ficheiro.observacoes && (
                              <p className="text-sm mt-2 p-2 bg-slate-100 rounded">
                                💬 {ficheiro.observacoes}
                              </p>
                            )}
                            {ficheiro.data_aprovacao && (
                              <p className="text-xs text-slate-400 mt-1">
                                {ficheiro.status === 'aprovado' ? '✅ Aprovado' : '❌ Rejeitado'} por {ficheiro.aprovado_por_nome} em {formatDate(ficheiro.data_aprovacao)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Ações */}
                        {canManage && ficheiro.status === 'pendente' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAprovar(ficheiro)}
                              disabled={processando[ficheiro.id]}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => setModalRejeitar(ficheiro)}
                              disabled={processando[ficheiro.id]}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        )}
                        
                        {['admin', 'gestao'].includes(user?.role) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeletar(ficheiro)}
                            disabled={processando[ficheiro.id]}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Rejeitar */}
        {modalRejeitar && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-red-600">Rejeitar Ficheiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Está a rejeitar o ficheiro: <strong>{modalRejeitar.nome_ficheiro}</strong>
                </p>
                <div>
                  <label className="text-sm font-medium">Motivo da rejeição *</label>
                  <Textarea
                    value={observacoesRejeicao}
                    onChange={(e) => setObservacoesRejeicao(e.target.value)}
                    placeholder="Indique o motivo da rejeição..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModalRejeitar(null);
                      setObservacoesRejeicao('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejeitar}
                    disabled={processando[modalRejeitar.id]}
                  >
                    Confirmar Rejeição
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FicheirosImportados;
