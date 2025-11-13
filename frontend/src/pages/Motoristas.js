import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, CheckCircle, Clock, FileText, Plus, Mail, Phone, MapPin, CreditCard, Edit, X, Save } from 'lucide-react';

const Motoristas = ({ user, onLogout }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newMotorista, setNewMotorista] = useState({
    email: '',
    name: '',
    phone: '',
    morada_completa: '',
    codigo_postal: '',
    data_nascimento: '',
    nacionalidade: 'Portuguesa',
    tipo_documento: 'CC',
    numero_documento: '',
    validade_documento: '',
    nif: '',
    carta_conducao_numero: '',
    carta_conducao_validade: '',
    licenca_tvde_numero: '',
    licenca_tvde_validade: '',
    regime: 'aluguer',
    iban: '',
    whatsapp: '',
    tipo_pagamento: 'recibo_verde',
    senha_provisoria: true
  });

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

  const handleAddMotorista = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/motoristas/register`, newMotorista);
      toast.success('Motorista adicionado! Senha provisória: últimos 9 dígitos do telefone');
      setShowAddDialog(false);
      fetchMotoristas();
      setNewMotorista({
        email: '',
        name: '',
        phone: '',
        morada_completa: '',
        codigo_postal: '',
        data_nascimento: '',
        nacionalidade: 'Portuguesa',
        tipo_documento: 'CC',
        numero_documento: '',
        validade_documento: '',
        nif: '',
        carta_conducao_numero: '',
        carta_conducao_validade: '',
        licenca_tvde_numero: '',
        licenca_tvde_validade: '',
        regime: 'aluguer',
        iban: '',
        whatsapp: '',
        tipo_pagamento: 'recibo_verde',
        senha_provisoria: true
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar motorista');
    }
  };

  const handleEditMotorista = () => {
    setEditForm({
      ...selectedMotorista,
      // Inicializar emails Uber/Bolt com email do motorista se vazios
      email_uber: selectedMotorista.email_uber || selectedMotorista.email,
      email_bolt: selectedMotorista.email_bolt || selectedMotorista.email
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveMotorista = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/motoristas/${selectedMotorista.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Motorista atualizado com sucesso!');
      setIsEditing(false);
      setShowDetailDialog(false);
      fetchMotoristas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar motorista');
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Motoristas</h1>
            <p className="text-slate-600">Gerir motoristas e aprovações</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestor_associado' || user.role === 'parceiro_associado') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-motorista-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Motorista
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="add-motorista-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Motorista</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMotorista} className="space-y-6">
                  <Tabs defaultValue="pessoal" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
                      <TabsTrigger value="documentacao">Documentação</TabsTrigger>
                      <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pessoal" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome Completo *</Label>
                          <Input value={newMotorista.name} onChange={(e) => setNewMotorista({...newMotorista, name: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input type="email" value={newMotorista.email} onChange={(e) => setNewMotorista({...newMotorista, email: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefone *</Label>
                          <Input value={newMotorista.phone} onChange={(e) => setNewMotorista({...newMotorista, phone: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>WhatsApp</Label>
                          <Input value={newMotorista.whatsapp} onChange={(e) => setNewMotorista({...newMotorista, whatsapp: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Data Nascimento</Label>
                          <Input type="date" value={newMotorista.data_nascimento} onChange={(e) => setNewMotorista({...newMotorista, data_nascimento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nacionalidade</Label>
                          <Input value={newMotorista.nacionalidade} onChange={(e) => setNewMotorista({...newMotorista, nacionalidade: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Morada Completa</Label>
                        <Input value={newMotorista.morada_completa} onChange={(e) => setNewMotorista({...newMotorista, morada_completa: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Código Postal</Label>
                        <Input value={newMotorista.codigo_postal} onChange={(e) => setNewMotorista({...newMotorista, codigo_postal: e.target.value})} />
                      </div>
                    </TabsContent>
                    <TabsContent value="documentacao" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo Documento</Label>
                          <Select value={newMotorista.tipo_documento} onValueChange={(value) => setNewMotorista({...newMotorista, tipo_documento: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CC">Cartão Cidadão</SelectItem>
                              <SelectItem value="Passaporte">Passaporte</SelectItem>
                              <SelectItem value="Residencia">Residência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Documento</Label>
                          <Input value={newMotorista.numero_documento} onChange={(e) => setNewMotorista({...newMotorista, numero_documento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade Documento</Label>
                          <Input type="date" value={newMotorista.validade_documento} onChange={(e) => setNewMotorista({...newMotorista, validade_documento: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>NIF</Label>
                          <Input value={newMotorista.nif} onChange={(e) => setNewMotorista({...newMotorista, nif: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Carta Condução</Label>
                          <Input value={newMotorista.carta_conducao_numero} onChange={(e) => setNewMotorista({...newMotorista, carta_conducao_numero: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade Carta</Label>
                          <Input type="date" value={newMotorista.carta_conducao_validade} onChange={(e) => setNewMotorista({...newMotorista, carta_conducao_validade: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Licença TVDE</Label>
                          <Input value={newMotorista.licenca_tvde_numero} onChange={(e) => setNewMotorista({...newMotorista, licenca_tvde_numero: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade TVDE</Label>
                          <Input type="date" value={newMotorista.licenca_tvde_validade} onChange={(e) => setNewMotorista({...newMotorista, licenca_tvde_validade: e.target.value})} />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="financeiro" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>IBAN</Label>
                          <Input value={newMotorista.iban} onChange={(e) => setNewMotorista({...newMotorista, iban: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Regime</Label>
                          <Select value={newMotorista.regime} onValueChange={(value) => setNewMotorista({...newMotorista, regime: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aluguer">Aluguer</SelectItem>
                              <SelectItem value="comissao">Comissão</SelectItem>
                              <SelectItem value="carro_proprio">Carro Próprio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo Pagamento</Label>
                          <Select value={newMotorista.tipo_pagamento} onValueChange={(value) => setNewMotorista({...newMotorista, tipo_pagamento: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fatura">Fatura</SelectItem>
                              <SelectItem value="recibo_verde">Recibo Verde</SelectItem>
                              <SelectItem value="sem_recibo">Sem Recibo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700"><strong>Nota:</strong> Será criada uma senha provisória com os últimos 9 dígitos do telefone. O motorista deverá alterá-la no primeiro login.</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    Adicionar Motorista
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
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
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{motorista.phone}</span>
                    </div>
                    {motorista.carta_conducao_numero && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Carta:</span>
                        <span className="font-medium">{motorista.carta_conducao_numero}</span>
                      </div>
                    )}
                    {motorista.licenca_tvde_numero && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">TVDE:</span>
                        <span className="font-medium">{motorista.licenca_tvde_numero}</span>
                      </div>
                    )}
                    {motorista.regime && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Regime:</span>
                        <Badge variant="outline" className="capitalize">{motorista.regime}</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 pt-3 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedMotorista(motorista);
                        setShowDetailDialog(true);
                      }}
                    >
                      Ver Detalhes
                    </Button>
                    {!motorista.approved && (user.role === 'admin' || user.role === 'gestor_associado' || user.role === 'parceiro_associado') && (
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(motorista.id)}
                        data-testid={`approve-motorista-${motorista.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) {
            setIsEditing(false);
            setEditForm({});
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex justify-between items-center">
                <DialogTitle>Detalhes do Motorista</DialogTitle>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button onClick={handleEditMotorista} size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleCancelEdit} variant="outline" size="sm">
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveMotorista} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </DialogHeader>
            {selectedMotorista && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-bold">
                      {getInitials(isEditing ? editForm.name : selectedMotorista.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          placeholder="Nome"
                          className="text-xl font-bold"
                        />
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          placeholder="Email"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold">{selectedMotorista.name}</h3>
                        <p className="text-slate-600">{selectedMotorista.email}</p>
                      </>
                    )}
                  </div>
                </div>

                <Tabs defaultValue="pessoal" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                    <TabsTrigger value="docs">Documentação</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pessoal" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Telefone</Label>
                        {isEditing ? (
                          <Input value={editForm.phone || ''} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.phone}</p>
                        )}
                      </div>
                      <div>
                        <Label>WhatsApp</Label>
                        {isEditing ? (
                          <Input value={editForm.whatsapp || ''} onChange={(e) => setEditForm({...editForm, whatsapp: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.whatsapp || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Data Nascimento</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.data_nascimento || ''} onChange={(e) => setEditForm({...editForm, data_nascimento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.data_nascimento ? new Date(selectedMotorista.data_nascimento).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nacionalidade</Label>
                        {isEditing ? (
                          <Input value={editForm.nacionalidade || ''} onChange={(e) => setEditForm({...editForm, nacionalidade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.nacionalidade || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Morada Completa</Label>
                      {isEditing ? (
                        <Input value={editForm.morada_completa || ''} onChange={(e) => setEditForm({...editForm, morada_completa: e.target.value})} />
                      ) : (
                        <p className="font-medium">{selectedMotorista.morada_completa || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label>Código Postal</Label>
                      {isEditing ? (
                        <Input value={editForm.codigo_postal || ''} onChange={(e) => setEditForm({...editForm, codigo_postal: e.target.value})} />
                      ) : (
                        <p className="font-medium">{selectedMotorista.codigo_postal || 'N/A'}</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo Documento</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.tipo_documento || ''} onChange={(e) => setEditForm({...editForm, tipo_documento: e.target.value})}>
                            <option value="">Selecione</option>
                            <option value="CC">Cartão de Cidadão</option>
                            <option value="passaporte">Passaporte</option>
                            <option value="outro">Outro</option>
                          </select>
                        ) : (
                          <p className="font-medium">{selectedMotorista.tipo_documento || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Documento</Label>
                        {isEditing ? (
                          <Input value={editForm.numero_documento || ''} onChange={(e) => setEditForm({...editForm, numero_documento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.numero_documento || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade Documento</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.validade_documento || ''} onChange={(e) => setEditForm({...editForm, validade_documento: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.validade_documento ? new Date(selectedMotorista.validade_documento).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>NIF</Label>
                        {isEditing ? (
                          <Input value={editForm.nif || ''} onChange={(e) => setEditForm({...editForm, nif: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.nif || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Carta Condução</Label>
                        {isEditing ? (
                          <Input value={editForm.carta_conducao_numero || ''} onChange={(e) => setEditForm({...editForm, carta_conducao_numero: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.carta_conducao_numero || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade Carta</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.carta_conducao_validade || ''} onChange={(e) => setEditForm({...editForm, carta_conducao_validade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.carta_conducao_validade ? new Date(selectedMotorista.carta_conducao_validade).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Nº Licença TVDE</Label>
                        {isEditing ? (
                          <Input value={editForm.licenca_tvde_numero || ''} onChange={(e) => setEditForm({...editForm, licenca_tvde_numero: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.licenca_tvde_numero || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Validade TVDE</Label>
                        {isEditing ? (
                          <Input type="date" value={editForm.licenca_tvde_validade || ''} onChange={(e) => setEditForm({...editForm, licenca_tvde_validade: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.licenca_tvde_validade ? new Date(selectedMotorista.licenca_tvde_validade).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>IBAN</Label>
                        {isEditing ? (
                          <Input value={editForm.iban || ''} onChange={(e) => setEditForm({...editForm, iban: e.target.value})} />
                        ) : (
                          <p className="font-medium">{selectedMotorista.iban || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Regime</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.regime || ''} onChange={(e) => setEditForm({...editForm, regime: e.target.value})}>
                            <option value="aluguer">Aluguer</option>
                            <option value="comissao">Comissão</option>
                            <option value="carro_proprio">Carro Próprio</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{selectedMotorista.regime || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label>Tipo Pagamento</Label>
                        {isEditing ? (
                          <select className="w-full p-2 border rounded-md" value={editForm.tipo_pagamento || ''} onChange={(e) => setEditForm({...editForm, tipo_pagamento: e.target.value})}>
                            <option value="fatura">Fatura</option>
                            <option value="recibo_verde">Recibo Verde</option>
                            <option value="sem_recibo">Sem Recibo</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{selectedMotorista.tipo_pagamento ? selectedMotorista.tipo_pagamento.replace('_', ' ') : 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <Label className="mb-3 block">Plataformas</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Email Uber</Label>
                          {isEditing ? (
                            <Input value={editForm.email_uber || ''} onChange={(e) => setEditForm({...editForm, email_uber: e.target.value})} />
                          ) : (
                            <p className="font-medium">{selectedMotorista.email_uber || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm">Email Bolt</Label>
                          {isEditing ? (
                            <Input value={editForm.email_bolt || ''} onChange={(e) => setEditForm({...editForm, email_bolt: e.target.value})} />
                          ) : (
                            <p className="font-medium">{selectedMotorista.email_bolt || 'N/A'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Motoristas;