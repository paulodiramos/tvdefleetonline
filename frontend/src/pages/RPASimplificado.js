import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  Fuel,
  Zap,
  MapPin,
  Satellite,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
  History,
  BarChart3
} from 'lucide-react';

const RPASimplificado = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Estados
  const [fornecedores, setFornecedores] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  
  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  
  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('relatorios');
  const [exportFilters, setExportFilters] = useState({
    data_inicio: '',
    data_fim: ''
  });

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Buscar fornecedores (público)
      try {
        const fornecedoresRes = await axios.get(`${API}/rpa/fornecedores`);
        setFornecedores(fornecedoresRes.data || []);
      } catch (e) {
        console.error('Erro ao carregar fornecedores:', e);
      }
      
      // Buscar importações (autenticado)
      try {
        const importacoesRes = await axios.get(`${API}/rpa/importacoes`, { headers });
        setImportacoes(importacoesRes.data || []);
      } catch (e) {
        console.log('Importações não disponíveis');
        setImportacoes([]);
      }
      
      // Buscar estatísticas (autenticado)
      try {
        const estatisticasRes = await axios.get(`${API}/rpa/estatisticas`, { headers });
        setEstatisticas(estatisticasRes.data);
      } catch (e) {
        console.log('Estatísticas não disponíveis');
        setEstatisticas({
          total_importacoes: 0,
          importacoes_sucesso: 0,
          importacoes_erro: 0,
          taxa_sucesso: 0
        });
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFornecedor || !uploadFile) {
      toast.error('Selecione um fornecedor e um ficheiro');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await axios.post(
        `${API}/rpa/upload/${selectedFornecedor.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setShowUploadModal(false);
        setUploadFile(null);
        setSelectedFornecedor(null);
        fetchDados();
      } else {
        toast.error(response.data.message || 'Erro na importação');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error(error.response?.data?.detail || 'Erro ao processar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      
      let url = '';
      switch (exportType) {
        case 'relatorios':
          url = `${API}/rpa/exportar/relatorios-semanais`;
          break;
        case 'recibos':
          url = `${API}/rpa/exportar/recibos`;
          break;
        case 'despesas':
          url = `${API}/rpa/exportar/despesas`;
          break;
        default:
          url = `${API}/rpa/exportar/relatorios-semanais`;
      }

      // Adicionar filtros de data
      const params = new URLSearchParams();
      if (exportFilters.data_inicio) params.append('data_inicio', exportFilters.data_inicio);
      if (exportFilters.data_fim) params.append('data_fim', exportFilters.data_fim);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Download do ficheiro
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Exportação concluída!');
      setShowExportModal(false);
    } catch (error) {
      console.error('Erro na exportação:', error);
      toast.error(error.response?.data?.detail || 'Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const getFornecedorIcon = (id) => {
    switch (id) {
      case 'combustivel_prio':
        return <Fuel className="w-6 h-6" />;
      case 'eletrico_prio':
        return <Zap className="w-6 h-6" />;
      case 'gps_verizon':
        return <MapPin className="w-6 h-6" />;
      case 'gps_cartrack':
        return <Satellite className="w-6 h-6" />;
      default:
        return <FileSpreadsheet className="w-6 h-6" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sucesso':
        return <Badge className="bg-green-100 text-green-700">Sucesso</Badge>;
      case 'sucesso_parcial':
        return <Badge className="bg-yellow-100 text-yellow-700">Parcial</Badge>;
      case 'erro':
        return <Badge className="bg-red-100 text-red-700">Erro</Badge>;
      case 'processando':
        return <Badge className="bg-blue-100 text-blue-700">Processando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Automação RPA Simplificada
              </h1>
              <p className="text-slate-600">Upload de CSV e Exportação de Dados</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExportModal(true)}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Importações</p>
                    <p className="text-2xl font-bold text-slate-700">{estatisticas.total_importacoes}</p>
                  </div>
                  <FileSpreadsheet className="w-8 h-8 text-slate-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Sucesso</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticas.importacoes_sucesso}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Erros</p>
                    <p className="text-2xl font-bold text-red-600">{estatisticas.importacoes_erro}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Taxa Sucesso</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticas.taxa_sucesso?.toFixed(0)}%</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload CSV
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="exportar" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </TabsTrigger>
          </TabsList>

          {/* Tab Upload */}
          <TabsContent value="upload">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fornecedores.map((fornecedor) => (
                <Card 
                  key={fornecedor.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedFornecedor(fornecedor);
                    setShowUploadModal(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: fornecedor.cor }}
                      >
                        {getFornecedorIcon(fornecedor.id)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{fornecedor.nome}</CardTitle>
                        <Badge variant="outline" className="mt-1">{fornecedor.tipo}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">{fornecedor.descricao}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Campos: {fornecedor.campos_esperados?.join(', ') || 'Variável'}</span>
                    </div>
                    <Button variant="outline" className="w-full mt-4">
                      <Upload className="w-4 h-4 mr-2" />
                      Carregar CSV
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Histórico de Importações</CardTitle>
                    <CardDescription>Últimas importações de ficheiros CSV</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchDados}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {importacoes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma importação registada</p>
                    <p className="text-sm">Carregue um ficheiro CSV para começar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Ficheiro</TableHead>
                        <TableHead>Registos</TableHead>
                        <TableHead>Erros</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importacoes.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="text-sm">{formatDate(imp.created_at)}</TableCell>
                          <TableCell className="font-medium">{imp.fornecedor_nome}</TableCell>
                          <TableCell className="text-sm text-slate-600">{imp.ficheiro}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50">
                              {imp.registos_importados}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {imp.registos_erro > 0 ? (
                              <Badge variant="outline" className="bg-red-50 text-red-700">
                                {imp.registos_erro}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(imp.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Exportar */}
          <TabsContent value="exportar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Relatórios Semanais */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Relatórios Semanais</CardTitle>
                      <CardDescription>Exportar relatórios de motoristas</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    Inclui ganhos Uber/Bolt, comissões, valores a pagar por motorista.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setExportType('relatorios');
                      setShowExportModal(true);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* Recibos/Transações */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Recibos / Transações</CardTitle>
                      <CardDescription>Exportar recibos e ganhos</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    Lista de recibos submetidos pelos motoristas com valores e status.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setExportType('recibos');
                      setShowExportModal(true);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* Despesas */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Fuel className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Despesas</CardTitle>
                      <CardDescription>Exportar combustível e elétrico</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    Despesas de combustível, carregamentos elétricos e outras.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setExportType('despesas');
                      setShowExportModal(true);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Upload */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Ficheiro CSV
            </DialogTitle>
            <DialogDescription>
              {selectedFornecedor 
                ? `Carregar dados de ${selectedFornecedor.nome}`
                : 'Selecione um fornecedor e carregue o ficheiro CSV'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Seleção de Fornecedor */}
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select 
                value={selectedFornecedor?.id || ''} 
                onValueChange={(value) => {
                  const f = fornecedores.find(f => f.id === value);
                  setSelectedFornecedor(f);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="mr-2">{f.icone}</span>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info do fornecedor selecionado */}
            {selectedFornecedor && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">{selectedFornecedor.descricao}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <strong>Campos esperados:</strong> {selectedFornecedor.campos_esperados?.join(', ') || 'Flexível'}
                </div>
              </div>
            )}

            {/* Upload de ficheiro */}
            <div className="space-y-2">
              <Label>Ficheiro CSV</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
              {uploadFile && (
                <p className="text-sm text-slate-500">
                  Ficheiro: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Formato esperado</p>
                <p className="text-xs mt-1">
                  O ficheiro deve estar em formato CSV com cabeçalhos na primeira linha. 
                  Os campos serão mapeados automaticamente.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadModal(false);
              setUploadFile(null);
              setSelectedFornecedor(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFornecedor || !uploadFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Exportar */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Exportar Dados CSV
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de dados e o período a exportar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo de exportação */}
            <div className="space-y-2">
              <Label>Tipo de Dados</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relatorios">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Relatórios Semanais
                    </span>
                  </SelectItem>
                  <SelectItem value="recibos">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Recibos / Transações
                    </span>
                  </SelectItem>
                  <SelectItem value="despesas">
                    <span className="flex items-center gap-2">
                      <Fuel className="w-4 h-4" />
                      Despesas
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros de data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={exportFilters.data_inicio}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={exportFilters.data_fim}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                O ficheiro será exportado em formato CSV com separador ponto e vírgula (;) 
                para compatibilidade com Excel.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A exportar...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RPASimplificado;
