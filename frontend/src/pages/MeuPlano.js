import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import AdicionarRecursosCard from '@/components/AdicionarRecursosCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Package,
  Crown,
  Zap,
  Car,
  Users,
  Euro,
  Calendar,
  CheckCircle,
  Clock,
  Gift,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';

const MeuPlano = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscricao, setSubscricao] = useState(null);
  const [planoDetalhes, setPlanoDetalhes] = useState(null);
  const [modulosAtivos, setModulosAtivos] = useState([]);

  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [subscricaoRes, modulosRes] = await Promise.all([
        axios.get(`${API}/gestao-planos/subscricoes/minha`, { headers }),
        axios.get(`${API}/gestao-planos/modulos-ativos/user/${user?.id}`, { headers }).catch(() => ({ data: { modulos_ativos: [] } }))
      ]);
      
      setSubscricao(subscricaoRes.data);
      setPlanoDetalhes(subscricaoRes.data?.plano_detalhes);
      setModulosAtivos(modulosRes.data.modulos_ativos || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'trial':
        return <Badge className="bg-amber-100 text-amber-700"><Gift className="w-3 h-3 mr-1" />Trial</Badge>;
      case 'pendente_pagamento':
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Pagamento Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-6 h-6" />
                Meu Plano
              </h1>
              <p className="text-slate-600">Gerir a sua subscrição e recursos</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchDados}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card do Plano Atual */}
            {subscricao ? (
              <Card className="overflow-hidden">
                <div 
                  className="h-2"
                  style={{ backgroundColor: planoDetalhes?.cor || '#3B82F6' }}
                />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                        style={{ 
                          backgroundColor: (planoDetalhes?.cor || '#3B82F6') + '20',
                          color: planoDetalhes?.cor || '#3B82F6'
                        }}
                      >
                        {planoDetalhes?.icone || '📦'}
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {subscricao.plano_nome || 'Plano Base'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          {getStatusBadge(subscricao.status)}
                          {subscricao.periodicidade && (
                            <Badge variant="outline" className="capitalize">
                              {subscricao.periodicidade}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        €{subscricao.preco_final?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-sm text-slate-500">
                        por {subscricao.periodicidade || 'mês'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Recursos */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Car className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">Veículos</span>
                      </div>
                      <div className="text-3xl font-bold text-green-700">
                        {subscricao.num_veiculos || 0}
                      </div>
                      {subscricao.preco_veiculos > 0 && (
                        <div className="text-sm text-green-600 mt-1">
                          €{subscricao.preco_veiculos?.toFixed(2)}/mês
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-purple-700 font-medium">Motoristas</span>
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {subscricao.num_motoristas || 0}
                      </div>
                      {subscricao.preco_motoristas > 0 && (
                        <div className="text-sm text-purple-600 mt-1">
                          €{subscricao.preco_motoristas?.toFixed(2)}/mês
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Detalhes de Preço */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Euro className="w-4 h-4" />
                      Detalhes do Preço
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Preço base:</span>
                        <span>€{subscricao.preco_base?.toFixed(2) || '0.00'}</span>
                      </div>
                      {subscricao.preco_veiculos > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Veículos ({subscricao.num_veiculos}):</span>
                          <span>€{subscricao.preco_veiculos?.toFixed(2)}</span>
                        </div>
                      )}
                      {subscricao.preco_motoristas > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Motoristas ({subscricao.num_motoristas}):</span>
                          <span>€{subscricao.preco_motoristas?.toFixed(2)}</span>
                        </div>
                      )}
                      {subscricao.preco_modulos > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Módulos adicionais:</span>
                          <span>€{subscricao.preco_modulos?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t font-medium">
                        <span>Total:</span>
                        <span className="text-blue-600">€{subscricao.preco_final?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Próxima Cobrança */}
                  {subscricao.proxima_cobranca && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      Próxima cobrança: {new Date(subscricao.proxima_cobranca).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                  
                  {/* Trial Info */}
                  {subscricao.trial?.ativo && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Gift className="w-4 h-4" />
                        <span className="font-medium">Período Trial</span>
                      </div>
                      <p className="text-sm text-amber-600 mt-1">
                        Trial termina em: {new Date(subscricao.trial.data_fim).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">Sem Plano Ativo</h3>
                  <p className="text-slate-500">Contacte o administrador para obter um plano.</p>
                </CardContent>
              </Card>
            )}
            
            {/* Card de Adicionar Recursos */}
            {subscricao && (
              <AdicionarRecursosCard 
                userId={user?.id} 
                onAdicaoCompleta={fetchDados}
              />
            )}
          </div>

          {/* Coluna Lateral - Módulos */}
          <div className="space-y-6">
            {/* Módulos Ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Módulos Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modulosAtivos.length > 0 ? (
                  <div className="space-y-2">
                    {modulosAtivos.map((modulo, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{modulo}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Nenhum módulo ativo
                  </p>
                )}
              </CardContent>
            </Card>
            
            {/* Módulos do Plano */}
            {planoDetalhes?.modulos_incluidos?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Incluídos no Plano
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {planoDetalhes.modulos_incluidos.map((modulo, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-2 bg-amber-50 rounded"
                      >
                        <Gift className="w-4 h-4 text-amber-500" />
                        <span className="text-sm capitalize">{modulo.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features do Plano */}
            {planoDetalhes?.features_destaque?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Funcionalidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {planoDetalhes.features_destaque.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MeuPlano;
