import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  FileText, Upload, Download, Calendar, 
  CheckCircle, AlertCircle, Clock, XCircle 
} from 'lucide-react';

const MotoristaDocumentos = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [motoristaData, setMotoristaData] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMotoristaData();
  }, []);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristaData(response.data);
    } catch (error) {
      console.error('Error fetching motorista data:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async (docType, file) => {
    if (!file) return;

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);

      await axios.post(
        `${API}/motoristas/${user.id}/upload-documento`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Documento enviado com sucesso!');
      fetchMotoristaData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      aprovado: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Aprovado' },
      pendente: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendente' },
      rejeitado: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejeitado' },
      expirado: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Expirado' }
    };

    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const documentTypes = [
    { key: 'cartao_cidadao', label: 'Cartão de Cidadão', hasExpiry: true },
    { key: 'carta_conducao', label: 'Carta de Condução', hasExpiry: true },
    { key: 'certificado_tvde', label: 'Certificado TVDE', hasExpiry: true },
    { key: 'atestado_medico', label: 'Atestado Médico', hasExpiry: true },
    { key: 'certificado_criminal', label: 'Certificado de Registo Criminal', hasExpiry: true },
    { key: 'comprovativo_morada', label: 'Comprovativo de Morada', hasExpiry: false },
    { key: 'iban', label: 'IBAN/NIB', hasExpiry: false }
  ];

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Meus Documentos
          </h1>
          <p className="text-slate-600 mt-2">
            Faça upload e gerencie os seus documentos
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Mantenha os seus documentos sempre atualizados. Documentos expirados ou pendentes de aprovação podem afetar a sua atividade.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {documentTypes.map((docType) => {
            const docData = motoristaData?.[docType.key];
            const hasDocument = docData?.url || docData?.path;
            const status = docData?.status || 'pendente';
            const dataExpiracao = docData?.data_expiracao;

            return (
              <Card key={docType.key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{docType.label}</CardTitle>
                    {hasDocument && getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasDocument ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-slate-600" />
                          <div>
                            <p className="text-sm font-medium">Documento enviado</p>
                            {docType.hasExpiry && dataExpiracao && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Expira: {new Date(dataExpiracao).toLocaleDateString('pt-PT')}
                              </p>
                            )}
                          </div>
                        </div>
                        {docData?.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(docData.url, '_blank')}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        )}
                      </div>

                      {status === 'rejeitado' && docData?.motivo_rejeicao && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Motivo da rejeição:</strong> {docData.motivo_rejeicao}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <Label htmlFor={`upload-${docType.key}`}>
                          Substituir documento
                        </Label>
                        <Input
                          id={`upload-${docType.key}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocument(docType.key, file);
                          }}
                          disabled={uploading}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label htmlFor={`upload-${docType.key}`}>
                        Enviar {docType.label}
                      </Label>
                      <Input
                        id={`upload-${docType.key}`}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument(docType.key, file);
                        }}
                        disabled={uploading}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos aceites: PDF, JPG, PNG (máx. 10MB)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default MotoristaDocumentos;
