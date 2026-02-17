import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Save, Upload, Download, Trash2 } from 'lucide-react';

const VeiculoSeguroTab = ({
  vehicle,
  seguroForm,
  setSeguroForm,
  editMode,
  canEdit,
  onSave,
  onUploadDocument,
  onDownloadDocument,
  uploadingDoc
}) => {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Dados do Seguro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Seguradora</Label>
              {canEdit && editMode ? (
                <Input
                  value={seguroForm.seguradora}
                  onChange={(e) => setSeguroForm({...seguroForm, seguradora: e.target.value})}
                  placeholder="Nome da seguradora"
                />
              ) : (
                <p className="font-medium">{vehicle?.insurance?.seguradora || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Nº Apólice</Label>
              {canEdit && editMode ? (
                <Input
                  value={seguroForm.numero_apolice}
                  onChange={(e) => setSeguroForm({...seguroForm, numero_apolice: e.target.value})}
                  placeholder="Número da apólice"
                />
              ) : (
                <p className="font-medium">{vehicle?.insurance?.numero_apolice || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Agente de Seguros</Label>
              {canEdit && editMode ? (
                <Input
                  value={seguroForm.agente_seguros}
                  onChange={(e) => setSeguroForm({...seguroForm, agente_seguros: e.target.value})}
                  placeholder="Nome do agente"
                />
              ) : (
                <p className="font-medium">{vehicle?.insurance?.agente_seguros || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Periodicidade</Label>
              {canEdit && editMode ? (
                <select
                  value={seguroForm.periodicidade}
                  onChange={(e) => setSeguroForm({...seguroForm, periodicidade: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              ) : (
                <p className="font-medium capitalize">{vehicle?.insurance?.periodicidade || 'Anual'}</p>
              )}
            </div>
            <div>
              <Label>Data Início</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={seguroForm.data_inicio}
                  onChange={(e) => setSeguroForm({...seguroForm, data_inicio: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.insurance?.data_inicio || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Data Validade</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={seguroForm.data_validade}
                  onChange={(e) => setSeguroForm({...seguroForm, data_validade: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.insurance?.data_validade || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Valor (€)</Label>
              {canEdit && editMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={seguroForm.valor}
                  onChange={(e) => setSeguroForm({...seguroForm, valor: e.target.value})}
                  placeholder="0.00"
                />
              ) : (
                <p className="font-medium">€{vehicle?.insurance?.valor || 0}</p>
              )}
            </div>
          </div>

          {/* Documento do Seguro */}
          <div className="mt-6 pt-4 border-t">
            <Label className="text-base font-semibold mb-3 block">Documento do Seguro</Label>
            <div className="flex items-center gap-4">
              {vehicle?.insurance?.documento ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownloadDocument(vehicle.insurance.documento, 'Seguro')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhum documento anexado</p>
              )}
              
              {canEdit && editMode && (
                <div>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => onUploadDocument(e.target.files[0], 'seguro')}
                    disabled={uploadingDoc}
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {canEdit && editMode && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button onClick={() => onSave()} data-testid="save-seguro-btn">
                <Save className="w-4 h-4 mr-2" />
                Guardar Seguro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VeiculoSeguroTab;
