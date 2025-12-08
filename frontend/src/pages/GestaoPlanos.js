import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Package, Plus, Edit, Trash2, Check, X, DollarSign,
  Car, Users, Shield, Info, Search
} from 'lucide-react';

const GestaoPlanos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    modulos: [],
    preco: 0,
    periodicidade: 'mensal',
    tipo_cobranca: 'fixo',
    limite_veiculos: null,
    limite_motoristas: null,
    ativo: true,
    tipo_usuario: 'parceiro'
  });

  useEffect(() => {
    fetchPlanos();
    fetchModulos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching planos:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const fetchModulos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/modulos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setModulos(response.data);
    } catch (error) {
      console.error('Error fetching módulos:', error);
      toast.error('Erro ao carregar módulos');
    }
  };

  const handleOpenModal = (plano = null) => {
    if (plano) {
      setEditingPlano(plano);
      setPlanoForm({
        nome: plano.nome,
        descricao: plano.descricao || '',
        modulos: plano.modulos || [],
        preco: plano.preco || 0,
        periodicidade: plano.periodicidade || 'mensal',
        tipo_cobranca: plano.tipo_cobranca || 'fixo',
        limite_veiculos: plano.limite_veiculos || null,
        limite_motoristas: plano.limite_motoristas || null,
        ativo: plano.ativo !== false,
        tipo_usuario: plano.tipo_usuario || 'parceiro'
      });
    } else {
      setEditingPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        modulos: [],
        preco: 0,
        periodicidade: 'mensal',
        tipo_cobranca: 'fixo',
        limite_veiculos: null,
        limite_motoristas: null,
        ativo: true,
        tipo_usuario: 'parceiro'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPlano(null);
  };

  const handleToggleModulo = (codigoModulo) => {
    setPlanoForm(prev => ({
      ...prev,
      modulos: prev.modulos.includes(codigoModulo)
        ? prev.modulos.filter(m => m !== codigoModulo)
        : [...prev.modulos, codigoModulo]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!planoForm.nome) {
      toast.error('Nome do plano é obrigatório');
      return;
    }

    if (planoForm.modulos.length === 0) {
      toast.error('Selecione pelo menos um módulo');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (editingPlano) {
        await axios.put(
          `${API}/api/planos/${editingPlano.id}`,
          planoForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano atualizado com sucesso');
      } else {
        await axios.post(
          `${API}/api/planos`,
          planoForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano criado com sucesso');
      }

      fetchPlanos();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving plano:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar plano');
    }
  };

  const handleDelete = async (planoId) => {
    if (!window.confirm('Tem certeza que deseja eliminar este plano?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/planos/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano eliminado com sucesso');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plano:', error);
      toast.error('Erro ao eliminar plano');
    }
  };

  const filteredPlanos = planos.filter(plano =>
    plano.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plano.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoCobrancaLabel = (tipo) => {
    const labels = {
      'por_veiculo': 'Por Veículo',
      'por_motorista': 'Por Motorista',
      'fixo': 'Valor Fixo'
    };
    return labels[tipo] || tipo;
  };

  const getTipoUsuarioLabel = (tipo) => {
    return tipo === 'motorista' ? 'Motorista' : 'Parceiro';
  };

  const getTipoUsuarioColor = (tipo) => {
    return tipo === 'motorista' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-8 h-8" />
              Gestão de Planos
            </h1>
            <p className="text-slate-600 mt-2">
              Configure planos para parceiros e motoristas com módulos personalizados
            </p>
          </div>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Plano
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Tipos de Cobrança Disponíveis:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>Por Veículo:</strong> Cobrado por cada veículo gerido</li>
                  <li><strong>Por Motorista:</strong> Cobrado por cada motorista registado</li>
                  <li><strong>Valor Fixo:</strong> Valor mensal fixo com limite de veículos/motoristas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Pesquisar planos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Plans Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">A carregar planos...</p>
          </div>
        ) : filteredPlanos.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Nenhum plano encontrado</p>
              <Button onClick={() => handleOpenModal()} className="mt-4">
                Criar Primeiro Plano
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlanos.map((plano) => (
              <Card key={plano.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{plano.nome}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge className={getTipoUsuarioColor(plano.tipo_usuario)}>
                          {getTipoUsuarioLabel(plano.tipo_usuario)}
                        </Badge>
                        <Badge variant={plano.ativo ? "default" : "secondary"}>
                          {plano.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {plano.descricao || 'Sem descrição'}
                  </p>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Cobrança:</span>
                      <span className="font-medium">{getTipoCobrancaLabel(plano.tipo_cobranca)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Preço:</span>
                      <span className="font-bold text-lg text-blue-600">
                        {plano.preco}€
                        <span className="text-sm text-slate-500">/{plano.periodicidade}</span>
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">
                      Módulos Incluídos:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {plano.modulos && plano.modulos.length > 0 ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {plano.modulos.length} módulos
                          </Badge>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">Nenhum módulo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModal(plano)}
                      className="flex-1 gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(plano.id)}
                      className="gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlano ? 'Editar Plano' : 'Criar Novo Plano'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Plano *</Label>
                  <Input
                    id="nome"
                    value={planoForm.nome}
                    onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })}
                    placeholder="Ex: Plano Básico"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_usuario">Tipo de Utilizador *</Label>
                  <Select
                    value={planoForm.tipo_usuario}
                    onValueChange={(value) => setPlanoForm({ ...planoForm, tipo_usuario: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                      <SelectItem value="motorista">Motorista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={planoForm.descricao}
                  onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
                  placeholder="Descrição do plano..."
                  rows={3}
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tipo_cobranca">Tipo de Cobrança *</Label>
                  <Select
                    value={planoForm.tipo_cobranca}
                    onValueChange={(value) => setPlanoForm({ ...planoForm, tipo_cobranca: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Valor Fixo</SelectItem>
                      <SelectItem value="por_veiculo">Por Veículo</SelectItem>
                      <SelectItem value="por_motorista">Por Motorista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="preco">Preço (€) *</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={planoForm.preco}
                    onChange={(e) => setPlanoForm({ ...planoForm, preco: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="periodicidade">Periodicidade *</Label>
                  <Select
                    value={planoForm.periodicidade}
                    onValueChange={(value) => setPlanoForm({ ...planoForm, periodicidade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Limits (only for fixo) */}
              {planoForm.tipo_cobranca === 'fixo' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="limite_veiculos">Limite de Veículos</Label>
                    <Input
                      id="limite_veiculos"
                      type="number"
                      value={planoForm.limite_veiculos || ''}
                      onChange={(e) => setPlanoForm({ 
                        ...planoForm, 
                        limite_veiculos: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="Ilimitado"
                    />
                  </div>

                  <div>
                    <Label htmlFor="limite_motoristas">Limite de Motoristas</Label>
                    <Input
                      id="limite_motoristas"
                      type="number"
                      value={planoForm.limite_motoristas || ''}
                      onChange={(e) => setPlanoForm({ 
                        ...planoForm, 
                        limite_motoristas: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>
              )}

              {/* Modules Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Módulos Incluídos * ({planoForm.modulos.length} selecionados)
                </Label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modulos.map((modulo) => (
                      <div
                        key={modulo.codigo}
                        className="flex items-start space-x-3 p-3 bg-white rounded border hover:border-blue-300 transition-colors"
                      >
                        <Checkbox
                          id={modulo.codigo}
                          checked={planoForm.modulos.includes(modulo.codigo)}
                          onCheckedChange={() => handleToggleModulo(modulo.codigo)}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={modulo.codigo}
                            className="text-sm font-medium cursor-pointer hover:text-blue-600"
                          >
                            {modulo.nome}
                          </label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {modulo.descricao}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ativo"
                  checked={planoForm.ativo}
                  onCheckedChange={(checked) => setPlanoForm({ ...planoForm, ativo: checked })}
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Plano ativo (visível para atribuição)
                </Label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit">
                  <Check className="w-4 h-4 mr-2" />
                  {editingPlano ? 'Atualizar' : 'Criar'} Plano
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoPlanos;
