import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Receipt, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Filter,
  X,
  ArrowLeft
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIPOS_EXTRA = [
  { value: 'divida', label: 'Dívida', color: 'bg-red-100 text-red-700' },
  { value: 'caucao_parcelada', label: 'Caução Parcelada', color: 'bg-amber-100 text-amber-700' },
  { value: 'dano', label: 'Dano no Veículo', color: 'bg-orange-100 text-orange-700' },
  { value: 'multa', label: 'Multa', color: 'bg-purple-100 text-purple-700' },
  { value: 'outro', label: 'Outro', color: 'bg-slate-100 text-slate-700' }
];

const GestaoExtrasMotorista = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [extras, setExtras] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPago, setFiltroPago] = useState('');
  
  // Formulário
  const [formData, setFormData] = useState({
    motorista_id: '',
    tipo: 'divida',
    descricao: '',
    valor: '',
    semana: '',
    ano: new Date().getFullYear(),
    parcelas_total: '',
    parcela_atual: '',
    pago: false,
    observacoes: ''
  });

  useEffect(() => {
    fetchMotoristas();
    fetchExtras();
  }, []);

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(response.data);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  };

  const fetchExtras = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/extras-motorista`;
      const params = new URLSearchParams();
      
      if (filtroMotorista) params.append('motorista_id', filtroMotorista);
      if (filtroTipo) params.append('tipo', filtroTipo);
      if (filtroPago !== '') params.append('pago', filtroPago);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtras(response.data);
    } catch (error) {
      console.error('Erro ao carregar extras:', error);
      toast.error('Erro ao carregar extras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtras();
  }, [filtroMotorista, filtroTipo, filtroPago]);

  const resetForm = () => {
    setFormData({
      motorista_id: '',
      tipo: 'divida',
      descricao: '',
      valor: '',
      semana: '',
      ano: new Date().getFullYear(),
      parcelas_total: '',
      parcela_atual: '',
      pago: false,
      observacoes: ''
    });
    setEditingExtra(null);
  };

  const openModal = (extra = null) => {
    if (extra) {
      setEditingExtra(extra);
      setFormData({
        motorista_id: extra.motorista_id,
        tipo: extra.tipo,
        descricao: extra.descricao,
        valor: extra.valor.toString(),
        semana: extra.semana?.toString() || '',
        ano: extra.ano || new Date().getFullYear(),
        parcelas_total: extra.parcelas_total?.toString() || '',
        parcela_atual: extra.parcela_atual?.toString() || '',
        pago: extra.pago,
        observacoes: extra.observacoes || ''
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.motorista_id || !formData.descricao || !formData.valor) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        valor: parseFloat(formData.valor),
        semana: formData.semana ? parseInt(formData.semana) : null,
        ano: formData.ano ? parseInt(formData.ano) : null,
        parcelas_total: formData.parcelas_total ? parseInt(formData.parcelas_total) : null,
        parcela_atual: formData.parcela_atual ? parseInt(formData.parcela_atual) : null
      };

      if (editingExtra) {
        await axios.put(
          `${API_URL}/api/extras-motorista/${editingExtra.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Extra atualizado com sucesso');
      } else {
        await axios.post(
          `${API_URL}/api/extras-motorista`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Extra criado com sucesso');
      }

      setModalOpen(false);
      resetForm();
      fetchExtras();
    } catch (error) {
      console.error('Erro ao salvar extra:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar extra');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (extraId) => {
    if (!window.confirm('Tem certeza que deseja eliminar este extra?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/extras-motorista/${extraId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extra eliminado');
      fetchExtras();
    } catch (error) {
      console.error('Erro ao eliminar extra:', error);
      toast.error('Erro ao eliminar extra');
    }
  };

  const getMotoristaName = (motoristaId) => {
    const motorista = motoristas.find(m => m.id === motoristaId);
    return motorista?.name || 'Desconhecido';
  };

  const getTipoBadge = (tipo) => {
    const tipoConfig = TIPOS_EXTRA.find(t => t.value === tipo);
    if (!tipoConfig) return <Badge variant="secondary">{tipo}</Badge>;
    return <Badge className={tipoConfig.color}>{tipoConfig.label}</Badge>;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const totalExtras = extras.reduce((sum, e) => sum + (e.valor || 0), 0);
  const totalPagos = extras.filter(e => e.pago).reduce((sum, e) => sum + (e.valor || 0), 0);
  const totalPendentes = totalExtras - totalPagos;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="gestao-extras-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              data-testid="btn-voltar"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestão de Extras</h1>
              <p className="text-slate-500">Dívidas, Cauções, Danos e outros valores a cobrar</p>
            </div>
          </div>
          <Button onClick={() => openModal()} data-testid="btn-novo-extra">
            <Plus className="w-4 h-4 mr-2" />
            Novo Extra
          </Button>
        </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Total Extras</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalExtras)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">Pendentes</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalPendentes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">Pagos</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPagos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Filtros:</span>
            </div>
            
            <Select value={filtroMotorista || "all"} onValueChange={(v) => setFiltroMotorista(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]" data-testid="filtro-motorista">
                <SelectValue placeholder="Motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {motoristas.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroTipo || "all"} onValueChange={(v) => setFiltroTipo(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]" data-testid="filtro-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TIPOS_EXTRA.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPago === "" ? "all" : filtroPago} onValueChange={(v) => setFiltroPago(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[130px]" data-testid="filtro-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="false">Pendente</SelectItem>
                <SelectItem value="true">Pago</SelectItem>
              </SelectContent>
            </Select>

            {(filtroMotorista || filtroTipo || filtroPago !== '') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setFiltroMotorista('');
                  setFiltroTipo('');
                  setFiltroPago('');
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Lista de Extras ({extras.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : extras.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum extra encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Motorista</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Semana</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extras.map((extra) => (
                    <TableRow key={extra.id} data-testid={`extra-row-${extra.id}`}>
                      <TableCell className="font-medium">
                        {getMotoristaName(extra.motorista_id)}
                      </TableCell>
                      <TableCell>{getTipoBadge(extra.tipo)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={extra.descricao}>
                        {extra.descricao}
                        {extra.parcelas_total && (
                          <span className="text-xs text-slate-400 ml-2">
                            ({extra.parcela_atual || 1}/{extra.parcelas_total})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(extra.valor)}
                      </TableCell>
                      <TableCell className="text-center text-slate-600">
                        {extra.semana && extra.ano ? `S${extra.semana}/${extra.ano}` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {extra.pago ? (
                          <Badge className="bg-green-100 text-green-700">Pago</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => openModal(extra)}
                            data-testid={`btn-edit-${extra.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(extra.id)}
                            data-testid={`btn-delete-${extra.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-extra">
          <DialogHeader>
            <DialogTitle>
              {editingExtra ? 'Editar Extra' : 'Novo Extra'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="motorista_id">Motorista *</Label>
              <Select 
                value={formData.motorista_id} 
                onValueChange={(v) => setFormData({...formData, motorista_id: v})}
                disabled={!!editingExtra}
              >
                <SelectTrigger data-testid="select-motorista">
                  <SelectValue placeholder="Selecione o motorista" />
                </SelectTrigger>
                <SelectContent>
                  {motoristas.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v) => setFormData({...formData, tipo: v})}
              >
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EXTRA.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                placeholder="Ex: Combustível em falta"
                data-testid="input-descricao"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (€) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  placeholder="0.00"
                  data-testid="input-valor"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="semana">Semana</Label>
                <div className="flex gap-2">
                  <Input
                    id="semana"
                    type="number"
                    min="1"
                    max="53"
                    value={formData.semana}
                    onChange={(e) => setFormData({...formData, semana: e.target.value})}
                    placeholder="Sem"
                    className="w-16"
                    data-testid="input-semana"
                  />
                  <Input
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.ano}
                    onChange={(e) => setFormData({...formData, ano: e.target.value})}
                    placeholder="Ano"
                    className="w-20"
                    data-testid="input-ano"
                  />
                </div>
              </div>
            </div>

            {formData.tipo === 'caucao_parcelada' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.parcelas_total}
                    onChange={(e) => setFormData({...formData, parcelas_total: e.target.value})}
                    placeholder="12"
                    data-testid="input-parcelas-total"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parcela Atual</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.parcela_atual}
                    onChange={(e) => setFormData({...formData, parcela_atual: e.target.value})}
                    placeholder="1"
                    data-testid="input-parcela-atual"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Notas adicionais..."
                rows={2}
                data-testid="input-observacoes"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pago"
                checked={formData.pago}
                onChange={(e) => setFormData({...formData, pago: e.target.checked})}
                className="rounded"
                data-testid="checkbox-pago"
              />
              <Label htmlFor="pago" className="cursor-pointer">Marcar como pago</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} data-testid="btn-submit-extra">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingExtra ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
};

export default GestaoExtrasMotorista;
