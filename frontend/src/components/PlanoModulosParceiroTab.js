import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Crown,
  Zap,
  Gift,
  Plus,
  Loader2,
  Calendar,
  Euro,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Car,
  Users,
  Settings
} from 'lucide-react';

const PlanoModulosParceiroTab = ({ parceiroId, parceiroNome }) => {
  const [loading, setLoading] = useState(true);
  const [subscricao, setSubscricao] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [modulosAtivos, setModulosAtivos] = useState([]);
  
  // Modals
  const [showAtribuirPlanoModal, setShowAtribuirPlanoModal] = useState(false);
  const [showAtribuirModuloModal, setShowAtribuirModuloModal] = useState(false);
  const [showAtualizarRecursosModal, setShowAtualizarRecursosModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [precoCalculado, setPrecoCalculado] = useState(null);
  
  // Forms
  const [planoForm, setPlanoForm] = useState({
    plano_id: '',
    num_veiculos: 0,
    num_motoristas: 0,
    periodicidade: 'mensal',
    trial_dias: 0,
    oferta: false,
    oferta_dias: 30,
    oferta_motivo: '',
    desconto_percentagem: 0
  });
  
  const [recursosForm, setRecursosForm] = useState({
    num_veiculos: 0,
    num_motoristas: 0,
    motivo: ''
  });
  const [prorataCalculado, setProrataCalculado] = useState(null);
  
  const [moduloForm, setModuloForm] = useState({
    modulo_codigo: '',
    periodicidade: 'mensal',
    trial_dias: 0,
    oferta: false,
    oferta_dias: 30,
    oferta_motivo: '',
    desconto_percentagem: 0
  });

  const fetchDados = useCallback(async () => {
    if (!parceiroId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [subscricaoRes, planosRes, modulosRes, modulosAtivosRes] = await Promise.all([
        axios.get(`${API}/gestao-planos/subscricoes/user/${parceiroId}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/gestao-planos/planos?tipo_usuario=parceiro`, { headers }),
        axios.get(`${API}/gestao-planos/modulos?tipo_usuario=parceiro`, { headers }),
        axios.get(`${API}/gestao-planos/modulos-ativos/user/${parceiroId}`, { headers }).catch(() => ({ data: { modulos_ativos: [] } }))
      ]);
      
      setSubscricao(subscricaoRes.data);
      setPlanos(planosRes.data || []);
      setModulos(modulosRes.data || []);
      setModulosAtivos(modulosAtivosRes.data?.modulos_ativos || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [parceiroId]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);
  
  // Calcular preço quando form muda
  useEffect(() => {
    const calcularPreco = async () => {
      if (!planoForm.plano_id) {
        setPrecoCalculado(null);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/gestao-planos/planos/${planoForm.plano_id}/calcular-preco`, {
          params: {
            periodicidade: planoForm.periodicidade,
            num_veiculos: planoForm.num_veiculos || 0,
            num_motoristas: planoForm.num_motoristas || 0
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrecoCalculado(res.data);
      } catch (error) {
        console.error('Erro ao calcular preço:', error);
      }
    };
    
    calcularPreco();
  }, [planoForm.plano_id, planoForm.periodicidade, planoForm.num_veiculos, planoForm.num_motoristas]);
  
  // Calcular pro-rata quando recursos mudam
  useEffect(() => {
    const calcularProrata = async () => {
      if (!subscricao?.plano_id) {
        setProrataCalculado(null);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/gestao-planos/subscricoes/user/${parceiroId}/calcular-prorata`, {
          params: {
            num_veiculos: recursosForm.num_veiculos,
            num_motoristas: recursosForm.num_motoristas
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        setProrataCalculado(res.data);
      } catch (error) {
        console.error('Erro ao calcular pro-rata:', error);
      }
    };
    
    if (showAtualizarRecursosModal) {
      calcularProrata();
    }
  }, [recursosForm.num_veiculos, recursosForm.num_motoristas, parceiroId, subscricao, showAtualizarRecursosModal]);

  const handleAtribuirPlano = async () => {
    if (!planoForm.plano_id) {
      toast.error('Selecione um plano');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gestao-planos/subscricoes/atribuir-plano`, {
        user_id: parceiroId,
        plano_id: planoForm.plano_id,
        num_veiculos: parseInt(planoForm.num_veiculos) || 0,
        num_motoristas: parseInt(planoForm.num_motoristas) || 0,
        periodicidade: planoForm.periodicidade,
        trial_dias: planoForm.oferta ? 0 : parseInt(planoForm.trial_dias) || 0,
        oferta: planoForm.oferta,
        oferta_dias: planoForm.oferta ? parseInt(planoForm.oferta_dias) || 30 : 0,
        oferta_motivo: planoForm.oferta_motivo,
        desconto_percentagem: planoForm.desconto_percentagem || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Plano atribuído com sucesso!');
      setShowAtribuirPlanoModal(false);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atribuir plano');
    } finally {
      setSaving(false);
    }
  };

  const handleAtribuirModulo = async () => {
    if (!moduloForm.modulo_codigo) {
      toast.error('Selecione um módulo');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gestao-planos/subscricoes/atribuir-modulo`, {
        user_id: parceiroId,
        ...moduloForm,
        trial_dias: moduloForm.trial_dias && !moduloForm.oferta ? parseInt(moduloForm.trial_dias) : 0,
        oferta_dias: moduloForm.oferta ? parseInt(moduloForm.oferta_dias) || 30 : 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Módulo atribuído com sucesso!');
      setShowAtribuirModuloModal(false);
      setModuloForm({
        modulo_codigo: '',
        periodicidade: 'mensal',
        trial_dias: 0,
        oferta: false,
        oferta_dias: 30,
        oferta_motivo: ''
      });
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atribuir módulo');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverModulo = async (moduloCodigo) => {
    if (!confirm('Tem certeza que deseja remover este módulo?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/gestao-planos/subscricoes/user/${parceiroId}/modulo/${moduloCodigo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Módulo removido');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao remover módulo');
    }
  };

  const handleCancelarSubscricao = async () => {
    if (!confirm('Tem certeza que deseja cancelar a subscrição deste parceiro?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gestao-planos/subscricoes/user/${parceiroId}/cancelar`, {
        motivo: 'Cancelado pelo administrador'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Subscrição cancelada');
      fetchDados();
    } catch (error) {
      toast.error('Erro ao cancelar subscrição');
    }
  };
  
  const handleAtualizarRecursos = async () => {
    if (!prorataCalculado) {
      toast.error('Aguarde o cálculo do pro-rata');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gestao-planos/subscricoes/user/${parceiroId}/atualizar-recursos`, null, {
        params: {
          num_veiculos: recursosForm.num_veiculos,
          num_motoristas: recursosForm.num_motoristas,
          motivo: recursosForm.motivo || 'Ajuste de recursos'
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Recursos atualizados! ${prorataCalculado.valor_prorata > 0 ? `Fatura pro-rata: €${prorataCalculado.valor_prorata}` : ''}`);
      setShowAtualizarRecursosModal(false);
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar recursos');
    } finally {
      setSaving(false);
    }
  };
  
  const openAtualizarRecursosModal = () => {
    setRecursosForm({
      num_veiculos: subscricao?.num_veiculos || 0,
      num_motoristas: subscricao?.num_motoristas || 0,
      motivo: ''
    });
    setProrataCalculado(null);
    setShowAtualizarRecursosModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'trial':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Trial</Badge>;
      case 'pendente_pagamento':
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'cancelado':
        return <Badge className="bg-slate-100 text-slate-700"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plano Atual */}
      <Card className={subscricao?.plano_id ? 'border-blue-200 bg-blue-50/30' : 'border-dashed'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Plano Atual
            </CardTitle>
            <div className="flex gap-2">
              {subscricao?.plano_id && (
                <>
                  <Button variant="outline" size="sm" onClick={openAtualizarRecursosModal}>
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={handleCancelarSubscricao}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => setShowAtribuirPlanoModal(true)}>
                {subscricao?.plano_id ? 'Alterar' : 'Atribuir Plano'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subscricao?.plano_id ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg">{subscricao.plano_nome}</h4>
                  <p className="text-sm text-slate-600">{subscricao.plano_categoria}</p>
                </div>
                {getStatusBadge(subscricao.status)}
              </div>
              
              {/* Recursos e Custos */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-slate-500">Veículos</p>
                      <p className="font-semibold">{subscricao.num_veiculos || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-slate-500">Motoristas</p>
                      <p className="font-semibold">{subscricao.num_motoristas || 0}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500">Periodicidade</p>
                    <p className="font-medium capitalize">{subscricao.periodicidade}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Próx. Cobrança</p>
                    <p className="font-medium">
                      {subscricao.proxima_cobranca 
                        ? new Date(subscricao.proxima_cobranca).toLocaleDateString('pt-PT')
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Tabela de Custos */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">Base do plano</td>
                      <td className="text-right p-2">€{subscricao.preco_base || 0}</td>
                    </tr>
                    {(subscricao.num_veiculos || 0) > 0 && (
                      <tr className="border-t">
                        <td className="p-2">Veículos ({subscricao.num_veiculos}x)</td>
                        <td className="text-right p-2">€{subscricao.preco_veiculos || 0}</td>
                      </tr>
                    )}
                    {(subscricao.num_motoristas || 0) > 0 && (
                      <tr className="border-t">
                        <td className="p-2">Motoristas ({subscricao.num_motoristas}x)</td>
                        <td className="text-right p-2">€{subscricao.preco_motoristas || 0}</td>
                      </tr>
                    )}
                    {(subscricao.preco_modulos || 0) > 0 && (
                      <tr className="border-t">
                        <td className="p-2">Módulos adicionais</td>
                        <td className="text-right p-2">€{subscricao.preco_modulos}</td>
                      </tr>
                    )}
                    <tr className="border-t bg-blue-50 font-semibold">
                      <td className="p-2">Total Mensal</td>
                      <td className="text-right p-2 text-blue-600">€{subscricao.preco_final || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {subscricao.trial?.ativo && (
                  <Badge className="bg-amber-100 text-amber-700">
                    <Gift className="w-3 h-3 mr-1" />
                    Trial até {new Date(subscricao.trial.data_fim).toLocaleDateString('pt-PT')}
                  </Badge>
                )}
                
                {subscricao.desconto_especial?.ativo && (
                  <Badge className="bg-green-100 text-green-700">
                    <Euro className="w-3 h-3 mr-1" />
                    {subscricao.desconto_especial.percentagem ? `${subscricao.desconto_especial.percentagem}% desconto` : 'Oferta'}
                    {subscricao.desconto_especial.motivo && ` - ${subscricao.desconto_especial.motivo}`}
                  </Badge>
                )}
                
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 mr-1" />
                  Desde {new Date(subscricao.data_inicio).toLocaleDateString('pt-PT')}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum plano atribuído</p>
              <p className="text-sm">Atribua um plano para definir os módulos incluídos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Módulos */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Módulos Individuais
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAtribuirModuloModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Módulo
            </Button>
          </div>
          <CardDescription>
            Módulos adicionais além dos incluídos no plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscricao?.modulos_individuais?.length > 0 ? (
            <div className="space-y-2">
              {subscricao.modulos_individuais.map((mod, idx) => {
                const moduloInfo = modulos.find(m => m.codigo === mod.modulo_codigo);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{moduloInfo?.icone || '📦'}</span>
                      <div>
                        <p className="font-medium">{mod.modulo_nome}</p>
                        <div className="flex gap-2">
                          {getStatusBadge(mod.status)}
                          {mod.trial && <Badge variant="outline" className="text-xs">Trial</Badge>}
                          {mod.oferta && <Badge className="bg-green-100 text-green-700 text-xs">Oferta</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">€{mod.preco_pago}/{mod.periodicidade}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500"
                        onClick={() => handleRemoverModulo(mod.modulo_codigo)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-4 text-slate-500">Nenhum módulo individual atribuído</p>
          )}
          
          {/* Lista de módulos ativos (do plano + individuais) */}
          {modulosAtivos.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-slate-500 mb-2">Todos os módulos ativos:</p>
              <div className="flex flex-wrap gap-2">
                {modulosAtivos.map(codigo => {
                  const moduloInfo = modulos.find(m => m.codigo === codigo);
                  return (
                    <Badge key={codigo} variant="outline">
                      {moduloInfo?.icone} {moduloInfo?.nome || codigo}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Atribuir Plano */}
      <Dialog open={showAtribuirPlanoModal} onOpenChange={setShowAtribuirPlanoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Plano</DialogTitle>
            <DialogDescription>Parceiro: {parceiroNome}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Plano *</Label>
              <Select 
                value={planoForm.plano_id} 
                onValueChange={(v) => setPlanoForm(prev => ({ ...prev, plano_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {planos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icone} {p.nome} - €{p.precos?.mensal || 0}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Periodicidade</Label>
              <Select 
                value={planoForm.periodicidade} 
                onValueChange={(v) => setPlanoForm(prev => ({ ...prev, periodicidade: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg">
              <Switch
                checked={planoForm.trial_dias > 0 && !planoForm.oferta}
                onCheckedChange={(checked) => setPlanoForm(prev => ({ 
                  ...prev, 
                  trial_dias: checked ? 14 : 0,
                  oferta: false
                }))}
              />
              <div className="flex-1">
                <Label>Período Trial</Label>
                {planoForm.trial_dias > 0 && !planoForm.oferta && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={planoForm.trial_dias}
                      onChange={(e) => setPlanoForm(prev => ({ ...prev, trial_dias: parseInt(e.target.value) || 0 }))}
                    />
                    <span className="text-sm text-slate-600">dias</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
              <Switch
                checked={planoForm.oferta}
                onCheckedChange={(checked) => setPlanoForm(prev => ({ 
                  ...prev, 
                  oferta: checked,
                  trial_dias: 0
                }))}
              />
              <div className="flex-1">
                <Label>Oferta Gratuita</Label>
                {planoForm.oferta && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={planoForm.oferta_dias}
                        onChange={(e) => setPlanoForm(prev => ({ ...prev, oferta_dias: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="text-sm text-slate-600">dias grátis</span>
                    </div>
                    <Input
                      placeholder="Motivo da oferta"
                      value={planoForm.oferta_motivo}
                      onChange={(e) => setPlanoForm(prev => ({ ...prev, oferta_motivo: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <Label>Desconto Especial (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={planoForm.desconto_percentagem || ''}
                onChange={(e) => setPlanoForm(prev => ({ ...prev, desconto_percentagem: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAtribuirPlanoModal(false)}>Cancelar</Button>
            <Button onClick={handleAtribuirPlano} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Atribuir Módulo */}
      <Dialog open={showAtribuirModuloModal} onOpenChange={setShowAtribuirModuloModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Módulo</DialogTitle>
            <DialogDescription>Parceiro: {parceiroNome}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Módulo *</Label>
              <Select 
                value={moduloForm.modulo_codigo} 
                onValueChange={(v) => setModuloForm(prev => ({ ...prev, modulo_codigo: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um módulo" /></SelectTrigger>
                <SelectContent>
                  {modulos.filter(m => !modulosAtivos.includes(m.codigo)).map(m => (
                    <SelectItem key={m.codigo} value={m.codigo}>
                      {m.icone} {m.nome} - €{m.precos?.mensal || 0}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Periodicidade</Label>
              <Select 
                value={moduloForm.periodicidade} 
                onValueChange={(v) => setModuloForm(prev => ({ ...prev, periodicidade: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg">
              <Switch
                checked={moduloForm.trial_dias > 0 && !moduloForm.oferta}
                onCheckedChange={(checked) => setModuloForm(prev => ({ 
                  ...prev, 
                  trial_dias: checked ? 7 : 0,
                  oferta: false
                }))}
              />
              <div className="flex-1">
                <Label>Período Trial</Label>
                {moduloForm.trial_dias > 0 && !moduloForm.oferta && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={moduloForm.trial_dias}
                      onChange={(e) => setModuloForm(prev => ({ ...prev, trial_dias: parseInt(e.target.value) || 0 }))}
                    />
                    <span className="text-sm text-slate-600">dias</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
              <Switch
                checked={moduloForm.oferta}
                onCheckedChange={(checked) => setModuloForm(prev => ({ 
                  ...prev, 
                  oferta: checked,
                  trial_dias: 0
                }))}
              />
              <div className="flex-1">
                <Label>Oferta Gratuita</Label>
                {moduloForm.oferta && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={moduloForm.oferta_dias}
                        onChange={(e) => setModuloForm(prev => ({ ...prev, oferta_dias: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="text-sm text-slate-600">dias grátis</span>
                    </div>
                    <Input
                      placeholder="Motivo da oferta"
                      value={moduloForm.oferta_motivo}
                      onChange={(e) => setModuloForm(prev => ({ ...prev, oferta_motivo: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAtribuirModuloModal(false)}>Cancelar</Button>
            <Button onClick={handleAtribuirModulo} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanoModulosParceiroTab;
