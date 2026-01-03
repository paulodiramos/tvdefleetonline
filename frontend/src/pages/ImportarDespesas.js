import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, 
  Car, User, Euro, FileText, Trash2, Eye, RefreshCw,
  ArrowRight, X, Download
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ImportarDespesas = ({ user, onLogout }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importacoes, setImportacoes] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [selectedImportacao, setSelectedImportacao] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const fileInputRef = useRef(null);
  
  // Seletores de semana para importação
  const [semanaDados, setSemanaDados] = useState(''); // Semana dos dados no ficheiro
  const [semanaRelatorio, setSemanaRelatorio] = useState(''); // Semana onde associar no relatório
  const [anoDados, setAnoDados] = useState(new Date().getFullYear());
  const [anoRelatorio, setAnoRelatorio] = useState(new Date().getFullYear());

  // Gerar lista de semanas (1-53)
  const semanas = Array.from({ length: 53 }, (_, i) => i + 1);
  const anos = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  useEffect(() => {
    fetchImportacoes();
    fetchResumo();
    fetchDespesas();
  }, []);

  const fetchImportacoes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/despesas/importacoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImportacoes(response.data);
    } catch (error) {
      console.error('Error fetching importacoes:', error);
    }
  };

  const fetchResumo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/despesas/resumo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResumo(response.data);
    } catch (error) {
      console.error('Error fetching resumo:', error);
    }
  };

  const fetchDespesas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/despesas?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDespesas(response.data.despesas || []);
    } catch (error) {
      console.error('Error fetching despesas:', error);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExt = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExt)) {
      toast.error('Formato de ficheiro inválido. Use CSV ou Excel.');
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);

    // Preview the file
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API}/despesas/preview`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setPreview(response.data);
      toast.success('Ficheiro carregado com sucesso!');
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error(error.response?.data?.detail || 'Erro ao carregar ficheiro');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecione um ficheiro primeiro');
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo_fornecedor', 'via_verde');

      const response = await axios.post(`${API}/despesas/importar`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      toast.success(`Importação concluída! ${response.data.registos_importados} registos importados.`);
      
      // Refresh data
      fetchImportacoes();
      fetchResumo();
      fetchDespesas();

      // Clear file
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error(error.response?.data?.detail || 'Erro na importação');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteImportacao = async (importacaoId) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta importação e todas as despesas associadas?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/despesas/importacoes/${importacaoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Importação eliminada!');
      fetchImportacoes();
      fetchResumo();
      fetchDespesas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao eliminar');
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Importar Despesas</h1>
            <p className="text-slate-600 mt-1">
              Importe ficheiros CSV/Excel de fornecedores (Via Verde, etc.)
            </p>
          </div>
          <FileSpreadsheet className="w-8 h-8 text-green-600" />
        </div>

        {/* Resumo Cards */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Despesas</p>
                    <p className="text-2xl font-bold">{formatCurrency(resumo.total_geral)}</p>
                  </div>
                  <Euro className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Motoristas</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(resumo.por_responsavel?.motorista?.total || 0)}
                    </p>
                  </div>
                  <User className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Veículos (Parceiro)</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(resumo.por_responsavel?.veiculo?.total || 0)}
                    </p>
                  </div>
                  <Car className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Registos</p>
                    <p className="text-2xl font-bold">{resumo.total_registos}</p>
                  </div>
                  <FileText className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Carregar Ficheiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Input */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-700">
                  {file ? file.name : 'Clique para selecionar ficheiro'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Suporta CSV, XLSX, XLS (Via Verde, etc.)
                </p>
              </label>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-600">A processar ficheiro...</span>
              </div>
            )}

            {/* Preview */}
            {preview && !loading && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Pré-visualização</h3>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    <X className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Total Registos</p>
                    <p className="text-xl font-bold">{preview.total_registos}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Matrículas Únicas</p>
                    <p className="text-xl font-bold">{preview.total_matriculas}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Colunas Identificadas</p>
                    <p className="text-xl font-bold">{Object.keys(preview.colunas_identificadas || {}).length}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Total Colunas</p>
                    <p className="text-xl font-bold">{preview.colunas?.length || 0}</p>
                  </div>
                </div>

                {/* Column Mapping */}
                <div>
                  <h4 className="font-medium mb-2">Mapeamento de Colunas</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.colunas_identificadas || {}).map(([original, mapped]) => (
                      <Badge key={original} variant="outline" className="text-sm">
                        {original} → <span className="font-semibold">{mapped}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Matriculas */}
                <div>
                  <h4 className="font-medium mb-2">Matrículas Encontradas (primeiras 20)</h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.matriculas_unicas?.map((mat, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-800">
                        {mat}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sample Data */}
                <div>
                  <h4 className="font-medium mb-2">Amostra de Dados</h4>
                  <div className="overflow-x-auto max-h-64 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {preview.colunas?.slice(0, 8).map((col, idx) => (
                            <TableHead key={idx} className="text-xs whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.sample_data?.slice(0, 5).map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            {preview.colunas?.slice(0, 8).map((col, colIdx) => (
                              <TableCell key={colIdx} className="text-xs whitespace-nowrap">
                                {row[col] !== null ? String(row[col]).substring(0, 30) : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Import Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleImport} 
                    disabled={importing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        A importar...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Importar {preview.total_registos} Registos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <Card className={importResult.registos_erro > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {importResult.registos_erro > 0 ? (
                      <AlertCircle className="w-8 h-8 text-amber-600" />
                    ) : (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {importResult.registos_erro > 0 ? 'Importação Concluída com Avisos' : 'Importação Concluída com Sucesso!'}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Importados</p>
                          <p className="font-bold text-green-700">{importResult.registos_importados}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Erros</p>
                          <p className="font-bold text-red-700">{importResult.registos_erro}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Veículos Encontrados</p>
                          <p className="font-bold">{importResult.veiculos_encontrados}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Motoristas Associados</p>
                          <p className="font-bold">{importResult.motoristas_associados}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-white p-3 rounded border">
                          <p className="text-slate-500">Total Importado</p>
                          <p className="font-bold text-lg">{formatCurrency(importResult.valor_total)}</p>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <p className="text-slate-500">A Cargo Motoristas</p>
                          <p className="font-bold text-lg text-green-700">{formatCurrency(importResult.valor_motoristas)}</p>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <p className="text-slate-500">A Cargo Parceiro</p>
                          <p className="font-bold text-lg text-purple-700">{formatCurrency(importResult.valor_parceiro)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Importações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {importacoes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>Nenhuma importação realizada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ficheiro</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Registos</TableHead>
                    <TableHead>Veículos</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importacoes.map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-medium">{imp.nome_ficheiro}</TableCell>
                      <TableCell>{formatDate(imp.created_at)}</TableCell>
                      <TableCell>
                        <span className="text-green-600">{imp.registos_importados}</span>
                        {imp.registos_erro > 0 && (
                          <span className="text-red-600 ml-1">({imp.registos_erro} erros)</span>
                        )}
                      </TableCell>
                      <TableCell>{imp.veiculos_encontrados}</TableCell>
                      <TableCell>{formatCurrency(imp.valor_total)}</TableCell>
                      <TableCell>
                        <Badge className={
                          imp.status === 'concluido' ? 'bg-green-100 text-green-800' :
                          imp.status === 'erro' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }>
                          {imp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedImportacao(imp);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleDeleteImportacao(imp.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="w-5 h-5" />
              Despesas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {despesas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Euro className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>Nenhuma despesa importada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Percurso</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Motorista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesas.map((desp) => (
                    <TableRow key={desp.id}>
                      <TableCell>{formatDate(desp.data_entrada)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{desp.matricula}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {desp.ponto_entrada && desp.ponto_saida ? (
                          <>
                            {desp.ponto_entrada} <ArrowRight className="w-3 h-3 inline mx-1" /> {desp.ponto_saida}
                          </>
                        ) : desp.ponto_entrada || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(desp.valor_liquido)}</TableCell>
                      <TableCell>
                        <Badge className={
                          desp.tipo_responsavel === 'motorista' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }>
                          {desp.tipo_responsavel === 'motorista' ? (
                            <><User className="w-3 h-3 mr-1" /> Motorista</>
                          ) : (
                            <><Car className="w-3 h-3 mr-1" /> Veículo</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {desp.motorista?.name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Importação</DialogTitle>
            </DialogHeader>
            {selectedImportacao && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Ficheiro</p>
                    <p className="font-medium">{selectedImportacao.nome_ficheiro}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Data</p>
                    <p className="font-medium">{formatDate(selectedImportacao.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Registos Importados</p>
                    <p className="font-medium text-green-600">{selectedImportacao.registos_importados}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Registos com Erro</p>
                    <p className="font-medium text-red-600">{selectedImportacao.registos_erro}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Valor Total</p>
                    <p className="font-medium">{formatCurrency(selectedImportacao.valor_total)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">A Cargo Motoristas</p>
                    <p className="font-medium text-green-600">{formatCurrency(selectedImportacao.valor_motoristas)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">A Cargo Parceiro</p>
                    <p className="font-medium text-purple-600">{formatCurrency(selectedImportacao.valor_parceiro)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Veículos Encontrados</p>
                    <p className="font-medium">{selectedImportacao.veiculos_encontrados}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ImportarDespesas;
