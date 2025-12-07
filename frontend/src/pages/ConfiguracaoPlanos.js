import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MODULOS_DISPONIVEIS = {
  motorista: [
    'dashboard_ganhos',
    'alertas_recibos',
    'alertas_documentos',
    'relatorios_semanais',
    'gestao_documentos',
    'historico_pagamentos',
    'analytics_avancado',
    'suporte_prioritario',
    'backup_nuvem'
  ],
  parceiro: [
    'relatorios',
    'gestao_seguros',
    'gestao_contas',
    'gestao_pagamentos',
    'gestao_manutencao',
    'gestao_motoristas',
    'gestao_veiculos',
    'emissao_contratos',
    'financeiro',
    'sincronizacao_automatica',
    'upload_csv'
  ],
  operacional: [
    'relatorios',
    'gestao_seguros',
    'gestao_contas',
    'gestao_pagamentos',
    'gestao_manutencao',
    'gestao_motoristas',
    'gestao_veiculos',
    'validacao_documentos',
    'aprovacao_recibos',
    'dashboard_operacional'
  ],
  gestao: [
    'relatorios_completos',
    'gestao_total',
    'aprovacoes',
    'financeiro_total',
    'analytics_gestao',
    'exportacao_dados'
  ]
};

const LABELS_MODULOS = {
  dashboard_ganhos: 'Dashboard de Ganhos',
  alertas_recibos: 'Alertas de Recibos',
  alertas_documentos: 'Alertas de Documentos',
  relatorios_semanais: 'Relatórios Semanais',
  gestao_documentos: 'Gestão de Documentos',
  historico_pagamentos: 'Histórico de Pagamentos',
  analytics_avancado: 'Analytics Avançado',
  suporte_prioritario: 'Suporte Prioritário',
  backup_nuvem: 'Backup na Nuvem',
  relatorios: 'Relatórios',
  gestao_seguros: 'Gestão de Seguros',
  gestao_contas: 'Gestão de Contas',
  gestao_pagamentos: 'Gestão de Pagamentos',
  gestao_manutencao: 'Gestão de Manutenção',
  gestao_motoristas: 'Gestão de Motoristas',
  gestao_veiculos: 'Gestão de Veículos',
  emissao_contratos: 'Emissão de Contratos',
  financeiro: 'Financeiro',
  sincronizacao_automatica: 'Sincronização Automática',
  upload_csv: 'Upload CSV',
  validacao_documentos: 'Validação de Documentos',
  aprovacao_recibos: 'Aprovação de Recibos',
  dashboard_operacional: 'Dashboard Operacional',
  relatorios_completos: 'Relatórios Completos',
  gestao_total: 'Gestão Total',
  aprovacoes: 'Aprovações',
  financeiro_total: 'Financeiro Total',
  analytics_gestao: 'Analytics de Gestão',
  exportacao_dados: 'Exportação de Dados'
};

