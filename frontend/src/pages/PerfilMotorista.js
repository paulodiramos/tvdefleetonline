import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertCircle, TrendingUp, User, Package } from 'lucide-react';
import MotoristaDashboard from '@/components/MotoristaDashboard';
import MotoristaDadosPessoaisExpanded from '@/components/MotoristaDadosPessoaisExpanded';
import MotoristaPlanos from '@/components/MotoristaPlanos';

const PerfilMotorista = ({ user, onLogout }) => {
  const [motoristaData, setMotoristaData] = useState(null);
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMotoristaData();
    fetchRelatorios();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Buscar motorista pelo ID do usuário logado
      const response = await axios.get(`${API}/motoristas/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setMotoristaData(response.data);
      } else {
        toast.error('Perfil de motorista não encontrado. Contacte o administrador.');
      }
    } catch (error) {
      console.error('Error fetching motorista data:', error);
      
      // Mensagem de erro mais detalhada
      if (error.response?.status === 404) {
        toast.error('Perfil de motorista não encontrado. Contacte o administrador para criar seu perfil.');
      } else if (error.response?.status === 403) {
        toast.error('Acesso negado. Verifique suas permissões.');
      } else {
        toast.error('Erro ao carregar dados do motorista. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatorios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/relatorios-ganhos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRelatorios(response.data);
    } catch (error) {
      console.error('Error fetching relatorios:', error);
    }
  };

  const handleUpdate = () => {
    fetchMotoristaData();
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">A carregar perfil...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!motoristaData) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Perfil de Motorista não encontrado</h2>
          <p className="text-slate-600">
            Contacte o administrador para configurar o seu perfil de motorista.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" onClick={(e) => {
              if (window.hasUnsavedChanges && window.hasUnsavedChanges()) {
                const confirmLeave = window.confirm('Tem alterações não guardadas. Deseja sair sem guardar?');
                if (!confirmLeave) {
                  e.preventDefault();
                }
              }
            }}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="dados">
              <User className="w-4 h-4 mr-2" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="planos" onClick={(e) => {
              if (window.hasUnsavedChanges && window.hasUnsavedChanges()) {
                const confirmLeave = window.confirm('Tem alterações não guardadas. Deseja sair sem guardar?');
                if (!confirmLeave) {
                  e.preventDefault();
                }
              }
            }}>
              <Package className="w-4 h-4 mr-2" />
              Meus Planos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard">
            <MotoristaDashboard 
              motoristaData={motoristaData} 
              relatorios={relatorios}
            />
          </TabsContent>

          {/* Tab: Dados Pessoais e Documentos */}
          <TabsContent value="dados">
            <MotoristaDadosPessoaisExpanded 
              motoristaData={motoristaData}
              onUpdate={handleUpdate}
              userRole={user.role}
            />
          </TabsContent>

          {/* Tab: Planos */}
          <TabsContent value="planos">
            <MotoristaPlanos 
              motoristaData={motoristaData}
              onUpdate={handleUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PerfilMotorista;
