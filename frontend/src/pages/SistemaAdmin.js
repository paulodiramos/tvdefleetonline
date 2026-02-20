import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle, Loader2, Monitor, Database, Mail, Trash2, UserX, Shield
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

  useEffect(() => {
    fetchStatus();
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

          {/* Disk Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Armazenamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Usado: {status?.disk?.used_gb} GB</span>
                  <span>Livre: {status?.disk?.free_gb} GB</span>
                  <span>Total: {status?.disk?.total_gb} GB</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      status?.disk?.percent_used > 90 ? 'bg-red-500' :
                      status?.disk?.percent_used > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${status?.disk?.percent_used || 0}%` }}
                  />
                </div>
                <p className="text-sm text-slate-500 text-center">
                  {status?.disk?.percent_used}% utilizado
                </p>
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
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Última atualização: {status?.timestamp ? new Date(status.timestamp).toLocaleString('pt-PT') : 'N/A'}
        </p>
      </div>
    </Layout>
  );
};

export default SistemaAdmin;
