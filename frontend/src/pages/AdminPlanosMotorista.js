import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ArrowLeft, Package, Eye, Receipt, FileText, Crown, Check, Edit, 
  Plus, Trash2, Loader2, Users, Euro, Settings, Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Categorias de planos de motorista
const CATEGORIAS_MOTORISTA = [
  {
    id: 'basico',
    nome: 'Básico',
    descricao: 'Apenas consulta de ganhos',
    cor: 'slate',
    icone: Eye,
    modulos: ['consulta_ganhos'],
    features_base: [
      'Consulta de ganhos semanais',
      'Visualização de resumo financeiro',
      'Acesso ao dashboard básico'
    ]
  },
  {
    id: 'standard',
    nome: 'Standard',
    descricao: 'Consulta + Envio de recibos',
    cor: 'blue',
    icone: Receipt,
    modulos: ['consulta_ganhos', 'envio_recibos'],
    features_base: [
      'Consulta de ganhos semanais',
      'Visualização de resumo financeiro',
      'Acesso ao dashboard básico',
      'Envio de recibos verdes',
      'Histórico de recibos enviados'
    ]
  },
  {
    id: 'premium',
    nome: 'Premium',
    descricao: 'Tudo incluído + Autofaturação',
    cor: 'amber',
    icone: Crown,
    modulos: ['consulta_ganhos', 'envio_recibos', 'relatorios', 'autofaturacao'],
    features_base: [
      'Consulta de ganhos semanais',
      'Visualização de resumo financeiro',
      'Dashboard completo',
      'Envio de recibos verdes',
      'Histórico de recibos enviados',
      'Relatórios detalhados em PDF',
      'Autofaturação automática',
      'Suporte prioritário'
    ]
  }
];

