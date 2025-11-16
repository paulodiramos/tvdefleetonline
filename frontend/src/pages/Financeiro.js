import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileText, TrendingUp, DollarSign, Users, Calendar } from 'lucide-react';

const Financeiro = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('bolt');
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const platforms = [
    { id: 'uber', name: 'Uber', icon: '🚕', endpoint: '/import/uber/ganhos' },
    { id: 'bolt', name: 'Bolt', icon: '⚡', endpoint: '/import/bolt/ganhos' },
    { id: 'via_verde', name: 'Via Verde', icon: '🛣️', endpoint: '/import/via-verde/dados' },
    { id: 'combustivel', name: 'Combustível', icon: '⛽', endpoint: '/import/combustivel/dados' },
    { id: 'gps', name: 'GPS', icon: '📍', endpoint: '/import/gps/dados' }
  ];

  useEffect(() => {
    fetchParceiros();
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
      if (response.data.length > 0) {
        setSelectedParceiro(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um ficheiro CSV');
      return;
    }

    if (!selectedParceiro) {
      toast.error('Selecione um parceiro primeiro');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      if (selectedParceiro) {
        formData.append('parceiro_id', selectedParceiro.id);
      }

      const platform = platforms.find(p => p.id === selectedPlatform);
      const response = await axios.post(`${API}${platform.endpoint}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      toast.success(`${response.data.total_linhas} registos importados de ${platform.name}!`);
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
    }).format(value || 0);
  };

  // Agrupar ganhos por período
  const ganhosPorPeriodo = ganhos.reduce((acc, ganho) => {
    const key = `${ganho.periodo_ano}W${ganho.periodo_semana}`;
    if (!acc[key]) {
      acc[key] = {
        periodo: key,
        ano: ganho.periodo_ano,
        semana: ganho.periodo_semana,
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
            <Upload className="w-8 h-8 text-blue-600" />
            <span>Upload CSV</span>
          </h1>
          <p className="text-slate-600 mt-2">
            Importe manualmente ficheiros CSV de Uber, Bolt, Via Verde, Combustível e GPS
          </p>
        </div>

        {/* Seletor de Parceiro */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <label className="text-base font-semibold min-w-[120px]">Parceiro:</label>
              <select
                className="flex-1 p-2 border rounded-md"
                value={selectedParceiro?.id || ''}
                onChange={(e) => {
                  const parceiro = parceiros.find(p => p.id === e.target.value);
                  setSelectedParceiro(parceiro);
                }}
              >
                <option value="">Selecione um parceiro</option>
                {parceiros.map((parceiro) => (
                  <option key={parceiro.id} value={parceiro.id}>
                    {parceiro.nome_empresa || parceiro.email}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Seletor de Plataforma */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selecione a Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    selectedPlatform === platform.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{platform.icon}</div>
                  <div className="font-semibold">{platform.name}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Upload Ficheiro CSV</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">
                  {platforms.find(p => p.id === selectedPlatform)?.icon}
                </div>
                <p className="text-slate-600 mb-4">
                  Selecione o ficheiro CSV de <strong>{platforms.find(p => p.id === selectedPlatform)?.name}</strong>
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
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700"
                    onClick={() => document.querySelector('input[type="file"]').click()}
                  >
                    {uploading ? 'A importar...' : `Upload CSV ${platforms.find(p => p.id === selectedPlatform)?.name}`}
                  </Button>
                </label>
                
                <div className="mt-4 text-xs text-slate-500 text-left max-w-md mx-auto">
                  <p className="font-semibold mb-2">Formatos aceites:</p>
                  <ul className="space-y-1">
                    <li>• <strong>Uber:</strong> 20251110-20251116-payments_driver-XXX.csv</li>
                    <li>• <strong>Bolt:</strong> Ganhos por motorista-2025W45-XXX.csv</li>
                    <li>• <strong>Via Verde:</strong> extrato-YYYYMMDD.csv</li>
                    <li>• <strong>Combustível:</strong> transacoes-YYYYMMDD.csv</li>
                    <li>• <strong>GPS:</strong> relatorio-YYYYMMDD.csv</li>
                  </ul>
                </div>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-3 flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Importação Concluída</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-green-700">Total Registos</p>
                      <p className="text-2xl font-bold text-green-900">{importResult.total_linhas}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Encontrados</p>
                      <p className="text-2xl font-bold text-green-900">{importResult.motoristas_encontrados}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Não Encontrados</p>
                      <p className="text-2xl font-bold text-amber-600">{importResult.motoristas_nao_encontrados}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Total Ganhos</p>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(importResult.total_ganhos)}</p>
                    </div>
                  </div>
                  {importResult.periodo && (
                    <p className="text-sm text-green-700 mt-2">
                      Período: <strong>{importResult.periodo}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Ganhos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Histórico Financeiro - Bolt</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(ganhosPorPeriodo).length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                {selectedParceiro ? 'Nenhum ganho importado ainda' : 'Selecione um parceiro'}
              </p>
            ) : (
              <div className="space-y-4">
                {Object.values(ganhosPorPeriodo).reverse().map((periodo, idx) => {
                  const totalPeriodo = periodo.ganhos.reduce((sum, g) => sum + g.ganhos_liquidos, 0);
                  const totalBruto = periodo.ganhos.reduce((sum, g) => sum + g.ganhos_brutos_total, 0);
                  const totalComissoes = periodo.ganhos.reduce((sum, g) => sum + g.comissoes, 0);
                  
                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <div>
                          <h3 className="font-semibold text-slate-800 text-lg">
                            Semana {periodo.semana}/{periodo.ano}
                          </h3>
                          <p className="text-sm text-slate-600">{periodo.ganhos.length} motoristas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Ganhos Líquidos</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPeriodo)}</p>
                        </div>
                      </div>

                      {/* Resumo do período */}
                      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-slate-50 rounded">
                        <div>
                          <p className="text-xs text-slate-600">Bruto Total</p>
                          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalBruto)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Comissões Bolt</p>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(totalComissoes)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Líquido</p>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(totalPeriodo)}</p>
                        </div>
                      </div>

                      {/* Lista de motoristas */}
                      <div className="space-y-2">
                        {periodo.ganhos.map((ganho, gIdx) => (
                          <div key={gIdx} className="flex items-center justify-between p-3 bg-white border rounded hover:bg-slate-50">
                            <div className="flex-1">
                              <p className="font-medium">{ganho.nome_motorista}</p>
                              <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                                <span>{ganho.email_motorista}</span>
                                {ganho.motorista_id ? (
                                  <span className="text-green-600">✓ Associado</span>
                                ) : (
                                  <span className="text-amber-600">⚠ Não encontrado</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="font-bold text-green-600">{formatCurrency(ganho.ganhos_liquidos)}</p>
                              <p className="text-xs text-slate-500">
                                Bruto: {formatCurrency(ganho.ganhos_brutos_total)}
                              </p>
                              <p className="text-xs text-red-600">
                                Comissão: {formatCurrency(ganho.comissoes)}
                              </p>
                            </div>
                          </div>
                        ))}
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

export default Financeiro;
