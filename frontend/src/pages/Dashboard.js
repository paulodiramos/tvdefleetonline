import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Car, Users, DollarSign, AlertCircle, AlertTriangle, CheckCircle, X, Calendar, Shield, ClipboardCheck, Wrench } from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [proximasDatas, setProximasDatas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros de data
  const [periodoTipo, setPeriodoTipo] = useState('mes_atual'); // mes_atual, semanal, trimestral, semestral, anual, personalizado
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Modal states
  const [segurosModalOpen, setSegurosModalOpen] = useState(false);
  const [inspecoesModalOpen, setInspecoesModalOpen] = useState(false);
  const [revisoesModalOpen, setRevisoesModalOpen] = useState(false);
  const [extintoresModalOpen, setExtintoresModalOpen] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchAlertas();
    fetchProximasDatas();
  }, [periodoTipo, dataInicio, dataFim]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/reports/dashboard`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/alertas?status=ativo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Show only high priority alerts on dashboard (limit to 5)
      const highPriorityAlertas = response.data
        .filter(a => a.prioridade === 'alta')
        .slice(0, 5);
      setAlertas(highPriorityAlertas);
    } catch (error) {
      console.error('Error fetching alertas', error);
    }
  };

  const fetchProximasDatas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles/proximas-datas/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProximasDatas(response.data.dashboard || []);
    } catch (error) {
      console.error('Error fetching proximas datas', error);
    }
  };

  const handleResolverAlerta = async (alertaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/alertas/${alertaId}/resolver`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh alertas
      fetchAlertas();
    } catch (error) {
      console.error('Error resolving alerta', error);
    }
  };

  const handleIgnorarAlerta = async (alertaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/alertas/${alertaId}/ignorar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh alertas
      fetchAlertas();
    } catch (error) {
      console.error('Error ignoring alerta', error);
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }) => (
    <Card className="card-hover" data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-800">{value}</div>
        {trend && (
          <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
      <div className="space-y-6" data-testid="dashboard-page">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-600">Bem-vindo, {user.name}</p>
        </div>

        {/* Filtros de Período */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Período de Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="periodo_tipo">Tipo de Período</Label>
                <select
                  id="periodo_tipo"
                  value={periodoTipo}
                  onChange={(e) => {
                    setPeriodoTipo(e.target.value);
                    if (e.target.value !== 'personalizado') {
                      setDataInicio('');
                      setDataFim('');
                    }
                  }}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="mes_atual">Mês Atual</option>
                  <option value="semanal">Última Semana</option>
                  <option value="trimestral">Último Trimestre</option>
                  <option value="semestral">Último Semestre</option>
                  <option value="anual">Último Ano</option>
                  <option value="personalizado">Período Personalizado</option>
                </select>
              </div>
              
              {periodoTipo === 'personalizado' && (
                <>
                  <div>
                    <Label htmlFor="data_inicio">Data Início</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_fim">Data Fim</Label>
                    <Input
                      id="data_fim"
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Veículos"
            value={stats?.total_vehicles || 0}
            icon={Car}
            color="bg-emerald-600"
          />
          <StatCard
            title="Veículos Disponíveis"
            value={stats?.available_vehicles || 0}
            icon={Car}
            color="bg-cyan-600"
          />
          <StatCard
            title="Motoristas"
            value={stats?.total_motoristas || 0}
            icon={Users}
            color="bg-blue-600"
          />
          <StatCard
            title="Pendentes"
            value={stats?.pending_motoristas || 0}
            icon={AlertCircle}
            color="bg-amber-600"
          />
        </div>

        {/* Próximas Intervenções - Summary Cards */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span>Próximas Intervenções - Visão Geral</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Próximos Seguros */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSegurosModalOpen(true)}>
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-6 h-6 text-green-600" />
                  <span className="text-xs font-semibold bg-green-200 text-green-800 px-2 py-1 rounded">
                    {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Seguro')).length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Próximos Seguros</p>
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Seguro')).slice(0, 1).map((vehicle, idx) => {
                  const seguroData = vehicle.datas.find(d => d.tipo === 'Seguro');
                  return (
                    <div key={idx} className="text-xs text-slate-600">
                      <p className="font-medium truncate">{vehicle.matricula}</p>
                      <p className="text-green-700 font-semibold">
                        {seguroData && new Date(seguroData.data).toLocaleDateString('pt-PT')}
                      </p>
                      {seguroData && (
                        <p className={`text-xs ${seguroData.urgente ? 'text-red-600' : 'text-slate-500'}`}>
                          {seguroData.dias_restantes < 0 ? `${Math.abs(seguroData.dias_restantes)}d atraso` : 
                           `em ${seguroData.dias_restantes} dias`}
                        </p>
                      )}
                    </div>
                  );
                })}
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Seguro')).length === 0 && (
                  <p className="text-xs text-slate-500">Nenhum pendente</p>
                )}
              </div>

              {/* Próximas Inspeções */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInspecoesModalOpen(true)}>
                <div className="flex items-center justify-between mb-2">
                  <ClipboardCheck className="w-6 h-6 text-purple-600" />
                  <span className="text-xs font-semibold bg-purple-200 text-purple-800 px-2 py-1 rounded">
                    {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Inspeção')).length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Próximas Inspeções</p>
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Inspeção')).slice(0, 1).map((vehicle, idx) => {
                  const inspecaoData = vehicle.datas.find(d => d.tipo === 'Inspeção');
                  return (
                    <div key={idx} className="text-xs text-slate-600">
                      <p className="font-medium truncate">{vehicle.matricula}</p>
                      <p className="text-purple-700 font-semibold">
                        {inspecaoData && new Date(inspecaoData.data).toLocaleDateString('pt-PT')}
                      </p>
                      {inspecaoData && (
                        <p className={`text-xs ${inspecaoData.urgente ? 'text-red-600' : 'text-slate-500'}`}>
                          {inspecaoData.dias_restantes < 0 ? `${Math.abs(inspecaoData.dias_restantes)}d atraso` : 
                           `em ${inspecaoData.dias_restantes} dias`}
                        </p>
                      )}
                    </div>
                  );
                })}
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Inspeção')).length === 0 && (
                  <p className="text-xs text-slate-500">Nenhuma pendente</p>
                )}
              </div>

              {/* Próximas Revisões */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRevisoesModalOpen(true)}>
                <div className="flex items-center justify-between mb-2">
                  <Wrench className="w-6 h-6 text-blue-600" />
                  <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-1 rounded">
                    {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Revisão')).length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Próximas Revisões</p>
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Revisão')).slice(0, 1).map((vehicle, idx) => {
                  const revisaoData = vehicle.datas.find(d => d.tipo === 'Revisão');
                  return (
                    <div key={idx} className="text-xs text-slate-600">
                      <p className="font-medium truncate">{vehicle.matricula}</p>
                      <p className="text-blue-700 font-semibold">
                        {revisaoData && new Date(revisaoData.data).toLocaleDateString('pt-PT')}
                      </p>
                      {revisaoData && revisaoData.km && (
                        <p className="text-xs text-slate-600">{revisaoData.km.toLocaleString()} km</p>
                      )}
                      {revisaoData && (
                        <p className={`text-xs ${revisaoData.urgente ? 'text-red-600' : 'text-slate-500'}`}>
                          {revisaoData.dias_restantes < 0 ? `${Math.abs(revisaoData.dias_restantes)}d atraso` : 
                           `em ${revisaoData.dias_restantes} dias`}
                        </p>
                      )}
                    </div>
                  );
                })}
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Revisão')).length === 0 && (
                  <p className="text-xs text-slate-500">Nenhuma pendente</p>
                )}
              </div>

              {/* Próximos Extintores */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setExtintoresModalOpen(true)}>
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <span className="text-xs font-semibold bg-red-200 text-red-800 px-2 py-1 rounded">
                    {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Extintor')).length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Validade Extintores</p>
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Extintor')).slice(0, 1).map((vehicle, idx) => {
                  const extintorData = vehicle.datas.find(d => d.tipo === 'Extintor');
                  return (
                    <div key={idx} className="text-xs text-slate-600">
                      <p className="font-medium truncate">{vehicle.matricula}</p>
                      <p className="text-red-700 font-semibold">
                        {extintorData && new Date(extintorData.data).toLocaleDateString('pt-PT')}
                      </p>
                      {extintorData && (
                        <p className={`text-xs ${extintorData.urgente ? 'text-red-600' : 'text-slate-500'}`}>
                          {extintorData.dias_restantes < 0 ? `${Math.abs(extintorData.dias_restantes)}d atraso` : 
                           `em ${extintorData.dias_restantes} dias`}
                        </p>
                      )}
                    </div>
                  );
                })}
                {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Extintor')).length === 0 && (
                  <p className="text-xs text-slate-500">Nenhuma pendente</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="card-hover" data-testid="revenue-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Receitas Totais</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                €{stats?.total_receitas?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="expense-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                <span>Despesas Totais</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                €{stats?.total_despesas?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover" data-testid="roi-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span>ROI</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stats?.roi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                €{stats?.roi?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Próximas Datas de Intervenções */}
        {proximasDatas.length > 0 && (
          <Card className="border-blue-200 bg-blue-50" data-testid="proximas-datas-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-700">
                <AlertCircle className="w-5 h-5" />
                <span>Próximas Intervenções ({proximasDatas.length} veículos)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proximasDatas.slice(0, 10).map((vehicleData, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-800">{vehicleData.marca} {vehicleData.modelo}</h4>
                        <p className="text-sm text-slate-600">Matrícula: {vehicleData.matricula}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {vehicleData.datas.map((data, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded ${data.urgente ? 'bg-red-50 border-l-4 border-red-500' : 'bg-slate-50 border-l-4 border-blue-500'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`font-medium ${data.urgente ? 'text-red-700' : 'text-slate-800'}`}>
                                {data.tipo}
                              </p>
                              <p className="text-sm text-slate-600">
                                📅 {new Date(data.data).toLocaleDateString('pt-PT')}
                              </p>
                              {data.km && <p className="text-xs text-slate-500">🚗 {data.km.toLocaleString()} km</p>}
                              {data.seguradora && <p className="text-xs text-slate-500">📋 {data.seguradora}</p>}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                              data.dias_restantes < 0 ? 'bg-red-200 text-red-800' :
                              data.urgente ? 'bg-orange-200 text-orange-800' : 
                              'bg-green-200 text-green-800'
                            }`}>
                              {data.dias_restantes < 0 ? `${Math.abs(data.dias_restantes)}d atraso` : 
                               data.dias_restantes === 0 ? 'Hoje' :
                               data.dias_restantes === 1 ? 'Amanhã' :
                               `${data.dias_restantes} dias`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alertas Section - Only for Admin, Gestor, Operacional */}
        {(user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional') && alertas.length > 0 && (
          <Card className="border-red-200 bg-red-50" data-testid="alertas-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span>Alertas Urgentes ({alertas.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertas.map((alerta) => (
                  <div key={alerta.id} className="bg-white p-4 rounded-lg border border-red-200 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <h4 className="font-semibold text-slate-800">{alerta.titulo}</h4>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{alerta.descricao}</p>
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        <span className="capitalize">Tipo: {alerta.tipo.replace('_', ' ')}</span>
                        {alerta.data_vencimento && (
                          <span>Vencimento: {alerta.data_vencimento}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolverAlerta(alerta.id)}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleIgnorarAlerta(alerta.id)}
                        className="text-slate-600 hover:bg-slate-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="recent-activity-card">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              <p>Nenhuma atividade recente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Seguros */}
      <Dialog open={segurosModalOpen} onOpenChange={setSegurosModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span>Próximos Seguros a Vencer</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {proximasDatas
              .filter(v => v.datas.some(d => d.tipo === 'Seguro'))
              .map((vehicle, idx) => {
                const seguroData = vehicle.datas.find(d => d.tipo === 'Seguro');
                return (
                  <div key={idx} className="border rounded-lg p-4 bg-green-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.marca} {vehicle.modelo}</p>
                        <p className="text-sm text-slate-600">Matrícula: <span className="font-medium">{vehicle.matricula}</span></p>
                        <p className="text-sm text-slate-600">Parceiro: <span className="font-medium">{vehicle.parceiro_nome}</span></p>
                        {seguroData && seguroData.seguradora && (
                          <p className="text-sm text-slate-600">Seguradora: <span className="font-medium">{seguroData.seguradora}</span></p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-700">
                          {seguroData && new Date(seguroData.data).toLocaleDateString('pt-PT')}
                        </p>
                        {seguroData && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            seguroData.dias_restantes < 0 ? 'bg-red-200 text-red-800' :
                            seguroData.urgente ? 'bg-orange-200 text-orange-800' : 
                            'bg-green-200 text-green-800'
                          }`}>
                            {seguroData.dias_restantes < 0 ? `${Math.abs(seguroData.dias_restantes)}d atraso` : 
                             `${seguroData.dias_restantes} dias`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Seguro')).length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhum seguro a vencer</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Inspeções */}
      <Dialog open={inspecoesModalOpen} onOpenChange={setInspecoesModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
              <span>Próximas Inspeções</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {proximasDatas
              .filter(v => v.datas.some(d => d.tipo === 'Inspeção'))
              .map((vehicle, idx) => {
                const inspecaoData = vehicle.datas.find(d => d.tipo === 'Inspeção');
                return (
                  <div key={idx} className="border rounded-lg p-4 bg-purple-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.marca} {vehicle.modelo}</p>
                        <p className="text-sm text-slate-600">Matrícula: <span className="font-medium">{vehicle.matricula}</span></p>
                        <p className="text-sm text-slate-600">Parceiro: <span className="font-medium">{vehicle.parceiro_nome}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-purple-700">
                          {inspecaoData && new Date(inspecaoData.data).toLocaleDateString('pt-PT')}
                        </p>
                        {inspecaoData && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            inspecaoData.dias_restantes < 0 ? 'bg-red-200 text-red-800' :
                            inspecaoData.urgente ? 'bg-orange-200 text-orange-800' : 
                            'bg-purple-200 text-purple-800'
                          }`}>
                            {inspecaoData.dias_restantes < 0 ? `${Math.abs(inspecaoData.dias_restantes)}d atraso` : 
                             `${inspecaoData.dias_restantes} dias`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Inspeção')).length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma inspeção pendente</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Revisões */}
      <Dialog open={revisoesModalOpen} onOpenChange={setRevisoesModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <span>Próximas Revisões</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {proximasDatas
              .filter(v => v.datas.some(d => d.tipo === 'Revisão'))
              .map((vehicle, idx) => {
                const revisaoData = vehicle.datas.find(d => d.tipo === 'Revisão');
                return (
                  <div key={idx} className="border rounded-lg p-4 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.marca} {vehicle.modelo}</p>
                        <p className="text-sm text-slate-600">Matrícula: <span className="font-medium">{vehicle.matricula}</span></p>
                        <p className="text-sm text-slate-600">Parceiro: <span className="font-medium">{vehicle.parceiro_nome}</span></p>
                        {revisaoData && revisaoData.km && (
                          <p className="text-sm text-slate-600">KM: <span className="font-medium">{revisaoData.km.toLocaleString()} km</span></p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-blue-700">
                          {revisaoData && new Date(revisaoData.data).toLocaleDateString('pt-PT')}
                        </p>
                        {revisaoData && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            revisaoData.dias_restantes < 0 ? 'bg-red-200 text-red-800' :
                            revisaoData.urgente ? 'bg-orange-200 text-orange-800' : 
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {revisaoData.dias_restantes < 0 ? `${Math.abs(revisaoData.dias_restantes)}d atraso` : 
                             `${revisaoData.dias_restantes} dias`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Revisão')).length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma revisão pendente</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Extintores */}
      <Dialog open={extintoresModalOpen} onOpenChange={setExtintoresModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Validade de Extintores</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {proximasDatas
              .filter(v => v.datas.some(d => d.tipo === 'Extintor'))
              .map((vehicle, idx) => {
                const extintorData = vehicle.datas.find(d => d.tipo === 'Extintor');
                return (
                  <div key={idx} className="border rounded-lg p-4 bg-red-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.marca} {vehicle.modelo}</p>
                        <p className="text-sm text-slate-600">Matrícula: <span className="font-medium">{vehicle.matricula}</span></p>
                        <p className="text-sm text-slate-600">Parceiro: <span className="font-medium">{vehicle.parceiro_nome}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-700">
                          {extintorData && new Date(extintorData.data).toLocaleDateString('pt-PT')}
                        </p>
                        {extintorData && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            extintorData.dias_restantes < 0 ? 'bg-red-200 text-red-800' :
                            extintorData.urgente ? 'bg-orange-200 text-orange-800' : 
                            'bg-red-200 text-red-800'
                          }`}>
                            {extintorData.dias_restantes < 0 ? `${Math.abs(extintorData.dias_restantes)}d atraso` : 
                             `${extintorData.dias_restantes} dias`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {proximasDatas.filter(v => v.datas.some(d => d.tipo === 'Extintor')).length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhum extintor a vencer</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Dashboard;