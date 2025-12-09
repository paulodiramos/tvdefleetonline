import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Mail, Send, CheckSquare, Clock, Search } from 'lucide-react';

// Componente para gerenciar estado do relatório
const EstadoRelatorioSelect = ({ item, onEstadoChange }) => {
  const [estado, setEstado] = useState(item.estado_relatorio || 'enviado');
  const [alterando, setAlterando] = useState(false);

  const estadosRelatorio = [
    { value: 'enviado', label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
    { value: 'pendente_recibo', label: 'Pendente de Recibo', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'recibo_enviado', label: 'Recibo Enviado', color: 'bg-purple-100 text-purple-800' },
    { value: 'verificar_recibo', label: 'Verificar Recibo', color: 'bg-orange-100 text-orange-800' },
    { value: 'aprovado', label: 'Aprovado', color: 'bg-green-100 text-green-800' },
    { value: 'pagamento', label: 'Pagamento', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'liquidado', label: 'Liquidado', color: 'bg-emerald-100 text-emerald-800' }
  ];

  const handleAlterarEstado = async (novoEstado) => {
    try {
      setAlterando(true);
      const token = localStorage.getItem('token');
      
      await axios.patch(
        `${API}/relatorios/historico/${item.id}/estado`,
        { estado_relatorio: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setEstado(novoEstado);
      toast.success('Estado atualizado!');
      onEstadoChange();
    } catch (error) {
      console.error('Error updating state:', error);
      toast.error('Erro ao atualizar estado');
    } finally {
      setAlterando(false);
    }
  };

  const estadoAtual = estadosRelatorio.find(e => e.value === estado);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Estado:</span>
      <Select value={estado} onValueChange={handleAlterarEstado} disabled={alterando}>
        <SelectTrigger className="h-7 text-xs w-auto">
          <SelectValue>
            <Badge className={`${estadoAtual?.color} text-xs border-0`}>
              {estadoAtual?.label}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {estadosRelatorio.map((e) => (
            <SelectItem key={e.value} value={e.value}>
              <span className={`px-2 py-1 rounded ${e.color}`}>
                {e.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const RelatoriosSemanaisNovo = ({ user, onLogout }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosSelecionados, setUsuariosSelecionados] = useState([]);
  const [tipoUsuario, setTipoUsuario] = useState('motorista');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [buscaUsuario, setBuscaUsuario] = useState('');

  useEffect(() => {
    // Set default dates (last 7 days)
    const hoje = new Date();
    const semanaAtras = new Date(hoje);
    semanaAtras.setDate(hoje.getDate() - 7);
    
    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(semanaAtras.toISOString().split('T')[0]);
    
    fetchUsuarios();
    fetchHistorico();
  }, [tipoUsuario]);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const endpoint = tipoUsuario === 'motorista' ? '/motoristas' : '/parceiros';
      const response = await axios.get(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsuarios(response.data);
      setUsuariosSelecionados([]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/relatorios/historico`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { tipo_usuario: tipoUsuario }
      });
      setHistorico(response.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const getUserDisplayName = (user) => {
    if (tipoUsuario === 'parceiro') {
      return user.nome_empresa || user.name || user.nome || 'Sem nome';
    }
    return user.name || user.nome || 'Sem nome';
  };

  const toggleUsuario = (usuarioId) => {
    setUsuariosSelecionados(prev =>
      prev.includes(usuarioId)
        ? prev.filter(id => id !== usuarioId)
        : [...prev, usuarioId]
    );
  };

  const toggleTodos = () => {
    if (usuariosSelecionados.length === usuariosFiltrados.length) {
      setUsuariosSelecionados([]);
    } else {
      setUsuariosSelecionados(usuariosFiltrados.map(u => u.id));
    }
  };

  const handleEnviarEmail = async () => {
    if (usuariosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um utilizador');
      return;
    }

    if (!dataInicio || !dataFim) {
      toast.error('Selecione o período');
      return;
    }

    try {
      setEnviandoEmail(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/relatorios/enviar-email-massa`,
        {
          usuario_ids: usuariosSelecionados,
          tipo_usuario: tipoUsuario,
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Relatórios enviados por email para ${usuariosSelecionados.length} utilizador(es)!`);
      fetchHistorico();
      setUsuariosSelecionados([]);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar emails');
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (usuariosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um utilizador');
      return;
    }

    if (!dataInicio || !dataFim) {
      toast.error('Selecione o período');
      return;
    }

    try {
      setEnviandoWhatsApp(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/relatorios/enviar-whatsapp-massa`,
        {
          usuario_ids: usuariosSelecionados,
          tipo_usuario: tipoUsuario,
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Relatórios enviados por WhatsApp para ${usuariosSelecionados.length} utilizador(es)!`);
      fetchHistorico();
      setUsuariosSelecionados([]);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar WhatsApp');
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const nome = getUserDisplayName(u).toLowerCase();
    const email = (u.email || '').toLowerCase();
    const busca = buscaUsuario.toLowerCase();
    return nome.includes(busca) || email.includes(busca);
  });

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Relatórios Semanais</h1>
          <p className="text-slate-600 mt-1">
            Gerar e enviar relatórios de ganhos e despesas por email ou WhatsApp
          </p>
        </div>

        {/* Configuração do Período */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração do Relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo-usuario">Tipo de Utilizador</Label>
                <Select value={tipoUsuario} onValueChange={setTipoUsuario}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorista">Motoristas</SelectItem>
                    <SelectItem value="parceiro">Parceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="data-inicio">Data Início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="data-fim">Data Fim</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Utilizadores */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Selecionar {tipoUsuario === 'motorista' ? 'Motoristas' : 'Parceiros'}
              </CardTitle>
              <Badge variant="secondary">
                {usuariosSelecionados.length} de {usuariosFiltrados.length} selecionados
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Busca */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={buscaUsuario}
                  onChange={(e) => setBuscaUsuario(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Botão Selecionar Todos */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={usuariosSelecionados.length === usuariosFiltrados.length && usuariosFiltrados.length > 0}
                  onCheckedChange={toggleTodos}
                />
                <Label htmlFor="select-all" className="cursor-pointer font-medium">
                  Selecionar todos ({usuariosFiltrados.length})
                </Label>
              </div>
            </div>

            {/* Lista de Utilizadores */}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-slate-600">A carregar...</p>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">Nenhum utilizador encontrado</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {usuariosFiltrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleUsuario(usuario.id)}
                  >
                    <Checkbox
                      checked={usuariosSelecionados.includes(usuario.id)}
                      onCheckedChange={() => toggleUsuario(usuario.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{getUserDisplayName(usuario)}</p>
                      <p className="text-sm text-slate-500">{usuario.email}</p>
                      {usuario.telefone && (
                        <p className="text-xs text-slate-400">{usuario.telefone}</p>
                      )}
                    </div>
                    {/* Último envio */}
                    {historico.find(h => h.usuario_id === usuario.id) && (
                      <div className="text-xs text-slate-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Último: {new Date(historico.find(h => h.usuario_id === usuario.id).data_envio).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 mt-6 pt-6 border-t">
              <Button
                onClick={handleEnviarEmail}
                disabled={enviandoEmail || usuariosSelecionados.length === 0}
                className="flex-1"
              >
                <Mail className="w-4 h-4 mr-2" />
                {enviandoEmail ? 'A enviar...' : `Enviar Email (${usuariosSelecionados.length})`}
              </Button>
              
              <Button
                onClick={handleEnviarWhatsApp}
                disabled={enviandoWhatsApp || usuariosSelecionados.length === 0}
                variant="outline"
                className="flex-1 border-green-600 text-green-600 hover:bg-green-50"
              >
                <Send className="w-4 h-4 mr-2" />
                {enviandoWhatsApp ? 'A enviar...' : `Enviar WhatsApp (${usuariosSelecionados.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Envios */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum envio registado</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {historico.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium">
                          {usuarios.find(u => u.id === item.usuario_id) 
                            ? getUserDisplayName(usuarios.find(u => u.id === item.usuario_id))
                            : 'Utilizador não encontrado'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.tipo_envio === 'email' ? '📧 Email' : '📱 WhatsApp'} → {item.destino}
                        </p>
                        <div className="mt-2">
                          <EstadoRelatorioSelect 
                            item={item} 
                            onEstadoChange={fetchHistorico}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {new Date(item.data_envio).toLocaleString('pt-PT')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RelatoriosSemanaisNovo;
