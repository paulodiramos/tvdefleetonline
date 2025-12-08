import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { 
  Users, Search, Edit, Package, CheckCircle, XCircle, 
  Clock, Shield, User, Briefcase, Car, Save
} from 'lucide-react';

const GestaoUtilizadores = ({ user, onLogout }) => {
  const [utilizadores, setUtilizadores] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);
  const [planoForm, setPlanoForm] = useState({
    plano_id: '',
    tipo_pagamento: 'mensal',
    valor_pago: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [search, roleFilter, utilizadores]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Buscar utilizadores
      const usersRes = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { label: 'Admin', icon: Shield, color: 'bg-red-100 text-red-800' },
      gestao: { label: 'Gestão', icon: Briefcase, color: 'bg-blue-100 text-blue-800' },
      parceiro: { label: 'Parceiro', icon: Briefcase, color: 'bg-purple-100 text-purple-800' },
      motorista: { label: 'Motorista', icon: Car, color: 'bg-green-100 text-green-800' }
    };

    const config = roleConfig[role] || { label: role, icon: User, color: 'bg-gray-100 text-gray-800' };
    const Icon = config.icon;

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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <span>Gestão de Utilizadores</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Visualizar e gerir planos de todos os utilizadores
          </p>
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
                <SelectTrigger>
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
            </div>
          </CardContent>
        </Card>

        {/* Users Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredUsers.map((usuario) => (
            <Card key={usuario.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                      {getInitials(usuario.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{usuario.name}</CardTitle>
                    <p className="text-sm text-slate-500">{usuario.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getRoleBadge(usuario.role)}
                      {getStatusBadge(usuario)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Plano Ativo */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Plano Ativo:</span>
                    {usuario.plano_ativo ? (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Package className="w-3 h-3 mr-1" />
                        {usuario.plano_ativo.nome}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">
                        Sem plano
                      </Badge>
                    )}
                  </div>
                  
                  {usuario.modulos_ativos.length > 0 && (
                    <div className="text-xs text-slate-600">
                      <span className="font-medium">Módulos:</span> {usuario.modulos_ativos.length}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handleOpenPlanoDialog(usuario)}
                  variant="outline"
                  className="w-full"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Alterar Plano
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              Nenhum utilizador encontrado
            </CardContent>
          </Card>
        )}

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
      </div>
    </Layout>
  );
};

export default GestaoUtilizadores;
