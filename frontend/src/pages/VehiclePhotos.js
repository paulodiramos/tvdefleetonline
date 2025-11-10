import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Image as ImageIcon, X, Eye } from 'lucide-react';

const VehiclePhotos = ({ user, onLogout }) => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data);
    } catch (error) {
      console.error('Error fetching vehicles', error);
    }
  };

  const handleVehicleSelect = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setSelectedVehicle(vehicle);
    setMessage({ type: '', text: '' });
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedVehicle.fotos && selectedVehicle.fotos.length >= 3) {
      setMessage({ type: 'error', text: 'Máximo de 3 fotos por veículo' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/vehicles/${selectedVehicle.id}/upload-photo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage({ 
        type: 'success', 
        text: `Foto ${response.data.total_photos}/3 carregada com sucesso!` 
      });
      
      // Refresh vehicle data
      fetchVehicles();
      handleVehicleSelect(selectedVehicle.id);
      
      // Clear input
      e.target.value = '';
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao carregar foto' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoIndex) => {
    if (!window.confirm('Tem certeza que deseja remover esta foto?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/vehicles/${selectedVehicle.id}/photos/${photoIndex}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: 'Foto removida com sucesso!' });
      fetchVehicles();
      handleVehicleSelect(selectedVehicle.id);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Erro ao remover foto' 
      });
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Fotos de Veículos</h1>

        {message.text && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Seleção de Veículo */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="vehicle">Veículo (Matrícula)</Label>
            <select
              id="vehicle"
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Selecione um veículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricula} - {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {selectedVehicle && (
          <>
            {/* Upload de Fotos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Fotos ({selectedVehicle.fotos?.length || 0}/3)</span>
                  {(!selectedVehicle.fotos || selectedVehicle.fotos.length < 3) && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPhoto}
                        disabled={uploading}
                        className="hidden"
                      />
                      <Button 
                        as="span"
                        disabled={uploading}
                        className="pointer-events-none"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Carregando...' : 'Adicionar Foto'}
                      </Button>
                    </label>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedVehicle.fotos && selectedVehicle.fotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {selectedVehicle.fotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center border-2 border-slate-200">
                          <ImageIcon className="w-12 h-12 text-slate-400" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-sm text-slate-600">Foto {index + 1}</p>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => window.open(`${API}/${photo}`, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 text-red-600 hover:bg-red-100"
                            onClick={() => handleDeletePhoto(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 truncate">
                          {photo.split('/').pop()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p>Nenhuma foto carregada ainda</p>
                    <p className="text-sm">Clique em "Adicionar Foto" para começar</p>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> As fotos são automaticamente convertidas para PDF para otimização.
                    Você pode carregar até 3 fotos por veículo.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default VehiclePhotos;
