import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Server, HardDrive, RefreshCw, Play, CheckCircle, XCircle, 
  AlertTriangle, Loader2, Monitor, Database, Mail, Trash2, UserX, Shield,
  FolderOpen, FileText, Eraser
} from 'lucide-react';

const SistemaAdmin = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [restarting, setRestarting] = useState(null);
  
  // Estados para emails bloqueados
  const [emailsBloqueados, setEmailsBloqueados] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [limpandoEmails, setLimpandoEmails] = useState(false);
  const [libertandoEmail, setLibertandoEmail] = useState(null);
  const [showConfirmLimpar, setShowConfirmLimpar] = useState(false);
  
  // Estados para armazenamento
  const [armazenamento, setArmazenamento] = useState(null);
  const [loadingArmazenamento, setLoadingArmazenamento] = useState(false);
  const [limpandoTemporarios, setLimpandoTemporarios] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchEmailsBloqueados();
    fetchArmazenamento();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/sistema/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('Erro ao carregar estado do sistema');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailsBloqueados = async () => {
    try {
      setLoadingEmails(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/emails-bloqueados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailsBloqueados(response.data);
    } catch (error) {
      console.error('Error fetching blocked emails:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleLibertarEmail = async (email) => {
    if (!confirm(`Tem certeza que deseja libertar o email "${email}"?\n\nTodos os registos associados serão eliminados permanentemente.`)) {
      return;
    }
    
    try {
      setLibertandoEmail(email);
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API}/admin/libertar-email/${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Email ${email} libertado com sucesso!`);
      fetchEmailsBloqueados();
    } catch (error) {
      console.error('Error freeing email:', error);
      toast.error(error.response?.data?.detail || 'Erro ao libertar email');
    } finally {
      setLibertandoEmail(null);
    }
  };

  const handleLimparTodosEliminados = async () => {
    try {
      setLimpandoEmails(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/limpar-eliminados`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { resultados } = response.data;
      toast.success(`Limpeza concluída! Removidos: ${resultados.users_removidos} users, ${resultados.motoristas_removidos} motoristas, ${resultados.documentos_removidos} documentos`);
      setShowConfirmLimpar(false);
      fetchEmailsBloqueados();
    } catch (error) {
      console.error('Error cleaning deleted:', error);
      toast.error('Erro ao limpar registos eliminados');
    } finally {
      setLimpandoEmails(false);
    }
  };

  const fetchArmazenamento = async () => {
    try {
      setLoadingArmazenamento(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/sistema/armazenamento`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArmazenamento(response.data);
    } catch (error) {
      console.error('Error fetching storage:', error);
    } finally {
      setLoadingArmazenamento(false);
    }
  };

  const handleLimparTemporarios = async () => {
    if (!confirm('Tem certeza que deseja limpar os ficheiros temporários?\n\nIsto irá remover: test_reports, dump, video_frames, cache do playwright')) {
      return;
    }
    
    try {
      setLimpandoTemporarios(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/sistema/limpar-temporarios`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message);
      fetchArmazenamento();
      fetchStatus();
    } catch (error) {
      console.error('Error cleaning temp files:', error);
      toast.error('Erro ao limpar ficheiros temporários');
    } finally {
      setLimpandoTemporarios(false);
    }
  };

  const handleInstallPlaywright = async () => {
    try {
      setInstalling(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/sistema/playwright/install`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Playwright instalado com sucesso!');
        fetchStatus();
      } else {
        toast.error(response.data.message || 'Erro ao instalar Playwright');
      }
    } catch (error) {
      console.error('Error installing Playwright:', error);
      toast.error('Erro ao instalar Playwright');
    } finally {
      setInstalling(false);
    }
  };

  const handleRestartService = async (service) => {
    try {
      setRestarting(service);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/admin/sistema/restart-service/${service}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(`Serviço ${service} reiniciado!`);
      } else {
        toast.error(response.data.message || `Erro ao reiniciar ${service}`);
      }
    } catch (error) {
      console.error('Error restarting service:', error);
      toast.error(`Erro ao reiniciar ${service}`);
    } finally {
      setRestarting(null);
    }
  };

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
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-6 h-6" />
              Gestão do Sistema
            </h1>
            <p className="text-slate-600">Monitorização e manutenção do servidor</p>
          </div>
          <Button variant="outline" onClick={fetchStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Playwright Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Playwright (RPA)
              </CardTitle>
              <CardDescription>
                Sistema de automação para sincronização de plataformas (Uber, Bolt, Prio)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {status?.playwright?.installed ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {status?.playwright?.installed ? 'Instalado' : 'Não Instalado'}
                      </p>
                      {status?.playwright?.version && (
                        <p className="text-sm text-slate-500">Versão: {status.playwright.version}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={handleInstallPlaywright} 
                    disabled={installing}
                    variant={status?.playwright?.installed ? "outline" : "default"}
                  >
                    {installing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        A instalar...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        {status?.playwright?.installed ? 'Reinstalar' : 'Instalar'}
                      </>
                    )}
                  </Button>
                </div>

                {status?.playwright?.browsers?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Browsers instalados:</p>
                    <div className="flex flex-wrap gap-2">
                      {status.playwright.browsers.map((browser, idx) => (
                        <Badge key={idx} variant="secondary">{browser}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!status?.playwright?.installed && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Playwright não instalado</p>
                      <p className="text-yellow-700">
                        A sincronização automática de plataformas (Uber, Bolt, Prio) não funcionará 
                        até o Playwright ser instalado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Disk Usage - Detalhado */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  Armazenamento
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchArmazenamento}
                    disabled={loadingArmazenamento}
                  >
                    {loadingArmazenamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleLimparTemporarios}
                    disabled={limpandoTemporarios}
                  >
                    {limpandoTemporarios ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Eraser className="w-4 h-4 mr-2" />
                    )}
                    Limpar Temporários
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Barra de progresso geral */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usado: {armazenamento?.disco?.usado || status?.disk?.used_gb + ' GB'}</span>
                    <span>Livre: {armazenamento?.disco?.livre || status?.disk?.free_gb + ' GB'}</span>
                    <span>Total: {armazenamento?.disco?.total || status?.disk?.total_gb + ' GB'}</span>
                  </div>
                  <Progress 
                    value={armazenamento?.disco?.percentagem_usado || status?.disk?.percent_used || 0} 
                    className={`h-3 ${
                      (armazenamento?.disco?.percentagem_usado || status?.disk?.percent_used) > 90 ? '[&>div]:bg-red-500' :
                      (armazenamento?.disco?.percentagem_usado || status?.disk?.percent_used) > 70 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                    }`}
                  />
                  <p className="text-sm text-slate-500 text-center">
                    {armazenamento?.disco?.percentagem_usado || status?.disk?.percent_used}% utilizado
                  </p>
                </div>

                {/* Detalhes por pasta */}
                {armazenamento?.pastas && (
                  <div className="mt-4">
                    <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Detalhes por Pasta
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Pasta</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {armazenamento.pastas.filter(p => p.existe).map((pasta, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{pasta.nome}</p>
                                  <p className="text-xs text-slate-400">{pasta.path}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  pasta.tamanho_bytes > 100 * 1024 * 1024 ? "destructive" :
                                  pasta.tamanho_bytes > 10 * 1024 * 1024 ? "secondary" : "outline"
                                }>
                                  {pasta.tamanho}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {pasta.existe ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-300" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Resumo */}
                {armazenamento && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">Total Uploads</p>
                      <p className="text-lg font-bold text-blue-900">{armazenamento.total_uploads_formatado}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-700">Ficheiros Temporários</p>
                      <p className="text-lg font-bold text-amber-900">{armazenamento.ficheiros_temporarios_formatado}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Serviços
              </CardTitle>
              <CardDescription>
                Reinicie os serviços em caso de problemas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">Backend (API)</p>
                    <p className="text-sm text-slate-500">FastAPI Server</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRestartService('backend')}
                    disabled={restarting === 'backend'}
                  >
                    {restarting === 'backend' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">Frontend</p>
                    <p className="text-sm text-slate-500">React App</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRestartService('frontend')}
                    disabled={restarting === 'frontend'}
                  >
                    {restarting === 'frontend' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emails Bloqueados */}
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <Mail className="w-5 h-5" />
                    Emails Bloqueados
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    Utilizadores eliminados cujos emails ainda bloqueiam novos registos
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchEmailsBloqueados}
                    disabled={loadingEmails}
                  >
                    {loadingEmails ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                  {emailsBloqueados?.total_bloqueados > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setShowConfirmLimpar(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar Todos
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingEmails ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                </div>
              ) : emailsBloqueados?.total_bloqueados === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium text-green-700">Nenhum email bloqueado</p>
                  <p className="text-sm">Todos os emails eliminados foram limpos do sistema</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      <strong>{emailsBloqueados?.total_bloqueados}</strong> email(s) bloqueado(s) impedem novos registos
                    </p>
                  </div>
                  
                  {/* Users eliminados */}
                  {emailsBloqueados?.users_eliminados?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <UserX className="w-4 h-4" />
                        Utilizadores Eliminados ({emailsBloqueados.users_eliminados.length})
                      </h4>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Email</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Eliminado em</TableHead>
                              <TableHead className="w-[100px]">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emailsBloqueados.users_eliminados.map((user, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{user.email}</TableCell>
                                <TableCell>{user.name || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{user.role}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {user.deleted_at ? new Date(user.deleted_at).toLocaleDateString('pt-PT') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleLibertarEmail(user.email)}
                                    disabled={libertandoEmail === user.email}
                                  >
                                    {libertandoEmail === user.email ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  
                  {/* Motoristas eliminados */}
                  {emailsBloqueados?.motoristas_eliminados?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <UserX className="w-4 h-4" />
                        Motoristas Eliminados ({emailsBloqueados.motoristas_eliminados.length})
                      </h4>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Email</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Eliminado em</TableHead>
                              <TableHead className="w-[100px]">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emailsBloqueados.motoristas_eliminados.map((mot, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{mot.email}</TableCell>
                                <TableCell>{mot.nome || '-'}</TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {mot.deleted_at ? new Date(mot.deleted_at).toLocaleDateString('pt-PT') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleLibertarEmail(mot.email)}
                                    disabled={libertandoEmail === mot.email}
                                  >
                                    {libertandoEmail === mot.email ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Última atualização: {status?.timestamp ? new Date(status.timestamp).toLocaleString('pt-PT') : 'N/A'}
        </p>

        {/* Modal de confirmação para limpar todos */}
        <Dialog open={showConfirmLimpar} onOpenChange={setShowConfirmLimpar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Shield className="w-5 h-5" />
                Confirmar Limpeza Total
              </DialogTitle>
              <DialogDescription>
                Esta ação irá eliminar <strong>permanentemente</strong> todos os registos marcados como eliminados.
                <br /><br />
                Os emails serão libertados e poderão ser usados para novos registos.
                <br /><br />
                <span className="text-red-600 font-medium">Esta ação é IRREVERSÍVEL!</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmLimpar(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleLimparTodosEliminados}
                disabled={limpandoEmails}
              >
                {limpandoEmails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    A limpar...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Sim, Limpar Tudo
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SistemaAdmin;
