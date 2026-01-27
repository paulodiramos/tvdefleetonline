import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Car,
  Users,
  Euro,
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Smartphone,
  Building,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';

const AdicionarRecursosCard = ({ userId, onAdicaoCompleta }) => {
  const [loading, setLoading] = useState(true);
  const [subscricao, setSubscricao] = useState(null);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [showAdicionarModal, setShowAdicionarModal] = useState(false);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form para adicionar recursos
  const [adicionarForm, setAdicionarForm] = useState({
    veiculos_adicionar: 0,
    motoristas_adicionar: 0
  });
  
  // Método de pagamento selecionado
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pagamentoInfo, setPagamentoInfo] = useState(null);

  const fetchDados = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [subscricaoRes, pedidosRes] = await Promise.all([
        axios.get(`${API}/gestao-planos/subscricoes/user/${userId}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/prepagamento/meus-pedidos?apenas_pendentes=true`, { headers }).catch(() => ({ data: { pedidos: [] } }))
      ]);
      
      setSubscricao(subscricaoRes.data);
      setPedidosPendentes(pedidosRes.data.pedidos || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const handleSolicitarAdicao = async () => {
    if (adicionarForm.veiculos_adicionar <= 0 && adicionarForm.motoristas_adicionar <= 0) {
      toast.error('Adicione pelo menos 1 veículo ou 1 motorista');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/prepagamento/solicitar-adicao`,
        adicionarForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Pedido criado! Efetue o pagamento para desbloquear.');
      setShowAdicionarModal(false);
      setAdicionarForm({ veiculos_adicionar: 0, motoristas_adicionar: 0 });
      fetchDados();
      
      // Abrir modal de pagamento automaticamente
      if (response.data.pedido) {
        setSelectedPedido(response.data.pedido);
        setShowPagamentoModal(true);
      }
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  };

  const handleIniciarPagamento = async () => {
    if (!metodoPagamento) {
      toast.error('Selecione um método de pagamento');
      return;
    }

    if (metodoPagamento === 'mbway' && !telefone) {
      toast.error('Introduza o número de telefone para MB WAY');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        pedido_id: selectedPedido.id,
        metodo: metodoPagamento
      });
      if (telefone) params.append('telefone', telefone);
      
      const response = await axios.post(
        `${API}/prepagamento/iniciar-pagamento?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPagamentoInfo(response.data.pagamento);
      toast.success('Pagamento iniciado!');
      fetchDados();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar pagamento');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelarPedido = async (pedidoId) => {
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/prepagamento/cancelar-pedido/${pedidoId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Pedido cancelado');
      setShowPagamentoModal(false);
      setSelectedPedido(null);
      setPagamentoInfo(null);
      fetchDados();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao cancelar pedido');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente_pagamento':
        return 'bg-amber-100 text-amber-700';
      case 'pagamento_iniciado':
        return 'bg-blue-100 text-blue-700';
      case 'pago':
        return 'bg-green-100 text-green-700';
      case 'aplicado':
        return 'bg-green-100 text-green-700';
      case 'expirado':
        return 'bg-slate-100 text-slate-500';
      case 'cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pendente_pagamento':
        return 'Aguarda Pagamento';
      case 'pagamento_iniciado':
        return 'Pagamento Iniciado';
      case 'pago':
        return 'Pago';
      case 'aplicado':
        return 'Concluído';
      case 'expirado':
        return 'Expirado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  const temBloqueio = pedidosPendentes.length > 0;

  return (
    <>
      <Card className={temBloqueio ? 'border-amber-300 bg-amber-50/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {temBloqueio ? (
              <Lock className="w-5 h-5 text-amber-600" />
            ) : (
              <Unlock className="w-5 h-5 text-green-600" />
            )}
            Adicionar Recursos
          </CardTitle>
          <CardDescription>
            {temBloqueio 
              ? 'Tem pedidos pendentes de pagamento. Conclua para adicionar novos recursos.'
              : 'Adicione veículos ou motoristas à sua subscrição.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Recursos Atuais */}
          {subscricao && (
            <div className="flex gap-6 p-4 bg-slate-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-green-600" />
                <span className="font-medium">{subscricao.num_veiculos || 0}</span>
                <span className="text-slate-500">veículos</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="font-medium">{subscricao.num_motoristas || 0}</span>
                <span className="text-slate-500">motoristas</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Euro className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-blue-600">€{subscricao.preco_final?.toFixed(2) || '0.00'}</span>
                <span className="text-slate-500 text-sm">/{subscricao.periodicidade || 'mês'}</span>
              </div>
            </div>
          )}
          
          {/* Pedidos Pendentes */}
          {pedidosPendentes.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Pedidos Pendentes de Pagamento
              </h4>
              
              {pedidosPendentes.map((pedido) => (
                <div 
                  key={pedido.id} 
                  className="p-4 border border-amber-200 bg-white rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(pedido.status)}>
                        {getStatusLabel(pedido.status)}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Expira: {new Date(pedido.expires_at).toLocaleString('pt-PT')}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      €{pedido.valor_prorata?.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex gap-4 text-sm">
                    {pedido.veiculos_adicionar > 0 && (
                      <span className="flex items-center gap-1">
                        <Car className="w-4 h-4 text-green-600" />
                        +{pedido.veiculos_adicionar} veículo(s)
                      </span>
                    )}
                    {pedido.motoristas_adicionar > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-purple-600" />
                        +{pedido.motoristas_adicionar} motorista(s)
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-slate-600">
                    Nova mensalidade após pagamento: <strong>€{pedido.nova_mensalidade?.toFixed(2)}</strong>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedPedido(pedido);
                        setShowPagamentoModal(true);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-1" />
                      Pagar Agora
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCancelarPedido(pedido.id)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={() => setShowAdicionarModal(true)}
            disabled={temBloqueio}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Veículos/Motoristas
          </Button>
        </CardFooter>
      </Card>

      {/* Modal Adicionar Recursos */}
      <Dialog open={showAdicionarModal} onOpenChange={setShowAdicionarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Recursos</DialogTitle>
            <DialogDescription>
              Adicione veículos ou motoristas. Será gerado um valor pro-rata a pagar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-green-600" />
                  Veículos a adicionar
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={adicionarForm.veiculos_adicionar}
                  onChange={(e) => setAdicionarForm(prev => ({ 
                    ...prev, 
                    veiculos_adicionar: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Motoristas a adicionar
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={adicionarForm.motoristas_adicionar}
                  onChange={(e) => setAdicionarForm(prev => ({ 
                    ...prev, 
                    motoristas_adicionar: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg text-sm">
              <p className="text-blue-700 font-medium mb-2">Como funciona:</p>
              <ul className="text-blue-600 space-y-1">
                <li>1. Será calculado o valor pro-rata até à renovação</li>
                <li>2. Terá 24h para efetuar o pagamento</li>
                <li>3. Após pagamento, os recursos são desbloqueados</li>
                <li>4. A mensalidade é atualizada automaticamente</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdicionarModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSolicitarAdicao} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Solicitar Adição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pagamento */}
      <Dialog open={showPagamentoModal} onOpenChange={setShowPagamentoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Efetuar Pagamento</DialogTitle>
            <DialogDescription>
              Pague €{selectedPedido?.valor_prorata?.toFixed(2)} para desbloquear a adição de recursos.
            </DialogDescription>
          </DialogHeader>

          {selectedPedido && (
            <div className="space-y-4 py-4">
              {/* Resumo do Pedido */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Recursos a adicionar:</span>
                  <span className="font-medium">
                    {selectedPedido.veiculos_adicionar > 0 && `+${selectedPedido.veiculos_adicionar} veículo(s)`}
                    {selectedPedido.veiculos_adicionar > 0 && selectedPedido.motoristas_adicionar > 0 && ', '}
                    {selectedPedido.motoristas_adicionar > 0 && `+${selectedPedido.motoristas_adicionar} motorista(s)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Valor Pro-Rata:</span>
                  <span className="font-bold text-blue-600 text-lg">€{selectedPedido.valor_prorata?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Nova mensalidade:</span>
                  <span>€{selectedPedido.nova_mensalidade?.toFixed(2)}</span>
                </div>
              </div>

              {/* Método de Pagamento */}
              {!pagamentoInfo ? (
                <div className="space-y-3">
                  <Label>Método de Pagamento</Label>
                  <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mbway">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          MB WAY
                        </div>
                      </SelectItem>
                      <SelectItem value="multibanco">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Multibanco
                        </div>
                      </SelectItem>
                      <SelectItem value="cartao">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Cartão de Crédito
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {metodoPagamento === 'mbway' && (
                    <div>
                      <Label>Número de Telefone</Label>
                      <Input
                        type="tel"
                        placeholder="912 345 678"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Instruções de Pagamento */
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <CheckCircle className="w-5 h-5" />
                    Pagamento Iniciado
                  </div>
                  
                  {pagamentoInfo.metodo === 'multibanco' && (
                    <div className="space-y-2 text-sm">
                      <p><strong>Entidade:</strong> {pagamentoInfo.entidade}</p>
                      <p><strong>Referência:</strong> {pagamentoInfo.referencia}</p>
                      <p><strong>Valor:</strong> €{pagamentoInfo.valor?.toFixed(2)}</p>
                    </div>
                  )}
                  
                  {pagamentoInfo.metodo === 'mbway' && (
                    <div className="text-sm">
                      <p>Confirme o pagamento na app MB WAY</p>
                      <p className="text-slate-500">Telefone: {pagamentoInfo.telefone}</p>
                    </div>
                  )}
                  
                  {pagamentoInfo.metodo === 'cartao' && (
                    <div className="text-sm">
                      <Button variant="outline" size="sm" asChild>
                        <a href={pagamentoInfo.url_pagamento} target="_blank" rel="noopener noreferrer">
                          Ir para Página de Pagamento
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-500">
                    Após o pagamento, os recursos serão desbloqueados automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!pagamentoInfo ? (
              <>
                <Button variant="outline" onClick={() => handleCancelarPedido(selectedPedido?.id)}>
                  Cancelar Pedido
                </Button>
                <Button onClick={handleIniciarPagamento} disabled={saving || !metodoPagamento}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Pagar €{selectedPedido?.valor_prorata?.toFixed(2)}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPagamentoInfo(null);
                    setMetodoPagamento('');
                  }}
                >
                  Mudar Método
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowPagamentoModal(false);
                    setPagamentoInfo(null);
                  }}
                >
                  Fechar
                </Button>
                <Button onClick={fetchDados}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Verificar Pagamento
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdicionarRecursosCard;
