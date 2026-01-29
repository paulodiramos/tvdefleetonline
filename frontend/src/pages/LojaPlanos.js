import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package,
  Star,
  Crown,
  Zap,
  Check,
  X,
  ArrowRight,
  Loader2,
  Shield,
  Clock,
  CreditCard,
  Gift,
  Sparkles,
  Car,
  Users,
  ChevronRight
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LojaPlanos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [meuPlano, setMeuPlano] = useState(null);
  const [periodicidadeAnual, setPeriodicidadeAnual] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [planosRes, modulosRes, meuPlanoRes] = await Promise.all([
        axios.get(`${API}/api/gestao-planos/planos/public?tipo_usuario=parceiro`),
        axios.get(`${API}/api/gestao-planos/modulos?tipo_usuario=parceiro`, { headers }),
        axios.get(`${API}/api/parceiros/meu-plano`, { headers }).catch(() => ({ data: null }))
      ]);

      // Ordenar planos por ordem
      const planosOrdenados = planosRes.data.sort((a, b) => a.ordem - b.ordem);
      setPlanos(planosOrdenados);
      setModulos(modulosRes.data);
      setMeuPlano(meuPlanoRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '€0';
    return `€${parseFloat(value).toFixed(2)}`;
  };

  const getPrecoPlano = (plano, tipo = 'base') => {
    const precos = plano.precos_plano || {};
    const sufixo = periodicidadeAnual ? 'anual' : 'mensal';
    
    switch (tipo) {
      case 'base':
        return precos[`base_${sufixo}`] || 0;
      case 'veiculo':
        return precos[`por_veiculo_${sufixo}`] || 0;
      case 'motorista':
        return precos[`por_motorista_${sufixo}`] || 0;
      default:
        return 0;
    }
  };

  const getPlanoIcon = (categoria) => {
    switch (categoria) {
      case 'enterprise': return Crown;
      case 'profissional': return Star;
      default: return Package;
    }
  };

  const getPlanoColor = (categoria) => {
    switch (categoria) {
      case 'enterprise': return 'from-purple-500 to-purple-600';
      case 'profissional': return 'from-blue-500 to-blue-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const isPlanoAtual = (plano) => {
    return meuPlano?.plano?.id === plano.id;
  };

  const canUpgrade = (plano) => {
    if (!meuPlano?.plano) return true;
    return plano.ordem > (meuPlano.plano.ordem || 0);
  };

  const handleSelectPlano = (plano) => {
    if (isPlanoAtual(plano)) return;
    setSelectedPlano(plano);
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlano) return;
    
    setUpgrading(true);
    try {
      // Por agora, apenas mostra mensagem - a integração real será com Ifthenpay
      toast.info('Funcionalidade de pagamento em breve! Contacte o suporte para mudar de plano.');
      setShowUpgradeModal(false);
    } catch (error) {
      toast.error('Erro ao processar pedido');
    } finally {
      setUpgrading(false);
    }
  };

  const moduloIncluido = (plano, moduloCodigo) => {
    return plano.modulos_incluidos?.includes(moduloCodigo);
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="loja-planos-page">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            Escolha o Plano Ideal para a sua Frota
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Todos os planos incluem acesso ao dashboard, gestão de veículos e motoristas.
            Escolha o que melhor se adapta às suas necessidades.
          </p>
          
          {/* Toggle Mensal/Anual */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Label className={!periodicidadeAnual ? 'font-semibold' : 'text-slate-500'}>
              Mensal
            </Label>
            <Switch
              checked={periodicidadeAnual}
              onCheckedChange={setPeriodicidadeAnual}
            />
            <Label className={periodicidadeAnual ? 'font-semibold' : 'text-slate-500'}>
              Anual
            </Label>
            {periodicidadeAnual && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
                <Gift className="w-3 h-3 mr-1" />
                Poupe 17%
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs: Planos / Módulos */}
        <Tabs defaultValue="planos" className="space-y-8">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Módulos Extra
            </TabsTrigger>
          </TabsList>

          {/* Tab Planos */}
          <TabsContent value="planos">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planos.map((plano) => {
                const Icon = getPlanoIcon(plano.categoria);
                const isAtual = isPlanoAtual(plano);
                const canUp = canUpgrade(plano);
                const isPopular = plano.categoria === 'profissional';
                
                return (
                  <Card 
                    key={plano.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isAtual ? 'ring-2 ring-blue-500 shadow-lg' : 
                      isPopular ? 'ring-2 ring-purple-300 shadow-md' : 
                      'hover:shadow-lg'
                    }`}
                  >
                    {/* Badge Popular/Atual */}
                    {isPopular && !isAtual && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          POPULAR
                        </div>
                      </div>
                    )}
                    {isAtual && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                          <Check className="w-3 h-3 inline mr-1" />
                          PLANO ATUAL
                        </div>
                      </div>
                    )}

                    {/* Header com gradiente */}
                    <div className={`bg-gradient-to-r ${getPlanoColor(plano.categoria)} p-6 text-white`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{plano.nome}</h3>
                          <p className="text-white/80 text-sm">{plano.descricao}</p>
                        </div>
                      </div>
                      
                      {/* Preço */}
                      <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">
                            {formatCurrency(getPrecoPlano(plano, 'base'))}
                          </span>
                          <span className="text-white/70">
                            /{periodicidadeAnual ? 'ano' : 'mês'}
                          </span>
                        </div>
                        {getPrecoPlano(plano, 'veiculo') > 0 && (
                          <div className="text-sm text-white/80 mt-1">
                            + {formatCurrency(getPrecoPlano(plano, 'veiculo'))}/veículo
                            + {formatCurrency(getPrecoPlano(plano, 'motorista'))}/motorista
                          </div>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-6">
                      {/* Limites */}
                      {plano.limites && (
                        <div className="flex gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <Car className="w-4 h-4 text-blue-500" />
                            <span>
                              {plano.limites.max_veiculos ? `Até ${plano.limites.max_veiculos}` : 'Ilimitado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-green-500" />
                            <span>
                              {plano.limites.max_motoristas ? `Até ${plano.limites.max_motoristas}` : 'Ilimitado'}
                            </span>
                          </div>
                        </div>
                      )}
                      {!plano.limites && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                          <Shield className="w-4 h-4" />
                          <span>Veículos e motoristas ilimitados</span>
                        </div>
                      )}

                      {/* Features */}
                      <ul className="space-y-2">
                        {plano.features_destaque?.slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-600">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Módulos incluídos */}
                      {plano.modulos_incluidos?.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                            {plano.modulos_incluidos.length} Módulos Incluídos
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {plano.modulos_incluidos.slice(0, 4).map((codigo) => (
                              <Badge key={codigo} variant="secondary" className="text-xs">
                                {codigo}
                              </Badge>
                            ))}
                            {plano.modulos_incluidos.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{plano.modulos_incluidos.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Trial */}
                      {plano.permite_trial && plano.dias_trial > 0 && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-purple-600">
                          <Clock className="w-4 h-4" />
                          <span>{plano.dias_trial} dias de trial grátis</span>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="p-6 pt-0">
                      <Button
                        className={`w-full ${isAtual ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}`}
                        variant={isAtual ? 'secondary' : 'default'}
                        disabled={isAtual || !canUp}
                        onClick={() => handleSelectPlano(plano)}
                      >
                        {isAtual ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Plano Atual
                          </>
                        ) : canUp ? (
                          <>
                            Fazer Upgrade
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        ) : (
                          'Plano Inferior'
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab Módulos */}
          <TabsContent value="modulos">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm">
                <Zap className="w-4 h-4 inline mr-2" />
                Adicione módulos extra ao seu plano para funcionalidades específicas.
                Alguns módulos já estão incluídos no seu plano atual.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulos.map((modulo) => {
                const incluido = meuPlano?.plano?.modulos_incluidos?.includes(modulo.codigo);
                
                return (
                  <Card 
                    key={modulo.id}
                    className={`transition-all ${incluido ? 'bg-green-50 border-green-200' : 'hover:shadow-md'}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: `${modulo.cor}20` }}
                          >
                            {modulo.icone}
                          </div>
                          <div>
                            <CardTitle className="text-base">{modulo.nome}</CardTitle>
                            <CardDescription className="text-xs">
                              {modulo.tipo_cobranca === 'por_veiculo' ? 'Por veículo' : 
                               modulo.tipo_cobranca === 'por_motorista' ? 'Por motorista' : 'Preço fixo'}
                            </CardDescription>
                          </div>
                        </div>
                        {incluido && (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Incluído
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-slate-600 mb-3">
                        {modulo.descricao}
                      </p>
                      
                      {!incluido && modulo.precos?.mensal && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-slate-800">
                            {formatCurrency(modulo.precos.mensal)}
                          </span>
                          <span className="text-slate-500 text-sm">/mês</span>
                        </div>
                      )}

                      {!incluido && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-3"
                          disabled
                        >
                          Adicionar Módulo
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 text-center text-sm text-slate-500">
              <p>A compra de módulos individuais estará disponível em breve.</p>
              <p>Contacte o suporte para adicionar módulos ao seu plano.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Upgrade */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Upgrade para {selectedPlano?.nome}
              </DialogTitle>
              <DialogDescription>
                Está prestes a fazer upgrade do seu plano.
              </DialogDescription>
            </DialogHeader>

            {selectedPlano && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Plano atual:</span>
                    <span className="font-medium">{meuPlano?.plano?.nome || 'Nenhum'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Novo plano:</span>
                    <span className="font-bold text-blue-600">{selectedPlano.nome}</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {formatCurrency(getPrecoPlano(selectedPlano, 'base'))}
                      <span className="text-base font-normal text-blue-500">
                        /{periodicidadeAnual ? 'ano' : 'mês'}
                      </span>
                    </div>
                    {getPrecoPlano(selectedPlano, 'veiculo') > 0 && (
                      <p className="text-sm text-blue-600 mt-1">
                        + custos por veículo e motorista
                      </p>
                    )}
                  </div>
                </div>

                {selectedPlano.permite_trial && (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg text-purple-700">
                    <Gift className="w-4 h-4" />
                    <span className="text-sm">
                      Experimente grátis durante {selectedPlano.dias_trial} dias!
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                  <CreditCard className="w-4 h-4 mt-0.5" />
                  <span>
                    O pagamento será processado através de Multibanco ou MBWAY.
                    Receberá os dados de pagamento por email.
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmUpgrade} disabled={upgrading}>
                {upgrading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Confirmar Upgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link para voltar ao Meu Plano */}
        <div className="mt-8 text-center">
          <Button variant="link" onClick={() => navigate('/meu-plano')}>
            ← Voltar para Meu Plano
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default LojaPlanos;
