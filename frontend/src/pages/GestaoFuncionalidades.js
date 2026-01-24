import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Users,
  Search,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Shield,
  Settings,
  MessageCircle,
  Mail,
  FileText,
  Car,
  Calendar,
  Bell,
  Tag,
  BarChart,
  DollarSign,
  User,
  FolderOpen,
  Cloud,
  Bot,
  Upload
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Mapeamento de ícones
const iconMap = {
  "📱": MessageCircle,
  "📧": Mail,
  "🔍": Search,
  "📄": FileText,
  "🤖": Bot,
  "📥": Upload,
  "📅": Calendar,
  "🔔": Bell,
  "🏷️": Tag,
  "📊": BarChart,
  "💰": DollarSign,
  "👤": User,
  "🚗": Car,
  "📁": FolderOpen,
  "☁️": Cloud
};

const GestaoFuncionalidades = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  
  const [funcionalidades, setFuncionalidades] = useState([]);
  const [categorias, setCategorias] = useState({});
  const [parceiros, setParceiros] = useState([]);
  const [permissoes, setPermissoes] = useState({});
  
  // Carregar dados
  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
      const [funcRes, parceirosRes] = await Promise.all([
        axios.get(`${API}/api/permissoes/funcionalidades`, { headers }),
        axios.get(`${API}/api/permissoes/admin/todos-parceiros`, { headers })
      ]);
      
      setFuncionalidades(funcRes.data.funcionalidades || []);
      setCategorias(funcRes.data.categorias || {});
      
      const permissoesObj = {};
      (parceirosRes.data || []).forEach(p => {
        permissoesObj[p.parceiro_id] = {
          nome: p.nome,
          email: p.email,
          funcionalidades: p.funcionalidades || []
        };
      });
      setPermissoes(permissoesObj);
      setParceiros(parceirosRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Toggle funcionalidade
  const toggleFuncionalidade = (parceiroId, funcId) => {
    setPermissoes(prev => {
      const current = prev[parceiroId]?.funcionalidades || [];
      const updated = current.includes(funcId)
        ? current.filter(id => id !== funcId)
        : [...current, funcId];
      
      return {
        ...prev,
        [parceiroId]: {
          ...prev[parceiroId],
          funcionalidades: updated
        }
      };
    });
  };
  
  // Seleccionar todas
  const selectAll = (parceiroId) => {
    setPermissoes(prev => ({
      ...prev,
      [parceiroId]: {
        ...prev[parceiroId],
        funcionalidades: funcionalidades.map(f => f.id)
      }
    }));
  };
  
  // Remover todas
  const clearAll = (parceiroId) => {
    setPermissoes(prev => ({
      ...prev,
      [parceiroId]: {
        ...prev[parceiroId],
        funcionalidades: []
      }
    }));
  };
  
  // Seleccionar por categoria
  const selectCategory = (parceiroId, categoria) => {
    const funcsDaCategoria = funcionalidades.filter(f => f.categoria === categoria).map(f => f.id);
    setPermissoes(prev => {
      const current = prev[parceiroId]?.funcionalidades || [];
      const jaTemTodas = funcsDaCategoria.every(f => current.includes(f));
      
      let updated;
      if (jaTemTodas) {
        // Remove todas da categoria
        updated = current.filter(f => !funcsDaCategoria.includes(f));
      } else {
        // Adiciona todas da categoria
        updated = [...new Set([...current, ...funcsDaCategoria])];
      }
      
      return {
        ...prev,
        [parceiroId]: {
          ...prev[parceiroId],
          funcionalidades: updated
        }
      };
    });
  };
  
  // Guardar
  const savePermissoes = async (parceiroId) => {
    setSaving(parceiroId);
    const token = localStorage.getItem('token');
    
    try {
      await axios.put(
        `${API}/api/permissoes/parceiro/${parceiroId}`,
        { funcionalidades: permissoes[parceiroId]?.funcionalidades || [] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Permissões guardadas!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar');
    } finally {
      setSaving(null);
    }
  };
  
  // Agrupar funcionalidades por categoria
  const funcsPorCategoria = funcionalidades.reduce((acc, f) => {
    if (!acc[f.categoria]) acc[f.categoria] = [];
    acc[f.categoria].push(f);
    return acc;
  }, {});
  
  // Filtrar parceiros
  const filteredParceiros = parceiros.filter(p => 
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'admin') {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="p-6 text-center">
          <Shield className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h1 className="text-xl font-bold text-red-600">Acesso Negado</h1>
          <p className="text-slate-500">Apenas administradores.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestão de Funcionalidades</h1>
              <p className="text-slate-500">Configure quais funcionalidades cada parceiro pode usar</p>
            </div>
          </div>
        </div>

        {/* Legenda de Categorias */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Categorias de Funcionalidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categorias).map(([key, cat]) => (
                <Badge key={key} variant="outline" className={`bg-${cat.cor}-50 text-${cat.cor}-700 border-${cat.cor}-200`}>
                  {cat.nome} ({funcsPorCategoria[key]?.length || 0})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Pesquisar parceiro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lista de Parceiros */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredParceiros.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum parceiro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredParceiros.map(parceiro => (
              <Card key={parceiro.parceiro_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{parceiro.nome}</CardTitle>
                      <CardDescription>{parceiro.email}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={permissoes[parceiro.parceiro_id]?.funcionalidades?.length > 0 ? 'default' : 'secondary'}>
                        {permissoes[parceiro.parceiro_id]?.funcionalidades?.length || 0} / {funcionalidades.length}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => savePermissoes(parceiro.parceiro_id)}
                        disabled={saving === parceiro.parceiro_id}
                      >
                        {saving === parceiro.parceiro_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Botões rápidos */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Button variant="outline" size="sm" onClick={() => selectAll(parceiro.parceiro_id)}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Todas
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => clearAll(parceiro.parceiro_id)}>
                      <XCircle className="w-3 h-3 mr-1" />
                      Nenhuma
                    </Button>
                    <span className="text-slate-300">|</span>
                    {Object.entries(categorias).map(([key, cat]) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => selectCategory(parceiro.parceiro_id, key)}
                      >
                        {cat.nome}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Funcionalidades agrupadas por categoria */}
                  <div className="space-y-4">
                    {Object.entries(funcsPorCategoria).map(([categoria, funcs]) => (
                      <div key={categoria}>
                        <h4 className="text-sm font-medium text-slate-600 mb-2">
                          {categorias[categoria]?.nome || categoria}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                          {funcs.map(func => {
                            const isChecked = permissoes[parceiro.parceiro_id]?.funcionalidades?.includes(func.id) || false;
                            const IconComponent = iconMap[func.icone] || Settings;
                            
                            return (
                              <label
                                key={func.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${
                                  isChecked 
                                    ? 'bg-blue-50 border-blue-300 shadow-sm' 
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={func.descricao}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleFuncionalidade(parceiro.parceiro_id, func.id)}
                                />
                                <IconComponent className={`w-4 h-4 ${isChecked ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className={`truncate ${isChecked ? 'font-medium' : ''}`}>{func.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GestaoFuncionalidades;
