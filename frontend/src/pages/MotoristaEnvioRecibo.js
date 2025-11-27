import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Building, AlertCircle, CheckCircle } from 'lucide-react';

const MotoristaEnvioRecibo = ({ user, onLogout }) => {
  const [motoristaData, setMotoristaData] = useState(null);
  const [parceiroData, setParceiroData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo: 'semanal',
    mes: '',
    valor: '',
    observacoes: '',
    ficheiro: null
  });

  useEffect(() => {
    fetchMotoristaData();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristaData(response.data);
      
      // Buscar dados do parceiro se houver
      if (response.data.parceiro_atribuido) {
        const parceiroResponse = await axios.get(`${API}/parceiros/${response.data.parceiro_atribuido}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setParceiroData(parceiroResponse.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, ficheiro: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.ficheiro) {
      toast.error('Por favor, selecione um ficheiro');
      return;
    }

    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      toast.error('Por favor, insira um valor válido');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('file', formData.ficheiro);
      formDataToSend.append('tipo', formData.tipo);
      formDataToSend.append('mes', formData.mes);
      formDataToSend.append('valor_total', formData.valor);
      formDataToSend.append('observacoes', formData.observacoes);

      await axios.post(
        `${API}/recibos/upload-ficheiro`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Recibo enviado com sucesso!');
      
      // Limpar formulário
      setFormData({
        tipo: 'semanal',
        mes: '',
        valor: '',
        observacoes: '',
        ficheiro: null
      });
      
      // Reset file input
      const fileInput = document.getElementById('ficheiro');
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Error uploading recibo:', error);
      toast.error('Erro ao enviar recibo');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">A carregar...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Envio de Recibo</h1>
          <p className="text-slate-600 mt-1">Envie os seus recibos de ganhos</p>
        </div>

        {/* Dados do Parceiro */}
        {parceiroData ? (
          <Card className="border-l-4 border-blue-500">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-blue-600" />
                <CardTitle>Dados do Parceiro Associado</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Nome</p>
                  <p className="font-semibold">{parceiroData.name}</p>
                </div>
                <div>
                  <p className="text-slate-600">Contribuinte (NIF)</p>
                  <p className="font-semibold">{parceiroData.contribuinte || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-600">Morada</p>
                  <p className="font-semibold">{parceiroData.morada || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-yellow-500">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Sem Parceiro Associado</p>
                  <p className="text-sm text-slate-600">Não tem um parceiro atribuído no momento.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulário de Envio */}
        <Card>
          <CardHeader>
            <CardTitle>Enviar Novo Recibo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Recibo *</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, tipo: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mês de Referência *</Label>
                  <Input
                    type="month"
                    value={formData.mes}
                    onChange={(e) => setFormData(prev => ({ ...prev, mes: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Valor Total (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Ficheiro do Recibo *</Label>
                <Input
                  id="ficheiro"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Formatos aceites: PDF, JPG, PNG</p>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Adicione observações se necessário..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A enviar...' : 'Enviar Recibo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MotoristaEnvioRecibo;