import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, Plus, Edit, Trash2, Building2, Mail, Phone, 
  FileText, Search, Filter, Fuel, Car, Shield
} from 'lucide-react';

const TIPOS_FORNECEDOR = [
  { value: 'geral', label: 'Geral', icon: Building2 },
  { value: 'oficina', label: 'Oficina/Mecânico', icon: Car },
  { value: 'seguro', label: 'Seguradora', icon: Shield },
  { value: 'combustivel', label: 'Combustível', icon: Fuel },
  { value: 'via_verde', label: 'Via Verde/Portagens', icon: FileText },
  { value: 'pneus', label: 'Pneus', icon: Car },
  { value: 'lavagem', label: 'Lavagem', icon: Car },
  { value: 'outros', label: 'Outros', icon: Building2 }
];

const FornecedoresPage = ({ user, onLogout }) => {
  const { parceiroId: urlParceiroId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [parceiro, setParceiro] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  
  // Use parceiroId from URL or user.id if user is a parceiro
  const parceiroId = urlParceiroId || (user?.role === 'parceiro' ? user.id : null);
  
  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    nif: '',
    email: '',
    telefone: '',
    tipo: 'geral',
    morada: '',
    notas: ''
  });

  useEffect(() => {
    if (parceiroId) {
      fetchData();
    }
  }, [parceiroId]);

  const fetchData = async () => {
    if (!parceiroId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch parceiro e fornecedores
      const [parceiroRes, fornecedoresRes] = await Promise.all([
        axios.get(`${API}/parceiros/${parceiroId}`, { headers }),
        axios.get(`${API}/parceiros/${parceiroId}/fornecedores`, { headers })
      ]);
      
      setParceiro(parceiroRes.data);
      setFornecedores(fornecedoresRes.data.fornecedores || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };


  const handleOpenDialog = (fornecedor = null) => {
    if (fornecedor) {
      setEditingFornecedor(fornecedor);
      setFormData({
        nome: fornecedor.nome || '',
        nif: fornecedor.nif || '',
        email: fornecedor.email || '',
        telefone: fornecedor.telefone || '',
        tipo: fornecedor.tipo || 'geral',
        morada: fornecedor.morada || '',
        notas: fornecedor.notas || ''
      });
    } else {
      setEditingFornecedor(null);
      setFormData({
        nome: '',
        nif: '',
        email: '',
        telefone: '',
        tipo: 'geral',
        morada: '',
        notas: ''
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      if (editingFornecedor) {
        // Atualizar
        await axios.put(
          `${API}/parceiros/${parceiroId}/fornecedores/${editingFornecedor.id}`,
          formData,
          { headers }
        );
        toast.success('Fornecedor atualizado');
      } else {
        // Criar
        await axios.post(
          `${API}/parceiros/${parceiroId}/fornecedores`,
          formData,
          { headers }
        );
        toast.success('Fornecedor adicionado');
      }
      
      setShowDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao guardar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fornecedorId) => {
    if (!confirm('Tem certeza que deseja remover este fornecedor?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/parceiros/${parceiroId}/fornecedores/${fornecedorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Fornecedor removido');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao remover fornecedor');
    }
  };

  const getTipoLabel = (tipo) => {
    const found = TIPOS_FORNECEDOR.find(t => t.value === tipo);
    return found ? found.label : tipo;
  };

  const getTipoBadgeColor = (tipo) => {
    const colors = {
      geral: 'bg-slate-100 text-slate-800',
      oficina: 'bg-blue-100 text-blue-800',
      seguro: 'bg-green-100 text-green-800',
      combustivel: 'bg-orange-100 text-orange-800',
      via_verde: 'bg-purple-100 text-purple-800',
      pneus: 'bg-cyan-100 text-cyan-800',
      lavagem: 'bg-pink-100 text-pink-800',
      outros: 'bg-gray-100 text-gray-800'
    };
    return colors[tipo] || colors.geral;
  };

  // Filtrar fornecedores
  const filteredFornecedores = fornecedores.filter(f => {
    const matchSearch = !searchTerm || 
      f.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.nif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchTipo = filterTipo === 'all' || f.tipo === filterTipo;
    
    return matchSearch && matchTipo;
  });

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="p-6 text-center">A carregar...</div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6" data-testid="fornecedores-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Fornecedores</h1>
            <p className="text-slate-500">
              {parceiro?.nome_empresa || parceiro?.name || 'Parceiro'}
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="btn-add-fornecedor">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Fornecedor
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Pesquisar por nome, NIF ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-48">
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {TIPOS_FORNECEDOR.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Fornecedores */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredFornecedores.length} Fornecedor(es)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFornecedores.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum fornecedor encontrado</p>
                <p className="text-sm mt-2">Clique em "Adicionar Fornecedor" para criar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{fornecedor.nome}</p>
                          {fornecedor.morada && (
                            <p className="text-xs text-slate-500">{fornecedor.morada}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTipoBadgeColor(fornecedor.tipo)}>
                          {getTipoLabel(fornecedor.tipo)}
                        </Badge>
                      </TableCell>
                      <TableCell>{fornecedor.nif || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {fornecedor.email && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Mail className="w-3 h-3" />
                              {fornecedor.email}
                            </div>
                          )}
                          {fornecedor.telefone && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Phone className="w-3 h-3" />
                              {fornecedor.telefone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(fornecedor)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(fornecedor.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog Adicionar/Editar */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Nome do fornecedor"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>NIF</Label>
                  <Input
                    value={formData.nif}
                    onChange={(e) => setFormData({...formData, nif: e.target.value})}
                    placeholder="Número de contribuinte"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(value) => setFormData({...formData, tipo: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_FORNECEDOR.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.telefone}
                    onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    placeholder="+351 912 345 678"
                  />
                </div>
              </div>
              
              <div>
                <Label>Morada</Label>
                <Input
                  value={formData.morada}
                  onChange={(e) => setFormData({...formData, morada: e.target.value})}
                  placeholder="Morada completa"
                />
              </div>
              
              <div>
                <Label>Notas</Label>
                <Textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  placeholder="Observações sobre o fornecedor"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default FornecedoresPage;
