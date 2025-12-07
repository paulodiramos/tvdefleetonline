import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Users, Car, Save, ArrowLeft, FileText, BarChart3, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardParceiroTab from '@/components/DashboardParceiroTab';
import ContratosParceiroTab from '@/components/ContratosParceiroTab';

const EditParceiro = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [parceiroData, setParceiroData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchParceiros();
  }, []);

  useEffect(() => {
    if (selectedParceiro) {
      fetchParceiroDetails(selectedParceiro);
    }
  }, [selectedParceiro]);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros', error);
    }
  };

  const fetchParceiroDetails = async (parceiroId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get parceiro data
      const parceiroRes = await axios.get(`${API}/parceiros/${parceiroId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiroData(parceiroRes.data);

      // Get vehicles
      const vehiclesRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroVehicles = vehiclesRes.data.filter(v => v.parceiro_id === parceiroId);
      setVehicles(parceiroVehicles);

      // Get motoristas
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_atribuido === parceiroId);
      setMotoristas(parceiroMotoristas);

    } catch (error) {
      console.error('Error fetching parceiro details', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParceiro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/parceiros/${selectedParceiro}`,
        parceiroData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessage({ type: 'success', text: 'Parceiro atualizado com sucesso!' });
      fetchParceiros();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao atualizar parceiro' 
      });
    }
  };

  const handleDeleteParceiro = async () => {
    if (!selectedParceiro) return;

    const parceiro = parceiros.find(p => p.id === selectedParceiro);
    const parceiroName = parceiro?.nome_empresa || parceiro?.name || 'este parceiro';

    if (!window.confirm(
      `⚠️ ATENÇÃO: Tem certeza que deseja ELIMINAR o parceiro "${parceiroName}"?\n\n` +
      `Esta ação irá:\n` +
      `• Remover permanentemente o parceiro\n` +
      `• Desassociar todos os veículos e motoristas\n` +
      `• Esta ação NÃO pode ser desfeita!\n\n` +
      `Digite "ELIMINAR" para confirmar.`
    )) {
      return;
    }

    const confirmation = window.prompt('Digite "ELIMINAR" para confirmar a exclusão:');
    if (confirmation !== 'ELIMINAR') {
      setMessage({ type: 'error', text: 'Eliminação cancelada. Confirmação incorreta.' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/parceiros/${selectedParceiro}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: `Parceiro "${parceiroName}" eliminado com sucesso!` });
      setSelectedParceiro(null);
      setParceiroData(null);
      fetchParceiros();
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/parceiros');
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Erro ao eliminar parceiro'
      });
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header com botão Voltar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/parceiros')}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold">Editar Parceiro</h1>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Seletor de Parceiro */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Parceiro</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={selectedParceiro || ''}
              onChange={(e) => setSelectedParceiro(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">-- Selecione um Parceiro --</option>
              {parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome_empresa || p.name || p.email}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {parceiroData && !loading && (
          <>
            {/* Dados do Parceiro */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="w-5 h-5" />
                  <span>Dados da Empresa</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateParceiro} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                      <Input
                        id="nome_empresa"
                        value={parceiroData.nome_empresa || ''}
                        onChange={(e) => setParceiroData({...parceiroData, nome_empresa: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contribuinte_empresa">NIF da Empresa *</Label>
                      <Input
                        id="contribuinte_empresa"
                        value={parceiroData.contribuinte_empresa || ''}
                        onChange={(e) => setParceiroData({...parceiroData, contribuinte_empresa: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="morada_completa">Morada Completa *</Label>
                    <Input
                      id="morada_completa"
                      value={parceiroData.morada_completa || ''}
                      onChange={(e) => setParceiroData({...parceiroData, morada_completa: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="codigo_postal">Código Postal *</Label>
                      <Input
                        id="codigo_postal"
                        value={parceiroData.codigo_postal || ''}
                        onChange={(e) => setParceiroData({...parceiroData, codigo_postal: e.target.value})}
                        placeholder="1000-100"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="localidade">Localidade *</Label>
                      <Input
                        id="localidade"
                        value={parceiroData.localidade || ''}
                        onChange={(e) => setParceiroData({...parceiroData, localidade: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="nome_manager">Nome do Manager *</Label>
                    <Input
                      id="nome_manager"
                      value={parceiroData.nome_manager || ''}
                      onChange={(e) => setParceiroData({...parceiroData, nome_manager: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email_manager">Email do Manager *</Label>
                      <Input
                        id="email_manager"
                        type="email"
                        value={parceiroData.email_manager || ''}
                        onChange={(e) => setParceiroData({...parceiroData, email_manager: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email_empresa">Email da Empresa *</Label>
                      <Input
                        id="email_empresa"
                        type="email"
                        value={parceiroData.email_empresa || ''}
                        onChange={(e) => setParceiroData({...parceiroData, email_empresa: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        value={parceiroData.telefone || ''}
                        onChange={(e) => setParceiroData({...parceiroData, telefone: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="telemovel">Telemóvel *</Label>
                      <Input
                        id="telemovel"
                        value={parceiroData.telemovel || ''}
                        onChange={(e) => setParceiroData({...parceiroData, telemovel: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="certidao_permanente">Certidão Permanente *</Label>
                      <Input
                        id="certidao_permanente"
                        value={parceiroData.certidao_permanente || ''}
                        onChange={(e) => setParceiroData({...parceiroData, certidao_permanente: e.target.value})}
                        placeholder="xxxx-xxxx-xxxx"
                        maxLength="14"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="codigo_certidao_comercial">Código Certidão Comercial *</Label>
                      <Input
                        id="codigo_certidao_comercial"
                        value={parceiroData.codigo_certidao_comercial || ''}
                        onChange={(e) => setParceiroData({...parceiroData, codigo_certidao_comercial: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="validade_certidao_comercial">Validade Certidão *</Label>
                    <Input
                      id="validade_certidao_comercial"
                      type="date"
                      value={parceiroData.validade_certidao_comercial || ''}
                      onChange={(e) => setParceiroData({...parceiroData, validade_certidao_comercial: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="seguro_responsabilidade_civil">Seguro Resp. Civil</Label>
                      <Input
                        id="seguro_responsabilidade_civil"
                        value={parceiroData.seguro_responsabilidade_civil || ''}
                        onChange={(e) => setParceiroData({...parceiroData, seguro_responsabilidade_civil: e.target.value})}
                        placeholder="Número da apólice"
                      />
                    </div>
                    <div>
                      <Label htmlFor="seguro_acidentes_trabalho">Seguro Acid. Trabalho</Label>
                      <Input
                        id="seguro_acidentes_trabalho"
                        value={parceiroData.seguro_acidentes_trabalho || ''}
                        onChange={(e) => setParceiroData({...parceiroData, seguro_acidentes_trabalho: e.target.value})}
                        placeholder="Número da apólice"
                      />
                    </div>
                    <div>
                      <Label htmlFor="licenca_tvde">Licença TVDE</Label>
                      <Input
                        id="licenca_tvde"
                        value={parceiroData.licenca_tvde || ''}
                        onChange={(e) => setParceiroData({...parceiroData, licenca_tvde: e.target.value})}
                        placeholder="Número da licença"
                      />
                    </div>
                  </div>

                  <Button type="submit">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Alterações
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Configurações de Alertas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Configurações de Alertas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateParceiro} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="dias_aviso_seguro">Dias de Aviso - Seguro</Label>
                      <Input
                        id="dias_aviso_seguro"
                        type="number"
                        value={parceiroData.dias_aviso_seguro || 30}
                        onChange={(e) => setParceiroData({...parceiroData, dias_aviso_seguro: parseInt(e.target.value) || 30})}
                        placeholder="Ex: 30"
                      />
                      <p className="text-xs text-slate-500 mt-1">Alertar X dias antes do vencimento</p>
                    </div>
                    <div>
                      <Label htmlFor="dias_aviso_inspecao">Dias de Aviso - Inspeção</Label>
                      <Input
                        id="dias_aviso_inspecao"
                        type="number"
                        value={parceiroData.dias_aviso_inspecao || 30}
                        onChange={(e) => setParceiroData({...parceiroData, dias_aviso_inspecao: parseInt(e.target.value) || 30})}
                        placeholder="Ex: 30"
                      />
                      <p className="text-xs text-slate-500 mt-1">Alertar X dias antes da inspeção</p>
                    </div>
                    <div>
                      <Label htmlFor="km_aviso_revisao">KM de Aviso - Revisão</Label>
                      <Input
                        id="km_aviso_revisao"
                        type="number"
                        value={parceiroData.km_aviso_revisao || 5000}
                        onChange={(e) => setParceiroData({...parceiroData, km_aviso_revisao: parseInt(e.target.value) || 5000})}
                        placeholder="Ex: 5000"
                      />
                      <p className="text-xs text-slate-500 mt-1">Alertar X km antes da revisão</p>
                    </div>
                  </div>
                  <Button type="submit">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configurações
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Dashboard do Parceiro */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Dashboard - Alertas e Resumo</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardParceiroTab parceiroId={selectedParceiro} />
              </CardContent>
            </Card>

            {/* Veículos Associados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Veículos ({vehicles.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vehicles.length > 0 ? (
                  <div className="space-y-2">
                    {vehicles.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold">{v.matricula}</p>
                          <p className="text-sm text-slate-600">{v.marca} {v.modelo}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/vehicles`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">Nenhum veículo associado</p>
                )}
              </CardContent>
            </Card>

            {/* Contratos do Parceiro */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Contrato e Tipos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ContratosParceiroTab 
                  parceiroId={selectedParceiro} 
                  parceiroData={parceiroData}
                  onUpdate={() => fetchParceiroDetails(selectedParceiro)}
                  userRole={user?.role}
                />
              </CardContent>
            </Card>

            {/* Motoristas Associados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Motoristas ({motoristas.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {motoristas.length > 0 ? (
                  <div className="space-y-2">
                    {motoristas.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold">{m.name}</p>
                          <p className="text-sm text-slate-600">{m.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/motoristas`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">Nenhum motorista associado</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default EditParceiro;
