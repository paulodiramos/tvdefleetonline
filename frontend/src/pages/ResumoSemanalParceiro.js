import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, RefreshCw, TrendingUp, TrendingDown, Wallet, Car, Users, Send, MessageCircle, Mail, ExternalLink, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ResumoSemanalParceiro = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [semana, setSemana] = useState(getCurrentWeek());
  const [ano, setAno] = useState(new Date().getFullYear());

  function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  }

  const fetchResumo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResumo(response.data);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
      toast.error('Erro ao carregar resumo semanal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumo();
  }, [semana, ano]);

  const handlePreviousWeek = () => {
    if (semana > 1) {
      setSemana(semana - 1);
    } else {
      setSemana(52);
      setAno(ano - 1);
    }
  };

  const handleNextWeek = () => {
    if (semana < 52) {
      setSemana(semana + 1);
    } else {
      setSemana(1);
      setAno(ano + 1);
    }
  };

  const [sendingWhatsapp, setSendingWhatsapp] = useState({});
  const [sendingEmail, setSendingEmail] = useState({});

  const handleEnviarWhatsApp = async (motoristaId, motoristaNome) => {
    setSendingWhatsapp(prev => ({ ...prev, [motoristaId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/relatorios/gerar-link-whatsapp/${motoristaId}?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.whatsapp_link) {
        window.open(response.data.whatsapp_link, '_blank');
        toast.success(`Link WhatsApp gerado para ${motoristaNome}`);
      }
    } catch (error) {
      console.error('Erro ao gerar link WhatsApp:', error);
      toast.error(error.response?.data?.detail || 'Erro ao gerar link WhatsApp');
    } finally {
      setSendingWhatsapp(prev => ({ ...prev, [motoristaId]: false }));
    }
  };

  const handleEnviarEmail = async (motoristaId, motoristaNome) => {
    setSendingEmail(prev => ({ ...prev, [motoristaId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/relatorios/enviar-relatorio/${motoristaId}?semana=${semana}&ano=${ano}&enviar_email=true&enviar_whatsapp=false`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.email?.enviado) {
        toast.success(`Email enviado para ${motoristaNome}`);
      } else {
        toast.error(response.data.email?.mensagem || 'Erro ao enviar email');
      }
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar email');
    } finally {
      setSendingEmail(prev => ({ ...prev, [motoristaId]: false }));
    }
  };

  const handleEnviarTodos = async (tipo) => {
    const enviarEmail = tipo === 'email' || tipo === 'ambos';
    const enviarWhatsapp = tipo === 'whatsapp' || tipo === 'ambos';
    
    toast.info(`A enviar relatórios...`);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/relatorios/enviar-relatorios-em-massa?semana=${semana}&ano=${ano}&enviar_email=${enviarEmail}&enviar_whatsapp=${enviarWhatsapp}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Enviados: ${response.data.emails_enviados} emails, ${response.data.whatsapp_links_gerados} WhatsApp`);
    } catch (error) {
      console.error('Erro ao enviar relatórios:', error);
      toast.error('Erro ao enviar relatórios');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-500">Pago</Badge>;
      case 'aprovado':
        return <Badge className="bg-blue-500">Aprovado</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-500">Pendente</Badge>;
      case 'rascunho':
        return <Badge className="bg-gray-500">Rascunho</Badge>;
      default:
        return <Badge className="bg-gray-300">-</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Resumo Semanal do Parceiro</h1>
          <p className="text-slate-500">Vista consolidada de todos os motoristas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleEnviarTodos('email')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Mail className="w-4 h-4 mr-2" />
            Enviar Emails
          </Button>
          <Button onClick={fetchResumo} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Week Selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Label>Semana:</Label>
              <Input
                type="number"
                min="1"
                max="53"
                value={semana}
                onChange={(e) => setSemana(parseInt(e.target.value) || 1)}
                className="w-20 text-center"
              />
              <Label>Ano:</Label>
              <Input
                type="number"
                min="2020"
                max="2030"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24 text-center"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {resumo && (
            <p className="text-center text-slate-500 mt-2 text-sm">
              {resumo.periodo} • {resumo.motoristas_com_relatorio} de {resumo.total_motoristas} motoristas com relatório
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-600">Total Ganhos</p>
                  <p className="text-2xl font-bold text-green-700">€{resumo.totais.total_ganhos.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-sm text-green-600">
                <span>Uber: €{resumo.totais.total_ganhos_uber.toFixed(2)}</span>
                <span>Bolt: €{resumo.totais.total_ganhos_bolt.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-red-600">Total Despesas</p>
                  <p className="text-2xl font-bold text-red-700">€{resumo.totais.total_despesas.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-red-600">
                <span>Comb: €{resumo.totais.total_combustivel.toFixed(2)}</span>
                <span>Elét: €{resumo.totais.total_eletrico.toFixed(2)}</span>
                <span>VV: €{resumo.totais.total_via_verde.toFixed(2)}</span>
                <span>Alug: €{resumo.totais.total_aluguer.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600">Valor Líquido</p>
                  <p className={`text-2xl font-bold ${resumo.totais.total_liquido >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    €{resumo.totais.total_liquido.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-purple-600">Motoristas</p>
                  <p className="text-2xl font-bold text-purple-700">{resumo.total_motoristas}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-purple-600">
                {resumo.motoristas_com_relatorio} com relatório
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drivers Table */}
      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Detalhes por Motorista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Motorista</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">Uber</TableHead>
                    <TableHead className="text-right">Bolt</TableHead>
                    <TableHead className="text-right text-green-600">Total Ganhos</TableHead>
                    <TableHead className="text-right">Combustível</TableHead>
                    <TableHead className="text-right">Elétrico</TableHead>
                    <TableHead className="text-right">Via Verde</TableHead>
                    <TableHead className="text-right">Aluguer</TableHead>
                    <TableHead className="text-right text-red-600">Total Despesas</TableHead>
                    <TableHead className="text-right text-blue-600 font-bold">Líquido</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.motoristas.map((m) => (
                    <TableRow key={m.motorista_id} className={!m.tem_relatorio ? 'bg-slate-50 opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{m.motorista_nome}</p>
                          {!m.tem_relatorio && (
                            <p className="text-xs text-orange-500">Sem relatório</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{m.veiculo_matricula || '-'}</TableCell>
                      <TableCell className="text-right">€{m.ganhos_uber.toFixed(2)}</TableCell>
                      <TableCell className="text-right">€{m.ganhos_bolt.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">€{m.total_ganhos.toFixed(2)}</TableCell>
                      <TableCell className="text-right">€{m.combustivel.toFixed(2)}</TableCell>
                      <TableCell className="text-right">€{m.carregamento_eletrico.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span>€{m.via_verde.toFixed(2)}</span>
                          {m.via_verde_semana_referencia && (
                            <span className="text-xs text-blue-500">(ref. {m.via_verde_semana_referencia})</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">€{m.aluguer_veiculo.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">€{m.total_despesas.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${m.valor_liquido >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        €{m.valor_liquido.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(m.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && (!resumo || resumo.motoristas.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Nenhum motorista encontrado para esta semana</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumoSemanalParceiro;
