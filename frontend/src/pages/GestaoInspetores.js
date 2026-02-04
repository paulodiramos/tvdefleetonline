import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  UserCheck, Plus, Search, Eye, Edit, Trash2, 
  Phone, Mail, Calendar, ClipboardCheck, Building
} from 'lucide-react';

const GestaoInspetores = ({ user, onLogout }) => {
  const [inspetores, setInspetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedInspetor, setSelectedInspetor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInspetores();
  }, []);

  const fetchInspetores = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/inspetores/lista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInspetores(response.data.inspetores || []);
    } catch (error) {
      console.error('Erro ao carregar inspetores:', error);
      toast.error('Erro ao carregar inspetores');
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/inspetores/criar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inspetor criado com sucesso');
      setShowCreateDialog(false);
      setFormData({ name: '', email: '', phone: '', password: '' });
      fetchInspetores();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar inspetor');
    }
    setSubmitting(false);
  };

  const handleToggleAtivo = async (inspetor) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/inspetores/${inspetor.id}`, 
        { ativo: !inspetor.ativo },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(inspetor.ativo ? 'Inspetor desativado' : 'Inspetor ativado');
      fetchInspetores();
    } catch (error) {
      toast.error('Erro ao atualizar inspetor');
    }
  };

  const handleDelete = async (inspetorId) => {
    if (!confirm('Tem certeza que deseja desativar este inspetor?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/inspetores/${inspetorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inspetor desativado');
      fetchInspetores();
    } catch (error) {
      toast.error('Erro ao desativar inspetor');
    }
  };

  const viewDetails = async (inspetorId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/inspetores/${inspetorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedInspetor(response.data);
      setShowDetailDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar detalhes');
    }
  };

  const filteredInspetores = inspetores.filter(i => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      i.name?.toLowerCase().includes(term) ||
      i.email?.toLowerCase().includes(term) ||
      i.phone?.includes(term)
    );
  });

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-purple-600" />
              Gestão de Inspetores
            </h1>
            <p className="text-gray-600 mt-1">
              Inspetores realizam vistorias de veículos na app móvel
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="criar-inspetor-btn">
            <Plus className="h-4 w-4 mr-2" />
            Novo Inspetor
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Total Inspetores</p>
                  <p className="text-2xl font-bold text-purple-800">{inspetores.length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Ativos</p>
                  <p className="text-2xl font-bold text-green-800">
                    {inspetores.filter(i => i.ativo !== false).length}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Vistorias Realizadas</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {inspetores.reduce((sum, i) => sum + (i.total_vistorias || 0), 0)}
                  </p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Pesquisar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Inspetores ({filteredInspetores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            ) : filteredInspetores.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum inspetor encontrado</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro inspetor
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInspetores.map((inspetor) => (
                  <div
                    key={inspetor.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    data-testid={`inspetor-item-${inspetor.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <UserCheck className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inspetor.name}</span>
                          <Badge variant={inspetor.ativo !== false ? 'success' : 'secondary'}>
                            {inspetor.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {inspetor.email}
                          </span>
                          {inspetor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {inspetor.phone}
                            </span>
                          )}
                        </div>
                        {inspetor.parceiros_nomes?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Building className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {inspetor.parceiros_nomes.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => viewDetails(inspetor.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleToggleAtivo(inspetor)}
                      >
                        {inspetor.ativo !== false ? (
                          <Trash2 className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Criar Novo Inspetor
              </DialogTitle>
              <DialogDescription>
                O inspetor ficará automaticamente associado a si e poderá realizar vistorias na app móvel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+351 912 345 678"
                />
              </div>
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={submitting} className="flex-1">
                  {submitting ? 'A criar...' : 'Criar Inspetor'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Inspetor</DialogTitle>
            </DialogHeader>
            {selectedInspetor && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                    <UserCheck className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedInspetor.name}</h3>
                    <Badge variant={selectedInspetor.ativo !== false ? 'success' : 'secondary'}>
                      {selectedInspetor.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Email</Label>
                    <p className="font-medium">{selectedInspetor.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Telefone</Label>
                    <p className="font-medium">{selectedInspetor.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Criado em</Label>
                    <p className="font-medium">
                      {new Date(selectedInspetor.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Total Vistorias</Label>
                    <p className="font-medium">{selectedInspetor.total_vistorias || 0}</p>
                  </div>
                </div>

                {selectedInspetor.parceiros_nomes?.length > 0 && (
                  <div>
                    <Label className="text-gray-500">Parceiros Associados</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedInspetor.parceiros_nomes.map((nome, i) => (
                        <Badge key={i} variant="outline">{nome}</Badge>
                      ))}
                    </div>
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

export default GestaoInspetores;
