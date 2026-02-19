import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, User, Mail, Phone, Calendar, Building, Shield, Key, 
  Eye, EyeOff, RefreshCw, Save, Lock, Unlock, Trash2, Edit, CheckCircle, XCircle,
  Building2, Plus, X, Users
} from 'lucide-react';

const PerfilUtilizador = ({ user, onLogout }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    nif: '',
    morada: '',
    codigo_postal: '',
    cidade: ''
  });
  
  // Password states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Parceiros states (para gestores)
  const [parceirosDisponiveis, setParceirosDisponiveis] = useState([]);
  const [parceirosAtribuidos, setParceirosAtribuidos] = useState([]);
  const [loadingParceiros, setLoadingParceiros] = useState(false);
  const [savingParceiros, setSavingParceiros] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  // Carregar parceiros quando o utilizador é um gestor ou contabilista
  useEffect(() => {
    if ((userData?.role === 'gestao' || userData?.role === 'contabilista') && user?.role === 'admin') {
      fetchParceirosDisponiveis();
      fetchParceirosAtribuidos();
    }
  }, [userData?.role, user?.role]);

  const fetchParceirosDisponiveis = async () => {
    try {
      setLoadingParceiros(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceirosDisponiveis(response.data || []);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    } finally {
      setLoadingParceiros(false);
    }
  };

  const fetchParceirosAtribuidos = async () => {
    try {
      const token = localStorage.getItem('token');
      // Endpoint diferente para gestor e contabilista
      const endpoint = userData?.role === 'contabilista' 
        ? `${API}/contabilistas/${userId}/parceiros`
        : `${API}/gestores/${userId}/parceiros`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const atribuidos = response.data.parceiros || [];
      setParceirosAtribuidos(atribuidos.map(p => p.id));
    } catch (error) {
      console.error('Error fetching parceiros atribuidos:', error);
      setParceirosAtribuidos([]);
    }
  };

  const handleToggleParceiro = (parceiroId) => {
    setParceirosAtribuidos(prev => {
      if (prev.includes(parceiroId)) {
        return prev.filter(id => id !== parceiroId);
      } else {
        return [...prev, parceiroId];
      }
    });
  };

  const handleSaveParceiros = async () => {
    try {
      setSavingParceiros(true);
      const token = localStorage.getItem('token');
      // Endpoint diferente para gestor e contabilista
      const endpoint = userData?.role === 'contabilista'
        ? `${API}/contabilistas/${userId}/atribuir-parceiros`
        : `${API}/gestores/${userId}/atribuir-parceiros`;
      await axios.put(
        endpoint,
        { parceiros_ids: parceirosAtribuidos },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Parceiros atribuídos com sucesso!');
    } catch (error) {
      console.error('Error saving parceiros:', error);
      toast.error('Erro ao atribuir parceiros');
    } finally {
      setSavingParceiros(false);
    }
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(response.data);
      setFormData({
        name: response.data.name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        role: response.data.role || '',
        nif: response.data.nif || '',
        morada: response.data.morada || '',
        codigo_postal: response.data.codigo_postal || '',
        cidade: response.data.cidade || ''
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Erro ao carregar dados do utilizador');
      navigate('/usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${userId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Dados atualizados com sucesso!');
      setEditMode(false);
      fetchUserData();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    try {
      setSavingPassword(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/users/${userId}/reset-password`,
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setShowPasswordSection(false);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
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

  const handleBlockUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = userData.status === 'blocked' ? 'active' : 'blocked';
      await axios.put(`${API}/users/${userId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(newStatus === 'blocked' ? 'Utilizador bloqueado' : 'Utilizador desbloqueado');
      fetchUserData();
    } catch (error) {
      toast.error('Erro ao alterar estado do utilizador');
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      gestao: 'Gestão',
      parceiro: 'Parceiro',
      operacional: 'Operacional',
      motorista: 'Motorista',
      contabilista: 'Contabilista',
      inspetor: 'Inspetor'
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      gestao: 'bg-purple-100 text-purple-800',
      parceiro: 'bg-blue-100 text-blue-800',
      operacional: 'bg-green-100 text-green-800',
      motorista: 'bg-slate-100 text-slate-800',
      contabilista: 'bg-amber-100 text-amber-800',
      inspetor: 'bg-cyan-100 text-cyan-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!userData) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <p className="text-slate-600">Utilizador não encontrado</p>
          <Button onClick={() => navigate('/usuarios')} className="mt-4">
            Voltar à lista
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => navigate('/usuarios')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex gap-2">
            {!editMode ? (
              <Button onClick={() => setEditMode(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'A guardar...' : 'Guardar'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Profile Header Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                {userData.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-slate-800">{userData.name}</h1>
                  <Badge className={getRoleBadgeColor(userData.role)}>
                    {getRoleLabel(userData.role)}
                  </Badge>
                  {userData.status === 'blocked' && (
                    <Badge variant="destructive">Bloqueado</Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {userData.email}
                  </div>
                  {userData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {userData.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Registado: {formatDate(userData.created_at)}
                  </div>
                  {userData.parceiro_name && (
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      {userData.parceiro_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
            {(userData?.role === 'gestao' || userData?.role === 'contabilista') && user?.role === 'admin' && (
              <TabsTrigger value="parceiros">Parceiros Atribuídos</TabsTrigger>
            )}
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
          </TabsList>

          {/* Tab: Dados Pessoais */}
          <TabsContent value="dados">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Dados Pessoais
                </CardTitle>
                <CardDescription>
                  Informações de contacto e identificação do utilizador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nif">NIF</Label>
                    <Input
                      id="nif"
                      value={formData.nif}
                      onChange={(e) => setFormData({...formData, nif: e.target.value})}
                      disabled={!editMode}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Tipo de Conta</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({...formData, role: value})}
                      disabled={!editMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="gestao">Gestão</SelectItem>
                        <SelectItem value="parceiro">Parceiro</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="contabilista">Contabilista</SelectItem>
                        <SelectItem value="inspetor">Inspetor</SelectItem>
                        <SelectItem value="motorista">Motorista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-3">Morada</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="morada">Morada</Label>
                      <Input
                        id="morada"
                        value={formData.morada}
                        onChange={(e) => setFormData({...formData, morada: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label htmlFor="codigo_postal">Código Postal</Label>
                      <Input
                        id="codigo_postal"
                        value={formData.codigo_postal}
                        onChange={(e) => setFormData({...formData, codigo_postal: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.cidade}
                        onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Parceiros Atribuídos (para gestores e contabilistas) */}
          {(userData?.role === 'gestao' || userData?.role === 'contabilista') && user?.role === 'admin' && (
            <TabsContent value="parceiros">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Parceiros Atribuídos
                  </CardTitle>
                  <CardDescription>
                    {userData?.role === 'contabilista' 
                      ? 'Selecione os parceiros cujos dados este contabilista pode consultar. O contabilista terá acesso às faturas e recibos dos parceiros atribuídos.'
                      : 'Selecione os parceiros que este gestor pode gerir. O gestor terá acesso total aos dados dos parceiros atribuídos.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingParceiros ? (
                    <div className="text-center py-8 text-slate-500">
                      A carregar parceiros...
                    </div>
                  ) : parceirosDisponiveis.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum parceiro disponível no sistema</p>
                    </div>
                  ) : (
                    <>
                      {/* Resumo */}
                      <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-blue-900">
                            {parceirosAtribuidos.length} de {parceirosDisponiveis.length} parceiros atribuídos
                          </span>
                        </div>
                        <Button 
                          onClick={handleSaveParceiros} 
                          disabled={savingParceiros}
                          data-testid="btn-salvar-parceiros"
                        >
                          {savingParceiros ? 'A guardar...' : 'Guardar Alterações'}
                        </Button>
                      </div>

                      {/* Lista de parceiros */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {parceirosDisponiveis.map((parceiro) => {
                          const isAtribuido = parceirosAtribuidos.includes(parceiro.id);
                          return (
                            <div
                              key={parceiro.id}
                              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                                isAtribuido 
                                  ? 'bg-green-50 border-green-300 hover:bg-green-100' 
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              }`}
                              onClick={() => handleToggleParceiro(parceiro.id)}
                              data-testid={`parceiro-${parceiro.id}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  isAtribuido ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-600'
                                }`}>
                                  {parceiro.nome_empresa?.charAt(0)?.toUpperCase() || 'P'}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {parceiro.nome_empresa || parceiro.name || 'Sem nome'}
                                  </p>
                                  <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {parceiro.email || 'N/A'}
                                    </span>
                                    {parceiro.telefone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {parceiro.telefone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {parceiro.total_veiculos !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    {parceiro.total_veiculos || 0} veículos
                                  </Badge>
                                )}
                                {isAtribuido ? (
                                  <Badge className="bg-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Atribuído
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-500">
                                    Não atribuído
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Tab: Segurança */}
          <TabsContent value="seguranca">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Defina uma nova senha para este utilizador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showPasswordSection ? (
                  <Button onClick={() => setShowPasswordSection(true)} data-testid="btn-alterar-senha">
                    <Key className="w-4 h-4 mr-2" />
                    Alterar Senha
                  </Button>
                ) : (
                  <div className="space-y-4 max-w-md">
                    <div>
                      <Label htmlFor="newPassword">Nova Senha</Label>
                      <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Digite a nova senha"
                            data-testid="input-nova-senha"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateRandomPassword}
                          title="Gerar senha aleatória"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPasswordSection(false);
                          setNewPassword('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleChangePassword}
                        disabled={!newPassword || newPassword.length < 6 || savingPassword}
                        data-testid="btn-confirmar-senha"
                      >
                        {savingPassword ? 'A guardar...' : 'Confirmar Alteração'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Ações */}
          <TabsContent value="acoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Ações de Administração
                </CardTitle>
                <CardDescription>
                  Ações administrativas sobre a conta do utilizador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  {/* Bloquear/Desbloquear */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">
                        {userData.status === 'blocked' ? 'Desbloquear Utilizador' : 'Bloquear Utilizador'}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {userData.status === 'blocked' 
                          ? 'Permitir que o utilizador aceda novamente ao sistema'
                          : 'Impedir o utilizador de aceder ao sistema'}
                      </p>
                    </div>
                    <Button
                      variant={userData.status === 'blocked' ? 'default' : 'destructive'}
                      onClick={handleBlockUser}
                    >
                      {userData.status === 'blocked' ? (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          Desbloquear
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Bloquear
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Info adicional */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Informações da Conta</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">ID:</span>
                        <span className="ml-2 font-mono text-xs">{userData.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Estado:</span>
                        <span className="ml-2">
                          {userData.status === 'active' && <Badge variant="success">Ativo</Badge>}
                          {userData.status === 'blocked' && <Badge variant="destructive">Bloqueado</Badge>}
                          {userData.status === 'pending' && <Badge variant="warning">Pendente</Badge>}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Último login:</span>
                        <span className="ml-2">{formatDate(userData.last_login) || 'Nunca'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Criado em:</span>
                        <span className="ml-2">{formatDate(userData.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PerfilUtilizador;
