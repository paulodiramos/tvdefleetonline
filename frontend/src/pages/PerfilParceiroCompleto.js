import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, Mail, Phone, Building, MapPin, Calendar, 
  Package, CheckCircle, TrendingUp, Users, Car, FileText, Download, Eye 
} from 'lucide-react';
import { toast } from 'sonner';

const PerfilParceiroCompleto = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [parceiroData, setParceiroData] = useState(null);
  const [planoData, setPlanoData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({
    total_motoristas: 0,
    total_veiculos: 0,
    total_contratos: 0
  });

  useEffect(() => {
    fetchParceiroData();
    fetchPlanoData();
    fetchStats();
    fetchTemplates();
  }, []);

  const fetchParceiroData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiroData(response.data);
    } catch (error) {
      console.error('Error fetching parceiro data:', error);
      toast.error('Erro ao carregar dados do parceiro');
    }
  };

  const fetchPlanoData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/meu-plano`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanoData(response.data);
    } catch (error) {
      console.error('Error fetching plano data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${user.id}/estatisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/${user.id}/templates-contrato`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
          <p className="text-slate-600 mt-2">Informações da sua conta e plano ativo</p>
        </div>

        {/* Dados do Parceiro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações do Parceiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Nome</p>
                  <p className="font-medium">{parceiroData?.name || user.name || 'N/A'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{parceiroData?.email || user.email}</p>
                </div>
              </div>

              {parceiroData?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Telefone</p>
                    <p className="font-medium">{parceiroData.phone}</p>
                  </div>
                </div>
              )}

              {parceiroData?.empresa && (
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Empresa</p>
                    <p className="font-medium">{parceiroData.empresa}</p>
                  </div>
                </div>
              )}

              {parceiroData?.morada && (
                <div className="flex items-center gap-3 md:col-span-2">
                  <MapPin className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Morada</p>
                    <p className="font-medium">{parceiroData.morada}</p>
                  </div>
                </div>
              )}

              {parceiroData?.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Membro desde</p>
                    <p className="font-medium">
                      {new Date(parceiroData.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Motoristas</p>
                  <p className="text-2xl font-bold">{stats.total_motoristas}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Veículos</p>
                  <p className="text-2xl font-bold">{stats.total_veiculos}</p>
                </div>
                <Car className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Contratos</p>
                  <p className="text-2xl font-bold">{stats.total_contratos || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates de Contrato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span>Meus Templates de Contrato</span>
              </div>
              <span className="text-sm font-normal text-slate-500">
                {templates.length} {templates.length === 1 ? 'template' : 'templates'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length > 0 ? (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-slate-800">
                            {template.nome_template || template.tipo_contrato}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {template.tipo_contrato}
                          </span>
                        </div>
                        {template.clausulas_texto && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                            {template.clausulas_texto.substring(0, 150)}...
                          </p>
                        )}
                        <div className="mt-2 flex gap-4 text-xs text-slate-500">
                          {template.valor_caucao && (
                            <span>Caução: €{template.valor_caucao}</span>
                          )}
                          {template.periodicidade_padrao && (
                            <span>Periodicidade: {template.periodicidade_padrao}</span>
                          )}
                          {template.created_at && (
                            <span>Criado: {new Date(template.created_at).toLocaleDateString('pt-PT')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Open preview in new window or modal
                            toast.info('Função de pré-visualização em desenvolvimento');
                          }}
                          title="Ver template completo"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(`${API}/templates-contratos/${template.id}/download-pdf`, '_blank');
                            toast.success('Download iniciado');
                          }}
                          className="text-green-600 hover:text-green-700"
                          title="Download em PDF"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum template de contrato criado</p>
                <p className="text-sm text-slate-400 mt-1">
                  Os templates de contrato são geridos pelo administrador
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plano Ativo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Plano Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planoData?.tem_plano ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{planoData.plano.nome}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {planoData.plano.descricao || 'Plano configurado pelo administrador'}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ativo
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-slate-500">Custo Mensal</p>
                    <p className="text-2xl font-bold text-blue-600">
                      €{planoData.custo_mensal?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  
                  {planoData.custo_semanal > 0 && (
                    <div>
                      <p className="text-sm text-slate-500">Custo Semanal</p>
                      <p className="text-lg font-semibold">
                        €{planoData.custo_semanal?.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {planoData.modulos && planoData.modulos.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      Módulos Incluídos ({planoData.modulos.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {planoData.modulos.map((modulo, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{modulo.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button onClick={() => window.location.href = '/meu-plano-parceiro'}>
                    Ver Detalhes do Plano
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum plano ativo</p>
                <p className="text-sm text-slate-400 mt-1">
                  Contacte o administrador para ativar um plano
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PerfilParceiroCompleto;
