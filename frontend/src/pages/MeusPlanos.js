import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Package, CheckCircle, Clock, CreditCard, Calendar, AlertCircle } from 'lucide-react';

const MeusPlanos = ({ user, onLogout }) => {
  const [planos, setPlanos] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [periodo, setPeriodo] = useState('mensal');
  const [pagamentoMetodo, setPagamentoMetodo] = useState('multibanco');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [planosRes, subsRes] = await Promise.all([
        axios.get(`${API}/planos`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/subscriptions/minhas`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setPlanos(planosRes.data);
      setSubscriptions(subsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarPlano = async () => {
    if (!selectedPlano) {
      toast.error('Selecione um plano');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/subscriptions/solicitar`, {
        plano_id: selectedPlano.id,
        periodo,
        pagamento_metodo: pagamentoMetodo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Subscrição criada! Complete o pagamento.');
      setShowSolicitarModal(false);
      fetchData();
      
      // Show payment details
      const pagamento = response.data.pagamento;
      alert(`Pagamento ${pagamento.metodo}\n\nEntidade: ${pagamento.entidade}\nReferência: ${pagamento.referencia}\nValor: €${pagamento.valor.toFixed(2)}`);
    } catch (error) {
      console.error('Error requesting subscription:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Erro ao solicitar plano';
      toast.error(errorMsg);
    }
  };

  const calculatePreco = (plano, periodo) => {
    let preco = periodo === 'semanal' ? plano.preco_semanal_sem_iva : plano.preco_mensal_sem_iva;
    
    // Apply monthly discount
    if (periodo === 'mensal' && plano.desconto_mensal_percentagem > 0) {
      preco = preco * (1 - plano.desconto_mensal_percentagem / 100);
    }
    
    // Apply promotion
    if (plano.promocao?.ativa) {
      const validaAte = new Date(plano.promocao.valida_ate);
      if (validaAte >= new Date()) {
        preco = preco * (1 - plano.promocao.desconto_percentagem / 100);
      }
    }
    
    // Add IVA
    preco = preco * (1 + plano.iva_percentagem / 100);
    
    return preco.toFixed(2);
  };

  const getStatusBadge = (status) => {
    const badges = {
      ativo: 'bg-green-100 text-green-800',
      pendente: 'bg-yellow-100 text-yellow-800',
      expirado: 'bg-red-100 text-red-800',
      cancelado: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || badges.pendente;
  };

  if (loading) {
    return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Meus Planos</h1>

        {/* Active Subscriptions */}
        {subscriptions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Subscrições Ativas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{sub.plano_nome}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(sub.status)}`}>
                        {sub.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Período: {sub.periodo}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CreditCard className="w-4 h-4 mr-2" />
                      <span>Preço: €{sub.preco_pago}</span>
                    </div>
                    {sub.data_expiracao && (
                      <div className="flex items-center text-sm">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>Expira: {new Date(sub.data_expiracao).toLocaleDateString()}</span>
                      </div>
                    )}
                    {sub.status === 'pendente' && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">Aguardando Pagamento</p>
                        <p className="text-xs text-yellow-700">Entidade: {sub.pagamento_entidade}</p>
                        <p className="text-xs text-yellow-700">Referência: {sub.pagamento_referencia}</p>
                        <p className="text-xs text-yellow-700">Valor: €{sub.preco_pago}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Plans */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Planos Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planos.map((plano) => (
              <Card key={plano.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>{plano.nome}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-slate-600 mb-4">{plano.descricao}</p>
                  
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Semanal:</span>
                      <span className="text-lg font-bold">€{calculatePreco(plano, 'semanal')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Mensal:</span>
                      <span className="text-lg font-bold text-green-600">€{calculatePreco(plano, 'mensal')}</span>
                    </div>
                    {plano.desconto_mensal_percentagem > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Poupe {plano.desconto_mensal_percentagem}% no pagamento mensal!
                      </p>
                    )}
                  </div>

                  {plano.promocao?.ativa && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 mb-4">
                      <p className="text-xs font-semibold text-red-700">{plano.promocao.nome}</p>
                      <p className="text-xs text-red-600">-{plano.promocao.desconto_percentagem}%</p>
                    </div>
                  )}

                  <div className="space-y-1 mb-4 flex-1">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Funcionalidades:</p>
                    {plano.features.map((feature) => (
                      <div key={feature} className="flex items-center text-xs text-slate-600">
                        <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                        {feature.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedPlano(plano);
                      setShowSolicitarModal(true);
                    }}
                    className="w-full"
                  >
                    Solicitar Plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Solicitar Plano Modal */}
        <Dialog open={showSolicitarModal} onOpenChange={setShowSolicitarModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Plano: {selectedPlano?.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Período de Pagamento</Label>
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant={periodo === 'semanal' ? 'default' : 'outline'}
                    onClick={() => setPeriodo('semanal')}
                    className="flex-1"
                  >
                    Semanal - €{selectedPlano && calculatePreco(selectedPlano, 'semanal')}
                  </Button>
                  <Button
                    variant={periodo === 'mensal' ? 'default' : 'outline'}
                    onClick={() => setPeriodo('mensal')}
                    className="flex-1"
                  >
                    Mensal - €{selectedPlano && calculatePreco(selectedPlano, 'mensal')}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Método de Pagamento</Label>
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant={pagamentoMetodo === 'multibanco' ? 'default' : 'outline'}
                    onClick={() => setPagamentoMetodo('multibanco')}
                    className="flex-1"
                  >
                    Multibanco
                  </Button>
                  <Button
                    variant={pagamentoMetodo === 'mbway' ? 'default' : 'outline'}
                    onClick={() => setPagamentoMetodo('mbway')}
                    className="flex-1"
                  >
                    MB WAY
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 text-blue-600" />
                  <p className="text-xs text-blue-800">
                    O plano será ativado automaticamente após confirmação do pagamento. 
                    Você receberá os dados de pagamento após solicitar.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowSolicitarModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSolicitarPlano}>
                  Confirmar Solicitação
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default MeusPlanos;
