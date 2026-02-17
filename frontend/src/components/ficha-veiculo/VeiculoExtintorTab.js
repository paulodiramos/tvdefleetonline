import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Save, Upload, Download } from 'lucide-react';

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
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Extintor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Numeração</Label>
              {canEdit && editMode ? (
                <Input
                  value={extintorForm.numeracao}
                  onChange={(e) => setExtintorForm({...extintorForm, numeracao: e.target.value})}
                  placeholder="Número do extintor"
                />
              ) : (
                <p className="font-medium">{vehicle?.extintor?.numeracao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Fornecedor</Label>
              {canEdit && editMode ? (
                <Input
                  value={extintorForm.fornecedor}
                  onChange={(e) => setExtintorForm({...extintorForm, fornecedor: e.target.value})}
                  placeholder="Nome do fornecedor"
                />
              ) : (
                <p className="font-medium">{vehicle?.extintor?.fornecedor || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Empresa de Certificação</Label>
              {canEdit && editMode ? (
                <Input
                  value={extintorForm.empresa_certificacao}
                  onChange={(e) => setExtintorForm({...extintorForm, empresa_certificacao: e.target.value})}
                  placeholder="Empresa certificadora"
                />
              ) : (
                <p className="font-medium">{vehicle?.extintor?.empresa_certificacao || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Preço (€)</Label>
              {canEdit && editMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={extintorForm.preco}
                  onChange={(e) => setExtintorForm({...extintorForm, preco: e.target.value})}
                  placeholder="0.00"
                />
              ) : (
                <p className="font-medium">€{vehicle?.extintor?.preco || 0}</p>
              )}
            </div>
            <div>
              <Label>Data de Instalação</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={extintorForm.data_instalacao}
                  onChange={(e) => setExtintorForm({...extintorForm, data_instalacao: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.extintor?.data_instalacao || vehicle?.extintor?.data_entrega || 'N/A'}</p>
              )}
            </div>
            <div>
              <Label>Data de Validade</Label>
              {canEdit && editMode ? (
                <Input
                  type="date"
                  value={extintorForm.data_validade}
                  onChange={(e) => setExtintorForm({...extintorForm, data_validade: e.target.value})}
                />
              ) : (
                <p className="font-medium">{vehicle?.extintor?.data_validade || 'N/A'}</p>
              )}
            </div>
          </div>

          {/* Certificado do Extintor */}
          <div className="mt-6 pt-4 border-t">
            <Label className="text-base font-semibold mb-3 block">Certificado do Extintor</Label>
            <div className="flex items-center gap-4">
              {vehicle?.extintor?.documento ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadDocument(vehicle.extintor.documento, 'Extintor')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Certificado
                </Button>
              ) : (
                <p className="text-sm text-slate-500">Nenhum certificado anexado</p>
              )}
              
              {canEdit && editMode && (
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => onUploadExtintorDoc(e.target.files[0])}
                  disabled={uploadingDoc}
                  className="max-w-xs"
                />
              )}
            </div>
          </div>

          {canEdit && editMode && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button onClick={() => onSave()} data-testid="save-extintor-btn">
                <Save className="w-4 h-4 mr-2" />
                Guardar Extintor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VeiculoExtintorTab;
