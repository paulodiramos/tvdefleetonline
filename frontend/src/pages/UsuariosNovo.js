import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCheck, UserX, Shield, Mail, Phone, Clock, Eye, Key, RefreshCw } from 'lucide-react';

const UsuariosNovo = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [pendingRes, registeredRes] = await Promise.all([
        axios.get(`${API}/users/pending`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPendingUsers(pendingRes.data);
      setRegisteredUsers(registeredRes.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilizador aprovado!');
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao aprovar');
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Tem certeza que deseja rejeitar este utilizador?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilizador rejeitado!');
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Erro ao rejeitar');
    }
  };

  const handleUpdateRole = async () => {
    if (!newRole) {
      toast.error('Selecione uma role');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${selectedUser.id}/role`, 
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Role atualizada!');
      setShowDetailsDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar role');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${selectedUser.id}/password`,
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Senha atualizada!');
      setNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Erro ao atualizar senha');
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      gestao: 'bg-blue-100 text-blue-800',
      parceiro: 'bg-green-100 text-green-800',
      motorista: 'bg-amber-100 text-amber-800'
    };
    return colors[role] || 'bg-slate-100 text-slate-800';
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Utilizadores</h1>
          <div className="flex items-center space-x-2 text-slate-600">
            <Users className="w-5 h-5" />
            <span className="font-medium">{registeredUsers.length} ativos</span>
          </div>
        </div>

        {/* Utilizadores Pendentes */}
        {pendingUsers.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-amber-600" />
              Aguardando Aprovação ({pendingUsers.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingUsers.map(pendingUser => (
                <Card key={pendingUser.id} className="hover:shadow-lg transition-shadow border-amber-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pendingUser.name}</CardTitle>
                      <Badge className={getRoleBadgeColor(pendingUser.role)}>
                        {pendingUser.role}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-slate-600 space-y-1">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {pendingUser.email}
                      </div>
                      {pendingUser.phone && (
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          {pendingUser.phone}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(pendingUser.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(pendingUser.id)}
                        className="flex-1"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Utilizadores Registados */}
        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Utilizadores Ativos ({registeredUsers.length})
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registeredUsers.map(regUser => (
              <Card key={regUser.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{regUser.name}</CardTitle>
                    <Badge className={getRoleBadgeColor(regUser.role)}>
                      {regUser.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-slate-600 space-y-1">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      {regUser.email}
                    </div>
                    {regUser.phone && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        {regUser.phone}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(regUser);
                        setNewRole(regUser.role);
                        setShowDetailsDialog(true);
                      }}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalhes
                    </Button>
                    {regUser.role === 'motorista' && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/validacao-documentos/${regUser.id}`)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dialog de Detalhes */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Utilizador</DialogTitle>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6">
                {/* Informações Básicas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">Nome</Label>
                    <p className="font-medium">{selectedUser.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Email</Label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Telefone</Label>
                    <p className="font-medium">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Role Atual</Label>
                    <Badge className={getRoleBadgeColor(selectedUser.role)}>
                      {selectedUser.role}
                    </Badge>
                  </div>
                </div>

                {/* Alterar Role */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-2 block">Alterar Role</Label>
                  <div className="flex space-x-2">
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="gestao">Gestão</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="parceiro">Parceiro</SelectItem>
                        <SelectItem value="motorista">Motorista</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleUpdateRole} disabled={updating || newRole === selectedUser.role}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {/* Alterar Senha */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-2 block">Alterar Senha</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="password"
                      placeholder="Nova senha (mín. 6 caracteres)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleUpdatePassword} disabled={updating}>
                      <Key className="w-4 h-4 mr-2" />
                      Guardar
                    </Button>
                  </div>
                </div>

                {/* Validar Documentos (Motorista) */}
                {selectedUser.role === 'motorista' && (
                  <div className="border-t pt-4">
                    <Button
                      onClick={() => {
                        setShowDetailsDialog(false);
                        navigate(`/validacao-documentos/${selectedUser.id}`);
                      }}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Validar Documentos
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UsuariosNovo;
