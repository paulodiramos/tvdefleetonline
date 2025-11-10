import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Download, CheckCircle, Clock, Users, Car } from 'lucide-react';

const Contratos = ({ user, onLogout }) => {
  const [parceiros, setParceiros] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedParceiro) {
      fetchParceiroResources(selectedParceiro);
    }
  }, [selectedParceiro]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch parceiros
      if (user.role === 'admin' || user.role === 'gestao') {
        const parceirosRes = await axios.get(`${API}/parceiros`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setParceiros(parceirosRes.data);
      }

      // Fetch existing contracts
      const contratosRes = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContratos(contratosRes.data);
      
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParceiroResources = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch motoristas do parceiro
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_atribuido === parceiroId);
      setMotoristas(parceiroMotoristas);

      // Fetch vehicles do parceiro
      const vehiclesRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroVehicles = vehiclesRes.data.filter(v => v.parceiro_id === parceiroId);
      setVehicles(parceiroVehicles);
      
    } catch (error) {
      console.error('Error fetching parceiro resources', error);
    }
  };

  const handleGenerateContract = async () => {
    if (!selectedParceiro || !selectedMotorista || !selectedVehicle) {
      setMessage({ type: 'error', text: 'Selecione Parceiro, Motorista e Veículo' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/contratos/gerar`,
        {
          parceiro_id: selectedParceiro,
          motorista_id: selectedMotorista,
          vehicle_id: selectedVehicle
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ 
        type: 'success', 
        text: 'Contrato gerado com sucesso! ID: ' + response.data.contrato_id 
      });
      fetchData();
      
      // Reset selections
      setSelectedMotorista('');
      setSelectedVehicle('');
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao gerar contrato' 
      });
    }
  };

  const handleDownloadContract = async (contratoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contratos/${contratoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contratoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract', error);
      setMessage({ type: 'error', text: 'Erro ao baixar contrato' });
    }
  };

  const handleSignContract = async (contratoId, signerType) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/contratos/${contratoId}/assinar`,
        { signer_type: signerType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: 'Contrato assinado com sucesso!' });
      fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao assinar contrato' 
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendente' },
      'parceiro_assinado': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Parceiro Assinou' },
      'motorista_assinado': { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Motorista Assinou' },
      'completo': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completo' }
    };

    const config = statusConfig[status] || statusConfig['pendente'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  if (loading) return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gestão de Contratos</h1>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Geração de Novo Contrato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Gerar Novo Contrato</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="parceiro">Parceiro *</Label>
              <select
                id="parceiro"
                value={selectedParceiro}
                onChange={(e) => {
                  setSelectedParceiro(e.target.value);
                  setSelectedMotorista('');
                  setSelectedVehicle('');
                }}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Selecione um parceiro</option>
                {parceiros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome_empresa || p.name || p.email}
                  </option>
                ))}
              </select>
            </div>

            {selectedParceiro && (
              <>
                <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <Label htmlFor="vehicle">Veículo *</Label>
                    <select
                      id="vehicle"
                      value={selectedVehicle}
                      onChange={(e) => setSelectedVehicle(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.matricula} - {v.marca} {v.modelo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button onClick={handleGenerateContract}>
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar Contrato
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Lista de Contratos */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos Existentes</CardTitle>
          </CardHeader>
          <CardContent>
            {contratos.length > 0 ? (
              <div className="space-y-4">
                {contratos.map((contrato) => (
                  <div key={contrato.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-semibold text-sm text-slate-500">Contrato ID</p>
                          <p className="font-mono text-sm">{contrato.id.slice(0, 8)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-500">Data Criação</p>
                          <p className="text-sm">{new Date(contrato.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      {getStatusBadge(contrato.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          Parceiro
                        </p>
                        <p className="font-medium">{contrato.parceiro_nome}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Motorista</p>
                        <p className="font-medium">{contrato.motorista_nome}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 flex items-center">
                          <Car className="w-4 h-4 mr-1" />
                          Veículo
                        </p>
                        <p className="font-medium">{contrato.vehicle_matricula}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadContract(contrato.id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>

                      {contrato.status !== 'completo' && user.role === 'parceiro' && !contrato.parceiro_assinado && (
                        <Button
                          size="sm"
                          onClick={() => handleSignContract(contrato.id, 'parceiro')}
                        >
                          Assinar como Parceiro
                        </Button>
                      )}

                      {contrato.status !== 'completo' && user.role === 'motorista' && !contrato.motorista_assinado && (
                        <Button
                          size="sm"
                          onClick={() => handleSignContract(contrato.id, 'motorista')}
                        >
                          Assinar como Motorista
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">Nenhum contrato gerado ainda</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Contratos;
