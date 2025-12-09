import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, Package, 
  Calendar, CheckCircle, Zap, ArrowRight
} from 'lucide-react';

const MeuPlanoMotorista = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [planoData, setPlanoData] = useState(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState([]);
  const [showTrocarPlano, setShowTrocarPlano] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState('');
  const [periodicidadeSelecionada, setPeriodicidadeSelecionada] = useState('mensal');

  useEffect(() => {
    fetchMeuPlano();
    fetchPlanosDisponiveis();
  }, []);

  const fetchMeuPlano = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motorista/meu-plano`, {
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

  const fetchPlanosDisponiveis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const planosMotorista = response.data.filter(p => p.tipo_usuario === 'motorista' && p.ativo);
      setPlanosDisponiveis(planosMotorista);
    } catch (error) {
      console.error('Error fetching planos:', error);
    }
  };

  const handleTrocarPlano = async () => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/users/trocar-plano`,
        {
          plano_id: planoSelecionado,
          periodicidade: periodicidadeSelecionada
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Plano alterado com sucesso!');
      setShowTrocarPlano(false);
      fetchMeuPlano();
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error(error.response?.data?.detail || 'Erro ao trocar plano');
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

  if (!planoData || !planoData.tem_plano) {
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

  const { plano, modulos, preco_semanal, preco_mensal } = planoData;

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
            <p className="text-slate-600 mt-2">Gerir a sua subscrição</p>
          </div>
          <Button onClick={() => setShowTrocarPlano(true)} variant="outline">
            Trocar Plano
          </Button>
        </div>

        {/* Plan Overview */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{plano.nome}</span>
              <Badge variant="default">Ativo</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-6">{plano.descricao || 'Sem descrição'}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{preco_semanal}€</div>
                <div className="text-sm text-slate-600">Semanal</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{preco_mensal}€</div>
                <div className="text-sm text-slate-600">Mensal</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Módulos Incluídos ({modulos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modulos.map((modulo) => (
                <div key={modulo.codigo} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-slate-800">{modulo.nome}</h4>
                    <p className="text-sm text-slate-600">{modulo.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Trocar Plano */}
      <Dialog open={showTrocarPlano} onOpenChange={setShowTrocarPlano}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolher Novo Plano</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {planosDisponiveis.map((p) => (
                <Card 
                  key={p.id} 
                  className={`cursor-pointer transition-all ${
                    planoSelecionado === p.id ? 'border-blue-500 shadow-md' : 'hover:border-blue-300'
                  }`}
                  onClick={() => setPlanoSelecionado(p.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{p.nome}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">{p.descricao}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Semanal:</span>
                        <span className="font-bold">{p.precos?.semanal?.preco_com_iva || 0}€</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Mensal:</span>
                        <span className="font-bold">{p.precos?.mensal?.preco_com_iva || 0}€</span>
                      </div>
                    </div>
                    <Badge className="mt-4" variant="outline">
                      {p.modulos?.length || 0} módulos
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {planoSelecionado && (
              <div>
                <label className="block text-sm font-medium mb-2">Periodicidade</label>
                <Select value={periodicidadeSelecionada} onValueChange={setPeriodicidadeSelecionada}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowTrocarPlano(false)}>
                Cancelar
              </Button>
              <Button onClick={handleTrocarPlano} disabled={!planoSelecionado}>
                Confirmar Troca
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MeuPlanoMotorista;
