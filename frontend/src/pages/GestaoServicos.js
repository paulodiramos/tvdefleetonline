import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  ArrowLeft,
  RefreshCw,
  Server,
  MessageSquare,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  FileText,
  Clock,
  User,
  Play,
  Square,
  RotateCcw
} from 'lucide-react';

const GestaoServicos = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [servicos, setServicos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedServico, setSelectedServico] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/servicos/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServicos(res.data.servicos || []);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  }, []);

  const fetchHistorico = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/servicos/historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(res.data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchHistorico()]);
      setLoading(false);
    };
    
    loadData();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchStatus, fetchHistorico]);

  const handleReiniciarWhatsApp = () => {
    setActionToConfirm({
      tipo: 'reiniciar_whatsapp',
      titulo: 'Reiniciar WhatsApp',
      descricao: 'Isto irá reiniciar o serviço WhatsApp. Os utilizadores conectados terão que fazer scan do QR Code novamente após alguns segundos.',
      acao: async () => {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API}/admin/servicos/whatsapp/reiniciar`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return res.data;
      }
    });
    setShowConfirmModal(true);
  };

  const handleLimparSessoes = () => {
    setActionToConfirm({
      tipo: 'limpar_sessoes',
      titulo: 'Limpar Sessões WhatsApp',
      descricao: 'Isto irá remover TODAS as sessões WhatsApp. Todos os parceiros terão que fazer scan do QR Code novamente.',
      acao: async () => {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API}/admin/servicos/whatsapp/limpar-sessao`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return res.data;
      }
    });
    setShowConfirmModal(true);
  };

  const handleReiniciarBackend = () => {
    setActionToConfirm({
      tipo: 'reiniciar_backend',
      titulo: 'Reiniciar Backend',
      descricao: 'ATENÇÃO: Isto irá reiniciar o servidor backend. A página irá perder conexão por alguns segundos.',
      acao: async () => {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API}/admin/servicos/backend/reiniciar`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return res.data;
      }
    });
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    if (!actionToConfirm) return;
    
    setActionLoading(true);
    try {
      const result = await actionToConfirm.acao();
      
      if (result.success) {
        toast.success(result.message);
        
        // Aguardar um pouco e atualizar status
        setTimeout(() => {
          fetchStatus();
          fetchHistorico();
        }, 3000);
      } else {
        toast.error(result.message || 'Erro na operação');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao executar ação');
    } finally {
      setActionLoading(false);
      setShowConfirmModal(false);
      setActionToConfirm(null);
    }
  };

  const handleVerLogs = async (servico) => {
    try {
      setSelectedServico(servico);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/servicos/logs/${servico}?linhas=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data.logs || []);
      setShowLogsModal(true);
    } catch (error) {
      toast.error('Erro ao carregar logs');
    }
  };

  const getServicoIcon = (nome) => {
    switch (nome) {
      case 'whatsapp':
        return <MessageSquare className="w-5 h-5" />;
      case 'backend':
        return <Server className="w-5 h-5" />;
      case 'frontend':
        return <Activity className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const getServicoColor = (nome) => {
    switch (nome) {
      case 'whatsapp':
        return 'bg-green-500';
      case 'backend':
        return 'bg-blue-500';
      case 'frontend':
        return 'bg-purple-500';
      case 'mongodb':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (user?.role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Server className="w-6 h-6" />
                Gestão de Serviços
              </h1>
              <p className="text-slate-600">Monitorizar e reiniciar serviços do sistema</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Alerta de Aviso */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Atenção</AlertTitle>
          <AlertDescription className="text-amber-700">
            Reiniciar serviços pode causar interrupções temporárias. Use apenas quando necessário.
          </AlertDescription>
        </Alert>

        {/* Grid de Serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {servicos.map((servico) => (
            <Card key={servico.nome} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${getServicoColor(servico.nome)}`}>
                      {getServicoIcon(servico.nome)}
                    </div>
                    <div>
                      <CardTitle className="text-lg capitalize">{servico.nome}</CardTitle>
                      <CardDescription>
                        {servico.pid && `PID: ${servico.pid}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant={servico.running ? "default" : "destructive"}
                    className={servico.running ? "bg-green-500" : ""}
                  >
                    {servico.running ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Running</>
                    ) : (
                      <><XCircle className="w-3 h-3 mr-1" /> Stopped</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {servico.uptime && (
                    <div className="flex items-center text-sm text-slate-600">
                      <Clock className="w-4 h-4 mr-2" />
                      Uptime: {servico.uptime}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleVerLogs(servico.nome)}
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Logs
                    </Button>
                    
                    {servico.nome === 'whatsapp' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={handleReiniciarWhatsApp}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reiniciar
                      </Button>
                    )}
                    
                    {servico.nome === 'backend' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={handleReiniciarBackend}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reiniciar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ações Rápidas WhatsApp */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Ações WhatsApp
            </CardTitle>
            <CardDescription>
              Resolver problemas comuns do serviço WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col items-center gap-2"
                onClick={handleReiniciarWhatsApp}
              >
                <RotateCcw className="w-6 h-6 text-green-600" />
                <span>Reiniciar Serviço</span>
                <span className="text-xs text-slate-500">Limpa locks e reinicia</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col items-center gap-2 border-amber-300 hover:bg-amber-50"
                onClick={handleLimparSessoes}
              >
                <Trash2 className="w-6 h-6 text-amber-600" />
                <span>Limpar Sessões</span>
                <span className="text-xs text-slate-500">Remove todas as sessões</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col items-center gap-2"
                onClick={() => handleVerLogs('whatsapp')}
              >
                <FileText className="w-6 h-6 text-slate-600" />
                <span>Ver Logs</span>
                <span className="text-xs text-slate-500">Últimas 100 linhas</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Ações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Histórico de Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Nenhuma ação registada</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {historico.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.resultado === 'sucesso' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {item.resultado === 'sucesso' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {item.tipo === 'reinicio_servico' ? `Reinício: ${item.servico}` : 
                         item.tipo === 'limpeza_sessao_whatsapp' ? 'Limpeza de Sessões' : item.tipo}
                      </p>
                      <p className="text-xs text-slate-500">
                        <User className="w-3 h-3 inline mr-1" />
                        {item.user_email}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(item.timestamp).toLocaleString('pt-PT')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              {actionToConfirm?.titulo}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {actionToConfirm?.descricao}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeAction}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A executar...</>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Logs */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Logs: {selectedServico}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] bg-slate-900 rounded-lg p-4">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
              {logs.length > 0 ? logs.join('\n') : 'Sem logs disponíveis'}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleVerLogs(selectedServico)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={() => setShowLogsModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default GestaoServicos;
