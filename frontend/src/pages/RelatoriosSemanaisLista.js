import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  FileText, Edit, Check, X, Eye, Download, Send, 
  ArrowLeft, Calendar, User, Car, DollarSign, AlertCircle,
  Trash2, CheckSquare, Square, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RelatoriosSemanaisLista = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [showEditModal, setShowEditModal] = useState(false);
  const [relatorioEditando, setRelatorioEditando] = useState(null);
  const [showAprovarModal, setShowAprovarModal] = useState(false);
  const [relatorioAprovando, setRelatorioAprovando] = useState(null);
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [processingBulk, setProcessingBulk] = useState(false);

  useEffect(() => {
    fetchRelatorios();
  }, []);

  const fetchRelatorios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/semanais-todos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRelatorios(response.data);
      setSelectedIds([]); // Clear selection on refresh
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on status
  const relatoriosFiltrados = relatorios.filter(rel => {
    if (filtroStatus === 'todos') return true;
    return rel.status === filtroStatus;
  });

  // Selection handlers
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filteredIds = relatoriosFiltrados.map(r => r.id);
    if (selectedIds.length === filteredIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIds);
    }
  };

  const isSelected = (id) => selectedIds.includes(id);
  const allSelected = relatoriosFiltrados.length > 0 && selectedIds.length === relatoriosFiltrados.length;

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setProcessingBulk(true);
    try {
      const token = localStorage.getItem('token');
      
      // Delete each selected report
      const deletePromises = selectedIds.map(id => 
        axios.delete(
          `${API_URL}/api/relatorios/semanal/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(deletePromises);
      
      toast.success(`${selectedIds.length} relatório(s) eliminado(s) com sucesso!`);
      setShowDeleteConfirm(false);
      setSelectedIds([]);
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao eliminar relatórios:', error);
      toast.error('Erro ao eliminar alguns relatórios');
    } finally {
      setProcessingBulk(false);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0 || !newStatus) return;
    
    setProcessingBulk(true);
    try {
      const token = localStorage.getItem('token');
      
      // Update status for each selected report
      const updatePromises = selectedIds.map(id => 
        axios.put(
          `${API_URL}/api/relatorios/semanal/${id}/status`,
          { status: newStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(updatePromises);
      
      toast.success(`Estado de ${selectedIds.length} relatório(s) atualizado para "${getStatusLabel(newStatus)}"!`);
      setShowStatusChangeModal(false);
      setSelectedIds([]);
      setNewStatus('');
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao alterar estado:', error);
      toast.error('Erro ao alterar estado de alguns relatórios');
    } finally {
      setProcessingBulk(false);
    }
  };

  const handleEditarRelatorio = (relatorio) => {
    setRelatorioEditando({ ...relatorio });
    setShowEditModal(true);
  };

  const handleSalvarEdicao = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/relatorios/semanal/${relatorioEditando.id}`,
        relatorioEditando,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Relatório atualizado com sucesso!');
      setShowEditModal(false);
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleAprovarRelatorio = (relatorio) => {
    setRelatorioAprovando(relatorio);
    setShowAprovarModal(true);
  };

  const confirmarAprovacao = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/relatorios/semanal/${relatorioAprovando.id}/aprovar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Relatório aprovado! Aguardando recibo do motorista.');
      setShowAprovarModal(false);
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error('Erro ao aprovar relatório');
    }
  };

  const handleRejeitarRelatorio = async (relatorioId) => {
    if (!window.confirm('Tem certeza que deseja rejeitar este relatório?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/relatorios/semanal/${relatorioId}/rejeitar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Relatório rejeitado');
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast.error('Erro ao rejeitar relatório');
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'rascunho': 'Rascunho',
      'pendente_aprovacao': 'Pendente Aprovação',
      'aprovado': 'Aprovado',
      'aguarda_recibo': 'Aguarda Recibo',
      'verificado': 'Verificado',
      'pago': 'Pago',
      'rejeitado': 'Rejeitado',
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const config = {
      'rascunho': { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
      'pendente_aprovacao': { label: 'Pendente Aprovação', color: 'bg-yellow-100 text-yellow-700' },
      'aprovado': { label: 'Aprovado', color: 'bg-blue-100 text-blue-700' },
      'aguarda_recibo': { label: 'Aguarda Recibo', color: 'bg-orange-100 text-orange-700' },
      'verificado': { label: 'Verificado', color: 'bg-green-100 text-green-700' },
      'pago': { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' },
      'rejeitado': { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
    };
    const c = config[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  const relatoriosFiltrados = relatorios.filter(rel => {
    if (filtroStatus === 'todos') return true;
    return rel.status === filtroStatus;
  });

  const estatisticas = {
    total: relatorios.length,
    pendentes: relatorios.filter(r => r.status === 'pendente_aprovacao').length,
    aprovados: relatorios.filter(r => r.status === 'aprovado' || r.status === 'aguarda_recibo').length,
    rejeitados: relatorios.filter(r => r.status === 'rejeitado').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2">A carregar...</span>
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

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Relatórios Semanais
              </h1>
              <p className="text-slate-600">
                Gerir e aprovar relatórios semanais
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/criar-relatorio-opcoes')}>
            Criar Novo Relatório
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total</p>
                <p className="text-2xl font-bold">{estatisticas.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{estatisticas.pendentes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Aprovados</p>
                <p className="text-2xl font-bold text-blue-600">{estatisticas.aprovados}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Rejeitados</p>
                <p className="text-2xl font-bold text-red-600">{estatisticas.rejeitados}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">
                {selectedIds.length} relatório(s) selecionado(s)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStatusChangeModal(true)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Alterar Estado
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar Selecionados
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar Seleção
              </Button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-4 mb-4">
          {/* Select All Checkbox */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleSelectAll}
          >
            <Checkbox 
              checked={allSelected} 
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-slate-600">Selecionar Todos</span>
          </div>
          
          <div className="border-l h-6 mx-2"></div>
          
          {/* Status Filters */}
          <Button
            variant={filtroStatus === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('todos')}
          >
            Todos
          </Button>
          <Button
            variant={filtroStatus === 'pendente_aprovacao' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('pendente_aprovacao')}
          >
            Pendentes
          </Button>
          <Button
            variant={filtroStatus === 'aguarda_recibo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('aguarda_recibo')}
          >
            Aguarda Recibo
          </Button>
          <Button
            variant={filtroStatus === 'verificado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('verificado')}
          >
            Verificados
          </Button>
        </div>

        {/* Lista de Relatórios */}
        {relatoriosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum relatório encontrado</h3>
              <p className="text-slate-600 mb-4">
                Comece criando um novo relatório semanal
              </p>
              <Button onClick={() => navigate('/criar-relatorio-opcoes')}>
                Criar Relatório
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {relatoriosFiltrados.map((relatorio) => (
              <Card 
                key={relatorio.id} 
                className={`hover:shadow-lg transition-shadow ${isSelected(relatorio.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}
              >
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                    {/* Checkbox */}
                    <div className="lg:col-span-1 flex items-center">
                      <Checkbox
                        checked={isSelected(relatorio.id)}
                        onCheckedChange={() => toggleSelect(relatorio.id)}
                        className="mr-4"
                      />
                    </div>

                    {/* Info */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            {relatorio.motorista_nome}
                          </h3>
                          <p className="text-sm text-slate-600">{relatorio.numero_relatorio}</p>
                        </div>
                        {getStatusBadge(relatorio.status)}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>Semana {relatorio.semana}/{relatorio.ano}</span>
                        </div>
                        {relatorio.veiculo_matricula && (
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-400" />
                            <span>{relatorio.veiculo_matricula}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="border-l pl-6">
                      <h4 className="text-sm font-semibold mb-3">Valores</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Ganhos:</span>
                          <span className="font-bold text-green-600">
                            €{(relatorio.ganhos_totais || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Despesas:</span>
                          <span className="font-bold text-red-600">
                            €{(relatorio.total_despesas || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-semibold">Total:</span>
                          <span className="text-lg font-bold text-blue-600">
                            €{(relatorio.total_recibo || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="lg:col-span-2 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditarRelatorio(relatorio)}
                          disabled={relatorio.status === 'pago'}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      </div>
                      
                      {relatorio.status === 'pendente_aprovacao' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAprovarRelatorio(relatorio)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleRejeitarRelatorio(relatorio.id)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Edição */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Relatório</DialogTitle>
            </DialogHeader>
            {relatorioEditando && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ganhos Uber</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_uber || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        ganhos_uber: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Ganhos Bolt</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.ganhos_bolt || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        ganhos_bolt: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Combustível</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.combustivel_total || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        combustivel_total: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Via Verde</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.via_verde_total || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        via_verde_total: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Caução</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.caucao_semanal || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        caucao_semanal: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Extras/Outros</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.outros || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        outros: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Aluguer/Comissão Veículo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={relatorioEditando.aluguer_veiculo || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        aluguer_veiculo: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>KM Efetuados</Label>
                    <Input
                      type="number"
                      step="1"
                      value={relatorioEditando.km_percorridos || 0}
                      onChange={(e) => setRelatorioEditando({
                        ...relatorioEditando,
                        km_percorridos: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
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

        {/* Modal de Aprovação */}
        <Dialog open={showAprovarModal} onOpenChange={setShowAprovarModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Relatório</DialogTitle>
            </DialogHeader>
            {relatorioAprovando && (
              <div className="space-y-4">
                <p>Confirma a aprovação do relatório:</p>
                <div className="p-4 bg-slate-50 rounded">
                  <p className="font-semibold">{relatorioAprovando.motorista_nome}</p>
                  <p className="text-sm text-slate-600">{relatorioAprovando.numero_relatorio}</p>
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    €{(relatorioAprovando.total_recibo || 0).toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-slate-600">
                  Após aprovação, o motorista receberá uma notificação para anexar o recibo.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAprovarModal(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmarAprovacao} className="bg-green-600 hover:bg-green-700">
                Confirmar Aprovação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Eliminação */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Confirmar Eliminação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-700">
                Tem certeza que deseja eliminar <strong>{selectedIds.length}</strong> relatório(s)?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Esta ação é irreversível. Todos os dados dos relatórios selecionados serão permanentemente eliminados.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={processingBulk}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkDelete} 
                className="bg-red-600 hover:bg-red-700"
                disabled={processingBulk}
              >
                {processingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A eliminar...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar {selectedIds.length} Relatório(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Alteração de Estado em Lote */}
        <Dialog open={showStatusChangeModal} onOpenChange={setShowStatusChangeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Estado dos Relatórios</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-700">
                Selecione o novo estado para os <strong>{selectedIds.length}</strong> relatório(s) selecionado(s):
              </p>
              <div>
                <Label>Novo Estado</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="pendente_aprovacao">Pendente Aprovação</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="aguarda_recibo">Aguarda Recibo</SelectItem>
                    <SelectItem value="verificado">Verificado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusChangeModal(false)} disabled={processingBulk}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkStatusChange} 
                disabled={!newStatus || processingBulk}
              >
                {processingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A processar...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Aplicar a {selectedIds.length} Relatório(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RelatoriosSemanaisLista;
