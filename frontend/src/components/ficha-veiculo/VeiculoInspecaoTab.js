import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, Save, Upload, Download } from 'lucide-react';

const VeiculoInspecaoTab = ({
  vehicle,
  inspecaoForm,
  setInspecaoForm,
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
            <ClipboardCheck className="h-5 w-5" />
            Inspeção Periódica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data da Última Inspeção</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={inspecaoForm.data_inspecao}
                  onChange={(e) => setInspecaoForm({...inspecaoForm, data_inspecao: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.inspection?.ultima_inspecao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Validade / Próxima Inspeção</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={inspecaoForm.validade}
                  onChange={(e) => setInspecaoForm({...inspecaoForm, validade: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.inspection?.proxima_inspecao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Centro de Inspeção</Label>
              {canEdit && editMode ? (
                <Input
                  value={inspecaoForm.centro_inspecao}
                  onChange={(e) => setInspecaoForm({...inspecaoForm, centro_inspecao: e.target.value})}
                  placeholder="Nome do centro"
                />
              ) : (
                <p className="font-medium">{vehicle?.inspection?.centro_inspecao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Custo (€)</Label>
              {canEdit && editMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={inspecaoForm.custo}
                  onChange={(e) => setInspecaoForm({...inspecaoForm, custo: e.target.value})}
                  placeholder="0.00"
                />
              ) : (
                <p className="font-medium">€{vehicle?.inspection?.valor || 0}</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              {canEdit && editMode ? (
                <Textarea
                  value={inspecaoForm.observacoes}
                  onChange={(e) => setInspecaoForm({...inspecaoForm, observacoes: e.target.value})}
                  placeholder="Observações da inspeção..."
                  rows={3}
                />
              ) : (
                <p className="font-medium">{vehicle?.inspection?.observacoes || 'Sem observações'}</p>
              )}
            </div>
          </div>

          {/* Documento da Inspeção */}
          <div className="mt-6 pt-4 border-t">
            <Label className="text-base font-semibold mb-3 block">Documento da Inspeção</Label>
            <div className="flex items-center gap-4">
              {vehicle?.inspection?.documento ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.inspection.documento, 'Inspecao')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              ) : (
                <p className="text-sm text-slate-500">Nenhum documento anexado</p>
              )}
              
              {canEdit && editMode && (
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => onUploadDocument(e.target.files[0], 'inspecao')}
                  disabled={uploadingDoc}
                  className="max-w-xs"
                />
              )}
            </div>
          </div>

          {canEdit && editMode && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button onClick={() => onSave()} data-testid="save-inspecao-btn">
                <Save className="w-4 h-4 mr-2" />
                Guardar Inspeção
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VeiculoInspecaoTab;
