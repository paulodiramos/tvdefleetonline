import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { UserCheck, UserX, Users, UserPlus, Clock, Shield, Eye, Mail, Phone, Calendar, Building } from 'lucide-react';

const Usuarios = ({ user, onLogout }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [actionType, setActionType] = useState(''); // 'approve', 'delete', 'changeRole'
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchUsers();
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
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            regUser.role
                          )}`}
                        >
                          {getRoleLabel(regUser.role)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(regUser.created_at)}</TableCell>
                      <TableCell>{regUser.phone || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openChangeRoleDialog(regUser)}
                          >
                            Alterar Role
                          </Button>
                          {regUser.id !== user.id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDeleteDialog(regUser)}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
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
    </Layout>
  );
};

export default Usuarios;
