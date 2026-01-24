import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Upload,
  Calendar,
  Clock,
  FileSpreadsheet,
  Send,
  History,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Download,
  MessageCircle,
  Mail,
  RefreshCw,
  Play,
  Users
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ImportacaoRPA = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');
  
  // Upload manual
  const [selectedFile, setSelectedFile] = useState(null);
  const [plataforma, setPlataforma] = useState('bolt');
  const [semana, setSemana] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  
  // Agendamento
  const [agendamento, setAgendamento] = useState({
    ativo: false,
    dia_semana: 0,
    hora: 8,
    plataformas: [],
    enviar_whatsapp: true,
    enviar_email: true
  });
  
  // Histórico
  const [historico, setHistorico] = useState([]);
  const [resumos, setResumos] = useState([]);
  
  // Carregar dados
  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
      const [historicoRes, resumosRes, agendamentoRes] = await Promise.all([
        axios.get(`${API}/api/importacao/historico`, { headers }),
        axios.get(`${API}/api/importacao/resumos`, { headers }),
        axios.get(`${API}/api/importacao/agendamento`, { headers })
      ]);
      
      setHistorico(historicoRes.data || []);
      setResumos(resumosRes.data || []);
      setAgendamento(agendamentoRes.data || agendamento);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Upload CSV
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Selecione um ficheiro CSV');
      return;
    }
    
    setUploading(true);
    const token = localStorage.getItem('token');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('plataforma', plataforma);
    if (semana) formData.append('semana', semana);
    if (ano) formData.append('ano', ano);
    
    try {
      const response = await axios.post(`${API}/api/importacao/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(`Importação concluída! ${response.data.detalhes.total_motoristas} motoristas processados.`);
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploading(false);
    }
  };
  
  // Guardar agendamento
  const handleSaveAgendamento = async () => {
    const token = localStorage.getItem('token');
    
    try {
      await axios.put(`${API}/api/importacao/agendamento`, agendamento, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agendamento guardado!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao guardar agendamento');
    }
  };
  
  // Enviar resumos
  const handleEnviarResumos = async (importacaoId) => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.post(
        `${API}/api/importacao/enviar-resumos/${importacaoId}?via_whatsapp=true&via_email=true`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Enviados: ${response.data.whatsapp_enviados} WhatsApp, ${response.data.email_enviados} Email`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar resumos');
    }
  };
  
  const diasSemana = [
    { value: 0, label: 'Segunda-feira' },
    { value: 1, label: 'Terça-feira' },
    { value: 2, label: 'Quarta-feira' },
    { value: 3, label: 'Quinta-feira' },
    { value: 4, label: 'Sexta-feira' },
    { value: 5, label: 'Sábado' },
    { value: 6, label: 'Domingo' }
  ];
  
  const plataformasDisponiveis = [
    { value: 'bolt', label: 'Bolt', icon: '🚗' },
    { value: 'uber', label: 'Uber', icon: '🚕' },
    { value: 'freenow', label: 'FreeNow', icon: '🚖' },
    { value: 'outra', label: 'Outra', icon: '📊' }
  ];

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Importação de Dados RPA</h1>
            <p className="text-slate-500">Importe dados das plataformas e envie resumos aos motoristas</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/rpa-automacao')}>
            <RefreshCw className="w-4 h-4 mr-2" />
            RPA Automação
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Manual
            </TabsTrigger>
            <TabsTrigger value="agendamento" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Agendamento
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Upload Manual */}
          <TabsContent value="manual" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upload Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    Upload de Ficheiro CSV
                  </CardTitle>
                  <CardDescription>
                    Faça upload do ficheiro CSV exportado da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plataforma */}
                  <div className="space-y-2">
                    <Label>Plataforma</Label>
                    <Select value={plataforma} onValueChange={setPlataforma}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plataformasDisponiveis.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.icon} {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Semana/Ano */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Semana (opcional)</Label>
                      <Input
                        type="number"
                        placeholder="Auto"
                        value={semana}
                        onChange={(e) => setSemana(e.target.value)}
                        min="1"
                        max="53"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ano</Label>
                      <Input
                        type="number"
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* File Input */}
                  <div className="space-y-2">
                    <Label>Ficheiro CSV</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                        {selectedFile ? (
                          <p className="text-green-600 font-medium">{selectedFile.name}</p>
                        ) : (
                          <p className="text-slate-500">Clique para selecionar ou arraste o ficheiro</p>
                        )}
                      </label>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedFile || uploading}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Importar Dados
                  </Button>
                </CardContent>
              </Card>

              {/* Instruções */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    Como Exportar Dados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">🚗 Bolt Fleet</h4>
                      <ol className="text-xs text-slate-600 space-y-1">
                        <li>1. Aceda a fleets.bolt.eu</li>
                        <li>2. Vá a Relatórios → Financeiro</li>
                        <li>3. Selecione o período</li>
                        <li>4. Clique "Descarregar CSV"</li>
                      </ol>
                    </div>
                    
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">🚕 Uber</h4>
                      <ol className="text-xs text-slate-600 space-y-1">
                        <li>1. Aceda a partners.uber.com</li>
                        <li>2. Vá a Pagamentos</li>
                        <li>3. Clique "Exportar"</li>
                        <li>4. Escolha formato CSV</li>
                      </ol>
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertDescription className="text-xs">
                      Também pode usar o <strong>RPA Automação</strong> para extrair os dados automaticamente!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            {/* Resumos Recentes */}
            {resumos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Resumos Importados ({resumos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2">Motorista</th>
                          <th className="text-left p-2">Plataforma</th>
                          <th className="text-center p-2">Semana</th>
                          <th className="text-right p-2">Corridas</th>
                          <th className="text-right p-2">Valor Líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumos.slice(0, 10).map((resumo, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{resumo.motorista}</td>
                            <td className="p-2">
                              <Badge variant="outline">{resumo.plataforma}</Badge>
                            </td>
                            <td className="p-2 text-center">{resumo.semana}/{resumo.ano}</td>
                            <td className="p-2 text-right">{resumo.metricas?.corridas || 0}</td>
                            <td className="p-2 text-right font-medium text-green-600">
                              €{(resumo.metricas?.valor_liquido || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Agendamento Automático */}
          <TabsContent value="agendamento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  Importação Automática
                </CardTitle>
                <CardDescription>
                  Configure a execução automática dos scripts RPA e envio de resumos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Ativar */}
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">Agendamento Ativo</h4>
                    <p className="text-sm text-slate-500">Executar scripts automaticamente</p>
                  </div>
                  <Switch
                    checked={agendamento.ativo}
                    onCheckedChange={(checked) => setAgendamento(prev => ({ ...prev, ativo: checked }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dia da Semana */}
                  <div className="space-y-2">
                    <Label>Dia da Semana</Label>
                    <Select 
                      value={agendamento.dia_semana.toString()} 
                      onValueChange={(v) => setAgendamento(prev => ({ ...prev, dia_semana: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {diasSemana.map(d => (
                          <SelectItem key={d.value} value={d.value.toString()}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Hora */}
                  <div className="space-y-2">
                    <Label>Hora de Execução</Label>
                    <Select 
                      value={agendamento.hora.toString()} 
                      onValueChange={(v) => setAgendamento(prev => ({ ...prev, hora: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Plataformas */}
                <div className="space-y-2">
                  <Label>Plataformas a Executar</Label>
                  <div className="flex flex-wrap gap-2">
                    {plataformasDisponiveis.filter(p => p.value !== 'outra').map(p => (
                      <Button
                        key={p.value}
                        variant={agendamento.plataformas.includes(p.value) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setAgendamento(prev => ({
                            ...prev,
                            plataformas: prev.plataformas.includes(p.value)
                              ? prev.plataformas.filter(x => x !== p.value)
                              : [...prev.plataformas, p.value]
                          }));
                        }}
                      >
                        {p.icon} {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Opções de Envio */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-sm">Envio Automático de Resumos</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Enviar por WhatsApp</span>
                      </div>
                      <Switch
                        checked={agendamento.enviar_whatsapp}
                        onCheckedChange={(checked) => setAgendamento(prev => ({ ...prev, enviar_whatsapp: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Enviar por Email</span>
                      </div>
                      <Switch
                        checked={agendamento.enviar_email}
                        onCheckedChange={(checked) => setAgendamento(prev => ({ ...prev, enviar_email: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveAgendamento} className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Guardar Configuração
                </Button>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    <strong>Nota:</strong> Para a execução automática funcionar, é necessário ter as credenciais das plataformas configuradas em <strong>Configurações → Credenciais</strong>.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Importações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma importação realizada ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historico.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${item.status === 'processado' ? 'bg-green-100' : 'bg-amber-100'}`}>
                            {item.status === 'processado' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{item.ficheiro}</p>
                            <p className="text-sm text-slate-500">
                              {item.plataforma} • Semana {item.semana}/{item.ano} • {item.total_motoristas} motoristas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={item.tipo === 'manual' ? 'outline' : 'secondary'}>
                            {item.tipo}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEnviarResumos(item.id)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Enviar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ImportacaoRPA;
