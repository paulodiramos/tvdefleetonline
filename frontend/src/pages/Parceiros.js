import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Building, Mail, Phone, Car, Edit, FileText, Users, CheckCircle, Clock, Download, Eye, Award, Check, Trash2, Copy, AlertTriangle, XCircle, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Parceiros = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [parceiros, setParceiros] = useState([]);
  const [selectedParceiro, setSelectedParceiro] = useState(null);
  const [motoristas, setMotoristas] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileParceiro, setProfileParceiro] = useState(null);
  const [profileMotoristas, setProfileMotoristas] = useState([]);
  const [profileVeiculos, setProfileVeiculos] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importType, setImportType] = useState('motoristas'); // 'motoristas' ou 'veiculos'
  const [importLoading, setImportLoading] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState(null);
  const [showPlanosDialog, setShowPlanosDialog] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [selectedParceiroForPlano, setSelectedParceiroForPlano] = useState(null);
  const [planoSelecionadoAdmin, setPlanoSelecionadoAdmin] = useState(null);
  const [periodoValidadePlano, setPeriodoValidadePlano] = useState({
    tipo: 'mensal', // mensal, trimestral, semestral, anual, permanente
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    meses: 1
  });
  const [newParceiro, setNewParceiro] = useState({
    name: '',
    email: '',
    phone: '',
    empresa: '',
    nif: '',
    morada: ''
  });
  const [contractForm, setContractForm] = useState({
    tipo_contrato: 'aluguer',
    texto_contrato: '',
    // Campos de Caução
    caucao_texto: '',
    caucao_total: 300,
    caucao_parcelas: 4,
    // Campos de Épocas
    data_inicio_epoca_alta: '',
    data_fim_epoca_alta: '',
    valor_epoca_alta: 300,
    texto_epoca_alta: '',
    data_inicio_epoca_baixa: '',
    data_fim_epoca_baixa: '',
    valor_epoca_baixa: 200,
    texto_epoca_baixa: ''
  });
  const [horarioTemp, setHorarioTemp] = useState({ inicio: '', fim: '' });

  useEffect(() => {
    fetchParceiros();
  }, []);

  const fetchParceiros = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParceiros(response.data);
    } catch (error) {
      console.error('Error fetching parceiros:', error);
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParceiro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/parceiros`, newParceiro, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Parceiro adicionado com sucesso! Password padrão: parceiro123');
      setShowAddDialog(false);
      fetchParceiros();
      setNewParceiro({
        name: '',
        email: '',
        phone: '',
        empresa: '',
        nif: '',
        morada: ''
      });
    } catch (error) {
      console.error('Error adding parceiro:', error);
      toast.error('Erro ao adicionar parceiro');
    }
  };

  const handleSelectParceiro = async (parceiro) => {
    setSelectedParceiro(parceiro);
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch motoristas do parceiro
      const motoristasRes = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_atribuido === parceiro.id);
      setMotoristas(parceiroMotoristas);

      // Fetch vehicles do parceiro
      const vehiclesRes = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroVehicles = vehiclesRes.data.filter(v => v.parceiro_id === parceiro.id);
      setVehicles(parceiroVehicles);

      // Fetch contratos do parceiro
      const contratosRes = await axios.get(`${API}/contratos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiroContratos = contratosRes.data.filter(c => c.parceiro_id === parceiro.id);
      setContratos(parceiroContratos);

      // Fetch templates do parceiro
      try {
        const templatesRes = await axios.get(`${API}/parceiros/${parceiro.id}/templates-contrato`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTemplates(templatesRes.data || []);
      } catch (err) {
        console.log('No templates found for this parceiro');
        setTemplates([]);
      }
      
    } catch (error) {
      console.error('Error fetching parceiro data:', error);
      toast.error('Erro ao carregar dados do parceiro');
    }
  };

  const handleViewProfile = async (parceiro) => {
    try {
      setProfileParceiro(parceiro);
      setShowProfileDialog(true);
      
      const token = localStorage.getItem('token');
      
      // Fetch motoristas and vehicles for this parceiro
      const [motoristasRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/motoristas`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/vehicles`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Filter by parceiro_id
      const parceiroMotoristas = motoristasRes.data.filter(m => m.parceiro_id === parceiro.id);
      const parceiroVeiculos = vehiclesRes.data.filter(v => v.parceiro_id === parceiro.id);
      
      setProfileMotoristas(parceiroMotoristas);
      setProfileVeiculos(parceiroVeiculos);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar perfil do parceiro');
    }
  };

  const loadExampleContractText = () => {
    const exampleText = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS TVDE

Entre:

PRIMEIRO OUTORGANTE (Parceiro):
Nome: {PARCEIRO_NOME}
NIF: {PARCEIRO_NIF}
Morada: {PARCEIRO_MORADA}
Código Postal: {PARCEIRO_CP}
Telefone: {PARCEIRO_TELEFONE}
Email: {PARCEIRO_EMAIL}

Representado por:
Nome: {REP_LEGAL_NOME}
CC: {REP_LEGAL_CC}

E:

SEGUNDO OUTORGANTE (Motorista):
Nome: {MOTORISTA_NOME}
CC: {MOTORISTA_CC}
NIF: {MOTORISTA_NIF}
Morada: {MOTORISTA_MORADA}
Licença TVDE: {MOTORISTA_LICENCA_TVDE}
Nº Segurança Social: {MOTORISTA_SS}

É celebrado o presente contrato de {TIPO_CONTRATO} que se regerá pelas seguintes cláusulas:

CLÁUSULA PRIMEIRA - Objeto
O Primeiro Outorgante coloca à disposição do Segundo Outorgante o veículo {VEICULO_MARCA} {VEICULO_MODELO}, com a matrícula {VEICULO_MATRICULA}, para exercício da atividade TVDE.

CLÁUSULA SEGUNDA - Vigência
O presente contrato tem início em {DATA_INICIO} e vigora por tempo indeterminado.

CLÁUSULA TERCEIRA - Valor
O valor acordado é de {VALOR_SEMANAL}€ por semana.

CLÁUSULA QUARTA - Condições do Veículo
{CONDICOES_VEICULO}

CLÁUSULA QUINTA - Obrigações do Motorista
O Segundo Outorgante obriga-se a:
a) Manter o veículo em bom estado de conservação
b) Cumprir todas as normas de trânsito
c) Efetuar os pagamentos semanais pontualmente
d) Comunicar qualquer dano ou avaria imediatamente

CLÁUSULA SEXTA - Obrigações do Parceiro
O Primeiro Outorgante obriga-se a:
a) Entregar o veículo em perfeitas condições
b) Manter o seguro e documentação em dia
c) Realizar manutenções preventivas

Data de Emissão: {DATA_EMISSAO}

________________________________
{PARCEIRO_NOME}
(Primeiro Outorgante)

________________________________
{MOTORISTA_NOME}
(Segundo Outorgante)`;
    
    setEditingParceiro({...editingParceiro, template_contrato_padrao: exampleText});
    toast.success('Exemplo de contrato carregado!');
  };

  const loadExampleCaucaoText = () => {
    const exampleText = `CLÁUSULA DE CAUÇÃO

