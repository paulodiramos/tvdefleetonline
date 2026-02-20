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
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package,
  Star,
  Crown,
  Check,
  ArrowRight,
  Loader2,
  Shield,
  CreditCard,
  Gift,
  Sparkles,
  Car,
  Users,
  Clock,
  ArrowDown,
  Plus,
  Minus,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const LojaPlanos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [meuPlano, setMeuPlano] = useState(null);
  const [periodicidadeAnual, setPeriodicidadeAnual] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const [downgradeAgendado, setDowngradeAgendado] = useState(null);
  const [selectedCategoria, setSelectedCategoria] = useState('all');
  
  // Estado para seleção de recursos
  const [numVeiculos, setNumVeiculos] = useState(1);
  const [numMotoristas, setNumMotoristas] = useState(1);
  const [modulosAdicionais, setModulosAdicionais] = useState([]);
  const [precoCalculado, setPrecoCalculado] = useState(null);
  const [calculando, setCalculando] = useState(false);

  // Determinar tipo de utilizador para carregar planos apropriados
  const getTipoUsuario = () => {
    if (user?.role === 'motorista') return 'motorista';
    return 'parceiro'; // parceiro, gestao, admin vêem planos de parceiro
  };

  // Endpoint para obter plano atual baseado no tipo de utilizador
  const getMeuPlanoEndpoint = () => {
    if (user?.role === 'motorista') return `${API}/api/motoristas/meu-plano`;
    return `${API}/api/parceiros/meu-plano`;
  };

  useEffect(() => {
    carregarDados();
  }, [user]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const tipoUsuario = getTipoUsuario();

      const [planosRes, meuPlanoRes, modulosRes, downgradeRes, categoriasRes] = await Promise.all([
        axios.get(`${API}/api/gestao-planos/planos/public?tipo_usuario=${tipoUsuario}`),
        axios.get(getMeuPlanoEndpoint(), { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/gestao-planos/modulos?tipo_usuario=${tipoUsuario}`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/gestao-planos/subscricoes/downgrade-agendado`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/gestao-planos/categorias/public`).catch(() => ({ data: [] }))
      ]);

      // Ordenar planos por ordem
      const planosOrdenados = (planosRes.data || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      setPlanos(planosOrdenados);
      setMeuPlano(meuPlanoRes.data);
      setModulos(modulosRes.data || []);
      setDowngradeAgendado(downgradeRes.data);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar planos por categoria
  const getPlanosPorCategoria = () => {
    if (selectedCategoria === 'all') return planos;
    return planos.filter(p => p.categoria_id === selectedCategoria || 
      (!p.categoria_id && selectedCategoria === 'sem-categoria'));
  };

  // Obter categoria pelo ID
  const getCategoriaById = (id) => {
    return categorias.find(c => c.id === id);
  };

  // Calcular preço quando recursos mudam
  const calcularPreco = async (plano) => {
    if (!plano) return;
    
    setCalculando(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/gestao-planos/calcular-preco-avancado`,
        {
          plano_id: plano.id,
          num_veiculos: numVeiculos,
          num_motoristas: numMotoristas,
          periodicidade: periodicidadeAnual ? 'anual' : 'mensal',
          modulos_adicionais: modulosAdicionais.map(m => ({
            modulo_id: m.id,
            tipo_cobranca: m.tipoCobranca || 'preco_unico',
            num_veiculos: numVeiculos,
            num_motoristas: numMotoristas
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPrecoCalculado(response.data);
    } catch (error) {
      console.error('Erro ao calcular preço:', error);
    } finally {
      setCalculando(false);
    }
  };

  useEffect(() => {
    if (selectedPlano && showUpgradeModal) {
      calcularPreco(selectedPlano);
    }
  }, [selectedPlano, numVeiculos, numMotoristas, modulosAdicionais, periodicidadeAnual]);

  const formatCurrency = (value) => {
    if (!value) return '€0';
    return `€${parseFloat(value).toFixed(2)}`;
  };

  const getPrecoPlano = (plano, tipo = 'base') => {
    const sufixo = periodicidadeAnual ? 'anual' : 'mensal';
    
    // Para motoristas, usar precos simples
    if (user?.role === 'motorista' || plano.tipo_usuario === 'motorista') {
      const precos = plano.precos || {};
      if (tipo === 'base') {
        return precos[sufixo] || precos.mensal || 0;
      }
      return 0; // Motoristas não têm preços por veículo/motorista
    }
    
    // Para parceiros, usar precos_plano estruturado
    const precos = plano.precos_plano || {};
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

  const getPlanoIcon = (plano) => {
    // Se o plano tem ícone definido (emoji), retornar null para usar o emoji
    if (plano.icone && plano.icone.length <= 2) {
      return null; // Usaremos o emoji diretamente
    }
    // Fallback para ícones Lucide baseados na categoria
    switch (plano.categoria) {
      case 'enterprise': return Crown;
      case 'profissional': return Star;
      default: return Package;
    }
  };

  const getPlanoColor = (plano) => {
    // Se o plano tem cor definida, usar essa cor
    if (plano.cor) {
      return `from-[${plano.cor}] to-[${plano.cor}]/80`;
    }
    // Fallback para cores baseadas na categoria
    switch (plano.categoria) {
      case 'enterprise': return 'from-purple-500 to-purple-600';
      case 'profissional': return 'from-blue-500 to-blue-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Função para obter gradiente baseado na cor do plano
  const getPlanoGradient = (plano) => {
    if (plano.cor) {
      // Converter hex para gradiente mais escuro
      return {
        background: `linear-gradient(135deg, ${plano.cor} 0%, ${plano.cor}dd 100%)`
      };
    }
    return null;
  };

  const isPlanoAtual = (plano) => {
    return meuPlano?.plano?.id === plano.id;
  };

  const canUpgrade = (plano) => {
    if (!plano) return false;
    if (!meuPlano?.plano) return true;
    return plano.ordem > (meuPlano.plano.ordem || 0);
  };

  const canDowngrade = (plano) => {
    if (!plano) return false;
    if (!meuPlano?.plano) return false;
    return plano.ordem < (meuPlano.plano.ordem || 0);
  };

  const handleSelectPlano = (plano) => {
    if (isPlanoAtual(plano)) return;
    setSelectedPlano(plano);
    setNumVeiculos(1);
    setNumMotoristas(1);
    setModulosAdicionais([]);
    setPrecoCalculado(null);
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlano) return;
    
    setUpgrading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Se é downgrade, agendar
      if (canDowngrade(selectedPlano)) {
        await axios.post(
          `${API}/api/gestao-planos/subscricoes/solicitar-downgrade`,
          { plano_novo_id: selectedPlano.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Downgrade agendado! Seu plano será alterado para ${selectedPlano.nome} no fim do ciclo atual.`);
        await carregarDados();
      } else {
        // Por agora, apenas mostra mensagem - a integração real será com Ifthenpay
        toast.info('Funcionalidade de pagamento em breve! Contacte o suporte para mudar de plano.');
      }
      setShowUpgradeModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao processar pedido');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelarDowngrade = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/gestao-planos/subscricoes/cancelar-downgrade`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Downgrade cancelado!');
      await carregarDados();
    } catch (error) {
      toast.error('Erro ao cancelar downgrade');
    }
  };

  const toggleModuloAdicional = (modulo) => {
    setModulosAdicionais(prev => {
      const exists = prev.find(m => m.id === modulo.id);
      if (exists) {
        return prev.filter(m => m.id !== modulo.id);
      }
      return [...prev, { ...modulo, tipoCobranca: modulo.tipo_cobranca || 'preco_unico' }];
    });
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

  // Textos dinâmicos baseados no tipo de utilizador
  const getHeaderTexts = () => {
    if (user?.role === 'motorista') {
      return {
        titulo: 'Escolha o Plano Ideal para Si',
        subtitulo: 'Aceda a funcionalidades exclusivas para motoristas. Escolha o plano que melhor se adapta às suas necessidades.'
      };
    }
    return {
      titulo: 'Escolha o Plano Ideal para a sua Frota',
      subtitulo: 'Todos os planos incluem acesso ao dashboard, gestão de veículos e motoristas. Escolha o que melhor se adapta às suas necessidades.'
    };
  };

  const headerTexts = getHeaderTexts();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="loja-planos-page">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            {headerTexts.titulo}
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            {headerTexts.subtitulo}
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
          
          {/* Filtro por Categoria */}
          {categorias.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setSelectedCategoria('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategoria === 'all' 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos os Planos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoria(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedCategoria === cat.id 
                      ? 'text-white shadow-md' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={selectedCategoria === cat.id ? { backgroundColor: cat.cor || '#3B82F6' } : {}}
                >
                  {cat.icone && <span>{cat.icone}</span>}
                  {cat.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {getPlanosPorCategoria().map((plano) => {
            const Icon = getPlanoIcon(plano);
            const isAtual = isPlanoAtual(plano);
            const canUp = canUpgrade(plano);
            const isPopular = plano.destaque || plano.categoria === 'profissional';
            const planoGradient = getPlanoGradient(plano);
            const categoria = getCategoriaById(plano.categoria_id);
            
            return (
              <Card 
                key={plano.id}
                data-testid={`plano-card-${plano.id}`}
                className={`relative overflow-hidden transition-all duration-300 ${
                  isAtual ? 'ring-2 ring-blue-500 shadow-lg' : 
                  isPopular ? 'ring-2 ring-purple-300 shadow-md' : 
                  'hover:shadow-lg'
                }`}
              >
                {/* Badge Categoria */}
                {categoria && (
                  <div className="absolute top-0 left-0">
                    <div 
                      className="text-white text-xs font-medium px-2 py-1 rounded-br-lg flex items-center gap-1"
                      style={{ backgroundColor: categoria.cor || '#6B7280' }}
                    >
                      {categoria.icone && <span>{categoria.icone}</span>}
                      {categoria.nome}
                    </div>
                  </div>
                )}
                
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
                    <div 
                      className={`p-6 text-white ${!planoGradient ? `bg-gradient-to-r ${getPlanoColor(plano)}` : ''}`}
                      style={planoGradient || {}}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          {plano.icone ? (
                            <span className="text-2xl">{plano.icone}</span>
                          ) : Icon ? (
                            <Icon className="w-6 h-6" />
                          ) : (
                            <Package className="w-6 h-6" />
                          )}
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
                      {/* Limites - apenas para parceiros */}
                      {user?.role !== 'motorista' && plano.tipo_usuario !== 'motorista' && (
                        <>
                          {plano.limites && (plano.limites.max_veiculos || plano.limites.max_motoristas) ? (
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
                          ) : (
                            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                              <Shield className="w-4 h-4" />
                              <span>Veículos e motoristas ilimitados</span>
                            </div>
                          )}
                        </>
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

        {/* Modal de Upgrade/Downgrade */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {canDowngrade(selectedPlano) ? (
                  <>
                    <ArrowDown className="w-5 h-5 text-orange-500" />
                    Downgrade para {selectedPlano?.nome}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Upgrade para {selectedPlano?.nome}
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {canDowngrade(selectedPlano) 
                  ? 'O downgrade será aplicado no fim do seu ciclo de cobrança atual.'
                  : 'Configure o seu plano com os recursos necessários.'
                }
              </DialogDescription>
            </DialogHeader>

            {selectedPlano && (
              <div className="space-y-4">
                {/* Aviso de Downgrade */}
                {canDowngrade(selectedPlano) && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg text-orange-800 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <span>
                      O seu plano atual continuará ativo até ao fim do ciclo. 
                      O downgrade só será aplicado na próxima renovação.
                    </span>
                  </div>
                )}

                {/* Seleção de Recursos (apenas para parceiros) */}
                {user?.role !== 'motorista' && !canDowngrade(selectedPlano) && (
                  <div className="p-4 bg-slate-50 rounded-lg space-y-4">
                    <h4 className="font-semibold text-sm text-slate-700">Quantos recursos vai utilizar?</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                          <Car className="w-3 h-3" /> Veículos
                        </label>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-8 w-8"
                            onClick={() => setNumVeiculos(Math.max(1, numVeiculos - 1))}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input 
                            type="number" 
                            min={1}
                            className="w-16 text-center h-8"
                            value={numVeiculos}
                            onChange={(e) => setNumVeiculos(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <Button 
                            size="icon" 
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setNumVeiculos(numVeiculos + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                          <Users className="w-3 h-3" /> Motoristas
                        </label>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="icon" 
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setNumMotoristas(Math.max(1, numMotoristas - 1))}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input 
                            type="number" 
                            min={1}
                            className="w-16 text-center h-8"
                            value={numMotoristas}
                            onChange={(e) => setNumMotoristas(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <Button 
                            size="icon" 
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setNumMotoristas(numMotoristas + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumo de Preços Calculado */}
                {precoCalculado && !canDowngrade(selectedPlano) && (
                  <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Base do plano:</span>
                        <span>€{precoCalculado.custos.base.toFixed(2)}</span>
                      </div>
                      {precoCalculado.custos.veiculos.subtotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">{numVeiculos} veículo(s):</span>
                          <span>€{precoCalculado.custos.veiculos.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {precoCalculado.custos.motoristas.subtotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">{numMotoristas} motorista(s):</span>
                          <span>€{precoCalculado.custos.motoristas.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {precoCalculado.custos.setup > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Taxa de setup (única):</span>
                          <span>€{precoCalculado.custos.setup.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total mensal:</span>
                        <span className="text-xl font-bold text-blue-600">
                          €{precoCalculado.totais.recorrente.toFixed(2)}
                        </span>
                      </div>
                      {precoCalculado.custos.setup > 0 && (
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>Primeira cobrança:</span>
                          <span>€{precoCalculado.totais.primeira_cobranca.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preço simples para downgrade */}
                {canDowngrade(selectedPlano) && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {formatCurrency(getPrecoPlano(selectedPlano, 'base'))}
                        <span className="text-base font-normal text-blue-500">
                          /{periodicidadeAnual ? 'ano' : 'mês'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPlano.permite_trial && !canDowngrade(selectedPlano) && (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg text-purple-700">
                    <Gift className="w-4 h-4" />
                    <span className="text-sm">
                      Experimente grátis durante {selectedPlano.dias_trial} dias!
                    </span>
                  </div>
                )}

                {!canDowngrade(selectedPlano) && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                    <CreditCard className="w-4 h-4 mt-0.5" />
                    <span>
                      O pagamento será processado através de Multibanco ou MBWAY.
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmUpgrade} 
                disabled={upgrading || (calculando && !canDowngrade(selectedPlano))}
                variant={canDowngrade(selectedPlano) ? 'destructive' : 'default'}
              >
                {upgrading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : canDowngrade(selectedPlano) ? (
                  <ArrowDown className="w-4 h-4 mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {canDowngrade(selectedPlano) ? 'Confirmar Downgrade' : 'Confirmar Upgrade'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aviso de Downgrade Agendado */}
        {downgradeAgendado && (
          <div className="fixed bottom-4 right-4 max-w-sm p-4 bg-orange-100 border border-orange-300 rounded-lg shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-800">Downgrade Agendado</h4>
                <p className="text-sm text-orange-700 mt-1">
                  O seu plano será alterado para <strong>{downgradeAgendado.plano_novo_nome}</strong> em {downgradeAgendado.data_aplicacao?.slice(0, 10)}.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2 text-orange-700 border-orange-300"
                  onClick={handleCancelarDowngrade}
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancelar Downgrade
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Link para voltar ao Meu Plano */}
        <div className="mt-8 text-center">
          <Button variant="link" onClick={() => navigate(user?.role === 'motorista' ? '/meu-plano-motorista' : '/meu-plano')}>
            ← Voltar para Meu Plano
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default LojaPlanos;
