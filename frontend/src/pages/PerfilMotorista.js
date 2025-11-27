import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  User, Car, FileText, Download, DollarSign, Upload, 
  Calendar, TrendingUp, AlertCircle, CheckCircle, X 
} from 'lucide-react';

const PerfilMotorista = ({ user, onLogout }) => {
  const [motoristaData, setMotoristaData] = useState(null);
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showOutroMetodo, setShowOutroMetodo] = useState(false);
  
  // File uploads
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docType, setDocType] = useState('');
  
  // Request vehicle modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    fetchMotoristaData();
    fetchVeiculosDisponiveis();
    fetchRelatorios();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Assuming motorista_id is stored in user or we fetch by user email
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Find motorista by user email
      const motorista = response.data.find(m => m.email === user.email);
      setMotoristaData(motorista);
    } catch (error) {
      console.error('Error fetching motorista data:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const fetchVeiculosDisponiveis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles/disponiveis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculosDisponiveis(response.data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaData.id}`,
        motoristaData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Perfil atualizado com sucesso!');
      setEditMode(false);
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    }
  };

  const handleUploadDocument = async (type) => {
    if (!selectedDoc) {
      toast.error('Selecione um ficheiro');
      return;
    }

    setUploadingDoc(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedDoc);

      const uploadRes = await axios.post(
        `${API}/motoristas/${motoristaData.id}/upload-documento/${type}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Documento enviado com sucesso!');
      setSelectedDoc(null);
      setDocType('');
      fetchMotoristaData();
    } catch (error) {
      toast.error('Erro ao enviar documento');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRequestVehicle = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/vehicles/${selectedVehicle}/request`,
        { motorista_id: motoristaData.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Solicitação enviada! Aguarde aprovação.');
      setShowRequestModal(false);
      setSelectedVehicle(null);
    } catch (error) {
      toast.error('Erro ao solicitar veículo');
    }
  };

  const downloadRecibo = (reciboUrl) => {
    window.open(`${API}${reciboUrl}`, '_blank');
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <p>A carregar...</p>
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800">Meu Perfil</h1>
            <p className="text-slate-600 mt-2">Gerir dados pessoais, veículos e relatórios</p>
          </div>
          <Badge className="text-lg px-4 py-2">Motorista</Badge>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">
              <TrendingUp className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="dados">
              <User className="w-4 h-4 mr-2" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="veiculos">
              <Car className="w-4 h-4 mr-2" />
              Veículos
            </TabsTrigger>
            <TabsTrigger value="financeiro">
              <DollarSign className="w-4 h-4 mr-2" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="documentos">
              <FileText className="w-4 h-4 mr-2" />
              Documentos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Period Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Ganhos Semanais</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data Início</Label>
                      <Input type="date" defaultValue={new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]} />
                    </div>
                    <div>
                      <Label>Data Fim</Label>
                      <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-600">Total Ganhos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      €{relatorios.reduce((sum, r) => sum + (r.valor_liquido || r.valor_total || 0), 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{relatorios.length} semanas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-600">Média Semanal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      €{relatorios.length > 0 
                        ? (relatorios.reduce((sum, r) => sum + (r.valor_liquido || r.valor_total || 0), 0) / relatorios.length).toFixed(2)
                        : '0.00'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">por semana</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-600">Total Viagens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">
                      {relatorios.reduce((sum, r) => sum + (r.numero_viagens || 0), 0)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">viagens realizadas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo Semanal</CardTitle>
                </CardHeader>
                <CardContent>
                  {relatorios.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Nenhum dado disponível para o período selecionado</p>
                  ) : (
                    <div className="space-y-3">
                      {relatorios.map(relatorio => (
                        <div key={relatorio.id} className="border rounded-lg p-4 hover:bg-slate-50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold">
                                Semana: {new Date(relatorio.periodo_inicio).toLocaleDateString('pt-PT')} - {new Date(relatorio.periodo_fim).toLocaleDateString('pt-PT')}
                              </p>
                            </div>
                            <Badge>{relatorio.status}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                            <div>
                              <p className="text-slate-600">Ganhos Uber</p>
                              <p className="font-semibold text-green-600">€{(relatorio.ganhos_uber || 0).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Ganhos Bolt</p>
                              <p className="font-semibold text-blue-600">€{(relatorio.ganhos_bolt || 0).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Viagens</p>
                              <p className="font-semibold">{relatorio.numero_viagens || 0}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Valor Líquido</p>
                              <p className="font-semibold text-lg text-purple-600">€{(relatorio.valor_liquido || relatorio.valor_total || 0).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Dados Pessoais */}
          <TabsContent value="dados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Informações Pessoais</CardTitle>
                <Button
                  variant="outline"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? <X className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
                  {editMode ? 'Cancelar' : 'Editar'}
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome Completo</Label>
                      <Input
                        value={motoristaData.name || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, name: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={motoristaData.email || ''} disabled />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={motoristaData.telefone || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, telefone: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label>NIF</Label>
                      <Input
                        value={motoristaData.nif || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, nif: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label>Nacionalidade</Label>
                      <Input
                        value={motoristaData.nacionalidade || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, nacionalidade: e.target.value})}
                        disabled={!editMode}
                        placeholder="Ex: Portuguesa"
                      />
                    </div>
                    <div>
                      <Label>Morada Completa</Label>
                      <Input
                        value={motoristaData.morada || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, morada: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label>Código Postal</Label>
                      <Input
                        value={motoristaData.codigo_postal || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, codigo_postal: e.target.value})}
                        disabled={!editMode}
                        placeholder="0000-000"
                      />
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={motoristaData.data_nascimento || ''}
                        onChange={(e) => setMotoristaData({...motoristaData, data_nascimento: e.target.value})}
                        disabled={!editMode}
                      />
                    </div>
                  </div>

                  {/* Documentação */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Documentação</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>CC/Residência/Passaporte Nº</Label>
                        <Input
                          value={motoristaData.documento_id || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, documento_id: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Validade do Documento</Label>
                        <Input
                          type="date"
                          value={motoristaData.documento_validade || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, documento_validade: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Segurança Social</Label>
                        <Input
                          value={motoristaData.seguranca_social || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, seguranca_social: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Cartão de Utente</Label>
                        <Input
                          value={motoristaData.cartao_utente || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, cartao_utente: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Código Registo Criminal</Label>
                        <Input
                          value={motoristaData.codigo_registo_criminal || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, codigo_registo_criminal: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Validade Registo Criminal</Label>
                        <Input
                          type="date"
                          value={motoristaData.registo_criminal_validade || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, registo_criminal_validade: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Método de Pagamento */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Método de Pagamento</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tipo</Label>
                        <select
                          value={motoristaData.metodo_pagamento || ''}
                          onChange={(e) => {
                            setMotoristaData({...motoristaData, metodo_pagamento: e.target.value});
                            setShowOutroMetodo(e.target.value === 'outro');
                            if (e.target.value !== 'outro') {
                              setMotoristaData({...motoristaData, metodo_pagamento: e.target.value, metodo_pagamento_outro: ''});
                            }
                          }}
                          disabled={!editMode}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        >
                          <option value="">Selecione...</option>
                          <option value="recibo">Recibo</option>
                          <option value="fatura">Fatura</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      {(motoristaData.metodo_pagamento === 'outro' || showOutroMetodo) && (
                        <div>
                          <Label>Especificar Outro</Label>
                          <Input
                            value={motoristaData.metodo_pagamento_outro || ''}
                            onChange={(e) => setMotoristaData({...motoristaData, metodo_pagamento_outro: e.target.value})}
                            disabled={!editMode}
                            placeholder="Ex: Recibo Verde"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dados Uber/Bolt */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Dados de Registo Plataformas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email Uber</Label>
                        <Input
                          type="email"
                          value={motoristaData.email_uber || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, email_uber: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Telefone Uber</Label>
                        <Input
                          value={motoristaData.telefone_uber || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, telefone_uber: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Email Bolt</Label>
                        <Input
                          type="email"
                          value={motoristaData.email_bolt || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, email_bolt: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Telefone Bolt</Label>
                        <Input
                          value={motoristaData.telefone_bolt || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, telefone_bolt: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contacto de Emergência */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Contacto de Emergência</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={motoristaData.emergencia_nome || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_nome: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input
                          value={motoristaData.emergencia_telefone || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_telefone: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={motoristaData.emergencia_email || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_email: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Ligação (Parentesco)</Label>
                        <Input
                          value={motoristaData.emergencia_ligacao || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_ligacao: e.target.value})}
                          disabled={!editMode}
                          placeholder="Ex: Cônjuge, Pai/Mãe"
                        />
                      </div>
                      <div>
                        <Label>Morada</Label>
                        <Input
                          value={motoristaData.emergencia_morada || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_morada: e.target.value})}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label>Código Postal</Label>
                        <Input
                          value={motoristaData.emergencia_codigo_postal || ''}
                          onChange={(e) => setMotoristaData({...motoristaData, emergencia_codigo_postal: e.target.value})}
                          disabled={!editMode}
                          placeholder="0000-000"
                        />
                      </div>
                    </div>
                  </div>

                  {editMode && (
                    <Button type="submit" className="w-full mt-6">
                      Guardar Alterações
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Veículos */}
          <TabsContent value="veiculos">
            {motoristaData.veiculo_atual ? (
              <Card>
                <CardHeader>
                  <CardTitle>Veículo Atribuído</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-green-800">Você já tem um veículo atribuído!</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Veículo ID: {motoristaData.veiculo_atual}
                    </p>
                    <p className="text-xs text-slate-500 mt-4">
                      Para mais informações sobre o seu veículo, contacte o gestor.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Veículos Disponíveis para Trabalhar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Candidatar-se a um veículo:</strong> Selecione o veículo desejado e formalize a sua candidatura. 
                      O gestor irá avaliar e responder em breve.
                    </p>
                  </div>

                  {veiculosDisponiveis.length === 0 ? (
                    <div className="text-center py-12">
                      <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">Nenhum veículo disponível no momento</p>
                      <p className="text-xs text-slate-400 mt-2">Verifique novamente mais tarde</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {veiculosDisponiveis.map(veiculo => (
                        <div key={veiculo.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{veiculo.marca} {veiculo.modelo}</h3>
                              <p className="text-sm text-slate-600">{veiculo.matricula}</p>
                              <p className="text-sm text-slate-500">Ano: {veiculo.ano}</p>
                              {veiculo.tipo_contrato?.tipo && (
                                <Badge className="mt-2" variant="outline">
                                  {veiculo.tipo_contrato.tipo}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedVehicle(veiculo.id);
                                setShowRequestModal(true);
                              }}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Candidatar-se
                            </Button>
                          </div>
                          {veiculo.tipo_contrato?.valor_aluguer && (
                            <p className="text-xs text-slate-500">
                              Valor: €{veiculo.tipo_contrato.valor_aluguer}/{veiculo.tipo_contrato.periodicidade || 'semana'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Financeiro */}
          <TabsContent value="financeiro">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios de Ganhos Semanais</CardTitle>
              </CardHeader>
              <CardContent>
                {relatorios.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    Nenhum relatório disponível
                  </p>
                ) : (
                  <div className="space-y-3">
                    {relatorios.map(relatorio => (
                      <div key={relatorio.id} className="border rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              Semana: {new Date(relatorio.periodo_inicio).toLocaleDateString()} - {new Date(relatorio.periodo_fim).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              Valor Líquido: €{relatorio.valor_liquido?.toFixed(2) || relatorio.valor_total?.toFixed(2)}
                            </p>
                            <Badge className="mt-2">{relatorio.status}</Badge>
                          </div>
                          <div className="flex space-x-2">
                            {relatorio.recibo_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadRecibo(relatorio.recibo_url)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Recibo
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Documentos */}
          <TabsContent value="documentos">
            <Card>
              <CardHeader>
                <CardTitle>Carregar Documentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Documento</Label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="">Selecione...</option>
                      <optgroup label="Identificação">
                        <option value="cc_frente">CC/Residência/Passaporte - Frente</option>
                        <option value="cc_verso">CC/Residência/Passaporte - Verso</option>
                      </optgroup>
                      <optgroup label="Carta de Condução">
                        <option value="carta_conducao_frente">Carta de Condução - Frente</option>
                        <option value="carta_conducao_verso">Carta de Condução - Verso</option>
                      </optgroup>
                      <optgroup label="Certificados">
                        <option value="licenca_tvde">Licença TVDE</option>
                        <option value="comprovativo_morada">Comprovativo de Morada</option>
                        <option value="registo_criminal">Registo Criminal</option>
                      </optgroup>
                      <optgroup label="Bancário">
                        <option value="comprovativo_iban">Comprovativo de IBAN</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <Label>Selecionar Ficheiro (PDF/Imagem)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setSelectedDoc(e.target.files[0])}
                    />
                    {selectedDoc && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {selectedDoc.name}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => handleUploadDocument(docType)}
                    disabled={!docType || !selectedDoc || uploadingDoc}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingDoc ? 'A enviar...' : 'Carregar Documento'}
                  </Button>
                </div>

                {/* Lista de Documentos Carregados */}
                <div className="mt-6 border-t pt-4">
                  <h3 className="font-semibold text-slate-700 mb-3">Documentos Carregados</h3>
                  <div className="space-y-2">
                    {motoristaData?.documentos && Object.keys(motoristaData.documentos).length > 0 ? (
                      Object.entries(motoristaData.documentos).map(([key, url]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`${API}/${url}`, '_blank')}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Ver
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Nenhum documento carregado ainda</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Request Vehicle Modal */}
        <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Solicitação de Veículo</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600">
              Deseja solicitar este veículo? A solicitação será enviada para aprovação do gestor.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRequestModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRequestVehicle}>
                Confirmar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PerfilMotorista;
