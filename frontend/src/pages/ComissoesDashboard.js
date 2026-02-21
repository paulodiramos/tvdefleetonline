import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  DollarSign, Users, TrendingUp, Settings, Euro, BarChart3,
  ArrowUpRight, ArrowDownRight, Calendar, Filter, RefreshCw,
  ChevronRight, PieChart
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ComissoesDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [motoristasData, setMotoristasData] = useState([]);
  const [periodo, setPeriodo] = useState('mensal');
  const [semanaAtual, setSemanaAtual] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  });
  const [anoAtual, setAnoAtual] = useState(() => new Date().getFullYear());
  const [mesAtual, setMesAtual] = useState(() => new Date().getMonth() + 1);

  useEffect(() => {
    fetchDashboardData();
  }, [periodo, semanaAtual, mesAtual, anoAtual]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch dashboard resumo
      const params = new URLSearchParams({
        periodo,
        ano: anoAtual,
        ...(periodo === 'semanal' ? { semana: semanaAtual } : {}),
        ...(periodo === 'mensal' ? { mes: mesAtual } : {})
      });

      const [resumoRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/api/comissoes/dashboard/resumo?${params}`, { headers }),
        axios.get(`${API}/api/comissoes/dashboard/por-motorista?semana=${semanaAtual}&ano=${anoAtual}`, { headers })
      ]);

      setDashboardData(resumoRes.data);
      setMotoristasData(motoristasRes.data.motoristas || []);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  const totais = dashboardData?.totais || {};
  const evolucao = dashboardData?.evolucao_semanal || [];
  const topMotoristas = dashboardData?.top_motoristas || [];

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="comissoes-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              Dashboard de Comissões
            </h1>
            <p className="text-slate-600 mt-2">Visualize as métricas de comissões da sua frota</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/config/comissoes')}
              data-testid="btn-config-comissoes"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Período:</span>
              </div>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-32" data-testid="select-periodo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
              
              {periodo === 'semanal' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Semana:</span>
                  <Select value={String(semanaAtual)} onValueChange={(v) => setSemanaAtual(Number(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 53 }, (_, i) => i + 1).map(s => (
                        <SelectItem key={s} value={String(s)}>S{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {periodo === 'mensal' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Mês:</span>
                  <Select value={String(mesAtual)} onValueChange={(v) => setMesAtual(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Ano:</span>
                <Select value={String(anoAtual)} onValueChange={(v) => setAnoAtual(Number(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" data-testid="card-total-comissoes">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Total Comissões</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totais.total_comissoes)}</p>
                  <p className="text-xs text-emerald-500 mt-1">{formatPercent(totais.percentagem_comissao)} dos ganhos</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Euro className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white" data-testid="card-total-ganhos">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Ganhos Totais</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(totais.total_ganhos)}</p>
                  <p className="text-xs text-blue-500 mt-1">{totais.total_relatorios || 0} relatórios</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white" data-testid="card-total-despesas">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Total Despesas</p>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(totais.total_despesas)}</p>
                  <p className="text-xs text-purple-500 mt-1">Combustível, Via Verde, etc.</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <ArrowDownRight className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white" data-testid="card-total-motoristas">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Motoristas</p>
                  <p className="text-2xl font-bold text-orange-700">{totais.total_motoristas || 0}</p>
                  <p className="text-xs text-orange-500 mt-1">Com dados no período</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Content */}
        <Tabs defaultValue="evolucao" className="space-y-4">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="evolucao" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800">
              <TrendingUp className="w-4 h-4 mr-2" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
              <Users className="w-4 h-4 mr-2" />
              Por Motorista
            </TabsTrigger>
            <TabsTrigger value="ranking" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">
              <PieChart className="w-4 h-4 mr-2" />
              Ranking
            </TabsTrigger>
          </TabsList>

          {/* Tab: Evolução Semanal */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Evolução Semanal
                </CardTitle>
                <CardDescription>Ganhos e comissões das últimas 8 semanas</CardDescription>
              </CardHeader>
              <CardContent>
                {evolucao.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Sem dados</h3>
                    <p className="text-slate-500">Não existem dados para o período selecionado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Simple bar chart representation */}
                    <div className="flex items-end justify-between gap-2 h-48 px-4">
                      {evolucao.map((item, idx) => {
                        const maxGanhos = Math.max(...evolucao.map(e => e.ganhos));
                        const heightPercent = maxGanhos > 0 ? (item.ganhos / maxGanhos) * 100 : 0;
                        
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1">
                            <div className="w-full flex flex-col items-center">
                              <span className="text-xs text-slate-500 mb-1">{formatCurrency(item.ganhos)}</span>
                              <div 
                                className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-300 hover:from-emerald-600 hover:to-emerald-500"
                                style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '8px' }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600 mt-2">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded" />
                        <span className="text-sm text-slate-600">Ganhos Totais</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Por Motorista */}
          <TabsContent value="motoristas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comissões por Motorista</CardTitle>
                <CardDescription>Detalhes de ganhos e comissões de cada motorista</CardDescription>
              </CardHeader>
              <CardContent>
                {motoristasData.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Sem dados</h3>
                    <p className="text-slate-500">Não existem dados para o período selecionado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead className="text-right">Uber</TableHead>
                        <TableHead className="text-right">Bolt</TableHead>
                        <TableHead className="text-right">Total Ganhos</TableHead>
                        <TableHead className="text-right">Despesas</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {motoristasData.map((m, idx) => (
                        <TableRow key={idx} data-testid={`row-motorista-${m.motorista_id}`}>
                          <TableCell className="font-medium">{m.motorista_nome || 'N/A'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.ganhos_uber)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.ganhos_bolt)}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {formatCurrency(m.total_ganhos)}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            {formatCurrency(
                              (m.despesas?.combustivel || 0) + 
                              (m.despesas?.via_verde || 0) + 
                              (m.despesas?.eletrico || 0) + 
                              (m.despesas?.aluguer || 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(m.valor_liquido)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {formatCurrency(m.comissao_estimada)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Ranking */}
          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-600" />
                  Top 5 Motoristas
                </CardTitle>
                <CardDescription>Motoristas com maior comissão no período</CardDescription>
              </CardHeader>
              <CardContent>
                {topMotoristas.length === 0 ? (
                  <div className="text-center py-12">
                    <PieChart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Sem dados</h3>
                    <p className="text-slate-500">Não existem dados para o período selecionado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topMotoristas.map((m, idx) => {
                      const maxComissao = topMotoristas[0]?.comissao_estimada || 1;
                      const widthPercent = (m.comissao_estimada / maxComissao) * 100;
                      const colors = [
                        'from-yellow-400 to-yellow-500',
                        'from-slate-300 to-slate-400',
                        'from-orange-300 to-orange-400',
                        'from-blue-300 to-blue-400',
                        'from-purple-300 to-purple-400'
                      ];
                      
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                            idx === 1 ? 'bg-slate-100 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-slate-700">{m.motorista_nome || 'N/A'}</span>
                              <span className="font-bold text-emerald-600">{formatCurrency(m.comissao_estimada)}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full bg-gradient-to-r ${colors[idx]} rounded-full transition-all duration-500`}
                                style={{ width: `${widthPercent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-slate-500">
                                Ganhos: {formatCurrency(m.ganhos)}
                              </span>
                              <span className="text-xs text-slate-500">
                                {m.semanas || 0} semana(s)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Action */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Configurar Regras de Comissão</h3>
                <p className="text-slate-600 text-sm mt-1">
                  Defina percentagens, escalas e classificações de motoristas
                </p>
              </div>
              <Button 
                onClick={() => navigate('/config/comissoes')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Ir para Configuração
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ComissoesDashboard;
