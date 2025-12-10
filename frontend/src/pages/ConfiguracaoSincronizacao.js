import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Settings, Play, Calendar } from 'lucide-react';

const ConfiguracaoSincronizacao = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [configuracoes, setConfiguracoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState({});

  const diasSemana = [
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' }
  ];

  useEffect(() => {
    fetchParceiros();
    fetchConfiguracoes();
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchConfiguracoes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/sincronizacao/configuracoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfiguracoes(response.data);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarDia = async (parceiroId, diaSemana) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/sincronizacao/configurar-dia`,
        {
          parceiro_id: parceiroId,
          dia_semana: parseInt(diaSemana)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Dia de sincronização atualizado!');
      fetchConfiguracoes();
    } catch (error) {
      console.error('Error updating sync day:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleForcarSincronizacao = async (parceiroId) => {
    try {
      setSincronizando({ ...sincronizando, [parceiroId]: true });
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/sincronizacao/forcar`,
        { parceiro_id: parceiroId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || 'Sincronização iniciada!');
      fetchConfiguracoes();
    } catch (error) {
      console.error('Error forcing sync:', error);
      toast.error(error.response?.data?.detail || 'Erro ao forçar sincronização');
    } finally {
      setSincronizando({ ...sincronizando, [parceiroId]: false });
    }
  };

  const getConfiguracao = (parceiroId) => {
    return configuracoes.find(c => c.parceiro_id === parceiroId);
  };

  const getParceiro = (parceiroId) => {
    return parceiros.find(p => p.id === parceiroId);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sincronização Automática</h1>
            <p className="text-slate-600 mt-1">
              Configure o dia da semana para sincronização automática de cada parceiro
            </p>
          </div>
          <Settings className="w-8 h-8 text-blue-600" />
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <p className="text-sm text-blue-900 font-medium">Como Funciona</p>
                <p className="text-sm text-blue-800 mt-1">
                  A sincronização automática executará às <strong>00:00</strong> do dia selecionado.
                  Pode forçar uma sincronização manual a qualquer momento clicando no botão "Forçar Sincronização".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Parceiros */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração por Parceiro</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">A carregar...</p>
              </div>
            ) : parceiros.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Nenhum parceiro encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {parceiros.map((parceiro) => {
                  const config = getConfiguracao(parceiro.id);
                  const isSyncing = sincronizando[parceiro.id];
                  
                  return (
                    <div
                      key={parceiro.id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">
                            {parceiro.nome_empresa || parceiro.email}
                          </h3>
                          <p className="text-sm text-slate-500">{parceiro.email}</p>
                          
                          {config?.ultima_sincronizacao && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                Última sincronização: {new Date(config.ultima_sincronizacao).toLocaleString('pt-PT')}
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Selector de Dia */}
                          <div className="w-48">
                            <Select
                              value={config?.dia_semana?.toString() || '1'}
                              onValueChange={(value) => handleAtualizarDia(parceiro.id, value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {diasSemana.map((dia) => (
                                  <SelectItem key={dia.value} value={dia.value}>
                                    {dia.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Botão Forçar */}
                          <Button
                            onClick={() => handleForcarSincronizacao(parceiro.id)}
                            disabled={isSyncing}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            {isSyncing ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                A sincronizar...
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Forçar Agora
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Status da Sincronização */}
                      {config?.status && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Status:</span>
                            <Badge className={
                              config.status === 'sucesso' ? 'bg-green-100 text-green-800' :
                              config.status === 'erro' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {config.status}
                            </Badge>
                          </div>
                          
                          {config.mensagem_erro && (
                            <p className="text-xs text-red-600 mt-2">
                              Erro: {config.mensagem_erro}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoSincronizacao;
