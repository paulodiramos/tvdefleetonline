import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, Car, Fuel, Zap,
  CreditCard, ChevronLeft, ChevronRight, RefreshCw, History, Settings,
  FileUp, Check, X, Loader2, ArrowLeft, MapPin, Plus, Trash2, Save, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Ícones das plataformas
const PlatformIcons = {
  uber: () => <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white font-bold text-xs">U</div>,
  bolt: () => <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white font-bold text-xs">B</div>,
  viaverde: () => <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center text-white font-bold text-xs">VV</div>,
  combustivel: () => <Fuel className="w-6 h-6 text-orange-500" />,
  eletrico: () => <Zap className="w-6 h-6 text-blue-500" />,
  gps: () => <MapPin className="w-6 h-6 text-purple-500" />,
  custom: () => <Settings className="w-6 h-6 text-slate-500" />,
};

// Configurações padrão dos campos por tipo de importação
const defaultFieldMappings = {
  combustivel: {
    id_field: 'CardNumber',
    data_field: 'Date',
    valor_field: 'TotalAmount',
    litros_field: 'Quantity',
    posto_field: 'StationName',
    matricula_field: 'VehiclePlate'
  },
  eletrico: {
    id_field: 'ChargePointId',
    data_field: 'StartDate',
    valor_field: 'TotalValueWithTaxes',
    kwh_field: 'TotalEnergy',
    operador_field: 'OperatorName',
    matricula_field: 'VehiclePlate'
  },
  gps: {
    id_field: 'DeviceId',
    data_field: 'Timestamp',
    km_field: 'TotalKm',
    matricula_field: 'VehiclePlate'
  }
};

const ImportarFicheirosParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState({});
  const [resultados, setResultados] = useState({});
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  
  // Período
  const [ano, setAno] = useState(new Date().getFullYear());
  const [semana, setSemana] = useState(getCurrentWeek());
  
  // Ficheiros selecionados
  const [ficheiros, setFicheiros] = useState({
    uber: null,
    bolt: null,
    viaverde: null,
    combustivel: null,
    eletrico: null,
    gps: null
  });

  // Configurações de campos personalizados
  const [showConfig, setShowConfig] = useState(null);
  const [fieldMappings, setFieldMappings] = useState(() => {
    const saved = localStorage.getItem('importFieldMappings');
    return saved ? JSON.parse(saved) : defaultFieldMappings;
  });

  // Custom imports
  const [customImports, setCustomImports] = useState(() => {
    const saved = localStorage.getItem('customImports');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomImport, setNewCustomImport] = useState({
    name: '',
    endpoint: '',
    fields: {}
  });

  // Dialog de confirmação de importação
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // plataforma ou 'all'
  const [confirmSemana, setConfirmSemana] = useState(semana);
  const [confirmAno, setConfirmAno] = useState(ano);
  const [confirmDataInicio, setConfirmDataInicio] = useState('');
  const [confirmDataFim, setConfirmDataFim] = useState('');

  // Calcular datas da semana
  const calcularDatasSemana = (sem, year) => {
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (sem - 1) * 7;
    const firstDayOfWeek = new Date(firstDayOfYear.setDate(firstDayOfYear.getDate() + daysOffset - firstDayOfYear.getDay() + 1));
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    
    return {
      inicio: firstDayOfWeek.toISOString().split('T')[0],
      fim: lastDayOfWeek.toISOString().split('T')[0]
    };
  };

  // Abrir dialog de confirmação
  const openConfirmImport = (plataforma) => {
    const datas = calcularDatasSemana(semana, ano);
    setConfirmSemana(semana);
    setConfirmAno(ano);
    setConfirmDataInicio(datas.inicio);
    setConfirmDataFim(datas.fim);
    setPendingImport(plataforma);
    setShowConfirmImport(true);
  };

  // Confirmar e executar importação
  const confirmarImportacao = async () => {
    // Atualizar semana/ano com os valores confirmados
    setSemana(confirmSemana);
    setAno(confirmAno);
    setShowConfirmImport(false);
    
    // Pequeno delay para garantir que o state atualizou
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (pendingImport === 'all') {
      await handleUploadAllConfirmed();
    } else {
      await handleUploadConfirmed(pendingImport);
    }
    
    setPendingImport(null);
  };

  function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  }

  useEffect(() => {
    fetchHistorico();
  }, []);

  useEffect(() => {
    localStorage.setItem('importFieldMappings', JSON.stringify(fieldMappings));
  }, [fieldMappings]);

  useEffect(() => {
    localStorage.setItem('customImports', JSON.stringify(customImports));
  }, [customImports]);

  const fetchHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/ficheiros-importados`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 }
      });
      setHistorico(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleFileChange = (plataforma, file) => {
    setFicheiros(prev => ({ ...prev, [plataforma]: file }));
    setResultados(prev => ({ ...prev, [plataforma]: null }));
  };

  // Upload com confirmação
  const handleUpload = (plataforma) => {
    const file = ficheiros[plataforma];
    if (!file) {
      toast.error('Selecione um ficheiro primeiro');
      return;
    }
    openConfirmImport(plataforma);
  };

  // Upload efetivo após confirmação
  const handleUploadConfirmed = async (plataforma) => {
    const file = ficheiros[plataforma];
    if (!file) return;

    setUploading(prev => ({ ...prev, [plataforma]: true }));

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('semana', confirmSemana);
      formData.append('ano', confirmAno);
      
      // Adicionar datas se definidas
      if (confirmDataInicio) {
        formData.append('data_inicio', confirmDataInicio);
      }
      if (confirmDataFim) {
        formData.append('data_fim', confirmDataFim);
      }
      
      // Adicionar mapeamento de campos se configurado
      if (fieldMappings[plataforma]) {
        formData.append('field_mappings', JSON.stringify(fieldMappings[plataforma]));
      }

      const plataformaBackend = plataforma === 'eletrico' ? 'carregamento' : plataforma;
      
      const response = await axios.post(
        `${API_URL}/api/importar/${plataformaBackend}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResultados(prev => ({
        ...prev,
        [plataforma]: {
          success: true,
          message: response.data.message,
          sucesso: response.data.sucesso || response.data.total_linhas || 0,
          erros: response.data.erros || 0,
          total: response.data.total_ganhos || response.data.totais?.total_despesas || 0
        }
      }));

      toast.success(`${plataforma} importado com sucesso!`);
      fetchHistorico();
    } catch (error) {
      console.error('Erro ao importar:', error);
      setResultados(prev => ({
        ...prev,
        [plataforma]: {
          success: false,
          message: error.response?.data?.detail || error.message
        }
      }));
      toast.error(`Erro ao importar ${plataforma}`);
    } finally {
      setUploading(prev => ({ ...prev, [plataforma]: false }));
    }
  };

  const handleUploadAll = async () => {
    const plataformasComFicheiro = Object.entries(ficheiros)
      .filter(([_, file]) => file !== null)
      .map(([plataforma]) => plataforma);

    if (plataformasComFicheiro.length === 0) {
      toast.error('Selecione pelo menos um ficheiro');
      return;
    }

    for (const plataforma of plataformasComFicheiro) {
      await handleUpload(plataforma);
    }
  };

  const handlePreviousWeek = () => {
    if (semana > 1) setSemana(semana - 1);
    else { setSemana(52); setAno(ano - 1); }
  };

  const handleNextWeek = () => {
    if (semana < 52) setSemana(semana + 1);
    else { setSemana(1); setAno(ano + 1); }
  };

  const saveFieldMapping = (plataforma, mapping) => {
    setFieldMappings(prev => ({ ...prev, [plataforma]: mapping }));
    setShowConfig(null);
    toast.success('Configuração guardada!');
  };

  const addCustomImport = () => {
    if (!newCustomImport.name) {
      toast.error('Indique um nome para o import');
      return;
    }
    setCustomImports(prev => [...prev, { ...newCustomImport, id: Date.now() }]);
    setNewCustomImport({ name: '', endpoint: '', fields: {} });
    setShowAddCustom(false);
    toast.success('Import personalizado adicionado!');
  };

  const removeCustomImport = (id) => {
    setCustomImports(prev => prev.filter(c => c.id !== id));
  };

  const renderUploadCard = (plataforma, nome, descricao, formatosAceites, configurable = false) => {
    const Icon = PlatformIcons[plataforma] || PlatformIcons.custom;
    const file = ficheiros[plataforma];
    const resultado = resultados[plataforma];
    const isUploading = uploading[plataforma];

    return (
      <Card key={plataforma} className={`transition-all ${file ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{nome}</h3>
                {configurable && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0"
                    onClick={() => setShowConfig(plataforma)}
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-2">{descricao}</p>
              
              <div className="relative">
                <input
                  type="file"
                  accept={formatosAceites}
                  onChange={(e) => handleFileChange(plataforma, e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                <div className={`border-2 border-dashed rounded-lg p-2 text-center transition-colors
                  ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-blue-600 truncate max-w-[120px]">{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">Arrastar ou clicar</span>
                    </div>
                  )}
                </div>
              </div>

              {file && !resultado && (
                <Button
                  size="sm"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={() => handleUpload(plataforma)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> A importar...</>
                  ) : (
                    <><FileUp className="w-3 h-3 mr-1" /> Importar</>
                  )}
                </Button>
              )}

              {resultado && (
                <div className={`mt-2 p-2 rounded text-xs ${resultado.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {resultado.success ? (
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{resultado.sucesso} registos</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <X className="w-3 h-3" />
                      <span>{resultado.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderConfigModal = () => {
    if (!showConfig) return null;
    
    const currentMapping = fieldMappings[showConfig] || {};
    const [tempMapping, setTempMapping] = useState(currentMapping);

    const fieldLabels = {
      combustivel: [
        { key: 'id_field', label: 'Campo ID/Cartão' },
        { key: 'data_field', label: 'Campo Data' },
        { key: 'valor_field', label: 'Campo Valor' },
        { key: 'litros_field', label: 'Campo Litros' },
        { key: 'posto_field', label: 'Campo Posto' },
        { key: 'matricula_field', label: 'Campo Matrícula' }
      ],
      eletrico: [
        { key: 'id_field', label: 'Campo ID' },
        { key: 'data_field', label: 'Campo Data' },
        { key: 'valor_field', label: 'Campo Valor' },
        { key: 'kwh_field', label: 'Campo kWh' },
        { key: 'operador_field', label: 'Campo Operador' },
        { key: 'matricula_field', label: 'Campo Matrícula' }
      ],
      gps: [
        { key: 'id_field', label: 'Campo ID Dispositivo' },
        { key: 'data_field', label: 'Campo Data/Hora' },
        { key: 'km_field', label: 'Campo KM Total' },
        { key: 'matricula_field', label: 'Campo Matrícula' }
      ]
    };

    const fields = fieldLabels[showConfig] || [];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurar Campos - {showConfig}
            </CardTitle>
            <CardDescription className="text-xs">
              Mapeie os nomes das colunas do seu ficheiro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-2 items-center">
                <Label className="text-xs">{label}</Label>
                <Input
                  className="h-7 text-xs"
                  value={tempMapping[key] || ''}
                  onChange={(e) => setTempMapping(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Nome da coluna"
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowConfig(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => saveFieldMapping(showConfig, tempMapping)}>
                <Save className="w-3 h-3 mr-1" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 space-y-4">
        {/* Header com botão voltar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Importar Ficheiros</h1>
              <p className="text-xs text-slate-500">Carregar dados de plataformas</p>
            </div>
          </div>
          
          {/* Seletor de semana */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek} className="h-6 w-6 p-0">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium min-w-[80px] text-center">S{semana}/{ano}</span>
              <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-6 w-6 p-0">
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <Button size="sm" onClick={handleUploadAll} className="h-8 text-xs">
              <Upload className="w-3 h-3 mr-1" />
              Importar Todos
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="upload" className="text-xs h-6">
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs h-6">
              <History className="w-3 h-3 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs h-6">
              <Settings className="w-3 h-3 mr-1" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {renderUploadCard('uber', 'Uber', 'Relatório de ganhos Uber', '.csv,.xlsx')}
              {renderUploadCard('bolt', 'Bolt', 'Relatório de ganhos Bolt', '.csv,.xlsx')}
              {renderUploadCard('viaverde', 'Via Verde', 'Extrato de portagens', '.csv,.xlsx')}
              {renderUploadCard('combustivel', 'Combustível', 'Abastecimentos de combustível', '.csv,.xlsx', true)}
              {renderUploadCard('eletrico', 'Carregamentos', 'Carregamentos elétricos', '.csv,.xlsx', true)}
              {renderUploadCard('gps', 'GPS / KM', 'Dados de quilometragem', '.csv,.xlsx', true)}
              
              {/* Custom imports */}
              {customImports.map(custom => (
                <Card key={custom.id} className={`transition-all ${ficheiros[`custom_${custom.id}`] ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <PlatformIcons.custom />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm">{custom.name}</h3>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => removeCustomImport(custom.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">Import personalizado</p>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={(e) => handleFileChange(`custom_${custom.id}`, e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="border-2 border-dashed rounded-lg p-2 text-center border-slate-200 hover:border-slate-300">
                            <div className="flex items-center justify-center gap-1 text-slate-400">
                              <Upload className="w-4 h-4" />
                              <span className="text-xs">Arrastar ou clicar</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Botão adicionar import personalizado */}
              <Card className="border-dashed cursor-pointer hover:bg-slate-50" onClick={() => setShowAddCustom(true)}>
                <CardContent className="p-4 flex items-center justify-center h-full min-h-[120px]">
                  <div className="text-center text-slate-400">
                    <Plus className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs">Adicionar Import</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Últimas Importações</CardTitle>
                  <Button size="sm" variant="outline" onClick={fetchHistorico} className="h-7">
                    <RefreshCw className={`w-3 h-3 mr-1 ${loadingHistorico ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Plataforma</TableHead>
                      <TableHead className="text-xs">Semana</TableHead>
                      <TableHead className="text-xs">Ficheiro</TableHead>
                      <TableHead className="text-xs">Registos</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs">{item.plataforma}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">S{item.semana}/{item.ano}</TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">{item.nome_ficheiro}</TableCell>
                        <TableCell className="text-xs">{item.registos_importados || '-'}</TableCell>
                        <TableCell className="text-xs">{new Date(item.data_upload).toLocaleDateString('pt-PT')}</TableCell>
                      </TableRow>
                    ))}
                    {historico.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 text-xs py-8">
                          Nenhuma importação encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Configurações de Importação</CardTitle>
                  <CardDescription className="text-xs">
                    Configure os nomes dos campos para cada tipo de importação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Combustível Config */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-orange-500" />
                        <span className="font-medium text-sm">Combustível</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowConfig('combustivel')} className="h-6 text-xs">
                        <Settings className="w-3 h-3 mr-1" />
                        Configurar Campos
                      </Button>
                    </div>
                    <div className="text-xs text-slate-500 grid grid-cols-3 gap-2">
                      {Object.entries(fieldMappings.combustivel || {}).map(([key, value]) => (
                        <div key={key}><span className="text-slate-400">{key}:</span> {value}</div>
                      ))}
                    </div>
                  </div>

                  {/* Elétrico Config */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-sm">Carregamentos Elétricos</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowConfig('eletrico')} className="h-6 text-xs">
                        <Settings className="w-3 h-3 mr-1" />
                        Configurar Campos
                      </Button>
                    </div>
                    <div className="text-xs text-slate-500 grid grid-cols-3 gap-2">
                      {Object.entries(fieldMappings.eletrico || {}).map(([key, value]) => (
                        <div key={key}><span className="text-slate-400">{key}:</span> {value}</div>
                      ))}
                    </div>
                  </div>

                  {/* GPS Config */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-sm">GPS / Quilometragem</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowConfig('gps')} className="h-6 text-xs">
                        <Settings className="w-3 h-3 mr-1" />
                        Configurar Campos
                      </Button>
                    </div>
                    <div className="text-xs text-slate-500 grid grid-cols-3 gap-2">
                      {Object.entries(fieldMappings.gps || {}).map(([key, value]) => (
                        <div key={key}><span className="text-slate-400">{key}:</span> {value}</div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de configuração */}
        {showConfig && (
          <ConfigModal 
            plataforma={showConfig}
            mapping={fieldMappings[showConfig] || {}}
            onSave={(mapping) => saveFieldMapping(showConfig, mapping)}
            onClose={() => setShowConfig(null)}
          />
        )}

        {/* Modal adicionar import personalizado */}
        {showAddCustom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-sm mx-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Novo Import Personalizado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    className="h-8 text-sm"
                    value={newCustomImport.name}
                    onChange={(e) => setNewCustomImport(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Outro Combustível"
                  />
                </div>
                <div>
                  <Label className="text-xs">Endpoint (opcional)</Label>
                  <Input
                    className="h-8 text-sm"
                    value={newCustomImport.endpoint}
                    onChange={(e) => setNewCustomImport(prev => ({ ...prev, endpoint: e.target.value }))}
                    placeholder="Ex: combustivel2"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAddCustom(false)}>Cancelar</Button>
                  <Button size="sm" onClick={addCustomImport}>
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

// Componente Modal de Configuração
const ConfigModal = ({ plataforma, mapping, onSave, onClose }) => {
  const [tempMapping, setTempMapping] = useState(mapping);

  const fieldLabels = {
    combustivel: [
      { key: 'id_field', label: 'Campo ID/Cartão' },
      { key: 'data_field', label: 'Campo Data' },
      { key: 'valor_field', label: 'Campo Valor' },
      { key: 'litros_field', label: 'Campo Litros' },
      { key: 'posto_field', label: 'Campo Posto' },
      { key: 'matricula_field', label: 'Campo Matrícula' }
    ],
    eletrico: [
      { key: 'id_field', label: 'Campo ID' },
      { key: 'data_field', label: 'Campo Data' },
      { key: 'valor_field', label: 'Campo Valor' },
      { key: 'kwh_field', label: 'Campo kWh' },
      { key: 'operador_field', label: 'Campo Operador' },
      { key: 'matricula_field', label: 'Campo Matrícula' }
    ],
    gps: [
      { key: 'id_field', label: 'Campo ID Dispositivo' },
      { key: 'data_field', label: 'Campo Data/Hora' },
      { key: 'km_field', label: 'Campo KM Total' },
      { key: 'matricula_field', label: 'Campo Matrícula' }
    ]
  };

  const fields = fieldLabels[plataforma] || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurar Campos - {plataforma}
          </CardTitle>
          <CardDescription className="text-xs">
            Mapeie os nomes das colunas do seu ficheiro CSV/Excel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-2 gap-2 items-center">
              <Label className="text-xs">{label}</Label>
              <Input
                className="h-7 text-xs"
                value={tempMapping[key] || ''}
                onChange={(e) => setTempMapping(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder="Nome da coluna"
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => onSave(tempMapping)}>
              <Save className="w-3 h-3 mr-1" />
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportarFicheirosParceiro;
