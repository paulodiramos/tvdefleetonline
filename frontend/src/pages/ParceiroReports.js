import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, Car, Users, AlertCircle, Calendar } from 'lucide-react';

const ParceiroReports = ({ user, onLogout }) => {
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [vehicleReports, setVehicleReports] = useState([]);
  const [motoristaReports, setMotoristaReports] = useState([]);
  const [upcomingExpenses, setUpcomingExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [weekly, vehicles, motoristas, expenses] = await Promise.all([
        axios.get(`${API}/reports/parceiro/semanal`, config),
        axios.get(`${API}/reports/parceiro/por-veiculo`, config),
        axios.get(`${API}/reports/parceiro/por-motorista`, config),
        axios.get(`${API}/reports/parceiro/proximas-despesas`, config)
      ]);
      
      setWeeklyReport(weekly.data);
      setVehicleReports(vehicles.data);
      setMotoristaReports(motoristas.data);
      setUpcomingExpenses(expenses.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const getExpenseTypeBadge = (tipo) => {
    const colors = {
      seguro: 'bg-red-100 text-red-700',
      manutencao: 'bg-amber-100 text-amber-700',
      matricula: 'bg-blue-100 text-blue-700'
    };
    return colors[tipo] || 'bg-slate-100 text-slate-700';
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

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="parceiro-reports-page">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Relatórios</h1>
          <p className="text-slate-600">Visão completa de ganhos, gastos e lucros</p>
        </div>

        {/* Weekly Summary */}
        {weeklyReport && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="card-hover" data-testid="weekly-ganhos-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Ganhos Semanais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span className="text-3xl font-bold text-emerald-600">€{weeklyReport.total_ganhos.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover" data-testid="weekly-gastos-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Gastos Semanais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <span className="text-3xl font-bold text-red-600">€{weeklyReport.total_gastos.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover" data-testid="weekly-lucro-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Lucro Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className={`text-3xl font-bold ${weeklyReport.lucro >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    €{weeklyReport.lucro.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover" data-testid="weekly-roi-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">ROI %</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-3xl font-bold text-purple-600">{weeklyReport.roi_percentual.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Reports */}
        <Card>
          <Tabs defaultValue="veiculos" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="veiculos" data-testid="tab-veiculos">Por Veículo</TabsTrigger>
                <TabsTrigger value="motoristas" data-testid="tab-motoristas">Por Motorista</TabsTrigger>
                <TabsTrigger value="despesas" data-testid="tab-despesas">Próximas Despesas</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="veiculos" className="space-y-4">
                {vehicleReports.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p>Nenhum relatório de veículo disponível</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vehicleReports.map((report) => (
                      <div key={report.vehicle_id} className="p-4 bg-slate-50 rounded-lg border" data-testid={`vehicle-report-${report.vehicle_id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-800">{report.marca} {report.modelo}</h4>
                            <p className="text-sm text-slate-500 font-mono">{report.matricula}</p>
                          </div>
                          <Car className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 mb-1">Ganhos</p>
                            <p className="text-lg font-bold text-emerald-600">€{report.total_ganhos.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Gastos</p>
                            <p className="text-lg font-bold text-red-600">€{report.total_gastos.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Lucro</p>
                            <p className={`text-lg font-bold ${report.lucro >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              €{report.lucro.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="motoristas" className="space-y-4">
                {motoristaReports.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p>Nenhum relatório de motorista disponível</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {motoristaReports.map((report) => (
                      <div key={report.motorista_id} className="p-4 bg-slate-50 rounded-lg border" data-testid={`motorista-report-${report.motorista_id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-800">{report.nome}</h4>
                            <p className="text-sm text-slate-500">{report.email}</p>
                          </div>
                          <Users className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 mb-1">Ganhos Totais</p>
                            <p className="text-lg font-bold text-emerald-600">€{report.total_ganhos.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Corridas</p>
                            <p className="text-lg font-bold text-slate-700">{report.total_corridas}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Lucro Parceiro</p>
                            <p className="text-lg font-bold text-blue-600">€{report.lucro_parceiro.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="despesas" className="space-y-4">
                {upcomingExpenses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p>Nenhuma despesa agendada nos próximos 60 dias</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingExpenses.map((expense, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg border" data-testid={`upcoming-expense-${idx}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getExpenseTypeBadge(expense.tipo)}>
                                {expense.tipo.toUpperCase()}
                              </Badge>
                              {expense.dias_restantes <= 7 && (
                                <Badge className="bg-red-100 text-red-700">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Urgente
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-slate-800 mb-1">{expense.descricao}</h4>
                            <p className="text-sm text-slate-600">{expense.veiculo}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              Data: {new Date(expense.data).toLocaleDateString('pt-PT')} ({expense.dias_restantes} dias)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600 mb-1">Valor Estimado</p>
                            <p className="text-xl font-bold text-red-600">€{expense.valor.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

export default ParceiroReports;