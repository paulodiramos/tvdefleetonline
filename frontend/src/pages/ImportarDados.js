import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  History,
  Car,
  CreditCard,
  MapPin,
  Fuel
} from 'lucide-react';

const ImportarDados = ({ user, onLogout }) => {
  const [plataforma, setPlataforma] = useState('bolt');
  const [parceiros, setParceiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [parceiroSelecionado, setParceiroSelecionado] = useState(null);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [historico, setHistorico] = useState([]);

  const plataformas = [
    { value: 'bolt', label: 'Bolt', icon: Car, color: 'bg-green-100 text-green-800' },
    { value: 'uber', label: 'Uber', icon: Car, color: 'bg-black text-white' },
    { value: 'via_verde', label: 'Via Verde', icon: CreditCard, color: 'bg-blue-100 text-blue-800' },
    { value: 'gps', label: 'GPS', icon: MapPin, color: 'bg-purple-100 text-purple-800' },
    { value: 'combustivel', label: 'Combustível', icon: Fuel, color: 'bg-orange-100 text-orange-800' }
  ];

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'gestao') {
      fetchParceiros();
    }
    fetchHistorico();
  }, []);

  useEffect(() => {
    if (parceiroSelecionado) {
      fetchMotoristas(parceiroSelecionado);
    }
  }, [parceiroSelecionado]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
    }
  };

  const fetchMotoristas = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas?parceiro_id=${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristas(response.data);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/import-csv/history?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        toast.error('Por favor, selecione um ficheiro CSV ou Excel');
        return;
      }
      setArquivo(file);
    }
  };

  const handleUpload = async () => {
    if (!arquivo) {
      toast.error('Selecione um ficheiro para importar');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('file', arquivo);
      if (parceiroSelecionado) formData.append('parceiro_id', parceiroSelecionado);
      if (motoristaSelecionado) formData.append('motorista_id', motoristaSelecionado);

      const response = await axios.post(
        `${API}/import-csv/${plataforma}`,
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
        setArquivo(null);
        // Reset file input
        document.getElementById('file-input').value = '';
        fetchHistorico();
      } else {
        toast.error(response.data.message || 'Erro ao importar ficheiro');
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.detail || 'Erro ao importar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const getPlataformaInfo = (valor) => {
    return plataformas.find(p => p.value === valor) || plataformas[0];
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Importar Dados</h1>
            <p className="text-slate-600 mt-1">
              Upload manual de ficheiros CSV das plataformas
            </p>
          </div>
          <Upload className="w-8 h-8 text-blue-600" />
        </div>

        {/* Formulário de Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Upload de Ficheiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seleção de Plataforma */}
            <div>
              <Label>Plataforma</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                {plataformas.map((plat) => {
                  const Icon = plat.icon;
                  return (
                    <button
                      key={plat.value}
                      onClick={() => setPlataforma(plat.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        plataforma === plat.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">{plat.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seleção de Parceiro (apenas admin/gestao) */}
            {(user.role === 'admin' || user.role === 'gestao') && (
              <div>
                <Label>Parceiro (Opcional)</Label>
                <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {parceiros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_empresa || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seleção de Motorista */}
            {parceiroSelecionado && motoristas.length > 0 && (
              <div>
                <Label>Motorista (Opcional)</Label>
                <Select value={motoristaSelecionado} onValueChange={setMotoristaSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {motoristas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Upload de Ficheiro */}
            <div>
              <Label>Ficheiro CSV</Label>
              <div className="mt-2">
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-input"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  {arquivo ? (
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                      <p className="font-medium text-slate-900">{arquivo.name}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {(arquivo.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                      <p className="font-medium text-slate-600">Clique para selecionar ficheiro</p>
                      <p className="text-sm text-slate-500 mt-1">CSV, XLS ou XLSX</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Botão de Upload */}
            <Button
              onClick={handleUpload}
              disabled={!arquivo || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  A importar...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Dados
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Histórico de Importações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Importações
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600">Nenhuma importação realizada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historico.map((log) => {
                  const plat = getPlataformaInfo(log.plataforma);
                  const Icon = plat.icon;
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${plat.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{log.ficheiro}</p>
                          <p className="text-sm text-slate-500">
                            {new Date(log.data).toLocaleString('pt-PT')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {log.registos_salvos} registos
                        </Badge>
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

export default ImportarDados;
