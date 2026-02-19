import { useState, useEffect } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  User, FileText, Car, TrendingUp, Calendar, Phone, Mail, MapPin, 
  CreditCard, Download, Eye, Building, Clock, RotateCcw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ExMotoristaDetailDialog = ({ open, onClose, motoristaId, onReactivate }) => {
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historicoRendimentos, setHistoricoRendimentos] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  useEffect(() => {
    if (open && motoristaId) {
      fetchMotoristaData();
      fetchHistoricoRendimentos();
    }
  }, [open, motoristaId]);

  const fetchMotoristaData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotorista(response.data);
    } catch (error) {
      console.error('Error fetching motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricoRendimentos = async () => {
    setLoadingHistorico(true);
    try {
      const token = localStorage.getItem('token');
      // Buscar dados semanais do motorista
      const response = await axios.get(`${API}/api/dados-semanais?motorista_id=${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricoRendimentos(response.data || []);
    } catch (error) {
      console.error('Error fetching historico:', error);
      setHistoricoRendimentos([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-PT');
    } catch {
      return dateStr;
    }
  };

  const handleReactivate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/motoristas/${motoristaId}/ativar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Motorista reativado com sucesso');
      onClose();
      if (onReactivate) onReactivate();
    } catch (error) {
      toast.error('Erro ao reativar motorista');
    }
  };

  if (!motorista && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : motorista && (
          <>
            {/* Header com foto e info básica */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-600">
                    {motorista.name?.charAt(0)?.toUpperCase() || 'M'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{motorista.name}</h2>
                    <p className="text-sm text-slate-500">{motorista.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        Ex-Motorista
                      </Badge>
                      {motorista.data_desativacao && (
                        <span className="text-xs text-slate-400">
                          Desde {formatDate(motorista.data_desativacao)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={handleReactivate}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reativar
                </Button>
              </div>
            </div>

            {/* Tabs simplificadas */}
            <Tabs defaultValue="dados" className="p-6">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="dados" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dados Pessoais
                </TabsTrigger>
                <TabsTrigger value="documentos" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="plataformas" className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Plataformas
                </TabsTrigger>
                <TabsTrigger value="historico" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              {/* Tab Dados Pessoais */}
              <TabsContent value="dados">
                <div className="grid grid-cols-2 gap-6">
                  {/* Identificação */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        Identificação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Nome Completo</span>
                        <span className="text-sm font-medium">{motorista.name || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">NIF</span>
                        <span className="text-sm font-medium">{motorista.nif || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Data Nascimento</span>
                        <span className="text-sm font-medium">{formatDate(motorista.data_nascimento)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Nacionalidade</span>
                        <span className="text-sm font-medium">{motorista.nacionalidade || 'Portuguesa'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contactos */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-600" />
                        Contactos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 flex items-center gap-2">
                          <Mail className="w-3 h-3" /> Email
                        </span>
                        <span className="text-sm font-medium">{motorista.email || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 flex items-center gap-2">
                          <Phone className="w-3 h-3" /> Telefone
                        </span>
                        <span className="text-sm font-medium">{motorista.phone || motorista.telefone || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 flex items-center gap-2">
                          <Phone className="w-3 h-3" /> Telefone Alt.
                        </span>
                        <span className="text-sm font-medium">{motorista.telefone_alternativo || '-'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Morada */}
                  <Card className="col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-600" />
                        Morada
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm text-slate-500">Rua</span>
                          <p className="text-sm font-medium">{motorista.morada || motorista.address || '-'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-500">Código Postal</span>
                          <p className="text-sm font-medium">{motorista.codigo_postal || '-'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-500">Localidade</span>
                          <p className="text-sm font-medium">{motorista.localidade || motorista.cidade || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dados Bancários */}
                  <Card className="col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                        Dados Bancários
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-slate-500">IBAN</span>
                          <p className="text-sm font-medium font-mono">{motorista.iban || '-'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-500">Titular</span>
                          <p className="text-sm font-medium">{motorista.titular_conta || motorista.name || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Documentos */}
              <TabsContent value="documentos">
                <div className="grid grid-cols-2 gap-6">
                  {/* Carta de Condução */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Carta de Condução
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Número</span>
                        <span className="text-sm font-medium">{motorista.carta_conducao || motorista.numero_carta || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Validade</span>
                        <span className="text-sm font-medium">{formatDate(motorista.carta_validade || motorista.validade_carta)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Categorias</span>
                        <span className="text-sm font-medium">{motorista.categorias_carta || 'B'}</span>
                      </div>
                      {motorista.carta_documento_url && (
                        <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                          <a href={motorista.carta_documento_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Documento
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Licença TVDE */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        Licença TVDE
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Número</span>
                        <span className="text-sm font-medium">{motorista.licenca_tvde || motorista.tvde_license || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Validade</span>
                        <span className="text-sm font-medium">{formatDate(motorista.tvde_validade || motorista.validade_tvde)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Entidade</span>
                        <span className="text-sm font-medium">{motorista.entidade_tvde || 'IMT'}</span>
                      </div>
                      {motorista.tvde_documento_url && (
                        <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                          <a href={motorista.tvde_documento_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Documento
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Outros Documentos */}
                  <Card className="col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        Outros Documentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm text-slate-500">Certificado CAM</span>
                          <p className="text-sm font-medium">{motorista.cam_numero || '-'}</p>
                          <p className="text-xs text-slate-400">Válido até: {formatDate(motorista.cam_validade)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-500">Registo Criminal</span>
                          <p className="text-sm font-medium">{motorista.registo_criminal ? 'Sim' : 'Não'}</p>
                          <p className="text-xs text-slate-400">Data: {formatDate(motorista.registo_criminal_data)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-500">Atestado Médico</span>
                          <p className="text-sm font-medium">{motorista.atestado_medico ? 'Sim' : 'Não'}</p>
                          <p className="text-xs text-slate-400">Válido até: {formatDate(motorista.atestado_validade)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Plataformas */}
              <TabsContent value="plataformas">
                <div className="grid grid-cols-2 gap-6">
                  {/* Uber */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white text-xs font-bold">U</div>
                        Uber
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">UUID Motorista</span>
                        <span className="text-sm font-medium font-mono text-xs">
                          {motorista.uuid_motorista_uber || '-'}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Email Uber</span>
                        <span className="text-sm font-medium">{motorista.email_uber || motorista.email || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Status</span>
                        <Badge variant={motorista.uber_ativo ? "success" : "secondary"}>
                          {motorista.uber_ativo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bolt */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">B</div>
                        Bolt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">ID Motorista</span>
                        <span className="text-sm font-medium font-mono">
                          {motorista.identificador_motorista_bolt || '-'}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Email Bolt</span>
                        <span className="text-sm font-medium">{motorista.email_bolt || motorista.email || '-'}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Status</span>
                        <Badge variant={motorista.bolt_ativo ? "success" : "secondary"}>
                          {motorista.bolt_ativo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Histórico de Rendimentos */}
              <TabsContent value="historico">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Histórico de Rendimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHistorico ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : historicoRendimentos.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        <div className="grid grid-cols-5 gap-4 text-xs font-medium text-slate-500 pb-2 border-b">
                          <div>Semana</div>
                          <div className="text-right">Uber</div>
                          <div className="text-right">Bolt</div>
                          <div className="text-right">Despesas</div>
                          <div className="text-right">Líquido</div>
                        </div>
                        {historicoRendimentos.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-5 gap-4 text-sm py-2 hover:bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              S{item.semana}/{item.ano}
                            </div>
                            <div className="text-right text-green-600">
                              {formatCurrency(item.valor_uber || item.uber || 0)}
                            </div>
                            <div className="text-right text-green-600">
                              {formatCurrency(item.valor_bolt || item.bolt || 0)}
                            </div>
                            <div className="text-right text-red-600">
                              {formatCurrency(item.total_despesas || item.despesas || 0)}
                            </div>
                            <div className="text-right font-medium text-blue-600">
                              {formatCurrency(item.valor_liquido || item.liquido || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>Sem histórico de rendimentos</p>
                      </div>
                    )}

                    {/* Totais */}
                    {historicoRendimentos.length > 0 && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
                        <Card className="bg-green-50">
                          <CardContent className="pt-4 text-center">
                            <p className="text-xs text-slate-500">Total Uber</p>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(historicoRendimentos.reduce((sum, i) => sum + (i.valor_uber || i.uber || 0), 0))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50">
                          <CardContent className="pt-4 text-center">
                            <p className="text-xs text-slate-500">Total Bolt</p>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(historicoRendimentos.reduce((sum, i) => sum + (i.valor_bolt || i.bolt || 0), 0))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-red-50">
                          <CardContent className="pt-4 text-center">
                            <p className="text-xs text-slate-500">Total Despesas</p>
                            <p className="text-lg font-bold text-red-600">
                              {formatCurrency(historicoRendimentos.reduce((sum, i) => sum + (i.total_despesas || i.despesas || 0), 0))}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50">
                          <CardContent className="pt-4 text-center">
                            <p className="text-xs text-slate-500">Total Líquido</p>
                            <p className="text-lg font-bold text-blue-600">
                              {formatCurrency(historicoRendimentos.reduce((sum, i) => sum + (i.valor_liquido || i.liquido || 0), 0))}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExMotoristaDetailDialog;
