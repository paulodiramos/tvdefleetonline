import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Package, CheckCircle, Clock, CreditCard, Smartphone, Building } from 'lucide-react';

const MotoristaPlanos = ({ motoristaData, onUpdate }) => {
  const [planos, setPlanos] = useState([]);
  const [planoAtual, setPlanoAtual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEscolherPlano, setShowEscolherPlano] = useState(false);
  const [showPagamento, setShowPagamento] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [metodoPagamento, setMetodoPagamento] = useState('multibanco');

  useEffect(() => {
    fetchPlanos();
    fetchPlanoAtual();
  }, []);

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos-motorista`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanoAtual = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${motoristaData.id}/plano-atual`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.plano) {
        setPlanoAtual(response.data);
      }
    } catch (error) {
      console.error('Error fetching current plan:', error);
    }
  };

  const handleEscolherPlano = (plano) => {
    setPlanoSelecionado(plano);
    setShowEscolherPlano(true);
  };

  const handleConfirmarEscolha = () => {
    setShowEscolherPlano(false);
    setShowPagamento(true);
  };

  const handleIniciarPagamento = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        plano_id: planoSelecionado.id,
        periodicidade: periodicidade,
        metodo_pagamento: metodoPagamento
      };

      const response = await axios.post(
        `${API}/motoristas/${motoristaData.id}/iniciar-pagamento-plano`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Pagamento iniciado com sucesso!');
      setShowPagamento(false);
      
      // Mostrar detalhes do pagamento
      if (metodoPagamento === 'multibanco') {
        showMultibancoDetails(response.data);
      } else if (metodoPagamento === 'mbway') {
        showMBWayDetails(response.data);
      }

    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error('Erro ao iniciar pagamento');
    }
  };

  const showMultibancoDetails = (paymentData) => {
    toast.success(
      <div>
        <strong>Referência Multibanco Gerada!</strong>
        <div className="mt-2 space-y-1 text-sm">
          <div>Entidade: <strong>{paymentData.entidade}</strong></div>
          <div>Referência: <strong>{paymentData.referencia}</strong></div>
          <div>Valor: <strong>€{paymentData.valor}</strong></div>
        </div>
        <p className="text-xs mt-2">Efetue o pagamento num multibanco ou homebanking</p>
      </div>,
      { duration: 10000 }
    );
  };

  const showMBWayDetails = (paymentData) => {
    toast.success(
      <div>
        <strong>Pedido MB WAY Enviado!</strong>
        <p className="text-sm mt-2">Verifique a notificação na sua app MB WAY para confirmar o pagamento.</p>
      </div>,
      { duration: 5000 }
    );
  };

  const calcularPreco = (plano, period) => {
    if (period === 'semanal') {
      return plano.preco_semanal || 0;
    } else {
      const precoBase = plano.preco_mensal || 0;
      const desconto = plano.desconto_mensal_percentagem || 0;
      return precoBase * (1 - desconto / 100);
    }
  };

  if (loading) {
    return <div className="text-center py-8">A carregar planos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Plano Atual */}
      {planoAtual && planoAtual.plano ? (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Plano Atual: {planoAtual.plano.nome}</CardTitle>
                <CardDescription>
                  Periodicidade: {planoAtual.assinatura.periodicidade === 'mensal' ? 'Mensal' : 'Semanal'}
                </CardDescription>
              </div>
              <Badge variant="success" className="bg-green-600 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Ativo
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Valor pago:</strong> €{planoAtual.assinatura.preco_pago?.toFixed(2)}</p>
              <p><strong>Data início:</strong> {new Date(planoAtual.assinatura.data_inicio).toLocaleDateString('pt-PT')}</p>
              {planoAtual.assinatura.data_fim && (
                <p><strong>Próxima renovação:</strong> {new Date(planoAtual.assinatura.data_fim).toLocaleDateString('pt-PT')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-yellow-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-2">Nenhum Plano Ativo</h3>
              <p className="text-sm text-slate-600 mb-4">
                Escolha um plano para ter acesso a todas as funcionalidades da plataforma.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planos Disponíveis */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Planos Disponíveis</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {planos.map((plano) => {
            const precoSemanal = plano.preco_semanal || 0;
            const precoMensal = plano.preco_mensal || 0;
            const desconto = plano.desconto_mensal_percentagem || 0;
            const precoMensalFinal = precoMensal * (1 - desconto / 100);
            const isPlanoAtual = planoAtual?.plano?.id === plano.id;

            return (
              <Card key={plano.id} className={`hover:shadow-lg transition-shadow ${isPlanoAtual ? 'border-2 border-blue-500' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{plano.nome}</CardTitle>
                      <CardDescription className="mt-2">{plano.descricao}</CardDescription>
                    </div>
                    {isPlanoAtual && (
                      <Badge className="bg-blue-600 text-white">Atual</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Preços */}
                    <div>
                      <div className="text-2xl font-bold text-slate-800">
                        {precoSemanal === 0 && precoMensal === 0 ? (
                          'Grátis'
                        ) : (
                          <>
                            <div>€{precoSemanal.toFixed(2)}<span className="text-sm font-normal text-slate-600">/semana</span></div>
                            <div className="text-lg mt-1">
                              €{precoMensalFinal.toFixed(2)}<span className="text-sm font-normal text-slate-600">/mês</span>
                              {desconto > 0 && (
                                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                                  -{desconto}%
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700">Funcionalidades:</p>
                      {plano.features && Object.entries(plano.features).map(([key, value]) => {
                        if (!value) return null;
                        const featureLabels = {
                          'alertas_recibos': 'Alertas de Recibos',
                          'alertas_documentos': 'Alertas de Documentos',
                          'dashboard_ganhos': 'Dashboard de Ganhos',
                          'relatorios_semanais': 'Relatórios Semanais',
                          'gestao_documentos': 'Gestão de Documentos',
                          'historico_pagamentos': 'Histórico de Pagamentos',
                          'analytics_avancado': 'Analytics Avançado',
                          'suporte_prioritario': 'Suporte Prioritário',
                          'backup_nuvem': 'Backup na Nuvem'
                        };
                        return (
                          <div key={key} className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>{featureLabels[key] || key}</span>
                          </div>
                        );
                      })}
                    </div>

                    {!isPlanoAtual && (
                      <Button 
                        className="w-full" 
                        onClick={() => handleEscolherPlano(plano)}
                        disabled={plano.preco_semanal === 0 && plano.preco_mensal === 0}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Escolher Plano
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal Escolher Plano */}
      <Dialog open={showEscolherPlano} onOpenChange={setShowEscolherPlano}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolher Periodicidade</DialogTitle>
          </DialogHeader>
          {planoSelecionado && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Plano: <strong>{planoSelecionado.nome}</strong></p>
              </div>

              <RadioGroup value={periodicidade} onValueChange={setPeriodicidade}>
                <div className="flex items-center space-x-2 border rounded p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="semanal" id="semanal" />
                  <Label htmlFor="semanal" className="flex-1 cursor-pointer">
                    <div>
                      <span className="font-semibold">Pagamento Semanal</span>
                      <p className="text-sm text-slate-600">€{planoSelecionado.preco_semanal?.toFixed(2)}/semana</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded p-3 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="mensal" id="mensal" />
                  <Label htmlFor="mensal" className="flex-1 cursor-pointer">
                    <div>
                      <span className="font-semibold">Pagamento Mensal</span>
                      <p className="text-sm text-slate-600">
                        €{calcularPreco(planoSelecionado, 'mensal').toFixed(2)}/mês
                        {planoSelecionado.desconto_mensal_percentagem > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 text-xs">
                            Poupe {planoSelecionado.desconto_mensal_percentagem}%
                          </Badge>
                        )}
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="bg-slate-50 p-3 rounded">
                <p className="text-sm"><strong>Valor a pagar:</strong> €{calcularPreco(planoSelecionado, periodicidade).toFixed(2)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEscolherPlano(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarEscolha}>Continuar para Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pagamento */}
      <Dialog open={showPagamento} onOpenChange={setShowPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Método de Pagamento</DialogTitle>
          </DialogHeader>
          {planoSelecionado && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm"><strong>Plano:</strong> {planoSelecionado.nome}</p>
                <p className="text-sm"><strong>Periodicidade:</strong> {periodicidade === 'mensal' ? 'Mensal' : 'Semanal'}</p>
                <p className="text-sm"><strong>Valor:</strong> €{calcularPreco(planoSelecionado, periodicidade).toFixed(2)}</p>
              </div>

              <div>
                <Label className="mb-2 block">Escolha o método de pagamento:</Label>
                <RadioGroup value={metodoPagamento} onValueChange={setMetodoPagamento}>
                  <div className="flex items-center space-x-2 border rounded p-3 cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="multibanco" id="multibanco" />
                    <Label htmlFor="multibanco" className="flex-1 cursor-pointer flex items-center">
                      <Building className="w-5 h-5 mr-2 text-blue-600" />
                      <div>
                        <span className="font-semibold">Multibanco</span>
                        <p className="text-xs text-slate-600">Pagamento por referência MB</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded p-3 cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="mbway" id="mbway" />
                    <Label htmlFor="mbway" className="flex-1 cursor-pointer flex items-center">
                      <Smartphone className="w-5 h-5 mr-2 text-green-600" />
                      <div>
                        <span className="font-semibold">MB WAY</span>
                        <p className="text-xs text-slate-600">Pagamento via app MB WAY</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800">
                ℹ️ Após confirmar, será gerada uma referência de pagamento. O plano será ativado automaticamente após a confirmação do pagamento.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamento(false)}>Cancelar</Button>
            <Button onClick={handleIniciarPagamento}>
              <CreditCard className="w-4 h-4 mr-2" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotoristaPlanos;
