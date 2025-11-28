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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle, XCircle, Eye } from 'lucide-react';

const VerificarRecibos = ({ user, onLogout }) => {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [verifyForm, setVerifyForm] = useState({
    status: 'verificado',
    observacoes: ''
  });

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'gestao' && user?.role !== 'operacional' && user?.role !== 'parceiro') {
      toast.error('Acesso negado');
      window.location.href = '/dashboard';
      return;
    }
    fetchRecibos();
  }, [user]);

  const fetchRecibos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/recibos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecibos(response.data);
    } catch (error) {
      console.error('Error fetching recibos:', error);
      toast.error('Erro ao carregar recibos');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/recibos/${selectedRecibo.id}/verificar`, verifyForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Recibo ${verifyForm.status}!`);
      setShowVerifyModal(false);
      setVerifyForm({ status: 'verificado', observacoes: '' });
      fetchRecibos();
    } catch (error) {
      console.error('Error verifying recibo:', error);
      toast.error('Erro ao verificar recibo');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pendente: 'bg-yellow-100 text-yellow-800',
      verificado: 'bg-blue-100 text-blue-800',
      pago: 'bg-green-100 text-green-800',
      rejeitado: 'bg-red-100 text-red-800'
    };
    return badges[status] || badges.pendente;
  };

  const recibosPendentes = recibos.filter(r => r.status === 'pendente');

  if (loading) {
    return <Layout user={user} onLogout={onLogout}><div>Carregando...</div></Layout>;
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Verificar Recibos</h1>
          <p className="text-slate-600 mt-1">Aprovar ou rejeitar recibos de motoristas</p>
        </div>

        {/* Alert para pendentes */}
        {recibosPendentes.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-semibold">
              ⚠️ {recibosPendentes.length} recibo(s) aguardando verificação
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Todos os Recibos</CardTitle>
          </CardHeader>
          <CardContent>
            {recibos.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum recibo encontrado</p>
            ) : (
              <div className="space-y-3">
                {recibos.map((recibo) => (
                  <div 
                    key={recibo.id} 
                    className={`border rounded-lg p-4 ${recibo.status === 'pendente' ? 'bg-yellow-50 border-yellow-300' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-lg">{recibo.motorista_nome}</div>
                        <div className="text-sm text-slate-600">
                          Parceiro: {recibo.parceiro_nome || 'N/A'}
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded ${getStatusBadge(recibo.status)}`}>
                        {recibo.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-slate-600">Mês:</span>
                        <div className="font-semibold">{recibo.mes_referencia}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Valor:</span>
                        <div className="font-semibold text-green-600">€{recibo.valor.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Data Envio:</span>
                        <div className="font-semibold">{new Date(recibo.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {recibo.observacoes && (
                      <div className="mb-3 p-2 bg-slate-100 rounded text-sm">
                        <strong>Observações:</strong> {recibo.observacoes}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(recibo.ficheiro_url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Recibo
                      </Button>

                      {recibo.status === 'pendente' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRecibo(recibo);
                              setVerifyForm({ status: 'verificado', observacoes: '' });
                              setShowVerifyModal(true);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRecibo(recibo);
                              setVerifyForm({ status: 'rejeitado', observacoes: '' });
                              setShowVerifyModal(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Verificar */}
        <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {verifyForm.status === 'verificado' ? 'Aprovar' : 'Rejeitar'} Recibo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-100 p-3 rounded">
                <p className="text-sm"><strong>Motorista:</strong> {selectedRecibo?.motorista_nome}</p>
                <p className="text-sm"><strong>Mês:</strong> {selectedRecibo?.mes_referencia}</p>
                <p className="text-sm"><strong>Valor:</strong> €{selectedRecibo?.valor.toFixed(2)}</p>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={verifyForm.status} onValueChange={(val) => setVerifyForm({...verifyForm, status: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verificado">Aprovado/Verificado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="obs">Observações (opcional)</Label>
                <Input
                  id="obs"
                  value={verifyForm.observacoes}
                  onChange={(e) => setVerifyForm({...verifyForm, observacoes: e.target.value})}
                  placeholder="Adicione observações..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowVerifyModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleVerify}>
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default VerificarRecibos;
