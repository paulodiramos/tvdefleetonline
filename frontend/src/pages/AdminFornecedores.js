import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2,
  Fuel,
  Zap,
  MapPin,
  Shield,
  Wrench,
  Search,
  Download,
  RefreshCw,
  Globe,
  Mail,
  Phone,
  MoreVertical,
  Car
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIPOS_FORNECEDOR = [
  { id: 'combustivel_fossil', nome: 'Combustível Fóssil', icon: Fuel, cor: 'bg-orange-500' },
  { id: 'combustivel_eletrico', nome: 'Combustível Elétrico', icon: Zap, cor: 'bg-green-500' },
  { id: 'gps', nome: 'GPS/Tracking', icon: MapPin, cor: 'bg-blue-500' },
  { id: 'seguros', nome: 'Seguros', icon: Shield, cor: 'bg-purple-500' },
  { id: 'manutencao', nome: 'Manutenção', icon: Wrench, cor: 'bg-yellow-500' },
  { id: 'lavagem', nome: 'Lavagem', icon: Car, cor: 'bg-cyan-500' },
  { id: 'pneus', nome: 'Pneus', icon: Car, cor: 'bg-slate-500' },
  { id: 'outros', nome: 'Outros', icon: Building2, cor: 'bg-gray-500' },
];

const AdminFornecedores = ({ user, onLogout }) => {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [showDialog, setShowDialog] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    descricao: '',
    contacto_email: '',
    contacto_telefone: '',
    website: '',
    ativo: true
  });

  const fetchFornecedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/fornecedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFornecedores(response.data);
    } catch (error) {
      console.error('Error fetching fornecedores:', error);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFornecedores();
  }, []);

  const handleSeedFornecedores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/seed-fornecedores`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchFornecedores();
    } catch (error) {
      console.error('Error seeding:', error);
      toast.error('Erro ao criar fornecedores padrão');
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.tipo) {
      toast.error('Nome e tipo são obrigatórios');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (editingFornecedor) {
        await axios.put(`${API}/fornecedores/${editingFornecedor.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Fornecedor atualizado');
      } else {
        await axios.post(`${API}/fornecedores`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Fornecedor criado');
      }

      setShowDialog(false);
      resetForm();
      fetchFornecedores();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao guardar fornecedor');
    }
  };

  const handleEdit = (fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome: fornecedor.nome,
      tipo: fornecedor.tipo,
      descricao: fornecedor.descricao || '',
      contacto_email: fornecedor.contacto_email || '',
      contacto_telefone: fornecedor.contacto_telefone || '',
      website: fornecedor.website || '',
      ativo: fornecedor.ativo
    });
    setShowDialog(true);
  };

  const handleDelete = async (fornecedor) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar "${fornecedor.nome}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/fornecedores/${fornecedor.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Fornecedor eliminado');
      fetchFornecedores();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao eliminar fornecedor');
    }
  };

  const resetForm = () => {
    setEditingFornecedor(null);
    setFormData({
      nome: '',
      tipo: '',
      descricao: '',
      contacto_email: '',
      contacto_telefone: '',
      website: '',
      ativo: true
    });
  };

  const getTipoInfo = (tipoId) => {
    return TIPOS_FORNECEDOR.find(t => t.id === tipoId) || TIPOS_FORNECEDOR[TIPOS_FORNECEDOR.length - 1];
  };

  const filteredFornecedores = fornecedores.filter(f => {
    const matchesSearch = f.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (f.descricao || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTipo = tipoFiltro === 'todos' || f.tipo === tipoFiltro;
    return matchesSearch && matchesTipo;
  });

  const fornecedoresByTipo = TIPOS_FORNECEDOR.map(tipo => ({
    ...tipo,
    count: fornecedores.filter(f => f.tipo === tipo.id).length
  }));

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="admin-fornecedores-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Gestão de Fornecedores</h1>
              <p className="text-slate-600">Gerir fornecedores de combustível, GPS, seguros e outros</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {fornecedores.length === 0 && (
              <Button variant="outline" onClick={handleSeedFornecedores} data-testid="seed-btn">
                <Download className="w-4 h-4 mr-2" />
                Criar Padrão
              </Button>
            )}
            <Dialog open={showDialog} onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="new-fornecedor-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        placeholder="Ex: Galp"
                        data-testid="fornecedor-nome-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo *</Label>
                      <Select 
                        value={formData.tipo} 
                        onValueChange={(v) => setFormData({...formData, tipo: v})}
                      >
                        <SelectTrigger data-testid="fornecedor-tipo-select">
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_FORNECEDOR.map(tipo => (
                            <SelectItem key={tipo.id} value={tipo.id}>
                              {tipo.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                      placeholder="Breve descrição do fornecedor"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email de Contacto</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.contacto_email}
                        onChange={(e) => setFormData({...formData, contacto_email: e.target.value})}
                        placeholder="contacto@empresa.pt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.contacto_telefone}
                        onChange={(e) => setFormData({...formData, contacto_telefone: e.target.value})}
                        placeholder="+351 XXX XXX XXX"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      placeholder="https://www.empresa.pt"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                    />
                    <Label htmlFor="ativo">Fornecedor ativo</Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} data-testid="save-fornecedor-btn">
                      {editingFornecedor ? 'Guardar Alterações' : 'Criar Fornecedor'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards by Type */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {fornecedoresByTipo.map(tipo => {
            const Icon = tipo.icon;
            return (
              <Card 
                key={tipo.id} 
                className={`cursor-pointer transition-all ${tipoFiltro === tipo.id ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setTipoFiltro(tipoFiltro === tipo.id ? 'todos' : tipo.id)}
              >
                <CardContent className="p-3 text-center">
                  <div className={`w-10 h-10 ${tipo.cor} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs text-slate-600 truncate">{tipo.nome}</p>
                  <p className="text-lg font-bold">{tipo.count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Pesquisar fornecedores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchFornecedores}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {tipoFiltro !== 'todos' && (
            <Button variant="ghost" size="sm" onClick={() => setTipoFiltro('todos')}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Fornecedores Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Fornecedores 
              {tipoFiltro !== 'todos' && (
                <Badge variant="secondary" className="ml-2">
                  {getTipoInfo(tipoFiltro).nome}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {filteredFornecedores.length} fornecedor(es) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">A carregar...</div>
            ) : filteredFornecedores.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">Nenhum fornecedor encontrado</p>
                <p className="text-slate-400 text-sm mt-2">
                  {fornecedores.length === 0 
                    ? 'Clique em "Criar Padrão" para adicionar fornecedores comuns'
                    : 'Ajuste os filtros ou adicione um novo fornecedor'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornecedores.map((fornecedor) => {
                    const tipoInfo = getTipoInfo(fornecedor.tipo);
                    const TipoIcon = tipoInfo.icon;
                    return (
                      <TableRow key={fornecedor.id} data-testid={`fornecedor-row-${fornecedor.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${tipoInfo.cor} rounded-lg flex items-center justify-center`}>
                              <TipoIcon className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{fornecedor.nome}</p>
                              {fornecedor.descricao && (
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {fornecedor.descricao}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tipoInfo.nome}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {fornecedor.contacto_email && (
                              <a href={`mailto:${fornecedor.contacto_email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                                <Mail className="w-3 h-3" />
                                {fornecedor.contacto_email}
                              </a>
                            )}
                            {fornecedor.contacto_telefone && (
                              <a href={`tel:${fornecedor.contacto_telefone}`} className="flex items-center gap-1 text-sm text-slate-600">
                                <Phone className="w-3 h-3" />
                                {fornecedor.contacto_telefone}
                              </a>
                            )}
                            {!fornecedor.contacto_email && !fornecedor.contacto_telefone && (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {fornecedor.website ? (
                            <a 
                              href={fornecedor.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              <Globe className="w-3 h-3" />
                              Visitar
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={fornecedor.ativo ? 'default' : 'secondary'}>
                            {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(fornecedor)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(fornecedor)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminFornecedores;
