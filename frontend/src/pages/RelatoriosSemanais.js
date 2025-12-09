import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Mail, Send, Users, Download } from 'lucide-react';

const RelatoriosSemanais = ({ user, onLogout }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('motorista'); // motorista ou parceiro
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);

  useEffect(() => {
    // Set default dates (last 7 days)
    const hoje = new Date();
    const semanaAtras = new Date(hoje);
    semanaAtras.setDate(hoje.getDate() - 7);
    
    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(semanaAtras.toISOString().split('T')[0]);
    
    fetchUsuarios();
  }, [tipoUsuario]);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let endpoint = '';
      if (tipoUsuario === 'motorista') {
        endpoint = '/motoristas';
      } else {
        endpoint = '/parceiros';
      }
      
      const response = await axios.get(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedUsuario || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/relatorios/gerar-semanal`,
        {
          usuario_id: selectedUsuario,
          tipo_usuario: tipoUsuario,
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${tipoUsuario}_${dataInicio}_${dataFim}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarEmail = async () => {
    if (!selectedUsuario || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setEnviandoEmail(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/relatorios/enviar-email`,
        {
          usuario_id: selectedUsuario,
          tipo_usuario: tipoUsuario,
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Relatório enviado por email com sucesso!');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar email');
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (!selectedUsuario || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setEnviandoWhatsApp(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/relatorios/enviar-whatsapp`,
        {
          usuario_id: selectedUsuario,
          tipo_usuario: tipoUsuario,
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Relatório enviado por WhatsApp com sucesso!');
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar WhatsApp');
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const usuarioSelecionadoObj = usuarios.find(u => u.id === selectedUsuario);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Relatórios Semanais</h1>
          <p className="text-slate-600 mt-1">
            Gerar e enviar relatórios de ganhos e despesas por email ou WhatsApp
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle>Gerar Relatório</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tipo de Utilizador */}
            <div>
              <Label htmlFor="tipo-usuario" className="text-base font-medium">
                Tipo de Utilizador
              </Label>
              <Select value={tipoUsuario} onValueChange={setTipoUsuario}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorista">Motorista</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selecionar Utilizador */}
            <div>
              <Label htmlFor="usuario" className="text-base font-medium">
                Selecionar {tipoUsuario === 'motorista' ? 'Motorista' : 'Parceiro'}
              </Label>
              <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione um utilizador" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome || usuario.name || usuario.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data-inicio" className="text-base font-medium">
                  Data Início
                </Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="data-fim" className="text-base font-medium">
                  Data Fim
                </Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Informações do Utilizador Selecionado */}
            {usuarioSelecionadoObj && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Informações do Utilizador
                </h4>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>
                    <strong>Nome:</strong> {usuarioSelecionadoObj.nome || usuarioSelecionadoObj.name || 'N/A'}
                  </p>
                  <p>
                    <strong>Email:</strong> {usuarioSelecionadoObj.email || 'N/A'}
                  </p>
                  {usuarioSelecionadoObj.telefone && (
                    <p>
                      <strong>Telefone:</strong> {usuarioSelecionadoObj.telefone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                onClick={handleDownloadPDF}
                disabled={loading || !selectedUsuario}
                className="bg-slate-800 hover:bg-slate-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {loading ? 'A gerar...' : 'Descarregar PDF'}
              </Button>
              
              <Button
                onClick={handleEnviarEmail}
                disabled={enviandoEmail || !selectedUsuario}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Mail className="w-4 h-4 mr-2" />
                {enviandoEmail ? 'A enviar...' : 'Enviar por Email'}
              </Button>
              
              <Button
                onClick={handleEnviarWhatsApp}
                disabled={enviandoWhatsApp || !selectedUsuario}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <Send className="w-4 h-4 mr-2" />
                {enviandoWhatsApp ? 'A enviar...' : 'Enviar por WhatsApp'}
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Nota:</strong> O relatório incluirá todos os ganhos e despesas do período selecionado. 
                O envio por WhatsApp requer configuração prévia da integração.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RelatoriosSemanais;
