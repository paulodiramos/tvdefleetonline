import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Users, Search, Edit, Package, CheckCircle, XCircle, 
  Clock, Shield, User, Briefcase, Car, Save, Plus, UserPlus, Key, Calendar, Trash2, Gift
} from 'lucide-react';

const GestaoUtilizadores = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [utilizadores, setUtilizadores] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pendentes', 'aprovados'
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);
  const [showNovoUserDialog, setShowNovoUserDialog] = useState(false);
  const [showAcessoDialog, setShowAcessoDialog] = useState(false);
  const [showAprovarDialog, setShowAprovarDialog] = useState(false);
  const [aprovarParceiroId, setAprovarParceiroId] = useState('');
  const [aprovarPlanoId, setAprovarPlanoId] = useState('');
  const [aprovarPrecoEspecialId, setAprovarPrecoEspecialId] = useState('');
  const [planosDisponiveis, setPlanosDisponiveis] = useState([]);
  const [precosEspeciaisDisponiveis, setPrecosEspeciaisDisponiveis] = useState([]);
  const [planoForm, setPlanoForm] = useState({
    plano_id: '',
    tipo_pagamento: 'mensal',
    valor_pago: 0
  });
  const [acessoForm, setAcessoForm] = useState({
    acesso_gratis: false,
    data_inicio: '',
    data_fim: '',
    modulos_ativos: []
  });
  const [novoUserForm, setNovoUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'motorista',
    parceiros_associados: []
  });
  const [saving, setSaving] = useState(false);

  // Verificar filtro da URL ao carregar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    if (filter === 'pendentes') {
      setStatusFilter('pendentes');
    }
  }, [location.search]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [search, roleFilter, statusFilter, utilizadores]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Buscar utilizadores
      const usersRes = await axios.get(`${API}/users/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Buscar parceiros (para atribuir a gestores)
      try {
        const parceirosRes = await axios.get(`${API}/parceiros`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setParceiros(parceirosRes.data || []);
      } catch {
        setParceiros([]);
      }

      // Buscar planos de cada usuário
      const usersWithPlanos = await Promise.all(
        usersRes.data.map(async (u) => {
          try {
            const planoRes = await axios.get(`${API}/users/${u.id}/modulos`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return {
              ...u,
              plano_ativo: planoRes.data.plano,
              modulos_ativos: planoRes.data.modulos_ativos || []
            };
          } catch {
            return { ...u, plano_ativo: null, modulos_ativos: [] };
          }
        })
      );

      setUtilizadores(usersWithPlanos);

      // Buscar planos disponíveis
      const planosRes = await axios.get(`${API}/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(planosRes.data);

      // Buscar módulos disponíveis
      try {
        const modulosRes = await axios.get(`${API}/gestao-planos/modulos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setModulos(modulosRes.data || []);
      } catch {
        setModulos([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = utilizadores;

    // Filter by search
    if (search) {
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Filter by status (approved/pending)
    if (statusFilter === 'pendentes') {
      filtered = filtered.filter(u => u.approved === false);
    } else if (statusFilter === 'aprovados') {
      filtered = filtered.filter(u => u.approved !== false);
    }

    setFilteredUsers(filtered);
  };

  const handleOpenPlanoDialog = (usuario) => {
    setSelectedUser(usuario);
    setPlanoForm({
      plano_id: usuario.plano_ativo?.id || '',
      tipo_pagamento: 'mensal',
      valor_pago: 0
    });
    setShowPlanoDialog(true);
  };

  const handleSavePlano = async () => {
    if (!planoForm.plano_id) {
      toast.error('Selecione um plano');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      await axios.post(
        `${API}/users/${selectedUser.id}/atribuir-modulos`,
        planoForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Plano atualizado com sucesso!');
      setShowPlanoDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error saving plano:', error);
      toast.error('Erro ao atualizar plano');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAcessoDialog = (usuario) => {
    setSelectedUser(usuario);
    // Preencher com dados existentes
    const hoje = new Date().toISOString().split('T')[0];
    const emUmMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setAcessoForm({
      acesso_gratis: usuario.acesso_gratis || false,
      data_inicio: usuario.acesso_gratis_inicio || hoje,
      data_fim: usuario.acesso_gratis_fim || emUmMes,
      modulos_ativos: usuario.modulos_ativos?.map(m => m.codigo || m) || []
    });
    setShowAcessoDialog(true);
  };

  const handleToggleModulo = (moduloCodigo) => {
    setAcessoForm(prev => {
      const isSelected = prev.modulos_ativos.includes(moduloCodigo);
      return {
        ...prev,
        modulos_ativos: isSelected
          ? prev.modulos_ativos.filter(m => m !== moduloCodigo)
          : [...prev.modulos_ativos, moduloCodigo]
      };
    });
  };

  const handleSaveAcesso = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      await axios.put(
        `${API}/users/${selectedUser.id}/acesso`,
        {
          acesso_gratis: acessoForm.acesso_gratis,
          acesso_gratis_inicio: acessoForm.acesso_gratis ? acessoForm.data_inicio : null,
          acesso_gratis_fim: acessoForm.acesso_gratis ? acessoForm.data_fim : null,
          modulos_ativos: acessoForm.modulos_ativos
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Acesso atualizado com sucesso!');
      setShowAcessoDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error saving acesso:', error);
      toast.error('Erro ao atualizar acesso');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNovoUserDialog = () => {
    setNovoUserForm({
      name: '',
      email: '',
      password: '',
      role: 'motorista',
      parceiros_associados: []
    });
    setShowNovoUserDialog(true);
  };

  const handleCreateUser = async () => {
    // Validações
    if (!novoUserForm.name || !novoUserForm.email || !novoUserForm.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (novoUserForm.password.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres');
      return;
    }

    if (novoUserForm.role === 'gestao' && novoUserForm.parceiros_associados.length === 0) {
      toast.error('Selecione pelo menos um parceiro para o gestor');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      const payload = {
        name: novoUserForm.name,
        email: novoUserForm.email,
        password: novoUserForm.password,
        role: novoUserForm.role,
        approved: true
      };

      // Adicionar parceiros associados se for gestor
      if (novoUserForm.role === 'gestao') {
        payload.parceiros_associados = novoUserForm.parceiros_associados;
      }

      await axios.post(
        `${API}/auth/register`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Usuário criado com sucesso!');
      setShowNovoUserDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error creating user:', error);
      const msg = error.response?.data?.detail || 'Erro ao criar usuário';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleParceiro = (parceiroId) => {
    setNovoUserForm(prev => {
      const isSelected = prev.parceiros_associados.includes(parceiroId);
      return {
        ...prev,
        parceiros_associados: isSelected
          ? prev.parceiros_associados.filter(id => id !== parceiroId)
          : [...prev.parceiros_associados, parceiroId]
      };
    });
  };

  const handleEliminarUser = async (usuario) => {
    // Não permitir eliminar a si próprio
    if (usuario.id === user?.id) {
      toast.error('Não pode eliminar a sua própria conta');
      return;
    }

    // Não permitir eliminar admin
    if (usuario.role === 'admin' && user?.role !== 'admin') {
      toast.error('Apenas admin pode eliminar outros admins');
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja eliminar o utilizador "${usuario.name}"?\n\nEsta ação é irreversível e também eliminará:\n- Dados de motorista (se aplicável)\n- Dados de parceiro (se aplicável)`
    );

    if (!confirmar) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/${usuario.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilizador eliminado com sucesso');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      const msg = error.response?.data?.detail || 'Erro ao eliminar utilizador';
      toast.error(msg);
    }
  };

  const handleOpenAprovarDialog = (usuario) => {
    setSelectedUser(usuario);
    setAprovarParceiroId('');
    setShowAprovarDialog(true);
  };

  const handleAprovarUser = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Aprovar o utilizador
      await axios.put(
        `${API}/users/${selectedUser.id}/approve`,
        { role: selectedUser.role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Se for motorista e tiver parceiro selecionado, atribuir
      if (selectedUser.role === 'motorista' && aprovarParceiroId && aprovarParceiroId !== 'none') {
        try {
          await axios.put(
            `${API}/motoristas/${selectedUser.id}/atribuir-parceiro`,
            { parceiro_id: aprovarParceiroId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success('Utilizador aprovado e parceiro atribuído!');
        } catch (atribuirError) {
          console.error('Erro ao atribuir parceiro:', atribuirError);
          toast.warning('Utilizador aprovado, mas erro ao atribuir parceiro. Atribua manualmente.');
        }
      } else {
        toast.success('Utilizador aprovado com sucesso!');
      }

      setShowAprovarDialog(false);
      setSelectedUser(null);
      setAprovarParceiroId('');
      fetchData();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao aprovar utilizador');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role, compact = false) => {
    const roleConfig = {
      admin: { label: 'Admin', icon: Shield, color: 'bg-red-100 text-red-800' },
      gestao: { label: 'Gestão', icon: Briefcase, color: 'bg-blue-100 text-blue-800' },
      parceiro: { label: 'Parceiro', icon: Briefcase, color: 'bg-purple-100 text-purple-800' },
      motorista: { label: 'Motorista', icon: Car, color: 'bg-green-100 text-green-800' }
    };

    const config = roleConfig[role] || { label: role, icon: User, color: 'bg-gray-100 text-gray-800' };
    const Icon = config.icon;

    if (compact) {
      return (
        <Badge className={`${config.color} px-2 py-0.5`}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      );
    }

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (u) => {
    if (u.approved === false) {
      return (
        <Badge className="bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    
    if (u.approved === true) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    }

    return null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <span>Gestão de Usuários</span>
            </h1>
            <p className="text-slate-600 mt-2">
              Visualizar e gerir planos de todos os usuários
            </p>
          </div>
          <Button 
            onClick={handleOpenNovoUserDialog}
            className="bg-green-600 hover:bg-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nome ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar por role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestao">Gestão</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                  <SelectItem value="motorista">Motorista</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(val) => {
                setStatusFilter(val);
                // Atualizar URL
                if (val !== 'all') {
                  navigate(`/usuarios?filter=${val}`, { replace: true });
                } else {
                  navigate('/usuarios', { replace: true });
                }
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="pendentes">Pendentes de Aprovação</SelectItem>
                  <SelectItem value="aprovados">Aprovados</SelectItem>
                </SelectContent>
              </Select>

              {statusFilter === 'pendentes' && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                  A mostrar apenas pendentes
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users List - Compact Design */}
        <Card>
          <CardContent className="p-0">
            <TooltipProvider>
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((usuario) => (
                  <div 
                    key={usuario.id} 
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    data-testid={`user-row-${usuario.id}`}
                    onClick={() => navigate(`/usuarios/${usuario.id}`)}
                  >
                    {/* Left: Avatar + Name + Email */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                          {getInitials(usuario.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{usuario.name}</p>
                        <p className="text-xs text-slate-500 truncate">{usuario.email}</p>
                      </div>
                    </div>

                    {/* Center: Role Badge */}
                    <div className="flex-shrink-0 mx-2">
                      {getRoleBadge(usuario.role, true)}
                    </div>

                    {/* Center: Partner Name (for motoristas) */}
                    <div className="flex-shrink-0 w-32 text-sm text-slate-600 truncate hidden md:block">
                      {usuario.role === 'motorista' && (usuario.associated_partner_id || usuario.parceiro_id) ? (
                        parceiros.find(p => p.id === (usuario.associated_partner_id || usuario.parceiro_id))?.nome_empresa || 
                        parceiros.find(p => p.id === (usuario.associated_partner_id || usuario.parceiro_id))?.name || 
                        '-'
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>

                    {/* Center: Status */}
                    <div className="flex-shrink-0 mx-2">
                      {getStatusBadge(usuario)}
                    </div>

                    {/* Center: Plan */}
                    <div className="flex-shrink-0 w-20 hidden lg:block">
                      {usuario.plano_ativo ? (
                        <Badge className="bg-purple-100 text-purple-800 text-xs px-1.5">
                          {usuario.plano_ativo.nome?.substring(0, 10)}
                        </Badge>
                      ) : usuario.acesso_gratis ? (
                        <Badge className="bg-green-100 text-green-800 text-xs px-1.5">
                          <Gift className="w-3 h-3 mr-0.5" />
                          Grátis
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Sem plano</span>
                      )}
                    </div>

                    {/* Right: Action Icons */}
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      {/* Botão Aprovar - só para utilizadores pendentes */}
                      {usuario.approved === false && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleOpenAprovarDialog(usuario)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              data-testid={`btn-aprovar-${usuario.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Aprovar</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleOpenAcessoDialog(usuario)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                            data-testid={`btn-acesso-${usuario.id}`}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Acesso</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleOpenPlanoDialog(usuario)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            data-testid={`btn-plano-${usuario.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Plano</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleEliminarUser(usuario)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            data-testid={`btn-eliminar-${usuario.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
            {filteredUsers.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                Nenhum usuário encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plano Dialog */}
        <Dialog open={showPlanoDialog} onOpenChange={setShowPlanoDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Alterar Plano - {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Plano Atual */}
              {selectedUser?.plano_ativo && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-semibold text-blue-900">Plano Atual:</p>
                  <p className="text-blue-700">{selectedUser.plano_ativo.nome}</p>
                </div>
              )}

              {/* Novo Plano */}
              <div>
                <Label>Novo Plano *</Label>
                <Select
                  value={planoForm.plano_id}
                  onValueChange={(value) => setPlanoForm({ ...planoForm, plano_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome} - €{plano.preco}/{plano.periodicidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo Pagamento */}
              <div>
                <Label>Tipo de Pagamento</Label>
                <Select
                  value={planoForm.tipo_pagamento}
                  onValueChange={(value) => setPlanoForm({ ...planoForm, tipo_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="vitalicio">Vitalício</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Valor Pago */}
              <div>
                <Label>Valor Pago (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={planoForm.valor_pago}
                  onChange={(e) => setPlanoForm({ ...planoForm, valor_pago: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowPlanoDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePlano}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Novo Usuário Dialog */}
        <Dialog open={showNovoUserDialog} onOpenChange={setShowNovoUserDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-green-600" />
                <span>Criar Novo Usuário</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Nome */}
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={novoUserForm.name}
                  onChange={(e) => setNovoUserForm({ ...novoUserForm, name: e.target.value })}
                />
              </div>

              {/* Email */}
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={novoUserForm.email}
                  onChange={(e) => setNovoUserForm({ ...novoUserForm, email: e.target.value })}
                />
              </div>

              {/* Password */}
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novoUserForm.password}
                  onChange={(e) => setNovoUserForm({ ...novoUserForm, password: e.target.value })}
                />
              </div>

              {/* Tipo/Role */}
              <div>
                <Label>Tipo de Usuário *</Label>
                <Select
                  value={novoUserForm.role}
                  onValueChange={(value) => setNovoUserForm({ ...novoUserForm, role: value, parceiros_associados: [] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorista">
                      <div className="flex items-center">
                        <Car className="w-4 h-4 mr-2 text-green-600" />
                        Motorista
                      </div>
                    </SelectItem>
                    <SelectItem value="parceiro">
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-purple-600" />
                        Parceiro
                      </div>
                    </SelectItem>
                    <SelectItem value="gestao">
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-blue-600" />
                        Gestor
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-red-600" />
                        Administrador
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parceiros Associados (apenas para Gestores) */}
              {novoUserForm.role === 'gestao' && (
                <div>
                  <Label className="mb-2 block">Parceiros Associados *</Label>
                  <p className="text-xs text-slate-500 mb-3">
                    Selecione os parceiros que este gestor poderá gerir
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2">
                    {parceiros.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Nenhum parceiro disponível
                      </p>
                    ) : (
                      parceiros.map((parceiro) => (
                        <div 
                          key={parceiro.id}
                          className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded cursor-pointer"
                          onClick={() => handleToggleParceiro(parceiro.id)}
                        >
                          <Checkbox
                            checked={novoUserForm.parceiros_associados.includes(parceiro.id)}
                            onCheckedChange={() => handleToggleParceiro(parceiro.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{parceiro.empresa || parceiro.name}</p>
                            <p className="text-xs text-slate-500">{parceiro.email}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {novoUserForm.parceiros_associados.length > 0 && (
                    <p className="text-xs text-green-600 mt-2">
                      {novoUserForm.parceiros_associados.length} parceiro(s) selecionado(s)
                    </p>
                  )}
                </div>
              )}

              {/* Info boxes */}
              <div className="bg-slate-50 border rounded-lg p-3 text-sm text-slate-600">
                {novoUserForm.role === 'motorista' && (
                  <p>👤 <strong>Motorista:</strong> Pode ver seus ganhos, enviar recibos e acessar área do motorista.</p>
                )}
                {novoUserForm.role === 'parceiro' && (
                  <p>🏢 <strong>Parceiro:</strong> Gere motoristas, veículos e relatórios financeiros.</p>
                )}
                {novoUserForm.role === 'gestao' && (
                  <p>📊 <strong>Gestor:</strong> Pode gerir múltiplos parceiros associados.</p>
                )}
                {novoUserForm.role === 'admin' && (
                  <p>🛡️ <strong>Admin:</strong> Acesso total ao sistema, incluindo gestão de usuários.</p>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowNovoUserDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <>Criando...</>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Acesso Dialog */}
        <Dialog open={showAcessoDialog} onOpenChange={setShowAcessoDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-green-600" />
                <span>Gerir Acesso - {selectedUser?.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Acesso Grátis */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <Checkbox
                    checked={acessoForm.acesso_gratis}
                    onCheckedChange={(checked) => setAcessoForm(prev => ({ ...prev, acesso_gratis: checked }))}
                  />
                  <div>
                    <Label className="font-semibold text-green-800">Acesso Grátis</Label>
                    <p className="text-xs text-green-600">Dar acesso gratuito por período limitado</p>
                  </div>
                </div>

                {acessoForm.acesso_gratis && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label className="text-sm">Data Início</Label>
                      <Input
                        type="date"
                        value={acessoForm.data_inicio}
                        onChange={(e) => setAcessoForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Data Fim</Label>
                      <Input
                        type="date"
                        value={acessoForm.data_fim}
                        onChange={(e) => setAcessoForm(prev => ({ ...prev, data_fim: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Módulos */}
              <div>
                <Label className="font-semibold mb-3 block">Módulos Ativos</Label>
                <p className="text-xs text-slate-500 mb-3">Selecione os módulos que este usuário pode aceder</p>
                <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {modulos.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Nenhum módulo disponível
                    </p>
                  ) : (
                    modulos.map((modulo) => (
                      <div 
                        key={modulo.codigo}
                        className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded cursor-pointer"
                        onClick={() => handleToggleModulo(modulo.codigo)}
                      >
                        <Checkbox
                          checked={acessoForm.modulos_ativos.includes(modulo.codigo)}
                          onCheckedChange={() => handleToggleModulo(modulo.codigo)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{modulo.nome}</p>
                          {modulo.descricao && (
                            <p className="text-xs text-slate-500">{modulo.descricao}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {acessoForm.modulos_ativos.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {acessoForm.modulos_ativos.length} módulo(s) selecionado(s)
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowAcessoDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAcesso}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Acesso
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Aprovação */}
        <Dialog open={showAprovarDialog} onOpenChange={setShowAprovarDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-600" />
                Aprovar Utilizador
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-600">
                Tem a certeza que deseja aprovar o utilizador <strong>{selectedUser?.name}</strong>?
              </p>
              
              {selectedUser?.role === 'motorista' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Atribuir a Parceiro (opcional)</Label>
                  <Select value={aprovarParceiroId} onValueChange={setAprovarParceiroId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar parceiro..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (atribuir depois)</SelectItem>
                      {parceiros.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome || p.name || p.empresa || 'Parceiro'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Se não selecionar agora, pode atribuir depois na página de Motoristas.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowAprovarDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAprovarUser}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    A aprovar...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoUtilizadores;
