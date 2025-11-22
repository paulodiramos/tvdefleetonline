import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Car, FileText, Calendar, TrendingUp } from 'lucide-react';

const DashboardParceiroTab = ({ parceiroId }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    veiculos_total: 0,
    veiculos_ativos: 0,
    motoristas_total: 0,
    motoristas_ativos: 0,
    contratos_ativos: 0,
    contratos_total: 0
  });
  const [alertas, setAlertas] = useState({
    seguros_vencer: [],
    inspecoes_vencer: [],
    extintores_vencer: [],
    manutencoes_pendentes: []
  });

  useEffect(() => {
    if (parceiroId) {
      fetchDashboardData();
    }
  }, [parceiroId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch vehicles
      const vehiclesRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroVehicles = vehiclesRes.data.filter(v => v.parceiro_id === parceiroId);
      
      // Fetch motoristas
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_atribuido === parceiroId);
      
      // Fetch contratos
      try {
        const contratosRes = await axios.get(`${API}/contratos?parceiro_id=${parceiroId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Calculate stats
        const statsData = {
          veiculos_total: parceiroVehicles.length,
          veiculos_ativos: parceiroVehicles.filter(v => v.status === 'atribuido' || v.status === 'disponivel').length,
          motoristas_total: parceiroMotoristas.length,
          motoristas_ativos: parceiroMotoristas.filter(m => m.approved).length,
          contratos_ativos: contratosRes.data.filter(c => c.status === 'ativo').length,
          contratos_total: contratosRes.data.length
        };
        setStats(statsData);
      } catch (err) {
        // Contratos endpoint might not exist, set default stats
        const statsData = {
          veiculos_total: parceiroVehicles.length,
          veiculos_ativos: parceiroVehicles.filter(v => v.status === 'atribuido' || v.status === 'disponivel').length,
          motoristas_total: parceiroMotoristas.length,
          motoristas_ativos: parceiroMotoristas.filter(m => m.approved).length,
          contratos_ativos: 0,
          contratos_total: 0
        };
        setStats(statsData);
      }
      
      // Fetch alertas from new endpoint
      try {
        const alertasRes = await axios.get(`${API}/parceiros/${parceiroId}/alertas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Convert backend format to component format
        const alertasData = {
          seguros_vencer: alertasRes.data.alertas.seguros.map(a => ({
            veiculo: a.matricula,
            data: new Date(a.data_validade),
            dias: a.dias_restantes
          })),
          inspecoes_vencer: alertasRes.data.alertas.inspecoes.map(a => ({
            veiculo: a.matricula,
            data: new Date(a.proxima_inspecao),
            dias: a.dias_restantes
          })),
          extintores_vencer: alertasRes.data.alertas.extintores.map(a => ({
            veiculo: a.matricula,
            data: new Date(a.data_validade),
            dias: a.dias_restantes
          })),
          manutencoes_pendentes: alertasRes.data.alertas.manutencoes.map(a => ({
            veiculo: a.matricula,
            km_atual: a.km_atual,
            km_proxima: a.km_proxima,
            km_restantes: a.km_restantes,
            tipo: a.tipo_manutencao
          }))
        };
        
        setAlertas(alertasData);
      } catch (err) {
        console.error('Error fetching alertas:', err);
        // Set empty alertas if endpoint fails
        setAlertas({
          seguros_vencer: [],
          inspecoes_vencer: [],
          extintores_vencer: [],
          manutencoes_pendentes: []
        });
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Carregando dashboard...</p>;
  }

  const totalAlertas = 
    alertas.seguros_vencer.length +
    alertas.inspecoes_vencer.length +
    alertas.extintores_vencer.length +
    alertas.manutencoes_pendentes.length;

  return (
    <div className="space-y-6">
      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Veículos</p>
                <p className="text-3xl font-bold">{stats.veiculos_ativos}/{stats.veiculos_total}</p>
                <p className="text-xs text-slate-500 mt-1">Ativos/Total</p>
              </div>
              <Car className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Motoristas</p>
                <p className="text-3xl font-bold">{stats.motoristas_ativos}/{stats.motoristas_total}</p>
                <p className="text-xs text-slate-500 mt-1">Ativos/Total</p>
              </div>
              <FileText className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Contratos</p>
                <p className="text-3xl font-bold">{stats.contratos_ativos}/{stats.contratos_total}</p>
                <p className="text-xs text-slate-500 mt-1">Ativos/Total</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Avisos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Alertas e Avisos</span>
            </div>
            {totalAlertas > 0 && (
              <Badge variant="destructive">{totalAlertas}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalAlertas === 0 ? (
            <div className="flex items-center justify-center py-8 text-green-600">
              <CheckCircle className="w-6 h-6 mr-2" />
              <p className="font-medium">Tudo em dia! Nenhum alerta pendente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seguros a vencer */}
              {alertas.seguros_vencer.length > 0 && (
                <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r">
                  <h4 className="font-semibold text-red-900 flex items-center mb-2">
                    <Clock className="w-4 h-4 mr-2" />
                    Seguros a Vencer ({alertas.seguros_vencer.length})
                  </h4>
                  <div className="space-y-1">
                    {alertas.seguros_vencer.map((item, idx) => (
                      <div key={idx} className="text-sm text-red-800">
                        <span className="font-medium">{item.veiculo}</span> - 
                        Vence em <strong>{item.dias} dias</strong> ({item.data.toLocaleDateString('pt-PT')})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inspeções a vencer */}
              {alertas.inspecoes_vencer.length > 0 && (
                <div className="border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded-r">
                  <h4 className="font-semibold text-amber-900 flex items-center mb-2">
                    <Calendar className="w-4 h-4 mr-2" />
                    Inspeções a Vencer ({alertas.inspecoes_vencer.length})
                  </h4>
                  <div className="space-y-1">
                    {alertas.inspecoes_vencer.map((item, idx) => (
                      <div key={idx} className="text-sm text-amber-800">
                        <span className="font-medium">{item.veiculo}</span> - 
                        Vence em <strong>{item.dias} dias</strong> ({item.data.toLocaleDateString('pt-PT')})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extintores a vencer */}
              {alertas.extintores_vencer.length > 0 && (
                <div className="border-l-4 border-orange-500 pl-4 py-2 bg-orange-50 rounded-r">
                  <h4 className="font-semibold text-orange-900 flex items-center mb-2">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Extintores a Vencer ({alertas.extintores_vencer.length})
                  </h4>
                  <div className="space-y-1">
                    {alertas.extintores_vencer.map((item, idx) => (
                      <div key={idx} className="text-sm text-orange-800">
                        <span className="font-medium">{item.veiculo}</span> - 
                        Vence em <strong>{item.dias} dias</strong> ({item.data.toLocaleDateString('pt-PT')})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manutenções pendentes */}
              {alertas.manutencoes_pendentes.length > 0 && (
                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
                  <h4 className="font-semibold text-blue-900 flex items-center mb-2">
                    <Car className="w-4 h-4 mr-2" />
                    Manutenções Pendentes ({alertas.manutencoes_pendentes.length})
                  </h4>
                  <div className="space-y-1">
                    {alertas.manutencoes_pendentes.map((item, idx) => (
                      <div key={idx} className="text-sm text-blue-800">
                        <span className="font-medium">{item.veiculo}</span> - 
                        <strong>{item.tipo || 'Manutenção'}</strong>: Faltam <strong>{item.km_restantes} km</strong> ({item.km_atual}/{item.km_proxima} km)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={alertas.seguros_vencer.length > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-600">Seguros</p>
            <p className="text-2xl font-bold">
              {alertas.seguros_vencer.length}
            </p>
            <p className="text-xs text-slate-500">a vencer</p>
          </CardContent>
        </Card>

        <Card className={alertas.inspecoes_vencer.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-600">Inspeções</p>
            <p className="text-2xl font-bold">
              {alertas.inspecoes_vencer.length}
            </p>
            <p className="text-xs text-slate-500">a vencer</p>
          </CardContent>
        </Card>

        <Card className={alertas.extintores_vencer.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-600">Extintores</p>
            <p className="text-2xl font-bold">
              {alertas.extintores_vencer.length}
            </p>
            <p className="text-xs text-slate-500">a vencer</p>
          </CardContent>
        </Card>

        <Card className={alertas.manutencoes_pendentes.length > 0 ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-slate-600">Manutenções</p>
            <p className="text-2xl font-bold">
              {alertas.manutencoes_pendentes.length}
            </p>
            <p className="text-xs text-slate-500">pendentes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardParceiroTab;
