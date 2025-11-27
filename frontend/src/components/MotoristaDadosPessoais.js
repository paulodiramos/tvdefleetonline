import { useState } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Lock } from 'lucide-react';

const DOCUMENTOS_CONFIG = [
  { key: 'documento_identificacao', label: 'Documento de Identificação (CC/BI)', icon: FileText, canEditAfterUpload: false },
  { key: 'carta_conducao_foto', label: 'Carta de Condução', icon: FileText, canEditAfterUpload: false },
  { key: 'licenca_tvde_foto', label: 'Licença TVDE', icon: FileText, canEditAfterUpload: false },
  { key: 'comprovativo_morada', label: 'Comprovativo de Morada', icon: FileText, canEditAfterUpload: false },
  { key: 'iban_comprovativo', label: 'Comprovativo IBAN', icon: FileText, canEditAfterUpload: false },
  { key: 'registo_criminal', label: 'Registo Criminal', icon: FileText, canEditAfterUpload: true },
  { key: 'cv_file', label: 'Curriculum Vitae (Opcional)', icon: FileText, canEditAfterUpload: true },
  { key: 'profile_photo', label: 'Foto de Perfil (Opcional)', icon: FileText, canEditAfterUpload: true },
];

const MotoristaDadosPessoais = ({ motoristaData, onUpdate, userRole }) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(motoristaData || {});
  const [uploading, setUploading] = useState({});

  const canEditPersonalData = ['admin', 'gestao', 'operacional', 'parceiro'].includes(userRole);
  const isMotorista = userRole === 'motorista';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaData.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Dados atualizados com sucesso!');
      setEditMode(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating motorista:', error);
      toast.error('Erro ao atualizar dados');
    }
  };

  const handleDocumentUpload = async (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Verificar permissões
      const docConfig = DOCUMENTOS_CONFIG.find(d => d.key === docType);
      const hasDocument = motoristaData?.documents?.[docType];
      
      if (isMotorista && hasDocument && !docConfig.canEditAfterUpload) {
        toast.error('Apenas administradores podem alterar este documento após o upload inicial.');
        return;
      }

      setUploading(prev => ({ ...prev, [docType]: true }));

      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('doc_type', docType);

        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API}/motoristas/${motoristaData.id}/upload-document`,
          formDataUpload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        toast.success(`${docConfig.label} enviado com sucesso!`);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error uploading document:', error);
        toast.error('Erro ao enviar documento');
      } finally {
        setUploading(prev => ({ ...prev, [docType]: false }));
      }
    };

    input.click();
  };

  const handleDocumentDownload = async (docType) => {
    try {
      const docUrl = motoristaData?.documents?.[docType];
      if (!docUrl) {
        toast.error('Documento não encontrado');
        return;
      }

      window.open(`${API.replace('/api', '')}/${docUrl}`, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao baixar documento');
    }
  };

  const canUploadOrEditDoc = (docConfig) => {
    const hasDocument = motoristaData?.documents?.[docConfig.key];
    
    if (!hasDocument) {
      // Pode fazer upload inicial
      return true;
    }
    
    // Já tem documento
    if (isMotorista) {
      // Motorista só pode editar se permitido
      return docConfig.canEditAfterUpload;
    }
    
    // Admin/Gestor/Operacional/Parceiro podem sempre editar
    return canEditPersonalData;
  };

  return (
    <div className="space-y-6">
      {/* Informações Pessoais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informações Pessoais</CardTitle>
            {canEditPersonalData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => editMode ? handleSave() : setEditMode(true)}
              >
                {editMode ? 'Guardar' : 'Editar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp || ''}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={formData.data_nascimento || ''}
                onChange={(e) => handleChange('data_nascimento', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>NIF</Label>
              <Input
                value={formData.nif || ''}
                onChange={(e) => handleChange('nif', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>Morada Completa</Label>
              <Input
                value={formData.morada_completa || ''}
                onChange={(e) => handleChange('morada_completa', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
            <div>
              <Label>Código Postal</Label>
              <Input
                value={formData.codigo_postal || ''}
                onChange={(e) => handleChange('codigo_postal', e.target.value)}
                disabled={!editMode || !canEditPersonalData}
              />
            </div>
          </div>

          {!canEditPersonalData && (
            <div className="mt-4 bg-blue-50 p-3 rounded flex items-start space-x-2">
              <Lock className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-800">
                Os dados pessoais só podem ser alterados por administradores, gestores ou parceiros.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Carregue os seus documentos. Após o envio inicial, apenas o registo criminal pode ser atualizado por si.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {DOCUMENTOS_CONFIG.map((doc) => {
              const hasDoc = motoristaData?.documents?.[doc.key];
              const canEdit = canUploadOrEditDoc(doc);
              const isUploading = uploading[doc.key];

              return (
                <div key={doc.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <doc.icon className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">{doc.label}</span>
                    </div>
                    {hasDoc ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    )}
                  </div>

                  <div className="flex space-x-2 mt-3">
                    {canEdit ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDocumentUpload(doc.key)}
                        disabled={isUploading}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {isUploading ? 'A enviar...' : hasDoc ? 'Substituir' : 'Carregar'}
                      </Button>
                    ) : hasDoc ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Bloqueado
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDocumentUpload(doc.key)}
                        disabled={isUploading}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Carregar
                      </Button>
                    )}

                    {hasDoc && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDocumentDownload(doc.key)}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {!canEdit && hasDoc && isMotorista && !doc.canEditAfterUpload && (
                    <p className="text-xs text-slate-500 mt-2">
                      Apenas admin pode alterar
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-yellow-50 p-3 rounded">
            <p className="text-xs text-yellow-800">
              <strong>Nota:</strong> Após o envio inicial, apenas o <strong>Registo Criminal</strong> e documentos opcionais 
              podem ser atualizados por si. Os restantes documentos só podem ser alterados por administradores, gestores ou parceiros.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MotoristaDadosPessoais;