import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Building, Mail, Phone, Car, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Parceiros = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newParceiro, setNewParceiro] = useState({
    name: '',
    email: '',
    phone: '',
    empresa: '',
    nif: '',
    morada: ''
  });

  useEffect(() => {
    fetchParceiros();
  }, []);

  const fetchParceiros = async () => {
    try {
      const response = await axios.get(`${API}/parceiros`);
      setParceiros(response.data);
    } catch (error) {
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParceiro = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/parceiros`, newParceiro);
      toast.success('Parceiro adicionado com sucesso! Password padrão: parceiro123');
      setShowAddDialog(false);
      fetchParceiros();
      setNewParceiro({
        name: '',
        email: '',
        phone: '',
        empresa: '',
        nif: '',
        morada: ''
      });
    } catch (error) {
      toast.error('Erro ao adicionar parceiro');
    }
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
      <div className="space-y-6" data-testid="parceiros-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Parceiros</h1>
            <p className="text-slate-600">Gerir parceiros associados</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestor_associado') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-parceiro-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parceiro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="add-parceiro-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Parceiro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddParceiro} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={newParceiro.name} onChange={(e) => setNewParceiro({...newParceiro, name: e.target.value})} required data-testid="parceiro-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input id="empresa" value={newParceiro.empresa} onChange={(e) => setNewParceiro({...newParceiro, empresa: e.target.value})} data-testid="parceiro-empresa-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={newParceiro.email} onChange={(e) => setNewParceiro({...newParceiro, email: e.target.value})} required data-testid="parceiro-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={newParceiro.phone} onChange={(e) => setNewParceiro({...newParceiro, phone: e.target.value})} required data-testid="parceiro-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">NIF</Label>
                      <Input id="nif" value={newParceiro.nif} onChange={(e) => setNewParceiro({...newParceiro, nif: e.target.value})} data-testid="parceiro-nif-input" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="morada">Morada</Label>
                      <Input id="morada" value={newParceiro.morada} onChange={(e) => setNewParceiro({...newParceiro, morada: e.target.value})} data-testid="parceiro-morada-input" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-parceiro-button">
                    Adicionar Parceiro
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {parceiros.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum parceiro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parceiros.map((parceiro) => (
              <Card key={parceiro.id} className="card-hover" data-testid={`parceiro-card-${parceiro.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{parceiro.name}</CardTitle>
                      {parceiro.empresa && (
                        <p className="text-sm text-slate-500 mt-1">{parceiro.empresa}</p>
                      )}
                    </div>
                    <Building className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{parceiro.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{parceiro.phone}</span>
                    </div>
                    {parceiro.nif && (
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-600">NIF:</span>
                        <span className="font-medium">{parceiro.nif}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-slate-600">Veículos:</span>
                      <div className="flex items-center space-x-1">
                        <Car className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-600">{parceiro.total_vehicles}</span>
                      </div>
                    </div>
                  </div>
                  {user.role === 'admin' && (
                    <Button
                      onClick={() => navigate('/edit-parceiro')}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar Parceiro
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

export default Parceiros;