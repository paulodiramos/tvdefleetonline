import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { FileText, CheckCircle, Upload, Eye, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VerificarRecibos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingRecibo, setUploadingRecibo] = useState(null);
  const [reciboUrl, setReciboUrl] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    fetchRelatorios();
  }, []);

  const fetchRelatorios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/para-verificar`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRelatorios(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarRecibo = async (relatorioId) => {
    if (!reciboUrl) {
      toast.error('Por favor, insira o URL do recibo');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/relatorios/semanal/${relatorioId}/verificar-recibo`,
        {
          recibo_url: reciboUrl,
          observacoes: observacoes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Recibo verificado com sucesso!');
      setUploadingRecibo(null);
      setReciboUrl('');
      setObservacoes('');
      fetchRelatorios();
    } catch (error) {
      console.error('Erro ao verificar recibo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao verificar recibo');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

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
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-orange-600" />
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Verificar Recibos
                </h1>
                <p className="text-slate-600">
                  Relatórios enviados aguardando verificação de recibo
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-orange-600">{relatorios.length}</p>
              <p className="text-sm text-slate-600">Pendentes</p>
            </div>
          </div>
        </div>

        {/* Lista de Relatórios */}
        {relatorios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
              <p className="text-slate-600">
                Não há relatórios aguardando verificação de recibo
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {relatorios.map((relatorio) => (
              <Card key={relatorio.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Info do Relatório */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">
                            {relatorio.motorista_nome}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {relatorio.numero_relatorio}
                          </p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-700">
                          Aguardando Recibo
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Período:</span>
                          <span className="font-semibold">
                            Semana {relatorio.semana}/{relatorio.ano}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Datas:</span>
                          <span className="font-semibold">
                            {new Date(relatorio.data_inicio).toLocaleDateString('pt-PT')} - {new Date(relatorio.data_fim).toLocaleDateString('pt-PT')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Veículo:</span>
                          <span className="font-semibold">
                            {relatorio.veiculo_marca} {relatorio.veiculo_modelo} ({relatorio.veiculo_matricula})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-semibold">{relatorio.motorista_email}</span>
                        </div>
                        {relatorio.motorista_telefone && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Telefone:</span>
                            <span className="font-semibold">{relatorio.motorista_telefone}</span>
                          </div>
                        )}
                      </div>

                      {/* Histórico de Envios */}
                      {relatorio.historico_envios && relatorio.historico_envios.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs font-semibold text-blue-800 mb-2">Histórico de Envios:</p>
                          {relatorio.historico_envios.map((envio, idx) => (
                            <div key={idx} className="text-xs text-blue-700">
                              <Send className="w-3 h-3 inline mr-1" />
                              Enviado por {envio.metodo} em {new Date(envio.data_envio).toLocaleString('pt-PT')}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Valores */}
                    <div className="border-l pl-6">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Valores</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Viagens:</span>
                          <span className="font-bold">{relatorio.viagens_totais}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Ganhos:</span>
                          <span className="font-bold text-green-600">€{relatorio.ganhos_totais?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Despesas:</span>
                          <span className="font-bold text-red-600">€{relatorio.total_despesas?.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between items-center">
                          <span className="text-sm font-semibold">Total:</span>
                          <span className="text-lg font-bold text-blue-600">
                            €{relatorio.total_recibo?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(relatorio.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver PDF
                      </Button>

                      {uploadingRecibo === relatorio.id ? (
                        <div className="space-y-2">
                          <Label className="text-xs">URL do Recibo *</Label>
                          <Input
                            placeholder="https://..."
                            value={reciboUrl}
                            onChange={(e) => setReciboUrl(e.target.value)}
                            className="text-sm"
                          />
                          <Label className="text-xs">Observações</Label>
                          <Input
                            placeholder="Opcional"
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            className="text-sm"
                          />
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerificarRecibo(relatorio.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setUploadingRecibo(null);
                                setReciboUrl('');
                                setObservacoes('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setUploadingRecibo(relatorio.id)}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Adicionar Recibo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificarRecibos;
