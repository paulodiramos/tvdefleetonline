import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  BarChart3,
  Download,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  FileText,
  MessageCircle,
  Mail,
  FileDown
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ResumoSemanalParceiro = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    mostrar_matricula: true,
    mostrar_via_verde: false,
    mostrar_abastecimentos: false,
    mostrar_carregamentos: false
  });
  const [showPdfOptions, setShowPdfOptions] = useState(null); // motorista_id ou null

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    setSemana(currentWeek);
    setAno(now.getFullYear());
  }, []);

  useEffect(() => {
    if (semana && ano) {
      fetchResumo();
      fetchHistorico();
    }
  }, [semana, ano]);

  const fetchResumo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResumo(response.data);
    } catch (error) {
      console.error('Erro ao carregar resumo semanal:', error);
      toast.error('Erro ao carregar resumo semanal');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/historico-semanal?semanas=6&semana_atual=${semana}&ano_atual=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorico(response.data.historico || []);
    } catch (error) {
      setHistorico([]);
    }
  };

  const handlePreviousWeek = () => {
    if (semana > 1) setSemana(semana - 1);
    else { setSemana(52); setAno(ano - 1); }
  };

  const handleNextWeek = () => {
    if (semana < 52) setSemana(semana + 1);
    else { setSemana(1); setAno(ano + 1); }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const handleEditMotorista = (motorista) => {
    setEditingMotorista(motorista.motorista_id);
    setEditForm({
      ganhos_uber: motorista.ganhos_uber || 0,
      ganhos_bolt: motorista.ganhos_bolt || 0,
      via_verde: motorista.via_verde || 0,
      combustivel: motorista.combustivel || 0,
      eletrico: motorista.carregamento_eletrico || 0,
      aluguer: motorista.aluguer_veiculo || 0,
      extras: motorista.extras || 0
    });
  };

  const handleSaveEdit = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}`,
        { semana, ano, ...editForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Valores atualizados!');
      setEditingMotorista(null);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao atualizar valores');
    }
  };

  const handleDeleteMotoristaData = async (motoristaId, motoristaName) => {
    if (!window.confirm(`Eliminar todos os dados da semana ${semana}/${ano} para ${motoristaName}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Dados de ${motoristaName} eliminados!`);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao eliminar dados');
    }
  };

  const handleDeleteAllWeekData = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/relatorios/parceiro/resumo-semanal/all?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Dados da semana ${semana}/${ano} eliminados!`);
      setShowDeleteAllConfirm(false);
      fetchResumo();
    } catch (error) {
      toast.error('Erro ao eliminar dados');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/pdf?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resumo_semanal_S${semana}_${ano}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF descarregado!');
    } catch (error) {
      toast.error('Erro ao descarregar PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadMotoristaPdf = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        semana,
        ano,
        mostrar_matricula: pdfOptions.mostrar_matricula,
        mostrar_via_verde: pdfOptions.mostrar_via_verde,
        mostrar_abastecimentos: pdfOptions.mostrar_abastecimentos,
        mostrar_carregamentos: pdfOptions.mostrar_carregamentos
      });
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/pdf?${params}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${motoristaNome.replace(/\s+/g, '_')}_S${semana}_${ano}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`PDF de ${motoristaNome} descarregado!`);
      setShowPdfOptions(null);
    } catch (error) {
      toast.error('Erro ao descarregar PDF');
    }
  };

  const openPdfOptions = (motoristaId) => {
    setShowPdfOptions(motoristaId);
  };

  const handleWhatsApp = async (motoristaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/whatsapp?semana=${semana}&ano=${ano}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.open(response.data.whatsapp_link, '_blank');
    } catch (error) {
      toast.error('Erro ao gerar link WhatsApp');
    }
  };

  const handleEmail = async (motoristaId, motoristaNome) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/relatorios/parceiro/resumo-semanal/motorista/${motoristaId}/email`,
        { semana, ano },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(`Email enviado para ${motoristaNome}!`);
      } else {
        toast.error(response.data.message || 'Erro ao enviar email');
      }
    } catch (error) {
      toast.error('Erro ao enviar email');
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="p-4">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const totais = resumo?.totais || {};
  const motoristas = resumo?.motoristas || [];
  const totalAluguer = totais.total_aluguer || 0;
  const totalExtras = totais.total_extras || 0;
  const totalVendas = totais.total_vendas || 0;
  const totalReceitas = totais.total_receitas_parceiro || (totalAluguer + totalExtras + totalVendas);
  const totalDespesas = totais.total_despesas_operacionais || 0;
  const liquidoParceiro = totais.total_liquido_parceiro || (totalReceitas - totalDespesas);
  const isPositive = liquidoParceiro >= 0;
  const maxValue = Math.max(...historico.map(h => Math.max(h.ganhos || 0, h.despesas || 0, Math.abs(h.liquido || 0))), 1);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Resumo Semanal</h1>
            <p className="text-xs text-slate-500">Ganhos e despesas semanais</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded border px-2 py-1">
              <Button variant="ghost" size="sm" onClick={handlePreviousWeek} className="h-6 w-6 p-0">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium min-w-[80px] text-center">S{semana}/{ano}</span>
              <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-6 w-6 p-0">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-7 text-xs">
            {downloadingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            PDF
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteAllConfirm(true)} className="h-7 text-xs">
            <Trash2 className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Modal de confirmação */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Confirmar Eliminação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Eliminar <strong>TODOS</strong> os dados da semana {semana}/{ano}?</p>
              <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>Cancelar</Button>
                <Button size="sm" variant="destructive" onClick={handleDeleteAllWeekData}>Eliminar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-2 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-green-600 mb-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-medium">Receitas</span>
            </div>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
            <div className="text-xs text-green-600 mt-1 space-y-0.5">
              <div className="flex justify-between"><span>Aluguer:</span><span>{formatCurrency(totalAluguer)}</span></div>
              <div className="flex justify-between"><span>Extras:</span><span>{formatCurrency(totalExtras)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-2 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-red-600 mb-1">
              <TrendingDown className="w-3 h-3" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
            <div className="text-xs text-red-600 mt-1 space-y-0.5">
              <div className="flex justify-between"><span>Combustível:</span><span>{formatCurrency(totais.total_combustivel)}</span></div>
              <div className="flex justify-between"><span>Via Verde:</span><span>{formatCurrency(totais.total_via_verde)}</span></div>
              <div className="flex justify-between"><span>Elétrico:</span><span>{formatCurrency(totais.total_eletrico)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-2 ${isPositive ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardContent className="p-3">
            <div className={`flex items-center gap-1 mb-1 ${isPositive ? 'text-blue-600' : 'text-orange-600'}`}>
              <DollarSign className="w-3 h-3" />
              <span className="text-xs font-medium">Líquido</span>
            </div>
            <p className={`text-lg font-bold ${isPositive ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(liquidoParceiro)}</p>
            <div className="flex items-center gap-1 mt-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{motoristas.length} motoristas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Motoristas */}
      <div className="bg-slate-50 rounded p-2 text-center text-xs text-slate-600">
        <span>Ganhos Motoristas: {formatCurrency(totais.total_ganhos)}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Uber: {formatCurrency(totais.total_ganhos_uber)}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span>Bolt: {formatCurrency(totais.total_ganhos_bolt)}</span>
      </div>

      {/* Tabela de Motoristas */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-1 text-sm">
            <FileText className="w-4 h-4" />
            Detalhes por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-2">Motorista</th>
                  <th className="text-right p-2">Uber</th>
                  <th className="text-right p-2">Bolt</th>
                  <th className="text-right p-2">Via Verde</th>
                  <th className="text-right p-2">Comb.</th>
                  <th className="text-right p-2">Elétr.</th>
                  <th className="text-right p-2">Aluguer</th>
                  <th className="text-right p-2">Extras</th>
                  <th className="text-right p-2">Líquido</th>
                  <th className="text-center p-2 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {motoristas.map((m) => {
                  const isEditing = editingMotorista === m.motorista_id;
                  const liquido = (m.ganhos_uber || 0) + (m.ganhos_bolt || 0) - (m.via_verde || 0) - (m.combustivel || 0) - (m.carregamento_eletrico || 0) - (m.aluguer_veiculo || 0);
                  
                  return (
                    <tr key={m.motorista_id} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-medium">{m.motorista_nome}</td>
                      {isEditing ? (
                        <>
                          <td className="p-1"><Input type="number" value={editForm.ganhos_uber} onChange={(e) => setEditForm({...editForm, ganhos_uber: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.ganhos_bolt} onChange={(e) => setEditForm({...editForm, ganhos_bolt: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.via_verde} onChange={(e) => setEditForm({...editForm, via_verde: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.combustivel} onChange={(e) => setEditForm({...editForm, combustivel: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.eletrico} onChange={(e) => setEditForm({...editForm, eletrico: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.aluguer} onChange={(e) => setEditForm({...editForm, aluguer: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                          <td className="p-1"><Input type="number" value={editForm.extras} onChange={(e) => setEditForm({...editForm, extras: parseFloat(e.target.value) || 0})} className="w-16 h-6 text-xs text-right" /></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 text-right text-green-600">{formatCurrency(m.ganhos_uber)}</td>
                          <td className="p-2 text-right text-green-600">{formatCurrency(m.ganhos_bolt)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.via_verde)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.combustivel)}</td>
                          <td className="p-2 text-right text-red-600">{formatCurrency(m.carregamento_eletrico)}</td>
                          <td className="p-2 text-right text-blue-600">{formatCurrency(m.aluguer_veiculo)}</td>
                          <td className="p-2 text-right text-orange-600">{formatCurrency(m.extras)}</td>
                        </>
                      )}
                      <td className={`p-2 text-right font-bold ${liquido >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(liquido)}</td>
                      <td className="p-2 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="default" onClick={() => handleSaveEdit(m.motorista_id)} className="h-5 w-5 p-0"><Save className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingMotorista(null)} className="h-5 w-5 p-0"><X className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex gap-0.5 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadMotoristaPdf(m.motorista_id, m.motorista_nome)} className="h-5 w-5 p-0" title="Download PDF">
                              <FileDown className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleWhatsApp(m.motorista_id)} className="h-5 w-5 p-0 text-green-600 hover:text-green-700" title="WhatsApp">
                              <MessageCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEmail(m.motorista_id, m.motorista_nome)} className="h-5 w-5 p-0 text-blue-600 hover:text-blue-700" title="Email">
                              <Mail className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditMotorista(m)} className="h-5 w-5 p-0" title="Editar">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteMotoristaData(m.motorista_id, m.motorista_nome)} className="h-5 w-5 p-0" title="Eliminar">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {motoristas.length === 0 && (
                  <tr><td colSpan="10" className="text-center py-6 text-slate-500">Nenhum dado encontrado</td></tr>
                )}
              </tbody>
              {motoristas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-xs">
                    <td className="p-2">TOTAIS</td>
                    <td className="p-2 text-right text-green-700">{formatCurrency(totais.total_ganhos_uber)}</td>
                    <td className="p-2 text-right text-green-700">{formatCurrency(totais.total_ganhos_bolt)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_via_verde)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_combustivel)}</td>
                    <td className="p-2 text-right text-red-700">{formatCurrency(totais.total_eletrico)}</td>
                    <td className="p-2 text-right text-blue-700">{formatCurrency(totalAluguer)}</td>
                    <td className="p-2 text-right text-orange-700">{formatCurrency(totalExtras)}</td>
                    <td className={`p-2 text-right ${isPositive ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(liquidoParceiro)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Evolução */}
      {historico.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="flex items-center gap-1 text-sm">
              <BarChart3 className="w-4 h-4" />
              Evolução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex justify-center gap-4 mb-2 text-xs">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-green-500"></div><span>Receitas</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-500"></div><span>Despesas</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-500"></div><span>Líquido</span></div>
            </div>
            <div className="flex items-end justify-between gap-1 h-24 px-2">
              {historico.map((item, index) => {
                const receitaHeight = ((item.receitas || item.ganhos || 0) / maxValue) * 100;
                const despesaHeight = ((item.despesas || 0) / maxValue) * 100;
                const liquidoHeight = (Math.abs(item.liquido || 0) / maxValue) * 100;
                const isLiquidoPositivo = (item.liquido || 0) >= 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs p-1 rounded shadow z-10 whitespace-nowrap">
                      <div className="font-semibold">S{item.semana}/{item.ano}</div>
                      <div className="text-green-300">R: {formatCurrency(item.receitas || item.ganhos)}</div>
                      <div className="text-red-300">D: {formatCurrency(item.despesas)}</div>
                      <div className={isLiquidoPositivo ? 'text-blue-300' : 'text-orange-300'}>L: {formatCurrency(item.liquido)}</div>
                    </div>
                    <div className="flex gap-0.5 items-end h-20">
                      <div className="w-2 bg-green-500 rounded-t" style={{ height: `${Math.max(receitaHeight, 4)}%` }}></div>
                      <div className="w-2 bg-red-500 rounded-t" style={{ height: `${Math.max(despesaHeight, 4)}%` }}></div>
                      <div className={`w-2 rounded-t ${isLiquidoPositivo ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ height: `${Math.max(liquidoHeight, 4)}%` }}></div>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">S{item.semana}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-slate-400">{resumo?.periodo || `Semana ${semana}/${ano}`}</div>
      </div>
    </Layout>
  );
};

export default ResumoSemanalParceiro;
