import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, ClipboardCheck, Wrench, AlertTriangle } from 'lucide-react';

const VehicleData = ({ user, onLogout }) => {
  const [vehicles, setVehicles] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedParceiro, setSelectedParceiro] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('seguro');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    // Seguro
    seguro_companhia: '',
    seguro_apolice: '',
    seguro_data_inicio: '',
    seguro_data_fim: '',
    seguro_valor: '',
    seguro_periodicidade: 'anual',
    
    // Inspeção
    inspecao_data: '',
    inspecao_proxima: '',
    inspecao_resultado: 'aprovado',
    inspecao_valor: '',
    
    // Manutenção
    manutencao_tipo: '',
    manutencao_descricao: '',
    manutencao_data: '',
    manutencao_valor: '',
    manutencao_km: '',
    manutencao_proxima_revisao_km: '',
    manutencao_tempo_proxima_revisao: '',
    
    // Danos
    dano_tipo: '',
    dano_descricao: '',
    dano_data: '',
    dano_valor_reparacao: '',
    dano_estado: 'pendente',
    dano_data_previsao_reparacao: '',
    dano_responsavel: 'fleet'
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedParceiro) {
      fetchVehiclesByParceiro(selectedParceiro);
    }
  }, [selectedParceiro]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Admin e Gestor veem todos os parceiros
      if (user.role === 'admin' || user.role === 'gestao') {
        const parceirosRes = await axios.get(`${API}/parceiros`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setParceiros(parceirosRes.data);
      }
      
      // Operacional vê apenas seus veículos
      if (user.role === 'operacional') {
        const vehiclesRes = await axios.get(`${API}/vehicles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filtrar apenas veículos do operacional
        const myVehicles = vehiclesRes.data.filter(v => v.parceiro_id === user.id);
        setVehicles(myVehicles);
      }
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehiclesByParceiro = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filtered = response.data.filter(v => v.parceiro_id === parceiroId);
      setVehicles(filtered);
    } catch (error) {
      console.error('Error fetching vehicles', error);
    }
  };

  const handleSubmitSeguro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${selectedVehicle}`, {
        insurance: {
          companhia: formData.seguro_companhia,
          numero_apolice: formData.seguro_apolice,
          data_inicio: formData.seguro_data_inicio,
          data_validade: formData.seguro_data_fim,
          valor_anual: parseFloat(formData.seguro_valor)
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: 'Seguro atualizado com sucesso!' });
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Erro ao atualizar seguro' });
    }
  };

  const handleSubmitInspecao = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${selectedVehicle}`, {
        inspection: {
          ultima_inspecao: formData.inspecao_data,
          proxima_inspecao: formData.inspecao_proxima,
          resultado: formData.inspecao_resultado,
          valor: parseFloat(formData.inspecao_valor)
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: 'Inspeção registrada com sucesso!' });
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Erro ao registrar inspeção' });
    }
  };

  const handleSubmitManutencao = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Get current vehicle data
      const vehicleRes = await axios.get(`${API}/vehicles/${selectedVehicle}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const currentMaintenance = vehicleRes.data.maintenance_history || [];
      
      const newMaintenance = {
        tipo_manutencao: formData.manutencao_tipo,
        descricao: formData.manutencao_descricao,
        data: formData.manutencao_data,
        valor: parseFloat(formData.manutencao_valor),
        km_realizada: parseInt(formData.manutencao_km)
      };
      
      await axios.put(`${API}/vehicles/${selectedVehicle}`, {
        maintenance_history: [...currentMaintenance, newMaintenance]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: 'Manutenção registrada com sucesso!' });
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Erro ao registrar manutenção' });
    }
  };

  const handleSubmitDano = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Get current vehicle data
      const vehicleRes = await axios.get(`${API}/vehicles/${selectedVehicle}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const currentDanos = vehicleRes.data.danos || [];
      
      const newDano = {
        tipo: formData.dano_tipo,
        descricao: formData.dano_descricao,
        data: formData.dano_data,
        valor_reparacao: parseFloat(formData.dano_valor_reparacao),
        estado: formData.dano_estado
      };
      
      await axios.put(`${API}/vehicles/${selectedVehicle}`, {
        danos: [...currentDanos, newDano]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: 'Dano registrado com sucesso!' });
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Erro ao registrar dano' });
    }
  };

  const resetForm = () => {
    setFormData({
      seguro_companhia: '',
      seguro_apolice: '',
      seguro_data_inicio: '',
      seguro_data_fim: '',
      seguro_valor: '',
      inspecao_data: '',
      inspecao_proxima: '',
      inspecao_resultado: 'aprovado',
      inspecao_valor: '',
      manutencao_tipo: '',
      manutencao_descricao: '',
      manutencao_data: '',
      manutencao_valor: '',
      manutencao_km: '',
      dano_tipo: '',
      dano_descricao: '',
      dano_data: '',
      dano_valor_reparacao: '',
      dano_estado: 'pendente'
    });
  };

  if (loading) return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gestão de Dados de Veículos</h1>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Seleção */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(user.role === 'admin' || user.role === 'gestao') && (
              <div>
                <Label htmlFor="parceiro">Parceiro *</Label>
                <select
                  id="parceiro"
                  value={selectedParceiro}
                  onChange={(e) => {
                    setSelectedParceiro(e.target.value);
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
            )}

            <div>
              <Label htmlFor="vehicle">Veículo (Matrícula) *</Label>
              <select
                id="vehicle"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={!vehicles.length}
              >
                <option value="">Selecione um veículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.matricula} - {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {selectedVehicle && (
          <>
            {/* Tabs */}
            <div className="flex space-x-2 border-b">
              <button
                onClick={() => setActiveTab('seguro')}
                className={`px-4 py-2 font-semibold flex items-center space-x-2 ${
                  activeTab === 'seguro'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Seguro</span>
              </button>
              <button
                onClick={() => setActiveTab('inspecao')}
                className={`px-4 py-2 font-semibold flex items-center space-x-2 ${
                  activeTab === 'inspecao'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Inspeção</span>
              </button>
              <button
                onClick={() => setActiveTab('manutencao')}
                className={`px-4 py-2 font-semibold flex items-center space-x-2 ${
                  activeTab === 'manutencao'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>Manutenção</span>
              </button>
              <button
                onClick={() => setActiveTab('danos')}
                className={`px-4 py-2 font-semibold flex items-center space-x-2 ${
                  activeTab === 'danos'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Danos</span>
              </button>
            </div>

            {/* Seguro Form */}
            {activeTab === 'seguro' && (
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar/Atualizar Seguro</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitSeguro} className="space-y-4">
                    <div>
                      <Label htmlFor="seguro_companhia">Companhia de Seguros *</Label>
                      <Input
                        id="seguro_companhia"
                        value={formData.seguro_companhia}
                        onChange={(e) => setFormData({...formData, seguro_companhia: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="seguro_apolice">Número da Apólice *</Label>
                      <Input
                        id="seguro_apolice"
                        value={formData.seguro_apolice}
                        onChange={(e) => setFormData({...formData, seguro_apolice: e.target.value})}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="seguro_data_inicio">Data Início *</Label>
                        <Input
                          id="seguro_data_inicio"
                          type="date"
                          value={formData.seguro_data_inicio}
                          onChange={(e) => setFormData({...formData, seguro_data_inicio: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="seguro_data_fim">Data Validade *</Label>
                        <Input
                          id="seguro_data_fim"
                          type="date"
                          value={formData.seguro_data_fim}
                          onChange={(e) => setFormData({...formData, seguro_data_fim: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="seguro_valor">Valor Anual (€) *</Label>
                      <Input
                        id="seguro_valor"
                        type="number"
                        step="0.01"
                        value={formData.seguro_valor}
                        onChange={(e) => setFormData({...formData, seguro_valor: e.target.value})}
                        required
                      />
                    </div>
                    <Button type="submit">Guardar Seguro</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Inspeção Form */}
            {activeTab === 'inspecao' && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Inspeção</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitInspecao} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="inspecao_data">Data da Inspeção *</Label>
                        <Input
                          id="inspecao_data"
                          type="date"
                          value={formData.inspecao_data}
                          onChange={(e) => setFormData({...formData, inspecao_data: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="inspecao_proxima">Próxima Inspeção *</Label>
                        <Input
                          id="inspecao_proxima"
                          type="date"
                          value={formData.inspecao_proxima}
                          onChange={(e) => setFormData({...formData, inspecao_proxima: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="inspecao_resultado">Resultado *</Label>
                      <select
                        id="inspecao_resultado"
                        value={formData.inspecao_resultado}
                        onChange={(e) => setFormData({...formData, inspecao_resultado: e.target.value})}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="aprovado">Aprovado</option>
                        <option value="reprovado">Reprovado</option>
                        <option value="condicional">Condicional</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="inspecao_valor">Valor da Inspeção (€) *</Label>
                      <Input
                        id="inspecao_valor"
                        type="number"
                        step="0.01"
                        value={formData.inspecao_valor}
                        onChange={(e) => setFormData({...formData, inspecao_valor: e.target.value})}
                        required
                      />
                    </div>
                    <Button type="submit">Guardar Inspeção</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Manutenção Form */}
            {activeTab === 'manutencao' && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Manutenção</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitManutencao} className="space-y-4">
                    <div>
                      <Label htmlFor="manutencao_tipo">Tipo de Manutenção *</Label>
                      <select
                        id="manutencao_tipo"
                        value={formData.manutencao_tipo}
                        onChange={(e) => setFormData({...formData, manutencao_tipo: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        required
                      >
                        <option value="">Selecione</option>
                        <option value="revisao">Revisão</option>
                        <option value="oleo">Mudança de Óleo</option>
                        <option value="pneus">Pneus</option>
                        <option value="travoes">Travões</option>
                        <option value="filtros">Filtros</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="manutencao_descricao">Descrição *</Label>
                      <textarea
                        id="manutencao_descricao"
                        value={formData.manutencao_descricao}
                        onChange={(e) => setFormData({...formData, manutencao_descricao: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        rows="3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="manutencao_data">Data *</Label>
                        <Input
                          id="manutencao_data"
                          type="date"
                          value={formData.manutencao_data}
                          onChange={(e) => setFormData({...formData, manutencao_data: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="manutencao_km">KM Realizada *</Label>
                        <Input
                          id="manutencao_km"
                          type="number"
                          value={formData.manutencao_km}
                          onChange={(e) => setFormData({...formData, manutencao_km: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="manutencao_valor">Valor (€) *</Label>
                        <Input
                          id="manutencao_valor"
                          type="number"
                          step="0.01"
                          value={formData.manutencao_valor}
                          onChange={(e) => setFormData({...formData, manutencao_valor: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit">Guardar Manutenção</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Danos Form */}
            {activeTab === 'danos' && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Dano</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitDano} className="space-y-4">
                    <div>
                      <Label htmlFor="dano_tipo">Tipo de Dano *</Label>
                      <select
                        id="dano_tipo"
                        value={formData.dano_tipo}
                        onChange={(e) => setFormData({...formData, dano_tipo: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        required
                      >
                        <option value="">Selecione</option>
                        <option value="colisao">Colisão</option>
                        <option value="risco">Risco</option>
                        <option value="vandalismo">Vandalismo</option>
                        <option value="mecanico">Mecânico</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="dano_descricao">Descrição do Dano *</Label>
                      <textarea
                        id="dano_descricao"
                        value={formData.dano_descricao}
                        onChange={(e) => setFormData({...formData, dano_descricao: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        rows="3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="dano_data">Data do Dano *</Label>
                        <Input
                          id="dano_data"
                          type="date"
                          value={formData.dano_data}
                          onChange={(e) => setFormData({...formData, dano_data: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="dano_valor_reparacao">Valor Reparação (€) *</Label>
                        <Input
                          id="dano_valor_reparacao"
                          type="number"
                          step="0.01"
                          value={formData.dano_valor_reparacao}
                          onChange={(e) => setFormData({...formData, dano_valor_reparacao: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="dano_estado">Estado *</Label>
                        <select
                          id="dano_estado"
                          value={formData.dano_estado}
                          onChange={(e) => setFormData({...formData, dano_estado: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_reparacao">Em Reparação</option>
                          <option value="reparado">Reparado</option>
                        </select>
                      </div>
                    </div>
                    <Button type="submit">Guardar Dano</Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default VehicleData;
