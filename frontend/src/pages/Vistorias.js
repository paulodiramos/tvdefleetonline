import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ClipboardCheck, Plus, Calendar, Car, FileText, Upload, 
  Download, Eye, CheckCircle, AlertCircle, XCircle, Trash2 
} from 'lucide-react';

const Vistorias = ({ user, onLogout }) => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vistorias, setVistorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedVistoria, setSelectedVistoria] = useState(null);
  
  const [vistoriaForm, setVistoriaForm] = useState({
    data_vistoria: new Date().toISOString().split('T')[0],
    tipo: 'periodica',
    km_veiculo: '',
    observacoes: '',
    estado_geral: 'bom',
    itens_verificados: {
      pneus: false,
      travoes: false,
      luzes: false,
      nivel_oleo: false,
      nivel_agua: false,
      bateria: false,
      cintos_seguranca: false,
      extintor: false,
      triangulo: false,
      kit_primeiros_socorros: false,
      documentacao: false,
      limpeza_interior: false,
      limpeza_exterior: false,
    },
    danos_encontrados: []
  });
  
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      fetchVistorias(selectedVehicle.id);
    }
  }, [selectedVehicle]);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data);
      if (response.data.length > 0) {
        setSelectedVehicle(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Erro ao carregar veículos');
    }
  };

  const fetchVistorias = async (vehicleId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles/${vehicleId}/vistorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVistorias(response.data);
    } catch (error) {
      console.error('Error fetching vistorias:', error);
      toast.error('Erro ao carregar vistorias');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVistoria = async (e) => {
    e.preventDefault();
    
    if (!selectedVehicle) {
      toast.error('Selecione um veículo');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/vehicles/${selectedVehicle.id}/vistorias`,
        vistoriaForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Vistoria criada com sucesso!');
      setShowCreateDialog(false);
      fetchVistorias(selectedVehicle.id);
      
      // Reset form
      setVistoriaForm({
        data_vistoria: new Date().toISOString().split('T')[0],
        tipo: 'periodica',
        km_veiculo: '',
        observacoes: '',
        estado_geral: 'bom',
        itens_verificados: {
          pneus: false,
          travoes: false,
          luzes: false,
          nivel_oleo: false,
          nivel_agua: false,
          bateria: false,
          cintos_seguranca: false,
          extintor: false,
          triangulo: false,
          kit_primeiros_socorros: false,
          documentacao: false,
          limpeza_interior: false,
          limpeza_exterior: false,
        },
        danos_encontrados: []
      });
    } catch (error) {
      console.error('Error creating vistoria:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar vistoria');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (vistoriaId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      try {
        setUploadingPhoto(true);
        const token = localStorage.getItem('token');
        
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);

          await axios.post(
            `${API}/vehicles/${selectedVehicle.id}/vistorias/${vistoriaId}/upload-foto`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
        }

        toast.success(`${files.length} foto(s) enviada(s) com sucesso!`);
        fetchVistorias(selectedVehicle.id);
      } catch (error) {
        console.error('Error uploading photo:', error);
        toast.error('Erro ao enviar foto');
      } finally {
        setUploadingPhoto(false);
      }
    };
    
    input.click();
  };

  const handleGeneratePDF = async (vistoriaId) => {
    try {
      setGeneratingPDF(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API}/vehicles/${selectedVehicle.id}/vistorias/${vistoriaId}/gerar-pdf`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('PDF gerado com sucesso!');
      fetchVistorias(selectedVehicle.id);
      
      // Download PDF
      if (response.data.pdf_url) {
        window.open(response.data.pdf_url, '_blank');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleItemCheck = (item) => {
    setVistoriaForm(prev => ({
      ...prev,
      itens_verificados: {
        ...prev.itens_verificados,
        [item]: !prev.itens_verificados[item]
      }
    }));
  };

  const addDano = () => {
    setVistoriaForm(prev => ({
      ...prev,
      danos_encontrados: [
        ...prev.danos_encontrados,
        { descricao: '', localizacao: '', gravidade: 'leve' }
      ]
    }));
  };

  const removeDano = (index) => {
    setVistoriaForm(prev => ({
      ...prev,
      danos_encontrados: prev.danos_encontrados.filter((_, i) => i !== index)
    }));
  };

  const updateDano = (index, field, value) => {
    setVistoriaForm(prev => ({
      ...prev,
      danos_encontrados: prev.danos_encontrados.map((dano, i) =>
        i === index ? { ...dano, [field]: value } : dano
      )
    }));
  };

  const getEstadoBadge = (estado) => {
    const styles = {
      bom: 'bg-green-100 text-green-800',
      regular: 'bg-yellow-100 text-yellow-800',
      mau: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[estado] || styles.bom}>{estado.toUpperCase()}</Badge>;
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
              <ClipboardCheck className="w-8 h-8 text-blue-600" />
              <span>Vistorias de Veículos</span>
            </h1>
            <p className="text-slate-600 mt-2">
              Gerir vistorias periódicas e relatórios de inspeção
            </p>
          </div>
          
          <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Vistoria
          </Button>
        </div>

        {/* Vehicle Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Label className="text-base font-semibold min-w-[120px]">Veículo:</Label>
              <select
                className="flex-1 p-2 border rounded-md"
                value={selectedVehicle?.id || ''}
                onChange={(e) => {
                  const vehicle = vehicles.find(v => v.id === e.target.value);
                  setSelectedVehicle(vehicle);
                }}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.marca} {vehicle.modelo} - {vehicle.matricula}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Vistorias List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : vistorias.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-lg text-slate-600">Nenhuma vistoria registrada</p>
              <p className="text-sm text-slate-500 mt-2">
                Crie a primeira vistoria para este veículo
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vistorias.map((vistoria) => (
              <Card key={vistoria.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-base">
                      {vistoria.tipo?.charAt(0).toUpperCase() + vistoria.tipo?.slice(1) || 'Vistoria'}
                    </span>
                    {getEstadoBadge(vistoria.estado_geral)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-slate-600">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      {new Date(vistoria.data_vistoria).toLocaleDateString('pt-PT')}
                    </p>
                    <p className="text-slate-600 mt-2">
                      <Car className="w-4 h-4 inline mr-2" />
                      KM: {vistoria.km_veiculo || 'N/A'}
                    </p>
                    {vistoria.responsavel_nome && (
                      <p className="text-slate-600 mt-2">
                        Responsável: {vistoria.responsavel_nome}
                      </p>
                    )}
                  </div>

                  {vistoria.danos_encontrados && vistoria.danos_encontrados.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-700 font-semibold">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {vistoria.danos_encontrados.length} dano(s) encontrado(s)
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedVistoria(vistoria);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver
                    </Button>
                    
                    {vistoria.pdf_relatorio ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(vistoria.pdf_relatorio, '_blank')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleGeneratePDF(vistoria.id)}
                        disabled={generatingPDF}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Gerar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Vistoria Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <ClipboardCheck className="w-5 h-5" />
                <span>Nova Vistoria</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateVistoria} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data da Vistoria</Label>
                  <Input
                    type="date"
                    value={vistoriaForm.data_vistoria}
                    onChange={(e) => setVistoriaForm({...vistoriaForm, data_vistoria: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={vistoriaForm.tipo}
                    onChange={(e) => setVistoriaForm({...vistoriaForm, tipo: e.target.value})}
                  >
                    <option value="periodica">Periódica</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="danos">Danos</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>KM do Veículo</Label>
                  <Input
                    type="number"
                    value={vistoriaForm.km_veiculo}
                    onChange={(e) => setVistoriaForm({...vistoriaForm, km_veiculo: e.target.value})}
                    placeholder="Ex: 50000"
                  />
                </div>
                <div>
                  <Label>Estado Geral</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={vistoriaForm.estado_geral}
                    onChange={(e) => setVistoriaForm({...vistoriaForm, estado_geral: e.target.value})}
                  >
                    <option value="bom">Bom</option>
                    <option value="regular">Regular</option>
                    <option value="mau">Mau</option>
                  </select>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Itens Verificados</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.keys(vistoriaForm.itens_verificados).map((item) => (
                    <div key={item} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={item}
                        checked={vistoriaForm.itens_verificados[item]}
                        onChange={() => handleItemCheck(item)}
                        className="w-4 h-4"
                      />
                      <label htmlFor={item} className="text-sm cursor-pointer">
                        {item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danos */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-semibold">Danos Encontrados</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addDano}>
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Dano
                  </Button>
                </div>

                {vistoriaForm.danos_encontrados.map((dano, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-3 bg-red-50">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-xs">Localização</Label>
                        <Input
                          value={dano.localizacao}
                          onChange={(e) => updateDano(index, 'localizacao', e.target.value)}
                          placeholder="Ex: Para-choque dianteiro"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Gravidade</Label>
                        <select
                          className="w-full p-2 border rounded-md text-sm"
                          value={dano.gravidade}
                          onChange={(e) => updateDano(index, 'gravidade', e.target.value)}
                        >
                          <option value="leve">Leve</option>
                          <option value="moderado">Moderado</option>
                          <option value="grave">Grave</option>
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label className="text-xs">Descrição</Label>
                      <Textarea
                        value={dano.descricao}
                        onChange={(e) => updateDano(index, 'descricao', e.target.value)}
                        placeholder="Descreva o dano..."
                        rows={2}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeDano(index)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remover
                    </Button>
                  </div>
                ))}
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={vistoriaForm.observacoes}
                  onChange={(e) => setVistoriaForm({...vistoriaForm, observacoes: e.target.value})}
                  placeholder="Observações gerais..."
                  rows={4}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Criando...' : 'Criar Vistoria'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        {selectedVistoria && (
          <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5" />
                  <span>Detalhes da Vistoria</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600 font-semibold">Data:</p>
                    <p>{new Date(selectedVistoria.data_vistoria).toLocaleDateString('pt-PT')}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">Estado:</p>
                    {getEstadoBadge(selectedVistoria.estado_geral)}
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">KM:</p>
                    <p>{selectedVistoria.km_veiculo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-semibold">Tipo:</p>
                    <p>{selectedVistoria.tipo}</p>
                  </div>
                </div>

                {selectedVistoria.observacoes && (
                  <div>
                    <p className="text-slate-600 font-semibold mb-2">Observações:</p>
                    <p className="text-sm bg-slate-50 p-3 rounded">{selectedVistoria.observacoes}</p>
                  </div>
                )}

                {selectedVistoria.danos_encontrados && selectedVistoria.danos_encontrados.length > 0 && (
                  <div>
                    <p className="text-slate-600 font-semibold mb-2">Danos:</p>
                    <div className="space-y-2">
                      {selectedVistoria.danos_encontrados.map((dano, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                          <p className="font-semibold">{dano.localizacao}</p>
                          <p className="text-slate-600">{dano.descricao}</p>
                          <Badge className="mt-1">{dano.gravidade}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-4">
                  {selectedVistoria.pdf_relatorio ? (
                    <Button
                      onClick={() => window.open(selectedVistoria.pdf_relatorio, '_blank')}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleGeneratePDF(selectedVistoria.id)}
                      disabled={generatingPDF}
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Gerar PDF
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default Vistorias;
