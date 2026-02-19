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
  Calculator, Plus, Search, Eye, Edit, Trash2, 
  Phone, Mail, Calendar, Building, Key, FileText, Users
} from 'lucide-react';

const GestaoContabilistas = ({ user, onLogout }) => {
  const [contabilistas, setContabilistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedContabilista, setSelectedContabilista] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    newPassword: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchContabilistas();
  }, []);

  const fetchContabilistas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contabilistas/lista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContabilistas(response.data.contabilistas || []);
    } catch (error) {
      console.error('Erro ao carregar contabilistas:', error);
      toast.error('Erro ao carregar contabilistas');
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
      await axios.post(`${API}/contabilistas/criar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contabilista criado com sucesso');
      setShowCreateDialog(false);
      setFormData({ name: '', email: '', phone: '', password: '' });
      fetchContabilistas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar contabilista');
    }
    setSubmitting(false);
  };

  const openEditDialog = (contabilista) => {
    setSelectedContabilista(contabilista);
    setEditData({
      name: contabilista.name || '',
      email: contabilista.email || '',
      phone: contabilista.phone || '',
      newPassword: ''
    });
    setShowEditDialog(true);
  };

  const handleEdit = async () => {
    if (!editData.name || !editData.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        name: editData.name,
        email: editData.email,
        phone: editData.phone
      };
      
      if (editData.newPassword && editData.newPassword.length >= 6) {
        updateData.password = editData.newPassword;
      }

      await axios.put(`${API}/contabilistas/${selectedContabilista.id}/editar`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contabilista atualizado com sucesso');
      setShowEditDialog(false);
      setEditData({ name: '', email: '', phone: '', newPassword: '' });
      fetchContabilistas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar contabilista');
    }
    setSubmitting(false);
  };

  const handleDelete = async (contabilista) => {
    if (!confirm(`Tem a certeza que deseja eliminar o contabilista "${contabilista.name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/contabilistas/${contabilista.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contabilista eliminado com sucesso');
      fetchContabilistas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao eliminar contabilista');
    }
  };

  const openDetailDialog = (contabilista) => {
    setSelectedContabilista(contabilista);
    setShowDetailDialog(true);
  };

  const filteredContabilistas = contabilistas.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="gestao-contabilistas-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-blue-600" />
              Gestão de Contabilistas
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Gerir contabilistas com acesso a faturas e recibos
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            data-testid="btn-novo-contabilista"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Contabilista
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Pesquisar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-contabilistas"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-slate-500">A carregar...</p>
          </div>
        ) : filteredContabilistas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Nenhum contabilista encontrado</h3>
              <p className="text-slate-500 mt-1">
                {searchTerm ? 'Tente outra pesquisa' : 'Crie o primeiro contabilista'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContabilistas.map((contabilista) => (
              <Card key={contabilista.id} className="hover:shadow-md transition-shadow" data-testid={`contabilista-card-${contabilista.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Calculator className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{contabilista.name}</h3>
                        <p className="text-sm text-slate-500">{contabilista.email}</p>
                      </div>
                    </div>
                    <Badge variant={contabilista.ativo !== false ? 'default' : 'secondary'}>
                      {contabilista.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  {/* Parceiros associados */}
                  {contabilista.parceiros_nomes && contabilista.parceiros_nomes.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <Building className="w-4 h-4" />
                      <span className="truncate">
                        {contabilista.parceiros_nomes.length === 1 
                          ? contabilista.parceiros_nomes[0]
                          : `${contabilista.parceiros_nomes.length} parceiros`}
                      </span>
                    </div>
                  )}

                  {contabilista.phone && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{contabilista.phone}</span>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openDetailDialog(contabilista)}
                      data-testid={`btn-ver-${contabilista.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openEditDialog(contabilista)}
                      data-testid={`btn-editar-${contabilista.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(contabilista)}
                      data-testid={`btn-eliminar-${contabilista.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog Criar */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Novo Contabilista
              </DialogTitle>
              <DialogDescription>
                Crie um novo contabilista com acesso a faturas e recibos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  data-testid="input-nome"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+351 912 345 678"
                  data-testid="input-telefone"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  data-testid="input-password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={submitting} data-testid="btn-guardar-contabilista">
                  {submitting ? 'A criar...' : 'Criar Contabilista'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Editar Contabilista
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-password">Nova Password (deixe vazio para manter)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editData.newPassword}
                  onChange={(e) => setEditData({ ...editData, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleEdit} disabled={submitting}>
                  {submitting ? 'A guardar...' : 'Guardar Alterações'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Detalhes */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Detalhes do Contabilista
              </DialogTitle>
            </DialogHeader>
            {selectedContabilista && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calculator className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedContabilista.name}</h3>
                    <p className="text-slate-500">{selectedContabilista.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-slate-500">Telefone</p>
                    <p className="font-medium">{selectedContabilista.phone || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Estado</p>
                    <Badge variant={selectedContabilista.ativo !== false ? 'default' : 'secondary'}>
                      {selectedContabilista.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Criado em</p>
                    <p className="font-medium">
                      {selectedContabilista.created_at 
                        ? new Date(selectedContabilista.created_at).toLocaleDateString('pt-PT')
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Parceiros</p>
                    <p className="font-medium">
                      {selectedContabilista.parceiros_nomes?.length || 0} associados
                    </p>
                  </div>
                </div>

                {selectedContabilista.parceiros_nomes && selectedContabilista.parceiros_nomes.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-slate-500 mb-2">Parceiros Associados</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedContabilista.parceiros_nomes.map((nome, idx) => (
                        <Badge key={idx} variant="outline">
                          <Building className="w-3 h-3 mr-1" />
                          {nome}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500 mb-2">Acesso</p>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Página de Contabilidade (Faturas e Recibos)</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default GestaoContabilistas;
