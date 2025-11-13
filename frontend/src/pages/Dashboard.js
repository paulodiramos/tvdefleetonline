import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Car, Users, DollarSign, AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [proximasDatas, setProximasDatas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchAlertas();
    fetchProximasDatas();
  }, []);

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
    </Layout>
  );
};

export default Dashboard;