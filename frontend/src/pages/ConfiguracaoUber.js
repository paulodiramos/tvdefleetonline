import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Car, CheckCircle, AlertCircle, RefreshCw, Loader2,
  Building, Users, DollarSign, Download, Play, Clock, FileText
} from 'lucide-react';

const ConfiguracaoUber = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [parceiros, setParceiros] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [extraindo, setExtraindo] = useState({});
  const [extraindoTodos, setExtraindoTodos] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const [parceirosRes, historicoRes] = await Promise.all([
        axios.get(`${API}/uber/admin/parceiros`, { headers: { Authorization: `Bearer ${token}` }}),
        axios.get(`${API}/uber/admin/historico`, { headers: { Authorization: `Bearer ${token}` }})
      ]);
      
      setParceiros(parceirosRes.data || []);
      setHistorico(historicoRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const extrairParceiro = async (parceiroId) => {
    setExtraindo(prev => ({ ...prev, [parceiroId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      toast.info('A extrair rendimentos... aguarde.');
      
      const response = await axios.post(`${API}/uber/admin/extrair/${parceiroId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 180000
      });
      
      if (response.data.sucesso) {
        toast.success(`Extração concluída! ${response.data.total_motoristas} motoristas, €${response.data.total_rendimentos?.toFixed(2)}`);
        carregarDados();
      } else {
        toast.error(response.data.erro || 'Extração falhou');
      }
    } catch (error) {
      toast.error('Erro na extração');
    } finally {
      setExtraindo(prev => ({ ...prev, [parceiroId]: false }));
    }
  };

  const extrairTodos = async () => {
    setExtraindoTodos(true);
    
    try {
      const token = localStorage.getItem('token');
      toast.info('A extrair rendimentos de todos os parceiros...');
      
      const response = await axios.post(`${API}/uber/admin/extrair-todos`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 600000 // 10 minutos
      });
      
      toast.success(`Concluído! ${response.data.sucesso}/${response.data.total} extrações bem sucedidas`);
      carregarDados();
    } catch (error) {
      toast.error('Erro na extração');
    } finally {
      setExtraindoTodos(false);
    }
  };

  // Estatísticas
  const totalParceiros = parceiros.length;
  const sessoesAtivas = parceiros.filter(p => p.sessao_ativa).length;
  const comCredenciais = parceiros.filter(p => p.tem_credenciais).length;

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
              Gestão Uber Fleet
            </h1>
            <p className="text-gray-500 mt-1">
              Monitorize sessões e extraia rendimentos dos parceiros
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={carregarDados}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button 
              onClick={extrairTodos} 
              disabled={extraindoTodos || sessoesAtivas === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {extraindoTodos ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Extrair Todos
            </Button>
          </div>
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
                  <p className="text-sm text-gray-500">Com Credenciais</p>
                  <p className="text-3xl font-bold text-yellow-600">{comCredenciais}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Users className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Parceiros */}
        <Card>
          <CardHeader>
            <CardTitle>Parceiros</CardTitle>
            <CardDescription>
              Parceiros com sessão ativa podem ter rendimentos extraídos automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parceiros.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum parceiro encontrado</p>
            ) : (
              <div className="space-y-3">
                {parceiros.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-lg border ${
                      p.sessao_ativa 
                        ? 'border-green-200 bg-green-50' 
                        : p.tem_credenciais 
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          p.sessao_ativa ? 'bg-green-200' : p.tem_credenciais ? 'bg-yellow-200' : 'bg-gray-200'
                        }`}>
                          <Building className={`w-4 h-4 ${
                            p.sessao_ativa ? 'text-green-700' : p.tem_credenciais ? 'text-yellow-700' : 'text-gray-700'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{p.name}</h3>
                          <p className="text-sm text-gray-500">{p.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Badges de estado */}
                        {!p.tem_credenciais && (
                          <Badge variant="outline" className="text-gray-500">
                            Sem credenciais
                          </Badge>
                        )}
                        
                        {p.tem_credenciais && !p.sessao_ativa && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Sessão expirada
                          </Badge>
                        )}
                        
                        {p.sessao_ativa && (
                          <Badge className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativa ({p.sessao_dias}d)
                          </Badge>
                        )}
                        
                        {/* Botão de extração */}
                        <Button
                          size="sm"
                          onClick={() => extrairParceiro(p.id)}
                          disabled={!p.sessao_ativa || extraindo[p.id]}
                          className={p.sessao_ativa ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          {extraindo[p.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Extrair
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        {historico.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Histórico de Importações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historico.slice(0, 10).map((imp, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(imp.created_at).toLocaleString('pt-PT')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {imp.parceiro_id?.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        <Users className="w-3 h-3 inline mr-1" />
                        {imp.total_motoristas}
                      </span>
                      <span className="text-sm font-semibold text-green-600">
                        <DollarSign className="w-3 h-3 inline" />
                        €{imp.total_rendimentos?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ConfiguracaoUber;
