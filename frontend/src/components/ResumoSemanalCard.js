import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  BarChart3
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ResumoSemanalCard = ({ parceiroId }) => {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    
    setSemana(currentWeek);
    setAno(now.getFullYear());
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchResumo();
      fetchHistorico();
    }
  }, [semana, ano, parceiroId]);

  const fetchResumo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResumo(response.data);
    } catch (error) {
      console.error('Erro ao carregar resumo semanal:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/historico-semanal?semanas=6&semana_atual=${semana}&ano_atual=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorico(response.data.historico || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setHistorico([]);
    }
  };

  const handlePreviousWeek = () => {
    if (semana > 1) {
      setSemana(semana - 1);
    } else {
      setSemana(52);
      setAno(ano - 1);
    }
  };

  const handleNextWeek = () => {
    if (semana < 52) {
      setSemana(semana + 1);
    } else {
      setSemana(1);
      setAno(ano + 1);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatCurrencyShort = (value) => {
    if (value >= 1000) {
      return `€${(value / 1000).toFixed(1)}k`;
    }
    return `€${Math.round(value || 0)}`;
  };

  if (loading) {
    return (
      <Card data-testid="resumo-semanal-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  const totais = resumo?.totais || {};
  
  // Cálculos do parceiro
  const totalGanhos = totais.total_ganhos || 0;
  const totalDespesasOperacionais = (totais.total_combustivel || 0) + (totais.total_eletrico || 0) + (totais.total_via_verde || 0);
  const totalComissoesMotoristas = totais.total_comissoes_motoristas || 0;
  const liquidoParceiro = totais.total_liquido_parceiro || (totalGanhos - totalDespesasOperacionais - totalComissoesMotoristas);
  const isPositive = liquidoParceiro >= 0;

  // Calcular altura máxima para o gráfico
  const maxValue = Math.max(
    ...historico.map(h => Math.max(h.ganhos || 0, h.despesas || 0, Math.abs(h.liquido || 0))),
    1
  );

  return (
    <Card data-testid="resumo-semanal-card" className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Resumo Semanal do Parceiro
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handlePreviousWeek}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              Semana {semana}/{ano}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNextWeek}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Cards de Resumo - 4 colunas */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {/* Ganhos */}
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Ganhos</span>
            </div>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(totalGanhos)}
            </p>
            <div className="text-xs text-green-600 mt-1">
              <div>Uber: {formatCurrency(totais.total_ganhos_uber)}</div>
              <div>Bolt: {formatCurrency(totais.total_ganhos_bolt)}</div>
            </div>
          </div>

          {/* Despesas Operacionais */}
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <p className="text-lg font-bold text-orange-700">
              {formatCurrency(totalDespesasOperacionais)}
            </p>
            <div className="text-xs text-orange-600 mt-1">
              <div>Comb: {formatCurrency(totais.total_combustivel)}</div>
              <div>VV: {formatCurrency(totais.total_via_verde)}</div>
              <div>Elét: {formatCurrency(totais.total_eletrico)}</div>
            </div>
          </div>

          {/* Comissões Motoristas */}
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Comissões</span>
            </div>
            <p className="text-lg font-bold text-purple-700">
              {formatCurrency(totalComissoesMotoristas)}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {resumo?.total_motoristas || 0} motoristas
            </p>
          </div>

          {/* Líquido Parceiro */}
          <div className={`rounded-lg p-3 text-center ${isPositive ? 'bg-blue-50' : 'bg-red-50'}`}>
            <div className={`flex items-center justify-center gap-1 mb-1 ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Líquido</span>
            </div>
            <p className={`text-xl font-bold ${isPositive ? 'text-blue-700' : 'text-red-700'}`}>
              {formatCurrency(liquidoParceiro)}
            </p>
            <p className={`text-xs mt-1 ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
              Parceiro
            </p>
          </div>
        </div>

        {/* Gráfico de Evolução */}
        {historico.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Evolução Semanal</span>
            </div>
            
            {/* Legenda */}
            <div className="flex justify-center gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Ganhos</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span>Despesas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <span>Líquido</span>
              </div>
            </div>

            {/* Barras do Gráfico */}
            <div className="flex items-end justify-between gap-1 h-32 px-2">
              {historico.map((item, index) => {
                const ganhoHeight = (item.ganhos / maxValue) * 100;
                const despesaHeight = (item.despesas / maxValue) * 100;
                const liquidoHeight = (Math.abs(item.liquido) / maxValue) * 100;
                const isLiquidoPositivo = item.liquido >= 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10 whitespace-nowrap">
                      <div className="font-semibold mb-1">S{item.semana}/{item.ano}</div>
                      <div className="text-green-300">Ganhos: {formatCurrency(item.ganhos)}</div>
                      <div className="text-orange-300">Despesas: {formatCurrency(item.despesas)}</div>
                      <div className={isLiquidoPositivo ? 'text-blue-300' : 'text-red-300'}>
                        Líquido: {formatCurrency(item.liquido)}
                      </div>
                    </div>
                    
                    {/* Barras */}
                    <div className="flex gap-0.5 items-end h-24">
                      <div 
                        className="w-2 bg-green-500 rounded-t transition-all duration-300 hover:bg-green-400"
                        style={{ height: `${Math.max(ganhoHeight, 2)}%` }}
                      ></div>
                      <div 
                        className="w-2 bg-orange-500 rounded-t transition-all duration-300 hover:bg-orange-400"
                        style={{ height: `${Math.max(despesaHeight, 2)}%` }}
                      ></div>
                      <div 
                        className={`w-2 rounded-t transition-all duration-300 ${isLiquidoPositivo ? 'bg-blue-500 hover:bg-blue-400' : 'bg-red-500 hover:bg-red-400'}`}
                        style={{ height: `${Math.max(liquidoHeight, 2)}%` }}
                      ></div>
                    </div>
                    
                    {/* Label da semana */}
                    <span className="text-xs text-slate-500 mt-1">
                      S{item.semana}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info adicional */}
        <div className="text-xs text-slate-500 text-center border-t pt-2 mt-2">
          {resumo?.periodo || `Semana ${semana}/${ano}`}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResumoSemanalCard;
