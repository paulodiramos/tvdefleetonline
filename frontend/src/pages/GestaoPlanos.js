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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Package, Plus, Edit, Trash2, Check, X, Info, Search, DollarSign, UserPlus, Users
} from 'lucide-react';

const GestaoPlanos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCriarPlano, setShowCriarPlano] = useState(false);
  const [showAtribuir, setShowAtribuir] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('planos');
  
  // Atribuição de planos
  const [usuarios, setUsuarios] = useState([]);
  const [filtroTipoUsuario, setFiltroTipoUsuario] = useState('all'); // all, motorista, parceiro
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [planoParaAtribuir, setPlanoParaAtribuir] = useState('');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    modulos: [],
    tipo_cobranca: 'por_veiculo',
    limite_veiculos: null,
    taxa_iva: 23,
    preco_semanal_sem_iva: 0,
    preco_semanal_com_iva: 0,
    desconto_semanal: 0,
    preco_mensal_sem_iva: 0,
    preco_mensal_com_iva: 0,
    desconto_mensal: 0,
    preco_trimestral_sem_iva: 0,
    preco_trimestral_com_iva: 0,
    desconto_trimestral: 0,
    preco_semestral_sem_iva: 0,
    preco_semestral_com_iva: 0,
    desconto_semestral: 0,
    preco_anual_sem_iva: 0,
    preco_anual_com_iva: 0,
    desconto_anual: 0,
    opcao_recibos_motorista: false,
    preco_recibo_por_motorista: 0,
    ativo: true,
    tipo_usuario: 'parceiro',
    promocao_ativa: false,
    promocao_data_inicio: '',
    promocao_data_fim: '',
    promocao_desconto_percentual: 0
  });

  useEffect(() => {
    fetchPlanos();
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (planoForm.tipo_usuario && showCriarPlano) {
      fetchModulos(planoForm.tipo_usuario);
    }
  }, [planoForm.tipo_usuario, showCriarPlano]);

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

  const fetchUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      const [parceirosRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/parceiros`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/motoristas`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const allUsers = [
        ...parceirosRes.data.map(p => ({ ...p, tipo: 'parceiro' })),
        ...motoristasRes.data.map(m => ({ ...m, tipo: 'motorista' }))
      ];
      setUsuarios(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchModulos = async (tipoUsuario) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/modulos?tipo_usuario=${tipoUsuario}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setModulos(response.data);
    } catch (error) {
      console.error('Error fetching módulos:', error);
      toast.error('Erro ao carregar módulos');
    }
  };

  const handleOpenCriarPlano = (plano = null) => {
    if (plano) {
      setEditingPlano(plano);
      const precos = plano.precos || {};
      setPlanoForm({
        nome: plano.nome,
        descricao: plano.descricao || '',
        modulos: plano.modulos || [],
        tipo_cobranca: plano.tipo_cobranca || 'por_veiculo',
        limite_veiculos: plano.limite_veiculos || null,
        taxa_iva: plano.taxa_iva || 23,
        preco_semanal_sem_iva: precos.semanal?.preco_sem_iva || 0,
        preco_semanal_com_iva: precos.semanal?.preco_com_iva || 0,
        desconto_semanal: precos.semanal?.desconto_percentual || 0,
        preco_mensal_sem_iva: precos.mensal?.preco_sem_iva || 0,
        preco_mensal_com_iva: precos.mensal?.preco_com_iva || 0,
        desconto_mensal: precos.mensal?.desconto_percentual || 0,
        preco_trimestral_sem_iva: precos.trimestral?.preco_sem_iva || 0,
        preco_trimestral_com_iva: precos.trimestral?.preco_com_iva || 0,
        desconto_trimestral: precos.trimestral?.desconto_percentual || 0,
        preco_semestral_sem_iva: precos.semestral?.preco_sem_iva || 0,
        preco_semestral_com_iva: precos.semestral?.preco_com_iva || 0,
        desconto_semestral: precos.semestral?.desconto_percentual || 0,
        preco_anual_sem_iva: precos.anual?.preco_sem_iva || 0,
        preco_anual_com_iva: precos.anual?.preco_com_iva || 0,
        desconto_anual: precos.anual?.desconto_percentual || 0,
        opcao_recibos_motorista: plano.opcao_recibos_motorista || false,
        preco_recibo_por_motorista: plano.preco_recibo_por_motorista || 0,
        ativo: plano.ativo !== false,
        tipo_usuario: plano.tipo_usuario || 'parceiro',
        promocao_ativa: plano.promocao_ativa || false,
        promocao_data_inicio: plano.promocao_data_inicio || '',
        promocao_data_fim: plano.promocao_data_fim || '',
        promocao_desconto_percentual: plano.promocao_desconto_percentual || 0
      });
    } else {
      setEditingPlano(null);
      setPlanoForm({
        nome: '',
        descricao: '',
        modulos: [],
        tipo_cobranca: 'por_veiculo',
        limite_veiculos: null,
        taxa_iva: 23,
        preco_semanal_sem_iva: 0,
        preco_semanal_com_iva: 0,
        desconto_semanal: 0,
        preco_mensal_sem_iva: 0,
        preco_mensal_com_iva: 0,
        desconto_mensal: 0,
        preco_trimestral_sem_iva: 0,
        preco_trimestral_com_iva: 0,
        desconto_trimestral: 0,
        preco_semestral_sem_iva: 0,
        preco_semestral_com_iva: 0,
        desconto_semestral: 0,
        preco_anual_sem_iva: 0,
        preco_anual_com_iva: 0,
        desconto_anual: 0,
        opcao_recibos_motorista: false,
        preco_recibo_por_motorista: 0,
        ativo: true,
        tipo_usuario: 'parceiro'
      });
    }
    setShowCriarPlano(true);
  };

  const handleCloseModal = () => {
    setShowCriarPlano(false);
    setShowAtribuir(false);
    setEditingPlano(null);
    setUsuarioSelecionado(null);
    setPlanoParaAtribuir('');
  };

  const handleToggleModulo = (codigoModulo) => {
    setPlanoForm(prev => ({
      ...prev,
      modulos: prev.modulos.includes(codigoModulo)
        ? prev.modulos.filter(m => m !== codigoModulo)
        : [...prev.modulos, codigoModulo]
    }));
  };

  const calcularComIVA = (semIva, taxa) => {
    return (parseFloat(semIva) * (1 + parseFloat(taxa) / 100)).toFixed(2);
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
          `${API}/planos/${editingPlano.id}`,
          planoForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plano atualizado com sucesso');
      } else {
        await axios.post(
          `${API}/planos`,
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
      await axios.delete(`${API}/planos/${planoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plano eliminado com sucesso');
      fetchPlanos();
    } catch (error) {
      console.error('Error deleting plano:', error);
      toast.error(error.response?.data?.detail || 'Erro ao eliminar plano');
    }
  };

  const handleAtribuirPlano = async () => {
    if (!usuarioSelecionado || !planoParaAtribuir) {
      toast.error('Selecione um utilizador e um plano');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const endpoint = usuarioSelecionado.tipo === 'parceiro' 
        ? `/admin/parceiros/${usuarioSelecionado.id}/atribuir-plano`
        : `/admin/motoristas/${usuarioSelecionado.id}/atribuir-plano`;
      
      await axios.post(
        `${API}${endpoint}`,
        { plano_id: planoParaAtribuir, periodicidade },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Plano atribuído com sucesso!');
      handleCloseModal();
      fetchUsuarios();
    } catch (error) {
      console.error('Error atribuindo plano:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atribuir plano');
    }
  };

  const filteredPlanos = planos.filter(plano =>
    plano.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plano.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoCobrancaLabel = (tipo) => {
    const labels = {
      'por_veiculo': 'Por Veículo',
      'fixo': 'Fixo com Limite'
    };
    return labels[tipo] || tipo;
  };

  const getTipoUsuarioLabel = (tipo) => {
    return tipo === 'motorista' ? 'Motorista' : 'Parceiro';
  };

  const getTipoUsuarioColor = (tipo) => {
    return tipo === 'motorista' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  const getPrecoDisplay = (plano) => {
    // Suportar novo formato (precos.mensal.preco_com_iva)
    if (plano.precos) {
      const mensal = plano.precos.mensal;
      if (mensal && mensal.preco_com_iva > 0) {
        return `€${mensal.preco_com_iva.toFixed(2)}/mês`;
      }
      const semanal = plano.precos.semanal;
      if (semanal && semanal.preco_com_iva > 0) {
        return `€${semanal.preco_com_iva.toFixed(2)}/semana`;
      }
    }
    // Suportar formato antigo (preco_mensal, preco_semanal)
    if (plano.preco_mensal > 0) {
      return `€${plano.preco_mensal.toFixed(2)}/mês`;
    }
    if (plano.preco_semanal > 0) {
      return `€${plano.preco_semanal.toFixed(2)}/semana`;
    }
    if (plano.preco > 0) {
      return `€${plano.preco.toFixed(2)}`;
    }
    return 'Sem preço definido';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-8 h-8" />
              Gestão de Planos
            </h1>
            <p className="text-slate-600 mt-2">
              Configure e atribua planos para parceiros e motoristas
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="atribuir">Atribuir Planos</TabsTrigger>
          </TabsList>

          {/* Tab: Gestão de Planos */}
          <TabsContent value="planos" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 mr-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Pesquisar planos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleOpenCriarPlano()} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Plano
              </Button>
            </div>

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
                  <Button onClick={() => handleOpenCriarPlano()} className="mt-4">
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
                            {plano.promocao && plano.promocao.ativa && (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                🎉 {plano.promocao.desconto_percentual}% OFF
                              </Badge>
                            )}
                            {plano.opcao_recibos_motorista && (
                              <Badge variant="outline" className="text-xs">
                                + Recibos
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                        {plano.descricao || 'Sem descrição'}
                      </p>

                      <div className="space-y-3 mb-4">
                        {plano.tipo_usuario === 'parceiro' && plano.tipo_cobranca && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Cobrança:</span>
                            <span className="font-medium">{getTipoCobrancaLabel(plano.tipo_cobranca)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Preço:</span>
                          <span className="font-bold text-lg text-blue-600">
                            {getPrecoDisplay(plano)}
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-slate-700 mb-2">
                          Módulos Incluídos:
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {plano.modulos?.length || 0} módulos
                        </Badge>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCriarPlano(plano)}
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
          </TabsContent>

          {/* Tab: Atribuir Planos */}
          <TabsContent value="atribuir" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Atribuir Plano Manualmente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Seleção de Utilizador */}
                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Selecionar Utilizador
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Filtros */}
                      <div className="space-y-2">
                        <Input
                          id="busca-usuario"
                          placeholder="Buscar por nome ou email..."
                          className="mb-2"
                        />
                        <div className="flex gap-2">
                          <Badge 
                            variant={filtroTipoUsuario === 'all' ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-blue-100"
                            onClick={() => setFiltroTipoUsuario('all')}
                          >
                            Todos ({usuarios.length})
                          </Badge>
                          <Badge 
                            variant={filtroTipoUsuario === 'motorista' ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-green-100"
                            onClick={() => setFiltroTipoUsuario('motorista')}
                          >
                            Motoristas ({usuarios.filter(u => u.tipo === 'motorista').length})
                          </Badge>
                          <Badge 
                            variant={filtroTipoUsuario === 'parceiro' ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-blue-100"
                            onClick={() => setFiltroTipoUsuario('parceiro')}
                          >
                            Parceiros ({usuarios.filter(u => u.tipo === 'parceiro').length})
                          </Badge>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {usuarios
                          .filter(u => filtroTipoUsuario === 'all' || u.tipo === filtroTipoUsuario)
                          .filter(u => {
                            const busca = document.getElementById('busca-usuario')?.value?.toLowerCase() || '';
                            return !busca || u.name?.toLowerCase().includes(busca) || u.email?.toLowerCase().includes(busca);
                          })
                          .map((u) => (
                          <div
                            key={u.id}
                            onClick={() => setUsuarioSelecionado(u)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              usuarioSelecionado?.id === u.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{u.name || 'Sem nome'}</p>
                                <p className="text-xs text-slate-500">{u.email}</p>
                              </div>
                              <Badge className={u.tipo === 'motorista' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                                {u.tipo === 'motorista' ? 'Motorista' : 'Parceiro'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Seleção de Plano */}
                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Selecionar Plano
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {usuarioSelecionado ? (
                        <>
                          <div className="p-3 bg-slate-50 rounded">
                            <p className="text-sm font-medium">{usuarioSelecionado.name}</p>
                            <p className="text-xs text-slate-600">
                              Tipo: <strong>{usuarioSelecionado.tipo === 'motorista' ? 'Motorista' : 'Parceiro'}</strong>
                            </p>
                          </div>

                          <div className="space-y-2">
                            {planos
                              .filter(p => p.tipo_usuario === usuarioSelecionado.tipo && p.ativo)
                              .map((plano) => (
                                <div
                                  key={plano.id}
                                  onClick={() => setPlanoParaAtribuir(plano.id)}
                                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                    planoParaAtribuir === plano.id
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'hover:border-blue-300'
                                  }`}
                                >
                                  <p className="font-medium">{plano.nome}</p>
                                  <p className="text-xs text-slate-600 mt-1">{getPrecoDisplay(plano)}</p>
                                  <Badge variant="outline" className="text-xs mt-2">
                                    {plano.modulos?.length || 0} módulos
                                  </Badge>
                                </div>
                              ))}
                          </div>

                          {planoParaAtribuir && (
                            <>
                              <div>
                                <Label>Periodicidade</Label>
                                <Select value={periodicidade} onValueChange={setPeriodicidade}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="semanal">Semanal</SelectItem>
                                    <SelectItem value="mensal">Mensal</SelectItem>
                                    <SelectItem value="trimestral">Trimestral</SelectItem>
                                    <SelectItem value="semestral">Semestral</SelectItem>
                                    <SelectItem value="anual">Anual</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Resumo do Valor */}
                              {planoSelecionado && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-sm font-semibold text-blue-900 mb-2">💰 Resumo da Atribuição</p>
                                  <div className="text-sm text-blue-800">
                                    <p><strong>Plano:</strong> {planoSelecionado.nome}</p>
                                    <p><strong>Usuário:</strong> {usuarioSelecionado.name}</p>
                                    <p><strong>Periodicidade:</strong> {periodicidade}</p>
                                    <p className="mt-2 text-lg font-bold">
                                      Valor: {getPrecoDisplay(planoSelecionado)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              <Button onClick={handleAtribuirPlano} className="w-full" disabled={!planoSelecionado}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Atribuir Plano
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">Selecione um utilizador primeiro</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Criar/Editar Plano */}
        <Dialog open={showCriarPlano} onOpenChange={setShowCriarPlano}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlano ? 'Editar Plano' : 'Criar Novo Plano'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                    onValueChange={(value) => setPlanoForm({ ...planoForm, tipo_usuario: value, modulos: [] })}
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

              {planoForm.tipo_usuario === 'parceiro' && (
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
                        <SelectItem value="por_veiculo">Por Veículo</SelectItem>
                        <SelectItem value="fixo">Fixo com Limite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <Label htmlFor="taxa_iva">Taxa IVA (%)</Label>
                    <Input
                      id="taxa_iva"
                      type="number"
                      value={planoForm.taxa_iva}
                      onChange={(e) => setPlanoForm({ ...planoForm, taxa_iva: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Preços por Periodicidade
                </h3>
                <Tabs defaultValue="mensal" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="semanal">Semanal</TabsTrigger>
                    <TabsTrigger value="mensal">Mensal</TabsTrigger>
                    <TabsTrigger value="trimestral">Trimestral</TabsTrigger>
                    <TabsTrigger value="semestral">Semestral</TabsTrigger>
                    <TabsTrigger value="anual">Anual</TabsTrigger>
                  </TabsList>

                  {['semanal', 'mensal', 'trimestral', 'semestral', 'anual'].map((periodo) => (
                    <TabsContent key={periodo} value={periodo} className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Preço sem IVA (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={planoForm[`preco_${periodo}_sem_iva`]}
                            onChange={(e) => {
                              const semIva = parseFloat(e.target.value) || 0;
                              const comIva = calcularComIVA(semIva, planoForm.taxa_iva);
                              setPlanoForm({ 
                                ...planoForm, 
                                [`preco_${periodo}_sem_iva`]: semIva,
                                [`preco_${periodo}_com_iva`]: parseFloat(comIva)
                              });
                            }}
                          />
                        </div>
                        <div>
                          <Label>Preço com IVA (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={planoForm[`preco_${periodo}_com_iva`]}
                            readOnly
                            className="bg-slate-100"
                          />
                        </div>
                        <div>
                          <Label>Desconto (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={planoForm[`desconto_${periodo}`]}
                            onChange={(e) => setPlanoForm({ 
                              ...planoForm, 
                              [`desconto_${periodo}`]: parseFloat(e.target.value) || 0 
                            })}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

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