O Segundo Outorgante compromete-se a pagar uma caução no valor total de {CAUCAO_TOTAL}€, que será utilizada como garantia de cumprimento das obrigações contratuais.

A caução será paga em {CAUCAO_PARCELAS} prestações semanais, sendo cada prestação no valor de {CAUCAO_TOTAL}/{CAUCAO_PARCELAS}€.

A caução será devolvida ao Segundo Outorgante no prazo de 30 dias após o término do contrato, desde que:
- O veículo seja devolvido nas mesmas condições em que foi entregue
- Não existam dívidas pendentes
- Não existam danos ou avarias não comunicadas

Em caso de danos ao veículo, o valor da caução poderá ser utilizado para cobrir os custos de reparação.`;
    
    setEditingParceiro({...editingParceiro, template_caucao: exampleText});
    toast.success('Exemplo de cláusula de caução carregado!');
  };

  const loadExampleEpocaAltaText = () => {
    const exampleText = `CLÁUSULA DE ÉPOCA ALTA (VERÃO)

Durante o período compreendido entre {DATA_INICIO_EPOCA_ALTA} e {DATA_FIM_EPOCA_ALTA}, considerado época alta, o valor semanal será ajustado para {EPOCA_ALTA_VALOR}€.

Este período corresponde aos meses de maior atividade turística e eventos em Portugal, nomeadamente:
- Festival de Verão
- Época balnear
- Eventos culturais e desportivos
- Aumento de turismo

O ajuste de valor reflete o aumento esperado de procura de serviços TVDE durante este período.`;
    
    setEditingParceiro({...editingParceiro, template_epoca_alta: exampleText});
    toast.success('Exemplo de cláusula de época alta carregado!');
  };

  const loadExampleEpocaBaixaText = () => {
    const exampleText = `CLÁUSULA DE ÉPOCA BAIXA (INVERNO)

Durante o período compreendido entre {DATA_INICIO_EPOCA_BAIXA} e {DATA_FIM_EPOCA_BAIXA}, considerado época baixa, o valor semanal será ajustado para {EPOCA_BAIXA_VALOR}€.

Este período corresponde aos meses de menor atividade turística, caracterizado por:
- Redução do turismo
- Condições climatéricas menos favoráveis
- Menor procura de serviços TVDE
- Período de baixa atividade comercial

