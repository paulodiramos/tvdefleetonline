import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Car, Upload, Download, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const ImportarMotoristasVeiculos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [motoristasFile, setMotoristasFile] = useState(null);
  const [veiculosFile, setVeiculosFile] = useState(null);
  const [motoristasResult, setMotoristasResult] = useState(null);
  const [veiculosResult, setVeiculosResult] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleDownloadExample = async (tipo) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros/csv-examples/${tipo}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exemplo_${tipo}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Exemplo de ${tipo} descarregado com sucesso`);
    } catch (error) {
      console.error('Erro ao descarregar exemplo:', error);
      toast.error('Erro ao descarregar exemplo CSV');
    }
  };

  const handleImportMotoristas = async () => {
    if (!motoristasFile) {
      toast.error('Por favor selecione um ficheiro');
      return;
    }

    setLoading(true);
    setMotoristasResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', motoristasFile);

      let parceiro_id = user.id;
      
      const response = await axios.post(
        `${API}/parceiros/${parceiro_id}/importar-motoristas`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMotoristasResult({
        success: true,
        data: response.data
      });

      toast.success(`${response.data.motoristas_criados} motoristas importados com sucesso!`);
      
      if (response.data.erros && response.data.erros.length > 0) {
        toast.warning(`${response.data.erros.length} erros encontrados. Verifique os detalhes abaixo.`);
      }

      setMotoristasFile(null);
      document.getElementById('motoristas-file-input').value = '';
    } catch (error) {
      console.error('Erro ao importar motoristas:', error);
      setMotoristasResult({
        success: false,
        error: error.response?.data?.detail || error.message
      });
      toast.error('Erro ao importar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleImportVeiculos = async () => {
    if (!veiculosFile) {
      toast.error('Por favor selecione um ficheiro');
      return;
    }

    setLoading(true);
    setVeiculosResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', veiculosFile);

      let parceiro_id = user.id;

      const response = await axios.post(
        `${API}/parceiros/${parceiro_id}/importar-veiculos-csv`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setVeiculosResult({
        success: true,
        data: response.data
      });

      toast.success(`${response.data.veiculos_criados} veículos importados com sucesso!`);
      
      if (response.data.erros && response.data.erros.length > 0) {
        toast.warning(`${response.data.erros.length} erros encontrados. Verifique os detalhes abaixo.`);
      }

      setVeiculosFile(null);
      document.getElementById('veiculos-file-input').value = '';
    } catch (error) {
      console.error('Erro ao importar veículos:', error);
      setVeiculosResult({
        success: false,
        error: error.response?.data?.detail || error.message
      });
      toast.error('Erro ao importar veículos');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} onLogout={handleLogout}>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Importar Motoristas & Veículos</h1>
          <p className="text-slate-600">
            Importe motoristas e veículos em massa através de ficheiros CSV
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Importante:</strong> Os dados serão automaticamente associados à sua conta de parceiro.
            Faça o download dos ficheiros de exemplo para ver o formato correto.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Import Motoristas */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Importar Motoristas</CardTitle>
                  <CardDescription>Adicione motoristas em massa via CSV</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Download Example */}
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Ficheiro de Exemplo</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Faça o download do ficheiro CSV de exemplo com o formato correto
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadExample('motoristas')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descarregar Exemplo
                </Button>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Selecionar Ficheiro CSV
                </label>
                <input
                  id="motoristas-file-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setMotoristasFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {motoristasFile && (
                  <p className="text-xs text-slate-500">
                    Ficheiro selecionado: {motoristasFile.name}
                  </p>
                )}
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImportMotoristas}
                disabled={!motoristasFile || loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'A processar...' : 'Importar Motoristas'}
              </Button>

              {/* Result */}
              {motoristasResult && (
                <Alert className={motoristasResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {motoristasResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={motoristasResult.success ? 'text-green-800' : 'text-red-800'}>
                    {motoristasResult.success ? (
                      <div>
                        <p className="font-medium">Importação concluída!</p>
                        <p className="text-sm mt-1">
                          {motoristasResult.data.motoristas_criados} motoristas criados
                        </p>
                        {motoristasResult.data.erros && motoristasResult.data.erros.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm cursor-pointer">
                              {motoristasResult.data.erros.length} erros encontrados (clique para ver)
                            </summary>
                            <ul className="text-xs mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {motoristasResult.data.erros.map((erro, idx) => (
                                <li key={idx} className="text-red-700">• {erro}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Erro na importação</p>
                        <p className="text-sm mt-1">{motoristasResult.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Import Veículos */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Car className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Importar Veículos</CardTitle>
                  <CardDescription>Adicione veículos em massa via CSV</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Download Example */}
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Ficheiro de Exemplo</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Faça o download do ficheiro CSV de exemplo com o formato correto
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadExample('veiculos')}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descarregar Exemplo
                </Button>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Selecionar Ficheiro CSV
                </label>
                <input
                  id="veiculos-file-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setVeiculosFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {veiculosFile && (
                  <p className="text-xs text-slate-500">
                    Ficheiro selecionado: {veiculosFile.name}
                  </p>
                )}
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImportVeiculos}
                disabled={!veiculosFile || loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'A processar...' : 'Importar Veículos'}
              </Button>

              {/* Result */}
              {veiculosResult && (
                <Alert className={veiculosResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {veiculosResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={veiculosResult.success ? 'text-green-800' : 'text-red-800'}>
                    {veiculosResult.success ? (
                      <div>
                        <p className="font-medium">Importação concluída!</p>
                        <p className="text-sm mt-1">
                          {veiculosResult.data.veiculos_criados} veículos criados
                        </p>
                        {veiculosResult.data.erros && veiculosResult.data.erros.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm cursor-pointer">
                              {veiculosResult.data.erros.length} erros encontrados (clique para ver)
                            </summary>
                            <ul className="text-xs mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {veiculosResult.data.erros.map((erro, idx) => (
                                <li key={idx} className="text-red-700">• {erro}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Erro na importação</p>
                        <p className="text-sm mt-1">{veiculosResult.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Como Importar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <h4 className="font-medium text-slate-900 mb-2">📥 Passo 1: Descarregar Exemplo</h4>
                <p>Faça o download do ficheiro CSV de exemplo para ver o formato correto e as colunas necessárias. O ficheiro já inclui o seu ID de parceiro no topo.</p>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">✏️ Passo 2: Preencher Dados</h4>
                <p>Edite o ficheiro CSV com os dados dos seus motoristas ou veículos. Mantenha o formato das colunas e não remova os headers.</p>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">📤 Passo 3: Importar</h4>
                <p>Selecione o ficheiro CSV preenchido e clique em "Importar". Os dados serão automaticamente associados à sua conta.</p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  <strong>Nota:</strong> Motoristas importados receberão login com o email fornecido e senha provisória igual aos últimos 9 dígitos do telefone.
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800">
                  <strong>Dica:</strong> A coluna "Localidade" está incluída nos ficheiros de exemplo para indicar a localização dos motoristas e veículos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportarMotoristasVeiculos;
