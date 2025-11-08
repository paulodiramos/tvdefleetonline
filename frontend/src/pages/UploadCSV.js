import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, TrendingUp, Fuel, AlertCircle } from 'lucide-react';

const UploadCSV = ({ user, onLogout }) => {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [parceiroInfo, setParceiroInfo] = useState(null);

  useEffect(() => {
    fetchParceiroInfo();
  }, []);

  const fetchParceiroInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      // Get current user info (parceiro/operacional)
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiroInfo(response.data);
    } catch (error) {
      console.error('Error fetching user info', error);
    }
  };

  const handleUploadUber = async (e) => {
    e.preventDefault();
    if (!selectedMotorista || !periodoInicio || !periodoFim) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' });
      return;
    }

    const fileInput = document.getElementById('uber-csv');
    if (!fileInput.files[0]) {
      setMessage({ type: 'error', text: 'Selecione um arquivo CSV' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('motorista_id', selectedMotorista);
      formData.append('periodo_inicio', periodoInicio);
      formData.append('periodo_fim', periodoFim);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/operacional/upload-csv-uber`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ 
        type: 'success', 
        text: `CSV Uber importado com sucesso! Total: €${response.data.total_pago}` 
      });
      fileInput.value = '';
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao importar CSV Uber' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadBolt = async (e) => {
    e.preventDefault();
    if (!selectedMotorista || !periodoInicio || !periodoFim) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' });
      return;
    }

    const fileInput = document.getElementById('bolt-csv');
    if (!fileInput.files[0]) {
      setMessage({ type: 'error', text: 'Selecione um arquivo CSV' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('motorista_id', selectedMotorista);
      formData.append('periodo_inicio', periodoInicio);
      formData.append('periodo_fim', periodoFim);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/operacional/upload-csv-bolt`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ 
        type: 'success', 
        text: `CSV Bolt importado com sucesso! Ganhos líquidos: €${response.data.ganhos_liquidos}` 
      });
      fileInput.value = '';
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao importar CSV Bolt' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCombustivel = async (e) => {
    e.preventDefault();
    if (!selectedMotorista) {
      setMessage({ type: 'error', text: 'Selecione um motorista' });
      return;
    }

    const fileInput = document.getElementById('combustivel-excel');
    if (!fileInput.files[0]) {
      setMessage({ type: 'error', text: 'Selecione um arquivo Excel' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('motorista_id', selectedMotorista);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/operacional/upload-excel-combustivel`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ 
        type: 'success', 
        text: `Excel importado! ${response.data.transacoes_importadas} transações, Total: €${response.data.total_valor.toFixed(2)}` 
      });
      fileInput.value = '';
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao importar Excel de combustível' 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Upload de CSVs</h1>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Campos comuns */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="motorista">Motorista *</Label>
              <select
                id="motorista"
                value={selectedMotorista}
                onChange={(e) => setSelectedMotorista(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Selecione um motorista</option>
                {motoristas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodo-inicio">Período Início *</Label>
                <Input
                  id="periodo-inicio"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="periodo-fim">Período Fim *</Label>
                <Input
                  id="periodo-fim"
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Uber */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Upload CSV Uber</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadUber} className="space-y-4">
              <div>
                <Label htmlFor="uber-csv">Arquivo CSV Uber</Label>
                <Input
                  id="uber-csv"
                  type="file"
                  accept=".csv"
                  disabled={uploading}
                />
              </div>
              <Button type="submit" disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Enviando...' : 'Upload Uber CSV'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Upload Bolt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Upload CSV Bolt</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadBolt} className="space-y-4">
              <div>
                <Label htmlFor="bolt-csv">Arquivo CSV Bolt</Label>
                <Input
                  id="bolt-csv"
                  type="file"
                  accept=".csv"
                  disabled={uploading}
                />
              </div>
              <Button type="submit" disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Enviando...' : 'Upload Bolt CSV'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Upload Combustível */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Fuel className="w-5 h-5" />
              <span>Upload Excel Combustível (Prio)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadCombustivel} className="space-y-4">
              <div>
                <Label htmlFor="combustivel-excel">Arquivo Excel (.xlsx)</Label>
                <Input
                  id="combustivel-excel"
                  type="file"
                  accept=".xlsx"
                  disabled={uploading}
                />
              </div>
              <Button type="submit" disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Enviando...' : 'Upload Excel Combustível'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UploadCSV;
