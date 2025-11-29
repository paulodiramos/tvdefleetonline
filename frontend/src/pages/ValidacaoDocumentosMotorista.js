import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [observacoes, setObservacoes] = useState('');
  const [editingObservacoes, setEditingObservacoes] = useState(false);

  useEffect(() => {
    fetchMotoristaData();
  }, [motoristaId]);

  useEffect(() => {
    if (motorista) {
      setObservacoes(motorista.observacoes_internas || '');
    }
  }, [motorista]);

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

  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveField = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaId}`,
        { [editingField]: editValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Campo atualizado com sucesso!');
      setEditingField(null);
      fetchMotoristaData();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atualizar campo');
    }
  };

  const handleSaveObservacoes = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/motoristas/${motoristaId}`,
        { observacoes_internas: observacoes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Observações guardadas com sucesso!');
      setEditingObservacoes(false);
      fetchMotoristaData();
    } catch (error) {
      console.error('Error saving observacoes:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar observações');
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
      'documento_identificacao_frente': 'Documento de Identificação - Frente (CC/Residência)',
      'documento_identificacao_verso': 'Documento de Identificação - Verso (CC/Residência)',
      'passport_frente': 'Passaporte',
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

  const getDocumentData = (docType) => {
    const data = {
      'carta_conducao_frente': [
        { label: 'Número da Carta', value: motorista.numero_carta_conducao || 'N/A' }
      ],
      'carta_conducao_verso': [
        { label: 'Categoria', value: motorista.categoria_carta_conducao || 'N/A' },
        { label: 'Data de Emissão', value: motorista.data_emissao_carta ? new Date(motorista.data_emissao_carta).toLocaleDateString('pt-PT') : 'N/A' },
        { label: 'Data de Validade', value: motorista.validade_carta_conducao ? new Date(motorista.validade_carta_conducao).toLocaleDateString('pt-PT') : 'N/A' }
      ],
      'cc_frente': [
        { label: 'Número do CC', value: motorista.numero_cc || 'N/A' },
        { label: 'Validade', value: motorista.validade_cc ? new Date(motorista.validade_cc).toLocaleDateString('pt-PT') : 'N/A' }
      ],
      'documento_identificacao_frente': [
        { label: 'Número do Documento', value: motorista.numero_documento_identificacao || motorista.numero_cc || 'N/A' },
        { label: 'Validade', value: motorista.validade_documento_identificacao ? new Date(motorista.validade_documento_identificacao).toLocaleDateString('pt-PT') : (motorista.validade_cc ? new Date(motorista.validade_cc).toLocaleDateString('pt-PT') : 'N/A') }
      ],
      'documento_identificacao_verso': [
        { label: 'NIF', value: motorista.nif || 'N/A' },
        { label: 'Número Segurança Social', value: motorista.numero_seguranca_social || 'N/A' },
        { label: 'Cartão de Utente', value: motorista.numero_cartao_utente || 'N/A' }
      ],
      'passport_frente': [
        { label: 'Número do Passaporte', value: motorista.numero_passaporte || 'N/A' },
        { label: 'Validade', value: motorista.validade_passaporte ? new Date(motorista.validade_passaporte).toLocaleDateString('pt-PT') : 'N/A' }
      ],
      'cc_verso': [
        { label: 'NIF', value: motorista.nif || 'N/A' },
        { label: 'Segurança Social', value: motorista.numero_seguranca_social || 'N/A' },
        { label: 'Cartão de Utente', value: motorista.numero_cartao_utente || 'N/A' }
      ],
      'licenca_tvde': [
        { label: 'Número da Licença', value: motorista.numero_licenca_tvde || 'N/A' },
        { label: 'Validade', value: motorista.validade_licenca_tvde ? new Date(motorista.validade_licenca_tvde).toLocaleDateString('pt-PT') : 'N/A' }
      ],
      'comprovativo_morada': [
        { label: 'Morada', value: motorista.morada_completa || 'N/A' },
        { label: 'Localidade', value: motorista.localidade || 'N/A' },
        { label: 'Código Postal', value: motorista.codigo_postal || 'N/A' }
      ],
      'registo_criminal': [
        { label: 'Código de Registo', value: motorista.codigo_registo_criminal || 'N/A' },
        { label: 'Validade', value: motorista.validade_registo_criminal ? new Date(motorista.validade_registo_criminal).toLocaleDateString('pt-PT') : 'N/A' }
      ],
      'comprovativo_iban': [
        { label: 'Banco', value: motorista.nome_banco || 'N/A' },
        { label: 'IBAN', value: motorista.iban || 'N/A' }
      ],
      'seguro_comprovativo': [
        { label: 'Seguradora', value: motorista.seguro_seguradora || 'N/A' },
        { label: 'Número da Apólice', value: motorista.seguro_numero_apolice || 'N/A' },
        { label: 'Validade', value: motorista.seguro_validade ? new Date(motorista.seguro_validade).toLocaleDateString('pt-PT') : 'N/A' }
      ]
    };
    return data[docType] || [];
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
  
  // Filtrar documentos removendo os que não devem aparecer na validação
  const excludedDocs = ['licenca_foto', 'contrato', 'additional_docs'];
  const documentTypes = Object.keys(documents).filter(key => 
    documents[key] && !excludedDocs.includes(key)
  );

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
            {/* Apenas Admin, Gestor e Operacional podem aprovar documentos */}
            {(user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional') && (
              <Button
                onClick={handleAprovarTodosDocumentos}
                disabled={processingApproval || motorista.documentos_aprovados}
                className="bg-green-600 hover:bg-green-700"
              >
                {motorista.documentos_aprovados ? '✅ Documentos Aprovados' : 'Aprovar Todos os Documentos'}
              </Button>
            )}
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

        {/* Dados do Motorista - Para Verificação */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Motorista</CardTitle>
            <p className="text-sm text-slate-600">Verifique se os dados correspondem aos documentos</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Nome */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Nome Completo</p>
                    {editingField === 'name' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.name}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('name', motorista.name)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="font-medium">{motorista.email}</p>
                  </div>
                </div>
              </div>

              {/* Telefone */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Telefone</p>
                    {editingField === 'phone' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="+351 912345678"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.phone}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('phone', motorista.phone)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* NIF */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">NIF</p>
                    {editingField === 'nif' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="123456789"
                          maxLength={9}
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.nif || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('nif', motorista.nif)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Licença TVDE */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Licença TVDE</p>
                    {editingField === 'numero_licenca_tvde' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="12345/2024"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.numero_licenca_tvde || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('numero_licenca_tvde', motorista.numero_licenca_tvde)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Registo Criminal */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Código Registo Criminal</p>
                    {editingField === 'codigo_registo_criminal' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                          placeholder="ABCD-1234-EFGH-5678I"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.codigo_registo_criminal || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('codigo_registo_criminal', motorista.codigo_registo_criminal)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Número CC */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Número do CC</p>
                    {editingField === 'numero_cc' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.numero_cc || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('numero_cc', motorista.numero_cc)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Segurança Social */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Número Segurança Social</p>
                    {editingField === 'numero_seguranca_social' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                          maxLength={11}
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.numero_seguranca_social || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('numero_seguranca_social', motorista.numero_seguranca_social)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* IBAN */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">IBAN</p>
                    {editingField === 'iban' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.iban || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('iban', motorista.iban)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Categoria Carta de Condução */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Categoria Carta de Condução</p>
                    {editingField === 'categoria_carta_conducao' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                          placeholder="B, B+E, C, D"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.categoria_carta_conducao || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('categoria_carta_conducao', motorista.categoria_carta_conducao)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Número Carta de Condução */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Número Carta de Condução</p>
                    {editingField === 'numero_carta_conducao' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.numero_carta_conducao || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('numero_carta_conducao', motorista.numero_carta_conducao)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Seguradora */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Seguradora</p>
                    {editingField === 'seguro_seguradora' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.seguro_seguradora || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('seguro_seguradora', motorista.seguro_seguradora)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Número Apólice Seguro */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Número da Apólice de Seguro</p>
                    {editingField === 'seguro_numero_apolice' ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" onClick={handleSaveField}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <p className="font-medium">{motorista.seguro_numero_apolice || 'N/A'}</p>
                    )}
                  </div>
                  {!editingField && (
                    <Button size="sm" variant="ghost" onClick={() => handleEditField('seguro_numero_apolice', motorista.seguro_numero_apolice)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas Internas / Observações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notas Internas / Observações</CardTitle>
                <p className="text-sm text-slate-600 mt-1">Observações visíveis apenas para Admin/Gestor/Parceiro/Operacional</p>
              </div>
              {!editingObservacoes && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setEditingObservacoes(true)}
                >
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingObservacoes ? (
              <div className="space-y-3">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full border rounded-lg p-3 min-h-[120px] text-sm"
                  placeholder="Adicione observações internas sobre este motorista..."
                />
                <div className="flex space-x-2">
                  <Button onClick={handleSaveObservacoes}>
                    Guardar Observações
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingObservacoes(false);
                      setObservacoes(motorista.observacoes_internas || '');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 min-h-[80px]">
                {observacoes || 'Nenhuma observação registada.'}
              </div>
            )}
          </CardContent>
        </Card>

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

              const documentData = getDocumentData(docType);
              
              return (
                <Card key={docType} className={`${isValidado ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-lg">{getDocumentLabel(docType)}</CardTitle>
                      </div>
                      {isValidado ? (
                        <Badge className="bg-green-600 text-white">
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
                    <div className="space-y-4">
                      {/* Dados do Documento */}
                      {documentData.length > 0 && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-xs font-semibold text-slate-700 mb-2 uppercase">Dados no Perfil:</p>
                          <div className="space-y-1">
                            {documentData.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-slate-600">{item.label}:</span>
                                <span className="font-medium text-slate-900">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Informação de Validação */}
                      {validacao && isValidado && (
                        <div className="text-xs text-slate-600 border-t pt-3">
                          <p><strong>Validado por:</strong> {validacao.validado_por || 'N/A'}</p>
                          <p><strong>Data:</strong> {validacao.validado_em ? new Date(validacao.validado_em).toLocaleDateString('pt-PT') : 'N/A'}</p>
                        </div>
                      )}
                      
                      {/* Botões de Ação */}
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
                              className="bg-green-600 hover:bg-green-700 text-white"
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
                            className="border-red-500 text-red-600 hover:bg-red-50"
                            onClick={() => handleValidateDocument(docType, false)}
                          >
                            Revogar Aprovação
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
