import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  User, FileText, FilePlus, TrendingUp, Package, Settings
} from 'lucide-react';
import ListaContratos from './ListaContratos';
import TemplatesContratos from './TemplatesContratos';
import CriarContratoMotoristaParceiro from '@/components/CriarContratoMotoristaParceiro';

const PerfilParceiro = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('contratos');
  const [parceiroData, setParceiroData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modulosAtivos, setModulosAtivos] = useState([]);

  useEffect(() => {
    fetchParceiroData();
  }, []);

  const fetchParceiroData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Buscar dados do parceiro
      const response = await axios.get(`${API}/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setParceiroData(response.data);
      setModulosAtivos(response.data.modulos_ativos || []);
    } catch (error) {
      console.error('Error fetching parceiro data:', error);
      toast.error('Erro ao carregar dados do parceiro');
    } finally {
      setLoading(false);
    }
  };

  const hasModulo = (moduloNome) => {
    return modulosAtivos.includes(moduloNome);
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
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <User className="w-8 h-8 text-blue-600" />
            <span>Meu Perfil - {parceiroData?.nome_empresa || user.name}</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Gerir contratos, templates e informações da empresa
          </p>
        </div>

        {/* Módulos Ativos Badge */}
        {modulosAtivos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Módulos Ativos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {modulosAtivos.map((modulo) => (
                  <Badge key={modulo} className="bg-green-100 text-green-800">
                    {modulo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="contratos">
              <FileText className="w-4 h-4 mr-2" />
              Contratos
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FilePlus className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="gerar-contrato">
              <FilePlus className="w-4 h-4 mr-2" />
              Gerar Contrato
            </TabsTrigger>
          </TabsList>

          {/* Tab: Meus Contratos */}
          <TabsContent value="contratos">
            <ListaContratos user={user} onLogout={onLogout} showLayout={false} />
          </TabsContent>

          {/* Tab: Meus Templates */}
          <TabsContent value="templates">
            <TemplatesContratos user={user} onLogout={onLogout} showLayout={false} />
          </TabsContent>

          {/* Tab: Gerar Contrato Motorista */}
          <TabsContent value="gerar-contrato">
            <CriarContratoMotoristaParceiro 
              user={user} 
              parceiroId={user.id}
              onContratoCreated={() => setActiveTab('contratos')}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PerfilParceiro;