O ajuste de valor visa apoiar o motorista durante o período de menor rendimento.`;
    
    setEditingParceiro({...editingParceiro, template_epoca_baixa: exampleText});
    toast.success('Exemplo de cláusula de época baixa carregado!');
  };


  const handleDeleteParceiroFromProfile = async (parceiro) => {
    const parceiroName = parceiro?.nome_empresa || parceiro?.name || 'este parceiro';

    const confirmation = window.prompt(
      `⚠️ ATENÇÃO: Tem certeza que deseja ELIMINAR o parceiro "${parceiroName}"?\n\n` +
      `Esta ação irá:\n` +
      `• Remover permanentemente o parceiro\n` +
      `• Desassociar todos os veículos e motoristas\n` +
      `• Esta ação NÃO pode ser desfeita!\n\n` +
      `Digite "ELIMINAR" para confirmar:`
    );

    if (confirmation !== 'ELIMINAR') {
      if (confirmation !== null) {
        toast.error('Eliminação cancelada. Confirmação incorreta.');
      }
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/parceiros/${parceiro.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Parceiro "${parceiroName}" eliminado com sucesso!`);
      setShowProfileDialog(false);
      setProfileParceiro(null);
      fetchParceiros();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao eliminar parceiro');
    }
  };

  const handleEditParceiro = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/parceiros/${editingParceiro.id}`, editingParceiro, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Parceiro atualizado com sucesso!');
      setShowEditDialog(false);
      setEditingParceiro(null);
      fetchParceiros();
    } catch (error) {
      console.error('Error updating parceiro:', error);
      toast.error('Erro ao atualizar parceiro');
    }
  };

  const fetchPlanos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/planos-parceiro`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanos(response.data);
    } catch (error) {
      console.error('Error fetching planos:', error);
      toast.error('Erro ao carregar planos');
    }
  };


  const handleUploadCertidaoPermanente = async (file) => {
    if (!file) return;
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/parceiros/${profileParceiro.id}/certidao-permanente/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setProfileParceiro({
        ...profileParceiro,
        certidao_permanente_file: response.data.file_path
      });
      
      toast.success('Certidão permanente carregada com sucesso');
    } catch (error) {
      console.error('Error uploading certidão:', error);
      toast.error('Erro ao carregar certidão permanente');
    }
  };

  const handleSaveCertidaoPermanente = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/parceiros/${profileParceiro.id}/certidao-permanente`,
        {
          codigo_certidao_permanente: profileParceiro.codigo_certidao_permanente,
          validade_certidao_permanente: profileParceiro.validade_certidao_permanente
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Dados da certidão permanente atualizados com sucesso');
      
      // Atualizar a lista de parceiros
      fetchParceiros();
    } catch (error) {
      console.error('Error saving certidão data:', error);
      toast.error('Erro ao guardar dados da certidão permanente');
    }
  };

  const handleDownloadCSVExample = (tipo) => {
    window.open(`${API}/parceiros/csv-examples/${tipo}`, '_blank');
    toast.success(`Exemplo de ${tipo} descarregado`);
  };

  const handleImportCSV = async (file) => {
    console.log('handleImportCSV chamado com file:', file);
    
    if (!file) {
      console.log('Nenhum ficheiro selecionado');
      toast.error('Por favor selecione um ficheiro');
      return;
    }
    
    console.log('Ficheiro selecionado:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    setImportLoading(true);
    toast.info('A processar ficheiro...');
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const endpoint = importType === 'motoristas' 
        ? `${API}/parceiros/${selectedParceiro.id}/importar-motoristas`
        : `${API}/parceiros/${selectedParceiro.id}/importar-veiculos`;
      
      console.log('A enviar para endpoint:', endpoint);
      
      const response = await axios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Resposta recebida:', response.data);
      
      // Show results
      const { motoristas_criados, veiculos_criados, erros, total_linhas } = response.data;
      const criados = motoristas_criados || veiculos_criados;
      
      if (erros && erros.length > 0) {
        toast.warning(
          `${criados} de ${total_linhas} importados com sucesso. ${erros.length} erros encontrados.`,
          { duration: 5000 }
        );
        console.error('Erros na importação:', erros);
      } else {
        toast.success(`${criados} ${importType} importados com sucesso!`);
      }
      
      // Refresh data
      handleSelectParceiro(selectedParceiro);
      setShowImportDialog(false);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Erro ao importar CSV: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImportLoading(false);
    }
  };

  const handleSolicitarPlano = async (parceiroId, planoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/parceiros/${parceiroId}/solicitar-plano`,
        { plano_id: planoId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Plano solicitado! Aguardando aprovação do admin.');
      setShowPlanosDialog(false);
      fetchParceiros();
    } catch (error) {
      console.error('Error requesting plan:', error);
      toast.error('Erro ao solicitar plano');
    }
  };

  const handleAtribuirPlanoAdmin = async (parceiroId, planoId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Get plano details
      const planoDetails = planos.find(p => p.id === planoId);
      
      await axios.put(`${API}/parceiros/${parceiroId}`, {
        plano_id: planoId,
        plano_nome: planoDetails.nome,
        plano_data_inicio: periodoValidadePlano.data_inicio,
        plano_data_fim: periodoValidadePlano.tipo === 'permanente' ? null : periodoValidadePlano.data_fim,
        plano_tipo_periodo: periodoValidadePlano.tipo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Plano "${planoDetails.nome}" atribuído com sucesso!`);
      setShowPlanosDialog(false);
      setSelectedParceiroForPlano(null);
      setPlanoSelecionadoAdmin(null);
      setPeriodoValidadePlano({
        tipo: 'mensal',
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: '',
        meses: 1
      });
      fetchParceiros();
    } catch (error) {
      console.error('Error assigning plan:', error);
      toast.error('Erro ao atribuir plano');
    }
  };

  const handleAprovarPlano = async (parceiroId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/admin/parceiros/${parceiroId}/aprovar-plano`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Plano aprovado com sucesso!');
      fetchParceiros();
      if (profileParceiro && profileParceiro.id === parceiroId) {
        setProfileParceiro({...profileParceiro, plano_status: 'ativo'});
      }
    } catch (error) {
      console.error('Error approving plan:', error);
      toast.error('Erro ao aprovar plano');
    }
  };

  // Minutas removed - now using Contrato e Tipos in EditParceiro


  const handleCreateContractTemplate = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!contractForm.texto_contrato) {
      toast.error('Insira o texto do template de contrato');
      return;
    }
    
    if (!contractForm.tipo_contrato) {
      toast.error('Selecione o tipo de contrato');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        nome_template: contractForm.tipo_contrato,
        tipo_contrato: contractForm.tipo_contrato,
        periodicidade_padrao: "semanal",
        valor_base: null,
        valor_caucao: contractForm.caucao_total ? parseFloat(contractForm.caucao_total) : null,
        numero_parcelas_caucao: contractForm.caucao_parcelas ? parseInt(contractForm.caucao_parcelas) : null,
        valor_epoca_alta: contractForm.valor_epoca_alta ? parseFloat(contractForm.valor_epoca_alta) : null,
        valor_epoca_baixa: contractForm.valor_epoca_baixa ? parseFloat(contractForm.valor_epoca_baixa) : null,
        percentagem_motorista: null,
        percentagem_parceiro: null,
        combustivel_incluido: false,
        regime_trabalho: null,
        valor_compra_veiculo: null,
        numero_semanas_compra: null,
        com_slot: false,
        extra_seguro: false,
        valor_extra_seguro: null,
        clausulas_texto: contractForm.texto_contrato
      };

      if (editingTemplate) {
        // Update existing template
        await axios.put(`${API}/templates-contrato/${editingTemplate.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template atualizado com sucesso!');
      } else {
        // Create new template
        await axios.post(`${API}/parceiros/${selectedParceiro.id}/templates-contrato`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template de contrato criado com sucesso!');
      }

      setShowContractDialog(false);
      setEditingTemplate(null);
      setContractForm({ 
        tipo_contrato: 'aluguer_sem_caucao',
        texto_contrato: '',
        caucao_texto: '',
        caucao_total: 300,
        caucao_parcelas: 4,
        data_inicio_epoca_alta: '',
        data_fim_epoca_alta: '',
        valor_epoca_alta: 300,
        texto_epoca_alta: '',
        data_inicio_epoca_baixa: '',
        data_fim_epoca_baixa: '',
        valor_epoca_baixa: 200,
        texto_epoca_baixa: ''
      });
      
      // Refresh templates/contratos
      handleSelectParceiro(selectedParceiro);
    } catch (error) {
      console.error('Error saving contract template:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar template de contrato');
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setContractForm({
      tipo_contrato: template.tipo_contrato,
      texto_contrato: template.clausulas_texto || '',
      caucao_texto: '',
      caucao_total: template.valor_caucao || 300,
      caucao_parcelas: template.numero_parcelas_caucao || 4,
      data_inicio_epoca_alta: '',
      data_fim_epoca_alta: '',
      valor_epoca_alta: template.valor_epoca_alta || 300,
      texto_epoca_alta: '',
      data_inicio_epoca_baixa: '',
      data_fim_epoca_baixa: '',
      valor_epoca_baixa: template.valor_epoca_baixa || 200,
      texto_epoca_baixa: ''
    });
    setShowContractDialog(true);
  };

  const handleDuplicateTemplate = (template) => {
    setEditingTemplate(null); // Não está editando, está criando novo
    setContractForm({
      tipo_contrato: template.tipo_contrato + '_copia',
      texto_contrato: template.clausulas_texto || '',
      caucao_texto: '',
      caucao_total: template.valor_caucao || 300,
      caucao_parcelas: template.numero_parcelas_caucao || 4,
      data_inicio_epoca_alta: '',
      data_fim_epoca_alta: '',
      valor_epoca_alta: template.valor_epoca_alta || 300,
      texto_epoca_alta: '',
      data_inicio_epoca_baixa: '',
      data_fim_epoca_baixa: '',
      valor_epoca_baixa: template.valor_epoca_baixa || 200,
      texto_epoca_baixa: ''
    });
    setShowContractDialog(true);
    toast.info('Template duplicado. Modifique o tipo e salve como novo.');
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/templates-contrato/${templateToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Template deletado com sucesso!');
      setShowDeleteDialog(false);
      setTemplateToDelete(null);
      
      // Refresh templates
      handleSelectParceiro(selectedParceiro);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.response?.data?.detail || 'Erro ao deletar template');
    }
  };

  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template);
    setShowPreviewDialog(true);
  };

  const handleAddHorario = () => {
    if (horarioTemp.inicio && horarioTemp.fim) {
      const horarioStr = `${horarioTemp.inicio}-${horarioTemp.fim}`;
      setContractForm({
        ...contractForm,
        horarios: [...contractForm.horarios, horarioStr]
      });
      setHorarioTemp({ inicio: '', fim: '' });
    }
  };

  const handleRemoveHorario = (index) => {
    const newHorarios = contractForm.horarios.filter((_, i) => i !== index);
    setContractForm({ ...contractForm, horarios: newHorarios });
  };

  const handleDownloadContract = async (contratoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/contratos/${contratoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contratoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract', error);
      toast.error('Erro ao baixar contrato');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendente' },
      'parceiro_assinado': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Parceiro Assinou' },
      'motorista_assinado': { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Motorista Assinou' },
      'completo': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completo' }
    };

    const config = statusConfig[status] || statusConfig['pendente'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  // Vista Detalhada do Parceiro
  if (selectedParceiro) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            @page {
              size: A4;
              margin: 0;
            }
          }
        `}</style>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="outline" onClick={() => setSelectedParceiro(null)} className="mb-2">
                ← Voltar aos Parceiros
              </Button>
              <h1 className="text-3xl font-bold">{selectedParceiro.nome_empresa || selectedParceiro.name || selectedParceiro.email}</h1>
              <p className="text-slate-600">Gerir contratos e motoristas</p>
            </div>
            <Dialog open={showContractDialog} onOpenChange={(open) => {
              setShowContractDialog(open);
              if (!open) {
                setEditingTemplate(null);
                setContractForm({ 
                  tipo_contrato: 'aluguer_sem_caucao',
                  texto_contrato: '',
                  caucao_texto: '',
                  caucao_total: 300,
                  caucao_parcelas: 4,
                  data_inicio_epoca_alta: '',
                  data_fim_epoca_alta: '',
                  valor_epoca_alta: 300,
                  texto_epoca_alta: '',
                  data_inicio_epoca_baixa: '',
                  data_fim_epoca_baixa: '',
                  valor_epoca_baixa: 200,
                  texto_epoca_baixa: ''
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Template de Contrato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Editar Template de Contrato' : 'Criar Template de Contrato'}
                  </DialogTitle>
                  <p className="text-sm text-slate-500">
                    {editingTemplate 
                      ? 'Modifique o template de contrato conforme necessário'
                      : 'Crie um template base que poderá ser usado depois para gerar contratos com motoristas e veículos específicos'
                    }
                  </p>
                </DialogHeader>
                <form onSubmit={handleCreateContractTemplate} className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                    <select
                      id="tipo_contrato"
                      value={contractForm.tipo_contrato}
                      onChange={(e) => setContractForm({...contractForm, tipo_contrato: e.target.value})}
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="aluguer_sem_caucao">Aluguer Sem Caução</option>
                      <option value="aluguer_epocas_sem_caucao">Aluguer com Épocas Sem Caução</option>
                      <option value="aluguer_com_caucao">Aluguer Com Caução (com opção parcelamento)</option>
                      <option value="aluguer_caucao_epocas">Aluguer Com Caução e Épocas (com opção parcelamento)</option>
                      <option value="compra_veiculo">Compra de Veículo</option>
                      <option value="carro_proprio">Carro Próprio (Slot)</option>
                      <option value="comissao_part_time">Comissão Part-Time</option>
                      <option value="comissao_full_time">Comissão Full-Time</option>
                      <option value="motorista_privado">Motorista Privado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="texto_contrato">Texto do Contrato *</Label>
                    <p className="text-xs text-slate-500 mb-2">
                      <strong>Variáveis Disponíveis:</strong>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2 p-3 bg-slate-50 rounded max-h-32 overflow-y-auto">
                      <div><code>{'{'}PARCEIRO_NOME{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_NIF{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_MORADA{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_CP{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_LOCALIDADE{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}PARCEIRO_EMAIL{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_NOME{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_CC{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_CC_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}REP_LEGAL_EMAIL{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_NOME{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CC{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CC_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_NIF{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_MORADA{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CP{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LOCALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_TELEFONE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_CARTA_CONDUCAO_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LICENCA_TVDE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_LICENCA_TVDE_VALIDADE{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_SS{'}'}</code></div>
                      <div><code>{'{'}MOTORISTA_EMAIL{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MARCA{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MODELO{'}'}</code></div>
                      <div><code>{'{'}VEICULO_MATRICULA{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO{'}'}</code></div>
                      <div><code>{'{'}DATA_EMISSAO{'}'}</code></div>
                      <div><code>{'{'}TIPO_CONTRATO{'}'}</code></div>
                      <div><code>{'{'}VALOR_SEMANAL{'}'}</code></div>
                      <div><code>{'{'}COMISSAO{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_TOTAL{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_PARCELAS{'}'}</code></div>
                      <div><code>{'{'}CAUCAO_TEXTO{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}DATA_FIM_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}EPOCA_ALTA_VALOR{'}'}</code></div>
                      <div><code>{'{'}TEXTO_EPOCA_ALTA{'}'}</code></div>
                      <div><code>{'{'}DATA_INICIO_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}DATA_FIM_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}EPOCA_BAIXA_VALOR{'}'}</code></div>
                      <div><code>{'{'}TEXTO_EPOCA_BAIXA{'}'}</code></div>
                      <div><code>{'{'}CONDICOES_VEICULO{'}'}</code></div>
                    </div>
                    <textarea
                      id="texto_contrato"
                      value={contractForm.texto_contrato || ''}
                      onChange={(e) => setContractForm({...contractForm, texto_contrato: e.target.value})}
                      className="w-full p-3 border rounded-md min-h-[200px] text-sm font-mono"
                      placeholder="Cole ou escreva o texto do contrato aqui. Use as variáveis acima para preenchimento automático."
                      required
                    />
                  </div>

                  {/* Seção de Caução - Apenas para tipos com caução */}
                  {(contractForm.tipo_contrato === 'aluguer_com_caucao' || contractForm.tipo_contrato === 'aluguer_caucao_epocas') && (
                    <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-amber-900 flex items-center space-x-2">
                        <span>💰</span>
                        <span>Configuração de Caução</span>
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Valor Total da Caução (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={contractForm.caucao_total}
                            onChange={(e) => setContractForm({...contractForm, caucao_total: parseFloat(e.target.value)})}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Número de Parcelas</Label>
                          <Input
                            type="number"
                            min="1"
                            value={contractForm.caucao_parcelas}
                            onChange={(e) => setContractForm({...contractForm, caucao_parcelas: parseInt(e.target.value)})}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Texto/Cláusula da Caução</Label>
                        <p className="text-xs text-slate-500 mb-1">
                          Texto adicional sobre condições da caução
                        </p>
                        <textarea
                          className="w-full p-2 border rounded-md min-h-[80px] text-sm"
                          placeholder="Ex: A caução será devolvida em 30 dias após o término do contrato..."
                          value={contractForm.caucao_texto || ''}
                          onChange={(e) => setContractForm({...contractForm, caucao_texto: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {/* Seção de Épocas - Apenas para tipos com épocas */}
                  {(contractForm.tipo_contrato === 'aluguer_epocas_sem_caucao' || contractForm.tipo_contrato === 'aluguer_caucao_epocas') && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900 flex items-center space-x-2">
                        <span>📅</span>
                        <span>Configuração de Sazonalidade (Épocas)</span>
                      </h3>
                      
                      {/* Época Alta */}
                      <div className="space-y-2 border-t border-blue-200 pt-3">
                        <h4 className="text-sm font-semibold text-blue-800">Época Alta</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data Início Época Alta</Label>
                            <Input
                              type="date"
                              value={contractForm.data_inicio_epoca_alta}
                              onChange={(e) => setContractForm({...contractForm, data_inicio_epoca_alta: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data Fim Época Alta</Label>
                            <Input
                              type="date"
                              value={contractForm.data_fim_epoca_alta}
                              onChange={(e) => setContractForm({...contractForm, data_fim_epoca_alta: e.target.value})}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Valor Semanal Época Alta (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={contractForm.valor_epoca_alta}
                            onChange={(e) => setContractForm({...contractForm, valor_epoca_alta: parseFloat(e.target.value)})}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Texto/Observações Época Alta</Label>
                          <textarea
                            className="w-full p-2 border rounded-md min-h-[60px] text-xs"
                            placeholder="Ex: Durante verão, maior demanda turística..."
                            value={contractForm.texto_epoca_alta || ''}
                            onChange={(e) => setContractForm({...contractForm, texto_epoca_alta: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Época Baixa */}
                      <div className="space-y-2 border-t border-blue-200 pt-3">
                        <h4 className="text-sm font-semibold text-blue-800">Época Baixa</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data Início Época Baixa</Label>
                            <Input
                              type="date"
                              value={contractForm.data_inicio_epoca_baixa}
                              onChange={(e) => setContractForm({...contractForm, data_inicio_epoca_baixa: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data Fim Época Baixa</Label>
                            <Input
                              type="date"
                              value={contractForm.data_fim_epoca_baixa}
                              onChange={(e) => setContractForm({...contractForm, data_fim_epoca_baixa: e.target.value})}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Valor Semanal Época Baixa (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={contractForm.valor_epoca_baixa}
                            onChange={(e) => setContractForm({...contractForm, valor_epoca_baixa: parseFloat(e.target.value)})}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Texto/Observações Época Baixa</Label>
                          <textarea
                            className="w-full p-2 border rounded-md min-h-[60px] text-xs"
                            placeholder="Ex: Durante inverno, menor movimento..."
                            value={contractForm.texto_epoca_baixa || ''}
                            onChange={(e) => setContractForm({...contractForm, texto_epoca_baixa: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    {editingTemplate ? 'Atualizar Template' : 'Criar Template'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Motoristas</p>
                    <p className="text-2xl font-bold text-emerald-600">{motoristas.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Veículos</p>
                    <p className="text-2xl font-bold text-blue-600">{vehicles.length}</p>
                  </div>
                  <Car className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Contratos</p>
                    <p className="text-2xl font-bold text-purple-600">{contratos.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Importação em Massa */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Upload className="w-5 h-5" />
                Importação em Massa (CSV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Motoristas */}
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="w-6 h-6 text-blue-600" />
                    <h3 className="font-semibold text-slate-800">Motoristas</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Importe múltiplos motoristas de uma só vez usando um ficheiro CSV
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadCSVExample('motoristas')}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descarregar Exemplo
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImportType('motoristas');
                        setShowImportDialog(true);
                        setForceRender(prev => prev + 1);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Importar CSV
                    </Button>
                  </div>
                </div>

                {/* Veículos */}
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Car className="w-6 h-6 text-blue-600" />
                    <h3 className="font-semibold text-slate-800">Veículos</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Importe múltiplos veículos de uma só vez usando um ficheiro CSV
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadCSVExample('veiculos')}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descarregar Exemplo
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImportType('veiculos');
                        setShowImportDialog(true);
                        setForceRender(prev => prev + 1);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Importar CSV
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Instruções:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Descarregue o ficheiro de exemplo</li>
                      <li>Preencha com os seus dados (não altere os cabeçalhos)</li>
                      <li>Guarde como CSV (separado por vírgulas)</li>
                      <li>Faça upload do ficheiro</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Templates de Contrato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Templates de Contrato</span>
                <span className="text-sm font-normal text-slate-500">
                  {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length > 0 ? (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-slate-800">
                              {template.nome_template || template.tipo_contrato}
                            </h3>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              {template.tipo_contrato}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600">
                            {template.valor_caucao && (
                              <div>
                                <span className="font-medium">Caução:</span> €{template.valor_caucao}
                                {template.numero_parcelas_caucao && ` (${template.numero_parcelas_caucao}x)`}
                              </div>
                            )}
                            {template.periodicidade_padrao && (
                              <div>
                                <span className="font-medium">Periodicidade:</span> {template.periodicidade_padrao}
                              </div>
                            )}
                            {template.valor_epoca_alta && (
                              <div>
                                <span className="font-medium">Época Alta:</span> €{template.valor_epoca_alta}
                              </div>
                            )}
                            {template.valor_epoca_baixa && (
                              <div>
                                <span className="font-medium">Época Baixa:</span> €{template.valor_epoca_baixa}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreviewTemplate(template)}
                            title="Visualizar template"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`${API}/templates-contratos/${template.id}/download-pdf`, '_blank')}
                            className="text-green-600 hover:text-green-700"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTemplate(template)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Editar template"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateTemplate(template)}
                            className="text-purple-600 hover:text-purple-700"
                            title="Duplicar template"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTemplateToDelete(template);
                              setShowDeleteDialog(true);
                            }}
                            className="text-red-600 hover:text-red-700"
                            title="Deletar template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum template de contrato criado ainda</p>
                  <p className="text-sm mt-1">Clique em &quot;Criar Template de Contrato&quot; para começar</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de Contratos */}
          <Card>
            <CardHeader>
              <CardTitle>Contratos Gerados</CardTitle>
            </CardHeader>
            <CardContent>
              {contratos.length > 0 ? (
                <div className="space-y-4">
                  {contratos.map((contrato) => (
                    <div key={contrato.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{contrato.motorista_nome}</p>
                          <p className="text-sm text-slate-600">{contrato.vehicle_matricula}</p>
                        </div>
                        {getStatusBadge(contrato.status)}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadContract(contrato.id)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        
                        <p className="text-xs text-slate-500">
                          Criado em: {new Date(contrato.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">Nenhum contrato criado ainda</p>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Lista de Parceiros
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="parceiros-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Parceiros</h1>
            <p className="text-slate-600">Gerir parceiros e contratos</p>
          </div>
          {(user.role === 'admin' || user.role === 'gestor_associado') && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-parceiro-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parceiro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="add-parceiro-dialog">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Parceiro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddParceiro} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={newParceiro.name} onChange={(e) => setNewParceiro({...newParceiro, name: e.target.value})} required data-testid="parceiro-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input id="empresa" value={newParceiro.empresa} onChange={(e) => setNewParceiro({...newParceiro, empresa: e.target.value})} data-testid="parceiro-empresa-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={newParceiro.email} onChange={(e) => setNewParceiro({...newParceiro, email: e.target.value})} required data-testid="parceiro-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={newParceiro.phone} onChange={(e) => setNewParceiro({...newParceiro, phone: e.target.value})} required data-testid="parceiro-phone-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nif">NIF</Label>
                      <Input id="nif" value={newParceiro.nif} onChange={(e) => setNewParceiro({...newParceiro, nif: e.target.value})} data-testid="parceiro-nif-input" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="morada">Morada</Label>
                      <Input id="morada" value={newParceiro.morada} onChange={(e) => setNewParceiro({...newParceiro, morada: e.target.value})} data-testid="parceiro-morada-input" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-parceiro-button">
                    Adicionar Parceiro
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {parceiros.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum parceiro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parceiros.map((parceiro) => (
              <Card 
                key={parceiro.id} 
                className="card-hover cursor-pointer" 
                data-testid={`parceiro-card-${parceiro.id}`}
                onClick={() => handleSelectParceiro(parceiro)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{parceiro.nome_empresa || parceiro.name || parceiro.email}</CardTitle>
                      {parceiro.empresa && (
                        <p className="text-sm text-slate-500 mt-1">{parceiro.empresa}</p>
                      )}
                    </div>
                    <Building className="w-8 h-8 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {/* Plano Badge */}
                    {parceiro.plano_id && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Award className={`w-4 h-4 ${
                          parceiro.plano_status === 'ativo' ? 'text-green-600' :
                          parceiro.plano_status === 'pendente' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`} />
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          parceiro.plano_status === 'ativo' ? 'bg-green-100 text-green-700' :
                          parceiro.plano_status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Plano {parceiro.plano_status === 'ativo' ? 'Ativo' :
                                 parceiro.plano_status === 'pendente' ? 'Pendente' :
                                 parceiro.plano_status}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{parceiro.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{parceiro.phone || parceiro.telefone || 'N/A'}</span>
                    </div>
                    {(parceiro.nif || parceiro.contribuinte_empresa) && (
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-600">NIF:</span>
                        <span className="font-medium">{parceiro.nif || parceiro.contribuinte_empresa}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Veículos:</span>
                        <div className="flex items-center space-x-1">
                          <Car className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-emerald-600">{parceiro.total_vehicles || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Motoristas:</span>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-blue-600">{parceiro.total_motoristas || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProfile(parceiro);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Perfil
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectParceiro(parceiro);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Contratos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Planos Dialog */}
      <Dialog open={showPlanosDialog} onOpenChange={setShowPlanosDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Award className="w-5 h-5" />
              <span>Escolher Plano de Assinatura</span>
            </DialogTitle>
          </DialogHeader>
          {selectedParceiroForPlano && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-slate-700">
                  <strong>Parceiro:</strong> {selectedParceiroForPlano.nome_empresa || selectedParceiroForPlano.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Escolha um plano abaixo. Após a solicitação, o admin precisará aprovar.
                </p>
              </div>

              <div className="grid gap-6">
                {planos.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum plano disponível no momento</p>
                ) : (
                  planos.map((plano) => (
                    <Card key={plano.id} className="hover:shadow-lg transition border-2 hover:border-blue-300">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <Award className="w-6 h-6 text-blue-600" />
                              <h3 className="text-xl font-bold text-slate-800">{plano.nome}</h3>
                            </div>
                            <p className="text-slate-600 mb-4">{plano.descricao}</p>
                            
                            <div className="mb-4">
                              <span className="text-3xl font-bold text-blue-600">
                                €{plano.preco_por_unidade.toFixed(2)}
                              </span>
                              <span className="text-slate-500 ml-2">/ veículo / mês</span>
                            </div>

                            <div className="space-y-2">
                              <p className="font-semibold text-sm text-slate-700">Funcionalidades incluídas:</p>
                              <ul className="space-y-1">
                                {plano.features.map((feature, index) => (
                                  <li key={index} className="flex items-center space-x-2 text-sm text-slate-600">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          <Button
                            className="ml-4 bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              if (user.role === 'admin' || user.role === 'gestao') {
                                setPlanoSelecionadoAdmin(plano);
                              } else {
                                handleSolicitarPlano(selectedParceiroForPlano.id, plano.id);
                              }
                            }}
                          >
                            {user.role === 'admin' || user.role === 'gestao' ? 'Atribuir Plano' : 'Solicitar este Plano'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Configuração de Período (Admin/Gestor) */}
              {planoSelecionadoAdmin && (user.role === 'admin' || user.role === 'gestao') && (
                <div className="p-6 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg text-blue-900">Configurar Período de Validade</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPlanoSelecionadoAdmin(null)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="p-3 bg-white rounded border">
                    <p className="font-semibold text-sm text-slate-700">Plano Selecionado:</p>
                    <p className="text-blue-600 font-bold">{planoSelecionadoAdmin.nome}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Período</Label>
                      <select
                        className="w-full p-2 border rounded mt-1"
                        value={periodoValidadePlano.tipo}
                        onChange={(e) => {
                          const tipo = e.target.value;
                          const hoje = new Date();
                          let dataFim = new Date(hoje);
                          
                          switch(tipo) {
                            case 'mensal': dataFim.setMonth(dataFim.getMonth() + 1); break;
                            case 'trimestral': dataFim.setMonth(dataFim.getMonth() + 3); break;
                            case 'semestral': dataFim.setMonth(dataFim.getMonth() + 6); break;
                            case 'anual': dataFim.setFullYear(dataFim.getFullYear() + 1); break;
                            case 'permanente': dataFim = null; break;
                            default: dataFim.setMonth(dataFim.getMonth() + 1);
                          }
                          
                          setPeriodoValidadePlano({
                            ...periodoValidadePlano,
                            tipo,
                            data_fim: dataFim ? dataFim.toISOString().split('T')[0] : ''
                          });
                        }}
                      >
                        <option value="mensal">1 Mês (Teste)</option>
                        <option value="trimestral">3 Meses</option>
                        <option value="semestral">6 Meses</option>
                        <option value="anual">1 Ano</option>
                        <option value="permanente">Permanente</option>
                        <option value="personalizado">Personalizado</option>
                      </select>
                    </div>

                    <div>
                      <Label>Data de Início</Label>
                      <Input
                        type="date"
                        value={periodoValidadePlano.data_inicio}
                        onChange={(e) => setPeriodoValidadePlano({...periodoValidadePlano, data_inicio: e.target.value})}
                        className="mt-1"
                      />
                    </div>

                    {periodoValidadePlano.tipo !== 'permanente' && (
                      <div>
                        <Label>Data de Fim</Label>
                        <Input
                          type="date"
                          value={periodoValidadePlano.data_fim}
                          onChange={(e) => setPeriodoValidadePlano({...periodoValidadePlano, data_fim: e.target.value})}
                          className="mt-1"
                          disabled={periodoValidadePlano.tipo !== 'personalizado'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setPlanoSelecionadoAdmin(null)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => handleAtribuirPlanoAdmin(selectedParceiroForPlano.id, planoSelecionadoAdmin.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Atribuição
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlanosDialog(false);
                    setSelectedParceiroForPlano(null);
                    setPlanoSelecionadoAdmin(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Parceiro Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="w-5 h-5" />
              <span>Editar Perfil do Parceiro</span>
            </DialogTitle>
          </DialogHeader>
          {editingParceiro && (
            <form onSubmit={handleEditParceiro} className="space-y-6">
              {/* Dados da Empresa */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados da Empresa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_empresa">Nome da Empresa *</Label>
                    <Input
                      id="edit_nome_empresa"
                      value={editingParceiro.nome_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_empresa: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_nif">NIF *</Label>
                    <Input
                      id="edit_nif"
                      value={editingParceiro.contribuinte_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, contribuinte_empresa: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_empresa">Email da Empresa</Label>
                    <Input
                      id="edit_email_empresa"
                      type="email"
                      value={editingParceiro.email_empresa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_empresa: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telefone">Telefone da Empresa</Label>
                    <Input
                      id="edit_telefone"
                      value={editingParceiro.telefone || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telefone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Gestor */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados do Gestor</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_manager">Nome do Gestor *</Label>
                    <Input
                      id="edit_nome_manager"
                      value={editingParceiro.nome_manager || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_manager: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_manager">Email do Gestor</Label>
                    <Input
                      id="edit_email_manager"
                      type="email"
                      value={editingParceiro.email_manager || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_manager: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telemovel">Telemóvel do Gestor</Label>
                    <Input
                      id="edit_telemovel"
                      value={editingParceiro.telemovel || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telemovel: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Gerente (Responsável Adicional) */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dados do Gerente / Responsável</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_nome_gerente">Nome do Gerente</Label>
                    <Input
                      id="edit_nome_gerente"
                      value={editingParceiro.nome_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, nome_gerente: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_email_gerente">Email do Gerente</Label>
                    <Input
                      id="edit_email_gerente"
                      type="email"
                      value={editingParceiro.email_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email_gerente: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_telemovel_gerente">Telemóvel do Gerente</Label>
                    <Input
                      id="edit_telemovel_gerente"
                      value={editingParceiro.telemovel_gerente || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, telemovel_gerente: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Email de Conta */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Email de Acesso ao Sistema</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="edit_email">Email de Conta (Login) *</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editingParceiro.email || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, email: e.target.value})}
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Este é o email usado para login no sistema</p>
                  </div>
                </div>
              </div>

              {/* Morada */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Morada</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit_morada">Morada Completa</Label>
                    <Input
                      id="edit_morada"
                      value={editingParceiro.morada_completa || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, morada_completa: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_codigo_postal">Código Postal</Label>
                    <Input
                      id="edit_codigo_postal"
                      value={editingParceiro.codigo_postal || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, codigo_postal: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_localidade">Localidade</Label>
                    <Input
                      id="edit_localidade"
                      value={editingParceiro.localidade || ''}
                      onChange={(e) => setEditingParceiro({...editingParceiro, localidade: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Minuta removed - now using Contrato e Tipos in EditParceiro page */}

              {/* Cláusulas removed - now using Contrato e Tipos in EditParceiro page */}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingParceiro(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Guardar Alterações
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5" />
              <span>Perfil Completo do Parceiro</span>
            </DialogTitle>
          </DialogHeader>
          {profileParceiro && (
            <div className="space-y-6">
              {/* Plano Section */}
              {profileParceiro.plano_id && (
                <Card className="border-2 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <Award className="w-5 h-5 text-blue-600" />
                        <span>Plano de Assinatura</span>
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        profileParceiro.plano_status === 'ativo' ? 'bg-green-100 text-green-700' :
                        profileParceiro.plano_status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {profileParceiro.plano_status === 'ativo' ? 'Ativo' :
                         profileParceiro.plano_status === 'pendente' ? 'Pendente Aprovação' :
                         profileParceiro.plano_status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Plano ID</p>
                        <p className="font-medium font-mono">{profileParceiro.plano_id}</p>
                      </div>
                      {user.role === 'admin' && profileParceiro.plano_status === 'pendente' && (
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleAprovarPlano(profileParceiro.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aprovar Plano
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Parceiro Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informação do Parceiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-500">Nome da Empresa</label>
                      <p className="font-medium">{profileParceiro.nome_empresa || profileParceiro.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Nome do Gestor</label>
                      <p className="font-medium">{profileParceiro.nome_manager || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500 flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>Email</span>
                      </label>
                      <p className="font-medium">{profileParceiro.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500 flex items-center space-x-1">
                        <Phone className="w-3 h-3" />
                        <span>Telefone</span>
                      </label>
                      <p className="font-medium">{profileParceiro.telefone || profileParceiro.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">NIF</label>
                      <p className="font-medium">{profileParceiro.contribuinte_empresa || profileParceiro.nif || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Telemóvel</label>
                      <p className="font-medium">{profileParceiro.telemovel || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-slate-500">Morada Completa</label>
                      <p className="font-medium">{profileParceiro.morada_completa || profileParceiro.morada || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Código Postal</label>
                      <p className="font-medium">{profileParceiro.codigo_postal || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Localidade</label>
                      <p className="font-medium">{profileParceiro.localidade || 'N/A'}</p>
                    </div>
                    {profileParceiro.codigo_certidao_comercial && (
                      <div className="col-span-2">
                        <label className="text-sm text-slate-500">Código Certidão Comercial</label>
                        <p className="font-medium font-mono">{profileParceiro.codigo_certidao_comercial}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Certidão Permanente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Certidão Permanente</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="codigo_certidao_permanente">Código Certidão Permanente</Label>
                      <Input
                        id="codigo_certidao_permanente"
                        value={profileParceiro.codigo_certidao_permanente || ''}
                        onChange={(e) => setProfileParceiro({...profileParceiro, codigo_certidao_permanente: e.target.value})}
                        placeholder="Insira o código"
                      />
                    </div>
                    <div>
                      <Label htmlFor="validade_certidao_permanente">Validade</Label>
                      <Input
                        id="validade_certidao_permanente"
                        type="date"
                        value={profileParceiro.validade_certidao_permanente || ''}
                        onChange={(e) => setProfileParceiro({...profileParceiro, validade_certidao_permanente: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Upload/Download Section */}
                  <div className="border-t pt-4">
                    <label className="text-sm text-slate-500 mb-2 block">Documento</label>
                    <div className="flex items-center gap-2">
                      {profileParceiro.certidao_permanente_file ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${API}/parceiros/${profileParceiro.id}/certidao-permanente`, '_blank')}
                            className="flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,.jpg,.jpeg,.png';
                              input.onchange = (e) => handleUploadCertidaoPermanente(e.target.files[0]);
                              input.click();
                            }}
                          >
                            Substituir
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.pdf,.jpg,.jpeg,.png';
                            input.onchange = (e) => handleUploadCertidaoPermanente(e.target.files[0]);
                            input.click();
                          }}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Upload Certidão
                        </Button>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleSaveCertidaoPermanente()}
                    className="w-full"
                  >
                    Guardar Alterações
                  </Button>
                </CardContent>
              </Card>

              {/* Motoristas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Motoristas Associados ({profileMotoristas.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profileMotoristas.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Nenhum motorista associado</p>
                  ) : (
                    <div className="space-y-3">
                      {profileMotoristas.map((motorista) => (
                        <div key={motorista.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{motorista.name}</p>
                              <p className="text-sm text-slate-500">{motorista.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">{motorista.phone || 'N/A'}</p>
                            <p className="text-xs text-slate-500">NIF: {motorista.nif || 'N/A'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Veículos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Car className="w-5 h-5" />
                    <span>Veículos Associados ({profileVeiculos.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profileVeiculos.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Nenhum veículo associado</p>
                  ) : (
                    <div className="space-y-3">
                      {profileVeiculos.map((veiculo) => (
                        <div key={veiculo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Car className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{veiculo.marca} {veiculo.modelo}</p>
                              <p className="text-sm text-slate-500">Matrícula: {veiculo.matricula}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">{veiculo.ano || 'N/A'}</p>
                            <p className="text-xs text-slate-500">
                              {veiculo.status === 'disponivel' ? '✓ Disponível' : 
                               veiculo.status === 'em_uso' ? '● Em Uso' : 
                               veiculo.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Button */}
              <div className="flex justify-between items-center pt-4 border-t">
                {/* Botão Eliminar Parceiro - Apenas Admin - à esquerda */}
                {user.role === 'admin' && (
                  <Button
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => handleDeleteParceiroFromProfile(profileParceiro)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Parceiro
                  </Button>
                )}
                
                {/* Outros botões à direita */}
                <div className={`flex ${user.role === 'admin' ? '' : 'w-full justify-end'} space-x-3`}>
                  <Button
                    variant="outline"
                    onClick={() => setShowProfileDialog(false)}
                  >
                    Fechar
                  </Button>
                  {/* Botão Escolher Plano removido temporariamente para período experimental */}
                  {(user.role === 'admin' || user.role === 'gestao') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingParceiro({...profileParceiro});
                        setShowProfileDialog(false);
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar Perfil
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setShowProfileDialog(false);
                      handleSelectParceiro(profileParceiro);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Contratos
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Tem certeza que deseja deletar o template <strong>&quot;{templateToDelete?.nome_template}&quot;</strong>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Atenção:</strong> Esta ação não pode ser desfeita. Contratos já gerados não serão afetados.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteTemplate}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <span>Pré-visualização: {previewTemplate?.nome_template}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="text-slate-600"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="p-6 overflow-y-auto max-h-[calc(95vh-100px)]">
              {/* Simulação de Página A4 */}
              <div className="print-area mx-auto bg-white shadow-2xl" style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm',
                boxSizing: 'border-box',
                fontFamily: 'Georgia, serif'
              }}>
                {/* Cabeçalho do Documento */}
                <div className="text-center mb-8 pb-4 border-b-2 border-slate-300">
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS
                  </h1>
                  <p className="text-sm text-slate-600 uppercase tracking-wide">
                    {previewTemplate.tipo_contrato}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Template ID: {previewTemplate.id?.substring(0, 8)}
                  </p>
                </div>

                {/* Informações do Template */}
                <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                    Condições do Template
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Periodicidade:</span>
                      <span className="font-medium text-slate-800">{previewTemplate.periodicidade_padrao || 'N/A'}</span>
                    </div>
                    {previewTemplate.valor_caucao && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Caução:</span>
                        <span className="font-medium text-slate-800">
                          €{previewTemplate.valor_caucao}
                          {previewTemplate.numero_parcelas_caucao && ` (${previewTemplate.numero_parcelas_caucao}x)`}
                        </span>
                      </div>
                    )}
                    {previewTemplate.valor_epoca_alta && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Época Alta:</span>
                        <span className="font-medium text-slate-800">€{previewTemplate.valor_epoca_alta}</span>
                      </div>
                    )}
                    {previewTemplate.valor_epoca_baixa && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Época Baixa:</span>
                        <span className="font-medium text-slate-800">€{previewTemplate.valor_epoca_baixa}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Texto do Contrato - Formato Documento */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide border-b pb-2">
                    Cláusulas Contratuais
                  </h3>
                  <div className="text-justify leading-relaxed" style={{ 
                    fontSize: '11pt',
                    lineHeight: '1.8',
                    textAlign: 'justify'
                  }}>
                    {previewTemplate.clausulas_texto ? (
                      <pre className="whitespace-pre-wrap font-serif text-slate-800" style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: '11pt'
                      }}>
                        {previewTemplate.clausulas_texto}
                      </pre>
                    ) : (
                      <p className="text-slate-500 italic">Sem texto de contrato definido neste template</p>
                    )}
                  </div>
                </div>

                {/* Rodapé do Documento */}
                <div className="mt-12 pt-8 border-t border-slate-300">
                  <div className="grid grid-cols-2 gap-12 mb-8">
                    <div className="text-center">
                      <div className="border-t-2 border-slate-400 pt-2 mt-16">
                        <p className="text-sm font-semibold text-slate-700">O Parceiro</p>
                        <p className="text-xs text-slate-500 mt-1">{'{PARCEIRO_NOME}'}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t-2 border-slate-400 pt-2 mt-16">
                        <p className="text-sm font-semibold text-slate-700">O Motorista</p>
                        <p className="text-xs text-slate-500 mt-1">{'{MOTORISTA_NOME}'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center text-xs text-slate-400 mt-8">
                    <p>Template: {previewTemplate.nome_template}</p>
                    <p>Data de criação: {previewTemplate.created_at ? new Date(previewTemplate.created_at).toLocaleDateString('pt-PT') : 'N/A'}</p>
                    <p className="mt-2 text-[10px]">
                      Este é um template de contrato. As variáveis serão substituídas pelos dados reais ao gerar o contrato.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center mt-6 pb-4">
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Fechar
                </Button>
                <Button 
                  onClick={() => {
                    setShowPreviewDialog(false);
                    handleEditTemplate(previewTemplate);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import CSV Modal (Sempre no DOM) */}
      {showImportDialog && (
      <div 
        key={`import-modal-${importType}-${forceRender}`}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        onClick={() => setShowImportDialog(false)}
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          zIndex: 9999
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b p-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar {importType === 'motoristas' ? 'Motoristas' : 'Veículos'}
              </h2>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Antes de importar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Descarregue o ficheiro de exemplo</li>
                    <li>Preencha com os seus dados</li>
                    <li>Não altere os cabeçalhos das colunas</li>
                    <li>Guarde como CSV (separado por vírgulas)</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => handleDownloadCSVExample(importType)}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Descarregar Exemplo CSV
              </Button>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    console.log('Input file onChange disparado');
                    const file = e.target.files[0];
                    console.log('Ficheiro do input:', file);
                    if (file) {
                      handleImportCSV(file);
                      // Reset input para permitir selecionar o mesmo ficheiro novamente
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                  id="csv-upload-input"
                />
                <label
                  htmlFor="csv-upload-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">
                    Clique para selecionar o ficheiro CSV
                  </span>
                  <span className="text-xs text-slate-500">
                    Apenas ficheiros .csv são aceites
                  </span>
                </label>
              </div>

              {importLoading && (
                <div className="flex items-center justify-center gap-2 p-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-slate-600">A importar...</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
                className="flex-1"
                disabled={importLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Import CSV Modal - MOVIDO PARA FORA DO BLOCO selectedParceiro */}
      {showImportDialog && selectedParceiro && (
      <div 
        key={`import-modal-${importType}-${forceRender}`}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        onClick={() => setShowImportDialog(false)}
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          zIndex: 9999
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b p-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar {importType === 'motoristas' ? 'Motoristas' : 'Veículos'}
              </h2>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Antes de importar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Descarregue o ficheiro de exemplo</li>
                    <li>Preencha com os seus dados</li>
                    <li>Não altere os cabeçalhos das colunas</li>
                    <li>Guarde como CSV (separado por vírgulas)</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => handleDownloadCSVExample(importType)}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Descarregar Exemplo CSV
              </Button>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    console.log('Input file onChange disparado');
                    const file = e.target.files[0];
                    console.log('Ficheiro do input:', file);
                    if (file) {
                      handleImportCSV(file);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                  id="csv-upload-input-main"
                />
                <label
                  htmlFor="csv-upload-input-main"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">
                    Clique para selecionar o ficheiro CSV
                  </span>
                  <span className="text-xs text-slate-500">
                    Apenas ficheiros .csv são aceites
                  </span>
                </label>
              </div>

              {importLoading && (
                <div className="flex items-center justify-center gap-2 p-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-slate-600">A importar...</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
                className="flex-1"
                disabled={importLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

    </Layout>
  );
};

export default Parceiros;
