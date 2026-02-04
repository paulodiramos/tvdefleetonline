import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, RefreshCw, 
  Clock, Building, Loader2, Shield, Users, Eye
} from 'lucide-react';

const ConfiguracaoUber = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessaoStatus, setSessaoStatus] = useState({});

  useEffect(() => {
    fetchParceiros();
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      
      // Verificar status de sessão para cada parceiro
      for (const parceiro of response.data) {
        checkSessaoUber(parceiro.id);
      }
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const checkSessaoUber = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/rpa/uber/sessao-status/${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessaoStatus(prev => ({ ...prev, [parceiroId]: response.data }));
    } catch (error) {
      setSessaoStatus(prev => ({ ...prev, [parceiroId]: { valida: false, erro: true } }));
    }
  };

  const getSessaoStatusBadge = (parceiroId) => {
    const status = sessaoStatus[parceiroId];
    if (!status) return <Badge variant="outline">A verificar...</Badge>;
    if (status.erro) return <Badge variant="destructive">Erro</Badge>;
    if (status.valida) {
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ativa
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Expirada
      </Badge>
    );
  };

  // Contagens
  const totalParceiros = parceiros.length;
  const sessoesAtivas = Object.values(sessaoStatus).filter(s => s?.valida).length;
  const sessoesExpiradas = totalParceiros - sessoesAtivas;

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Car className="w-7 h-7 text-blue-500" />
              Monitorização Uber Fleet
            </h1>
            <p className="text-gray-500 mt-1">
              Acompanhe o estado das sessões Uber de todos os parceiros
            </p>
          </div>
          <Button variant="outline" onClick={fetchParceiros}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Parceiros</p>
                  <p className="text-3xl font-bold">{totalParceiros}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Sessões Ativas</p>
                  <p className="text-3xl font-bold text-green-600">{sessoesAtivas}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Sessões Expiradas</p>
                  <p className="text-3xl font-bold text-red-600">{sessoesExpiradas}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Parceiros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Estado dos Parceiros
            </CardTitle>
            <CardDescription>
              Parceiros com sessão expirada precisam fazer login manual na área deles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parceiros.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum parceiro encontrado</p>
            ) : (
              <div className="space-y-3">
                {parceiros.map((parceiro) => {
                  const status = sessaoStatus[parceiro.id];
                  return (
                    <div
                      key={parceiro.id}
                      className={`p-4 rounded-lg border ${
                        status?.valida 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            status?.valida ? 'bg-green-200' : 'bg-red-200'
                          }`}>
                            <Building className={`w-4 h-4 ${
                              status?.valida ? 'text-green-700' : 'text-red-700'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{parceiro.nome || parceiro.name}</h3>
                            <p className="text-sm text-gray-500">{parceiro.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {status?.valida && status?.expira && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expira: {new Date(status.expira).toLocaleDateString('pt-PT')}
                            </span>
                          )}
                          {getSessaoStatusBadge(parceiro.id)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Como funciona?</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Cada parceiro configura as suas credenciais na área própria</li>
                  <li>O parceiro faz login manual quando há CAPTCHA</li>
                  <li>O parceiro extrai os seus próprios rendimentos</li>
                  <li>Esta página mostra apenas o estado das sessões</li>
                  <li>Contacte parceiros com sessão expirada para renovarem o login</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfiguracaoUber;
