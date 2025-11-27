import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { User, Mail, Phone, MapPin, Car, Package, Calendar, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MotoristaPerfil = ({ user, onLogout }) => {
  const [motoristaData, setMotoristaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMotoristaData();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristaData(response.data);
    } catch (error) {
      console.error('Error fetching motorista data:', error);
      toast.error('Erro ao carregar perfil');
    } finally {
      setLoading(false);
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
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
            <p className="text-slate-600 mt-1">Resumo das suas informações</p>
          </div>
          <Button onClick={() => navigate('/profile')}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Dados Completos
          </Button>
        </div>

        {/* Informações Principais */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <CardTitle>Informações Pessoais</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Nome Completo</p>
                <p className="font-semibold">{motoristaData?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-semibold flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-slate-400" />
                  {motoristaData?.email || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Telefone</p>
                <p className="font-semibold flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-slate-400" />
                  {motoristaData?.phone || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Data de Nascimento</p>
                <p className="font-semibold flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                  {motoristaData?.data_nascimento ? new Date(motoristaData.data_nascimento).toLocaleDateString('pt-PT') : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-green-600" />
                <CardTitle>Morada</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Morada Completa</p>
                <p className="font-semibold">{motoristaData?.morada_completa || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Código Postal</p>
                  <p className="font-semibold">{motoristaData?.codigo_postal || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Localidade</p>
                  <p className="font-semibold">{motoristaData?.localidade || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600">NIF</p>
                <p className="font-semibold">{motoristaData?.nif || '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Veículo e Plano */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Car className="w-5 h-5 text-orange-600" />
                <CardTitle>Veículo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {motoristaData?.vehicle_assigned ? (
                <div className="space-y-2">
                  <Badge className="bg-green-100 text-green-800">Veículo Atribuído</Badge>
                  <p className="text-sm text-slate-600 mt-2">ID: {motoristaData.vehicle_assigned}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Car className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Nenhum veículo atribuído</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/motorista/oportunidades')}>
                    Ver Oportunidades
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-purple-600" />
                <CardTitle>Plano Ativo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {motoristaData?.plano_nome ? (
                <div className="space-y-2">
                  <Badge className="bg-blue-100 text-blue-800">{motoristaData.plano_nome}</Badge>
                  <p className="text-sm text-slate-600 mt-2">Plano ativo e funcional</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Nenhum plano ativo</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/profile')}>
                    Escolher Plano
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MotoristaPerfil;