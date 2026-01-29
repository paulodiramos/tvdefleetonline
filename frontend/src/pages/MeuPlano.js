import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Package,
  Car,
  Users,
  Calendar,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  Crown,
  Zap,
  ArrowRight,
  Loader2,
  Info,
  Gift,
  Shield
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MeuPlano = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscricao, setSubscricao] = useState(null);
  const [modulosAtivos, setModulosAtivos] = useState([]);
  const [limites, setLimites] = useState(null);
  const [estatisticas, setEstatisticas] = useState({ veiculos: 0, motoristas: 0 });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [subscricaoRes, modulosRes, limitesRes] = await Promise.all([
        axios.get(`${API}/api/gestao-planos/subscricoes/minha`, { headers }),
        axios.get(`${API}/api/gestao-planos/modulos-ativos/user/${user.id}`, { headers }),
        axios.get(`${API}/api/gestao-planos/limites/user/${user.id}`, { headers }).catch(() => null)
      ]);

      setSubscricao(subscricaoRes.data);
      setModulosAtivos(modulosRes.data.modulos_ativos || []);
      
      if (limitesRes?.data) {
        setLimites(limitesRes.data.limites);
        setEstatisticas({
          veiculos: limitesRes.data.uso_atual?.veiculos || 0,
          motoristas: limitesRes.data.uso_atual?.motoristas || 0
        });
      }

      // Contar veículos e motoristas reais
      const [veiculosRes, motoristasRes] = await Promise.all([
        axios.get(`${API}/api/vehicles`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/motoristas`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setEstatisticas({
        veiculos: Array.isArray(veiculosRes.data) ? veiculosRes.data.length : 0,
        motoristas: Array.isArray(motoristasRes.data) ? motoristasRes.data.length : 0
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do plano');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '€0.00';
    return `€${parseFloat(value).toFixed(2)}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ativo: { label: 'Ativo', variant: 'default', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
      trial: { label: 'Trial', variant: 'secondary', icon: Clock, color: 'bg-blue-100 text-blue-800' },
      pendente_pagamento: { label: 'Pagamento Pendente', variant: 'destructive', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
      expirado: { label: 'Expirado', variant: 'destructive', icon: AlertTriangle, color: 'bg-red-100 text-red-800' },
      cancelado: { label: 'Cancelado', variant: 'outline', icon: AlertTriangle, color: 'bg-gray-100 text-gray-800' }
    };
    const config = statusConfig[status] || statusConfig.ativo;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPlanoIcon = (categoria) => {
    switch (categoria) {
      case 'enterprise': return Crown;
      case 'profissional': return Star;
      default: return Package;
    }
  };

  const calcularDiasRestantes = () => {
    if (!subscricao?.proxima_cobranca) return null;
    const hoje = new Date();
    const proxima = new Date(subscricao.proxima_cobranca);
    const diff = Math.ceil((proxima - hoje) / (1000 * 60 * 60 * 24));
    return diff;
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

  const diasRestantes = calcularDiasRestantes();
  const PlanoIcon = subscricao?.plano_categoria ? getPlanoIcon(subscricao.plano_categoria) : Package;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="meu-plano-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Meu Plano
          </h1>
          <p className="text-slate-500">Gerencie a sua subscrição e módulos</p>
        </div>

        {/* Alerta de Trial ou Expiração */}
        {subscricao?.status === 'trial' && subscricao?.trial?.data_fim && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <Gift className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Período de Trial</AlertTitle>
            <AlertDescription className="text-blue-700">
              O seu período de trial termina em {formatDate(subscricao.trial.data_fim)}.
              {diasRestantes && diasRestantes <= 7 && (
                <span className="font-semibold"> Faltam apenas {diasRestantes} dias!</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {diasRestantes !== null && diasRestantes <= 5 && subscricao?.status === 'ativo' && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Renovação Próxima</AlertTitle>
            <AlertDescription className="text-yellow-700">
              A sua subscrição será renovada em {diasRestantes} dias ({formatDate(subscricao.proxima_cobranca)}).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal - Plano Atual */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card do Plano */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      subscricao?.plano_categoria === 'enterprise' ? 'bg-purple-100' :
                      subscricao?.plano_categoria === 'profissional' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <PlanoIcon className={`w-6 h-6 ${
                        subscricao?.plano_categoria === 'enterprise' ? 'text-purple-600' :
                        subscricao?.plano_categoria === 'profissional' ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {subscricao?.plano_nome || 'Sem Plano'}
                      </CardTitle>
                      <CardDescription>
                        {subscricao?.plano_detalhes?.descricao || 'Nenhum plano atribuído'}
                      </CardDescription>
                    </div>
                  </div>
                  {subscricao && getStatusBadge(subscricao.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {subscricao ? (
                  <>
                    {/* Preço e Periodicidade */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-slate-800">
                          {formatCurrency(subscricao.preco_final)}
                        </div>
                        <div className="text-xs text-slate-500 uppercase">
                          /{subscricao.periodicidade || 'mensal'}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-blue-600">
                          {subscricao.num_veiculos || 0}
                        </div>
                        <div className="text-xs text-slate-500">Veículos</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-green-600">
                          {subscricao.num_motoristas || 0}
                        </div>
                        <div className="text-xs text-slate-500">Motoristas</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-purple-600">
                          {modulosAtivos.length}
                        </div>
                        <div className="text-xs text-slate-500">Módulos</div>
                      </div>
                    </div>

                    {/* Detalhes do Preço */}
                    {(subscricao.preco_base > 0 || subscricao.preco_veiculos > 0 || subscricao.preco_motoristas > 0) && (
                      <div className="bg-white rounded-lg border p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Composição do Preço</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Preço Base</span>
                            <span className="font-medium">{formatCurrency(subscricao.preco_base)}</span>
                          </div>
                          {subscricao.preco_veiculos > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Veículos ({subscricao.num_veiculos}x)</span>
                              <span className="font-medium">{formatCurrency(subscricao.preco_veiculos)}</span>
                            </div>
                          )}
                          {subscricao.preco_motoristas > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Motoristas ({subscricao.num_motoristas}x)</span>
                              <span className="font-medium">{formatCurrency(subscricao.preco_motoristas)}</span>
                            </div>
                          )}
                          {subscricao.preco_modulos > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Módulos Adicionais</span>
                              <span className="font-medium">{formatCurrency(subscricao.preco_modulos)}</span>
                            </div>
                          )}
                          {subscricao.desconto_especial?.ativo && (
                            <div className="flex justify-between text-green-600">
                              <span>Desconto ({subscricao.desconto_especial.percentagem}%)</span>
                              <span className="font-medium">
                                -{formatCurrency((subscricao.preco_base + subscricao.preco_veiculos + subscricao.preco_motoristas) * subscricao.desconto_especial.percentagem / 100)}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-blue-600">{formatCurrency(subscricao.preco_final)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Datas */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Início</div>
                          <div className="text-sm font-medium">{formatDate(subscricao.data_inicio)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                        <CreditCard className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Próxima Cobrança</div>
                          <div className="text-sm font-medium">{formatDate(subscricao.proxima_cobranca)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-4">Ainda não tem um plano atribuído</p>
                    <Button variant="outline">
                      Contactar Suporte
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Módulos Ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Módulos Ativos
                </CardTitle>
                <CardDescription>
                  Funcionalidades incluídas no seu plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                {modulosAtivos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {modulosAtivos.map((modulo, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-green-800 truncate">
                          {modulo}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Nenhum módulo ativo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            {/* Uso Atual */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Uso Atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Veículos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Veículos</span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {estatisticas.veiculos}
                      {limites?.max_veiculos && ` / ${limites.max_veiculos}`}
                    </span>
                  </div>
                  {limites?.max_veiculos && (
                    <Progress 
                      value={(estatisticas.veiculos / limites.max_veiculos) * 100} 
                      className="h-2"
                    />
                  )}
                </div>

                {/* Motoristas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">Motoristas</span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {estatisticas.motoristas}
                      {limites?.max_motoristas && ` / ${limites.max_motoristas}`}
                    </span>
                  </div>
                  {limites?.max_motoristas && (
                    <Progress 
                      value={(estatisticas.motoristas / limites.max_motoristas) * 100} 
                      className="h-2"
                    />
                  )}
                </div>

                {!limites?.max_veiculos && !limites?.max_motoristas && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">Sem limites</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Features do Plano */}
            {subscricao?.plano_detalhes?.features_destaque?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inclui</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {subscricao.plano_detalhes.features_destaque.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Desconto Especial */}
            {subscricao?.desconto_especial?.ativo && (
              <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                    <Gift className="w-5 h-5" />
                    Desconto Especial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      -{subscricao.desconto_especial.percentagem}%
                    </div>
                    {subscricao.desconto_especial.motivo && (
                      <p className="text-sm text-green-700">
                        {subscricao.desconto_especial.motivo}
                      </p>
                    )}
                    {subscricao.desconto_especial.data_fim && (
                      <p className="text-xs text-green-600 mt-2">
                        Válido até {formatDate(subscricao.desconto_especial.data_fim)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button variant="outline" className="w-full justify-between" disabled>
                  <span>Fazer Upgrade</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" disabled>
                  <span>Adicionar Módulos</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  Em breve poderá gerir o seu plano diretamente
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MeuPlano;
