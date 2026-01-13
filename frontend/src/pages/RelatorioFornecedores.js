import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
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
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Fuel,
  Zap,
  MapPin,
  Shield,
  Wrench,
  Car,
  Users,
  Building2,
  Euro,
  Receipt,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Download
} from 'lucide-react';

const CATEGORIA_CONFIG = {
  'via_verde': { nome: 'Via Verde', icon: MapPin, cor: 'bg-green-500', corTexto: 'text-green-600' },
  'combustivel_fossil': { nome: 'Combustível Fóssil', icon: Fuel, cor: 'bg-orange-500', corTexto: 'text-orange-600' },
  'combustivel_eletrico': { nome: 'Combustível Elétrico', icon: Zap, cor: 'bg-emerald-500', corTexto: 'text-emerald-600' },
  'gps': { nome: 'GPS/Tracking', icon: MapPin, cor: 'bg-blue-500', corTexto: 'text-blue-600' },
  'seguros': { nome: 'Seguros', icon: Shield, cor: 'bg-purple-500', corTexto: 'text-purple-600' },
  'manutencao': { nome: 'Manutenção', icon: Wrench, cor: 'bg-yellow-500', corTexto: 'text-yellow-600' },
  'lavagem': { nome: 'Lavagem', icon: Car, cor: 'bg-cyan-500', corTexto: 'text-cyan-600' },
  'pneus': { nome: 'Pneus', icon: Car, cor: 'bg-slate-500', corTexto: 'text-slate-600' },
  'outros': { nome: 'Outros', icon: Building2, cor: 'bg-gray-500', corTexto: 'text-gray-600' },
  'portagem': { nome: 'Portagens', icon: MapPin, cor: 'bg-teal-500', corTexto: 'text-teal-600' },
  'estacionamento': { nome: 'Estacionamento', icon: Car, cor: 'bg-indigo-500', corTexto: 'text-indigo-600' },
};