const AdminPlanosMotorista = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [activeTab, setActiveTab] = useState('planos');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  
  // Estatísticas
  const [stats, setStats] = useState({
    total_motoristas: 0,
    por_plano: {}
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Acesso restrito a administradores');
      navigate('/');
      return;
    }
    fetchPlanos();
    fetchStats();
  }, [user, navigate]);

  const fetchPlanos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Usar endpoint específico para admin
      const response = await axios.get(`${API}/api/admin/planos-motorista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      // Se não houver planos, criar os padrão
      if (error.response?.status === 404 || (Array.isArray(error.response?.data) && error.response.data.length === 0)) {
        await criarPlanosDefault();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/planos-motorista/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data || { total_motoristas: 0, por_plano: {} });
    } catch (error) {
      // Stats endpoint pode não existir ainda
    }
  };

  const criarPlanosDefault = async () => {
    try {
      const token = localStorage.getItem('token');
      for (const cat of CATEGORIAS_MOTORISTA) {
        await axios.post(`${API}/api/admin/planos`, {
          nome: cat.nome,
          descricao: cat.descricao,
          tipo_usuario: 'motorista',
          categoria: cat.id,
          features: cat.features_base,
          modulos: cat.modulos,
          preco_mensal: cat.id === 'basico' ? 0 : (cat.id === 'standard' ? 9.99 : 19.99),
          preco_semanal: cat.id === 'basico' ? 0 : (cat.id === 'standard' ? 2.99 : 5.99),
          ativo: true,
          ordem: CATEGORIAS_MOTORISTA.indexOf(cat) + 1,
          cor: cat.cor,
          icone: cat.id === 'basico' ? 'eye' : (cat.id === 'standard' ? 'receipt' : 'crown')
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchPlanos();
      toast.success('Planos padrão criados!');
    } catch (error) {
      console.error('Erro ao criar planos:', error);
    }
  };

  const handleEditPlano = (plano) => {
    setEditingPlano({
      ...plano,
      features: plano.features || [],
      preco_mensal: plano.preco_mensal || 0,
      preco_semanal: plano.preco_semanal || 0
    });
    setShowEditModal(true);
  };

  const handleSavePlano = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.put(`${API}/api/planos/${editingPlano.id}`, {
        nome: editingPlano.nome,
        descricao: editingPlano.descricao,
        features: editingPlano.features,
        preco_mensal: parseFloat(editingPlano.preco_mensal) || 0,
        preco_semanal: parseFloat(editingPlano.preco_semanal) || 0,
        ativo: editingPlano.ativo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Plano atualizado!');
      setShowEditModal(false);
      fetchPlanos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar plano');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePlano = async (planoId, ativo) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/planos/${planoId}`, { ativo }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPlanos(prev => prev.map(p => 
        p.id === planoId ? { ...p, ativo } : p
      ));
      toast.success(ativo ? 'Plano ativado!' : 'Plano desativado');
    } catch (error) {
      toast.error('Erro ao alterar estado do plano');
    }
  };

  const getCategoriaInfo = (categoria) => {
    return CATEGORIAS_MOTORISTA.find(c => c.id === categoria) || CATEGORIAS_MOTORISTA[0];
  };

  const getCorClasse = (cor) => {
    const cores = {
      slate: 'bg-slate-100 border-slate-300 text-slate-700',
      blue: 'bg-blue-100 border-blue-300 text-blue-700',
      amber: 'bg-amber-100 border-amber-300 text-amber-700',
      green: 'bg-green-100 border-green-300 text-green-700'
    };
    return cores[cor] || cores.slate;
  };

  if (user?.role !== 'admin') return null;

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-6 h-6" />
                Planos de Motorista
              </h1>
              <p className="text-sm text-slate-500">Gerir os 3 planos disponíveis para motoristas</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Categorias
            </TabsTrigger>
          </TabsList>

          {/* Tab Planos */}
          <TabsContent value="planos" className="space-y-4">
            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Motoristas</p>
                      <p className="text-2xl font-bold text-slate-700">{stats.total_motoristas}</p>
                    </div>
                    <Users className="w-8 h-8 text-slate-200" />
                  </div>
                </CardContent>
              </Card>
              {CATEGORIAS_MOTORISTA.map(cat => (
                <Card key={cat.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Plano {cat.nome}</p>
                        <p className="text-2xl font-bold" style={{ color: cat.cor === 'amber' ? '#d97706' : (cat.cor === 'blue' ? '#2563eb' : '#475569') }}>
                          {stats.por_plano?.[cat.id] || 0}
                        </p>
                      </div>
                      <cat.icone className="w-8 h-8 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Cards de Planos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planos.length === 0 ? (
                <Card className="md:col-span-3">
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 mb-4">Nenhum plano configurado</p>
                    <Button onClick={criarPlanosDefault}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Planos Padrão
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                planos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(plano => {
                  const catInfo = getCategoriaInfo(plano.categoria);
                  const IconComponent = catInfo.icone;
                  
                  return (
                    <Card 
                      key={plano.id}
                      className={`relative overflow-hidden ${!plano.ativo ? 'opacity-60' : ''}`}
                    >
                      {plano.categoria === 'premium' && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                          <Star className="w-3 h-3 inline mr-1" />
                          Popular
                        </div>
                      )}
                      <CardHeader className={`${getCorClasse(catInfo.cor)} border-b`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              catInfo.cor === 'amber' ? 'bg-amber-500' : 
                              catInfo.cor === 'blue' ? 'bg-blue-500' : 'bg-slate-500'
                            }`}>
                              <IconComponent className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <CardTitle>{plano.nome}</CardTitle>
                              <CardDescription className="text-inherit opacity-80">
                                {plano.descricao}
                              </CardDescription>
                            </div>
                          </div>
                          <Switch
                            checked={plano.ativo}
                            onCheckedChange={(checked) => handleTogglePlano(plano.id, checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">€{plano.preco_mensal || 0}</span>
                          <span className="text-slate-500">/mês</span>
                        </div>
                        {plano.preco_semanal > 0 && (
                          <p className="text-sm text-slate-500">ou €{plano.preco_semanal}/semana</p>
                        )}
                        
                        <ul className="space-y-2">
                          {(plano.features || []).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter className="bg-slate-50 p-3">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => handleEditPlano(plano)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Plano
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Tab Categorias */}
          <TabsContent value="categorias">
            <Card>
              <CardHeader>
                <CardTitle>Categorias de Planos</CardTitle>
                <CardDescription>
                  Os planos de motorista estão organizados em 3 categorias fixas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {CATEGORIAS_MOTORISTA.map((cat, idx) => (
                    <div 
                      key={cat.id}
                      className={`p-4 border rounded-lg ${getCorClasse(cat.cor)}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          cat.cor === 'amber' ? 'bg-amber-500' : 
                          cat.cor === 'blue' ? 'bg-blue-500' : 'bg-slate-500'
                        }`}>
                          <cat.icone className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{cat.nome}</h3>
                            <Badge variant="outline">Nível {idx + 1}</Badge>
                          </div>
                          <p className="text-sm mb-3">{cat.descricao}</p>
                          
                          <div className="flex flex-wrap gap-2">
                            {cat.modulos.map(mod => (
                              <Badge key={mod} variant="secondary" className="text-xs">
                                {mod === 'consulta_ganhos' && 'Consulta Ganhos'}
                                {mod === 'envio_recibos' && 'Envio Recibos'}
                                {mod === 'relatorios' && 'Relatórios PDF'}
                                {mod === 'autofaturacao' && 'Autofaturação'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Nota:</strong> As categorias são fixas e definem os módulos disponíveis em cada plano. 
                    Pode personalizar os nomes, descrições e preços de cada plano na tab "Planos".
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Editar Plano */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>
              Personalizar detalhes do plano {editingPlano?.nome}
            </DialogDescription>
          </DialogHeader>
          
          {editingPlano && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input
                  value={editingPlano.nome}
                  onChange={(e) => setEditingPlano(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editingPlano.descricao}
                  onChange={(e) => setEditingPlano(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Mensal (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingPlano.preco_mensal}
                    onChange={(e) => setEditingPlano(prev => ({ ...prev, preco_mensal: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Semanal (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingPlano.preco_semanal}
                    onChange={(e) => setEditingPlano(prev => ({ ...prev, preco_semanal: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Funcionalidades (uma por linha)</Label>
                <Textarea
                  value={(editingPlano.features || []).join('\n')}
                  onChange={(e) => setEditingPlano(prev => ({ 
                    ...prev, 
                    features: e.target.value.split('\n').filter(f => f.trim()) 
                  }))}
                  rows={5}
                  placeholder="Consulta de ganhos semanais&#10;Visualização de resumo financeiro&#10;..."
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingPlano.ativo}
                  onCheckedChange={(checked) => setEditingPlano(prev => ({ ...prev, ativo: checked }))}
                />
                <Label>Plano ativo</Label>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlano} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminPlanosMotorista;
