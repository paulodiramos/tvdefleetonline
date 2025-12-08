import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  DollarSign, TrendingUp, Users, Car, Package, 
  Calendar, AlertCircle, CheckCircle, Info, Zap
} from 'lucide-react';

const DashboardPlanosAtivos = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    plano_ativo: null,
    modulos_ativos: [],
    total_motoristas: 0,
    total_veiculos: 0,
    custo_mensal: 0,
    custo_anual: 0,
    tipo_cobranca: '',
    limite_veiculos: null,
    limite_motoristas: null,
    percentual_uso_veiculos: 0,
    percentual_uso_motoristas: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Buscar plano ativo
      const planoRes = await axios.get(`${API}/users/${user.id}/modulos`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Buscar estatísticas
      const statsRes = await axios.get(`${API}/parceiros/${user.id}/estatisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: { total_motoristas: 0, total_veiculos: 0 } }));

      const plano = planoRes.data.plano;
      const modulos = planoRes.data.modulos_ativos || [];
      const stats = statsRes.data;

      // Calcular custos
      let custoMensal = 0;
      let custoAnual = 0;
      let tipoCobranca = '';
      let limiteVeiculos = null;
      let limiteMoristas = null;

      if (plano) {
        tipoCobranca = plano.tipo_cobranca || 'mensal_fixo';
        limiteVeiculos = plano.limite_veiculos;
        limiteMoristas = plano.limite_motoristas;

        if (tipoCobranca === 'por_veiculo') {
          custoMensal = (plano.preco || 0) * stats.total_veiculos;
        } else if (tipoCobranca === 'por_motorista') {
          custoMensal = (plano.preco || 0) * stats.total_motoristas;
        } else {
          custoMensal = plano.preco || 0;
        }

        custoAnual = custoMensal * 12;
      }

      // Calcular percentuais de uso
      let percentualVeiculos = 0;
      let percentualMotoristas = 0;

      if (limiteVeiculos) {
        percentualVeiculos = Math.min((stats.total_veiculos / limiteVeiculos) * 100, 100);
      }

      if (limiteMoristas) {
        percentualMotoristas = Math.min((stats.total_motoristas / limiteMoristas) * 100, 100);
      }

      setDashboardData({
        plano_ativo: plano,
        modulos_ativos: modulos,
        total_motoristas: stats.total_motoristas,
        total_veiculos: stats.total_veiculos,
        custo_mensal: custoMensal,
        custo_anual: custoAnual,
        tipo_cobranca: tipoCobranca,
        limite_veiculos: limiteVeiculos,
        limite_motoristas: limiteMoristas,
        percentual_uso_veiculos: percentualVeiculos,
        percentual_uso_motoristas: percentualMotoristas
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getTipoCobrancaLabel = (tipo) => {
    const tipos = {
      por_veiculo: 'Por Veículo',
      por_motorista: 'Por Motorista',
      mensal_fixo: 'Mensal Fixo'
    };
    return tipos[tipo] || 'Não definido';
  };

  const getProgressColor = (percent) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  const { plano_ativo, modulos_ativos, total_motoristas, total_veiculos, 
          custo_mensal, custo_anual, tipo_cobranca, limite_veiculos, 
          limite_motoristas, percentual_uso_veiculos, percentual_uso_motoristas } = dashboardData;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <span>Meu Plano e Módulos</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Visão geral do seu plano ativo e custos
          </p>
        </div>

        {/* Alert se não tiver plano */}
        {!plano_ativo && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Nenhum plano ativo</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Entre em contacto com o administrador para ativar um plano e ter acesso a todos os módulos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Custo Mensal */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Custo Mensal</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    €{custo_mensal.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {getTipoCobrancaLabel(tipo_cobranca)}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Custo Anual */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Custo Anual</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">
                    €{custo_anual.toFixed(2)}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Previsão anual
                  </p>
                </div>
                <Calendar className="w-12 h-12 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Total Veículos */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Veículos</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    {total_veiculos}
                    {limite_veiculos && <span className="text-lg text-green-600">/{limite_veiculos}</span>}
                  </p>
                  {tipo_cobranca === 'por_veiculo' && (
                    <p className="text-xs text-green-600 mt-1">
                      €{(plano_ativo?.preco || 0).toFixed(2)}/veículo
                    </p>
                  )}
                </div>
                <Car className="w-12 h-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Total Motoristas */}
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700 font-medium">Motoristas</p>
                  <p className="text-3xl font-bold text-amber-900 mt-1">
                    {total_motoristas}
                    {limite_motoristas && <span className="text-lg text-amber-600">/{limite_motoristas}</span>}
                  </p>
                  {tipo_cobranca === 'por_motorista' && (
                    <p className="text-xs text-amber-600 mt-1">
                      €{(plano_ativo?.preco || 0).toFixed(2)}/motorista
                    </p>
                  )}
                </div>
                <Users className="w-12 h-12 text-amber-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plano Ativo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-purple-600" />
                <span>Plano Ativo</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plano_ativo ? (
                <>
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-slate-800">{plano_ativo.nome}</h3>
                    <p className="text-sm text-slate-600 mt-1">{plano_ativo.descricao}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tipo de Cobrança:</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {getTipoCobrancaLabel(tipo_cobranca)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Valor Base:</span>
                      <span className="font-semibold">€{(plano_ativo.preco || 0).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Periodicidade:</span>
                      <span className="font-semibold capitalize">{plano_ativo.periodicidade || 'Mensal'}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Módulos Incluídos:</span>
                      <span className="font-semibold">{modulos_ativos.length}</span>
                    </div>
                  </div>

                  {/* Limites e Progresso */}
                  {(limite_veiculos || limite_motoristas) && (
                    <div className="space-y-3 pt-3 border-t">
                      {limite_veiculos && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Uso de Veículos</span>
                            <span className="font-semibold">{total_veiculos}/{limite_veiculos}</span>
                          </div>
                          <Progress value={percentual_uso_veiculos} className={getProgressColor(percentual_uso_veiculos)} />
                          {percentual_uso_veiculos >= 90 && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Limite quase atingido! Considere upgrade.
                            </p>
                          )}
                        </div>
                      )}

                      {limite_motoristas && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Uso de Motoristas</span>
                            <span className="font-semibold">{total_motoristas}/{limite_motoristas}</span>
                          </div>
                          <Progress value={percentual_uso_motoristas} className={getProgressColor(percentual_uso_motoristas)} />
                          {percentual_uso_motoristas >= 90 && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Limite quase atingido! Considere upgrade.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-slate-500 py-8">Nenhum plano ativo</p>
              )}
            </CardContent>
          </Card>

          {/* Módulos Ativos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-green-600" />
                <span>Módulos Ativos ({modulos_ativos.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {modulos_ativos.length > 0 ? (
                <div className="space-y-2">
                  {modulos_ativos.map((modulo) => (
                    <div key={modulo} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-green-900">
                        {modulo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum módulo ativo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Como funciona a cobrança:</p>
                <ul className="space-y-1 text-blue-800">
                  {tipo_cobranca === 'por_veiculo' && (
                    <li>• Você paga €{(plano_ativo?.preco || 0).toFixed(2)} por cada veículo gerido</li>
                  )}
                  {tipo_cobranca === 'por_motorista' && (
                    <li>• Você paga €{(plano_ativo?.preco || 0).toFixed(2)} por cada motorista registado</li>
                  )}
                  {tipo_cobranca === 'mensal_fixo' && (
                    <>
                      <li>• Valor fixo de €{(plano_ativo?.preco || 0).toFixed(2)}/mês</li>
                      {limite_veiculos && <li>• Limite de {limite_veiculos} veículos incluídos</li>}
                      {limite_motoristas && <li>• Limite de {limite_motoristas} motoristas incluídos</li>}
                    </>
                  )}
                  <li>• Os valores são calculados automaticamente no final de cada mês</li>
                  <li>• Para alterar seu plano, contacte o administrador</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DashboardPlanosAtivos;
