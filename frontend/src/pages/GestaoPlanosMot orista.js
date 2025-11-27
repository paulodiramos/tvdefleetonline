import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package, CheckCircle, DollarSign } from 'lucide-react';

const FEATURES_DISPONIVEIS = [
  { id: 'alertas_recibos', nome: 'Alertas de Recibos por Enviar', descricao: 'Notificações automáticas para lembrar de enviar recibos' },
  { id: 'alertas_documentos', nome: 'Alertas de Validade de Documentos', descricao: 'Avisos de expiração de carta, seguro, inspeção, etc.' },
  { id: 'dashboard_ganhos', nome: 'Dashboard de Ganhos', descricao: 'Visualização detalhada de ganhos e despesas' },
  { id: 'relatorios_semanais', nome: 'Relatórios Semanais Automáticos', descricao: 'Geração automática de relatórios de performance' },
  { id: 'gestao_documentos', nome: 'Gestão de Documentos', descricao: 'Upload e organização de documentos pessoais' },
  { id: 'historico_pagamentos', nome: 'Histórico de Pagamentos', descricao: 'Acesso completo ao histórico de todos os pagamentos' },
  { id: 'analytics_avancado', nome: 'Analytics Avançado', descricao: 'Gráficos e análises detalhadas de performance' },
  { id: 'suporte_prioritario', nome: 'Suporte Prioritário', descricao: 'Atendimento prioritário e suporte dedicado' },
  { id: 'backup_nuvem', nome: 'Backup na Nuvem', descricao: 'Backup automático de todos os documentos' }
];

const GestaoPlanosMot orista = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);

  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    preco_mensal: 0,
    features: {}
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
      const response = await axios.get(`${API}/planos-motorista`, {
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
        preco_mensal: plano.preco_mensal,
        features: plano.features || {}
      });
    } else {
      setEditingPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        preco_mensal: 0,
        features: {}
      });
    }
    setShowModal(true);
  };

  const handleFeatureToggle = (featureId) => {
    setPlanoForm(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureId]: !prev.features[featureId]
      }
    }));
  };

  const handleSubmit = async () => {
    if (!planoForm.nome || !planoForm.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (editingPlano) {
        await axios.put(
          `${API}/planos-motorista/${editingPlano.id}`,
          planoForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano atualizado com sucesso!');
      } else {
        await axios.post(
          `${API}/planos-motorista`,
          planoForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano criado com sucesso!');
      }

      setShowModal(false);
      fetchPlanos();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar plano');
    }
  };

  const handleDelete = async (planoId) => {
    if (!confirm('Tem certeza que deseja desativar este plano?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/planos-motorista/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano desativado com sucesso!');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao desativar plano');
    }
  };

  const createDefaultPlans = async () => {
    const defaultPlans = [
      {
        nome: 'Básico',
        descricao: 'Plano gratuito com funcionalidades essenciais para começar',
        preco_mensal: 0,
        features: {
          'alertas_recibos': true,
          'alertas_documentos': true,
          'dashboard_ganhos': true,
          'gestao_documentos': true,
          'historico_pagamentos': false,
          'relatorios_semanais': false,
          'analytics_avancado': false,
          'suporte_prioritario': false,
          'backup_nuvem': false
        }
      },
      {
        nome: 'Premium',
        descricao: 'Plano intermediário com recursos avançados e relatórios automáticos',
        preco_mensal: 9.99,
        features: {
          'alertas_recibos': true,
          'alertas_documentos': true,
          'dashboard_ganhos': true,
          'gestao_documentos': true,
          'historico_pagamentos': true,
          'relatorios_semanais': true,
          'analytics_avancado': true,
          'suporte_prioritario': false,
          'backup_nuvem': true
        }
      },
      {
        nome: 'Profissional',
        descricao: 'Plano completo com todas as funcionalidades e suporte prioritário',
        preco_mensal: 19.99,
        features: {
          'alertas_recibos': true,
          'alertas_documentos': true,
          'dashboard_ganhos': true,
          'gestao_documentos': true,
          'historico_pagamentos': true,
          'relatorios_semanais': true,
          'analytics_avancado': true,
          'suporte_prioritario': true,
          'backup_nuvem': true
        }
      }
    ];

    try {
      const token = localStorage.getItem('token');
      
      for (const plan of defaultPlans) {
        await axios.post(
          `${API}/planos-motorista`,
          plan,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      toast.success('Planos padrão criados com sucesso!');
      fetchPlanos();
    } catch (error) {
      console.error('Error creating default plans:', error);
      toast.error('Erro ao criar planos padrão');
    }
  };

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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestão de Planos - Motoristas</h1>
            <p className="text-slate-600 mt-1">Configure os planos de assinatura para motoristas</p>
          </div>
          <div className="flex space-x-2">
            {planos.length === 0 && (
              <Button
                onClick={createDefaultPlans}
                variant="outline"
                className="bg-blue-50"
              >
                <Package className="w-4 h-4 mr-2" />
                Criar Planos Padrão
              </Button>
            )}
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </div>
        </div>

        {planos.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">Nenhum plano criado ainda</p>
              <Button onClick={createDefaultPlans}>
                Criar Planos Padrão (Básico, Premium, Profissional)
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {planos.map((plano) => (
              <Card key={plano.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{plano.nome}</CardTitle>
                      <CardDescription className="mt-2">
                        {plano.descricao}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-bold text-slate-800">
                      {plano.preco_mensal === 0 ? (
                        'Grátis'
                      ) : (
                        <>
                          €{plano.preco_mensal.toFixed(2)}
                          <span className="text-sm font-normal text-slate-600">/mês</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    <p className="text-sm font-semibold text-slate-700">Funcionalidades:</p>
                    {FEATURES_DISPONIVEIS.map((feature) => (
                      <div key={feature.id} className="flex items-center space-x-2">
                        {plano.features[feature.id] ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                        )}
                        <span className={`text-sm ${plano.features[feature.id] ? 'text-slate-700' : 'text-slate-400'}`}>
                          {feature.nome}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleOpenModal(plano)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(plano.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Criar/Editar Plano */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlano ? 'Editar Plano' : 'Criar Novo Plano'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Plano *</Label>
                <Input
                  id="nome"
                  value={planoForm.nome}
                  onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })}
                  placeholder="Ex: Básico, Premium, Profissional"
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  value={planoForm.descricao}
                  onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
                  placeholder="Descreva as características principais deste plano"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="preco_mensal">Preço Mensal (€) *</Label>
                <Input
                  id="preco_mensal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={planoForm.preco_mensal}
                  onChange={(e) => setPlanoForm({ ...planoForm, preco_mensal: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-500 mt-1">Use 0 para plano gratuito</p>
              </div>

              <div>
                <Label className="text-base font-semibold">Funcionalidades Incluídas</Label>
                <p className="text-sm text-slate-600 mb-3">Selecione as funcionalidades disponíveis neste plano</p>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {FEATURES_DISPONIVEIS.map((feature) => (
                    <div key={feature.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                      <Switch
                        checked={planoForm.features[feature.id] || false}
                        onCheckedChange={() => handleFeatureToggle(feature.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{feature.nome}</p>
                        <p className="text-xs text-slate-600 mt-1">{feature.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingPlano ? 'Atualizar Plano' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoPlanosMot orista;
