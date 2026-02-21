import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Building2, TrendingUp, TrendingDown, DollarSign, 
  Calendar, ChevronLeft, ChevronRight, Loader2, 
  BarChart3, PieChart as PieChartIcon, FileText, RefreshCw, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardFaturacao({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dashboardData, setDashboardData] = useState(null);
  const [empresas, setEmpresas] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Buscar dados do dashboard
      const response = await fetch(`${API_URL}/api/empresas-faturacao/dashboard/totais-ano?ano=${ano}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Erro ao carregar dados');
      }
      
      const data = await response.json();
      setDashboardData(data);
      
      // Buscar lista de empresas para detalhes
      const empresasResponse = await fetch(`${API_URL}/api/empresas-faturacao/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (empresasResponse.ok) {
        setEmpresas(await empresasResponse.json());
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dashboard de faturação');
    } finally {
      setLoading(false);
    }
  }, [ano, navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleAnoAnterior = () => setAno(prev => prev - 1);
  const handleAnoSeguinte = () => setAno(prev => prev + 1);

  // Preparar dados para gráficos
  const prepareBarChartData = () => {
    if (!dashboardData?.empresas) return [];
    return dashboardData.empresas.map((empresa, index) => ({
      nome: empresa.empresa_nome?.length > 15 
        ? empresa.empresa_nome.substring(0, 15) + '...' 
        : empresa.empresa_nome,
      nomeCompleto: empresa.empresa_nome,
      valor: empresa.total_valor || 0,
      recibos: empresa.total_recibos || 0,
      fill: COLORS[index % COLORS.length]
    }));
  };

  const preparePieChartData = () => {
    if (!dashboardData?.empresas) return [];
    return dashboardData.empresas
      .filter(e => e.total_valor > 0)
      .map((empresa, index) => ({
        name: empresa.empresa_nome,
        value: empresa.total_valor || 0,
        fill: COLORS[index % COLORS.length]
      }));
  };

  // Dados simulados para evolução mensal (a ser implementado no backend)
  const monthlyEvolutionData = [
    { mes: 'Jan', valor: 0 },
    { mes: 'Fev', valor: 0 },
    { mes: 'Mar', valor: 0 },
    { mes: 'Abr', valor: 0 },
    { mes: 'Mai', valor: 0 },
    { mes: 'Jun', valor: 0 },
    { mes: 'Jul', valor: 0 },
    { mes: 'Ago', valor: 0 },
    { mes: 'Set', valor: 0 },
    { mes: 'Out', valor: 0 },
    { mes: 'Nov', valor: 0 },
    { mes: 'Dez', valor: dashboardData?.totais?.valor || 0 }
  ];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{payload[0]?.payload?.nomeCompleto || label}</p>
          <p className="text-blue-600 font-semibold">{formatCurrency(payload[0]?.value)}</p>
          {payload[0]?.payload?.recibos !== undefined && (
            <p className="text-gray-500 text-sm">{payload[0].payload.recibos} recibos</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-dashboard">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  const barChartData = prepareBarChartData();
  const pieChartData = preparePieChartData();

  const content = (
    <div className="container mx-auto py-6 px-4" data-testid="dashboard-faturacao-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Dashboard de Faturação
          </h1>
          <p className="text-gray-500 mt-1">
            Análise de receitas por empresa de faturação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/empresas-faturacao')}
            data-testid="btn-gerir-empresas"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Gerir Empresas
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchDashboardData}
            data-testid="btn-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Seletor de Ano */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={handleAnoAnterior} data-testid="btn-ano-anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg shadow-sm">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-lg" data-testid="ano-selecionado">{ano}</span>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleAnoSeguinte}
          disabled={ano >= new Date().getFullYear()}
          data-testid="btn-ano-seguinte"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Faturado</p>
                <p className="text-3xl font-bold" data-testid="total-faturado">
                  {formatCurrency(dashboardData?.totais?.valor)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-blue-200 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Recibos</p>
                <p className="text-3xl font-bold" data-testid="total-recibos">
                  {dashboardData?.totais?.recibos || 0}
                </p>
              </div>
              <FileText className="w-12 h-12 text-green-200 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Empresas Ativas</p>
                <p className="text-3xl font-bold" data-testid="total-empresas">
                  {dashboardData?.empresas?.length || 0}
                </p>
              </div>
              <Building2 className="w-12 h-12 text-purple-200 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {dashboardData?.empresas?.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Gráfico de Barras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Faturação por Empresa
              </CardTitle>
              <CardDescription>Total faturado por cada empresa em {ano}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="bar-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="nome" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}k€`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-green-600" />
                Distribuição de Receitas
              </CardTitle>
              <CardDescription>Proporção de faturação por empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="pie-chart">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Sem dados de faturação para este período
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Sem dados de faturação
            </h3>
            <p className="text-gray-400 text-center mb-4">
              Não existem empresas de faturação configuradas ou não há receitas em {ano}
            </p>
            <Button onClick={() => navigate('/empresas-faturacao')}>
              <Building2 className="w-4 h-4 mr-2" />
              Configurar Empresas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada */}
      {dashboardData?.empresas?.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detalhes por Empresa</CardTitle>
            <CardDescription>Resumo detalhado de cada empresa de faturação em {ano}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="tabela-detalhes">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Empresa</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">NIPC</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Total Faturado</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Recibos</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Média/Recibo</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.empresas.map((empresa, index) => {
                    const percentagem = dashboardData.totais.valor > 0 
                      ? ((empresa.total_valor / dashboardData.totais.valor) * 100).toFixed(1)
                      : 0;
                    const mediaRecibo = empresa.total_recibos > 0 
                      ? empresa.total_valor / empresa.total_recibos 
                      : 0;
                    
                    return (
                      <tr 
                        key={empresa.empresa_id} 
                        className="border-b hover:bg-gray-50 transition-colors"
                        data-testid={`row-empresa-${empresa.empresa_id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{empresa.empresa_nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {empresa.empresa_nipc}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          {formatCurrency(empresa.total_valor)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {empresa.total_recibos}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatCurrency(mediaRecibo)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant="outline" 
                            className={`
                              ${percentagem >= 50 ? 'border-green-500 text-green-700 bg-green-50' : ''}
                              ${percentagem >= 25 && percentagem < 50 ? 'border-blue-500 text-blue-700 bg-blue-50' : ''}
                              ${percentagem < 25 ? 'border-gray-500 text-gray-700 bg-gray-50' : ''}
                            `}
                          >
                            {percentagem}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-3 px-4" colSpan={2}>TOTAL</td>
                    <td className="py-3 px-4 text-right text-green-700">
                      {formatCurrency(dashboardData.totais.valor)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {dashboardData.totais.recibos}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatCurrency(
                        dashboardData.totais.recibos > 0 
                          ? dashboardData.totais.valor / dashboardData.totais.recibos 
                          : 0
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-blue-600">100%</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matriz Motorista x Empresa */}
      {dashboardData?.matriz?.length > 0 && dashboardData?.empresas_colunas?.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Matriz Motorista x Empresa - {ano}
            </CardTitle>
            <CardDescription>
              Quanto cada motorista ganhou por cada empresa de faturação durante o ano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="tabela-matriz">
                <thead>
                  <tr className="border-b bg-gradient-to-r from-purple-50 to-blue-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 sticky left-0 bg-white z-10 border-r">
                      Motorista
                    </th>
                    {dashboardData.empresas_colunas.map((empresa) => (
                      <th 
                        key={empresa.id} 
                        className="text-center py-3 px-3 font-medium text-gray-600 min-w-[120px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Building2 className="w-4 h-4 text-blue-500" />
                          <span className="text-xs">{empresa.nome?.substring(0, 12)}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-green-50 border-l">
                      Total Anual
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 bg-green-50">
                      % Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.matriz.map((row, index) => (
                    <tr 
                      key={row.motorista_id} 
                      className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                      data-testid={`matriz-row-${row.motorista_id}`}
                    >
                      <td className="py-3 px-4 sticky left-0 bg-inherit z-10 border-r">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-semibold">
                            {row.motorista_nome?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{row.motorista_nome}</span>
                        </div>
                      </td>
                      {dashboardData.empresas_colunas.map((empresa) => {
                        const celula = row.valores_por_empresa?.[empresa.id];
                        const valor = celula?.valor || 0;
                        const perc = celula?.percentagem || 0;
                        
                        return (
                          <td 
                            key={empresa.id} 
                            className={`py-2 px-2 text-center ${valor > 0 ? 'bg-green-50' : ''}`}
                          >
                            {valor > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold text-green-700 text-sm">
                                  {formatCurrency(valor)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({perc}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right font-bold text-green-700 bg-green-50 border-l">
                        {formatCurrency(row.total_anual)}
                      </td>
                      <td className="py-3 px-4 text-center bg-green-50">
                        <Badge 
                          variant="outline" 
                          className={`
                            ${row.percentagem_total >= 25 ? 'border-green-500 text-green-700 bg-green-100' : ''}
                            ${row.percentagem_total >= 10 && row.percentagem_total < 25 ? 'border-blue-500 text-blue-700 bg-blue-100' : ''}
                            ${row.percentagem_total < 10 ? 'border-gray-400 text-gray-600 bg-gray-100' : ''}
                          `}
                        >
                          {row.percentagem_total}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100 font-semibold">
                    <td className="py-3 px-4 sticky left-0 bg-blue-100 z-10 border-r">
                      TOTAL POR EMPRESA
                    </td>
                    {dashboardData.empresas_colunas.map((empresa) => {
                      const empresaData = dashboardData.empresas?.find(e => e.empresa_id === empresa.id);
                      return (
                        <td key={empresa.id} className="py-3 px-2 text-center">
                          <span className="font-bold text-blue-700">
                            {formatCurrency(empresaData?.total_valor || 0)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-bold text-green-800 bg-green-100 border-l">
                      {formatCurrency(dashboardData.totais?.valor || 0)}
                    </td>
                    <td className="py-3 px-4 text-center bg-green-100">
                      <Badge className="bg-green-600 text-white">100%</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info explicativa */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            <strong>Como ler esta matriz:</strong> Cada linha representa um motorista, cada coluna uma empresa de faturação. 
            O valor mostra quanto o motorista ganhou através dessa empresa durante {ano}. 
            A percentagem indica a contribuição para o total anual.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Layout user={user} onLogout={onLogout}>
      {content}
    </Layout>
  );
}
