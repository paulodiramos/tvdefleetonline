import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Fuel, CreditCard, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GerarRelatorioSemanal = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [semana, setSemana] = useState(1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [extras, setExtras] = useState(0);
  const [loading, setLoading] = useState(false);
  const [relatorioGerado, setRelatorioGerado] = useState(null);
  const [relatoriosAnteriores, setRelatoriosAnteriores] = useState([]);

  useEffect(() => {
    fetchMotoristas();
  }, []);

  useEffect(() => {
    if (motoristaSelecionado) {
      fetchRelatoriosAnteriores(motoristaSelecionado);
    }
  }, [motoristaSelecionado]);

  const fetchMotoristas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/motoristas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Filter only motoristas with parceiro_atribuido = current user
      const meusParceiros = response.data.filter(
        m => m.parceiro_atribuido === user.id
      );
      setMotoristas(meusParceiros);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    }
  };

  const fetchRelatoriosAnteriores = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/motorista/${motoristaId}/semanais`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRelatoriosAnteriores(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios anteriores:', error);
    }
  };

  const handleGerarRelatorio = async () => {
    if (!motoristaSelecionado || !dataInicio || !dataFim) {
      toast.error('Por favor preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/relatorios/motorista/${motoristaSelecionado}/gerar-semanal`,
        {
          data_inicio: dataInicio,
          data_fim: dataFim,
          semana: parseInt(semana),
          ano: parseInt(ano),
          extras: parseFloat(extras) || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message);
      setRelatorioGerado(response.data);
      
      // Fetch detailed relatorio
      const detailsResponse = await axios.get(
        `${API_URL}/api/relatorios/semanal/${response.data.relatorio_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRelatorioGerado(detailsResponse.data);
      
      // Refresh list
      fetchRelatoriosAnteriores(motoristaSelecionado);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error(error.response?.data?.detail || 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (relatorioId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/semanal/${relatorioId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${relatorioId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      toast.error('Erro ao baixar PDF');
    }
  };

  const getWeekOfYear = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  };

  useEffect(() => {
    if (dataInicio) {
      const week = getWeekOfYear(dataInicio);
      setSemana(week);
      
      // Calculate end date (7 days after start)
      const start = new Date(dataInicio);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setDataFim(end.toISOString().split('T')[0]);
    }
  }, [dataInicio]);

  const motoristaSel = motoristas.find(m => m.id === motoristaSelecionado);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Gerar Relatório Semanal
              </h1>
              <p className="text-slate-600">
                Crie relatórios personalizados para os seus motoristas
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados do Relatório</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Motorista */}
                <div>
                  <Label>Motorista *</Label>
                  <Select value={motoristaSelecionado} onValueChange={setMotoristaSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} - {m.veiculo_atribuido ? 'Com veículo' : 'Sem veículo'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Data Início */}
                  <div>
                    <Label>Data de Início *</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>

                  {/* Data Fim */}
                  <div>
                    <Label>Data de Fim *</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Semana */}
                  <div>
                    <Label>Semana do Ano</Label>
                    <Input
                      type="number"
                      value={semana}
                      onChange={(e) => setSemana(e.target.value)}
                      min="1"
                      max="53"
                    />
                  </div>

                  {/* Ano */}
                  <div>
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={ano}
                      onChange={(e) => setAno(e.target.value)}
                      min="2020"
                      max="2099"
                    />
                  </div>
                </div>

                {/* Extras */}
                <div>
                  <Label>Extras (Créditos/Débitos)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={extras}
                    onChange={(e) => setExtras(e.target.value)}
                    placeholder="Positivo = Crédito, Negativo = Débito"
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Valor positivo = crédito ao motorista, negativo = débito
                  </p>
                </div>

                <Button
                  onClick={handleGerarRelatorio}
                  disabled={loading || !motoristaSelecionado || !dataInicio || !dataFim}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'A gerar...' : 'Gerar Relatório'}
                </Button>
              </CardContent>
            </Card>

            {/* Relatório Gerado */}
            {relatorioGerado && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Relatório Gerado - {relatorioGerado.numero_relatorio}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Motorista</p>
                        <p className="font-semibold">{relatorioGerado.motorista_nome}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Veículo</p>
                        <p className="font-semibold">
                          {relatorioGerado.veiculo_marca} {relatorioGerado.veiculo_modelo} ({relatorioGerado.veiculo_matricula})
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Período</p>
                        <p className="font-semibold">
                          Semana {relatorioGerado.semana}/{relatorioGerado.ano}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Total Viagens</p>
                        <p className="font-semibold">{relatorioGerado.viagens_totais}</p>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-green-100 rounded">
                          <p className="text-xs text-slate-600">Ganhos</p>
                          <p className="text-xl font-bold text-green-700">
                            €{relatorioGerado.ganhos_totais?.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-red-100 rounded">
                          <p className="text-xs text-slate-600">Despesas</p>
                          <p className="text-xl font-bold text-red-700">
                            €{relatorioGerado.total_despesas?.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-blue-100 rounded">
                          <p className="text-xs text-slate-600">Total Recibo</p>
                          <p className="text-xl font-bold text-blue-700">
                            €{relatorioGerado.total_recibo?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleDownloadPDF(relatorioGerado.id)}
                      className="w-full"
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Relatórios Anteriores */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Relatórios Anteriores</CardTitle>
              </CardHeader>
              <CardContent>
                {!motoristaSelecionado ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Selecione um motorista para ver relatórios anteriores
                  </p>
                ) : relatoriosAnteriores.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Nenhum relatório anterior encontrado
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {relatoriosAnteriores.map((rel) => (
                      <div
                        key={rel.id}
                        className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => setRelatorioGerado(rel)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm">{rel.numero_relatorio}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPDF(rel.id);
                            }}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600">
                          Semana {rel.semana}/{rel.ano}
                        </p>
                        <p className="text-xs text-slate-600">
                          {new Date(rel.data_inicio).toLocaleDateString('pt-PT')} - {new Date(rel.data_fim).toLocaleDateString('pt-PT')}
                        </p>
                        <p className="text-sm font-semibold text-blue-600 mt-1">
                          €{rel.total_recibo?.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info sobre motorista selecionado */}
            {motoristaSel && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Informações do Motorista</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-slate-600">Nome</p>
                    <p className="font-semibold">{motoristaSel.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Email</p>
                    <p className="font-semibold">{motoristaSel.email}</p>
                  </div>
                  {motoristaSel.veiculo_atribuido && (
                    <div>
                      <p className="text-slate-600">Veículo Atribuído</p>
                      <p className="font-semibold text-green-600">Sim</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GerarRelatorioSemanal;
