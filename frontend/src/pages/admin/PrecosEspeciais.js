import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  DollarSign, Plus, Pencil, Trash2, Search, Filter,
  Building2, User, Calendar, Percent, Euro, Check,
  Loader2, AlertTriangle, Tag, Star, Info, Clock, Car, Users
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PrecosEspeciais({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [precosEspeciais, setPrecosEspeciais] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    plano_id: '',
    parceiro_id: '',
    tipo_desconto: 'percentagem', // percentagem, valor_fixo, valor_fixo_veiculo, valor_fixo_motorista, valor_fixo_motorista_veiculo
    valor_desconto: '',
    preco_fixo: '',
    validade_inicio: '',
    validade_fim: '',
    motivo: '',
    ativo: true
  });

  // Labels e descrições para cada tipo de preço
  const tiposPreco = {
    percentagem: {
      label: 'Percentagem de Desconto',
      descricao: 'Aplica um desconto % sobre o preço base do plano',
      icon: Percent,
      color: 'bg-blue-100 text-blue-700'
    },
    valor_fixo: {
      label: 'Preço Fixo Total',
      descricao: 'Define um valor fixo mensal total para o parceiro',
      icon: Euro,
      color: 'bg-green-100 text-green-700'
    },
    valor_fixo_veiculo: {
      label: 'Preço Fixo por Veículo',
      descricao: 'Define um valor fixo mensal por cada veículo',
      icon: Car,
      color: 'bg-purple-100 text-purple-700'
    },
    valor_fixo_motorista: {
      label: 'Preço Fixo por Motorista',
      descricao: 'Define um valor fixo mensal por cada motorista',
      icon: User,
      color: 'bg-amber-100 text-amber-700'
    },
    valor_fixo_motorista_veiculo: {
      label: 'Preço Fixo por Motorista + Veículo',
      descricao: 'Define um valor fixo mensal por cada combinação motorista/veículo',
      icon: Users,
      color: 'bg-rose-100 text-rose-700'
    }
  };

  const fetchPlanos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/gestao-planos/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    }
  }, []);

  const fetchParceiros = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/uber/admin/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    }
  }, []);

  const fetchPrecosEspeciais = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/precos-especiais`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrecosEspeciais(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar preços especiais:', error);
      // Se endpoint não existir, usar dados dos planos
      const precosFromPlanos = [];
      for (const plano of planos) {
        if (plano.precos_especiais) {
          for (const preco of plano.precos_especiais) {
            precosFromPlanos.push({
              ...preco,
              plano_id: plano.id,
              plano_nome: plano.nome
            });
          }
        }
      }
      setPrecosEspeciais(precosFromPlanos);
    }
  }, [planos]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPlanos();
      await fetchParceiros();
      setLoading(false);
    };
    loadData();
  }, [fetchPlanos, fetchParceiros]);

  useEffect(() => {
    if (planos.length > 0) {
      fetchPrecosEspeciais();
    }
  }, [planos, fetchPrecosEspeciais]);

  const handleOpenModal = (preco = null) => {
    if (preco) {
      setFormData({
        plano_id: preco.plano_id || '',
        parceiro_id: preco.parceiro_id || '',
        tipo_desconto: preco.tipo_desconto || 'percentagem',
        valor_desconto: preco.valor_desconto || '',
        preco_fixo: preco.preco_fixo || '',
        validade_inicio: preco.validade_inicio || '',
        validade_fim: preco.validade_fim || '',
        motivo: preco.motivo || '',
        ativo: preco.ativo !== false
      });
    } else {
      setFormData({
        plano_id: '',
        parceiro_id: '',
        tipo_desconto: 'percentagem',
        valor_desconto: '',
        preco_fixo: '',
        validade_inicio: '',
        validade_fim: '',
        motivo: '',
        ativo: true
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.plano_id) {
      toast.error('Selecione um plano');
      return;
    }
    if (!formData.parceiro_id) {
      toast.error('Selecione um parceiro');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      const precoData = {
        parceiro_id: formData.parceiro_id,
        tipo_desconto: formData.tipo_desconto,
        valor_desconto: formData.tipo_desconto === 'percentagem' ? parseFloat(formData.valor_desconto) : null,
        preco_fixo: formData.tipo_desconto === 'valor_fixo' ? parseFloat(formData.preco_fixo) : null,
        validade_inicio: formData.validade_inicio || null,
        validade_fim: formData.validade_fim || null,
        motivo: formData.motivo,
        ativo: formData.ativo
      };

      await axios.post(
        `${API}/gestao-planos/planos/${formData.plano_id}/precos-especiais`,
        precoData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Preço especial criado com sucesso');
      setShowModal(false);
      fetchPlanos();
    } catch (error) {
      console.error('Erro ao salvar preço especial:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar preço especial');
    } finally {
      setSaving(false);
    }
  };

  const getParceiroNome = (parceiroId) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    return parceiro?.name || parceiro?.empresa || parceiroId;
  };

  const getPlanoNome = (planoId) => {
    const plano = planos.find(p => p.id === planoId);
    return plano?.nome || planoId;
  };

  // Extrair preços especiais de todos os planos
  const todosPrecosEspeciais = planos.flatMap(plano => 
    (plano.precos_especiais || []).map(preco => ({
      ...preco,
      plano_id: plano.id,
      plano_nome: plano.nome
    }))
  );

  const precosFiltrados = todosPrecosEspeciais.filter(preco => {
    if (!searchTerm) return true;
    const parceiroNome = getParceiroNome(preco.parceiro_id).toLowerCase();
    const planoNome = preco.plano_nome?.toLowerCase() || '';
    return parceiroNome.includes(searchTerm.toLowerCase()) || 
           planoNome.includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="container mx-auto py-6 px-4" data-testid="precos-especiais-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="w-6 h-6 text-purple-600" />
              Preços Especiais
            </h1>
            <p className="text-gray-500 mt-1">
              Configure descontos e preços especiais para parceiros específicos
            </p>
          </div>
          <Button onClick={() => handleOpenModal()} data-testid="btn-novo-preco">
            <Plus className="w-4 h-4 mr-2" />
            Novo Preço Especial
          </Button>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Tipos de Preço Especial</AlertTitle>
          <AlertDescription className="text-blue-700">
            <ul className="list-disc ml-4 mt-2 space-y-1 text-sm">
              <li><strong>Percentagem:</strong> Aplica um desconto percentual sobre o preço base do plano</li>
              <li><strong>Preço Fixo Total:</strong> Define um valor fixo mensal total para o parceiro</li>
              <li><strong>Preço Fixo por Veículo:</strong> Valor fixo multiplicado pelo número de veículos</li>
              <li><strong>Preço Fixo por Motorista:</strong> Valor fixo multiplicado pelo número de motoristas</li>
              <li><strong>Preço Fixo Motorista + Veículo:</strong> Valor fixo por cada combinação ativa</li>
            </ul>
            <p className="mt-2 text-xs text-blue-600">
              <Clock className="w-3 h-3 inline mr-1" />
              Defina datas de validade para promoções temporárias ou deixe em branco para descontos permanentes.
            </p>
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Total Preços Especiais</p>
                  <p className="text-2xl font-bold text-purple-700">{todosPrecosEspeciais.length}</p>
                </div>
                <Tag className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Ativos</p>
                  <p className="text-2xl font-bold text-green-700">
                    {todosPrecosEspeciais.filter(p => p.ativo !== false).length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Com Validade</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {todosPrecosEspeciais.filter(p => p.validade_fim).length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Pesquisar por parceiro ou plano..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-pesquisa"
                  />
                </div>
              </div>
              <Badge variant="outline" className="px-4 py-2">
                {precosFiltrados.length} resultado(s)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Preços Especiais */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Preços Especiais</CardTitle>
            <CardDescription>
              Descontos e preços fixos configurados para parceiros específicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {precosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum preço especial configurado</p>
                <Button 
                  className="mt-4" 
                  onClick={() => handleOpenModal()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {precosFiltrados.map((preco, index) => (
                    <TableRow key={preco.id || index} data-testid={`preco-row-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {getParceiroNome(preco.parceiro_id)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{preco.plano_nome}</Badge>
                      </TableCell>
                      <TableCell>
                        {preco.tipo_desconto === 'percentagem' ? (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Percent className="w-3 h-3 mr-1" />
                            Percentagem
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <Euro className="w-3 h-3 mr-1" />
                            Valor Fixo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {preco.tipo_desconto === 'percentagem' 
                          ? `${preco.valor_desconto}%` 
                          : `${preco.preco_fixo?.toFixed(2)} €`}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {preco.validade_inicio && preco.validade_fim ? (
                          <span>
                            {new Date(preco.validade_inicio).toLocaleDateString('pt-PT')} - 
                            {new Date(preco.validade_fim).toLocaleDateString('pt-PT')}
                          </span>
                        ) : preco.validade_fim ? (
                          <span>Até {new Date(preco.validade_fim).toLocaleDateString('pt-PT')}</span>
                        ) : (
                          <span className="text-green-600">Sem limite</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {preco.ativo !== false ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(preco)}
                          data-testid={`btn-editar-${index}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Novo/Editar Preço Especial */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[550px]" data-testid="modal-preco-especial">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {formData.id ? 'Editar' : 'Novo'} Preço Especial
            </DialogTitle>
            <DialogDescription>
              Configure um preço ou desconto especial para um parceiro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Parceiro */}
            <div className="space-y-2">
              <Label>Parceiro *</Label>
              <Select
                value={formData.parceiro_id}
                onValueChange={(value) => setFormData({ ...formData, parceiro_id: value })}
              >
                <SelectTrigger data-testid="select-parceiro">
                  <SelectValue placeholder="Selecione um parceiro" />
                </SelectTrigger>
                <SelectContent>
                  {parceiros.map((parceiro) => (
                    <SelectItem key={parceiro.id} value={parceiro.id}>
                      {parceiro.name || parceiro.empresa || parceiro.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plano */}
            <div className="space-y-2">
              <Label>Plano *</Label>
              <Select
                value={formData.plano_id}
                onValueChange={(value) => setFormData({ ...formData, plano_id: value })}
              >
                <SelectTrigger data-testid="select-plano">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.id}>
                      {plano.nome} - {plano.preco_mensal}€/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Desconto */}
            <div className="space-y-2">
              <Label>Tipo de Desconto</Label>
              <Select
                value={formData.tipo_desconto}
                onValueChange={(value) => setFormData({ ...formData, tipo_desconto: value })}
              >
                <SelectTrigger data-testid="select-tipo-desconto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentagem">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Percentagem de Desconto
                    </div>
                  </SelectItem>
                  <SelectItem value="valor_fixo">
                    <div className="flex items-center gap-2">
                      <Euro className="w-4 h-4" />
                      Preço Fixo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor do Desconto ou Preço Fixo */}
            {formData.tipo_desconto === 'percentagem' ? (
              <div className="space-y-2">
                <Label>Percentagem de Desconto (%)</Label>
                <Input
                  type="number"
                  value={formData.valor_desconto}
                  onChange={(e) => setFormData({ ...formData, valor_desconto: e.target.value })}
                  placeholder="Ex: 15"
                  min="0"
                  max="100"
                  data-testid="input-valor-desconto"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Preço Fixo (€)</Label>
                <Input
                  type="number"
                  value={formData.preco_fixo}
                  onChange={(e) => setFormData({ ...formData, preco_fixo: e.target.value })}
                  placeholder="Ex: 49.99"
                  min="0"
                  step="0.01"
                  data-testid="input-preco-fixo"
                />
              </div>
            )}

            {/* Validade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Válido de (opcional)</Label>
                <Input
                  type="date"
                  value={formData.validade_inicio}
                  onChange={(e) => setFormData({ ...formData, validade_inicio: e.target.value })}
                  data-testid="input-validade-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label>Válido até (opcional)</Label>
                <Input
                  type="date"
                  value={formData.validade_fim}
                  onChange={(e) => setFormData({ ...formData, validade_fim: e.target.value })}
                  data-testid="input-validade-fim"
                />
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo/Notas</Label>
              <Input
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Desconto parceiro estratégico"
                data-testid="input-motivo"
              />
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-gray-500">
                  Preços inativos não são aplicados
                </p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                data-testid="switch-ativo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-guardar">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
