import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Award, Search, RefreshCw, TrendingUp, Star, Shield, 
  Clock, Car, AlertTriangle, CheckCircle, Users, ChevronUp
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Cores e ícones para cada nível
const NIVEIS_CONFIG = {
  'Bronze': { cor: 'bg-amber-700', texto: 'text-amber-700', icone: '🥉' },
  'Prata': { cor: 'bg-slate-400', texto: 'text-slate-500', icone: '🥈' },
  'Ouro': { cor: 'bg-yellow-500', texto: 'text-yellow-600', icone: '🥇' },
  'Platina': { cor: 'bg-cyan-500', texto: 'text-cyan-600', icone: '💎' },
  'Diamante': { cor: 'bg-purple-500', texto: 'text-purple-600', icone: '👑' }
};

export default function ProgressoesMotoristas({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [motoristas, setMotoristas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recalculando, setRecalculando] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [progressaoDetails, setProgressaoDetails] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAvaliacaoDialog, setShowAvaliacaoDialog] = useState(false);
  const [avaliacao, setAvaliacao] = useState(50);
  const [savingAvaliacao, setSavingAvaliacao] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    bronze: 0,
    prata: 0,
    ouro: 0,
    platina: 0,
    diamante: 0
  });

  const fetchMotoristas = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const motoristasData = response.data || [];
      setMotoristas(motoristasData);
      
      // Calcular estatísticas
      const newStats = {
        total: motoristasData.length,
        bronze: motoristasData.filter(m => (m.classificacao || 'Bronze') === 'Bronze').length,
        prata: motoristasData.filter(m => m.classificacao === 'Prata').length,
        ouro: motoristasData.filter(m => m.classificacao === 'Ouro').length,
        platina: motoristasData.filter(m => m.classificacao === 'Platina').length,
        diamante: motoristasData.filter(m => m.classificacao === 'Diamante').length
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMotoristas();
  }, [fetchMotoristas]);

  const handleRecalcularTodas = async () => {
    setRecalculando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/comissoes/classificacao/recalcular-todas`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const result = response.data;
      if (result.resumo?.promovidos > 0) {
        toast.success(`${result.resumo.promovidos} motorista(s) promovido(s)!`);
      } else {
        toast.info('Classificações recalculadas. Nenhuma promoção elegível.');
      }
      
      fetchMotoristas();
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error('Erro ao recalcular classificações');
    } finally {
      setRecalculando(false);
    }
  };

  const handleVerProgressao = async (motorista) => {
    setSelectedMotorista(motorista);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/comissoes/classificacao/motorista/${motorista.id}/progressao`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgressaoDetails(response.data);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching progressao:', error);
      toast.error('Erro ao carregar detalhes de progressão');
    }
  };

  const handleOpenAvaliacao = (motorista) => {
    setSelectedMotorista(motorista);
    setAvaliacao(motorista.avaliacao_parceiro || 50);
    setShowAvaliacaoDialog(true);
  };

  const handleSaveAvaliacao = async () => {
    setSavingAvaliacao(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/comissoes/classificacao/motorista/${selectedMotorista.id}/avaliacao-parceiro?avaliacao=${avaliacao}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Avaliação guardada com sucesso!');
      setShowAvaliacaoDialog(false);
      fetchMotoristas();
    } catch (error) {
      console.error('Error saving avaliacao:', error);
      toast.error('Erro ao guardar avaliação');
    } finally {
      setSavingAvaliacao(false);
    }
  };

  const handlePromoverMotorista = async (motorista) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/comissoes/classificacao/motorista/${motorista.id}/promover`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.sucesso) {
        toast.success(`${motorista.nome || motorista.name} promovido para ${response.data.nivel_novo.nome}!`);
        fetchMotoristas();
        setShowDetailsDialog(false);
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.mensagem) {
        toast.error(detail.mensagem);
      } else {
        toast.error('Erro ao promover motorista');
      }
    }
  };

  const filteredMotoristas = motoristas.filter(m => {
    const nome = (m.nome || m.name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return nome.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
  });

  const getNivelConfig = (nivel) => NIVEIS_CONFIG[nivel] || NIVEIS_CONFIG['Bronze'];

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="progressoes-motoristas-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-7 h-7 text-amber-500" />
              Progressões de Motoristas
            </h1>
            <p className="text-slate-600 mt-1">
              Gerir classificações e progressões dos motoristas
            </p>
          </div>
          
          {user?.role === 'admin' && (
            <Button
              onClick={handleRecalcularTodas}
              disabled={recalculando}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="btn-recalcular-todas"
            >
              {recalculando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recalcular Todas
                </>
              )}
            </Button>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
              <p className="text-sm text-slate-500">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.bronze}</p>
              <p className="text-sm text-amber-600">🥉 Bronze</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-100 border-slate-300">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-500">{stats.prata}</p>
              <p className="text-sm text-slate-500">🥈 Prata</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.ouro}</p>
              <p className="text-sm text-yellow-600">🥇 Ouro</p>
            </CardContent>
          </Card>
          <Card className="bg-cyan-50 border-cyan-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-cyan-600">{stats.platina}</p>
              <p className="text-sm text-cyan-600">💎 Platina</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.diamante}</p>
              <p className="text-sm text-purple-600">👑 Diamante</p>
            </CardContent>
          </Card>
        </div>

        {/* Pesquisa */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Pesquisar motorista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-motorista"
          />
        </div>

        {/* Lista de Motoristas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredMotoristas.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              Nenhum motorista encontrado
            </div>
          ) : (
            filteredMotoristas.map(motorista => {
              const nivel = motorista.classificacao || 'Bronze';
              const config = getNivelConfig(nivel);
              
              return (
                <Card key={motorista.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${config.cor} flex items-center justify-center text-white text-lg`}>
                          {config.icone}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {motorista.nome || motorista.name}
                          </h3>
                          <p className="text-sm text-slate-500">{motorista.email}</p>
                        </div>
                      </div>
                      <Badge className={`${config.cor} text-white`}>
                        {nivel}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Desde: {motorista.created_at ? new Date(motorista.created_at).toLocaleDateString('pt-PT') : 'N/A'}</span>
                      </div>
                      {motorista.avaliacao_parceiro !== undefined && (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>Avaliação: {motorista.avaliacao_parceiro}/100</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerProgressao(motorista)}
                        className="flex-1"
                        data-testid={`btn-ver-progressao-${motorista.id}`}
                      >
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Progressão
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAvaliacao(motorista)}
                        className="flex-1"
                        data-testid={`btn-avaliar-${motorista.id}`}
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Avaliar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Dialog de Detalhes de Progressão */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Detalhes de Progressão
              </DialogTitle>
            </DialogHeader>
            
            {progressaoDetails && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">{progressaoDetails.motorista_nome}</h3>
                </div>
                
                {/* Nível Actual */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 mb-2">Nível Actual</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{NIVEIS_CONFIG[progressaoDetails.nivel_atual?.nome]?.icone || '🥉'}</span>
                    <div>
                      <p className="font-semibold">{progressaoDetails.nivel_atual?.nome || 'Bronze'}</p>
                      <p className="text-sm text-green-600">+{progressaoDetails.nivel_atual?.bonus_percentagem || 0}% bónus</p>
                    </div>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">{progressaoDetails.meses_servico}</p>
                    <p className="text-sm text-blue-700">Meses de Serviço</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{progressaoDetails.pontuacao_cuidado}</p>
                    <p className="text-sm text-green-700">Pontuação Cuidado</p>
                  </div>
                </div>

                {/* Próximo Nível */}
                {progressaoDetails.proximo_nivel && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 mb-2">Próximo Nível: {progressaoDetails.proximo_nivel.nome}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Meses necessários:</span>
                        <span className={progressaoDetails.meses_servico >= progressaoDetails.proximo_nivel.meses_minimos ? 'text-green-600' : 'text-red-600'}>
                          {progressaoDetails.meses_servico}/{progressaoDetails.proximo_nivel.meses_minimos}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pontuação necessária:</span>
                        <span className={progressaoDetails.pontuacao_cuidado >= progressaoDetails.proximo_nivel.cuidado_veiculo_minimo ? 'text-green-600' : 'text-red-600'}>
                          {progressaoDetails.pontuacao_cuidado}/{progressaoDetails.proximo_nivel.cuidado_veiculo_minimo}
                        </span>
                      </div>
                    </div>
                    
                    {progressaoDetails.elegivel_promocao ? (
                      <div className="mt-3 p-2 bg-green-100 rounded text-green-800 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Elegível para promoção!
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-amber-700">
                        {progressaoDetails.razoes_falta?.map((razao, idx) => (
                          <p key={idx} className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {razao}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!progressaoDetails.proximo_nivel && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                    <p className="text-purple-800 font-medium">👑 Nível Máximo Atingido!</p>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Fechar
              </Button>
              {progressaoDetails?.elegivel_promocao && (
                <Button
                  onClick={() => handlePromoverMotorista(selectedMotorista)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Promover Agora
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Avaliação */}
        <Dialog open={showAvaliacaoDialog} onOpenChange={setShowAvaliacaoDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Avaliar Motorista
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="font-medium">{selectedMotorista?.nome || selectedMotorista?.name}</p>
              </div>
              
              <div className="space-y-3">
                <Label>Avaliação do Cuidado com Veículo: {avaliacao}/100</Label>
                <Slider
                  value={[avaliacao]}
                  onValueChange={(value) => setAvaliacao(value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Mau</span>
                  <span>Razoável</span>
                  <span>Bom</span>
                  <span>Excelente</span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600">
                Esta avaliação contribui 15% para a pontuação de cuidado com veículo do motorista.
              </p>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAvaliacaoDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAvaliacao}
                disabled={savingAvaliacao}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {savingAvaliacao ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  'Guardar Avaliação'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
