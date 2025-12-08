import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, Send, User, Headphones } from 'lucide-react';

const MotoristaMensagens = ({ user, onLogout }) => {
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (destinatario) {
      fetchMensagens();
      
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        fetchMensagens();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [destinatario]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMensagens = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/mensagens/motorista?destinatario=${destinatario}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensagens(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    
    if (!novaMensagem.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    
    if (!destinatario) {
      toast.error('Selecione um destinatário');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/mensagens`,
        {
          texto: novaMensagem,
          tipo_destinatario: destinatario
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNovaMensagem('');
      fetchMensagens();
      toast.success('Mensagem enviada!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Mensagens</h1>
          <p className="text-slate-600 mt-1">Comunique com Suporte ou Parceiro</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar - Destinatários */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Destinatário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={destinatario === 'suporte' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setDestinatario('suporte')}
              >
                <Headphones className="w-4 h-4 mr-2" />
                Suporte
              </Button>
              <Button
                variant={destinatario === 'parceiro' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setDestinatario('parceiro')}
              >
                <User className="w-4 h-4 mr-2" />
                Parceiro
              </Button>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="md:col-span-3">
            {!destinatario ? (
              <CardContent className="text-center py-16">
                <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">
                  Selecione um destinatário para começar a conversa
                </p>
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center">
                      {destinatario === 'suporte' ? (
                        <>
                          <Headphones className="w-5 h-5 mr-2 text-blue-600" />
                          Suporte Técnico
                        </>
                      ) : (
                        <>
                          <User className="w-5 h-5 mr-2 text-green-600" />
                          Meu Parceiro
                        </>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {mensagens.length} mensagens
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {/* Messages */}
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {mensagens.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-slate-500 text-sm">
                          Nenhuma mensagem ainda. Comece a conversa!
                        </p>
                      </div>
                    ) : (
                      mensagens.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.remetente_id === user.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs rounded-lg p-3 ${
                              msg.remetente_id === user.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            <p className="text-sm">{msg.texto}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(msg.created_at).toLocaleString('pt-PT')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <form onSubmit={handleEnviarMensagem} className="border-t p-4">
                    <div className="flex space-x-2">
                      <Input
                        value={novaMensagem}
                        onChange={(e) => setNovaMensagem(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        disabled={loading}
                      />
                      <Button type="submit" disabled={loading}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MotoristaMensagens;