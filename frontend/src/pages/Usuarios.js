import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MotoristaDetailDialog from '@/components/MotoristaDetailDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserCheck, UserX, Users, UserPlus, Clock, Shield, Eye, EyeOff, Mail, Phone, Calendar, Building, Lock, Unlock, Trash2, Key, RefreshCw, Package, UserCircle } from 'lucide-react';

const Usuarios = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [actionType, setActionType] = useState(''); // 'approve', 'delete', 'changeRole', 'resetPassword'
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [selectedPlanoId, setSelectedPlanoId] = useState('');
  const [selectedPeriodicidade, setSelectedPeriodicidade] = useState('mensal');
  const [duracaoDias, setDuracaoDias] = useState(30);
  const [showMotoristaDialog, setShowMotoristaDialog] = useState(false);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');

  useEffect(() => {
    fetchUsers();
    fetchPlanos();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPendingUsers(response.data.pending_users || []);
      setRegisteredUsers(response.data.registered_users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      // Buscar planos do sistema unificado
      const response = await axios.get(`${API}/api/planos-sistema`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const todosPlanos = response.data || [];
      
      // Separar por tipo
      setPlanos({
        motorista: todosPlanos.filter(p => p.tipo_usuario === 'motorista' && p.ativo),
        parceiro: todosPlanos.filter(p => p.tipo_usuario === 'parceiro' && p.ativo)
      });
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    }
  };

  const handleAtribuirPlano = async () => {
    if (!selectedPlanoId) {
      toast.error('Selecione um plano');
      return;
    }

    // Verificar roles permitidos - Apenas motorista e parceiro têm planos
    const allowedRoles = ['motorista', 'parceiro'];
    if (!allowedRoles.includes(selectedUser?.role)) {
      toast.error('Este utilizador não pode ter planos atribuídos');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Usar endpoint apropriado conforme o role
      let endpoint = '';
      if (selectedUser.role === 'motorista') {
        endpoint = `${API}/motoristas/${selectedUser.id}/atribuir-plano`;
      } else {
        // Para parceiro, operacional e gestor - usar endpoint genérico
        endpoint = `${API}/users/${selectedUser.id}/atribuir-plano`;
      }
      
      await axios.post(
        endpoint,
        { 
          plano_id: selectedPlanoId, 
          periodicidade: selectedPeriodicidade || 'mensal',
          auto_renovacao: false 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Plano ${selectedPeriodicidade} atribuído com sucesso!`);
      setShowPlanoDialog(false);
      setSelectedPlanoId('');
      setSelectedPeriodicidade('mensal');
      fetchUsers();
    } catch (error) {
      console.error('Error assigning plan:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atribuir plano');
    }
  };

  const handleApproveUser = async (userId, role) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/users/${userId}/approve`,
        { role: role },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success('Utilizador aprovado com sucesso!');
      fetchUsers();
      setShowDialog(false);
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Erro ao aprovar utilizador');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/users/${userId}/set-role`,
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success('Role atualizada com sucesso!');
      fetchUsers();
      setShowDialog(false);
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Erro ao alterar role');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Utilizador eliminado com sucesso!');
      fetchUsers();
      setShowDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao eliminar utilizador');
    }
  };

  const handleBlockUser = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
      
      await axios.put(
        `${API}/users/${userId}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success(newStatus === 'blocked' ? 'Utilizador bloqueado!' : 'Utilizador desbloqueado!');
      fetchUsers();
    } catch (error) {
      console.error('Error blocking/unblocking user:', error);
      toast.error('Erro ao alterar estado do utilizador');
    }
  };

  const openApproveDialog = (userToApprove) => {
    setSelectedUser(userToApprove);
    setSelectedRole(userToApprove.role || 'motorista');
    setActionType('approve');
    setShowDialog(true);
  };

  const openChangeRoleDialog = (userToChange) => {
    setSelectedUser(userToChange);
    setSelectedRole(userToChange.role);
    setActionType('changeRole');
    setShowDialog(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API}/users/${selectedUser.id}/reset-password`,
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setGeneratedPassword(response.data.new_password);
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      fetchUsers();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    setShowPassword(true);
  };

  const openPasswordDialog = (userToReset) => {
    setSelectedUser(userToReset);
    setNewPassword('');
    setGeneratedPassword('');
    setShowPassword(false);
    setShowPasswordDialog(true);
  };

  const openDeleteDialog = (userToDelete) => {
    setSelectedUser(userToDelete);
    setActionType('delete');
    setShowDialog(true);
  };

  const confirmAction = () => {
    if (!selectedUser) return;

    if (actionType === 'approve') {
      handleApproveUser(selectedUser.id, selectedRole);
    } else if (actionType === 'changeRole') {
      handleChangeRole(selectedUser.id, selectedRole);
    } else if (actionType === 'delete') {
      handleDeleteUser(selectedUser.id);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      gestao: 'bg-blue-100 text-blue-800',
      operacional: 'bg-green-100 text-green-800',
      parceiro: 'bg-yellow-100 text-yellow-800',
      motorista: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin',
      gestao: 'Gestor',
      operacional: 'Operacional',
      parceiro: 'Parceiro',
      motorista: 'Motorista',
    };
    return labels[role] || role;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-PT');
    } catch {
      return 'N/A';
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Gestão de Utilizadores</h1>
              <p className="text-slate-600 mt-1">Gerir utilizadores pendentes e registados</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilizadores Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingUsers.length}</div>
              <p className="text-xs text-slate-500 mt-1">Aguardam aprovação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilizadores Registados</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{registeredUsers.length}</div>
              <p className="text-xs text-slate-500 mt-1">Ativos no sistema</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Users Table */}
        {pendingUsers.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <span>Utilizadores Pendentes de Aprovação</span>
              </CardTitle>
              <CardDescription>
                Estes utilizadores aguardam aprovação para aceder ao sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role Solicitada</TableHead>
                      <TableHead>Data de Registo</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((pendingUser) => (
                      <TableRow key={pendingUser.id}>
                        <TableCell className="font-medium">{pendingUser.name}</TableCell>
                        <TableCell>{pendingUser.email}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                              pendingUser.role
                            )}`}
                          >
                            {getRoleLabel(pendingUser.role)}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(pendingUser.created_at)}</TableCell>
                        <TableCell>{pendingUser.phone || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setViewingUser(pendingUser);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => openApproveDialog(pendingUser)}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDeleteDialog(pendingUser)}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Registered Users - Simple List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Utilizadores Registados</span>
            </CardTitle>
            <CardDescription>
              Utilizadores com acesso aprovado ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Pesquisar por nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="parceiro">Parceiro</SelectItem>
                    <SelectItem value="gestao">Gestor</SelectItem>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Simple List */}
            <div className="space-y-2">
              {registeredUsers
                .filter(regUser => {
                  // Apply role filter
                  if (roleFilter !== 'todos' && regUser.role !== roleFilter) {
                    return false;
                  }
                  // Apply search filter
                  if (searchTerm) {
                    const search = searchTerm.toLowerCase();
                    return (
                      regUser.name?.toLowerCase().includes(search) ||
                      regUser.email?.toLowerCase().includes(search) ||
                      regUser.phone?.toLowerCase().includes(search)
                    );
                  }
                  return true;
                })
                .map((regUser) => (
                <div
                  key={regUser.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setViewingUser(regUser);
                    setShowDetailsDialog(true);
                  }}
                >
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {regUser.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 truncate">{regUser.name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            regUser.role
                          )}`}
                        >
                          {getRoleLabel(regUser.role)}
                        </span>
                        {regUser.status === 'blocked' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {regUser.email}
                        </span>
                        {regUser.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {regUser.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingUser(regUser);
                      setShowDetailsDialog(true);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {registeredUsers
                .filter(regUser => {
                  if (roleFilter !== 'todos' && regUser.role !== roleFilter) {
                    return false;
                  }
                  if (searchTerm) {
                    const search = searchTerm.toLowerCase();
                    return (
                      regUser.name?.toLowerCase().includes(search) ||
                      regUser.email?.toLowerCase().includes(search) ||
                      regUser.phone?.toLowerCase().includes(search)
                    );
                  }
                  return true;
                }).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Nenhum utilizador encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Aprovar Utilizador'}
              {actionType === 'changeRole' && 'Alterar Role do Utilizador'}
              {actionType === 'delete' && 'Eliminar Utilizador'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && (
                <div className="space-y-4">
                  <p>
                    Tem a certeza que deseja aprovar o utilizador <strong>{selectedUser?.name}</strong>?
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Atribuir Role:
                    </label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="gestao">Gestor</SelectItem>
                        <SelectItem value="parceiro">Parceiro</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {actionType === 'changeRole' && (
                <div className="space-y-4">
                  <p>
                    Alterar a role do utilizador <strong>{selectedUser?.name}</strong>:
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nova Role:
                    </label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="gestao">Gestor</SelectItem>
                        <SelectItem value="parceiro">Parceiro</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {actionType === 'delete' && (
                <p>
                  Tem a certeza que deseja eliminar o utilizador <strong>{selectedUser?.name}</strong>?
                  Esta ação não pode ser revertida.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Details Dialog - Enhanced */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Detalhes do Utilizador</span>
            </DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6">
              {/* User Header with Avatar */}
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                  {viewingUser.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{viewingUser.name}</h2>
                  <p className="text-sm text-slate-600">{viewingUser.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(viewingUser.role)}`}>
                      {getRoleLabel(viewingUser.role)}
                    </span>
                    {viewingUser.status === 'blocked' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Lock className="w-3 h-3 mr-1" />
                        Bloqueado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center">
                  <UserCircle className="w-4 h-4 mr-2" />
                  Informação Pessoal
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <label className="text-xs text-slate-500 flex items-center space-x-1">
                      <Phone className="w-3 h-3" />
                      <span>Telefone</span>
                    </label>
                    <p className="font-medium text-slate-800 text-sm">{viewingUser.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Data de Registo</span>
                    </label>
                    <p className="font-medium text-slate-800 text-sm">{formatDate(viewingUser.created_at)}</p>
                  </div>
                  {viewingUser.nif && (
                    <div>
                      <label className="text-xs text-slate-500">NIF</label>
                      <p className="font-medium text-slate-800 text-sm">{viewingUser.nif}</p>
                    </div>
                  )}
                  {viewingUser.morada && (
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500">Morada</label>
                      <p className="font-medium text-slate-800 text-sm">{viewingUser.morada}</p>
                    </div>
                  )}
                  {viewingUser.empresa && (
                    <div>
                      <label className="text-xs text-slate-500 flex items-center space-x-1">
                        <Building className="w-3 h-3" />
                        <span>Empresa</span>
                      </label>
                      <p className="font-medium text-slate-800 text-sm">{viewingUser.empresa}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-3">Ações Rápidas</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Change Role */}
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center space-y-1"
                    onClick={() => {
                      setShowDetailsDialog(false);
                      openChangeRoleDialog(viewingUser);
                    }}
                  >
                    <UserCheck className="w-5 h-5" />
                    <span className="text-xs">Alterar Role</span>
                  </Button>

                  {/* Reset Password */}
                  {viewingUser.id !== user.id && (
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center space-y-1"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        openPasswordDialog(viewingUser);
                      }}
                    >
                      <Key className="w-5 h-5" />
                      <span className="text-xs">Alterar Senha</span>
                    </Button>
                  )}

                  {/* Assign Plan */}
                  {viewingUser.id !== user.id && (
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center space-y-1"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        setSelectedUser(viewingUser);
                        setSelectedPlanoId('');
                        setShowPlanoDialog(true);
                      }}
                    >
                      <Package className="w-5 h-5" />
                      <span className="text-xs">Atribuir Plano</span>
                    </Button>
                  )}

                  {/* Block/Unblock */}
                  {viewingUser.id !== user.id && (
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center space-y-1"
                      onClick={() => {
                        handleBlockUser(viewingUser.id, viewingUser.status);
                        setShowDetailsDialog(false);
                      }}
                    >
                      {viewingUser.status === 'blocked' ? (
                        <>
                          <Unlock className="w-5 h-5" />
                          <span className="text-xs">Desbloquear</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          <span className="text-xs">Bloquear</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Motorista Actions */}
                  {viewingUser.role === 'motorista' && (
                    <>
                      <Button
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-center space-y-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setShowDetailsDialog(false);
                          setSelectedMotoristaId(viewingUser.id);
                          setShowMotoristaDialog(true);
                        }}
                      >
                        <UserCircle className="w-5 h-5" />
                        <span className="text-xs">Ver Motorista</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-center space-y-1 border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => {
                          setShowDetailsDialog(false);
                          navigate(`/validacao-documentos/${viewingUser.id}`);
                        }}
                      >
                        <Shield className="w-5 h-5" />
                        <span className="text-xs">Validar Docs</span>
                      </Button>
                    </>
                  )}

                  {/* Delete */}
                  {viewingUser.id !== user.id && (
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center space-y-1 border-red-500 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        openDeleteDialog(viewingUser);
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-xs">Eliminar</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Alterar Senha</span>
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Alterar senha para: <strong>{selectedUser.name}</strong>
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomPassword}
                    className="px-3"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Mínimo 6 caracteres</p>
              </div>

              {generatedPassword && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Senha alterada com sucesso!</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Nova senha: <code className="bg-green-100 px-1 rounded">{generatedPassword}</code>
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordDialog(false);
                    setNewPassword('');
                    setGeneratedPassword('');
                    setShowPassword(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Key className="w-4 h-4 mr-1" />
                  Alterar Senha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Atribuir Plano Dialog */}
      <Dialog open={showPlanoDialog} onOpenChange={setShowPlanoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Plano Manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Utilizador: <strong>{selectedUser?.name || selectedUser?.email}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Perfil: <strong className="text-blue-600">{selectedUser?.role === 'motorista' ? 'Motorista' : selectedUser?.role}</strong>
              </p>
            </div>

            {/* Info sobre tipos de planos */}
            {selectedUser && selectedUser.role === 'parceiro' && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                <p className="text-xs text-blue-800">
                  ℹ️ <strong>Parceiro</strong> pode ter plano atribuído para gerir veículos e motoristas.
                </p>
              </div>
            )}

            {/* Select de planos - Apenas Motorista e Parceiro */}
            {selectedUser && ['motorista', 'parceiro'].includes(selectedUser.role) && (
              <>
                <div>
                  <Label htmlFor="plano">
                    {selectedUser.role === 'motorista' ? 'Selecionar Plano de Motorista' : 'Selecionar Plano de Parceiro'}
                  </Label>
                  <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedUser.role === 'motorista' ? (
                        planos.motorista?.length === 0 ? (
                          <div className="p-2 text-center text-sm text-slate-500">
                            Nenhum plano de motorista disponível
                          </div>
                        ) : (
                          planos.motorista?.map((plano) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              {plano.nome} - Semanal: €{plano.preco_semanal?.toFixed(2) || '0.00'} | Mensal: €{plano.preco_mensal?.toFixed(2) || '0.00'}
                            </SelectItem>
                          ))
                        )
                      ) : (
                        planos.parceiro?.length === 0 ? (
                          <div className="p-2 text-center text-sm text-slate-500">
                            Nenhum plano de parceiro disponível
                          </div>
                        ) : (
                          planos.parceiro?.map((plano) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              {plano.nome} - €{plano.preco_mensal?.toFixed(2) || '0.00'}/mês
                            </SelectItem>
                          ))
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="periodicidade">Periodicidade de Pagamento</Label>
                  <Select value={selectedPeriodicidade} onValueChange={setSelectedPeriodicidade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a periodicidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">
                        Semanal (renovação a cada 7 dias)
                      </SelectItem>
                      <SelectItem value="mensal">
                        Mensal (renovação a cada 30 dias)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlanoId && planos.find(p => p.id === selectedPlanoId) && (
                  <div className="bg-slate-50 p-3 rounded">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Resumo do Plano:</p>
                    {(() => {
                      const plano = planos.find(p => p.id === selectedPlanoId);
                      const precoSemanal = plano.preco_semanal || 0;
                      const precoMensal = plano.preco_mensal || 0;
                      const desconto = plano.desconto_mensal_percentagem || 0;
                      const precoMensalComDesconto = precoMensal * (1 - desconto / 100);
                      
                      return (
                        <>
                          <p className="text-xs text-slate-600">
                            <strong>Plano:</strong> {plano.nome}
                          </p>
                          <p className="text-xs text-slate-600">
                            <strong>Periodicidade:</strong> {selectedPeriodicidade === 'semanal' ? 'Semanal' : 'Mensal'}
                          </p>
                          {selectedPeriodicidade === 'semanal' ? (
                            <p className="text-xs text-slate-600">
                              <strong>Valor:</strong> €{precoSemanal.toFixed(2)}/semana
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-slate-600">
                                <strong>Valor base:</strong> €{precoMensal.toFixed(2)}/mês
                              </p>
                              {desconto > 0 && (
                                <>
                                  <p className="text-xs text-green-600">
                                    <strong>Desconto mensal:</strong> {desconto}%
                                  </p>
                                  <p className="text-xs text-slate-700 font-bold">
                                    <strong>Valor final:</strong> €{precoMensalComDesconto.toFixed(2)}/mês
                                  </p>
                                </>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs text-blue-800">
                    ℹ️ Esta ação atribui o plano <strong>gratuitamente</strong> sem necessidade de pagamento. 
                    O plano será ativado imediatamente e o motorista terá acesso às funcionalidades incluídas.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPlanoDialog(false)}>
                Cancelar
              </Button>
              {selectedUser?.role === 'motorista' && (
                <Button onClick={handleAtribuirPlano} disabled={!selectedPlanoId}>
                  <Package className="w-4 h-4 mr-2" />
                  Atribuir Plano
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Motorista Detail Dialog */}
      <MotoristaDetailDialog
        open={showMotoristaDialog}
        onClose={() => setShowMotoristaDialog(false)}
        motoristaId={selectedMotoristaId}
        userRole={user.role}
      />
    </Layout>
  );
};

export default Usuarios;
