import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Users, CheckCircle, Clock, FileText } from 'lucide-react';

const Motoristas = ({ user, onLogout }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMotoristas();
  }, []);

  const fetchMotoristas = async () => {
    try {
      const response = await axios.get(`${API}/motoristas`);
      setMotoristas(response.data);
    } catch (error) {
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (motoristaId) => {
    try {
      await axios.put(`${API}/motoristas/${motoristaId}/approve`);
      toast.success('Motorista aprovado com sucesso!');
      fetchMotoristas();
    } catch (error) {
      toast.error('Erro ao aprovar motorista');
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="motoristas-page">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Motoristas</h1>
          <p className="text-slate-600">Gerir motoristas e aprovações</p>
        </div>

        {motoristas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum motorista registado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {motoristas.map((motorista) => (
              <Card key={motorista.id} className="card-hover" data-testid={`motorista-card-${motorista.id}`}>
                <CardHeader>
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg font-semibold">
                        {getInitials(motorista.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{motorista.name}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">{motorista.email}</p>
                      <div className="mt-2">
                        {motorista.approved ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aprovado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Telefone:</span>
                      <span className="font-medium">{motorista.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Carta:</span>
                      <span className="font-medium">{motorista.license_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Validade:</span>
                      <span className="font-medium">{new Date(motorista.license_expiry).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-center space-x-2 text-sm text-slate-600 mb-2">
                      <FileText className="w-4 h-4" />
                      <span>Documentos:</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Carta:</span>
                        <Badge variant="outline" className={motorista.documents?.license_photo ? "text-emerald-600" : "text-slate-400"}>
                          {motorista.documents?.license_photo ? 'Enviado' : 'Pendente'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>CV:</span>
                        <Badge variant="outline" className={motorista.documents?.cv_file ? "text-emerald-600" : "text-slate-400"}>
                          {motorista.documents?.cv_file ? 'Enviado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {!motorista.approved && (user.role === 'admin' || user.role === 'gestor_associado' || user.role === 'parceiro_associado') && (
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
                      onClick={() => handleApprove(motorista.id)}
                      data-testid={`approve-motorista-${motorista.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Aprovar Motorista
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Motoristas;