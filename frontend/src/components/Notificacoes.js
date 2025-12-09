import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Bell, CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const Notificacoes = ({ open, onOpenChange, user }) => {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tituloEdit, setTituloEdit] = useState('');
  const [mensagemEdit, setMensagemEdit] = useState('');

  useEffect(() => {
    if (open) {
      fetchNotificacoes();
    }
  }, [open]);

  const fetchNotificacoes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/notificacoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificacoes(response.data || []);
    } catch (error) {
      console.error('Error fetching notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoLida = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      const notif = notificacoes.find(n => n.id === notifId);
      const novoEstado = !notif.lida;
      
      await axios.put(
        `${API}/notificacoes/${notifId}/lida`,
        { lida: novoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setNotificacoes(prev => prev.map(n => 
        n.id === notifId ? { ...n, lida: novoEstado } : n
      ));
      
      toast.success(novoEstado ? 'Marcada como lida' : 'Marcada como não lida');
    } catch (error) {
      console.error('Error marking notification:', error);
    }
  };

  const iniciarEdicao = (notif) => {
    setEditando(notif.id);
    setTituloEdit(notif.titulo);
    setMensagemEdit(notif.mensagem);
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setTituloEdit('');
    setMensagemEdit('');
  };

  const salvarEdicao = async (notifId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/notificacoes/${notifId}`,
        { titulo: tituloEdit, mensagem: mensagemEdit },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setNotificacoes(prev => prev.map(n => 
        n.id === notifId ? { ...n, titulo: tituloEdit, mensagem: mensagemEdit } : n
      ));
      
      toast.success('Notificação atualizada!');
      cancelarEdicao();
    } catch (error) {
      console.error('Error updating notification:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'sucesso':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'alerta':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'erro':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh]" style={{width: '1000px', maxWidth: '95vw'}}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">A carregar...</p>
          </div>
        ) : notificacoes.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Sem notificações</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {notificacoes.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    notif.lida ? 'bg-slate-50' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  {editando === notif.id ? (
                    <div className="space-y-3 p-3 bg-blue-50 rounded">
                      <Input
                        value={tituloEdit}
                        onChange={(e) => setTituloEdit(e.target.value)}
                        placeholder="Título"
                        className="font-medium"
                      />
                      <Textarea
                        value={mensagemEdit}
                        onChange={(e) => setMensagemEdit(e.target.value)}
                        placeholder="Mensagem"
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={cancelarEdicao}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => salvarEdicao(notif.id)}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      {getIcon(notif.tipo)}
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-800">{notif.titulo}</h4>
                        <p className="text-sm text-slate-600 mt-1">{notif.mensagem}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(notif.created_at).toLocaleString('pt-PT')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => iniciarEdicao(notif)}
                          title="Editar"
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => marcarComoLida(notif.id)}
                          title={notif.lida ? "Marcar como não lida" : "Marcar como lida"}
                        >
                          {notif.lida ? '👁️' : '✓'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm('Deseja remover esta notificação?')) {
                              try {
                                const token = localStorage.getItem('token');
                                await axios.delete(`${window.location.origin}/api/notificacoes/${notif.id}`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                setNotificacoes(prev => prev.filter(n => n.id !== notif.id));
                                toast.success('Notificação removida');
                              } catch (error) {
                                console.error('Erro ao remover:', error);
                              }
                            }
                          }}
                          title="Remover"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Notificacoes;
