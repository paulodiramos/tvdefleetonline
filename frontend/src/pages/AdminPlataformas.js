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
import BrowserVirtualEmbutido from '@/components/admin/BrowserVirtualEmbutido';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Settings,
  Car,
  MapPin,
  Fuel,
  Zap,
  Search,
  Download,
  RefreshCw,
  Globe,
  MoreVertical,
  Bot,
  Upload,
  Code,
  Key,
  FileSpreadsheet,
  ChevronRight,
  Play,
  PlayCircle,
  StopCircle,
  Monitor,
  Eye,
  Save,
  X,
  GripVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIAS = [
  { id: 'plataforma', nome: 'Plataformas TVDE', icon: Car, cor: 'bg-blue-500' },
  { id: 'gps', nome: 'GPS / Tracking', icon: MapPin, cor: 'bg-green-500' },
  { id: 'portagens', nome: 'Portagens', icon: Globe, cor: 'bg-purple-500' },
  { id: 'abastecimento', nome: 'Abastecimento', icon: Fuel, cor: 'bg-orange-500' },
];

const METODOS_INTEGRACAO = [
  { id: 'rpa', nome: 'RPA (Automação)', icon: Bot, descricao: 'Automação com browser' },
  { id: 'api', nome: 'API', icon: Code, descricao: 'Integração via API' },
  { id: 'upload_manual', nome: 'Upload Manual', icon: Upload, descricao: 'Upload de ficheiro' },
];

const TIPOS_LOGIN = [
  { id: 'manual', nome: 'Login Manual', descricao: 'Parceiro faz login' },
  { id: 'automatico', nome: 'Login Automático', descricao: 'Sistema faz login' },
];

const SUBCATEGORIAS_ABASTECIMENTO = [
  { id: 'fossil', nome: 'Combustível Fóssil' },
  { id: 'eletrico', nome: 'Elétrico' },
  { id: 'ambos', nome: 'Ambos' },
];

const TIPOS_PASSO_RPA = [
  { value: 'goto', label: 'Navegar URL', icon: '🌐', descricao: 'Abrir uma página web' },
  { value: 'click', label: 'Clicar', icon: '🖱️', descricao: 'Clicar num elemento' },
  { value: 'type', label: 'Escrever Texto', icon: '⌨️', descricao: 'Escrever texto fixo' },
  { value: 'fill_credential', label: 'Preencher Credencial', icon: '🔐', descricao: 'Usar credencial do parceiro' },
  { value: 'fill_date_start', label: '📅 Data Início', icon: '📅', descricao: 'Data início do período (dinâmica)', isDate: true },
  { value: 'fill_date_end', label: '📅 Data Fim', icon: '📅', descricao: 'Data fim do período (dinâmica)', isDate: true },
  { value: 'select', label: 'Selecionar Opção', icon: '📋', descricao: 'Escolher opção num dropdown' },
  { value: 'wait', label: 'Esperar (ms)', icon: '⏳', descricao: 'Pausa em milissegundos' },
  { value: 'wait_selector', label: 'Esperar Elemento', icon: '👁️', descricao: 'Esperar elemento aparecer' },
  { value: 'press', label: 'Pressionar Tecla', icon: '⏎', descricao: 'Pressionar tecla (Enter, Tab, etc)' },
  { value: 'download', label: 'Download', icon: '📥', descricao: 'Aguardar download de ficheiro' },
  { value: 'screenshot', label: 'Screenshot', icon: '📸', descricao: 'Capturar ecrã (debug)' },
];

const CAMPOS_CREDENCIAIS_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'cartao_frota', label: 'Cartão Frota' },
  { value: 'api_key', label: 'API Key' },
  { value: 'account_id', label: 'Account ID' },
  { value: 'codigo_cliente', label: 'Código Cliente' },
];

