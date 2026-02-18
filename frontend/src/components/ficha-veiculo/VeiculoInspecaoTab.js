import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Save, Download } from 'lucide-react';

const VeiculoInspecaoTab = ({
  vehicle,
  inspecaoForm,
  setInspecaoForm,
  editMode,
  canEdit,
  onSave,
  onUploadDocument,
  onDownloadDocument,
  onDownloadVistoriaTemplate,
  uploadingDoc
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ClipboardCheck className="w-5 h-5" />
          <span>Dados da Inspeção</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="data_inspecao">Data da Inspeção *</Label>
            <Input
              id="data_inspecao"
              type="date"
              value={inspecaoForm.data_inspecao}
              onChange={(e) => setInspecaoForm({...inspecaoForm, data_inspecao: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="validade">Validade *</Label>
            <Input
              id="validade"
              type="date"
              value={inspecaoForm.validade}
              onChange={(e) => setInspecaoForm({...inspecaoForm, validade: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="centro_inspecao">Centro de Inspeção *</Label>
            <Input
              id="centro_inspecao"
              value={inspecaoForm.centro_inspecao}
              onChange={(e) => setInspecaoForm({...inspecaoForm, centro_inspecao: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="Ex: Centro de Inspeção ABC"
            />
          </div>
          <div>
            <Label htmlFor="custo">Custo (€) *</Label>
            <Input
              id="custo"
              type="number"
              step="0.01"
              value={inspecaoForm.custo}
              onChange={(e) => setInspecaoForm({...inspecaoForm, custo: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <textarea
              id="observacoes"
              value={inspecaoForm.observacoes}
              onChange={(e) => setInspecaoForm({...inspecaoForm, observacoes: e.target.value})}
              disabled={!canEdit || !editMode}
              className="w-full p-2 border rounded-md"
              rows="3"
              placeholder="Notas sobre a inspeção..."
            />
          </div>
        </div>

        {/* Documento da Inspeção */}
        <div className="pt-4 border-t mt-4">
          <h3 className="font-semibold text-lg mb-4">Documento da Inspeção</h3>
          
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Certificado/Comprovante de Inspeção</Label>
              {vehicle?.documento_inspecao && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.documento_inspecao, 'Inspeção')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Ver/Download
                </Button>
              )}
            </div>
            {canEdit && editMode && (
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) onUploadDocument(file, 'documento-inspecao');
                }}
                disabled={uploadingDoc}
                className="mt-2"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
          </div>
          
          {/* Template de Vistoria para Apontamentos Manuais */}
          {onDownloadVistoriaTemplate && (
            <div className="border rounded-lg p-4 bg-blue-50 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Ficha de Vistoria (Apontamento Manual)</Label>
                  <p className="text-xs text-slate-500 mt-1">Descarregue uma ficha em PDF para fazer apontamentos manuais da vistoria</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownloadVistoriaTemplate}
                  className="bg-white"
                  data-testid="download-vistoria-template-btn"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </div>

        {canEdit && editMode && onSave && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button onClick={onSave} data-testid="save-inspecao-btn">
              <Save className="w-4 h-4 mr-2" />
              Guardar Inspeção
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VeiculoInspecaoTab;
