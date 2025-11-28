import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User as UserIcon, Lock, Shield, Edit, Save, X } from 'lucide-react';

const Profile = ({ user, onLogout }) => {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    empresa: user.empresa || '',
    nif: user.nif || '',
    morada: user.morada || ''
  });
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/profile/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/profile/update`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Perfil atualizado com sucesso!');
      setEditMode(false);
      window.location.reload(); // Reload to update user data
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/profile/change-password`, {
        current_password: passwordData.old_password,
        new_password: passwordData.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Senha alterada com sucesso!');
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      gestao: 'bg-purple-100 text-purple-700',
      parceiro: 'bg-blue-100 text-blue-700',
      operacional: 'bg-cyan-100 text-cyan-700',
      motorista: 'bg-emerald-100 text-emerald-700'
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      gestao: 'Gestão',
      parceiro: 'Parceiro',
      operacional: 'Operacional',
      motorista: 'Motorista'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="profile-page">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Meu Perfil</h1>
          <p className="text-slate-600">Gerir informações pessoais e segurança</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5" />
                <span>Informação</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center pb-4 border-b">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <UserIcon className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                <p className="text-sm text-slate-600">{user.email}</p>
                <div className="mt-3">
                  <Badge className={getRoleBadgeColor(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">ID:</span>
                  <span className="font-mono text-xs">{user.id.substring(0, 8)}...</span>
                </div>
                {user.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Telefone:</span>
                    <span className="font-medium">{user.phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Membro desde:</span>
                  <span className="font-medium">{new Date(user.created_at).toLocaleDateString('pt-PT')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="lg:col-span-2">
            <Tabs defaultValue="info" className="w-full">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Dados Pessoais</TabsTrigger>
                  <TabsTrigger value="security">Segurança</TabsTrigger>
                  <TabsTrigger value="permissions">Permissões</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="info" className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Informações Pessoais</h3>
                    {!editMode ? (
                      <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="edit-profile-button">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                  
                  {editMode ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome</Label>
                          <Input 
                            id="name" 
                            value={profileData.name} 
                            onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                            data-testid="profile-name-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input 
                            id="phone" 
                            value={profileData.phone} 
                            onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                            data-testid="profile-phone-input"
                          />
                        </div>
                        {(user.role === 'parceiro' || user.role === 'operacional' || user.role === 'gestao') && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="empresa">Empresa</Label>
                              <Input 
                                id="empresa" 
                                value={profileData.empresa} 
                                onChange={(e) => setProfileData({...profileData, empresa: e.target.value})}
                                data-testid="profile-empresa-input"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nif">NIF</Label>
                              <Input 
                                id="nif" 
                                value={profileData.nif} 
                                onChange={(e) => setProfileData({...profileData, nif: e.target.value})}
                                data-testid="profile-nif-input"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="morada">Morada</Label>
                              <Input 
                                id="morada" 
                                value={profileData.morada} 
                                onChange={(e) => setProfileData({...profileData, morada: e.target.value})}
                                data-testid="profile-morada-input"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="save-profile-button">
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Alterações
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-600">Nome</Label>
                          <p className="font-medium">{user.name}</p>
                        </div>
                        <div>
                          <Label className="text-slate-600">Email</Label>
                          <p className="font-medium">{user.email}</p>
                        </div>
                        {user.phone && (
                          <div>
                            <Label className="text-slate-600">Telefone</Label>
                            <p className="font-medium">{user.phone}</p>
                          </div>
                        )}
                        {user.empresa && (
                          <div>
                            <Label className="text-slate-600">Empresa</Label>
                            <p className="font-medium">{user.empresa}</p>
                          </div>
                        )}
                        {user.nif && (
                          <div>
                            <Label className="text-slate-600">NIF</Label>
                            <p className="font-medium">{user.nif}</p>
                          </div>
                        )}
                        {user.morada && (
                          <div className="md:col-span-2">
                            <Label className="text-slate-600">Morada</Label>
                            <p className="font-medium">{user.morada}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Alterar Senha</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="old_password">Senha Atual</Label>
                      <Input 
                        id="old_password" 
                        type="password" 
                        value={passwordData.old_password}
                        onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})}
                        required
                        data-testid="old-password-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new_password">Nova Senha</Label>
                      <Input 
                        id="new_password" 
                        type="password" 
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                        required
                        minLength={6}
                        data-testid="new-password-input"
                      />
                      <p className="text-xs text-slate-500">Mínimo 6 caracteres</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirmar Nova Senha</Label>
                      <Input 
                        id="confirm_password" 
                        type="password" 
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                        required
                        data-testid="confirm-password-input"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="change-password-button">
                      <Lock className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="permissions" className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Permissões e Acesso</h3>
                  {permissions && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="w-5 h-5 text-emerald-600" />
                          <span className="font-semibold">Perfil: {getRoleLabel(permissions.role)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{permissions.permissions.description}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-semibold">Capacidades:</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(permissions.permissions).map(([key, value]) => {
                            if (key === 'description') return null;
                            const label = key.replace('can_', '').replace(/_/g, ' ');
                            return (
                              <div key={key} className="flex items-center space-x-2 p-2 bg-white rounded border">
                                <div className={`w-2 h-2 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className={`text-sm capitalize ${value ? 'text-slate-800' : 'text-slate-400'}`}>
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;