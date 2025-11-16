import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, XCircle, DollarSign, Users, Calendar, Download } from 'lucide-react';

const ImportUber = ({ user, onLogout }) => {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [ganhos, setGanhos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGanhos();
  }, []);

  const fetchGanhos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/ganhos-uber`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGanhos(response.data);
    } catch (error) {
      console.error('Error fetching ganhos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um ficheiro CSV');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/import/uber/ganhos`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      toast.success(`${response.data.total_linhas} registos importados com sucesso!`);
      fetchGanhos();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${day}/${month}/${year}`;
  };

  // Agrupar ganhos por período
  const ganhosPorPeriodo = ganhos.reduce((acc, ganho) => {
    const key = `${ganho.periodo_inicio}-${ganho.periodo_fim}`;
    if (!acc[key]) {
      acc[key] = {
        periodo_inicio: ganho.periodo_inicio,
        periodo_fim: ganho.periodo_fim,
        ficheiro: ganho.ficheiro_nome,
        data_importacao: ganho.data_importacao,
        ganhos: []
      };
    }
    acc[key].ganhos.push(ganho);
    return acc;
  }, {});

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <span>Importação de Ganhos Uber</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Importe ficheiros CSV de pagamentos da Uber para acompanhar os ganhos dos motoristas
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Importar Ficheiro CSV</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-600 mb-4">
                  Selecione o ficheiro CSV de pagamentos da Uber
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    disabled={uploading}
                    className="cursor-pointer"
                    onClick={() => document.querySelector('input[type="file"]').click()}
                  >
                    {uploading ? 'A carregar...' : 'Selecionar Ficheiro'}
                  </Button>
                </label>
                <p className="text-xs text-slate-500 mt-2">
                  Formato esperado: payments_driver_YYYYMMDD-YYYYMMDD.csv
                </p>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-3 flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Importação Concluída</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-green-700">Total de Registos</p>
                      <p className="text-2xl font-bold text-green-900">{importResult.total_linhas}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Motoristas Encontrados</p>
                      <p className="text-2xl font-bold text-green-900">{importResult.motoristas_encontrados}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Não Encontrados</p>
                      <p className="text-2xl font-bold text-amber-600">{importResult.motoristas_nao_encontrados}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Total de Ganhos</p>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(importResult.total_ganhos)}</p>
                    </div>
                  </div>
                  {importResult.erros && importResult.erros.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded">
                      <p className="text-sm font-semibold text-red-900 mb-1">Erros:</p>
                      <ul className="text-xs text-red-800 space-y-1">
                        {importResult.erros.map((erro, idx) => (
                          <li key={idx}>• {erro}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Importações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Histórico de Importações</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-slate-500 py-8">A carregar...</p>
            ) : Object.keys(ganhosPorPeriodo).length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhuma importação realizada ainda</p>
            ) : (
              <div className="space-y-4">
                {Object.values(ganhosPorPeriodo).map((periodo, idx) => {
                  const totalPeriodo = periodo.ganhos.reduce((sum, g) => sum + g.pago_total, 0);
                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {formatDate(periodo.periodo_inicio)} - {formatDate(periodo.periodo_fim)}
                          </h3>
                          <p className="text-sm text-slate-600">{periodo.ficheiro}</p>
                          <p className="text-xs text-slate-500">
                            Importado em {new Date(periodo.data_importacao).toLocaleString('pt-PT')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-600">Total do Período</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPeriodo)}</p>
                          <p className="text-sm text-slate-600">{periodo.ganhos.length} motoristas</p>
                        </div>
                      </div>

                      {/* Lista de motoristas do período */}
                      <div className="border-t pt-3">
                        <div className="grid gap-2">
                          {periodo.ganhos.map((ganho, gIdx) => (
                            <div key={gIdx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <div className="flex items-center space-x-3">
                                <Users className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {ganho.nome_motorista} {ganho.apelido_motorista}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {ganho.motorista_id ? (
                                      <span className="text-green-600">✓ Associado</span>
                                    ) : (
                                      <span className="text-amber-600">⚠ Não encontrado no sistema</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-800">{formatCurrency(ganho.pago_total)}</p>
                                <p className="text-xs text-slate-500">
                                  Taxa: {formatCurrency(ganho.taxa_servico || 0)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportUber;
