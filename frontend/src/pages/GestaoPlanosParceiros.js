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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Package, Plus, Edit, Trash2, Check, X, DollarSign,
  Car, Users, Shield, FileText, TrendingUp, FolderOpen,
  ClipboardCheck, Zap, Info
} from 'lucide-react';

const MODULOS_DISPONIVEIS = [
  { 
    codigo: 'gestao_eventos_veiculo', 
    nome: 'Gestão de Eventos de Veículo', 
    descricao: 'Editar agenda e eventos dos veículos',
    icon: Car
  },
  { 
    codigo: 'gestao_contratos', 
    nome: 'Gestão Avançada de Contratos', 
    descricao: 'Criar e gerir contratos de motoristas',
    icon: FileText
  },
  { 
    codigo: 'relatorios_avancados', 
    nome: 'Relatórios Avançados', 
    descricao: 'Acesso a relatórios detalhados e analytics',
    icon: TrendingUp
  },
  { 
    codigo: 'gestao_documentos', 
    nome: 'Gestão de Documentos', 
    descricao: 'Upload e gestão de documentos',
    icon: FolderOpen
  },
  { 
    codigo: 'acesso_vistorias', 
    nome: 'Acesso a Vistorias', 
    descricao: 'Visualizar e criar vistorias de veículos',
    icon: ClipboardCheck
  },
  { 
    codigo: 'moloni_auto_faturacao', 
    nome: 'Auto-Faturação Moloni', 
    descricao: 'Integração com Moloni para faturação automática',
    icon: Zap
  },
  { 
    codigo: 'configuracao_templates', 
    nome: 'Templates Personalizados', 
    descricao: 'Criar templates de contratos personalizados',
    icon: FileText
  }
];

const GestaoPlanosParceiros = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [saving, setSaving] = useState(false);

  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    preco: 0,
    periodicidade: 'mensal',
    tipo_cobranca: 'por_veiculo', // por_veiculo | por_motorista | mensal_fixo
    limite_veiculos: null,
    limite_motoristas: null,
    modulos: [],
    ativo: true
  });

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      setLoading(true);
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

  const handleOpenDialog = (plano = null) => {
    if (plano) {
      setEditingPlano(plano);
      setPlanoForm({
        nome: plano.nome,
        descricao: plano.descricao,
        preco: plano.preco,
        periodicidade: plano.periodicidade || 'mensal',
        tipo_cobranca: plano.tipo_cobranca || 'por_veiculo',
        limite_veiculos: plano.limite_veiculos,
        limite_motoristas: plano.limite_motoristas,
        modulos: plano.modulos || [],
        ativo: plano.ativo !== false
      });
    } else {
      setEditingPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        preco: 0,
        periodicidade: 'mensal',
        tipo_cobranca: 'por_veiculo',
        limite_veiculos: null,
        limite_motoristas: null,
        modulos: [],
        ativo: true
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!planoForm.nome || planoForm.preco < 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      const payload = {
        ...planoForm,
        preco: parseFloat(planoForm.preco),
        limite_veiculos: planoForm.limite_veiculos ? parseInt(planoForm.limite_veiculos) : null,
        limite_motoristas: planoForm.limite_motoristas ? parseInt(planoForm.limite_motoristas) : null
      };

      if (editingPlano) {
        await axios.put(
          `${API}/planos/${editingPlano.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano atualizado com sucesso!');
      } else {
        await axios.post(
          `${API}/planos`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano criado com sucesso!');
      }

      setShowDialog(false);
      fetchPlanos();
    } catch (error) {
      console.error('Error saving plano:', error);
      toast.error('Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planoId) => {
    if (!window.confirm('Tem certeza que deseja eliminar este plano?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/planos/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano eliminado com sucesso!');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plano:', error);
      toast.error('Erro ao eliminar plano');
    }
  };

  const toggleModulo = (codigoModulo) => {
    setPlanoForm(prev => {
      const modulos = [...prev.modulos];
      if (modulos.includes(codigoModulo)) {
        return { ...prev, modulos: modulos.filter(m => m !== codigoModulo) };
      } else {
        return { ...prev, modulos: [...modulos, codigoModulo] };
      }
    });
  };

  const getTipoCobrancaLabel = (tipo) => {
    const tipos = {
      por_veiculo: 'Por Veículo',
      por_motorista: 'Por Motorista',
      mensal_fixo: 'Mensal Fixo'
    };
    return tipos[tipo] || tipo;
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
              <Package className="w-8 h-8 text-blue-600" />
              <span>Gestão de Planos para Parceiros</span>
            </h1>
            <p className="text-slate-600 mt-2">
              Configurar planos com diferentes tipos de cobrança e módulos
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Criar Plano
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Tipos de Cobrança Disponíveis:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li><strong>Por Veículo:</strong> Cobrado por cada veículo gerido</li>
                  <li><strong>Por Motorista:</strong> Cobrado por cada motorista registado</li>
                  <li><strong>Mensal Fixo:</strong> Valor fixo mensal com limite de veículos/motoristas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {planos.map((plano) => (
            <Card key={plano.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{plano.nome}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{plano.descricao}</p>
                  </div>
                  {plano.ativo !== false ? (
                    <Badge className="bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600">
                      <X className="w-3 h-3 mr-1" />
                      Inativo
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preço */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="text-3xl font-bold text-slate-800">
                      €{plano.preco}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {getTipoCobrancaLabel(plano.tipo_cobranca)} / {plano.periodicidade}
                  </p>
                  {plano.limite_veiculos && (
                    <p className="text-xs text-slate-500 mt-1">
                      Limite: {plano.limite_veiculos} veículos
                    </p>
                  )}
                  {plano.limite_motoristas && (
                    <p className="text-xs text-slate-500 mt-1">
                      Limite: {plano.limite_motoristas} motoristas
                    </p>
                  )}
                </div>

                {/* Módulos */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Módulos Incluídos:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(plano.modulos || []).length > 0 ? (
                      plano.modulos.map((modulo) => {
                        const moduloInfo = MODULOS_DISPONIVEIS.find(m => m.codigo === modulo);
                        return (
                          <Badge key={modulo} className="bg-purple-100 text-purple-800 text-xs">
                            {moduloInfo?.nome.split(' ')[0] || modulo}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500">Nenhum módulo</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Total: {(plano.modulos || []).length} módulos
                  </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(plano)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(plano.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {planos.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              Nenhum plano criado. Clique em "Criar Plano" para começar.
            </CardContent>
          </Card>
        )}

        {/* Dialog Criar/Editar Plano */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlano ? 'Editar Plano' : 'Criar Novo Plano'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome do Plano *</Label>
                  <Input
                    value={planoForm.nome}
                    onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })}
                    placeholder="Ex: Premium, Básico, Enterprise"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={planoForm.descricao}
                    onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
                    placeholder="Descrição breve do plano..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Preço (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={planoForm.preco}
                    onChange={(e) => setPlanoForm({ ...planoForm, preco: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Periodicidade</Label>
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

                <div>
                  <Label>Tipo de Cobrança *</Label>
                  <Select
                    value={planoForm.tipo_cobranca}
                    onValueChange={(value) => setPlanoForm({ ...planoForm, tipo_cobranca: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="por_veiculo">Por Veículo</SelectItem>
                      <SelectItem value="por_motorista">Por Motorista</SelectItem>
                      <SelectItem value="mensal_fixo">Mensal Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {planoForm.tipo_cobranca === 'mensal_fixo' && (
                  <>
                    <div>
                      <Label>Limite de Veículos</Label>
                      <Input
                        type="number"
                        value={planoForm.limite_veiculos || ''}
                        onChange={(e) => setPlanoForm({ ...planoForm, limite_veiculos: e.target.value })}
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div>
                      <Label>Limite de Motoristas</Label>
                      <Input
                        type="number"
                        value={planoForm.limite_motoristas || ''}
                        onChange={(e) => setPlanoForm({ ...planoForm, limite_motoristas: e.target.value })}
                        placeholder="Ex: 20"
                      />
                    </div>
                  </>
                )}

                <div className="col-span-2 flex items-center space-x-2">
                  <Switch
                    checked={planoForm.ativo}
                    onCheckedChange={(checked) => setPlanoForm({ ...planoForm, ativo: checked })}
                  />
                  <Label>Plano Ativo</Label>
                </div>
              </div>

              {/* Módulos */}
              <div>
                <Label className="text-base font-semibold">Módulos Incluídos</Label>
                <p className="text-sm text-slate-500 mb-3">Selecione os módulos que este plano terá acesso</p>
                
                <div className="grid grid-cols-1 gap-3">
                  {MODULOS_DISPONIVEIS.map((modulo) => {
                    const Icon = modulo.icon;
                    return (
                      <Card key={modulo.codigo} className={planoForm.modulos.includes(modulo.codigo) ? 'border-purple-500 bg-purple-50' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <Icon className="w-5 h-5 text-purple-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{modulo.nome}</p>
                                <p className="text-xs text-slate-500">{modulo.descricao}</p>
                              </div>
                            </div>
                            <Switch
                              checked={planoForm.modulos.includes(modulo.codigo)}
                              onCheckedChange={() => toggleModulo(modulo.codigo)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                
                <p className="text-sm text-slate-600 mt-3">
                  <strong>{planoForm.modulos.length}</strong> de {MODULOS_DISPONIVEIS.length} módulos selecionados
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Salvando...' : editingPlano ? 'Atualizar Plano' : 'Criar Plano'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoPlanosParceiros;
