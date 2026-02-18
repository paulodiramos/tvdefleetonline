import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Save, Download } from 'lucide-react';

const VeiculoExtintorTab = ({
  vehicle,
  extintorForm,
  setExtintorForm,
  editMode,
  canEdit,
  onSave,
  onUploadExtintorDoc,
  onDownloadDocument,
  uploadingDoc
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>Extintor</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="numeracao_extintor">Numeração/Série</Label>
            <Input
              id="numeracao_extintor"
              value={extintorForm.numeracao}
              onChange={(e) => setExtintorForm({...extintorForm, numeracao: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="Ex: EXT-2024-001"
            />
          </div>
          <div>
            <Label htmlFor="fornecedor_extintor">Fornecedor</Label>
            <Input
              id="fornecedor_extintor"
              value={extintorForm.fornecedor}
              onChange={(e) => setExtintorForm({...extintorForm, fornecedor: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="Ex: Empresa XYZ"
            />
          </div>
          <div>
            <Label htmlFor="empresa_certificacao">Empresa de Certificação</Label>
            <Input
              id="empresa_certificacao"
              value={extintorForm.empresa_certificacao}
              onChange={(e) => setExtintorForm({...extintorForm, empresa_certificacao: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="Ex: Certificadora ABC"
            />
          </div>
          <div>
            <Label htmlFor="data_instalacao">Data de Instalação *</Label>
            <Input
              id="data_instalacao"
              type="date"
              value={extintorForm.data_instalacao}
              onChange={(e) => setExtintorForm({...extintorForm, data_instalacao: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="data_validade_extintor">Data de Validade *</Label>
            <Input
              id="data_validade_extintor"
              type="date"
              value={extintorForm.data_validade}
              onChange={(e) => setExtintorForm({...extintorForm, data_validade: e.target.value})}
              disabled={!canEdit || !editMode}
            />
          </div>
          <div>
            <Label htmlFor="preco_extintor">Preço (€)</Label>
            <Input
              id="preco_extintor"
              type="number"
              step="0.01"
              value={extintorForm.preco}
              onChange={(e) => setExtintorForm({...extintorForm, preco: e.target.value})}
              disabled={!canEdit || !editMode}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Certificado do Extintor */}
        <div className="pt-4 border-t mt-4">
          <h3 className="font-semibold text-lg mb-4">Certificado do Extintor</h3>
          
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Certificado/Inspeção</Label>
              {vehicle?.extintor?.certificado_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.extintor.certificado_url, 'Extintor')}
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
                  if (file) onUploadExtintorDoc(file);
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
            <Button onClick={onSave} data-testid="save-extintor-btn">
              <Save className="w-4 h-4 mr-2" />
              Guardar Extintor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VeiculoExtintorTab;
