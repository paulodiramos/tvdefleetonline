import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Save, Download } from 'lucide-react';

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Dados do Seguro</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="seguradora">Seguradora *</Label>
            <Input
              id="seguradora"
              value={seguroForm.seguradora}
              onChange={(e) => setSeguroForm({...seguroForm, seguradora: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="numero_apolice">Número Apólice *</Label>
            <Input
              id="numero_apolice"
              value={seguroForm.numero_apolice}
              onChange={(e) => setSeguroForm({...seguroForm, numero_apolice: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="agente_seguros">Agente de Seguros</Label>
            <Input
              id="agente_seguros"
              value={seguroForm.agente_seguros}
              onChange={(e) => setSeguroForm({...seguroForm, agente_seguros: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="data_inicio">Data Início *</Label>
            <Input
              id="data_inicio"
              type="date"
              value={seguroForm.data_inicio}
              onChange={(e) => setSeguroForm({...seguroForm, data_inicio: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="data_validade">Data Fim *</Label>
            <Input
              id="data_validade"
              type="date"
              value={seguroForm.data_validade}
              onChange={(e) => setSeguroForm({...seguroForm, data_validade: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="valor">Valor (€) *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={seguroForm.valor}
              onChange={(e) => setSeguroForm({...seguroForm, valor: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="periodicidade">Periodicidade *</Label>
            <select
              id="periodicidade"
              value={seguroForm.periodicidade}
              onChange={(e) => setSeguroForm({...seguroForm, periodicidade: e.target.value})}
              className="w-full p-2 border rounded-md"
              disabled={!canEdit || !editMode}
            >
              <option value="anual">Anual</option>
              <option value="semestral">Semestral</option>
              <option value="trimestral">Trimestral</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
        </div>

        {/* Documentos do Seguro */}
        <div className="pt-4 border-t mt-4 space-y-4">
          <h3 className="font-semibold text-lg">Documentos do Seguro</h3>
          
          {/* Carta Verde */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Carta Verde</Label>
              {vehicle?.documento_carta_verde && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.documento_carta_verde, 'Carta Verde')}
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
                  if (file) onUploadDocument(file, 'carta-verde');
                }}
                disabled={uploadingDoc}
                className="mt-2"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
          </div>

          {/* Condições */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Condições</Label>
              {vehicle?.documento_condicoes && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.documento_condicoes, 'Condições')}
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
                  if (file) onUploadDocument(file, 'condicoes');
                }}
                disabled={uploadingDoc}
                className="mt-2"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
          </div>

          {/* Recibo de Pagamento */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Recibo de Pagamento</Label>
              {vehicle?.documento_recibo_seguro && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.documento_recibo_seguro, 'Recibo')}
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
                  if (file) onUploadDocument(file, 'recibo-seguro');
                }}
                disabled={uploadingDoc}
                className="mt-2"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
          </div>
        </div>

        {canEdit && editMode && onSave && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button onClick={onSave} data-testid="save-seguro-btn">
              <Save className="w-4 h-4 mr-2" />
              Guardar Seguro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VeiculoSeguroTab;
