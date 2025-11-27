import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { UserCheck, UserX, Users, UserPlus, Clock, Shield, Eye, EyeOff, Mail, Phone, Calendar, Building, Lock, Unlock, Trash2, Key, RefreshCw, Package } from 'lucide-react';

const Usuarios = ({ user, onLogout }) => {
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
      // Buscar planos de MOTORISTA apenas
      const response = await axios.get(`${API}/planos-motorista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleAtribuirPlano = async () => {
    if (!selectedPlanoId) {
      toast.error('Selecione um plano');
      return;
    }

    // Verificar se o utilizador é motorista
    if (selectedUser?.role !== 'motorista') {
      toast.error('Apenas motoristas podem ter planos de motorista atribuídos');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Usar endpoint específico para motoristas
      await axios.post(
        `${API}/motoristas/${selectedUser.id}/atribuir-plano`,
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

        {/* Registered Users Table */}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Data de Registo</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredUsers.map((regUser) => (
                    <TableRow key={regUser.id}>
                      <TableCell className="font-medium">{regUser.name}</TableCell>
                      <TableCell>{regUser.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
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
                      </TableCell>
                      <TableCell>{formatDate(regUser.created_at)}</TableCell>
                      <TableCell>{regUser.phone || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setViewingUser(regUser);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openChangeRoleDialog(regUser)}
                          >
                            Alterar Role
                          </Button>
                          {regUser.id !== user.id && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(regUser);
                                  setSelectedPlanoId('');
                                  setDuracaoDias(30);
                                  setShowPlanoDialog(true);
                                }}
                                className="bg-purple-50 hover:bg-purple-100"
                              >
                                <Package className="w-4 h-4 mr-1" />
                                Plano
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPasswordDialog(regUser)}
                                className="bg-blue-50 hover:bg-blue-100"
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Senha
                              </Button>
                              <Button
                                size="sm"
                                variant={regUser.status === 'blocked' ? 'default' : 'outline'}
                                onClick={() => handleBlockUser(regUser.id, regUser.status)}
                                className={regUser.status === 'blocked' ? 'bg-green-600 hover:bg-green-700' : ''}
                              >
                                {regUser.status === 'blocked' ? (
                                  <>
                                    <Unlock className="w-4 h-4 mr-1" />
                                    Desbloquear
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4 mr-1" />
                                    Bloquear
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openDeleteDialog(regUser)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Detalhes do Utilizador</span>
            </DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Informação Pessoal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">Nome</label>
                    <p className="font-medium text-slate-800">{viewingUser.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>Email</span>
                    </label>
                    <p className="font-medium text-slate-800">{viewingUser.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 flex items-center space-x-1">
                      <Phone className="w-3 h-3" />
                      <span>Telefone</span>
                    </label>
                    <p className="font-medium text-slate-800">{viewingUser.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Data de Registo</span>
                    </label>
                    <p className="font-medium text-slate-800">{formatDate(viewingUser.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Role Info */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Informação de Acesso</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">Role Solicitada</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(viewingUser.role)}`}>
                        {getRoleLabel(viewingUser.role)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Status</label>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                        <Clock className="w-3 h-3 mr-1" />
                        Pendente
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info (if motorista or parceiro) */}
              {(viewingUser.role === 'motorista' || viewingUser.role === 'parceiro') && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Informação Adicional</h3>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                    {viewingUser.nif && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">NIF:</span>
                        <span className="text-sm font-medium text-slate-800">{viewingUser.nif}</span>
                      </div>
                    )}
                    {viewingUser.morada && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Morada:</span>
                        <span className="text-sm font-medium text-slate-800">{viewingUser.morada}</span>
                      </div>
                    )}
                    {viewingUser.empresa && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 flex items-center space-x-1">
                          <Building className="w-3 h-3" />
                          <span>Empresa:</span>
                        </span>
                        <span className="text-sm font-medium text-slate-800">{viewingUser.empresa}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    openDeleteDialog(viewingUser);
                  }}
                >
                  <UserX className="w-4 h-4 mr-1" />
                  Rejeitar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    openApproveDialog(viewingUser);
                  }}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  Aprovar
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
            </div>

            <div>
              <Label htmlFor="plano">Selecionar Plano</Label>
              <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.id}>
                      {plano.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duracao">Duração (dias)</Label>
              <Input
                id="duracao"
                type="number"
                value={duracaoDias}
                onChange={(e) => setDuracaoDias(parseInt(e.target.value) || 30)}
                placeholder="30"
              />
              <p className="text-xs text-slate-500 mt-1">
                O plano ficará ativo por {duracaoDias} dias
              </p>
            </div>

            <div className="bg-blue-50 p-3 rounded">
              <p className="text-xs text-blue-800">
                ℹ️ Esta ação atribui o plano gratuitamente sem necessidade de pagamento. 
                O plano será ativado imediatamente.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPlanoDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAtribuirPlano}>
                <Package className="w-4 h-4 mr-2" />
                Atribuir Plano
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Usuarios;
