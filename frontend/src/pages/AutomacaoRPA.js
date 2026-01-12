import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  ArrowLeft, Bot, Play, Pause, RefreshCw, Clock, CheckCircle, 
  AlertCircle, Settings, Calendar, FileText, Download, Upload,
  Car, Users, Loader2, History, Zap, Shield, Plus, Edit, Trash2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API = process.env.REACT_APP_BACKEND_URL;

const AutomacaoRPA = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [showModal, setShowModal] = useState(false);
  const [editingAutomacao, setEditingAutomacao] = useState(null);
  const [formAutomacao, setFormAutomacao] = useState({
    nome: '',
    descricao: '',
    icone: 'custom',
    frequencia: 'diario',
    ativo: false
  });
  
  // Estado das automações
  const [automacoes, setAutomacoes] = useState([
    {
      id: 'sync_uber',
      nome: 'Sincronização Uber',
      descricao: 'Importar automaticamente relatórios de ganhos da Uber',
      icone: 'uber',
      ativo: false,
      frequencia: 'diario',
      ultima_execucao: null,
      proxima_execucao: null,
      status: 'parado',
      sistema: true
    },
    {
      id: 'sync_bolt',
      nome: 'Sincronização Bolt',
      descricao: 'Importar automaticamente relatórios de ganhos da Bolt',
      icone: 'bolt',
      ativo: false,
      frequencia: 'diario',
      ultima_execucao: null,
      proxima_execucao: null,
      status: 'parado',
      sistema: true
    },
    {
      id: 'sync_viaverde',
      nome: 'Sincronização Via Verde',
      descricao: 'Importar automaticamente extrato de portagens Via Verde',
      icone: 'viaverde',
      ativo: false,
      frequencia: 'semanal',
      ultima_execucao: null,
      proxima_execucao: null,
      status: 'parado',
      sistema: true
    },
    {
      id: 'envio_relatorios',
      nome: 'Envio Relatórios Semanais',
      descricao: 'Enviar automaticamente relatórios semanais aos motoristas',
      icone: 'email',
      ativo: false,
      frequencia: 'semanal',
      ultima_execucao: null,
      proxima_execucao: null,
      status: 'parado',
      sistema: true
    },
    {
      id: 'alertas_documentos',
      nome: 'Alertas de Documentos',
      descricao: 'Verificar e enviar alertas de documentos a expirar',
      icone: 'documento',
      ativo: false,
      frequencia: 'diario',
      ultima_execucao: null,
      proxima_execucao: null,
      status: 'parado',
      sistema: true
    }
  ]);
  
  // Histórico de execuções
  const [historico, setHistorico] = useState([]);
  
  // Configurações globais
  const [configRPA, setConfigRPA] = useState({
    horario_execucao: '06:00',
    dias_semana: ['seg', 'ter', 'qua', 'qui', 'sex'],
    notificar_erros: true,
    email_notificacoes: ''
  });

  useEffect(() => {
    // Verificar se é admin
    if (user?.role !== 'admin') {
      toast.error('Acesso restrito a administradores');
      navigate('/');
      return;
    }
    fetchDados();
  }, [user, navigate]);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Buscar estado das automações
      try {
        const response = await axios.get(`${API}/api/automacao/status`, { headers });
        if (response.data?.automacoes) {
          setAutomacoes(prev => prev.map(a => {
            const serverState = response.data.automacoes.find(s => s.id === a.id);
            return serverState ? { ...a, ...serverState } : a;
          }));
        }
        if (response.data?.config) {
          setConfigRPA(prev => ({ ...prev, ...response.data.config }));
        }
      } catch (e) {
        // Ignorar se endpoint não existir ainda
      }
      
      // Buscar histórico
      try {
        const histResponse = await axios.get(`${API}/api/automacao/historico`, { headers });
        setHistorico(histResponse.data || []);
      } catch (e) {
        // Ignorar se endpoint não existir ainda
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomacao = async (automacaoId, novoEstado) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/automacao/${automacaoId}/toggle`,
        { ativo: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAutomacoes(prev => prev.map(a => 
        a.id === automacaoId 
          ? { ...a, ativo: novoEstado, status: novoEstado ? 'ativo' : 'parado' } 
          : a
      ));
      
      toast.success(novoEstado ? 'Automação ativada!' : 'Automação desativada');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao alterar automação');
    }
  };

  const executarManualmente = async (automacaoId) => {
    try {
      const token = localStorage.getItem('token');
      setAutomacoes(prev => prev.map(a => 
        a.id === automacaoId ? { ...a, status: 'executando' } : a
      ));
      
      toast.info('Iniciando execução manual...');
      
      const response = await axios.post(
        `${API}/api/automacao/${automacaoId}/executar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data?.message || 'Execução concluída!');
      fetchDados();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro na execução');
      setAutomacoes(prev => prev.map(a => 
        a.id === automacaoId ? { ...a, status: a.ativo ? 'ativo' : 'parado' } : a
      ));
    }
  };

  const getIconeAutomacao = (icone) => {
    switch (icone) {
      case 'uber':
        return <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center"><span className="text-white font-bold">U</span></div>;
      case 'bolt':
        return <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center"><span className="text-white font-bold">B</span></div>;
      case 'viaverde':
        return <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-xs">VV</span></div>;
      case 'email':
        return <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-white" /></div>;
      case 'documento':
        return <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center"><AlertCircle className="w-5 h-5 text-white" /></div>;
      default:
        return <div className="w-10 h-10 bg-slate-500 rounded-lg flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
      case 'executando':
        return <Badge className="bg-blue-100 text-blue-700 animate-pulse">A executar...</Badge>;
      case 'erro':
        return <Badge className="bg-red-100 text-red-700">Erro</Badge>;
      default:
        return <Badge variant="secondary">Parado</Badge>;
    }
  };

  if (user?.role !== 'admin') {
    return null;
  }

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
                <Bot className="w-6 h-6" />
                Automação RPA
              </h1>
              <p className="text-sm text-slate-500">Gestão de processos automatizados</p>
            </div>
          </div>
          <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Apenas Admin
          </Badge>
        </div>

        {/* Aviso de funcionalidade em desenvolvimento */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Funcionalidade em Desenvolvimento</p>
                <p className="text-sm text-amber-700">
                  O sistema de automação RPA está em fase de implementação. 
                  As funcionalidades serão ativadas progressivamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="visao-geral" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Tab Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-4">
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Automações Ativas</p>
                      <p className="text-2xl font-bold text-green-600">
                        {automacoes.filter(a => a.ativo).length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Automações</p>
                      <p className="text-2xl font-bold text-slate-700">
                        {automacoes.length}
                      </p>
                    </div>
                    <Bot className="w-8 h-8 text-slate-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Execuções Hoje</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {historico.filter(h => {
                          const hoje = new Date().toISOString().split('T')[0];
                          return h.data?.startsWith(hoje);
                        }).length}
                      </p>
                    </div>
                    <RefreshCw className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Erros (7 dias)</p>
                      <p className="text-2xl font-bold text-red-600">
                        {historico.filter(h => h.status === 'erro').length}
                      </p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Automações */}
            <Card>
              <CardHeader>
                <CardTitle>Automações Disponíveis</CardTitle>
                <CardDescription>Gerir sincronizações automáticas de dados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automacoes.map((automacao) => (
                    <div 
                      key={automacao.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getIconeAutomacao(automacao.icone)}
                        <div>
                          <h3 className="font-medium">{automacao.nome}</h3>
                          <p className="text-sm text-slate-500">{automacao.descricao}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(automacao.status)}
                            <span className="text-xs text-slate-400">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {automacao.frequencia === 'diario' ? 'Diário' : 'Semanal'}
                            </span>
                            {automacao.ultima_execucao && (
                              <span className="text-xs text-slate-400">
                                Última: {new Date(automacao.ultima_execucao).toLocaleString('pt-PT')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => executarManualmente(automacao.id)}
                          disabled={automacao.status === 'executando'}
                        >
                          {automacao.status === 'executando' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Switch
                          checked={automacao.ativo}
                          onCheckedChange={(checked) => toggleAutomacao(automacao.id, checked)}
                          disabled={automacao.status === 'executando'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
                <CardDescription>Últimas 50 execuções de automações</CardDescription>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma execução registada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Automação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">
                            {new Date(item.data).toLocaleString('pt-PT')}
                          </TableCell>
                          <TableCell>{item.automacao}</TableCell>
                          <TableCell>
                            {item.status === 'sucesso' ? (
                              <Badge className="bg-green-100 text-green-700">Sucesso</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">Erro</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {item.duracao || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                            {item.detalhes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Configurações */}
          <TabsContent value="configuracoes">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Globais</CardTitle>
                <CardDescription>Definições gerais das automações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Horário de Execução</Label>
                    <Input
                      type="time"
                      value={configRPA.horario_execucao}
                      onChange={(e) => setConfigRPA(prev => ({ ...prev, horario_execucao: e.target.value }))}
                    />
                    <p className="text-xs text-slate-500">
                      Hora preferencial para executar automações diárias
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email para Notificações</Label>
                    <Input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={configRPA.email_notificacoes}
                      onChange={(e) => setConfigRPA(prev => ({ ...prev, email_notificacoes: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={configRPA.notificar_erros}
                    onCheckedChange={(checked) => setConfigRPA(prev => ({ ...prev, notificar_erros: checked }))}
                  />
                  <Label>Notificar por email em caso de erros</Label>
                </div>

                <Button disabled className="mt-4">
                  <Settings className="w-4 h-4 mr-2" />
                  Guardar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AutomacaoRPA;
