import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Download, FileText, AlertCircle, Shield, CreditCard } from 'lucide-react';

const ValidacaoDocumentosMotorista = ({ user, onLogout }) => {
  const { motoristaId } = useParams();
  const navigate = useNavigate();
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchMotoristaData();
  }, [motoristaId]);

  const fetchMotoristaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotorista(response.data);
    } catch (error) {
      console.error('Error fetching motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (docType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/motoristas/${motoristaId}/documento/${docType}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${docType}_${motorista.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Documento descarregado com sucesso!');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao descarregar documento');
    }
  };

  const handleValidateDocument = async (docType, isValid) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/motoristas/${motoristaId}/validar-documento`,
        {
          doc_type: docType,
          validar: isValid
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(isValid ? 'Documento aprovado!' : 'Documento rejeitado!');
      fetchMotoristaData();
    } catch (error) {
      console.error('Error validating document:', error);
      toast.error(error.response?.data?.detail || 'Erro ao validar documento');
    }
  };

  const handleAprovarTodosDocumentos = async () => {
    if (!window.confirm('Tem certeza que deseja aprovar TODOS os documentos? Após aprovação, o motorista só poderá editar Registo Criminal e IBAN.')) {
      return;
    }

    setProcessingApproval(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaId}/aprovar-todos-documentos`,
        { aprovado_por: user.name },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Todos os documentos aprovados com sucesso!');
      fetchMotoristaData();
    } catch (error) {
      console.error('Error approving all documents:', error);
      toast.error(error.response?.data?.detail || 'Erro ao aprovar documentos');
    } finally {
      setProcessingApproval(false);
    }
  };

  const getDocumentIcon = (docType) => {
    const icons = {
      'cc_frente': FileText,
      'cc_verso': FileText,
      'carta_conducao_frente': CreditCard,
      'carta_conducao_verso': CreditCard,
      'licenca_tvde': Shield,
      'registo_criminal': Shield,
      'comprovativo_iban': CreditCard,
      'comprovativo_morada': FileText,
      'seguro_comprovativo': Shield
    };
    return icons[docType] || FileText;
  };

  const getDocumentLabel = (docType) => {
    const labels = {
      'cc_frente': 'Cartão de Cidadão - Frente',
      'cc_verso': 'Cartão de Cidadão - Verso',
      'documento_frente': 'Documento Identificação - Frente',
      'documento_verso': 'Documento Identificação - Verso',
      'comprovativo_morada': 'Comprovativo de Morada',
      'carta_conducao_frente': 'Carta de Condução - Frente',
      'carta_conducao_verso': 'Carta de Condução - Verso',
      'licenca_tvde': 'Licença TVDE',
      'registo_criminal': 'Registo Criminal',
      'comprovativo_iban': 'Comprovativo IBAN',
      'seguro_comprovativo': 'Comprovativo de Seguro'
    };
    return labels[docType] || docType;
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">A carregar...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!motorista) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Motorista não encontrado</h2>
          <Button onClick={() => navigate('/usuarios')}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  const documents = motorista.documents || {};
  const validacoes = motorista.documents_validacao || {};
  const documentTypes = Object.keys(documents).filter(key => documents[key]);

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Validação de Documentos</h1>
            <p className="text-slate-600 mt-1">Motorista: {motorista.name}</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => navigate('/usuarios')}>
              Voltar
            </Button>
            <Button
              onClick={handleAprovarTodosDocumentos}
              disabled={processingApproval || motorista.documentos_aprovados}
              className="bg-green-600 hover:bg-green-700"
            >
              {motorista.documentos_aprovados ? '✅ Documentos Aprovados' : 'Aprovar Todos os Documentos'}
            </Button>
          </div>
        </div>

        {/* Status Card */}
        {motorista.documentos_aprovados && (
          <Card className="border-l-4 border-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Documentos Aprovados</p>
                  <p className="text-sm text-green-700">
                    Todos os documentos foram validados. O motorista só pode editar Registo Criminal e IBAN.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents List */}
        <div className="grid md:grid-cols-2 gap-4">
          {documentTypes.length === 0 ? (
            <Card className="md:col-span-2">
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhum documento enviado ainda</p>
              </CardContent>
            </Card>
          ) : (
            documentTypes.map((docType) => {
              const Icon = getDocumentIcon(docType);
              const validacao = validacoes[docType];
              const isValidado = validacao?.validado || false;

              return (
                <Card key={docType} className={`${isValidado ? 'border-green-200' : 'border-slate-200'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">{getDocumentLabel(docType)}</CardTitle>
                      </div>
                      {isValidado ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aprovado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {validacao && (
                        <div className="text-sm text-slate-600">
                          <p><strong>Validado por:</strong> {validacao.validado_por || 'N/A'}</p>
                          <p><strong>Data:</strong> {validacao.validado_em ? new Date(validacao.validado_em).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        </div>
                      )}
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(docType)}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Descarregar
                        </Button>
                        
                        {!isValidado ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleValidateDocument(docType, true)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleValidateDocument(docType, false)}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Rejeitar
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleValidateDocument(docType, false)}
                          >
                            Revogar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ValidacaoDocumentosMotorista;
