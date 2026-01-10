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
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ResumoSemanalCard = ({ parceiroId }) => {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);

  useEffect(() => {
    // Initialize with current week
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
  const valorLiquido = totais.total_liquido || 0;
  const isPositive = valorLiquido >= 0;

  return (
    <Card data-testid="resumo-semanal-card" className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Resumo Semanal
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
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Ganhos */}
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Ganhos</span>
            </div>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(totais.total_ganhos)}
            </p>
            <div className="text-xs text-green-600 mt-1">
              <span>Uber: {formatCurrency(totais.total_ganhos_uber)}</span>
              <span className="mx-1">|</span>
              <span>Bolt: {formatCurrency(totais.total_ganhos_bolt)}</span>
            </div>
          </div>

          {/* Despesas */}
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(totais.total_despesas)}
            </p>
            <div className="text-xs text-red-600 mt-1 space-y-0.5">
              <div>
                <span>Comb: {formatCurrency(totais.total_combustivel)}</span>
                <span className="mx-1">|</span>
                <span>Elét: {formatCurrency(totais.total_eletrico)}</span>
              </div>
              <div>
                <span>VV: {formatCurrency(totais.total_via_verde)}</span>
                <span className="mx-1">|</span>
                <span>Alug: {formatCurrency(totais.total_aluguer)}</span>
              </div>
            </div>
          </div>

          {/* Valor Líquido */}
          <div className={`rounded-lg p-3 text-center ${isPositive ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className={`flex items-center justify-center gap-1 mb-1 ${isPositive ? 'text-blue-600' : 'text-orange-600'}`}>
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Líquido</span>
            </div>
            <p className={`text-xl font-bold ${isPositive ? 'text-blue-700' : 'text-orange-700'}`}>
              {formatCurrency(valorLiquido)}
            </p>
            <p className={`text-xs mt-1 ${isPositive ? 'text-blue-600' : 'text-orange-600'}`}>
              {resumo?.total_motoristas || 0} motoristas
            </p>
          </div>
        </div>

        {/* Info adicional */}
        <div className="text-xs text-slate-500 text-center border-t pt-2">
          {resumo?.periodo || `Semana ${semana}/${ano}`}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResumoSemanalCard;
