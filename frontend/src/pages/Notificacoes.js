import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Mail,
  Phone,
  User,
  Edit3,
  Save,
  X,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Notificacoes = ({ user, onLogout }) => {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todas'); // todas, nao_lidas, lidas
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
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

  const fetchNotificacaoDetalhe = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notificacoes/${notifId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedNotif(response.data);
      setNotesText(response.data.notas || '');
    } catch (error) {
      console.error('Error fetching notification detail:', error);
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
      if (selectedNotif?.id === notificacaoId) {
        setSelectedNotif(null);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erro ao eliminar notificação');
    }
  };

  const guardarNotas = async () => {
    if (!selectedNotif) return;
    
    try {
      setSavingNotes(true);
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/notificacoes/${selectedNotif.id}`,
        { notas: notesText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Notas guardadas');
      setEditingNotes(false);
      fetchNotificacaoDetalhe(selectedNotif.id);
      fetchNotificacoes();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao guardar notas');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleNotificationClick = (notificacao) => {
    if (!notificacao.lida) {
      marcarComoLida(notificacao.id);
    }
    fetchNotificacaoDetalhe(notificacao.id);
  };

  const handleNavigateToLink = () => {
    if (selectedNotif?.link) {
      setSelectedNotif(null);
      navigate(selectedNotif.link);
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
      case 'nova_mensagem':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
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
    if (!dataStr) return '';
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

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      gestao: 'Gestor',
      parceiro: 'Parceiro',
      motorista: 'Motorista'
    };
    return labels[role] || role;
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
                          
                          {/* Mostrar dados de contacto do emissor se existirem */}
                          {notif.contacto_emissor && (
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                              <User className="w-3 h-3" />
                              <span>{notif.contacto_emissor.nome}</span>
                              {notif.contacto_emissor.email && (
                                <>
                                  <Mail className="w-3 h-3 ml-2" />
                                  <span>{notif.contacto_emissor.email}</span>
                                </>
                              )}
                              {notif.contacto_emissor.telefone && (
                                <>
                                  <Phone className="w-3 h-3 ml-2" />
                                  <span>{notif.contacto_emissor.telefone}</span>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Indicador de notas */}
                          {notif.notas && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                              <Edit3 className="w-3 h-3" />
                              <span>Tem notas</span>
                            </div>
                          )}
                          
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

      {/* Modal de Detalhes da Notificação */}
      <Dialog open={!!selectedNotif} onOpenChange={(open) => !open && setSelectedNotif(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotif && getIconForType(selectedNotif.tipo)}
              {selectedNotif?.titulo}
            </DialogTitle>
          </DialogHeader>
          
          {selectedNotif && (
            <div className="space-y-4">
              {/* Mensagem */}
              <div>
                <p className="text-slate-700">{selectedNotif.mensagem}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {formatarData(selectedNotif.criada_em)}
                </p>
              </div>
              
              {/* Dados do Emissor/Interessado */}
              {selectedNotif.contacto_emissor && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Contacto do Emissor
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-700">Nome:</span>
                      <span>{selectedNotif.contacto_emissor.nome || 'N/A'}</span>
                    </div>
                    {selectedNotif.contacto_emissor.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <a href={`mailto:${selectedNotif.contacto_emissor.email}`} className="text-blue-600 hover:underline">
                          {selectedNotif.contacto_emissor.email}
                        </a>
                      </div>
                    )}
                    {selectedNotif.contacto_emissor.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-600" />
                        <a href={`tel:${selectedNotif.contacto_emissor.telefone}`} className="text-blue-600 hover:underline">
                          {selectedNotif.contacto_emissor.telefone}
                        </a>
                      </div>
                    )}
                    {selectedNotif.contacto_emissor.role && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getRoleLabel(selectedNotif.contacto_emissor.role)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Secção de Notas */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    Notas / Observações
                  </h4>
                  {!editingNotes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNotes(true)}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="Adicione notas ou observações sobre esta notificação..."
                      rows={4}
                      className="bg-white"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(false);
                          setNotesText(selectedNotif.notas || '');
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={guardarNotas}
                        disabled={savingNotes}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {savingNotes ? 'A guardar...' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    {selectedNotif.notas || 'Sem notas. Clique em "Editar" para adicionar.'}
                  </p>
                )}
                
                {selectedNotif.notas_updated_at && (
                  <p className="text-xs text-amber-500 mt-2">
                    Última atualização: {formatarData(selectedNotif.notas_updated_at)}
                  </p>
                )}
              </div>
              
              {/* Botões de Ação */}
              <div className="flex justify-between pt-4 border-t">
                {selectedNotif.link && (
                  <Button onClick={handleNavigateToLink}>
                    Ver Detalhes
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deletarNotificacao(selectedNotif.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Notificacoes;