const AdminPlataformas = ({ user, onLogout }) => {
  const [plataformas, setPlataformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlataforma, setEditingPlataforma] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [camposDestino, setCamposDestino] = useState([]);
  const [showBrowserEmbutido, setShowBrowserEmbutido] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    icone: '🔗',
    descricao: '',
    categoria: '',
    subcategoria_abastecimento: null,
    url_base: '',
    url_login: '',
    metodo_integracao: 'upload_manual',
    tipo_login: 'automatico',
    requer_2fa: false,
    tipo_2fa: '',
    campos_credenciais: ['email', 'password'],
    ativo: true,
    // RPA
    passos_login: [],
    passos_extracao: [],
    // Importação
    config_importacao: {
      tipo_ficheiro: 'xlsx',
      linha_cabecalho: 1,
      linha_inicio_dados: 2,
      encoding: 'utf-8',
      separador_csv: ';',
      mapeamento_campos: []
    }
  });

  const fetchPlataformas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/plataformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlataformas(response.data);
    } catch (error) {
      console.error('Error fetching plataformas:', error);
      toast.error('Erro ao carregar plataformas');
    } finally {
      setLoading(false);
    }
  };

  const fetchCamposDestino = async (categoria) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/plataformas/campos-destino/${categoria}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCamposDestino(response.data);
    } catch (error) {
      console.error('Error fetching campos:', error);
      setCamposDestino([]);
    }
  };

  useEffect(() => {
    fetchPlataformas();
  }, []);

  useEffect(() => {
    if (formData.categoria) {
      fetchCamposDestino(formData.categoria);
    }
  }, [formData.categoria]);

  const handleSeedPlataformas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/plataformas/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.mensagem);
      fetchPlataformas();
    } catch (error) {
      console.error('Error seeding:', error);
      toast.error('Erro ao criar plataformas padrão');
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.categoria) {
      toast.error('Nome e categoria são obrigatórios');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (editingPlataforma) {
        await axios.put(`${API}/plataformas/${editingPlataforma.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plataforma atualizada');
      } else {
        await axios.post(`${API}/plataformas`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Plataforma criada');
      }

      setShowDialog(false);
      resetForm();
      fetchPlataformas();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar plataforma');
    }
  };

  const handleSaveRPA = async () => {
    if (!editingPlataforma) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/plataformas/${editingPlataforma.id}/rpa`, {
        passos_login: formData.passos_login,
        passos_extracao: formData.passos_extracao
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuração RPA guardada');
    } catch (error) {
      console.error('Error saving RPA:', error);
      toast.error('Erro ao guardar RPA');
    }
  };

  const handleSaveImportacao = async () => {
    if (!editingPlataforma) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/plataformas/${editingPlataforma.id}/importacao`, formData.config_importacao, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuração de importação guardada');
    } catch (error) {
      console.error('Error saving importacao:', error);
      toast.error('Erro ao guardar configuração');
    }
  };

  const handleEdit = (plataforma) => {
    setEditingPlataforma(plataforma);
    setActiveTab('info');
    setFormData({
      nome: plataforma.nome,
      icone: plataforma.icone || '🔗',
      descricao: plataforma.descricao || '',
      categoria: plataforma.categoria,
      subcategoria_abastecimento: plataforma.subcategoria_abastecimento || null,
      url_base: plataforma.url_base || '',
      url_login: plataforma.url_login || '',
      metodo_integracao: plataforma.metodo_integracao || 'upload_manual',
      tipo_login: plataforma.tipo_login || 'automatico',
      requer_2fa: plataforma.requer_2fa || false,
      tipo_2fa: plataforma.tipo_2fa || '',
      campos_credenciais: plataforma.campos_credenciais || ['email', 'password'],
      ativo: plataforma.ativo,
      passos_login: plataforma.passos_login || [],
      passos_extracao: plataforma.passos_extracao || [],
      config_importacao: plataforma.config_importacao || {
        tipo_ficheiro: 'xlsx',
        linha_cabecalho: 1,
        linha_inicio_dados: 2,
        encoding: 'utf-8',
        separador_csv: ';',
        mapeamento_campos: []
      }
    });
    if (plataforma.categoria) {
      fetchCamposDestino(plataforma.categoria);
    }
    setShowDialog(true);
  };

  const handleDelete = async (plataforma) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar "${plataforma.nome}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/plataformas/${plataforma.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plataforma eliminada');
      fetchPlataformas();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao eliminar plataforma');
    }
  };

  const resetForm = () => {
    setEditingPlataforma(null);
    setActiveTab('info');
    setFormData({
      nome: '',
      icone: '🔗',
      descricao: '',
      categoria: '',
      subcategoria_abastecimento: null,
      url_base: '',
      url_login: '',
      metodo_integracao: 'upload_manual',
      tipo_login: 'automatico',
      requer_2fa: false,
      tipo_2fa: '',
      campos_credenciais: ['email', 'password'],
      ativo: true,
      passos_login: [],
      passos_extracao: [],
      config_importacao: {
        tipo_ficheiro: 'xlsx',
        linha_cabecalho: 1,
        linha_inicio_dados: 2,
        encoding: 'utf-8',
        separador_csv: ';',
        mapeamento_campos: []
      }
    });
  };

  // Funções para passos RPA
  const addPasso = (tipo) => {
    const field = tipo === 'login' ? 'passos_login' : 'passos_extracao';
    const novoPasso = {
      ordem: formData[field].length + 1,
      tipo: 'click',
      descricao: '',
      seletor: '',
      seletor_tipo: 'css',
      valor: '',
      campo_credencial: '',
      timeout: 5000
    };
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], novoPasso]
    }));
  };

  const updatePasso = (tipo, index, field, value) => {
    const fieldName = tipo === 'login' ? 'passos_login' : 'passos_extracao';
    setFormData(prev => {
      const passos = [...prev[fieldName]];
      passos[index] = { ...passos[index], [field]: value };
      return { ...prev, [fieldName]: passos };
    });
  };

  const removePasso = (tipo, index) => {
    const field = tipo === 'login' ? 'passos_login' : 'passos_extracao';
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index).map((p, i) => ({ ...p, ordem: i + 1 }))
    }));
  };

  // Funções para mapeamento de campos
  const addCampoMapeamento = () => {
    setFormData(prev => ({
      ...prev,
      config_importacao: {
        ...prev.config_importacao,
        mapeamento_campos: [
          ...prev.config_importacao.mapeamento_campos,
          { campo_sistema: '', coluna_ficheiro: '', tipo_dados: 'texto', obrigatorio: false }
        ]
      }
    }));
  };

  const updateCampoMapeamento = (index, field, value) => {
    setFormData(prev => {
      const mapeamento = [...prev.config_importacao.mapeamento_campos];
      mapeamento[index] = { ...mapeamento[index], [field]: value };
      return {
        ...prev,
        config_importacao: { ...prev.config_importacao, mapeamento_campos: mapeamento }
      };
    });
  };

  const removeCampoMapeamento = (index) => {
    setFormData(prev => ({
      ...prev,
      config_importacao: {
        ...prev.config_importacao,
        mapeamento_campos: prev.config_importacao.mapeamento_campos.filter((_, i) => i !== index)
      }
    }));
  };

  const getCategoriaInfo = (categoriaId) => {
    return CATEGORIAS.find(c => c.id === categoriaId) || CATEGORIAS[0];
  };

  const getMetodoInfo = (metodoId) => {
    return METODOS_INTEGRACAO.find(m => m.id === metodoId) || METODOS_INTEGRACAO[0];
  };

  const filteredPlataformas = plataformas.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (p.descricao || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategoria = categoriaFiltro === 'todos' || p.categoria === categoriaFiltro;
    return matchesSearch && matchesCategoria;
  });

  const plataformasByCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    count: plataformas.filter(p => p.categoria === cat.id).length
  }));

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="admin-plataformas-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Gestão de Plataformas</h1>
              <p className="text-slate-600">Configurar integrações, RPA e importação de dados</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {plataformas.length === 0 && (
              <Button variant="outline" onClick={handleSeedPlataformas} data-testid="seed-btn">
                <Download className="w-4 h-4 mr-2" />
                Criar Padrão
              </Button>
            )}
            <Button onClick={() => { resetForm(); setShowDialog(true); }} data-testid="new-plataforma-btn">
              <Plus className="w-4 h-4 mr-2" />
              Nova Plataforma
            </Button>
          </div>
        </div>

        {/* Stats Cards by Category */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {plataformasByCategoria.map(cat => {
            const Icon = cat.icon;
            return (
              <Card 
                key={cat.id} 
                className={`cursor-pointer transition-all ${categoriaFiltro === cat.id ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setCategoriaFiltro(categoriaFiltro === cat.id ? 'todos' : cat.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${cat.cor} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">{cat.nome}</p>
                      <p className="text-2xl font-bold">{cat.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Pesquisar plataformas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchPlataformas}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {categoriaFiltro !== 'todos' && (
            <Button variant="ghost" size="sm" onClick={() => setCategoriaFiltro('todos')}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Plataformas Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Plataformas Configuradas
              {categoriaFiltro !== 'todos' && (
                <Badge variant="secondary" className="ml-2">
                  {getCategoriaInfo(categoriaFiltro).nome}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {filteredPlataformas.length} plataforma(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">A carregar...</div>
            ) : filteredPlataformas.length === 0 ? (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">Nenhuma plataforma configurada</p>
                <p className="text-slate-400 text-sm mt-2">
                  {plataformas.length === 0 
                    ? 'Clique em "Criar Padrão" para adicionar plataformas comuns'
                    : 'Ajuste os filtros ou adicione uma nova plataforma'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlataformas.map((plataforma) => {
                    const catInfo = getCategoriaInfo(plataforma.categoria);
                    const metodoInfo = getMetodoInfo(plataforma.metodo_integracao);
                    const CatIcon = catInfo.icon;
                    const MetodoIcon = metodoInfo.icon;
                    return (
                      <TableRow key={plataforma.id} data-testid={`plataforma-row-${plataforma.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{plataforma.icone}</span>
                            <div>
                              <p className="font-medium">{plataforma.nome}</p>
                              {plataforma.descricao && (
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {plataforma.descricao}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${catInfo.cor} rounded flex items-center justify-center`}>
                              <CatIcon className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-sm">{catInfo.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MetodoIcon className="w-4 h-4 text-slate-500" />
                            <span className="text-sm">{metodoInfo.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={plataforma.tipo_login === 'manual' ? 'secondary' : 'outline'}>
                            {plataforma.tipo_login === 'manual' ? 'Manual' : 'Auto'}
                          </Badge>
                          {plataforma.requer_2fa && (
                            <Badge variant="destructive" className="ml-1">2FA</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plataforma.ativo ? 'default' : 'secondary'}>
                            {plataforma.ativo ? 'Ativo' : 'Inativo'}
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
                              <DropdownMenuItem onClick={() => handleEdit(plataforma)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(plataforma)}
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

        {/* Dialog de Edição */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{formData.icone}</span>
                {editingPlataforma ? `Editar: ${editingPlataforma.nome}` : 'Nova Plataforma'}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Informação</TabsTrigger>
                <TabsTrigger value="credenciais">Credenciais</TabsTrigger>
                <TabsTrigger value="rpa" disabled={formData.metodo_integracao !== 'rpa'}>
                  Automação RPA
                </TabsTrigger>
                <TabsTrigger value="importacao">Importação</TabsTrigger>
                <TabsTrigger value="testar" disabled={!editingPlataforma || formData.metodo_integracao !== 'rpa'}>
                  <PlayCircle className="w-4 h-4 mr-1" />
                  Testar
                </TabsTrigger>
              </TabsList>

              {/* Tab: Informação Básica */}
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      placeholder="Ex: Uber"
                      data-testid="plataforma-nome-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icone">Ícone</Label>
                    <Input
                      id="icone"
                      value={formData.icone}
                      onChange={(e) => setFormData({...formData, icone: e.target.value})}
                      placeholder="🔗"
                      className="text-center text-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria *</Label>
                    <Select 
                      value={formData.categoria} 
                      onValueChange={(v) => setFormData({...formData, categoria: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.categoria === 'abastecimento' && (
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <Select 
                      value={formData.subcategoria_abastecimento || ''} 
                      onValueChange={(v) => setFormData({...formData, subcategoria_abastecimento: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar tipo de abastecimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBCATEGORIAS_ABASTECIMENTO.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Breve descrição da plataforma"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="url_base">URL Base</Label>
                    <Input
                      id="url_base"
                      value={formData.url_base}
                      onChange={(e) => setFormData({...formData, url_base: e.target.value})}
                      placeholder="https://www.exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url_login">URL Login</Label>
                    <Input
                      id="url_login"
                      value={formData.url_login}
                      onChange={(e) => setFormData({...formData, url_login: e.target.value})}
                      placeholder="https://login.exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Método de Integração</Label>
                    <Select 
                      value={formData.metodo_integracao} 
                      onValueChange={(v) => setFormData({...formData, metodo_integracao: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METODOS_INTEGRACAO.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <m.icon className="w-4 h-4" />
                              {m.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Login</Label>
                    <Select 
                      value={formData.tipo_login} 
                      onValueChange={(v) => setFormData({...formData, tipo_login: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_LOGIN.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requer_2fa"
                      checked={formData.requer_2fa}
                      onCheckedChange={(checked) => setFormData({...formData, requer_2fa: checked})}
                    />
                    <Label htmlFor="requer_2fa">Requer 2FA</Label>
                  </div>
                  {formData.requer_2fa && (
                    <div className="flex items-center gap-2">
                      <Label>Tipo:</Label>
                      <Select 
                        value={formData.tipo_2fa} 
                        onValueChange={(v) => setFormData({...formData, tipo_2fa: v})}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="app">App</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                    />
                    <Label htmlFor="ativo">Ativo</Label>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Campos Credenciais */}
              <TabsContent value="credenciais" className="space-y-4 pt-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Campos de Credenciais do Parceiro
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Selecione quais campos o parceiro deve preencher para esta plataforma
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CAMPOS_CREDENCIAIS_OPTIONS.map(campo => (
                      <Badge
                        key={campo.value}
                        variant={formData.campos_credenciais.includes(campo.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          const newCampos = formData.campos_credenciais.includes(campo.value)
                            ? formData.campos_credenciais.filter(c => c !== campo.value)
                            : [...formData.campos_credenciais, campo.value];
                          setFormData({...formData, campos_credenciais: newCampos});
                        }}
                      >
                        {campo.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Automação RPA */}
              <TabsContent value="rpa" className="space-y-4 pt-4">
                {formData.metodo_integracao !== 'rpa' ? (
                  <div className="text-center py-8 text-slate-500">
                    <Bot className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Configuração RPA só disponível quando o método de integração é "RPA"</p>
                  </div>
                ) : (
                  <>
                    {/* Legenda */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800 font-medium mb-2">🎯 Tipos de Passos:</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline" className="bg-white">🌐 URL</Badge>
                        <Badge variant="outline" className="bg-white">🖱️ Clique</Badge>
                        <Badge variant="outline" className="bg-white">🔐 Credencial</Badge>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">📅 Data Dinâmica</Badge>
                        <Badge variant="outline" className="bg-white">⏳ Espera</Badge>
                        <Badge variant="outline" className="bg-white">📥 Download</Badge>
                      </div>
                    </div>

                    {/* Passos de Login */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            Passos de Login
                          </CardTitle>
                          <Button size="sm" variant="outline" onClick={() => addPasso('login')}>
                            <Plus className="w-4 h-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {formData.passos_login.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">
                            Nenhum passo de login configurado
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {formData.passos_login.map((passo, index) => {
                              const tipoInfo = TIPOS_PASSO_RPA.find(t => t.value === passo.tipo) || {};
                              const isDateField = tipoInfo.isDate;
                              return (
                                <div key={index} className={`flex items-center gap-2 p-2 rounded border ${isDateField ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-transparent'}`}>
                                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                                  <span className="w-6 text-center text-sm font-medium text-slate-600">{passo.ordem}</span>
                                  <Select 
                                    value={passo.tipo} 
                                    onValueChange={(v) => updatePasso('login', index, 'tipo', v)}
                                  >
                                    <SelectTrigger className={`w-44 ${isDateField ? 'border-amber-300 bg-amber-100' : ''}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIPOS_PASSO_RPA.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                          <div className="flex items-center gap-2">
                                            <span>{t.icon}</span>
                                            <span>{t.label}</span>
                                            {t.isDate && <Badge className="bg-amber-500 text-xs ml-1">Data</Badge>}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {/* Campo Seletor */}
                                  {!['wait', 'download', 'screenshot'].includes(passo.tipo) && (
                                    <Input 
                                      placeholder={passo.tipo === 'goto' ? 'URL' : 'Seletor CSS/XPath'}
                                      value={passo.seletor || ''}
                                      onChange={(e) => updatePasso('login', index, 'seletor', e.target.value)}
                                      className="flex-1"
                                    />
                                  )}
                                  {/* Selector de Credencial */}
                                  {passo.tipo === 'fill_credential' && (
                                    <Select 
                                      value={passo.campo_credencial || ''} 
                                      onValueChange={(v) => updatePasso('login', index, 'campo_credencial', v)}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Campo" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {formData.campos_credenciais.map(c => (
                                          <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {/* Campo Valor para URL e Texto */}
                                  {(passo.tipo === 'type' || passo.tipo === 'goto') && (
                                    <Input 
                                      placeholder="Valor"
                                      value={passo.valor || ''}
                                      onChange={(e) => updatePasso('login', index, 'valor', e.target.value)}
                                      className="w-40"
                                    />
                                  )}
                                  {/* Timeout para Wait */}
                                  {passo.tipo === 'wait' && (
                                    <Input 
                                      type="number"
                                      placeholder="ms"
                                      value={passo.timeout || 5000}
                                      onChange={(e) => updatePasso('login', index, 'timeout', parseInt(e.target.value))}
                                      className="w-24"
                                    />
                                  )}
                                  {/* Indicador de Data Dinâmica */}
                                  {isDateField && (
                                    <Badge className="bg-amber-500">📅</Badge>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => removePasso('login', index)}>
                                    <X className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Passos de Extração */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Passos de Extração de Dados
                            <Badge variant="secondary" className="ml-2">
                              Use 📅 Data Início/Fim para datas dinâmicas
                            </Badge>
                          </CardTitle>
                          <Button size="sm" variant="outline" onClick={() => addPasso('extracao')}>
                            <Plus className="w-4 h-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {formData.passos_extracao.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">
                            Nenhum passo de extração configurado
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {formData.passos_extracao.map((passo, index) => {
                              const tipoInfo = TIPOS_PASSO_RPA.find(t => t.value === passo.tipo) || {};
                              const isDateField = tipoInfo.isDate || passo.tipo === 'fill_date_start' || passo.tipo === 'fill_date_end';
                              return (
                                <div key={index} className={`flex items-center gap-2 p-2 rounded border ${isDateField ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-transparent'}`}>
                                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                                  <span className="w-6 text-center text-sm font-medium text-slate-600">{passo.ordem}</span>
                                  <Select 
                                    value={passo.tipo} 
                                    onValueChange={(v) => updatePasso('extracao', index, 'tipo', v)}
                                  >
                                    <SelectTrigger className={`w-44 ${isDateField ? 'border-amber-400 bg-amber-100 font-medium' : ''}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIPOS_PASSO_RPA.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                          <div className="flex items-center gap-2">
                                            <span>{t.icon}</span>
                                            <span>{t.label}</span>
                                            {t.isDate && <Badge className="bg-amber-500 text-xs ml-1">Dinâmico</Badge>}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {/* Campo Seletor - sempre mostrar para datas */}
                                  {(isDateField || !['wait', 'download', 'screenshot'].includes(passo.tipo)) && (
                                    <Input 
                                      placeholder={isDateField ? 'Seletor do campo de data' : (passo.tipo === 'goto' ? 'URL' : 'Seletor CSS/XPath')}
                                      value={passo.seletor || ''}
                                      onChange={(e) => updatePasso('extracao', index, 'seletor', e.target.value)}
                                      className={`flex-1 ${isDateField ? 'border-amber-300' : ''}`}
                                    />
                                  )}
                                  {/* Campo Valor para URL e Texto */}
                                  {(passo.tipo === 'type' || passo.tipo === 'goto') && (
                                    <Input 
                                      placeholder="Valor"
                                      value={passo.valor || ''}
                                      onChange={(e) => updatePasso('extracao', index, 'valor', e.target.value)}
                                      className="w-40"
                                    />
                                  )}
                                  {/* Timeout para Wait */}
                                  {passo.tipo === 'wait' && (
                                    <Input 
                                      type="number"
                                      placeholder="ms"
                                      value={passo.timeout || 5000}
                                      onChange={(e) => updatePasso('extracao', index, 'timeout', parseInt(e.target.value))}
                                      className="w-24"
                                    />
                                  )}
                                  {/* Indicador visual de Data Dinâmica */}
                                  {isDateField && (
                                    <div className="flex items-center gap-1">
                                      <Badge className="bg-amber-500 text-white">
                                        {passo.tipo === 'fill_date_start' ? '📅 Início' : passo.tipo === 'fill_date_end' ? '📅 Fim' : '📅 Data'}
                                      </Badge>
                                    </div>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => removePasso('extracao', index)}>
                                    <X className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveRPA} disabled={!editingPlataforma}>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Configuração RPA
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Tab: Importação */}
              <TabsContent value="importacao" className="space-y-4 pt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Configuração do Ficheiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo Ficheiro</Label>
                        <Select 
                          value={formData.config_importacao.tipo_ficheiro} 
                          onValueChange={(v) => setFormData({
                            ...formData,
                            config_importacao: {...formData.config_importacao, tipo_ficheiro: v}
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                            <SelectItem value="xls">Excel (.xls)</SelectItem>
                            <SelectItem value="csv">CSV (.csv)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Linha Cabeçalho</Label>
                        <Input 
                          type="number"
                          value={formData.config_importacao.linha_cabecalho}
                          onChange={(e) => setFormData({
                            ...formData,
                            config_importacao: {...formData.config_importacao, linha_cabecalho: parseInt(e.target.value)}
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Linha Início Dados</Label>
                        <Input 
                          type="number"
                          value={formData.config_importacao.linha_inicio_dados}
                          onChange={(e) => setFormData({
                            ...formData,
                            config_importacao: {...formData.config_importacao, linha_inicio_dados: parseInt(e.target.value)}
                          })}
                        />
                      </div>
                      {formData.config_importacao.tipo_ficheiro === 'csv' && (
                        <div className="space-y-2">
                          <Label>Separador CSV</Label>
                          <Select 
                            value={formData.config_importacao.separador_csv} 
                            onValueChange={(v) => setFormData({
                              ...formData,
                              config_importacao: {...formData.config_importacao, separador_csv: v}
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value=";">Ponto e Vírgula (;)</SelectItem>
                              <SelectItem value=",">Vírgula (,)</SelectItem>
                              <SelectItem value="\t">Tab</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Mapeamento de Campos</CardTitle>
                      <Button size="sm" variant="outline" onClick={addCampoMapeamento}>
                        <Plus className="w-4 h-4 mr-1" /> Adicionar Campo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {formData.config_importacao.mapeamento_campos.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Nenhum mapeamento configurado. Adicione campos para mapear colunas do ficheiro.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-2 text-xs font-medium text-slate-500 px-2">
                          <span>Campo Sistema</span>
                          <span>Coluna Ficheiro</span>
                          <span>Tipo Dados</span>
                          <span>Obrigatório</span>
                          <span></span>
                        </div>
                        {formData.config_importacao.mapeamento_campos.map((campo, index) => (
                          <div key={index} className="grid grid-cols-5 gap-2 items-center p-2 bg-slate-50 rounded">
                            <Select 
                              value={campo.campo_sistema} 
                              onValueChange={(v) => updateCampoMapeamento(index, 'campo_sistema', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {camposDestino.map(c => (
                                  <SelectItem key={c.campo} value={c.campo}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input 
                              placeholder="Nome da coluna"
                              value={campo.coluna_ficheiro}
                              onChange={(e) => updateCampoMapeamento(index, 'coluna_ficheiro', e.target.value)}
                            />
                            <Select 
                              value={campo.tipo_dados} 
                              onValueChange={(v) => updateCampoMapeamento(index, 'tipo_dados', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="texto">Texto</SelectItem>
                                <SelectItem value="numero">Número</SelectItem>
                                <SelectItem value="data">Data</SelectItem>
                                <SelectItem value="moeda">Moeda</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex justify-center">
                              <Switch 
                                checked={campo.obrigatorio}
                                onCheckedChange={(v) => updateCampoMapeamento(index, 'obrigatorio', v)}
                              />
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => removeCampoMapeamento(index)}>
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSaveImportacao} disabled={!editingPlataforma}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configuração Importação
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Testar RPA */}
              <TabsContent value="testar" className="space-y-4 pt-4">
                {!editingPlataforma ? (
                  <div className="text-center py-8 text-slate-500">
                    <Monitor className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Guarde a plataforma primeiro para poder testar</p>
                  </div>
                ) : showBrowserEmbutido ? (
                  /* Browser Virtual Embutido */
                  <div className="h-[600px] -mx-6 -mb-6">
                    <BrowserVirtualEmbutido
                      plataformaId={editingPlataforma.id}
                      plataformaNome={editingPlataforma.nome}
                      urlInicial={formData.url_login || formData.url_base}
                      onPassosGravados={(passos, tipo) => {
                        // Actualizar os passos no formData
                        if (tipo === 'login') {
                          setFormData(prev => ({ ...prev, passos_login: passos }));
                        } else {
                          setFormData(prev => ({ ...prev, passos_extracao: passos }));
                        }
                        // Recarregar plataforma
                        fetchPlataformas();
                      }}
                      onClose={() => setShowBrowserEmbutido(false)}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Browser Virtual para RPA
                      </h3>
                      <p className="text-sm text-blue-700">
                        Use o browser virtual embutido para gravar e testar passos de automação.
                        Os passos gravados serão guardados directamente na configuração da plataforma.
                      </p>
                    </div>

                    {/* Resumo da Configuração */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Resumo da Configuração</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Passos de Login:</span>
                            <span className="ml-2 font-medium">{formData.passos_login.length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Passos de Extração:</span>
                            <span className="ml-2 font-medium">{formData.passos_extracao.length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Tipo de Login:</span>
                            <Badge variant="outline" className="ml-2">
                              {formData.tipo_login === 'manual' ? '👤 Manual' : '🤖 Automático'}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-slate-500">2FA:</span>
                            <Badge variant={formData.requer_2fa ? 'destructive' : 'secondary'} className="ml-2">
                              {formData.requer_2fa ? `Sim (${formData.tipo_2fa})` : 'Não'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Opções de Browser */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Browser Embutido */}
                      <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setShowBrowserEmbutido(true)}>
                        <CardContent className="py-6">
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                              <Monitor className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="font-medium mb-1">Browser Embutido</h3>
                            <p className="text-slate-500 text-sm">
                              Usar browser virtual aqui mesmo
                            </p>
                            <Button className="mt-4" data-testid="open-browser-embutido-btn">
                              <PlayCircle className="w-4 h-4 mr-2" />
                              Iniciar Browser
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* RPA Designer Externo */}
                      <Card className="border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors cursor-pointer" onClick={() => window.open(`/rpa-designer?plataforma=${editingPlataforma?.id}`, '_blank')}>
                        <CardContent className="py-6">
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                              <Eye className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="font-medium mb-1">RPA Designer</h3>
                            <p className="text-slate-500 text-sm">
                              Abrir em nova janela
                            </p>
                            <Button variant="outline" className="mt-4">
                              <Globe className="w-4 h-4 mr-2" />
                              Abrir Designer
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Link directo para URL de Login */}
                    {formData.url_login && (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <Globe className="w-5 h-5 text-slate-500" />
                        <span className="text-sm text-slate-600">URL de Login:</span>
                        <a 
                          href={formData.url_login} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex-1 truncate"
                        >
                          {formData.url_login}
                        </a>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(formData.url_login, '_blank')}
                        >
                          Abrir
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} data-testid="save-plataforma-btn">
                {editingPlataforma ? 'Guardar Alterações' : 'Criar Plataforma'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminPlataformas;