const RelatorioFornecedores = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [comparativo, setComparativo] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  
  const anos = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const fetchRelatorio = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [relatorioRes, comparativoRes] = await Promise.all([
        axios.get(`${API}/despesas/relatorio-fornecedores`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { ano: anoSelecionado }
        }),
        axios.get(`${API}/despesas/relatorio-fornecedores/comparativo`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { meses: 6 }
        })
      ]);
      
      setRelatorio(relatorioRes.data);
      setComparativo(comparativoRes.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatorio();
  }, [anoSelecionado]);

  const getCategoriaConfig = (categoria) => {
    return CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG['outros'];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatMonth = (mesAno) => {
    if (!mesAno) return '';
    const [ano, mes] = mesAno.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const getVariacaoIcon = (variacao) => {
    if (variacao > 0) return <ArrowUpRight className="w-4 h-4 text-red-500" />;
    if (variacao < 0) return <ArrowDownRight className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">A carregar relatório...</div>
        </div>
      </Layout>
    );
  }

  const hasData = relatorio?.resumo?.total_registos > 0;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="relatorio-fornecedores-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Relatório de Custos</h1>
              <p className="text-slate-600">Análise detalhada de despesas por fornecedor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
              <SelectTrigger className="w-32" data-testid="ano-select">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchRelatorio}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600">Sem dados de despesas</h3>
              <p className="text-slate-500 mt-2">
                Importe ficheiros de despesas (Via Verde, combustível, etc.) para ver a análise.
              </p>
              <Button className="mt-4" asChild>
                <a href="/importar-despesas">Importar Despesas</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Geral</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(relatorio?.resumo?.total_geral)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Euro className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Registos</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {relatorio?.resumo?.total_registos || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Média por Registo</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(relatorio?.resumo?.media_por_registo)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <PieChart className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Categorias</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {relatorio?.por_categoria?.length || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribution by Category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Distribuição por Categoria
                  </CardTitle>
                  <CardDescription>
                    Peso de cada categoria no total de despesas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {relatorio?.por_categoria?.map((cat, index) => {
                      const config = getCategoriaConfig(cat.categoria);
                      const Icon = config.icon;
                      return (
                        <div key={index} className="flex items-center gap-4">
                          <div className={`w-10 h-10 ${config.cor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium truncate">{config.nome}</p>
                              <p className="font-bold">{formatCurrency(cat.total)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${config.cor} rounded-full transition-all`}
                                  style={{ width: `${cat.percentagem}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-500 w-12 text-right">
                                {cat.percentagem}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Suppliers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Top Fornecedores
                  </CardTitle>
                  <CardDescription>
                    Fornecedores com maior volume de despesas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {relatorio?.por_fornecedor?.length > 0 ? (
                    <div className="space-y-3">
                      {relatorio.por_fornecedor.slice(0, 8).map((fornecedor, index) => {
                        const config = getCategoriaConfig(fornecedor.tipo);
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-slate-400 w-6">
                                #{index + 1}
                              </span>
                              <div>
                                <p className="font-medium">{fornecedor.nome}</p>
                                <Badge variant="outline" className={config.corTexto}>
                                  {config.nome}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(fornecedor.total)}</p>
                              <p className="text-xs text-slate-500">{fornecedor.count} registos</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">Sem dados de fornecedores</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Evolução Mensal
                </CardTitle>
                <CardDescription>
                  Comparativo de custos nos últimos meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {comparativo?.meses?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Variação</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          {comparativo?.categorias?.slice(0, 4).map(cat => (
                            <TableHead key={cat} className="text-right">
                              {getCategoriaConfig(cat).nome}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativo.meses.map((mes, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {formatMonth(mes.mes)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(mes.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {getVariacaoIcon(mes.variacao)}
                                <span className={mes.variacao > 0 ? 'text-red-600' : mes.variacao < 0 ? 'text-green-600' : ''}>
                                  {formatCurrency(Math.abs(mes.variacao))}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={mes.variacao_percentual > 0 ? 'text-red-600' : mes.variacao_percentual < 0 ? 'text-green-600' : ''}>
                                {mes.variacao_percentual > 0 ? '+' : ''}{mes.variacao_percentual}%
                              </span>
                            </TableCell>
                            {comparativo?.categorias?.slice(0, 4).map(cat => (
                              <TableCell key={cat} className="text-right">
                                {formatCurrency(mes.categorias[cat] || 0)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">Sem dados de evolução mensal</p>
                )}
              </CardContent>
            </Card>

            {/* Top Vehicles and Drivers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Top Veículos
                  </CardTitle>
                  <CardDescription>
                    Veículos com maior custo de despesas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {relatorio?.top_veiculos?.length > 0 ? (
                    <div className="space-y-3">
                      {relatorio.top_veiculos.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Car className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {item.veiculo?.matricula || 'Sem matrícula'}
                              </p>
                              <p className="text-sm text-slate-500">
                                {item.veiculo?.marca} {item.veiculo?.modelo}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(item.total)}</p>
                            <p className="text-xs text-slate-500">{item.count} registos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">Sem dados de veículos</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Top Motoristas
                  </CardTitle>
                  <CardDescription>
                    Motoristas com maior volume de despesas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {relatorio?.top_motoristas?.length > 0 ? (
                    <div className="space-y-3">
                      {relatorio.top_motoristas.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {item.motorista?.name || 'Motorista não identificado'}
                              </p>
                              <p className="text-sm text-slate-500">
                                {item.motorista?.email || ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(item.total)}</p>
                            <p className="text-xs text-slate-500">{item.count} registos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">Sem dados de motoristas</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Responsibility Distribution */}
            {relatorio?.por_responsavel && Object.keys(relatorio.por_responsavel).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Responsabilidade</CardTitle>
                  <CardDescription>
                    Quem paga as despesas: motorista ou parceiro/empresa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(relatorio.por_responsavel).map(([tipo, dados]) => (
                      <div 
                        key={tipo} 
                        className={`p-4 rounded-lg ${tipo === 'motorista' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border`}
                      >
                        <p className="text-sm text-slate-600 capitalize">{tipo === 'veiculo' ? 'Parceiro/Empresa' : tipo}</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(dados.total)}</p>
                        <p className="text-sm text-slate-500">{dados.count} registos</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default RelatorioFornecedores;
