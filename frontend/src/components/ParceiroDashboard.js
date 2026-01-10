import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Shield, 
  ClipboardCheck, 
  Wrench, 
  Car,
  TrendingUp,
  Users,
  FileText,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import ResumoSemanalCard from './ResumoSemanalCard';

const ParceiroDashboard = ({ parceiroId }) => {
  const [alertas, setAlertas] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (parceiroId) {
      fetchDashboardData();
    }
  }, [parceiroId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch alerts
      const alertasResponse = await axios.get(`${API}/parceiros/${parceiroId}/alertas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlertas(alertasResponse.data);

      // Fetch basic stats
      const [veiculosRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/vehicles?parceiro_id=${parceiroId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const veiculosDoParceiro = veiculosRes.data.filter(v => v.parceiro_id === parceiroId);
      const motoristasAtivos = motoristasRes.data.filter(m => m.status_motorista === 'ativo');

      setStats({
        total_veiculos: veiculosDoParceiro.length,
        total_motoristas: motoristasAtivos.length,
        veiculos_disponiveis: veiculosDoParceiro.filter(v => v.status === 'disponivel').length
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgente) => {
    return urgente ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50';
  };

  const getUrgencyBadge = (urgente) => {
    return urgente ? (
      <Badge variant="destructive" className="ml-2">Urgente</Badge>
    ) : (
      <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">Atenção</Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Semanal Card */}
      <ResumoSemanalCard parceiroId={parceiroId} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
            <Car className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.total_veiculos || 0}</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.veiculos_disponiveis || 0} disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motoristas Ativos</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.total_motoristas || 0}</div>
            <p className="text-xs text-slate-500 mt-1">No sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(alertas?.alertas?.seguros?.filter(a => a.urgente).length || 0) +
               (alertas?.alertas?.inspecoes?.filter(a => a.urgente).length || 0) +
               (alertas?.alertas?.extintores?.filter(a => a.urgente).length || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Requerem atenção imediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Calendar className="w-6 h-6 mr-2 text-blue-600" />
          Alertas de Manutenção
        </h2>

        {/* Seguros */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Shield className="w-5 h-5 mr-2 text-red-600" />
              Seguros ({alertas?.totais?.seguros || 0})
            </CardTitle>
            <CardDescription>Validade de seguros próxima do vencimento</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas?.alertas?.seguros && alertas.alertas.seguros.length > 0 ? (
              <div className="space-y-2">
                {alertas.alertas.seguros.map((alerta, idx) => (
                  <Alert key={idx} className={getUrgencyColor(alerta.urgente)}>
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{alerta.matricula}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          - Validade: {new Date(alerta.data_validade).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium mr-2">
                          {alerta.dias_restantes} {alerta.dias_restantes === 1 ? 'dia' : 'dias'}
                        </span>
                        {getUrgencyBadge(alerta.urgente)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">✅ Todos os seguros em dia</p>
            )}
          </CardContent>
        </Card>

        {/* Inspeções */}
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <ClipboardCheck className="w-5 h-5 mr-2 text-yellow-600" />
              Inspeções ({alertas?.totais?.inspecoes || 0})
            </CardTitle>
            <CardDescription>Inspeções técnicas a vencer</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas?.alertas?.inspecoes && alertas.alertas.inspecoes.length > 0 ? (
              <div className="space-y-2">
                {alertas.alertas.inspecoes.map((alerta, idx) => (
                  <Alert key={idx} className={getUrgencyColor(alerta.urgente)}>
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{alerta.matricula}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          - Próxima inspeção: {new Date(alerta.proxima_inspecao).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium mr-2">
                          {alerta.dias_restantes} {alerta.dias_restantes === 1 ? 'dia' : 'dias'}
                        </span>
                        {getUrgencyBadge(alerta.urgente)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">✅ Todas as inspeções em dia</p>
            )}
          </CardContent>
        </Card>

        {/* Extintores */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
              Extintores ({alertas?.totais?.extintores || 0})
            </CardTitle>
            <CardDescription>Validade de extintores a vencer</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas?.alertas?.extintores && alertas.alertas.extintores.length > 0 ? (
              <div className="space-y-2">
                {alertas.alertas.extintores.map((alerta, idx) => (
                  <Alert key={idx} className={getUrgencyColor(alerta.urgente)}>
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{alerta.matricula}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          - Validade: {new Date(alerta.data_validade).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium mr-2">
                          {alerta.dias_restantes} {alerta.dias_restantes === 1 ? 'dia' : 'dias'}
                        </span>
                        {getUrgencyBadge(alerta.urgente)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">✅ Todos os extintores em dia</p>
            )}
          </CardContent>
        </Card>

        {/* Manutenções */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Wrench className="w-5 h-5 mr-2 text-blue-600" />
              Manutenções ({alertas?.totais?.manutencoes || 0})
            </CardTitle>
            <CardDescription>Manutenções baseadas em quilometragem</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas?.alertas?.manutencoes && alertas.alertas.manutencoes.length > 0 ? (
              <div className="space-y-2">
                {alertas.alertas.manutencoes.map((alerta, idx) => (
                  <Alert key={idx} className={getUrgencyColor(alerta.urgente)}>
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{alerta.matricula}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          - {alerta.tipo_manutencao}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium mr-2">
                          {alerta.km_restantes > 0 ? `${alerta.km_restantes} km` : 'VENCIDA'}
                        </span>
                        {getUrgencyBadge(alerta.urgente)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">✅ Todas as manutenções em dia</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParceiroDashboard;
