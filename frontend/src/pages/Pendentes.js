import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ClipboardCheck, User, FileText, Download, CheckCircle, XCircle, Eye, Mail, Phone, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LABELS_DOCUMENTOS = {
  carta_conducao: 'Carta de Condução',
  identificacao: 'Identificação (CC/Passaporte/Residência)',
  licenca_tvde: 'Licença TVDE',
  registo_criminal: 'Registo Criminal',
  comprovativo_morada: 'Comprovativo de Morada',
  certidao_comercial: 'Certidão Comercial'
};

const Pendentes = ({ user, onLogout }) => {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [selectedDocumento, setSelectedDocumento] = useState(null);
  const [actionType, setActionType] = useState(''); // 'aprovar_todos', 'rejeitar_todos', 'aprovar_individual', 'rejeitar_individual'

  useEffect(() => {
    fetchPendentes();
  }, []);

  const fetchPendentes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/documentos/pendentes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendentes(response.data);
    } catch (error) {
      console.error('Error fetching pendentes:', error);
      toast.error('Erro ao carregar documentos pendentes');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentoId, tipoDocumento) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/documentos/${documentoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tipoDocumento}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Download iniciado');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao fazer download do documento');
    }
  };

  const handleAprovarTodos = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/documentos/user/${selectedUser.user.id}/aprovar-todos`,
        { aprovado: true, observacoes: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Todos os documentos aprovados! Plano base atribuído.');
      setShowModal(false);
      fetchPendentes();
    } catch (error) {
      console.error('Error approving all documents:', error);
      toast.error('Erro ao aprovar documentos');
    }
  };

  const handleRejeitarTodos = async () => {
    if (!observacoes.trim()) {
      toast.error('Por favor, adicione observações para a rejeição');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/documentos/user/${selectedUser.user.id}/aprovar-todos`,
        { aprovado: false, observacoes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Documentos rejeitados. Utilizador será notificado por email.');
      setShowRejectModal(false);
      setObservacoes('');
      setShowModal(false);
      fetchPendentes();
    } catch (error) {
      console.error('Error rejecting documents:', error);
      toast.error('Erro ao rejeitar documentos');
    }
  };

  const handleAprovarIndividual = async (documentoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/documentos/${documentoId}/aprovar`,
        { aprovado: true, observacoes: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Documento aprovado');
      fetchPendentes();
      
      // Atualizar modal se estiver aberto
      if (selectedUser) {
        const updated = pendentes.find(p => p.user.id === selectedUser.user.id);
        setSelectedUser(updated);
      }
    } catch (error) {
      console.error('Error approving document:', error);
      toast.error('Erro ao aprovar documento');
    }
  };

  const handleRejeitarIndividual = async () => {
    if (!observacoes.trim()) {
      toast.error('Por favor, adicione observações para a rejeição');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/documentos/${selectedDocumento.id}/aprovar`,
        { aprovado: false, observacoes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Documento rejeitado. Utilizador será notificado por email.');
      setShowRejectModal(false);
      setObservacoes('');
      setSelectedDocumento(null);
      fetchPendentes();
      
      // Atualizar modal se estiver aberto
      if (selectedUser) {
        const updated = pendentes.find(p => p.user.id === selectedUser.user.id);
        setSelectedUser(updated);
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast.error('Erro ao rejeitar documento');
    }
  };

  const openUserModal = (pendente) => {
    setSelectedUser(pendente);
    setShowModal(true);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            <span>Documentos Pendentes</span>
          </h1>
          <p className="text-slate-600 mt-1">
            Revise e aprove documentos de novos utilizadores
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">A carregar...</p>
          </div>
        ) : pendentes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Nenhum documento pendente de aprovação</p>
              <p className="text-slate-500 text-sm mt-2">
                Todos os utilizadores foram processados
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendentes.map((pendente) => (
              <Card key={pendente.user.id} className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                        {pendente.user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <CardTitle className="text-base">{pendente.user.name}</CardTitle>
                        <Badge className="mt-1">
                          {pendente.user.role === 'motorista' ? 'Motorista' : 'Parceiro'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{pendente.user.email}</span>
                    </div>
                    {pendente.user.phone && (
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4" />
                        <span>{pendente.user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <FileText className="w-4 h-4" />
                      <span>{pendente.documentos.length} documento(s) pendente(s)</span>
                    </div>
                    
                    <Button
                      onClick={() => openUserModal(pendente)}
                      className="w-full mt-4"
                      variant="outline"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Revisar Documentos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Revisão de Documentos */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Documentos de {selectedUser?.user.name}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Informações do Utilizador */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-3">Informações do Utilizador</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600">Email:</span>
                    <p className="font-medium">{selectedUser.user.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Telefone:</span>
                    <p className="font-medium">{selectedUser.user.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Role:</span>
                    <p className="font-medium capitalize">{selectedUser.user.role}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Data de Registo:</span>
                    <p className="font-medium">
                      {new Date(selectedUser.user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados do Parceiro (se aplicável) */}
              {selectedUser.parceiro_data && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">Dados da Empresa</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Nome da Empresa:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.nome || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">NIF:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.nif || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Morada:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.morada || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Código Postal:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.codigo_postal || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Código Certidão Comercial:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.codigo_certidao_comercial || 'N/A'}</p>
                    </div>
                    {selectedUser.parceiro_data.certidao_permanente && (
                      <div>
                        <span className="text-slate-600">Código Certidão Permanente:</span>
                        <p className="font-medium">{selectedUser.parceiro_data.certidao_permanente}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-600">Responsável:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.responsavel_nome || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Contacto Responsável:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.responsavel_contacto || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Finalidade:</span>
                      <p className="font-medium capitalize">
                        {selectedUser.parceiro_data.finalidade === 'gestao_frota' ? 'Gestão de Frota' : 'Usar Plataforma'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Nº de Veículos:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.numero_veiculos || 0}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Nº de Motoristas:</span>
                      <p className="font-medium">{selectedUser.parceiro_data.numero_motoristas || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dados do Motorista (se aplicável) */}
              {selectedUser.motorista_data && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">Dados do Motorista</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Nome Completo:</span>
                      <p className="font-medium">{selectedUser.motorista_data.nome || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">NIF:</span>
                      <p className="font-medium">{selectedUser.motorista_data.nif || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Data de Nascimento:</span>
                      <p className="font-medium">
                        {selectedUser.motorista_data.data_nascimento 
                          ? new Date(selectedUser.motorista_data.data_nascimento).toLocaleDateString() 
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Morada:</span>
                      <p className="font-medium">{selectedUser.motorista_data.morada || 'N/A'}</p>
                    </div>
                    {selectedUser.motorista_data.parceiro_id && (
                      <div>
                        <span className="text-slate-600">Parceiro Associado:</span>
                        <p className="font-medium">{selectedUser.motorista_data.parceiro_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Documentos */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Documentos Carregados</h3>
                <div className="space-y-3">
                  {selectedUser.documentos.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-800">
                            {LABELS_DOCUMENTOS[doc.tipo_documento]}
                          </h4>
                          <p className="text-sm text-slate-500 mt-1">
                            Carregado em: {new Date(doc.data_upload).toLocaleDateString()} às{' '}
                            {new Date(doc.data_upload).toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Arquivo: {doc.filename}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc.id, doc.tipo_documento)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAprovarIndividual(doc.id)}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedDocumento(doc);
                              setShowRejectModal(true);
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações em Lote */}
              <div className="flex space-x-3 pt-4 border-t">
                <Button
                  onClick={() => setShowModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    setActionType('rejeitar_todos');
                    setShowRejectModal(true);
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar Todos
                </Button>
                <Button
                  onClick={handleAprovarTodos}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar Todos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Documento(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Observações *</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Explique o motivo da rejeição. O utilizador receberá esta mensagem por email."
                rows={4}
                className="mt-2"
              />
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setObservacoes('');
                  setSelectedDocumento(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={
                  selectedDocumento
                    ? handleRejeitarIndividual
                    : handleRejeitarTodos
                }
                variant="destructive"
                className="flex-1"
              >
                Confirmar Rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Pendentes;
