import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  Users,
  Car,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  CheckSquare,
  Square,
  Archive,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ExportarDados = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const fileInputMotoristas = useRef(null);
  const fileInputVeiculos = useRef(null);
  
  // Estados gerais
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('exportar');
  const [delimitador, setDelimitador] = useState(';');
  
  // Estados de exportação
  const [exporting, setExporting] = useState(false);
  const [camposDisponiveis, setCamposDisponiveis] = useState({ motoristas: [], veiculos: [] });
  const [camposMotoristaSelecionados, setCamposMotoristaSelecionados] = useState([]);
  const [camposVeiculoSelecionados, setCamposVeiculoSelecionados] = useState([]);
  
  // Estados de importação
  const [importing, setImporting] = useState(false);
  const [previewMotoristas, setPreviewMotoristas] = useState(null);
  const [previewVeiculos, setPreviewVeiculos] = useState(null);
  const [fileMotoristas, setFileMotoristas] = useState(null);
  const [fileVeiculos, setFileVeiculos] = useState(null);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    carregarCampos();
  }, []);

  const carregarCampos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/exportacao/campos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCamposDisponiveis(response.data);
      setCamposMotoristaSelecionados(
        response.data.motoristas.filter(c => c.default).map(c => c.id)
      );
      setCamposVeiculoSelecionados(
        response.data.veiculos.filter(c => c.default).map(c => c.id)
      );
    } catch (error) {
      console.error('Erro ao carregar campos:', error);
      toast.error('Erro ao carregar campos disponíveis');
    } finally {
      setLoading(false);
    }
  };

  // ==================== EXPORTAÇÃO ====================
  
  const toggleCampoMotorista = (campoId) => {
    setCamposMotoristaSelecionados(prev => 
      prev.includes(campoId) ? prev.filter(c => c !== campoId) : [...prev, campoId]
    );
  };

  const toggleCampoVeiculo = (campoId) => {
    setCamposVeiculoSelecionados(prev => 
      prev.includes(campoId) ? prev.filter(c => c !== campoId) : [...prev, campoId]
    );
  };

  const exportarMotoristas = async () => {
    if (camposMotoristaSelecionados.length === 0) {
      toast.error('Selecione pelo menos um campo');
      return;
    }
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const campos = camposMotoristaSelecionados.join(',');
      const response = await axios.get(
        `${API}/api/exportacao/motoristas?campos=${campos}&delimitador=${delimitador}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      downloadBlob(response.data, `motoristas_${new Date().toISOString().slice(0,10)}.csv`);
      toast.success('Exportação concluída!');
    } catch (error) {
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const exportarVeiculos = async () => {
    if (camposVeiculoSelecionados.length === 0) {
      toast.error('Selecione pelo menos um campo');
      return;
    }
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const campos = camposVeiculoSelecionados.join(',');
      const response = await axios.get(
        `${API}/api/exportacao/veiculos?campos=${campos}&delimitador=${delimitador}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      downloadBlob(response.data, `veiculos_${new Date().toISOString().slice(0,10)}.csv`);
      toast.success('Exportação concluída!');
    } catch (error) {
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const exportarTudo = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/exportacao/completa?campos_motoristas=${camposMotoristaSelecionados.join(',')}&campos_veiculos=${camposVeiculoSelecionados.join(',')}&delimitador=${delimitador}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      downloadBlob(response.data, `exportacao_${new Date().toISOString().slice(0,10)}.zip`);
      toast.success('Exportação concluída!');
    } catch (error) {
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const downloadBlob = (data, filename) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // ==================== IMPORTAÇÃO ====================

  const handleFileSelectMotoristas = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFileMotoristas(file);
    setPreviewMotoristas(null);
    setImportResult(null);
    
    try {
      setImporting(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('delimitador', delimitador);
      
      const response = await axios.post(
        `${API}/api/exportacao/importar/motoristas/preview`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setPreviewMotoristas(response.data);
      
      if (response.data.registos_para_atualizar === 0) {
        toast.info('Nenhuma alteração detectada');
      } else {
        toast.success(`${response.data.registos_para_atualizar} registo(s) para atualizar`);
      }
    } catch (error) {
      console.error('Erro ao processar ficheiro:', error);
      toast.error(error.response?.data?.detail || 'Erro ao processar ficheiro');
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelectVeiculos = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFileVeiculos(file);
    setPreviewVeiculos(null);
    setImportResult(null);
    
    try {
      setImporting(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('delimitador', delimitador);
      
      const response = await axios.post(
        `${API}/api/exportacao/importar/veiculos/preview`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setPreviewVeiculos(response.data);
      
      if (response.data.registos_para_atualizar === 0) {
        toast.info('Nenhuma alteração detectada');
      } else {
        toast.success(`${response.data.registos_para_atualizar} registo(s) para atualizar`);
      }
    } catch (error) {
      console.error('Erro ao processar ficheiro:', error);
      toast.error(error.response?.data?.detail || 'Erro ao processar ficheiro');
    } finally {
      setImporting(false);
    }
  };

  const confirmarImportacaoMotoristas = async () => {
    if (!fileMotoristas) return;
    
    try {
      setImporting(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', fileMotoristas);
      formData.append('delimitador', delimitador);
      
      const response = await axios.post(
        `${API}/api/exportacao/importar/motoristas/confirmar`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setImportResult({ tipo: 'motoristas', ...response.data });
      setPreviewMotoristas(null);
      setFileMotoristas(null);
      
      if (response.data.atualizados > 0) {
        toast.success(`${response.data.atualizados} motorista(s) atualizado(s)!`);
      }
    } catch (error) {
      toast.error('Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const confirmarImportacaoVeiculos = async () => {
    if (!fileVeiculos) return;
    
    try {
      setImporting(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', fileVeiculos);
      formData.append('delimitador', delimitador);
      
      const response = await axios.post(
        `${API}/api/exportacao/importar/veiculos/confirmar`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      
      setImportResult({ tipo: 'veiculos', ...response.data });
      setPreviewVeiculos(null);
      setFileVeiculos(null);
      
      if (response.data.atualizados > 0) {
        toast.success(`${response.data.atualizados} veículo(s) atualizado(s)!`);
      }
    } catch (error) {
      toast.error('Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const limparImportacao = () => {
    setPreviewMotoristas(null);
    setPreviewVeiculos(null);
    setFileMotoristas(null);
    setFileVeiculos(null);
    setImportResult(null);
    if (fileInputMotoristas.current) fileInputMotoristas.current.value = '';
    if (fileInputVeiculos.current) fileInputVeiculos.current.value = '';
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="exportar-dados-page">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Exportar / Importar Dados
            </h1>
            <p className="text-slate-500">Exporte ou importe dados de motoristas e veículos</p>
          </div>
        </div>

        {/* Tabs principais: Exportar / Importar */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="exportar" className="flex items-center gap-2" data-testid="tab-exportar">
              <Download className="w-4 h-4" />
              Exportar
            </TabsTrigger>
            <TabsTrigger value="importar" className="flex items-center gap-2" data-testid="tab-importar">
              <Upload className="w-4 h-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB EXPORTAR ==================== */}
          <TabsContent value="exportar" className="space-y-6">
            {/* Opções de Formato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formato do Ficheiro</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={delimitador} onValueChange={setDelimitador} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value=";" id="semicolon" />
                    <Label htmlFor="semicolon">Ponto-e-vírgula (;) - Excel PT</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="," id="comma" />
                    <Label htmlFor="comma">Vírgula (,) - Internacional</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Sub-tabs: Motoristas / Veículos */}
            <Tabs defaultValue="motoristas">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="motoristas"><Users className="w-4 h-4 mr-2" />Motoristas</TabsTrigger>
                <TabsTrigger value="veiculos"><Car className="w-4 h-4 mr-2" />Veículos</TabsTrigger>
              </TabsList>

              <TabsContent value="motoristas">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Campos de Motoristas
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCamposMotoristaSelecionados(camposDisponiveis.motoristas.map(c => c.id))}>
                          <CheckSquare className="w-4 h-4 mr-1" />Todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCamposMotoristaSelecionados([])}>
                          <Square className="w-4 h-4 mr-1" />Nenhum
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {camposDisponiveis.motoristas.map((campo) => (
                        <div key={campo.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exp-mot-${campo.id}`}
                            checked={camposMotoristaSelecionados.includes(campo.id)}
                            onCheckedChange={() => toggleCampoMotorista(campo.id)}
                          />
                          <Label htmlFor={`exp-mot-${campo.id}`} className="text-sm cursor-pointer">{campo.label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-6 pt-4 border-t">
                      <Button onClick={exportarMotoristas} disabled={exporting || camposMotoristaSelecionados.length === 0} data-testid="btn-exportar-motoristas">
                        {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Exportar Motoristas
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="veiculos">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-green-600" />
                        Campos de Veículos
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCamposVeiculoSelecionados(camposDisponiveis.veiculos.map(c => c.id))}>
                          <CheckSquare className="w-4 h-4 mr-1" />Todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCamposVeiculoSelecionados([])}>
                          <Square className="w-4 h-4 mr-1" />Nenhum
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {camposDisponiveis.veiculos.map((campo) => (
                        <div key={campo.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exp-veic-${campo.id}`}
                            checked={camposVeiculoSelecionados.includes(campo.id)}
                            onCheckedChange={() => toggleCampoVeiculo(campo.id)}
                          />
                          <Label htmlFor={`exp-veic-${campo.id}`} className="text-sm cursor-pointer">{campo.label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-6 pt-4 border-t">
                      <Button onClick={exportarVeiculos} disabled={exporting || camposVeiculoSelecionados.length === 0} data-testid="btn-exportar-veiculos">
                        {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Exportar Veículos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Exportar Tudo */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Archive className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Exportação Completa</h3>
                      <p className="text-sm text-slate-500">Motoristas + Veículos em ZIP</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={exportarTudo} disabled={exporting} data-testid="btn-exportar-tudo">
                    {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                    Exportar ZIP
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TAB IMPORTAR ==================== */}
          <TabsContent value="importar" className="space-y-6">
            {/* Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importação Segura</AlertTitle>
              <AlertDescription>
                A importação apenas <strong>atualiza registos existentes</strong>. Motoristas são identificados pelo <strong>NIF</strong> e veículos pela <strong>Matrícula</strong>.
                Exporte primeiro os dados, edite no Excel, e importe de volta.
              </AlertDescription>
            </Alert>

            {/* Formato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formato do Ficheiro</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={delimitador} onValueChange={setDelimitador} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value=";" id="imp-semicolon" />
                    <Label htmlFor="imp-semicolon">Ponto-e-vírgula (;)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="," id="imp-comma" />
                    <Label htmlFor="imp-comma">Vírgula (,)</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Resultado da Importação */}
            {importResult && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Importação Concluída</AlertTitle>
                <AlertDescription className="text-green-700">
                  {importResult.atualizados} {importResult.tipo === 'motoristas' ? 'motorista(s)' : 'veículo(s)'} atualizado(s) com sucesso.
                  {importResult.erros?.length > 0 && ` (${importResult.erros.length} erro(s))`}
                </AlertDescription>
              </Alert>
            )}

            {/* Sub-tabs: Motoristas / Veículos */}
            <Tabs defaultValue="motoristas">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="motoristas"><Users className="w-4 h-4 mr-2" />Motoristas</TabsTrigger>
                <TabsTrigger value="veiculos"><Car className="w-4 h-4 mr-2" />Veículos</TabsTrigger>
              </TabsList>

              {/* Importar Motoristas */}
              <TabsContent value="motoristas">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Importar Motoristas
                    </CardTitle>
                    <CardDescription>
                      Selecione um ficheiro CSV exportado anteriormente. Campo obrigatório: <strong>NIF</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        ref={fileInputMotoristas}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelectMotoristas}
                        className="max-w-md"
                        data-testid="input-file-motoristas"
                      />
                      {fileMotoristas && (
                        <Badge variant="outline">{fileMotoristas.name}</Badge>
                      )}
                    </div>

                    {/* Preview Motoristas */}
                    {previewMotoristas && (
                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Pré-visualização</h4>
                            <p className="text-sm text-slate-500">
                              {previewMotoristas.registos_para_atualizar} registo(s) para atualizar
                              {previewMotoristas.linhas_ignoradas > 0 && `, ${previewMotoristas.linhas_ignoradas} ignorado(s)`}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={limparImportacao}>
                            <RefreshCw className="w-4 h-4 mr-1" />Limpar
                          </Button>
                        </div>

                        {previewMotoristas.preview.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>NIF</TableHead>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Alterações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {previewMotoristas.preview.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono">{item.nif}</TableCell>
                                    <TableCell>{item.nome}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        {item.alteracoes.map((alt, altIdx) => (
                                          <div key={altIdx} className="text-xs">
                                            <span className="font-medium">{alt.campo}:</span>{' '}
                                            <span className="text-red-600 line-through">{alt.valor_atual}</span>
                                            <ArrowRight className="w-3 h-3 inline mx-1" />
                                            <span className="text-green-600">{alt.valor_novo}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4">Nenhuma alteração detectada</p>
                        )}

                        {previewMotoristas.registos_para_atualizar > 0 && (
                          <div className="flex justify-end">
                            <Button onClick={confirmarImportacaoMotoristas} disabled={importing} data-testid="btn-confirmar-importar-motoristas">
                              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                              Confirmar Importação
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Importar Veículos */}
              <TabsContent value="veiculos">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-green-600" />
                      Importar Veículos
                    </CardTitle>
                    <CardDescription>
                      Selecione um ficheiro CSV exportado anteriormente. Campo obrigatório: <strong>Matrícula</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        ref={fileInputVeiculos}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelectVeiculos}
                        className="max-w-md"
                        data-testid="input-file-veiculos"
                      />
                      {fileVeiculos && (
                        <Badge variant="outline">{fileVeiculos.name}</Badge>
                      )}
                    </div>

                    {/* Preview Veículos */}
                    {previewVeiculos && (
                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Pré-visualização</h4>
                            <p className="text-sm text-slate-500">
                              {previewVeiculos.registos_para_atualizar} registo(s) para atualizar
                              {previewVeiculos.linhas_ignoradas > 0 && `, ${previewVeiculos.linhas_ignoradas} ignorado(s)`}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={limparImportacao}>
                            <RefreshCw className="w-4 h-4 mr-1" />Limpar
                          </Button>
                        </div>

                        {previewVeiculos.preview.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Matrícula</TableHead>
                                  <TableHead>Veículo</TableHead>
                                  <TableHead>Alterações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {previewVeiculos.preview.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono">{item.matricula}</TableCell>
                                    <TableCell>{item.marca_modelo}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        {item.alteracoes.map((alt, altIdx) => (
                                          <div key={altIdx} className="text-xs">
                                            <span className="font-medium">{alt.campo}:</span>{' '}
                                            <span className="text-red-600 line-through">{alt.valor_atual}</span>
                                            <ArrowRight className="w-3 h-3 inline mx-1" />
                                            <span className="text-green-600">{alt.valor_novo}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4">Nenhuma alteração detectada</p>
                        )}

                        {previewVeiculos.registos_para_atualizar > 0 && (
                          <div className="flex justify-end">
                            <Button onClick={confirmarImportacaoVeiculos} disabled={importing} data-testid="btn-confirmar-importar-veiculos">
                              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                              Confirmar Importação
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ExportarDados;
