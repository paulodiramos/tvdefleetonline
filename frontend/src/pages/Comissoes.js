import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  DollarSign, Users, Percent, Calculator, Plus, 
  Pencil, Trash2, Save, Search, Filter, TrendingUp,
  Settings, Clock, CheckCircle, XCircle, Euro
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const Comissoes = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [motoristas, setMotoristas] = useState([]);
  const [regrasComissao, setRegrasComissao] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [showNovaRegra, setShowNovaRegra] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Nova regra form
  const [novaRegra, setNovaRegra] = useState({
    nome: '',
    tipo: 'percentagem', // percentagem, valor_fixo, escalonado
    valor: 0,
    aplicar_a: 'todos', // todos, motorista_especifico, plataforma
    plataforma: '',
    motorista_id: '',
    ativo: true,
    condicoes: {
      min_viagens: 0,
      min_faturacao: 0
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Buscar motoristas
      const motoristasRes = await axios.get(`${API}/api/motoristas`, { headers });
      setMotoristas(motoristasRes.data || []);

      // Buscar regras de comissão
      try {
        const regrasRes = await axios.get(`${API}/api/comissoes/regras`, { headers });
        setRegrasComissao(regrasRes.data || []);
      } catch (e) {
        // API pode não existir ainda
        setRegrasComissao([]);
      }

      // Buscar histórico de comissões
      try {
        const historicoRes = await axios.get(`${API}/api/comissoes/historico`, { headers });
        setHistorico(historicoRes.data || []);
      } catch (e) {
        setHistorico([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarRegra = async () => {
    if (!novaRegra.nome || novaRegra.valor <= 0) {
      toast.error('Preencha o nome e valor da regra');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/api/comissoes/regras`,
        novaRegra,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Regra de comissão criada!');
      setShowNovaRegra(false);
      setNovaRegra({
        nome: '',
        tipo: 'percentagem',
        valor: 0,
        aplicar_a: 'todos',
        plataforma: '',
        motorista_id: '',
        ativo: true,
        condicoes: { min_viagens: 0, min_faturacao: 0 }
      });
      fetchData();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar regra');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRegra = async (regraId, ativo) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/api/comissoes/regras/${regraId}`,
        { ativo: !ativo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(ativo ? 'Regra desativada' : 'Regra ativada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleDeleteRegra = async (regraId) => {
    if (!confirm('Tem certeza que deseja eliminar esta regra?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/comissoes/regras/${regraId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Regra eliminada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao eliminar regra');
    }
  };

  const filteredMotoristas = useMemo(() => {
    return motoristas.filter(m => 
      m.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [motoristas, searchTerm]);

  // Estatísticas de comissões
  const stats = useMemo(() => {
    const totalComissoes = historico.reduce((acc, h) => acc + (h.valor_comissao || 0), 0);
    const mediaComissao = historico.length > 0 ? totalComissoes / historico.length : 0;
    const regrasAtivas = regrasComissao.filter(r => r.ativo).length;
    
    return {
      totalComissoes,
      mediaComissao,
      regrasAtivas,
      totalMotoristas: motoristas.length
    };
  }, [historico, regrasComissao, motoristas]);

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              Gestão de Comissões
            </h1>
            <p className="text-slate-600 mt-2">Configure regras e valores de comissões para motoristas</p>
          </div>
          <Button onClick={() => setShowNovaRegra(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Regra
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Total Comissões</p>
                  <p className="text-2xl font-bold text-emerald-700">€{stats.totalComissoes.toFixed(2)}</p>
                </div>
                <Euro className="w-10 h-10 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Média por Motorista</p>
                  <p className="text-2xl font-bold text-blue-700">€{stats.mediaComissao.toFixed(2)}</p>
                </div>
                <Calculator className="w-10 h-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Regras Ativas</p>
                  <p className="text-2xl font-bold text-purple-700">{stats.regrasAtivas}</p>
                </div>
                <Settings className="w-10 h-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Motoristas</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.totalMotoristas}</p>
                </div>
                <Users className="w-10 h-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="regras" className="space-y-4">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="regras" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800">
              <Settings className="w-4 h-4 mr-2" />
              Regras de Comissão
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
              <Users className="w-4 h-4 mr-2" />
              Por Motorista
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">
              <Clock className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab: Regras de Comissão */}
          <TabsContent value="regras" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Regras Configuradas</CardTitle>
                <CardDescription>Defina as regras de cálculo de comissões</CardDescription>
              </CardHeader>
              <CardContent>
                {regrasComissao.length === 0 ? (
                  <div className="text-center py-12">
                    <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Sem regras configuradas</h3>
                    <p className="text-slate-500 mb-4">Crie a primeira regra de comissão</p>
                    <Button onClick={() => setShowNovaRegra(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Regra
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regrasComissao.map((regra) => (
                      <div key={regra.id} className={`p-4 rounded-lg border ${regra.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${regra.ativo ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                              <Percent className={`w-5 h-5 ${regra.ativo ? 'text-emerald-600' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800">{regra.nome}</h4>
                              <p className="text-sm text-slate-500">
                                {regra.tipo === 'percentagem' ? `${regra.valor}%` : `€${regra.valor}`}
                                {' · '}
                                {regra.aplicar_a === 'todos' ? 'Todos os motoristas' : 
                                 regra.aplicar_a === 'plataforma' ? `Plataforma: ${regra.plataforma}` : 'Motorista específico'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={regra.ativo ? "default" : "secondary"}>
                              {regra.ativo ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <Switch 
                              checked={regra.ativo} 
                              onCheckedChange={() => handleToggleRegra(regra.id, regra.ativo)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRegra(regra.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Por Motorista */}
          <TabsContent value="motoristas" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Comissões por Motorista</CardTitle>
                    <CardDescription>Veja e configure comissões individuais</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Pesquisar motorista..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Comissão Atual</TableHead>
                      <TableHead>Total Acumulado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMotoristas.map((motorista) => (
                      <TableRow key={motorista.id}>
                        <TableCell className="font-medium">{motorista.nome}</TableCell>
                        <TableCell>{motorista.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{motorista.comissao_percentagem || 10}%</Badge>
                        </TableCell>
                        <TableCell className="text-emerald-600 font-semibold">
                          €{(motorista.total_comissoes || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedMotorista(motorista)}>
                            <Pencil className="w-4 h-4 mr-1" />
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Comissões</CardTitle>
                <CardDescription>Registo de todas as comissões calculadas</CardDescription>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Sem histórico</h3>
                    <p className="text-slate-500">As comissões calculadas aparecerão aqui</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Faturação</TableHead>
                        <TableHead>Comissão</TableHead>
                        <TableHead>Regra Aplicada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(item.data).toLocaleDateString('pt-PT')}</TableCell>
                          <TableCell>{item.motorista_nome}</TableCell>
                          <TableCell>€{(item.faturacao || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-emerald-600 font-semibold">€{(item.valor_comissao || 0).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{item.regra_nome || 'Padrão'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Nova Regra */}
        <Dialog open={showNovaRegra} onOpenChange={setShowNovaRegra}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-600" />
                Nova Regra de Comissão
              </DialogTitle>
              <DialogDescription>
                Configure uma nova regra para cálculo de comissões
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Regra</Label>
                <Input
                  placeholder="Ex: Comissão Base 10%"
                  value={novaRegra.nome}
                  onChange={(e) => setNovaRegra(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={novaRegra.tipo} 
                    onValueChange={(v) => setNovaRegra(prev => ({ ...prev, tipo: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentagem">Percentagem (%)</SelectItem>
                      <SelectItem value="valor_fixo">Valor Fixo (€)</SelectItem>
                      <SelectItem value="escalonado">Escalonado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novaRegra.valor}
                      onChange={(e) => setNovaRegra(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {novaRegra.tipo === 'percentagem' ? '%' : '€'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aplicar a</Label>
                <Select 
                  value={novaRegra.aplicar_a} 
                  onValueChange={(v) => setNovaRegra(prev => ({ ...prev, aplicar_a: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Motoristas</SelectItem>
                    <SelectItem value="plataforma">Por Plataforma</SelectItem>
                    <SelectItem value="motorista_especifico">Motorista Específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {novaRegra.aplicar_a === 'plataforma' && (
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select 
                    value={novaRegra.plataforma} 
                    onValueChange={(v) => setNovaRegra(prev => ({ ...prev, plataforma: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uber">Uber</SelectItem>
                      <SelectItem value="bolt">Bolt</SelectItem>
                      <SelectItem value="freenow">FreeNow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {novaRegra.aplicar_a === 'motorista_especifico' && (
                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <Select 
                    value={novaRegra.motorista_id} 
                    onValueChange={(v) => setNovaRegra(prev => ({ ...prev, motorista_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <Label className="cursor-pointer">Regra Ativa</Label>
                <Switch 
                  checked={novaRegra.ativo} 
                  onCheckedChange={(v) => setNovaRegra(prev => ({ ...prev, ativo: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovaRegra(false)}>Cancelar</Button>
              <Button onClick={handleSalvarRegra} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'A guardar...' : 'Criar Regra'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Comissoes;
