import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Car, User, Edit, Save, X, Upload, Download, Trash2, Plus, CreditCard, MapPin, Users, FileText, Camera } from 'lucide-react';

const VeiculoInfoTab = ({ 
  vehicle, 
  setVehicle, 
  motorista,
  motoristasDisponiveis,
  editMode,
  canEdit,
  user,
  onUploadDocument,
  onDownloadDocument,
  uploadingDoc,
  onSaveVehicle,
  onAssignMotorista,
  onRemoveMotorista,
  onUploadPhoto,
  onDeletePhoto
}) => {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState('');
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  
  // Tipos de combustível disponíveis
  const tiposCombustivel = [
    { value: 'gasolina', label: 'Gasolina' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'eletrico', label: 'Elétrico' },
    { value: 'hibrido', label: 'Híbrido' },
    { value: 'hibrido_plug_in', label: 'Híbrido Plug-in' },
    { value: 'gnv', label: 'GNV' },
    { value: 'glp', label: 'GLP' }
  ];

  const handleAssignMotorista = async () => {
    if (!selectedMotoristaId) {
      toast.error('Selecione um motorista');
      return;
    }
    
    if (onAssignMotorista) {
      await onAssignMotorista(selectedMotoristaId);
    }
    setShowAssignDialog(false);
    setSelectedMotoristaId('');
  };

  const handleRemoveMotorista = async () => {
    if (onRemoveMotorista) {
      await onRemoveMotorista();
    }
    setShowRemoveDialog(false);
  };

  if (!vehicle) return null;

  return (
    <div className="space-y-4">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Car className="w-5 h-5" />
            <span>Dados Básicos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-slate-600">Marca</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.marca || ''}
                  onChange={(e) => setVehicle({...vehicle, marca: e.target.value})}
                  placeholder="Ex: Toyota"
                />
              ) : (
                <p className="font-medium">{vehicle.marca || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Modelo</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.modelo || ''}
                  onChange={(e) => setVehicle({...vehicle, modelo: e.target.value})}
                  placeholder="Ex: Corolla"
                />
              ) : (
                <p className="font-medium">{vehicle.modelo || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Versão</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.versao || ''}
                  onChange={(e) => setVehicle({...vehicle, versao: e.target.value})}
                  placeholder="Ex: Hybrid"
                />
              ) : (
                <p className="font-medium">{vehicle.versao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Ano</Label>
              {canEdit && editMode ? (
                <Input
                  type="number"
                  value={vehicle.ano || ''}
                  onChange={(e) => setVehicle({...vehicle, ano: parseInt(e.target.value) || null})}
                  placeholder="Ex: 2020"
                />
              ) : (
                <p className="font-medium">{vehicle.ano || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Matrícula</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.matricula || ''}
                  onChange={(e) => setVehicle({...vehicle, matricula: e.target.value.toUpperCase()})}
                  placeholder="Ex: AA-00-BB"
                />
              ) : (
                <p className="font-medium">{vehicle.matricula || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">VIN</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.vin || ''}
                  onChange={(e) => setVehicle({...vehicle, vin: e.target.value.toUpperCase()})}
                  placeholder="Número de Chassis"
                />
              ) : (
                <p className="font-medium">{vehicle.vin || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Cor</Label>
              {canEdit && editMode ? (
                <Input
                  value={vehicle.cor || ''}
                  onChange={(e) => setVehicle({...vehicle, cor: e.target.value})}
                  placeholder="Ex: Preto"
                />
              ) : (
                <p className="font-medium">{vehicle.cor || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-600">Tipo de Combustível</Label>
              {canEdit && editMode ? (
                <Select 
                  value={vehicle.tipo_combustivel || ''} 
                  onValueChange={(val) => setVehicle({...vehicle, tipo_combustivel: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposCombustivel.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">
                  {tiposCombustivel.find(t => t.value === vehicle.tipo_combustivel)?.label || vehicle.tipo_combustivel || 'N/A'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motorista Associado */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Motorista Associado</span>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {!motorista ? (
                  <Button 
                    size="sm" 
                    onClick={() => setShowAssignDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Atribuir Motorista
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => setShowRemoveDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {motorista ? (
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">{motorista.name}</p>
                <p className="text-slate-500">{motorista.email}</p>
                {motorista.phone && <p className="text-slate-500">{motorista.phone}</p>}
              </div>
              <Badge className="ml-auto bg-green-100 text-green-800">
                Associado
              </Badge>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum motorista associado</p>
              <p className="text-sm">Clique em "Atribuir Motorista" para associar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentação do Veículo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Documentação</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Documento Único */}
            <div className="border rounded-lg p-4">
              <Label className="text-slate-600 mb-2 block">Documento Único</Label>
              {vehicle.documento_unico_file ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Documento carregado
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onDownloadDocument && onDownloadDocument(vehicle.documento_unico_file, 'documento_unico')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.pdf,.jpg,.jpeg,.png';
                          input.onchange = (e) => {
                            if (e.target.files[0] && onUploadDocument) {
                              onUploadDocument(e.target.files[0], 'documento_unico');
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingDoc}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : canEdit ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      if (e.target.files[0] && onUploadDocument) {
                        onUploadDocument(e.target.files[0], 'documento_unico');
                      }
                    };
                    input.click();
                  }}
                  disabled={uploadingDoc}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Carregar Documento
                </Button>
              ) : (
                <p className="text-slate-400 text-sm">Não disponível</p>
              )}
            </div>

            {/* Certificado de Matrícula */}
            <div className="border rounded-lg p-4">
              <Label className="text-slate-600 mb-2 block">Certificado de Matrícula</Label>
              {vehicle.certificado_matricula_file ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Documento carregado
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onDownloadDocument && onDownloadDocument(vehicle.certificado_matricula_file, 'certificado_matricula')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Não disponível</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Atribuir Motorista */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Motorista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Selecionar Motorista</Label>
            <Select value={selectedMotoristaId} onValueChange={setSelectedMotoristaId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher motorista..." />
              </SelectTrigger>
              <SelectContent>
                {motoristasDisponiveis?.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} - {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignMotorista}>
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Remover Motorista */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Motorista</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Tem a certeza que deseja remover o motorista <strong>{motorista?.name}</strong> deste veículo?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemoveMotorista}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VeiculoInfoTab;
