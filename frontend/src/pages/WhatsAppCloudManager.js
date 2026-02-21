import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageCircle, Send, Users, History, Settings, 
  FileText, Bell, Calendar, Car, CheckCircle, XCircle,
  Loader2, AlertTriangle, Clock, Phone
} from 'lucide-react';

const WhatsAppCloudManager = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [selectedMotoristas, setSelectedMotoristas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [sending, setSending] = useState(false);
  
  // Vistoria em massa
  const [showVistoriaModal, setShowVistoriaModal] = useState(false);
  const [vistoriaData, setVistoriaData] = useState({
    data_vistoria: '',
    hora: '',
    local: ''
  });
  
  // Template personalizado
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateParams, setTemplateParams] = useState([]);

  // Alertas de documentos
  const [documentosExpirar, setDocumentosExpirar] = useState({ expirados: [], a_expirar: [] });
  const [diasAlerta, setDiasAlerta] = useState(30);

  const fetchApiStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-cloud/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setApiStatus(data);
    } catch (error) {
      console.error('Error fetching API status:', error);
      setApiStatus({ configured: false, error: 'Erro ao verificar estado' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-cloud/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const lista = data.motoristas || data || [];
        const motoristasComTelefone = lista.filter(m => m.whatsapp || m.phone);
        setMotoristas(motoristasComTelefone);
      }
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-cloud/historico-envios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistorico(data.envios || []);
      }
    } catch (error) {
      console.error('Error fetching historico:', error);
    }
  };

  const fetchDocumentosExpirar = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/alertas/documentos-expirar?dias=${diasAlerta}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentosExpirar(data);
      }
    } catch (error) {
      console.error('Error fetching documentos:', error);
    }
  };

  useEffect(() => {
    fetchApiStatus();
    fetchTemplates();
    fetchMotoristas();
    fetchHistorico();
    fetchDocumentosExpirar();
  }, []);

  const toggleMotorista = (id) => {
    setSelectedMotoristas(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  const selectAllMotoristas = () => {
    if (selectedMotoristas.length === motoristas.length) {
      setSelectedMotoristas([]);
    } else {
      setSelectedMotoristas(motoristas.map(m => m.id));
    }
  };

  const enviarVistoriaMassa = async () => {
    if (selectedMotoristas.length === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }
    
    if (!vistoriaData.data_vistoria || !vistoriaData.hora || !vistoriaData.local) {
      toast.error('Preencha todos os campos da vistoria');
      return;
    }
    
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-cloud/send/vistoria-massa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          motorista_ids: selectedMotoristas,
          ...vistoriaData
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Vistoria enviada para ${data.enviados} motorista(s)`);
        if (data.falhas > 0) {
          toast.warning(`${data.falhas} envio(s) falharam`);
        }
        setShowVistoriaModal(false);
        setSelectedMotoristas([]);
        setVistoriaData({ data_vistoria: '', hora: '', local: '' });
        fetchHistorico();
      } else {
        toast.error('Erro ao enviar mensagens');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
  };

  const enviarAlertasDocumentos = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/alertas/documentos-expirar/enviar-whatsapp?dias=${diasAlerta}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Alertas enviados: ${data.documentos_alertados} documentos notificados`);
        if (data.falhas > 0) {
          toast.warning(`${data.falhas} envio(s) falharam`);
        }
        fetchHistorico();
      } else {
        toast.error('Erro ao enviar alertas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar alertas');
    } finally {
      setSending(false);
    }
  };

  const enviarTemplateMassa = async () => {
    if (selectedMotoristas.length === 0 || !selectedTemplate) {
      toast.error('Selecione motoristas e um template');
      return;
    }
    
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/whatsapp-cloud/send/massa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          motorista_ids: selectedMotoristas,
          template_name: selectedTemplate.name,
          parameters: templateParams
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Mensagem enviada para ${data.enviados} motorista(s)`);
        setShowTemplateModal(false);
        setSelectedMotoristas([]);
        fetchHistorico();
      } else {
        toast.error('Erro ao enviar mensagens');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar mensagens');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">WhatsApp Cloud API</h1>
            <p className="text-gray-500">Envio de mensagens via API oficial da Meta</p>
          </div>
          <Badge variant={apiStatus?.configured ? "default" : "destructive"} className="h-8 px-4">
            {apiStatus?.configured ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> API Configurada</>
            ) : (
              <><XCircle className="w-4 h-4 mr-2" /> API Não Configurada</>
            )}
          </Badge>
        </div>

        {!apiStatus?.configured && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800">Configuração Necessária</h3>
                  <p className="text-amber-700 text-sm mt-1">
                    Para utilizar a API oficial do WhatsApp, configure as credenciais no ficheiro .env do servidor:
                  </p>
                  <ul className="text-amber-700 text-sm mt-2 list-disc list-inside">
                    <li>WHATSAPP_CLOUD_ACCESS_TOKEN</li>
                    <li>WHATSAPP_CLOUD_PHONE_NUMBER_ID</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="envio" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="envio" className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Envio em Massa
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-2">
              <Bell className="w-4 h-4" /> Alertas Documentos
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab Envio em Massa */}
          <TabsContent value="envio" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Ações rápidas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" /> Agendar Vistoria
                  </CardTitle>
                  <CardDescription>
                    Enviar notificação de vistoria para motoristas selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    onClick={() => setShowVistoriaModal(true)}
                    disabled={selectedMotoristas.length === 0}
                  >
                    <Car className="w-4 h-4 mr-2" />
                    Enviar Vistoria ({selectedMotoristas.length})
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Template Personalizado
                  </CardTitle>
                  <CardDescription>
                    Escolher um template e enviar para selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline"
                    className="w-full" 
                    onClick={() => setShowTemplateModal(true)}
                    disabled={selectedMotoristas.length === 0}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Escolher Template ({selectedMotoristas.length})
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" /> Seleção Rápida
                  </CardTitle>
                  <CardDescription>
                    {selectedMotoristas.length} de {motoristas.length} motoristas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="secondary"
                    className="w-full" 
                    onClick={selectAllMotoristas}
                  >
                    {selectedMotoristas.length === motoristas.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Lista de motoristas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> Motoristas com WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedMotoristas.length === motoristas.length && motoristas.length > 0}
                          onCheckedChange={selectAllMotoristas}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {motoristas.map(m => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => toggleMotorista(m.id)}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedMotoristas.includes(m.id)}
                            onCheckedChange={() => toggleMotorista(m.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{m.name || m.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-green-600" />
                            {m.whatsapp || m.phone}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">{m.email}</TableCell>
                      </TableRow>
                    ))}
                    {motoristas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          Nenhum motorista com WhatsApp encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Alertas Documentos */}
          <TabsContent value="alertas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Alertas de Documentos a Expirar
                </CardTitle>
                <CardDescription>
                  Enviar alertas automáticos para motoristas com documentos próximos da expiração
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Dias de antecedência:</Label>
                    <Input 
                      type="number" 
                      value={diasAlerta} 
                      onChange={(e) => setDiasAlerta(parseInt(e.target.value) || 30)}
                      className="w-20"
                    />
                  </div>
                  <Button variant="outline" onClick={fetchDocumentosExpirar}>
                    Atualizar Lista
                  </Button>
                  <Button 
                    onClick={enviarAlertasDocumentos}
                    disabled={sending || documentosExpirar.a_expirar?.length === 0}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Enviar Alertas ({documentosExpirar.a_expirar?.length || 0})
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-red-700 text-lg">Expirados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-700">
                        {documentosExpirar.total_expirados || 0}
                      </div>
                      <p className="text-red-600 text-sm">Documentos já expirados</p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-amber-700 text-lg">A Expirar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-amber-700">
                        {documentosExpirar.total_a_expirar || 0}
                      </div>
                      <p className="text-amber-600 text-sm">Nos próximos {diasAlerta} dias</p>
                    </CardContent>
                  </Card>
                </div>

                {documentosExpirar.a_expirar?.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Validade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documentosExpirar.a_expirar.slice(0, 10).map((doc, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{doc.nome}</TableCell>
                          <TableCell>{doc.documento}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-amber-600">
                              {new Date(doc.validade).toLocaleDateString('pt-PT')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Templates */}
          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <Card key={template.name} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {template.variables?.map(v => (
                          <Badge key={v} variant="secondary" className="text-xs">
                            {`{${v}}`}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                        {template.preview}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" /> Histórico de Envios em Massa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead>Falhas</TableHead>
                      <TableHead>Sem Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((envio, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {new Date(envio.created_at).toLocaleString('pt-PT')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{envio.template_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{envio.enviados}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600">{envio.falhas}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-500">{envio.sem_telefone}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {historico.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                          Nenhum envio em massa registado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Vistoria */}
        <Dialog open={showVistoriaModal} onOpenChange={setShowVistoriaModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Vistoria em Massa</DialogTitle>
              <DialogDescription>
                Enviar notificação de vistoria para {selectedMotoristas.length} motorista(s)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Data da Vistoria</Label>
                <Input 
                  type="date" 
                  value={vistoriaData.data_vistoria}
                  onChange={(e) => setVistoriaData(prev => ({ ...prev, data_vistoria: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input 
                  type="time" 
                  value={vistoriaData.hora}
                  onChange={(e) => setVistoriaData(prev => ({ ...prev, hora: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input 
                  placeholder="Ex: Centro de Inspeções Lisboa"
                  value={vistoriaData.local}
                  onChange={(e) => setVistoriaData(prev => ({ ...prev, local: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVistoriaModal(false)}>
                Cancelar
              </Button>
              <Button onClick={enviarVistoriaMassa} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar para {selectedMotoristas.length} motorista(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Template */}
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar Template</DialogTitle>
              <DialogDescription>
                Escolha um template e preencha os parâmetros
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select onValueChange={(name) => {
                  const t = templates.find(t => t.name === name);
                  setSelectedTemplate(t);
                  setTemplateParams(t?.variables?.slice(1)?.map(() => '') || []);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} - {t.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedTemplate && (
                <div className="space-y-2">
                  <Label>Parâmetros (o nome é preenchido automaticamente)</Label>
                  {selectedTemplate.variables?.slice(1).map((v, i) => (
                    <div key={v} className="flex items-center gap-2">
                      <Label className="w-32 text-sm text-gray-500">{v}:</Label>
                      <Input 
                        placeholder={`Valor para ${v}`}
                        value={templateParams[i] || ''}
                        onChange={(e) => {
                          const newParams = [...templateParams];
                          newParams[i] = e.target.value;
                          setTemplateParams(newParams);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={enviarTemplateMassa} disabled={sending || !selectedTemplate}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default WhatsAppCloudManager;
