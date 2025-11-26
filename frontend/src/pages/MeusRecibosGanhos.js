import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, DollarSign, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

const MeusRecibosGanhos = ({ user, onLogout }) => {
  const [recibos, setRecibos] = useState([]);
  const [ganhos, setGanhos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    mes_referencia: '',
    valor: '',
    ficheiro_url: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [recibosRes, ganhosRes] = await Promise.all([
        axios.get(`${API}/recibos/meus`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/ganhos/meus`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setRecibos(recibosRes.data);
      setGanhos(ganhosRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRecibo = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.mes_referencia || !uploadForm.valor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!selectedFile) {
      toast.error('Selecione um ficheiro PDF');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      
      // First, upload the file
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const uploadRes = await axios.post(`${API}/recibos/upload-ficheiro`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const fileUrl = uploadRes.data.file_url;
      
      // Then create the recibo record
      await axios.post(`${API}/recibos`, {
        mes_referencia: uploadForm.mes_referencia,
        valor: parseFloat(uploadForm.valor),
        ficheiro_url: fileUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Recibo enviado para verificação!');
      setShowUploadModal(false);
      setUploadForm({ mes_referencia: '', valor: '', ficheiro_url: '' });
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      console.error('Error uploading recibo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar recibo');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pendente: { bg: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pendente' },
      verificado: { bg: 'bg-blue-100 text-blue-800', icon: CheckCircle, text: 'Verificado' },
      pago: { bg: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Pago' },
      rejeitado: { bg: 'bg-red-100 text-red-800', icon: XCircle, text: 'Rejeitado' }
    };
    return badges[status] || badges.pendente;
  };

  const totalGanhos = ganhos.reduce((sum, g) => sum + (g.valor || 0), 0);
  const totalRecibos = recibos.filter(r => r.status === 'pago').reduce((sum, r) => sum + (r.valor || 0), 0);

  if (loading) {
    return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Meus Recibos e Ganhos</h1>
            <p className="text-slate-600 mt-1">Acompanhe seus ganhos e envie recibos</p>
          </div>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Enviar Recibo
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Ganhos</p>
                  <p className="text-2xl font-bold text-green-600">€{totalGanhos.toFixed(2)}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Recibos Pagos</p>
                  <p className="text-2xl font-bold text-blue-600">€{totalRecibos.toFixed(2)}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Recibos Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{recibos.filter(r => r.status === 'pendente').length}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recibos">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recibos">Recibos</TabsTrigger>
            <TabsTrigger value="ganhos">Ganhos</TabsTrigger>
          </TabsList>

          {/* Tab Recibos */}
          <TabsContent value="recibos">
            <Card>
              <CardHeader>
                <CardTitle>Meus Recibos</CardTitle>
              </CardHeader>
              <CardContent>
                {recibos.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum recibo enviado ainda</p>
                ) : (
                  <div className="space-y-3">
                    {recibos.map((recibo) => {
                      const statusInfo = getStatusBadge(recibo.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <div key={recibo.id} className="border rounded-lg p-4 hover:bg-slate-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <FileText className="w-5 h-5 text-slate-600" />
                              <span className="font-semibold">Mês: {recibo.mes_referencia}</span>
                            </div>
                            <span className={`flex items-center space-x-1 text-xs px-2 py-1 rounded ${statusInfo.bg}`}>
                              <StatusIcon className="w-3 h-3" />
                              <span>{statusInfo.text}</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                            <div>Valor: <strong>€{recibo.valor.toFixed(2)}</strong></div>
                            <div>Data: {new Date(recibo.created_at).toLocaleDateString()}</div>
                          </div>
                          {recibo.observacoes && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 p-2 rounded">
                              Obs: {recibo.observacoes}
                            </div>
                          )}
                          <div className="mt-2">
                            <a 
                              href={recibo.ficheiro_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver Recibo →
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Ganhos */}
          <TabsContent value="ganhos">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Ganhos</CardTitle>
              </CardHeader>
              <CardContent>
                {ganhos.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum ganho registrado ainda</p>
                ) : (
                  <div className="space-y-3">
                    {ganhos.map((ganho) => (
                      <div key={ganho.id} className="border rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <span className="font-semibold">€{ganho.valor.toFixed(2)}</span>
                          </div>
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {ganho.plataforma}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(ganho.data).toLocaleDateString()}</span>
                          </div>
                          {ganho.descricao && (
                            <div className="mt-1 text-xs">{ganho.descricao}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Upload Recibo */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Recibo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUploadRecibo} className="space-y-4">
              <div>
                <Label htmlFor="mes">Mês de Referência</Label>
                <Input
                  id="mes"
                  type="month"
                  value={uploadForm.mes_referencia}
                  onChange={(e) => setUploadForm({ ...uploadForm, mes_referencia: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="valor">Valor (€)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={uploadForm.valor}
                  onChange={(e) => setUploadForm({ ...uploadForm, valor: e.target.value })}
                  placeholder="1000.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ficheiro">Ficheiro do Recibo (PDF) *</Label>
                <Input
                  id="ficheiro"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  required
                />
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Selecione o seu recibo em formato PDF (máx. 10MB)
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs text-blue-800">
                  ℹ️ O recibo será enviado para verificação. Você será notificado quando for aprovado.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)} disabled={uploading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A enviar...' : 'Enviar Recibo'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default MeusRecibosGanhos;
