import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, EyeOff, Key, Search, Shield, Copy, Check } from 'lucide-react';

const CredenciaisParceiros = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [credenciais, setCredenciais] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [senhasVisiveis, setSenhasVisiveis] = useState({});
  const [copiado, setCopiado] = useState({});

  useEffect(() => {
    fetchParceiros();
    fetchCredenciais();
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

  const fetchCredenciais = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/credenciais-parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredenciais(response.data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error('Erro ao carregar credenciais');
    } finally {
      setLoading(false);
    }
  };

  const toggleSenhaVisivel = (parceiroId, plataforma) => {
    const key = `${parceiroId}-${plataforma}`;
    setSenhasVisiveis({
      ...senhasVisiveis,
      [key]: !senhasVisiveis[key]
    });
  };

  const copiarTexto = async (texto, tipo, parceiroId) => {
    try {
      await navigator.clipboard.writeText(texto);
      const key = `${parceiroId}-${tipo}`;
      setCopiado({ ...copiado, [key]: true });
      toast.success(`${tipo} copiado!`);
      setTimeout(() => {
        setCopiado({ ...copiado, [key]: false });
      }, 2000);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const getParceiro = (parceiroId) => {
    return parceiros.find(p => p.id === parceiroId);
  };

  const getCredenciaisParceiro = (parceiroId) => {
    return credenciais.filter(c => c.parceiro_id === parceiroId);
  };

  const parceirosFiltrados = parceiros.filter(p => {
    const nome = (p.nome_empresa || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const searchTerm = busca.toLowerCase();
    return nome.includes(searchTerm) || email.includes(searchTerm);
  });

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Credenciais dos Parceiros</h1>
            <p className="text-slate-600 mt-1">
              Visualize email e password de acesso às plataformas
            </p>
          </div>
          <Shield className="w-8 h-8 text-red-600" />
        </div>

        {/* Warning Card */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-red-600 mt-1" />
              <div>
                <p className="text-sm text-red-900 font-medium">⚠️ Área Restrita - Admin</p>
                <p className="text-sm text-red-800 mt-1">
                  Esta informação é <strong>confidencial</strong>. Use apenas para suporte técnico ou resolução de problemas.
                  Todas as visualizações são registadas no sistema de auditoria.
                </p>
                <p className="text-sm text-red-800 mt-2">
                  <strong>Nota sobre passwords:</strong> Por segurança, as passwords são encriptadas com bcrypt e não podem ser desencriptadas. 
                  Para consultar as passwords originais dos utilizadores de teste, ver o ficheiro <code className="bg-red-100 px-1 rounded">CREDENCIAIS_TESTE.md</code>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Parceiros e Credenciais */}
        {loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">A carregar credenciais...</p>
            </CardContent>
          </Card>
        ) : parceirosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-slate-600">Nenhum parceiro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {parceirosFiltrados.map((parceiro) => {
              const credsParceiro = getCredenciaisParceiro(parceiro.id);
              
              return (
                <Card key={parceiro.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          {parceiro.nome_empresa || 'Sem nome'}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">{parceiro.email}</p>
                      </div>
                      <Badge variant="outline">
                        {credsParceiro.length} plataforma(s)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {credsParceiro.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-lg">
                        <Key className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">
                          Nenhuma credencial configurada
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {credsParceiro.map((cred, idx) => {
                          const senhaKey = `${parceiro.id}-${cred.plataforma}`;
                          const emailCopiadoKey = `${parceiro.id}-email-${idx}`;
                          const senhaCopiadaKey = `${parceiro.id}-senha-${idx}`;
                          
                          return (
                            <div
                              key={idx}
                              className="border rounded-lg p-4 bg-slate-50"
                            >
                              {/* Plataforma */}
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-slate-900 capitalize">
                                  {cred.plataforma}
                                </h4>
                                <Badge className="bg-blue-100 text-blue-800">
                                  Ativa
                                </Badge>
                              </div>
                              
                              {/* Email */}
                              <div className="mb-3">
                                <label className="text-xs text-slate-600 font-medium">
                                  Email / Username
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    value={cred.email || cred.username}
                                    readOnly
                                    className="font-mono text-sm"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copiarTexto(cred.email || cred.username, 'Email', `${parceiro.id}-${idx}`)}
                                  >
                                    {copiado[emailCopiadoKey] ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Password */}
                              <div>
                                <label className="text-xs text-slate-600 font-medium">
                                  Password
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    type={senhasVisiveis[senhaKey] ? 'text' : 'password'}
                                    value={cred.password}
                                    readOnly
                                    className="font-mono text-sm"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleSenhaVisivel(parceiro.id, cred.plataforma)}
                                  >
                                    {senhasVisiveis[senhaKey] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copiarTexto(cred.password, 'Password', `${parceiro.id}-senha-${idx}`)}
                                  >
                                    {copiado[senhaCopiadaKey] ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Info adicional */}
                              {cred.updated_at && (
                                <p className="text-xs text-slate-500 mt-3">
                                  Última atualização: {new Date(cred.updated_at).toLocaleString('pt-PT')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CredenciaisParceiros;
