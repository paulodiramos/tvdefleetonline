import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Eye, 
  Download, 
  Upload, 
  Calendar,
  FileText,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  XCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VehicleVistorias = ({ user, onLogout }) => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [vistorias, setVistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVistoria, setSelectedVistoria] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState({
    tipo: 'periodica',
    data_vistoria: new Date().toISOString().split('T')[0],
    km_veiculo: '',
    observacoes: '',
    estado_geral: 'bom',
    itens_verificados: {},
    proxima_vistoria: ''
  });

  const checklistItems = [
    { key: 'pneus', label: 'Pneus' },
    { key: 'freios', label: 'Freios' },
    { key: 'luzes', label: 'Luzes' },
    { key: 'lataria', label: 'Lataria' },
    { key: 'interior', label: 'Interior' },
    { key: 'motor', label: 'Motor' },
    { key: 'transmissao', label: 'Transmissão' },
    { key: 'suspensao', label: 'Suspensão' },
    { key: 'ar_condicionado', label: 'Ar Condicionado' },
    { key: 'eletronicos', label: 'Eletrônicos' }
  ];

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Load vehicle data
      const vehicleRes = await axios.get(`${API_URL}/api/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicle(vehicleRes.data);

      // Load vistorias
      const vistoriasRes = await axios.get(`${API_URL}/api/vehicles/${vehicleId}/vistorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVistorias(vistoriasRes.data);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateVistoria = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API_URL}/api/vehicles/${vehicleId}/vistorias`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowCreateModal(false);
      loadData();
      
      // Reset form
      setFormData({
        tipo: 'periodica',
        data_vistoria: new Date().toISOString().split('T')[0],
        km_veiculo: '',
        observacoes: '',
        estado_geral: 'bom',
        itens_verificados: {},
        proxima_vistoria: ''
      });
    } catch (error) {
      console.error('Error creating vistoria:', error);
      alert('Erro ao criar vistoria');
    }
  };

  const handleUploadPhoto = async (vistoriaId, file) => {
    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      await axios.post(
        `${API_URL}/api/vehicles/${vehicleId}/vistorias/${vistoriaId}/upload-foto`,
        formDataUpload,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      loadData();
      setUploadingPhoto(false);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Erro ao fazer upload da foto');
      setUploadingPhoto(false);
    }
  };

  const handleGeneratePDF = async (vistoriaId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/api/vehicles/${vehicleId}/vistorias/${vistoriaId}/gerar-pdf`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.pdf_url) {
        window.open(response.data.pdf_url, '_blank');
      }
      
      loadData();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF');
    }
  };

  const handleChecklistChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      itens_verificados: {
        ...prev.itens_verificados,
        [key]: value
      }
    }));
  };

  const getEstadoBadge = (estado) => {
    const variants = {
      excelente: 'bg-green-100 text-green-800',
      bom: 'bg-blue-100 text-blue-800',
      razoavel: 'bg-yellow-100 text-yellow-800',
      mau: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[estado] || variants.bom}>
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const getTipoBadge = (tipo) => {
    const variants = {
      entrada: 'bg-purple-100 text-purple-800',
      saida: 'bg-orange-100 text-orange-800',
      periodica: 'bg-blue-100 text-blue-800',
      danos: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[tipo] || variants.periodica}>
        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vistorias do Veículo</h1>
            {vehicle && (
              <p className="text-slate-600 mt-1">
                {vehicle.marca} {vehicle.modelo} - {vehicle.matricula}
              </p>
            )}
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Vistoria
          </Button>
        </div>

        {/* Vistorias List */}
        <div className="grid grid-cols-1 gap-4">
          {vistorias.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-slate-600">Nenhuma vistoria registrada</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowCreateModal(true)}
                >
                  Criar Primeira Vistoria
                </Button>
              </CardContent>
            </Card>
          ) : (
            vistorias.map((vistoria) => (
              <Card key={vistoria.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-slate-600" />
                      <div>
                        <CardTitle className="text-lg">
                          {new Date(vistoria.data_vistoria).toLocaleDateString('pt-PT')}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          {vistoria.responsavel_nome}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTipoBadge(vistoria.tipo)}
                      {getEstadoBadge(vistoria.estado_geral)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vistoria.km_veiculo && (
                      <div>
                        <span className="text-sm text-slate-600">KM: </span>
                        <span className="text-sm font-medium">{vistoria.km_veiculo.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {vistoria.observacoes && (
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Observações:</p>
                        <p className="text-sm">{vistoria.observacoes}</p>
                      </div>
                    )}

                    {vistoria.fotos && vistoria.fotos.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-600 mb-2">Fotos: {vistoria.fotos.length}</p>
                        <div className="flex space-x-2">
                          {vistoria.fotos.slice(0, 3).map((foto, idx) => (
                            <img 
                              key={idx}
                              src={foto}
                              alt={`Foto ${idx + 1}`}
                              className="w-20 h-20 object-cover rounded"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVistoria(vistoria);
                          setShowViewModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                      
                      <label>
                        <Button variant="outline" size="sm" asChild disabled={uploadingPhoto}>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {uploadingPhoto ? 'Enviando...' : 'Adicionar Foto'}
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleUploadPhoto(vistoria.id, e.target.files[0]);
                            }
                          }}
                          disabled={uploadingPhoto}
                        />
                      </label>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGeneratePDF(vistoria.id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Gerar PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create Vistoria Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Vistoria</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Vistoria</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({...formData, tipo: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="periodica">Periódica</SelectItem>
                      <SelectItem value="danos">Danos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data da Vistoria</Label>
                  <Input
                    type="date"
                    value={formData.data_vistoria}
                    onChange={(e) => setFormData({...formData, data_vistoria: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>KM do Veículo</Label>
                  <Input
                    type="number"
                    value={formData.km_veiculo}
                    onChange={(e) => setFormData({...formData, km_veiculo: e.target.value})}
                    placeholder="Quilometragem atual"
                  />
                </div>

                <div>
                  <Label>Estado Geral</Label>
                  <Select
                    value={formData.estado_geral}
                    onValueChange={(value) => setFormData({...formData, estado_geral: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excelente">Excelente</SelectItem>
                      <SelectItem value="bom">Bom</SelectItem>
                      <SelectItem value="razoavel">Razoável</SelectItem>
                      <SelectItem value="mau">Mau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Checklist de Verificação</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 p-4 border rounded">
                  {checklistItems.map((item) => (
                    <div key={item.key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={item.key}
                        checked={formData.itens_verificados[item.key] === true}
                        onChange={(e) => handleChecklistChange(item.key, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor={item.key} className="text-sm">
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                  placeholder="Notas adicionais sobre a vistoria..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Próxima Vistoria</Label>
                <Input
                  type="date"
                  value={formData.proxima_vistoria}
                  onChange={(e) => setFormData({...formData, proxima_vistoria: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateVistoria}>
                Criar Vistoria
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Vistoria Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Vistoria</DialogTitle>
            </DialogHeader>
            
            {selectedVistoria && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Tipo</p>
                    <p className="font-medium">{getTipoBadge(selectedVistoria.tipo)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Estado Geral</p>
                    <p className="font-medium">{getEstadoBadge(selectedVistoria.estado_geral)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Data</p>
                  <p className="font-medium">
                    {new Date(selectedVistoria.data_vistoria).toLocaleDateString('pt-PT')}
                  </p>
                </div>

                {selectedVistoria.km_veiculo && (
                  <div>
                    <p className="text-sm text-slate-600">Quilometragem</p>
                    <p className="font-medium">{selectedVistoria.km_veiculo.toLocaleString()} km</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-600">Responsável</p>
                  <p className="font-medium">{selectedVistoria.responsavel_nome}</p>
                </div>

                {selectedVistoria.observacoes && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Observações</p>
                    <p className="text-sm p-3 bg-slate-50 rounded">{selectedVistoria.observacoes}</p>
                  </div>
                )}

                {selectedVistoria.itens_verificados && Object.keys(selectedVistoria.itens_verificados).length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Itens Verificados</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedVistoria.itens_verificados).map(([key, value]) => {
                        const item = checklistItems.find(i => i.key === key);
                        return (
                          <div key={key} className="flex items-center space-x-2">
                            {value ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm">{item?.label || key}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedVistoria.fotos && selectedVistoria.fotos.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Fotos ({selectedVistoria.fotos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedVistoria.fotos.map((foto, idx) => (
                        <img 
                          key={idx}
                          src={foto}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-75"
                          onClick={() => window.open(foto, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default VehicleVistorias;
