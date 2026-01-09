import { useState, useEffect } from 'react';
import axios from 'axios';
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
  FileUp, Check, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Ícones das plataformas
const PlatformIcons = {
  uber: () => <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-sm">U</div>,
  bolt: () => <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>,
  viaverde: () => <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">VV</div>,
  combustivel: () => <Fuel className="w-8 h-8 text-orange-500" />,
  eletrico: () => <Zap className="w-8 h-8 text-blue-500" />,
};

const ImportarFicheirosParceiro = ({ user }) => {
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
    eletrico: null
  });

  function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  }

  // Carregar histórico de importações
  useEffect(() => {
    fetchHistorico();
  }, []);

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

  const handleUpload = async (plataforma) => {
    const file = ficheiros[plataforma];
    if (!file) {
      toast.error('Selecione um ficheiro primeiro');
      return;
    }

    if (!semana) {
      toast.error('Indique a semana de referência');
      return;
    }

    setUploading(prev => ({ ...prev, [plataforma]: true }));

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('semana', semana);
      formData.append('ano', ano);

      // Mapear plataforma para endpoint correto
      const endpoints = {
        uber: '/api/importar/uber',
        bolt: '/api/importar/bolt',
        viaverde: '/api/importar/viaverde',
        combustivel: '/api/importar/combustivel',
        eletrico: '/api/importar/carregamento'
      };

      const response = await axios.post(
        `${API_URL}${endpoints[plataforma]}`,
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

      toast.success(`${plataforma.charAt(0).toUpperCase() + plataforma.slice(1)} importado com sucesso!`);
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
    if (semana > 1) {
      setSemana(semana - 1);
    } else {
      setSemana(52);
      setAno(ano - 1);
    }
  };

  const handleNextWeek = () => {
    if (semana < 52) {
      setSemana(semana + 1);
    } else {
      setSemana(1);
      setAno(ano + 1);
    }
  };

  const renderUploadCard = (plataforma, nome, descricao, formatosAceites) => {
    const Icon = PlatformIcons[plataforma];
    const file = ficheiros[plataforma];
    const resultado = resultados[plataforma];
    const isUploading = uploading[plataforma];

    return (
      <Card key={plataforma} className={`transition-all ${file ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Icon />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{nome}</h3>
              <p className="text-sm text-slate-500 mb-3">{descricao}</p>
              
              {/* Upload area */}
              <div className="relative">
                <input
                  type="file"
                  accept={formatosAceites}
                  onChange={(e) => handleFileChange(plataforma, e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors
                  ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-400'}`}>
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(plataforma, null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-sm text-slate-500">Arraste ou clique para selecionar</span>
                      <span className="text-xs text-slate-400">{formatosAceites}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Result */}
              {resultado && (
                <div className={`mt-3 p-3 rounded-lg ${resultado.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {resultado.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm ${resultado.success ? 'text-green-700' : 'text-red-700'}`}>
                      {resultado.message}
                    </span>
                  </div>
                  {resultado.success && resultado.sucesso > 0 && (
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="font-medium">{resultado.sucesso}</span> registos importados
                      {resultado.erros > 0 && (
                        <span className="text-orange-600 ml-2">({resultado.erros} erros)</span>
                      )}
                      {resultado.total > 0 && (
                        <span className="ml-2">• Total: <strong>€{resultado.total.toFixed(2)}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Upload button */}
              <Button
                onClick={() => handleUpload(plataforma)}
                disabled={!file || isUploading}
                className="mt-3 w-full"
                variant={file ? 'default' : 'secondary'}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    A importar...
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4 mr-2" />
                    Importar {nome}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importar Ficheiros</h1>
          <p className="text-slate-500">Importe dados das plataformas para os seus motoristas</p>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Semana:</Label>
                <Input
                  type="number"
                  min="1"
                  max="53"
                  value={semana}
                  onChange={(e) => setSemana(parseInt(e.target.value) || 1)}
                  className="w-20 text-center"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ano:</Label>
                <Input
                  type="number"
                  min="2020"
                  max="2030"
                  value={ano}
                  onChange={(e) => setAno(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24 text-center"
                />
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-center text-slate-500 mt-2 text-sm">
            Os ficheiros serão associados à <strong>Semana {semana}/{ano}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importar Ficheiros
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          {/* Upload all button */}
          {Object.values(ficheiros).some(f => f !== null) && (
            <div className="flex justify-end">
              <Button onClick={handleUploadAll} className="gap-2">
                <Upload className="w-4 h-4" />
                Importar Todos os Selecionados
              </Button>
            </div>
          )}

          {/* Platform cards - Grid 2 columns */}
          <div className="grid md:grid-cols-2 gap-4">
            {renderUploadCard(
              'uber',
              'Uber',
              'Ficheiro CSV de ganhos exportado da Uber',
              '.csv'
            )}
            {renderUploadCard(
              'bolt',
              'Bolt',
              'Ficheiro CSV de ganhos exportado da Bolt',
              '.csv'
            )}
            {renderUploadCard(
              'viaverde',
              'Via Verde',
              'Ficheiro Excel de portagens e parques',
              '.xlsx,.xls'
            )}
            {renderUploadCard(
              'combustivel',
              'Combustível',
              'Ficheiro Excel de abastecimentos (Galp, BP, etc.)',
              '.xlsx,.xls'
            )}
            {renderUploadCard(
              'eletrico',
              'Carregamentos Elétricos',
              'Ficheiro CSV de carregamentos (Prio, Mobi-e, etc.)',
              '.csv,.xlsx'
            )}
          </div>

          {/* Info box */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Dicas de importação:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Os motoristas são associados automaticamente pelo nome ou email</li>
                    <li>O aluguer do veículo é obtido automaticamente do veículo atribuído</li>
                    <li>A Via Verde usa apenas transações de "portagens" e "parques"</li>
                    <li>Verifique se os ficheiros estão no formato correto antes de importar</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Histórico de Importações</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchHistorico} disabled={loadingHistorico}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistorico ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {historico.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma importação encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Ficheiro</TableHead>
                      <TableHead>Semana</TableHead>
                      <TableHead>Registos</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.plataforma}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.nome_ficheiro}
                        </TableCell>
                        <TableCell>{item.semana}/{item.ano}</TableCell>
                        <TableCell>
                          <span className="text-green-600">{item.registos_sucesso || 0}</span>
                          {item.registos_erro > 0 && (
                            <span className="text-red-600 ml-1">/ {item.registos_erro}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {new Date(item.data_importacao).toLocaleDateString('pt-PT')}
                        </TableCell>
                        <TableCell>
                          {item.status === 'concluido' ? (
                            <Badge className="bg-green-500">Concluído</Badge>
                          ) : item.status === 'erro' ? (
                            <Badge className="bg-red-500">Erro</Badge>
                          ) : (
                            <Badge className="bg-yellow-500">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImportarFicheirosParceiro;
