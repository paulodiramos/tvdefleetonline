import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Download, UserCircle, Shield, AlertCircle, CheckCircle } from 'lucide-react';

const MotoristaDetailDialog = ({ open, onClose, motoristaId, userRole }) => {
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [editingObservacoes, setEditingObservacoes] = useState(false);

  useEffect(() => {
    if (open && motoristaId) {
      fetchMotoristaData();
    }
  }, [open, motoristaId]);

  const fetchMotoristaData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotorista(response.data);
      setObservacoes(response.data.observacoes_internas || '');
    } catch (error) {
      console.error('Error fetching motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaId}`,
        { [editingField]: editValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Campo atualizado com sucesso!');
      setEditingField(null);
      fetchMotoristaData();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atualizar campo');
    }
  };

  const handleSaveObservacoes = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaId}`,
        { observacoes_internas: observacoes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Observações guardadas!');
      setEditingObservacoes(false);
      fetchMotoristaData();
    } catch (error) {
      console.error('Error saving observacoes:', error);
      toast.error('Erro ao guardar observações');
    }
  };

  const handleDownloadDocument = async (docType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/motoristas/${motoristaId}/documento/${docType}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${motorista.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Documento descarregado!');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao descarregar documento');
    }
  };

  if (!motorista && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Motorista</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">
                <UserCircle className="w-4 h-4 mr-2" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="documentos">
                <FileText className="w-4 h-4 mr-2" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="observacoes">
                <Shield className="w-4 h-4 mr-2" />
                Observações
              </TabsTrigger>
            </TabsList>

            {/* Aba Dados */}
            <TabsContent value="dados" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Nome</Label>
                  {editingField === 'name' ? (
                    <div className="flex space-x-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleSaveField}>✓</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>✗</Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{motorista?.name}</p>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingField('name'); setEditValue(motorista?.name); }}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Email</Label>
                  <p className="font-medium">{motorista?.email}</p>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Telefone</Label>
                  {editingField === 'phone' ? (
                    <div className="flex space-x-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleSaveField}>✓</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>✗</Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{motorista?.phone}</p>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingField('phone'); setEditValue(motorista?.phone); }}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-slate-600">NIF</Label>
                  {editingField === 'nif' ? (
                    <div className="flex space-x-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm"
                        maxLength={9}
                      />
                      <Button size="sm" onClick={handleSaveField}>✓</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>✗</Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{motorista?.nif || 'N/A'}</p>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingField('nif'); setEditValue(motorista?.nif); }}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Licença TVDE</Label>
                  <p className="font-medium">{motorista?.numero_licenca_tvde || 'N/A'}</p>
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Status</Label>
                  <Badge variant="outline">{motorista?.status_motorista || 'N/A'}</Badge>
                </div>
              </div>
            </TabsContent>

            {/* Aba Documentos */}
            <TabsContent value="documentos" className="space-y-3">
              {motorista?.documents && Object.keys(motorista.documents).length > 0 ? (
                <div className="grid gap-3">
                  {Object.entries(motorista.documents).map(([docType, docUrl]) => {
                    if (!docUrl) return null;
                    const validacao = motorista.documents_validacao?.[docType];
                    const isValidado = validacao?.validado || false;

                    return (
                      <div key={docType} className="flex items-center justify-between border rounded-lg p-3 hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-sm">{docType.replace(/_/g, ' ').toUpperCase()}</p>
                            {isValidado && (
                              <div className="flex items-center text-xs text-green-600 mt-1">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovado
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(docType)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum documento carregado</p>
                </div>
              )}
            </TabsContent>

            {/* Aba Observações */}
            <TabsContent value="observacoes" className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label>Notas Internas</Label>
                  {!editingObservacoes && (
                    <Button size="sm" variant="outline" onClick={() => setEditingObservacoes(true)}>
                      Editar
                    </Button>
                  )}
                </div>
                {editingObservacoes ? (
                  <div className="space-y-3">
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      className="w-full border rounded-lg p-3 min-h-[200px] text-sm"
                      placeholder="Adicione observações internas sobre este motorista..."
                    />
                    <div className="flex space-x-2">
                      <Button onClick={handleSaveObservacoes}>Guardar</Button>
                      <Button variant="outline" onClick={() => { setEditingObservacoes(false); setObservacoes(motorista.observacoes_internas || ''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 min-h-[150px]">
                    {observacoes || 'Nenhuma observação registada.'}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MotoristaDetailDialog;
