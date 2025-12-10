import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Car,
  CreditCard,
  MapPin,
  Fuel
} from 'lucide-react';

const GestaoCredenciais = ({ user, onLogout }) => {
  const [credenciais, setCredenciais] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [testando, setTestando] = useState({});
  const [senhasVisiveis, setSenhasVisiveis] = useState({});
  const [parceiroFiltro, setParceiroFiltro] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    parceiro_id: null,
    plataforma: 'bolt',
    email: '',
    password: '',
    ativo: true,
    sincronizacao_automatica: true,
    frequencia_dias: 7
  });

  const plataformas = [
    { value: 'bolt', label: 'Bolt', icon: Car, color: 'bg-green-100 text-green-800', url: 'partners.bolt.eu' },
    { value: 'uber', label: 'Uber', icon: Car, color: 'bg-black text-white', url: 'partners.uber.com' },
    { value: 'via_verde', label: 'Via Verde', icon: CreditCard, color: 'bg-blue-100 text-blue-800', url: 'viaverde.pt' },
    { value: 'gps', label: 'GPS', icon: MapPin, color: 'bg-purple-100 text-purple-800', url: 'Plataforma GPS' },
    { value: 'combustivel', label: 'Combustível', icon: Fuel, color: 'bg-orange-100 text-orange-800', url: 'Sistema Combustível' }
  ];

  useEffect(() => {
    fetchCredenciais();
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    }
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchCredenciais = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${API}/credenciais-plataforma`;
      if (parceiroFiltro && parceiroFiltro !== 'todos') {
        url += `?parceiro_id=${parceiroFiltro}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredenciais(response.data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error('Erro ao carregar credenciais');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        ...formData,
        parceiro_id: formData.parceiro_id === 'none' ? null : formData.parceiro_id
      };

      if (editando) {
        await axios.put(
          `${API}/credenciais-plataforma/${editando.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Credenciais atualizadas!');
      } else {
        await axios.post(
          `${API}/credenciais-plataforma`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Credenciais adicionadas!');
      }

      setShowModal(false);
      resetForm();
      fetchCredenciais();
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar credenciais');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover estas credenciais?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/credenciais-plataforma/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credenciais removidas!');
      fetchCredenciais();
    } catch (error) {
      console.error('Error deleting credentials:', error);
      toast.error('Erro ao remover credenciais');
    }
  };

  const handleTestarConexao = async (cred) => {
    try {
      setTestando({ ...testando, [cred.id]: true });
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/credenciais-plataforma/${cred.id}/testar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Conexão bem-sucedida!');
      } else {
        toast.error(response.data.message || 'Falha na conexão');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(error.response?.data?.detail || 'Erro ao testar conexão');
    } finally {
      setTestando({ ...testando, [cred.id]: false });
    }
  };

  const handleSincronizarAgora = async (cred) => {
    try {
      setTestando({ ...testando, [`sync_${cred.id}`]: true });
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/credenciais-plataforma/${cred.id}/sincronizar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message || 'Sincronização iniciada!');
        fetchCredenciais();
      } else {
        toast.error(response.data.message || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error(error.response?.data?.detail || 'Erro ao sincronizar');
    } finally {
      setTestando({ ...testando, [`sync_${cred.id}`]: false });
    }
  };

  const handleEdit = (cred) => {
    setEditando(cred);
    setFormData({
      parceiro_id: cred.parceiro_id || null,
      plataforma: cred.plataforma,
      email: cred.email,
      password: '', // Não preencher password por segurança
      ativo: cred.ativo,
      sincronizacao_automatica: cred.sincronizacao_automatica || true,
      frequencia_dias: cred.frequencia_dias || 7
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      parceiro_id: null,
      plataforma: 'bolt',
      email: '',
      password: '',
      ativo: true,
      sincronizacao_automatica: true,
      frequencia_dias: 7
    });
    setEditando(null);
  };

  const toggleSenhaVisivel = (credId) => {
    setSenhasVisiveis({
      ...senhasVisiveis,
      [credId]: !senhasVisiveis[credId]
    });
  };

  const getPlataformaInfo = (valor) => {
    return plataformas.find(p => p.value === valor) || plataformas[0];
  };

  const getParceiro = (parceiroId) => {
    return parceiros.find(p => p.id === parceiroId);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Credenciais</h1>
            <p className="text-slate-600 mt-1">
              Configure credenciais para sincronização automática
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Credencial
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Settings className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="text-sm text-blue-900 font-medium">Como Funciona</p>
                <p className="text-sm text-blue-800 mt-1">
                  Adicione as credenciais de acesso às plataformas externas. O sistema sincronizará automaticamente
                  os dados conforme a frequência configurada. Pode também forçar sincronização manual a qualquer momento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Credenciais */}
        {loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">A carregar...</p>
            </CardContent>
          </Card>
        ) : credenciais.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Key className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600">Nenhuma credencial configurada</p>
              <Button onClick={() => setShowModal(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeira Credencial
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {credenciais.map((cred) => {
              const plat = getPlataformaInfo(cred.plataforma);
              const Icon = plat.icon;
              const parceiro = getParceiro(cred.parceiro_id);

              return (
                <Card key={cred.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${plat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{plat.label}</h3>
                            <Badge variant={cred.ativo ? "default" : "secondary"}>
                              {cred.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                            {cred.sincronizacao_automatica && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                          
                          {parceiro && (
                            <p className="text-sm text-slate-600 mb-2">
                              Parceiro: {parceiro.nome_empresa || parceiro.email}
                            </p>
                          )}

                          <p className="text-sm text-slate-500 mb-1">
                            Email: {cred.email}
                          </p>
                          <p className="text-sm text-slate-500">
                            URL: {plat.url}
                          </p>

                          {cred.ultima_sincronizacao && (
                            <p className="text-xs text-slate-400 mt-2">
                              Última sincronização: {new Date(cred.ultima_sincronizacao).toLocaleString('pt-PT')}
                            </p>
                          )}

                          {cred.sincronizacao_automatica && (
                            <p className="text-xs text-blue-600 mt-1">
                              Sincronização a cada {cred.frequencia_dias} dias
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSincronizarAgora(cred)}
                          disabled={testando[`sync_${cred.id}`]}
                          className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                          {testando[`sync_${cred.id}`] ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sincronizar
                            </>
                          )}
                        </Button>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(cred)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(cred.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal de Adicionar/Editar */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editando ? 'Editar Credencial' : 'Nova Credencial'}
              </DialogTitle>
              <DialogDescription>
                Configure as credenciais de acesso à plataforma externa
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Plataforma */}
              <div>
                <Label>Plataforma *</Label>
                <Select
                  value={formData.plataforma}
                  onValueChange={(value) => setFormData({ ...formData, plataforma: value })}
                  disabled={editando}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plataformas.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Parceiro */}
              {(user.role === 'admin' || user.role === 'gestao') && (
                <div>
                  <Label>Parceiro (Opcional)</Label>
                  <Select
                    value={formData.parceiro_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, parceiro_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {parceiros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_empresa || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Email */}
              <div>
                <Label>Email / Username *</Label>
                <Input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editando ? 'Deixe vazio para manter a mesma' : 'Sua password'}
                  required={!editando}
                />
              </div>

              {/* Sincronização Automática */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sync-auto"
                  checked={formData.sincronizacao_automatica}
                  onChange={(e) => setFormData({ ...formData, sincronizacao_automatica: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="sync-auto" className="cursor-pointer">
                  Ativar sincronização automática
                </Label>
              </div>

              {/* Frequência */}
              {formData.sincronizacao_automatica && (
                <div>
                  <Label>Frequência (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.frequencia_dias}
                    onChange={(e) => setFormData({ ...formData, frequencia_dias: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Sincronizar automaticamente a cada {formData.frequencia_dias} dias
                  </p>
                </div>
              )}

              {/* Ativo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Credencial ativa
                </Label>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editando ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoCredenciais;