const ConfiguracaoPlanos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    preco_mensal: 0,
    tipo_usuario: 'motorista',
    modulos: [],
    ativo: true,
    permite_trial: true,
    dias_trial: 30
  });

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos-sistema`, {
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

  const handleSavePlano = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (editingPlano) {
        await axios.put(`${API}/planos-sistema/${editingPlano.id}`, planoForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plano atualizado com sucesso!');
      } else {
        await axios.post(`${API}/planos-sistema`, planoForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plano criado com sucesso!');
      }
      
      setShowModal(false);
      resetForm();
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
      await axios.delete(`${API}/planos-sistema/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano desativado!');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao desativar plano');
    }
  };

  const handleEditPlano = (plano) => {
    setEditingPlano(plano);
    setPlanoForm({
      nome: plano.nome,
      descricao: plano.descricao,
      preco_mensal: plano.preco_mensal,
      tipo_usuario: plano.tipo_usuario,
      modulos: plano.modulos || [],
      ativo: plano.ativo,
      permite_trial: plano.permite_trial || false,
      dias_trial: plano.dias_trial || 30
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPlano(null);
    setPlanoForm({
      nome: '',
      descricao: '',
      preco_mensal: 0,
      tipo_usuario: 'motorista',
      modulos: [],
      ativo: true,
      permite_trial: true,
      dias_trial: 30
    });
  };

  const toggleModulo = (modulo) => {
    setPlanoForm(prev => ({
      ...prev,
      modulos: prev.modulos.includes(modulo)
        ? prev.modulos.filter(m => m !== modulo)
        : [...prev.modulos, modulo]
    }));
  };

  const planosPorTipo = {
    motorista: planos.filter(p => p.tipo_usuario === 'motorista'),
    parceiro: planos.filter(p => p.tipo_usuario === 'parceiro'),
    operacional: planos.filter(p => p.tipo_usuario === 'operacional'),
    gestao: planos.filter(p => p.tipo_usuario === 'gestao')
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configuração de Planos</h1>
            <p className="text-slate-600 mt-1">Gerir planos de subscrição para todos os tipos de utilizadores</p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Criar Novo Plano
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">A carregar planos...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {['motorista', 'parceiro', 'operacional', 'gestao'].map(tipo => (
              <div key={tipo}>
                <h2 className="text-xl font-bold mb-4 capitalize flex items-center">
                  <Package className="w-5 h-5 mr-2 text-blue-600" />
                  Planos para {tipo === 'gestao' ? 'Gestão' : tipo === 'motorista' ? 'Motoristas' : tipo === 'parceiro' ? 'Parceiros' : 'Operacionais'}
                  <Badge className="ml-3">{planosPorTipo[tipo].length}</Badge>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {planosPorTipo[tipo].length === 0 ? (
                    <div className="col-span-full p-8 text-center border-2 border-dashed rounded-lg">
                      <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Nenhum plano criado para este tipo de utilizador</p>
                    </div>
                  ) : (
                    planosPorTipo[tipo].map(plano => (
                      <Card key={plano.id} className={`${!plano.ativo && 'opacity-60'}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center space-x-2">
                                <span>{plano.nome}</span>
                                {!plano.ativo && <Badge variant="destructive">Inativo</Badge>}
                                {plano.permite_trial && <Badge className="bg-green-100 text-green-800">Trial</Badge>}
                              </CardTitle>
                              <p className="text-2xl font-bold text-blue-600 mt-2">
                                €{plano.preco_mensal.toFixed(2)}/mês
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-600 mb-3">{plano.descricao}</p>
                          
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-700 mb-1">Módulos incluídos:</p>
                            <div className="flex flex-wrap gap-1">
                              {plano.modulos && plano.modulos.slice(0, 3).map((mod, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {LABELS_MODULOS[mod] || mod}
                                </Badge>
                              ))}
                              {plano.modulos && plano.modulos.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{plano.modulos.length - 3} mais
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditPlano(plano)}
                              className="flex-1"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeletePlano(plano.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Criar/Editar Plano */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlano ? 'Editar Plano' : 'Criar Novo Plano'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Plano *</Label>
                  <Input
                    value={planoForm.nome}
                    onChange={(e) => setPlanoForm({...planoForm, nome: e.target.value})}
                    placeholder="Ex: Básico, Premium, Enterprise"
                  />
                </div>

                <div>
                  <Label>Tipo de Utilizador *</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={planoForm.tipo_usuario}
                    onChange={(e) => setPlanoForm({...planoForm, tipo_usuario: e.target.value, modulos: []})}
                  >
                    <option value="motorista">Motorista</option>
                    <option value="parceiro">Parceiro</option>
                    <option value="operacional">Operacional</option>
                    <option value="gestao">Gestão</option>
                  </select>
                </div>

                <div>
                  <Label>Preço Mensal (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={planoForm.preco_mensal}
                    onChange={(e) => setPlanoForm({...planoForm, preco_mensal: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={planoForm.ativo}
                      onChange={(e) => setPlanoForm({...planoForm, ativo: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Plano Ativo</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={planoForm.permite_trial}
                      onChange={(e) => setPlanoForm({...planoForm, permite_trial: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Permite Trial</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <textarea
                  className="w-full p-2 border rounded min-h-[80px]"
                  value={planoForm.descricao}
                  onChange={(e) => setPlanoForm({...planoForm, descricao: e.target.value})}
                  placeholder="Descreva as características do plano..."
                />
              </div>

              {planoForm.permite_trial && (
                <div>
                  <Label>Dias de Trial</Label>
                  <Input
                    type="number"
                    value={planoForm.dias_trial}
                    onChange={(e) => setPlanoForm({...planoForm, dias_trial: parseInt(e.target.value)})}
                  />
                </div>
              )}

              {/* Módulos */}
              <div>
                <Label className="text-lg font-semibold mb-3 block">Módulos Disponíveis</Label>
                <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-lg max-h-64 overflow-y-auto">
                  {MODULOS_DISPONIVEIS[planoForm.tipo_usuario]?.map(modulo => (
                    <label
                      key={modulo}
                      className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-white transition ${
                        planoForm.modulos.includes(modulo) ? 'bg-blue-100 border border-blue-300' : 'bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={planoForm.modulos.includes(modulo)}
                        onChange={() => toggleModulo(modulo)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{LABELS_MODULOS[modulo]}</span>
                      {planoForm.modulos.includes(modulo) && (
                        <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {planoForm.modulos.length} módulo(s) selecionado(s)
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePlano}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!planoForm.nome || planoForm.modulos.length === 0}
                >
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

export default ConfiguracaoPlanos;
