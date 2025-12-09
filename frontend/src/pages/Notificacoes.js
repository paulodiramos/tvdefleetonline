import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Trash2, 
  AlertCircle,
  FileText,
  DollarSign,
  FileCheck,
  Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Notificacoes = ({ user, onLogout }) => {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todas'); // todas, nao_lidas, lidas
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotificacoes();
  }, [filter]);

  const fetchNotificacoes = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (filter === 'nao_lidas') params.lida = false;
      if (filter === 'lidas') params.lida = true;
      
      const response = await axios.get(`${API}/notificacoes`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setNotificacoes(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const marcarComoLida = async (notificacaoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/notificacoes/${notificacaoId}/marcar-lida`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotificacoes();
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Erro ao marcar notificação');
    }
  };

  const marcarTodasLidas = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/notificacoes/marcar-todas-lidas`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Todas as notificações foram marcadas como lidas');
      fetchNotificacoes();
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Erro ao marcar todas como lidas');
    }
  };

  const deletarNotificacao = async (notificacaoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/notificacoes/${notificacaoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Notificação eliminada');
      fetchNotificacoes();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erro ao eliminar notificação');
    }
  };

  const handleNotificationClick = (notificacao) => {
    if (!notificacao.lida) {
      marcarComoLida(notificacao.id);
    }
    if (notificacao.link) {
      navigate(notificacao.link);
    }
  };

  const getIconForType = (tipo) => {
    switch (tipo) {
      case 'documento_expirando':
      case 'documento_veiculo_expirando':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'recibo_pendente':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'documento_validado':
        return <FileCheck className="w-5 h-5 text-green-500" />;
      case 'contrato_gerado':
        return <FileText className="w-5 h-5 text-purple-500" />;
      case 'pagamento_processado':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'urgente':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'alta':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'baixa':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatarData = (dataStr) => {
    const data = new Date(dataStr);
    const hoje = new Date();
    const diff = hoje - data;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (dias === 0) {
      const horas = Math.floor(diff / (1000 * 60 * 60));
      if (horas === 0) {
        const minutos = Math.floor(diff / (1000 * 60));
        return `${minutos} min atrás`;
      }
      return `${horas}h atrás`;
    }
    if (dias === 1) return 'Ontem';
    if (dias < 7) return `${dias} dias atrás`;
    
    return data.toLocaleDateString('pt-PT');
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="mx-auto space-y-6" style={{width: '1100px', minHeight: '600px', maxWidth: '95vw'}}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notificações</h1>
            <p className="text-slate-600 mt-1">Gerir as suas notificações</p>
          </div>
          {notificacoes.some(n => !n.lida) && (
            <Button onClick={marcarTodasLidas} variant="outline">
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar Todas como Lidas
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          <Button
            variant={filter === 'todas' ? 'default' : 'outline'}
            onClick={() => setFilter('todas')}
            size="sm"
          >
            Todas
          </Button>
          <Button
            variant={filter === 'nao_lidas' ? 'default' : 'outline'}
            onClick={() => setFilter('nao_lidas')}
            size="sm"
          >
            Não Lidas
          </Button>
          <Button
            variant={filter === 'lidas' ? 'default' : 'outline'}
            onClick={() => setFilter('lidas')}
            size="sm"
          >
            Lidas
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center text-slate-500">
                A carregar notificações...
              </CardContent>
            </Card>
          ) : notificacoes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BellOff className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">Nenhuma notificação</p>
                <p className="text-slate-400 text-sm mt-2">
                  Quando houver notificações, elas aparecerão aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            notificacoes.map((notif) => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  !notif.lida ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      {getIconForType(notif.tipo)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">
                            {notif.titulo}
                          </h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {notif.mensagem}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-slate-400">
                              {formatarData(notif.criada_em)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPrioridadeColor(notif.prioridade)}`}
                            >
                              {notif.prioridade}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {!notif.lida && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                marcarComoLida(notif.id);
                              }}
                              title="Marcar como lida"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletarNotificacao(notif.id);
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Notificacoes;
