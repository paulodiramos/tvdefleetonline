import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package, CheckCircle } from 'lucide-react';

const FEATURES_DISPONIVEIS = [
  { id: 'relatorios', nome: 'Relatórios' },
  { id: 'gestao_seguros', nome: 'Gestão de Seguros' },
  { id: 'gestao_contas', nome: 'Gestão de Contas' },
  { id: 'gestao_pagamentos', nome: 'Gestão de Pagamentos' },
  { id: 'gestao_manutencao', nome: 'Gestão de Manutenção' },
  { id: 'gestao_motoristas', nome: 'Gestão de Motoristas' },
  { id: 'gestao_veiculos', nome: 'Gestão de Veículos' },
  { id: 'emissao_contrato', nome: 'Emissão de Contratos' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'sync_automatico', nome: 'Sincronização Automática' },
  { id: 'upload_csv', nome: 'Upload CSV' }
];

const PERFIS_DISPONIVEIS = [
  { id: 'admin', nome: 'Admin' },
  { id: 'parceiro', nome: 'Parceiro' },
  { id: 'operacional', nome: 'Operacional' },
  { id: 'gestao', nome: 'Gestor' }
];

const GestaoPlanos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);

  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    features: [],
    perfis_permitidos: [],
    tipo_cobranca: 'por_veiculo',
    preco_semanal_sem_iva: 0,
    iva_percentagem: 23,
    preco_mensal_sem_iva: 0,
    desconto_mensal_percentagem: 0,
    promocao: {
      ativa: false,
      nome: '',
      desconto_percentagem: 0,
      valida_ate: ''
    }
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Acesso negado');
      window.location.href = '/dashboard';
      return;
    }
    fetchPlanos();
  }, [user]);

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plano = null) => {
    if (plano) {
      setEditingPlano(plano);
      setPlanoForm({
        nome: plano.nome,
        descricao: plano.descricao,
        features: plano.features || [],
        perfis_permitidos: plano.perfis_permitidos || [],
        preco_semanal_sem_iva: plano.preco_semanal_sem_iva,
        iva_percentagem: plano.iva_percentagem,
        preco_mensal_sem_iva: plano.preco_mensal_sem_iva,
        desconto_mensal_percentagem: plano.desconto_mensal_percentagem,
        promocao: plano.promocao || {
          ativa: false,
          nome: '',
          desconto_percentagem: 0,
          valida_ate: ''
        }
      });
    } else {
      setEditingPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        features: [],
        perfis_permitidos: [],
        preco_semanal_sem_iva: 0,
        iva_percentagem: 23,
        preco_mensal_sem_iva: 0,
        desconto_mensal_percentagem: 0,
        promocao: {
          ativa: false,
          nome: '',
          desconto_percentagem: 0,
          valida_ate: ''
        }
      });
    }
    setShowModal(true);
  };

  const handleSavePlano = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (editingPlano) {
        await axios.put(`${API}/planos/${editingPlano.id}`, planoForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plano atualizado com sucesso!');
      } else {
        await axios.post(`${API}/planos`, planoForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plano criado com sucesso!');
      }
      
      setShowModal(false);
      fetchPlanos();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao guardar plano');
    }
  };

  const handleDeletePlano = async (planoId) => {
    if (!window.confirm('Tem certeza que deseja desativar este plano?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/planos/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano desativado!');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao desativar plano');
    }
  };

  const toggleFeature = (featureId) => {
    const features = [...planoForm.features];
    const index = features.indexOf(featureId);
    if (index > -1) {
      features.splice(index, 1);
    } else {
      features.push(featureId);
    }
    setPlanoForm({ ...planoForm, features });
  };

  const togglePerfil = (perfilId) => {
    const perfis = [...planoForm.perfis_permitidos];
    const index = perfis.indexOf(perfilId);
    if (index > -1) {
      perfis.splice(index, 1);
    } else {
      perfis.push(perfilId);
    }
    setPlanoForm({ ...planoForm, perfis_permitidos: perfis });
  };

  const calculatePrecoComIVA = (precoSemIVA) => {
    return (precoSemIVA * (1 + planoForm.iva_percentagem / 100)).toFixed(2);
  };

  if (loading) {
    return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestão de Planos</h1>
            <p className="text-slate-600 mt-1">Gerir planos e funcionalidades</p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Plano
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {planos.map((plano) => (
            <Card key={plano.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>{plano.nome}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenModal(plano)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeletePlano(plano.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">{plano.descricao}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Semanal:</span>
                    <span className="font-semibold">€{calculatePrecoComIVA(plano.preco_semanal_sem_iva)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Mensal:</span>
                    <span className="font-semibold">€{calculatePrecoComIVA(plano.preco_mensal_sem_iva)}</span>
                  </div>
                  {plano.desconto_mensal_percentagem > 0 && (
                    <p className="text-xs text-green-600">Desconto mensal: {plano.desconto_mensal_percentagem}%</p>
                  )}
                </div>

                {plano.promocao?.ativa && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 mb-4">
                    <p className="text-xs text-red-700 font-semibold">{plano.promocao.nome}</p>
                    <p className="text-xs text-red-600">-{plano.promocao.desconto_percentagem}% até {new Date(plano.promocao.valida_ate).toLocaleDateString()}</p>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Perfis Permitidos:</p>
                  <div className="flex flex-wrap gap-1">
                    {plano.perfis_permitidos && plano.perfis_permitidos.length > 0 ? (
                      plano.perfis_permitidos.map((perfil) => {
                        const perfilInfo = PERFIS_DISPONIVEIS.find(p => p.id === perfil);
                        return (
                          <span key={perfil} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {perfilInfo?.nome || perfil}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500">Todos os perfis</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Funcionalidades:</p>
                  {plano.features.map((feature) => {
                    const featureInfo = FEATURES_DISPONIVEIS.find(f => f.id === feature);
                    return (
                      <div key={feature} className="flex items-center text-xs text-slate-600">
                        <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                        {featureInfo?.nome || feature}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal Criar/Editar Plano */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Plano</Label>
                <Input
                  id="nome"
                  value={planoForm.nome}
                  onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })}
                  placeholder="Ex: Plano Premium"
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={planoForm.descricao}
                  onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
                  placeholder="Descrição do plano"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preco_semanal">Preço Semanal (sem IVA)</Label>
                  <Input
                    id="preco_semanal"
                    type="number"
                    step="0.01"
                    value={planoForm.preco_semanal_sem_iva}
                    onChange={(e) => setPlanoForm({ ...planoForm, preco_semanal_sem_iva: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Com IVA: €{calculatePrecoComIVA(planoForm.preco_semanal_sem_iva)}
                  </p>
                </div>

                <div>
                  <Label htmlFor="preco_mensal">Preço Mensal (sem IVA)</Label>
                  <Input
                    id="preco_mensal"
                    type="number"
                    step="0.01"
                    value={planoForm.preco_mensal_sem_iva}
                    onChange={(e) => setPlanoForm({ ...planoForm, preco_mensal_sem_iva: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Com IVA: €{calculatePrecoComIVA(planoForm.preco_mensal_sem_iva)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iva">IVA (%)</Label>
                  <Input
                    id="iva"
                    type="number"
                    value={planoForm.iva_percentagem}
                    onChange={(e) => setPlanoForm({ ...planoForm, iva_percentagem: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="desconto_mensal">Desconto Mensal (%)</Label>
                  <Input
                    id="desconto_mensal"
                    type="number"
                    value={planoForm.desconto_mensal_percentagem}
                    onChange={(e) => setPlanoForm({ ...planoForm, desconto_mensal_percentagem: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Promoção */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Promoção Temporária</Label>
                  <Switch
                    checked={planoForm.promocao.ativa}
                    onCheckedChange={(checked) => setPlanoForm({
                      ...planoForm,
                      promocao: { ...planoForm.promocao, ativa: checked }
                    })}
                  />
                </div>

                {planoForm.promocao.ativa && (
                  <div className="space-y-3 bg-red-50 p-4 rounded">
                    <div>
                      <Label htmlFor="promo_nome">Nome da Promoção</Label>
                      <Input
                        id="promo_nome"
                        value={planoForm.promocao.nome}
                        onChange={(e) => setPlanoForm({
                          ...planoForm,
                          promocao: { ...planoForm.promocao, nome: e.target.value }
                        })}
                        placeholder="Ex: Black Friday"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="promo_desconto">Desconto (%)</Label>
                        <Input
                          id="promo_desconto"
                          type="number"
                          value={planoForm.promocao.desconto_percentagem}
                          onChange={(e) => setPlanoForm({
                            ...planoForm,
                            promocao: { ...planoForm.promocao, desconto_percentagem: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="promo_validade">Válida Até</Label>
                        <Input
                          id="promo_validade"
                          type="date"
                          value={planoForm.promocao.valida_ate}
                          onChange={(e) => setPlanoForm({
                            ...planoForm,
                            promocao: { ...planoForm.promocao, valida_ate: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Perfis Permitidos */}
              <div className="border-t pt-4">
                <Label className="mb-3 block">Perfis Permitidos (deixe vazio para todos)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PERFIS_DISPONIVEIS.map((perfil) => (
                    <div key={perfil.id} className="flex items-center space-x-2">
                      <Switch
                        checked={planoForm.perfis_permitidos.includes(perfil.id)}
                        onCheckedChange={() => togglePerfil(perfil.id)}
                      />
                      <Label className="cursor-pointer">{perfil.nome}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Se nenhum perfil for selecionado, o plano estará disponível para todos.
                </p>
              </div>

              {/* Funcionalidades */}
              <div className="border-t pt-4">
                <Label className="mb-3 block">Funcionalidades Incluídas</Label>
                <div className="grid grid-cols-2 gap-3">
                  {FEATURES_DISPONIVEIS.map((feature) => (
                    <div key={feature.id} className="flex items-center space-x-2">
                      <Switch
                        checked={planoForm.features.includes(feature.id)}
                        onCheckedChange={() => toggleFeature(feature.id)}
                      />
                      <Label className="cursor-pointer">{feature.nome}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePlano}>
                  {editingPlano ? 'Atualizar' : 'Criar'} Plano
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoPlanos;
