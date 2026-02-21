import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import AdicionarRecursosCard from '@/components/AdicionarRecursosCard';
import { 
  DollarSign, TrendingUp, Users, Car, Package, 
  Calendar, CheckCircle, Info, Zap, ArrowRight,
  AlertTriangle, Percent, HardDrive, Code, BarChart
} from 'lucide-react';

const MeuPlanoParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planoData, setPlanoData] = useState(null);

  useEffect(() => {
    fetchMeuPlano();
  }, []);

  const fetchMeuPlano = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/meu-plano`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanoData(response.data);
    } catch (error) {
      console.error('Error fetching plano:', error);
      toast.error('Erro ao carregar plano');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 mt-4">A carregar plano...</p>
        </div>
      </Layout>
    );
  }

  // Verifica se tem plano (pode vir como tem_plano ou plano)
  const temPlano = planoData?.tem_plano || planoData?.plano;
  
  if (!planoData || !temPlano) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Sem Plano Ativo</h3>
            <p className="text-slate-600 mb-4">Não tem nenhum plano ativo no momento.</p>
            <Button onClick={() => setShowTrocarPlano(true)}>
              Escolher Plano
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const { plano, modulos = [], custo_semanal = 0, custo_mensal = 0, total_veiculos = 0, total_motoristas = 0, motoristas_com_recibos = 0, detalhes_calculo } = planoData;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-8 h-8" />
              Meu Plano
            </h1>
            <p className="text-slate-600 mt-2">Gerir a sua subscrição e módulos</p>
          </div>
          <Button onClick={() => navigate('/loja-planos')} variant="default">
            Ver Planos Disponíveis
          </Button>
        </div>

        {/* Plan Overview */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{plano.nome}</span>
              <Badge variant="default">Ativo</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{plano.descricao || 'Sem descrição'}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Car className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{total_veiculos}</div>
                <div className="text-sm text-slate-600">Veículos</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{total_motoristas}</div>
                <div className="text-sm text-slate-600">Motoristas</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-600">{custo_semanal}€</div>
                <div className="text-sm text-slate-600">Semanal</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">{custo_mensal}€</div>
                <div className="text-sm text-slate-600">Mensal</div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Detalhes do Custo Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Preço Base */}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Preço base:</span>
                  <span className="font-medium">€{detalhes_calculo?.preco_base_semanal ? (detalhes_calculo.preco_base_semanal * 4).toFixed(2) : '0.00'}</span>
                </div>
                
                {/* Custo por Veículos */}
                {detalhes_calculo?.por_veiculo_semanal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Car className="w-4 h-4 text-blue-500" />
                      {total_veiculos} veículo(s) × €{(detalhes_calculo.por_veiculo_semanal * 4).toFixed(2)}:
                    </span>
                    <span className="font-medium text-blue-600">+€{(detalhes_calculo.custo_veiculos * 4).toFixed(2)}</span>
                  </div>
                )}
                
                {/* Custo por Motoristas */}
                {detalhes_calculo?.por_motorista_semanal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Users className="w-4 h-4 text-green-500" />
                      {total_motoristas} motorista(s) × €{(detalhes_calculo.por_motorista_semanal * 4).toFixed(2)}:
                    </span>
                    <span className="font-medium text-green-600">+€{(detalhes_calculo.custo_motoristas * 4).toFixed(2)}</span>
                  </div>
                )}
                
                {/* Recibos */}
                {plano.opcao_recibos_motorista && detalhes_calculo?.custo_recibos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Recibos ({motoristas_com_recibos} motoristas):</span>
                    <span className="font-medium">+€{(detalhes_calculo.custo_recibos * 4).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Mensal:</span>
                    <span className="text-blue-600">€{custo_mensal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    * Valor atualizado automaticamente quando adiciona veículos ou motoristas
                  </p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Modules Incluídos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Módulos Incluídos no Plano ({modulos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modulos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {modulos.map((modulo) => (
                  <div key={modulo.codigo} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-slate-800">{modulo.nome}</h4>
                      <p className="text-sm text-slate-600">{modulo.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">Nenhum módulo incluído no seu plano atual</p>
            )}
          </CardContent>
        </Card>

        {/* Módulos Disponíveis Extra */}
        <Card className="border-purple-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-white">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Módulos Disponíveis Extra
            </CardTitle>
            <p className="text-sm text-slate-600">Adicione funcionalidades extra ao seu plano</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Módulo Contabilidade */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <Badge variant="outline" className="text-purple-600 border-purple-300">+4.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">Contabilidade Avançada</h4>
                <p className="text-sm text-slate-600 mb-3">Relatórios financeiros, exportação para contabilistas, IVA automático</p>
                <Button size="sm" variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50">
                  Adicionar
                </Button>
              </div>

              {/* Módulo Alertas */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">+2.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">Alertas Avançados</h4>
                <p className="text-sm text-slate-600 mb-3">Notificações SMS, WhatsApp, alertas de manutenção e documentos</p>
                <Button size="sm" variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-50">
                  Adicionar
                </Button>
              </div>

              {/* Módulo Comissões */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Percent className="w-5 h-5 text-emerald-600" />
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300">+3.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">Gestão de Comissões</h4>
                <p className="text-sm text-slate-600 mb-3">Cálculo automático de comissões, relatórios por motorista</p>
                <Button size="sm" variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  Adicionar
                </Button>
              </div>

              {/* Módulo Cloud Storage */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-blue-600" />
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-300">+1.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">Cloud Storage</h4>
                <p className="text-sm text-slate-600 mb-3">Armazenamento na cloud, backup automático de documentos</p>
                <Button size="sm" variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
                  Adicionar
                </Button>
              </div>

              {/* Módulo API */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Code className="w-5 h-5 text-slate-600" />
                  </div>
                  <Badge variant="outline" className="text-slate-600 border-slate-300">+9.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">API & Integrações</h4>
                <p className="text-sm text-slate-600 mb-3">Acesso à API, webhooks, integração com sistemas externos</p>
                <Button size="sm" variant="outline" className="w-full border-slate-300 text-slate-700 hover:bg-slate-50">
                  Adicionar
                </Button>
              </div>

              {/* Módulo Relatórios */}
              <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-purple-400 transition-colors bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <BarChart className="w-5 h-5 text-indigo-600" />
                  </div>
                  <Badge variant="outline" className="text-indigo-600 border-indigo-300">+5.99€/mês</Badge>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">Relatórios Avançados</h4>
                <p className="text-sm text-slate-600 mb-3">Dashboards personalizados, exportação Excel, análises detalhadas</p>
                <Button size="sm" variant="outline" className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Adicionar Recursos (Sistema de Pré-Pagamento) */}
        <AdicionarRecursosCard 
          userId={user?.id} 
          onAdicaoCompleta={fetchMeuPlano}
        />
      </div>
    </Layout>
  );
};

export default MeuPlanoParceiro;
