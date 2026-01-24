import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Users,
  Settings,
  Search,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Shield
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const GestaoPermissoesParceiros = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // parceiro_id being saved
  const [searchTerm, setSearchTerm] = useState('');
  
  const [plataformas, setPlataformas] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [permissoes, setPermissoes] = useState({}); // {parceiro_id: [plataforma_ids]}
  
  // Carregar dados
  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
      const [plataformasRes, permissoesRes] = await Promise.all([
        axios.get(`${API}/api/rpa-auto/plataformas`, { headers }),
        axios.get(`${API}/api/rpa-auto/admin/parceiros-plataformas`, { headers })
      ]);
      
      setPlataformas(plataformasRes.data || []);
      
      // Converter lista em objeto para fácil acesso
      const permissoesObj = {};
      (permissoesRes.data || []).forEach(p => {
        permissoesObj[p.parceiro_id] = {
          nome: p.nome,
          email: p.email,
          plataformas: p.plataformas_permitidas || []
        };
      });
      setPermissoes(permissoesObj);
      setParceiros(permissoesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Toggle plataforma para um parceiro
  const togglePlataforma = (parceiroId, plataformaId) => {
    setPermissoes(prev => {
      const current = prev[parceiroId]?.plataformas || [];
      const updated = current.includes(plataformaId)
        ? current.filter(id => id !== plataformaId)
        : [...current, plataformaId];
      
      return {
        ...prev,
        [parceiroId]: {
          ...prev[parceiroId],
          plataformas: updated
        }
      };
    });
  };
  
  // Seleccionar todas para um parceiro
  const selectAll = (parceiroId) => {
    setPermissoes(prev => ({
      ...prev,
      [parceiroId]: {
        ...prev[parceiroId],
        plataformas: plataformas.map(p => p.id)
      }
    }));
  };
  
  // Remover todas para um parceiro
  const clearAll = (parceiroId) => {
    setPermissoes(prev => ({
      ...prev,
      [parceiroId]: {
        ...prev[parceiroId],
        plataformas: []
      }
    }));
  };
  
  // Guardar permissões de um parceiro
  const savePermissoes = async (parceiroId) => {
    setSaving(parceiroId);
    const token = localStorage.getItem('token');
    
    try {
      await axios.put(
        `${API}/api/parceiro-plataformas/${parceiroId}`,
        permissoes[parceiroId]?.plataformas || [],
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Permissões guardadas!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar');
    } finally {
      setSaving(null);
    }
  };
  
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
          <p className="text-slate-500">Apenas administradores podem aceder a esta página.</p>
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/rpa-automacao')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Permissões de Plataformas</h1>
              <p className="text-slate-500">Configure quais plataformas cada parceiro pode usar</p>
            </div>
          </div>
        </div>

        {/* Plataformas disponíveis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plataformas Disponíveis ({plataformas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {plataformas.map(p => (
                <Badge key={p.id} variant="outline" className="text-sm">
                  {p.icone} {p.nome}
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
                      <CardTitle className="text-lg">{parceiro.nome || 'Sem nome'}</CardTitle>
                      <CardDescription>{parceiro.email}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={permissoes[parceiro.parceiro_id]?.plataformas?.length > 0 ? 'default' : 'secondary'}>
                        {permissoes[parceiro.parceiro_id]?.plataformas?.length || 0} plataformas
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
                  <div className="flex items-center gap-2 mb-3">
                    <Button variant="outline" size="sm" onClick={() => selectAll(parceiro.parceiro_id)}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Todas
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => clearAll(parceiro.parceiro_id)}>
                      <XCircle className="w-3 h-3 mr-1" />
                      Nenhuma
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {plataformas.map(plat => {
                      const isChecked = permissoes[parceiro.parceiro_id]?.plataformas?.includes(plat.id) || false;
                      return (
                        <label
                          key={plat.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => togglePlataforma(parceiro.parceiro_id, plat.id)}
                          />
                          <span className="text-lg">{plat.icone}</span>
                          <span className="text-sm font-medium truncate">{plat.nome}</span>
                        </label>
                      );
                    })}
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

export default GestaoPermissoesParceiros;
