import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Send, 
  Search,
  Plus,
  Trash2,
  User,
  Mail,
  Phone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Mensagens = ({ user, onLogout }) => {
  const [conversas, setConversas] = useState([]);
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [participanteSelecionado, setParticipanteSelecionado] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversas();
    fetchUsuarios();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      if (conversaSelecionada) {
        fetchMensagens(conversaSelecionada.id, true);
      }
      fetchConversas();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/conversas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversas(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuarios(response.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMensagens = async (conversaId, silent = false) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/conversas/${conversaId}/mensagens`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensagens(response.data);
    } catch (error) {
      if (!silent) {
        console.error('Error fetching messages:', error);
        toast.error('Erro ao carregar mensagens');
      }
    }
  };

  const handleSelectConversa = (conversa) => {
    setConversaSelecionada(conversa);
    fetchMensagens(conversa.id);
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/mensagens`,
        {
          conversa_id: conversaSelecionada.id,
          conteudo: novaMensagem
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNovaMensagem('');
      fetchMensagens(conversaSelecionada.id);
      fetchConversas();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleNovaConversa = async () => {
    if (!participanteSelecionado) {
      toast.error('Selecione um utilizador');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/conversas`,
        { participante_id: participanteSelecionado },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNovaConversaOpen(false);
      setParticipanteSelecionado('');
      await fetchConversas();
      handleSelectConversa(response.data);
      toast.success('Conversa iniciada');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
    }
  };

  const handleDeletarConversa = async (conversaId) => {
    if (!confirm('Tem certeza que deseja eliminar esta conversa?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/conversas/${conversaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Conversa eliminada');
      setConversaSelecionada(null);
      setMensagens([]);
      fetchConversas();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao eliminar conversa');
    }
  };

  const formatarData = (dataStr) => {
    const data = new Date(dataStr);
    const hoje = new Date();
    const diff = hoje - data;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (dias === 0) {
      return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }
    if (dias === 1) return 'Ontem';
    if (dias < 7) return `${dias} dias`;
    
    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  };

  const conversasFiltradas = conversas.filter(c => {
    if (!searchTerm) return true;
    const participante = c.participantes_info?.[0];
    return participante?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="h-[calc(100vh-120px)] flex gap-4">
        {/* Lista de Conversas */}
        <Card className="w-96 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Mensagens</CardTitle>
              <Dialog open={novaConversaOpen} onOpenChange={setNovaConversaOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Conversa</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Selecionar Utilizador
                      </label>
                      <Select value={participanteSelecionado} onValueChange={setParticipanteSelecionado}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um utilizador" />
                        </SelectTrigger>
                        <SelectContent>
                          {usuarios.map(usuario => (
                            <SelectItem key={usuario.id} value={usuario.id}>
                              {usuario.name} ({usuario.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleNovaConversa} className="w-full">
                      Iniciar Conversa
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar conversas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="p-4 text-center text-slate-500">A carregar...</div>
            ) : conversasFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Nenhuma conversa</p>
                <p className="text-slate-400 text-sm mt-2">
                  Clique em "Nova" para iniciar uma conversa
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {conversasFiltradas.map((conversa) => {
                  const participante = conversa.participantes_info?.[0];
                  const isSelected = conversaSelecionada?.id === conversa.id;
                  const isInteresse = conversa.tipo === 'interesse_veiculo';
                  
                  // Nome a mostrar: para interesse, usar contacto externo ou assunto
                  let nomeDisplay = participante?.name || 'Utilizador';
                  if (isInteresse && conversa.contacto_externo?.nome) {
                    nomeDisplay = conversa.contacto_externo.nome;
                  }
                  
                  return (
                    <div
                      key={conversa.id}
                      onClick={() => handleSelectConversa(conversa)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {isInteresse ? (
                              <span className="text-lg">🚗</span>
                            ) : (
                              <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900 truncate">
                              {nomeDisplay}
                            </span>
                            {conversa.mensagens_nao_lidas > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {conversa.mensagens_nao_lidas}
                              </Badge>
                            )}
                          </div>
                          {/* Mostrar assunto para conversas de interesse */}
                          {conversa.assunto && (
                            <p className="text-sm font-medium text-blue-600 truncate mt-0.5">
                              {conversa.assunto}
                            </p>
                          )}
                          {/* Mostrar contacto externo se disponível */}
                          {isInteresse && conversa.contacto_externo && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              📧 {conversa.contacto_externo.email} | 📱 {conversa.contacto_externo.telefone}
                            </div>
                          )}
                          <p className="text-sm text-slate-500 truncate mt-1">
                            {conversa.ultima_mensagem || 'Sem mensagens'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 ml-2">
                          {conversa.ultima_mensagem_em ? formatarData(conversa.ultima_mensagem_em) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className="flex-1 flex flex-col">
          {conversaSelecionada ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="w-8 h-8 text-slate-400" />
                    <div>
                      <h3 className="font-semibold">
                        {conversaSelecionada.participantes_info?.[0]?.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {conversaSelecionada.participantes_info?.[0]?.role}
                      </p>
                      {/* Mostrar dados de contacto */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {conversaSelecionada.participantes_info?.[0]?.email && (
                          <a href={`mailto:${conversaSelecionada.participantes_info[0].email}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Mail className="w-3 h-3" />
                            {conversaSelecionada.participantes_info[0].email}
                          </a>
                        )}
                        {conversaSelecionada.participantes_info?.[0]?.phone && (
                          <a href={`tel:${conversaSelecionada.participantes_info[0].phone}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Phone className="w-3 h-3" />
                            {conversaSelecionada.participantes_info[0].phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletarConversa(conversaSelecionada.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {mensagens.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    Sem mensagens ainda. Envie a primeira!
                  </div>
                ) : (
                  <>
                    {mensagens.map((msg) => {
                      const isOwn = msg.remetente_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isOwn
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            {!isOwn && (
                              <p className="text-xs font-semibold mb-1 opacity-70">
                                {msg.remetente_nome}
                              </p>
                            )}
                            <p className="break-words">{msg.conteudo}</p>
                            <p
                              className={`text-xs mt-1 ${
                                isOwn ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {formatarData(msg.criada_em)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </CardContent>

              <div className="p-4 border-t">
                <form onSubmit={handleEnviarMensagem} className="flex space-x-2">
                  <Input
                    placeholder="Escreva a sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!novaMensagem.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-24 h-24 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-slate-400">
                  Escolha uma conversa da lista ou inicie uma nova
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default Mensagens;
