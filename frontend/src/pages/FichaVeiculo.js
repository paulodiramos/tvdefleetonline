import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Car, User, Shield, ClipboardCheck, Wrench, Calendar, 
  TrendingUp, History, Edit, Save, X, Plus, FileText, Upload, Download, Trash2, AlertCircle 
} from 'lucide-react';

const FichaVeiculo = ({ user, onLogout }) => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  // Estados dos formulários
  const [seguroForm, setSeguroForm] = useState({
    seguradora: '',
    numero_apolice: '',
    agente_seguros: '',
    data_inicio: '',
    data_validade: '',
    valor: '',
    periodicidade: 'anual'
  });

  const [inspecaoForm, setInspecaoForm] = useState({
    data_inspecao: '',
    validade: '',
    centro_inspecao: '',
    custo: '',
    observacoes: ''
  });

  const [revisaoForm, setRevisaoForm] = useState({
    proxima_revisao_km: '',
    proxima_revisao_data: '',
    proxima_revisao_notas: '',
    proxima_revisao_valor_previsto: ''
  });

  const [agendaForm, setAgendaForm] = useState({
    tipo: 'manutencao',
    titulo: '',
    data: '',
    hora: '',
    descricao: ''
  });
  
  const [editingAgendaId, setEditingAgendaId] = useState(null);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isIntervencaoModalOpen, setIsIntervencaoModalOpen] = useState(false);
  const [editingIntervencao, setEditingIntervencao] = useState(null);

  const [extintorForm, setExtintorForm] = useState({
    numeracao: '',
    fornecedor: '',
    empresa_certificacao: '',
    preco: '',
    data_instalacao: '',
    data_validade: ''
  });

  const [infoForm, setInfoForm] = useState({
    tipo: 'aluguer_sem_caucao',
    periodicidade: 'semanal',
    regime: 'full_time',
    horario_turno_1: '',
    horario_turno_2: '',
    horario_turno_3: '',
    horario_turno_4: '',
    // Aluguer
    valor_aluguer: '',
    valor_caucao: '',
    numero_parcelas_caucao: '',
    // Épocas
    valor_epoca_alta: '',
    valor_epoca_baixa: '',
    // Comissão
    comissao_parceiro: '',
    comissao_motorista: '',
    inclui_combustivel: false,
    // Compra do Veículo
    valor_compra_veiculo: '',
    numero_semanas_compra: '',
    com_slot: false,
    extra_seguro: false,
    valor_extra_seguro: '',
    valor_semanal_compra: '',
    periodo_compra: '',
    valor_acumulado: '',
    valor_falta_cobrar: '',
    custo_slot: '',
    categorias_uber: {
      green: false,
      comfort: false,
      exec: false,
      pet: false,
      xl: false
    },
    categorias_bolt: {
      economy: false,
      comfort: false,
      exec: false,
      pet: false,
      xl: false
    }
  });

  const [historicoForm, setHistoricoForm] = useState({
    data: '',
    titulo: '',
    descricao: '',
    tipo: 'observacao'
  });

  const [historico, setHistorico] = useState([]);
  const [historicoEditavel, setHistoricoEditavel] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [relatorioGanhos, setRelatorioGanhos] = useState({
    ganhos_total: 0,
    despesas_total: 0,
    lucro: 0,
    detalhes: []
  });

  const [relatorioIntervencoes, setRelatorioIntervencoes] = useState({
    interventions: [],
    total: 0
  });

  // Store original form data to restore on cancel
  const [originalInfoForm, setOriginalInfoForm] = useState(null);
  const [originalSeguroForm, setOriginalSeguroForm] = useState(null);
  const [originalInspecaoForm, setOriginalInspecaoForm] = useState(null);
  const [originalRevisaoForm, setOriginalRevisaoForm] = useState(null);
  const [originalExtintorForm, setOriginalExtintorForm] = useState(null);

  // Document upload states
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const canEdit = user.role === 'admin' || user.role === 'gestao' || user.role === 'operacional';

  useEffect(() => {
    fetchVehicleData();
  }, [vehicleId]);

  // Enter edit mode and store original data
  const handleEnterEditMode = () => {
    // Create deep copies of current form states
    setOriginalInfoForm(JSON.parse(JSON.stringify(infoForm)));
    setOriginalSeguroForm(JSON.parse(JSON.stringify(seguroForm)));
    setOriginalInspecaoForm(JSON.parse(JSON.stringify(inspecaoForm)));
    setOriginalRevisaoForm(JSON.parse(JSON.stringify(revisaoForm)));
    setOriginalExtintorForm(JSON.parse(JSON.stringify(extintorForm)));
    setEditMode(true);
  };

  // Cancel editing and restore original data
  const handleCancelEdit = () => {
    // Restore original states with deep copies to force React re-render
    if (originalInfoForm) {
      const restored = JSON.parse(JSON.stringify(originalInfoForm));
      setInfoForm(restored);
    }
    if (originalSeguroForm) {
      const restored = JSON.parse(JSON.stringify(originalSeguroForm));
      setSeguroForm(restored);
    }
    if (originalInspecaoForm) {
      const restored = JSON.parse(JSON.stringify(originalInspecaoForm));
      setInspecaoForm(restored);
    }
    if (originalRevisaoForm) {
      const restored = JSON.parse(JSON.stringify(originalRevisaoForm));
      setRevisaoForm(restored);
    }
    if (originalExtintorForm) {
      const restored = JSON.parse(JSON.stringify(originalExtintorForm));
      setExtintorForm(restored);
    }
    setEditMode(false);
    toast.info('Alterações descartadas');
  };

  // Save all changes with confirmation
  const handleSaveInfo = async (silent = false) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        tipo_contrato: {
          tipo: infoForm.tipo,
          periodicidade: infoForm.periodicidade,
          regime: infoForm.regime,
          horario_turno_1: infoForm.horario_turno_1,
          horario_turno_2: infoForm.horario_turno_2,
          horario_turno_3: infoForm.horario_turno_3,
          horario_turno_4: infoForm.horario_turno_4,
          valor_aluguer: parseFloat(infoForm.valor_aluguer) || null,
          valor_caucao: parseFloat(infoForm.valor_caucao) || null,
          numero_parcelas_caucao: parseInt(infoForm.numero_parcelas_caucao) || null,
          valor_epoca_alta: parseFloat(infoForm.valor_epoca_alta) || null,
          valor_epoca_baixa: parseFloat(infoForm.valor_epoca_baixa) || null,
          comissao_parceiro: parseFloat(infoForm.comissao_parceiro) || null,
          comissao_motorista: parseFloat(infoForm.comissao_motorista) || null,
          inclui_combustivel: infoForm.inclui_combustivel || false,
          valor_compra_veiculo: parseFloat(infoForm.valor_compra_veiculo) || null,
          numero_semanas_compra: parseInt(infoForm.numero_semanas_compra) || null,
          com_slot: infoForm.com_slot || false,
          extra_seguro: infoForm.extra_seguro || false,
          valor_extra_seguro: parseFloat(infoForm.valor_extra_seguro) || null,
          valor_semanal_compra: parseFloat(infoForm.valor_semanal_compra) || null,
          periodo_compra: parseInt(infoForm.periodo_compra) || null,
          valor_acumulado: parseFloat(infoForm.valor_acumulado) || null,
          valor_falta_cobrar: parseFloat(infoForm.valor_falta_cobrar) || null,
          custo_slot: parseFloat(infoForm.custo_slot) || null
        },
        categorias_uber: infoForm.categorias_uber,
        categorias_bolt: infoForm.categorias_bolt
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!silent) {
        toast.success('Informações atualizadas com sucesso!');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('Error saving info:', error);
      if (!silent) toast.error('Erro ao salvar informações');
      throw error;
    }
  };

  const handleSaveAllChanges = async () => {
    const confirmed = window.confirm('Tem certeza que deseja guardar todas as alterações?');
    if (!confirmed) return;

    try {
      // Save all forms silently (no individual toasts)
      await handleSaveInfo(true);
      await handleSaveSeguro(true);
      await handleSaveInspecao(true);
      await handleSaveRevisao(true);
      await handleSaveExtintor(true);
      
      // Refresh data and exit edit mode
      await fetchVehicleData();
      setEditMode(false);
      toast.success('Todas as alterações foram guardadas com sucesso!');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erro ao guardar algumas alterações');
    }
  };

  const fetchVehicleData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Get vehicle
      const vehicleRes = await axios.get(`${API}/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicle(vehicleRes.data);

      // Get motorista if assigned
      if (vehicleRes.data.motorista_atribuido) {
        const motoristaRes = await axios.get(`${API}/motoristas/${vehicleRes.data.motorista_atribuido}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMotorista(motoristaRes.data);
      }

      // Load existing data into forms
      if (vehicleRes.data.insurance) {
        setSeguroForm({
          seguradora: vehicleRes.data.insurance.seguradora || '',
          numero_apolice: vehicleRes.data.insurance.numero_apolice || '',
          agente_seguros: vehicleRes.data.insurance.agente_seguros || '',
          data_inicio: vehicleRes.data.insurance.data_inicio || '',
          data_validade: vehicleRes.data.insurance.data_validade || '',
          valor: vehicleRes.data.insurance.valor || '',
          periodicidade: vehicleRes.data.insurance.periodicidade || 'anual'
        });
      }

      if (vehicleRes.data.inspection) {
        setInspecaoForm({
          data_inspecao: vehicleRes.data.inspection.ultima_inspecao || '',
          validade: vehicleRes.data.inspection.proxima_inspecao || '',
          centro_inspecao: vehicleRes.data.inspection.centro_inspecao || '',
          custo: vehicleRes.data.inspection.valor || '',
          observacoes: vehicleRes.data.inspection.observacoes || ''
        });
      }

      if (vehicleRes.data.extintor) {
        setExtintorForm({
          numeracao: vehicleRes.data.extintor.numeracao || '',
          fornecedor: vehicleRes.data.extintor.fornecedor || '',
          empresa_certificacao: vehicleRes.data.extintor.empresa_certificacao || '',
          preco: vehicleRes.data.extintor.preco || '',
          data_instalacao: vehicleRes.data.extintor.data_instalacao || vehicleRes.data.extintor.data_entrega || '',
          data_validade: vehicleRes.data.extintor.data_validade || ''
        });
      }

      // Load vehicle info form
      if (vehicleRes.data.tipo_contrato) {
        setInfoForm({
          tipo: vehicleRes.data.tipo_contrato.tipo || 'aluguer_sem_caucao',
          periodicidade: vehicleRes.data.tipo_contrato.periodicidade || 'semanal',
          regime: vehicleRes.data.tipo_contrato.regime || 'full_time',
          horario_turno_1: vehicleRes.data.tipo_contrato.horario_turno_1 || '',
          horario_turno_2: vehicleRes.data.tipo_contrato.horario_turno_2 || '',
          horario_turno_3: vehicleRes.data.tipo_contrato.horario_turno_3 || '',
          horario_turno_4: vehicleRes.data.tipo_contrato.horario_turno_4 || '',
          valor_aluguer: vehicleRes.data.tipo_contrato.valor_aluguer || '',
          valor_caucao: vehicleRes.data.tipo_contrato.valor_caucao || '',
          numero_parcelas_caucao: vehicleRes.data.tipo_contrato.numero_parcelas_caucao || '',
          valor_epoca_alta: vehicleRes.data.tipo_contrato.valor_epoca_alta || '',
          valor_epoca_baixa: vehicleRes.data.tipo_contrato.valor_epoca_baixa || '',
          comissao_parceiro: vehicleRes.data.tipo_contrato.comissao_parceiro || '',
          comissao_motorista: vehicleRes.data.tipo_contrato.comissao_motorista || '',
          inclui_combustivel: vehicleRes.data.tipo_contrato.inclui_combustivel || false,
          valor_compra_veiculo: vehicleRes.data.tipo_contrato.valor_compra_veiculo || '',
          numero_semanas_compra: vehicleRes.data.tipo_contrato.numero_semanas_compra || '',
          com_slot: vehicleRes.data.tipo_contrato.com_slot || false,
          extra_seguro: vehicleRes.data.tipo_contrato.extra_seguro || false,
          valor_extra_seguro: vehicleRes.data.tipo_contrato.valor_extra_seguro || '',
          valor_semanal_compra: vehicleRes.data.tipo_contrato.valor_semanal_compra || '',
          periodo_compra: vehicleRes.data.tipo_contrato.periodo_compra || '',
          valor_acumulado: vehicleRes.data.tipo_contrato.valor_acumulado || '',
          valor_falta_cobrar: vehicleRes.data.tipo_contrato.valor_falta_cobrar || '',
          custo_slot: vehicleRes.data.tipo_contrato.custo_slot || '',
          categorias_uber: vehicleRes.data.categorias_uber || {
            green: false,
            comfort: false,
            exec: false,
            pet: false,
            xl: false
          },
          categorias_bolt: vehicleRes.data.categorias_bolt || {
            economy: false,
            comfort: false,
            exec: false,
            pet: false,
            xl: false
          }
        });
      }

      // Fetch historico
      const historicoRes = await axios.get(`${API}/vehicles/${vehicleId}/historico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorico(historicoRes.data);

      // Load historico editavel
      setHistoricoEditavel(vehicleRes.data.historico_editavel || []);

      // Fetch agenda (optional - don't fail if error)
      try {
        const agendaRes = await axios.get(`${API}/vehicles/${vehicleId}/agenda`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAgenda(agendaRes.data || []);
      } catch (err) {
        console.log('No agenda found, using empty array');
        setAgenda([]);
      }

      // Fetch relatorio ganhos (optional - don't fail if error)
      try {
        const relatorioRes = await axios.get(`${API}/vehicles/${vehicleId}/relatorio-ganhos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRelatorioGanhos(relatorioRes.data);
      } catch (err) {
        console.log('No financial report found, using defaults');
        setRelatorioGanhos({
          ganhos_total: 0,
          despesas_total: 0,
          lucro: 0,
          detalhes: []
        });
      }

      // Fetch relatorio intervencoes (optional - don't fail if error)
      try {
        const intervencoesRes = await axios.get(`${API}/vehicles/${vehicleId}/relatorio-intervencoes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRelatorioIntervencoes(intervencoesRes.data);
      } catch (err) {
        console.log('No interventions report found, using defaults');
        setRelatorioIntervencoes({
          interventions: [],
          total: 0
        });
      }

    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      toast.error('Erro ao carregar dados do veículo');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeguro = async (silent = false) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        insurance: {
          seguradora: seguroForm.seguradora,
          numero_apolice: seguroForm.numero_apolice,
          agente_seguros: seguroForm.agente_seguros,
          data_inicio: seguroForm.data_inicio,
          data_validade: seguroForm.data_validade,
          valor: parseFloat(seguroForm.valor),
          periodicidade: seguroForm.periodicidade
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!silent) {
        toast.success('Seguro atualizado com sucesso!');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('Error saving insurance:', error);
      if (!silent) toast.error('Erro ao salvar seguro');
      throw error;
    }
  };

  const handleSaveInspecao = async (silent = false) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        inspection: {
          ultima_inspecao: inspecaoForm.data_inspecao,
          proxima_inspecao: inspecaoForm.validade,
          centro_inspecao: inspecaoForm.centro_inspecao,
          valor: parseFloat(inspecaoForm.custo),
          observacoes: inspecaoForm.observacoes
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!silent) {
        toast.success('Inspeção atualizada com sucesso!');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('Error saving inspection:', error);
      if (!silent) toast.error('Erro ao salvar inspeção');
      throw error;
    }
  };

  const handleSaveRevisao = async (silent = false) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        proxima_revisao_km: revisaoForm.proxima_revisao_km ? parseInt(revisaoForm.proxima_revisao_km) : null,
        proxima_revisao_data: revisaoForm.proxima_revisao_data || null,
        proxima_revisao_notas: revisaoForm.proxima_revisao_notas || null,
        proxima_revisao_valor_previsto: revisaoForm.proxima_revisao_valor_previsto ? parseFloat(revisaoForm.proxima_revisao_valor_previsto) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!silent) {
        toast.success('Próxima revisão atualizada!');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('Error saving revision:', error);
      if (!silent) toast.error('Erro ao salvar próxima revisão');
      throw error;
    }
  };

  const handleAddAgenda = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vehicles/${vehicleId}/agenda`, agendaForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Evento adicionado à agenda!');
      setAgendaForm({
        tipo: 'manutencao',
        titulo: '',
        data: '',
        hora: '',
        descricao: ''
      });
      fetchVehicleData();
    } catch (error) {
      console.error('Error adding agenda:', error);
      toast.error('Erro ao adicionar evento');
    }
  };

  const handleEditAgenda = (evento) => {
    setEditingAgendaId(evento.id);
    setAgendaForm({
      tipo: evento.tipo,
      titulo: evento.titulo,
      data: evento.data,
      hora: evento.hora || '',
      descricao: evento.descricao || ''
    });
    setIsAgendaModalOpen(true);
  };

  const handleUpdateAgenda = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}/agenda/${editingAgendaId}`, agendaForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Evento atualizado!');
      setEditingAgendaId(null);
      setIsAgendaModalOpen(false);
      setAgendaForm({
        tipo: 'manutencao',
        titulo: '',
        data: '',
        hora: '',
        descricao: ''
      });
      fetchVehicleData();
    } catch (error) {
      console.error('Error updating agenda:', error);
      toast.error('Erro ao atualizar evento');
    }
  };

  const handleDeleteAgenda = async (eventoId) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/vehicles/${vehicleId}/agenda/${eventoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Evento excluído!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error deleting agenda:', error);
      toast.error('Erro ao excluir evento');
    }
  };

  const handleCancelEditAgenda = () => {
    setEditingAgendaId(null);
    setIsAgendaModalOpen(false);
    setAgendaForm({
      tipo: 'manutencao',
      titulo: '',
      data: '',
      hora: '',
      descricao: ''
    });
  };

  const handleEditIntervencao = (intervencao) => {
    setEditingIntervencao(intervencao);
    setIsIntervencaoModalOpen(true);
  };

  const handleSaveIntervencao = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}/intervencao/${editingIntervencao.id}`, {
        status: editingIntervencao.status
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Intervenção atualizada!');
      setIsIntervencaoModalOpen(false);
      setEditingIntervencao(null);
      fetchVehicleData();
    } catch (error) {
      console.error('Error updating intervencao:', error);
      toast.error('Erro ao atualizar intervenção');
    }
  };


  const handleSaveExtintor = async (silent = false) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, {
        extintor: {
          numeracao: extintorForm.numeracao,
          fornecedor: extintorForm.fornecedor,
          empresa_certificacao: extintorForm.empresa_certificacao,
          preco: parseFloat(extintorForm.preco) || 0,
          data_instalacao: extintorForm.data_instalacao,
          data_validade: extintorForm.data_validade
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!silent) {
        toast.success('Extintor atualizado! Alerta adicionado automaticamente à agenda.');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('Error saving extintor:', error);
      if (!silent) toast.error('Erro ao salvar extintor');
      throw error;
    }
  };

  const handleAddHistorico = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vehicles/${vehicleId}/historico`, historicoForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Entrada adicionada ao histórico!');
      setHistoricoForm({
        data: '',
        titulo: '',
        descricao: '',
        tipo: 'observacao'
      });
      fetchVehicleData();
    } catch (error) {
      console.error('Error adding historico:', error);
      toast.error('Erro ao adicionar ao histórico');
    }
  };

  const handleDeleteHistorico = async (entryId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta entrada?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/vehicles/${vehicleId}/historico/${entryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Entrada removida do histórico!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error deleting historico:', error);
      toast.error('Erro ao remover entrada');
    }
  };

  // Document upload handlers
  const handleUploadDocument = async (file, documentType) => {
    if (!file) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const endpoint = `${API}/vehicles/${vehicleId}/upload-${documentType}`;
      
      await axios.post(endpoint, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Documento enviado com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleUploadExtintorDoc = async (file) => {
    if (!file) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${API}/vehicles/${vehicleId}/upload-extintor-doc`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Certificado do extintor enviado com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error uploading extintor document:', error);
      toast.error('Erro ao enviar certificado do extintor');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async (documentPath, documentName) => {
    if (!documentPath) {
      toast.error('Documento não disponível');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const filename = documentPath.split('/').pop();
      
      // Determine folder based on document path
      let folder = 'vehicle_documents';
      if (documentPath.includes('extintor_docs')) {
        folder = 'extintor_docs';
      }
      
      const response = await axios.get(`${API}/files/${folder}/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao carregar documento');
    }
  };

  // Vehicle photos handlers
  const handleUploadPhoto = async (file) => {
    if (!file) return;

    if (vehicle.fotos_veiculo && vehicle.fotos_veiculo.length >= 3) {
      toast.error('Máximo de 3 fotos permitido');
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vehicles/${vehicleId}/upload-foto`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Foto enviada com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(error.response?.data?.detail || 'Erro ao enviar foto');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeletePhoto = async (photoIndex) => {
    if (!window.confirm('Tem certeza que deseja remover esta foto?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/vehicles/${vehicleId}/fotos/${photoIndex}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Foto removida com sucesso!');
      fetchVehicleData();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const handleViewPhoto = async (photoPath) => {
    if (!photoPath) return;

    try {
      const token = localStorage.getItem('token');
      const filename = photoPath.split('/').pop();
      const folder = photoPath.includes('vehicle_photos_info') ? 'vehicle_photos_info' : 'vehicles';
      
      const response = await axios.get(`${API}/files/${folder}/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create blob with correct content type
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error viewing photo:', error);
      toast.error('Erro ao carregar foto');
    }
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

  if (!vehicle) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="text-center py-12">
          <p className="text-slate-500">Veículo não encontrado</p>
          <Button onClick={() => navigate('/vehicles')} className="mt-4">
            Voltar aos Veículos
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" onClick={() => navigate('/vehicles')} className="mb-2">
              ← Voltar
            </Button>
            <h1 className="text-3xl font-bold">Ficha do Veículo</h1>
            <p className="text-slate-600">{vehicle.marca} {vehicle.modelo} - {vehicle.matricula}</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {!editMode ? (
                <Button onClick={handleEnterEditMode} variant="default">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button onClick={handleSaveAllChanges} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  <Button onClick={handleCancelEdit} variant="destructive">
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Motorista Atribuído */}
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span>Motorista Atribuído</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {motorista ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold">{motorista.name}</p>
                <p className="text-sm text-slate-600">{motorista.email}</p>
                <p className="text-sm text-slate-600">Telefone: {motorista.personal?.phone || 'N/A'}</p>
                {motorista.professional?.licenca_tvde && (
                  <p className="text-sm text-slate-600">Licença TVDE: {motorista.professional.licenca_tvde}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Nenhum motorista atribuído</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="seguro">Seguro</TabsTrigger>
            <TabsTrigger value="inspecao">Inspeção</TabsTrigger>
            <TabsTrigger value="extintor">Extintor</TabsTrigger>
            <TabsTrigger value="revisao">Revisão/Intervenções</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          {/* Informações Completas */}
          <TabsContent value="info">
            <div className="space-y-4">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Car className="w-5 h-5" />
                    <span>Dados Básicos</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-600">Marca</Label>
                      <p className="font-medium">{vehicle.marca}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Modelo</Label>
                      <p className="font-medium">{vehicle.modelo}</p>
                    </div>
                    {vehicle.versao && (
                      <div>
                        <Label className="text-slate-600">Versão</Label>
                        <p className="font-medium">{vehicle.versao}</p>
                      </div>
                    )}
                    {vehicle.ano && (
                      <div>
                        <Label className="text-slate-600">Ano</Label>
                        <p className="font-medium">{vehicle.ano}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-slate-600">Matrícula</Label>
                      <p className="font-medium">{vehicle.matricula}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Data de Matrícula</Label>
                      <p className="font-medium">{vehicle.data_matricula ? new Date(vehicle.data_matricula).toLocaleDateString('pt-PT') : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Validade da Matrícula</Label>
                      <p className="font-medium">{vehicle.validade_matricula ? new Date(vehicle.validade_matricula).toLocaleDateString('pt-PT') : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Cor</Label>
                      <p className="font-medium">{vehicle.cor}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Combustível</Label>
                      <p className="font-medium">{vehicle.combustivel}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Caixa</Label>
                      <p className="font-medium">{vehicle.caixa}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Lugares</Label>
                      <p className="font-medium">{vehicle.lugares}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">KM Atual</Label>
                      <p className="font-medium">{vehicle.km_atual || 0} km</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Status</Label>
                      {canEdit && editMode ? (
                        <select
                          value={vehicle.status || 'disponivel'}
                          onChange={async (e) => {
                            try {
                              const token = localStorage.getItem('token');
                              await axios.put(`${API}/vehicles/${vehicleId}/status`, 
                                { status: e.target.value },
                                { headers: { Authorization: `Bearer ${token}` }}
                              );
                              toast.success('Status atualizado!');
                              fetchVehicleData();
                            } catch (error) {
                              toast.error('Erro ao atualizar status');
                            }
                          }}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="atribuido">Atribuído</option>
                          <option value="manutencao">Manutenção</option>
                          <option value="venda">Venda</option>
                          <option value="condicoes">Condições</option>
                        </select>
                      ) : (
                        <p className="font-medium capitalize">
                          {vehicle.status === 'disponivel' ? 'Disponível' :
                           vehicle.status === 'atribuido' ? 'Atribuído' :
                           vehicle.status === 'manutencao' ? 'Manutenção' :
                           vehicle.status === 'venda' ? 'Venda' :
                           vehicle.status === 'condicoes' ? 'Condições' :
                           'Disponível'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tipo de Contrato */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tipo de Contrato</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                      {canEdit && editMode ? (
                        <select
                          id="tipo_contrato"
                          value={infoForm.tipo}
                          onChange={(e) => setInfoForm({...infoForm, tipo: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="aluguer">Aluguer</option>
                          <option value="comissao">Comissão</option>
                          <option value="motorista_privado">Motorista Privado</option>
                          <option value="compra_veiculo">Compra do Veículo</option>
                        </select>
                      ) : (
                        <p className="font-medium">
                          {vehicle.tipo_contrato?.tipo === 'aluguer' ? 'Aluguer' :
                           vehicle.tipo_contrato?.tipo === 'comissao' ? 'Comissão' :
                           vehicle.tipo_contrato?.tipo === 'motorista_privado' ? 'Motorista Privado' :
                           vehicle.tipo_contrato?.tipo === 'compra_veiculo' ? 'Compra do Veículo' : 'N/A'}
                        </p>
                      )}
                    </div>

                    {/* Campos específicos por tipo */}
                    {(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'aluguer' && (
                      <div>
                        <Label htmlFor="valor_aluguer">Valor Aluguer (€)</Label>
                        {canEdit && editMode ? (
                          <Input
                            id="valor_aluguer"
                            type="number"
                            step="0.01"
                            value={infoForm.valor_aluguer}
                            onChange={(e) => setInfoForm({...infoForm, valor_aluguer: e.target.value})}
                            placeholder="Ex: 250.00"
                          />
                        ) : (
                          <p className="font-medium">€{vehicle.tipo_contrato?.valor_aluguer || '0.00'}</p>
                        )}
                      </div>
                    )}

                    {(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'comissao' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="comissao_parceiro">Comissão Parceiro (%)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="comissao_parceiro"
                              type="number"
                              value={infoForm.comissao_parceiro}
                              onChange={(e) => setInfoForm({...infoForm, comissao_parceiro: e.target.value})}
                              placeholder="Ex: 60"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.comissao_parceiro || 0}%</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="comissao_motorista">Comissão Motorista (%)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="comissao_motorista"
                              type="number"
                              value={infoForm.comissao_motorista}
                              onChange={(e) => setInfoForm({...infoForm, comissao_motorista: e.target.value})}
                              placeholder="Ex: 40"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.comissao_motorista || 0}%</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'compra_veiculo' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="valor_semanal_compra">Valor Semanal (€)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="valor_semanal_compra"
                                type="number"
                                step="0.01"
                                value={infoForm.valor_semanal_compra}
                                onChange={(e) => setInfoForm({...infoForm, valor_semanal_compra: e.target.value})}
                                placeholder="Ex: 150.00"
                              />
                            ) : (
                              <p className="font-medium">€{vehicle.tipo_contrato?.valor_semanal_compra || '0.00'}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="periodo_compra">Período (semanas)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="periodo_compra"
                                type="number"
                                value={infoForm.periodo_compra}
                                onChange={(e) => setInfoForm({...infoForm, periodo_compra: e.target.value})}
                                placeholder="Ex: 104"
                              />
                            ) : (
                              <p className="font-medium">{vehicle.tipo_contrato?.periodo_compra || 0} semanas</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="valor_acumulado">Valor Acumulado (€)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="valor_acumulado"
                                type="number"
                                step="0.01"
                                value={infoForm.valor_acumulado}
                                onChange={(e) => setInfoForm({...infoForm, valor_acumulado: e.target.value})}
                                placeholder="Ex: 3000.00"
                              />
                            ) : (
                              <p className="font-medium text-green-600">€{vehicle.tipo_contrato?.valor_acumulado || '0.00'}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="valor_falta_cobrar">Valor a Cobrar (€)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="valor_falta_cobrar"
                                type="number"
                                step="0.01"
                                value={infoForm.valor_falta_cobrar}
                                onChange={(e) => setInfoForm({...infoForm, valor_falta_cobrar: e.target.value})}
                                placeholder="Ex: 2000.00"
                              />
                            ) : (
                              <p className="font-medium text-orange-600">€{vehicle.tipo_contrato?.valor_falta_cobrar || '0.00'}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="custo_slot">Custo da Slot (€)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="custo_slot"
                              type="number"
                              step="0.01"
                              value={infoForm.custo_slot}
                              onChange={(e) => setInfoForm({...infoForm, custo_slot: e.target.value})}
                              placeholder="Ex: 50.00"
                            />
                          ) : (
                            <p className="font-medium">€{vehicle.tipo_contrato?.custo_slot || '0.00'}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Regime (Full Time/Part Time) */}
                    <div>
                      <Label htmlFor="regime">Regime</Label>
                      {canEdit && editMode ? (
                        <select
                          id="regime"
                          value={infoForm.regime}
                          onChange={(e) => setInfoForm({...infoForm, regime: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                        </select>
                      ) : (
                        <p className="font-medium">{vehicle.tipo_contrato?.regime === 'full_time' ? 'Full Time' : 'Part Time'}</p>
                      )}
                    </div>
                    
                    {(editMode ? infoForm.regime : vehicle.tipo_contrato?.regime) === 'part_time' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="horario_turno_1">Turno 1</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="horario_turno_1"
                              value={infoForm.horario_turno_1}
                              onChange={(e) => setInfoForm({...infoForm, horario_turno_1: e.target.value})}
                              placeholder="Ex: 08:00-12:00"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.horario_turno_1 || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="horario_turno_2">Turno 2</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="horario_turno_2"
                              value={infoForm.horario_turno_2}
                              onChange={(e) => setInfoForm({...infoForm, horario_turno_2: e.target.value})}
                              placeholder="Ex: 12:00-16:00"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.horario_turno_2 || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="horario_turno_3">Turno 3</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="horario_turno_3"
                              value={infoForm.horario_turno_3}
                              onChange={(e) => setInfoForm({...infoForm, horario_turno_3: e.target.value})}
                              placeholder="Ex: 16:00-20:00"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.horario_turno_3 || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="horario_turno_4">Turno 4</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="horario_turno_4"
                              value={infoForm.horario_turno_4}
                              onChange={(e) => setInfoForm({...infoForm, horario_turno_4: e.target.value})}
                              placeholder="Ex: 20:00-00:00"
                            />
                          ) : (
                            <p className="font-medium">{vehicle.tipo_contrato?.horario_turno_4 || 'N/A'}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Categorias Uber */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Categorias Uber</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {['green', 'comfort', 'exec', 'pet', 'xl'].map((cat) => (
                      <div key={cat} className="flex items-center space-x-2">
                        {canEdit && editMode ? (
                          <input
                            type="checkbox"
                            id={`uber_${cat}`}
                            checked={infoForm.categorias_uber[cat] || false}
                            onChange={(e) => setInfoForm({
                              ...infoForm,
                              categorias_uber: {...infoForm.categorias_uber, [cat]: e.target.checked}
                            })}
                            className="w-4 h-4"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={vehicle.categorias_uber?.[cat] || false}
                            disabled
                            className="w-4 h-4"
                          />
                        )}
                        <Label htmlFor={`uber_${cat}`} className="capitalize">{cat === 'exec' ? 'Exec' : cat === 'xl' ? 'XL' : cat.charAt(0).toUpperCase() + cat.slice(1)}</Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Categorias Bolt */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Categorias Bolt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {['economy', 'comfort', 'exec', 'pet', 'xl'].map((cat) => (
                      <div key={cat} className="flex items-center space-x-2">
                        {canEdit && editMode ? (
                          <input
                            type="checkbox"
                            id={`bolt_${cat}`}
                            checked={infoForm.categorias_bolt[cat] || false}
                            onChange={(e) => setInfoForm({
                              ...infoForm,
                              categorias_bolt: {...infoForm.categorias_bolt, [cat]: e.target.checked}
                            })}
                            className="w-4 h-4"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={vehicle.categorias_bolt?.[cat] || false}
                            disabled
                            className="w-4 h-4"
                          />
                        )}
                        <Label htmlFor={`bolt_${cat}`} className="capitalize">{cat === 'exec' ? 'Exec' : cat === 'xl' ? 'XL' : cat.charAt(0).toUpperCase() + cat.slice(1)}</Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Fotos do Veículo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fotos do Veículo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Máximo de 3 fotos. Imagens são convertidas automaticamente para PDF formato A4.
                    </p>

                    {/* Upload de nova foto */}
                    {canEdit && editMode && (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <Input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handleUploadPhoto(file);
                          }}
                          disabled={uploadingDoc || (vehicle.fotos_veiculo && vehicle.fotos_veiculo.length >= 3)}
                          className="mt-2"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          {vehicle.fotos_veiculo && vehicle.fotos_veiculo.length >= 3 
                            ? 'Máximo de fotos atingido (3/3)' 
                            : `${vehicle.fotos_veiculo?.length || 0}/3 fotos`}
                        </p>
                      </div>
                    )}

                    {/* Lista de fotos */}
                    {vehicle.fotos_veiculo && vehicle.fotos_veiculo.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {vehicle.fotos_veiculo.map((foto, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Foto {index + 1}</span>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewPhoto(foto)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                {canEdit && editMode && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeletePhoto(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm text-center py-4">Nenhuma foto adicionada</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Seguro */}
          <TabsContent value="seguro">
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
                      {vehicle.documento_carta_verde && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(vehicle.documento_carta_verde, 'Carta Verde')}
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
                          if (file) handleUploadDocument(file, 'carta-verde');
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
                      {vehicle.documento_condicoes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(vehicle.documento_condicoes, 'Condições')}
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
                          if (file) handleUploadDocument(file, 'condicoes');
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
                      {vehicle.documento_recibo_seguro && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(vehicle.documento_recibo_seguro, 'Recibo')}
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
                          if (file) handleUploadDocument(file, 'recibo-seguro');
                        }}
                        disabled={uploadingDoc}
                        className="mt-2"
                      />
                    )}
                    <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspeção */}
          <TabsContent value="inspecao">
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
                      {vehicle.documento_inspecao && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(vehicle.documento_inspecao, 'Inspeção')}
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
                          if (file) handleUploadDocument(file, 'documento-inspecao');
                        }}
                        disabled={uploadingDoc}
                        className="mt-2"
                      />
                    )}
                    <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extintor */}
          <TabsContent value="extintor">
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
                      {vehicle && vehicle.extintor && vehicle.extintor.certificado_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(vehicle.extintor.certificado_url, 'Extintor')}
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
                          if (file) handleUploadExtintorDoc(file);
                        }}
                        disabled={uploadingDoc}
                        className="mt-2"
                      />
                    )}
                    <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG (imagens serão convertidas para PDF A4)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revisão e Intervenções */}
          <TabsContent value="revisao">
            <div className="space-y-4">
              {/* Próxima Revisão */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wrench className="w-5 h-5" />
                    <span>Próxima Revisão</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="proxima_revisao_km">Próxima Revisão (KM)</Label>
                    <Input
                      id="proxima_revisao_km"
                      type="number"
                      value={revisaoForm.proxima_revisao_km}
                      onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_km: e.target.value})}
                      disabled={!canEdit || !editMode}
                      placeholder="Ex: 150000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="proxima_revisao_data">Próxima Revisão (Data)</Label>
                    <Input
                      id="proxima_revisao_data"
                      type="date"
                      value={revisaoForm.proxima_revisao_data}
                      onChange={(e) => setRevisaoForm({...revisaoForm, proxima_revisao_data: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  Defina a próxima revisão por KM ou Data (ou ambos)
                </p>

                {/* Histórico de Manutenções */}
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Histórico de Manutenções</h3>
                  {vehicle.manutencoes && vehicle.manutencoes.length > 0 ? (
                    <div className="space-y-2">
                      {vehicle.manutencoes.map((man, index) => (
                        <div key={index} className="border rounded p-3 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{man.tipo_manutencao}</p>
                              <p className="text-sm text-slate-600">{man.descricao}</p>
                              <p className="text-xs text-slate-500">Data: {man.data} | KM: {man.km_realizada}</p>
                            </div>
                            <p className="font-semibold text-emerald-600">€{man.valor}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nenhuma manutenção registrada</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Próximas Intervenções - Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Próxima Revisão */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <Wrench className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-xs font-medium text-slate-600 mb-1">Próxima Revisão</p>
                    {vehicle.proxima_revisao_data ? (
                      <>
                        <p className="text-sm font-bold text-blue-700">
                          {new Date(vehicle.proxima_revisao_data).toLocaleDateString('pt-PT')}
                        </p>
                        {vehicle.proxima_revisao_km && (
                          <p className="text-xs text-slate-600 mt-1">
                            {vehicle.proxima_revisao_km.toLocaleString()} km
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Não definida</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Próximo Seguro */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <Shield className="w-6 h-6 mx-auto mb-2 text-green-600" />
                    <p className="text-xs font-medium text-slate-600 mb-1">Renovação Seguro</p>
                    {vehicle.seguro?.data_validade ? (
                      <>
                        <p className="text-sm font-bold text-green-700">
                          {new Date(vehicle.seguro.data_validade).toLocaleDateString('pt-PT')}
                        </p>
                        {vehicle.seguro.seguradora && (
                          <p className="text-xs text-slate-600 mt-1">
                            {vehicle.seguro.seguradora}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Não definida</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Próxima Inspeção */}
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <ClipboardCheck className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                    <p className="text-xs font-medium text-slate-600 mb-1">Próxima Inspeção</p>
                    {vehicle.inspection?.proxima_inspecao ? (
                      <p className="text-sm font-bold text-purple-700">
                        {new Date(vehicle.inspection.proxima_inspecao).toLocaleDateString('pt-PT')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Não definida</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Próximo Extintor */}
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                    <p className="text-xs font-medium text-slate-600 mb-1">Validade Extintor</p>
                    {vehicle.extintor?.data_validade ? (
                      <p className="text-sm font-bold text-red-700">
                        {new Date(vehicle.extintor.data_validade).toLocaleDateString('pt-PT')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Não definida</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Relatório de Intervenções */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <History className="w-5 h-5" />
                  <span>Histórico de Intervenções</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  Histórico completo de todas as intervenções no veículo: seguros, inspeções, extintor e revisões.
                </p>

                {relatorioIntervencoes.interventions && relatorioIntervencoes.interventions.length > 0 ? (
                  <div className="space-y-3">
                    {relatorioIntervencoes.interventions.map((intervention, index) => {
                      const isPending = intervention.status === 'pending';
                      const today = new Date();
                      const interventionDate = new Date(intervention.data);
                      const isOverdue = isPending && interventionDate < today;
                      
                      return (
                        <div 
                          key={index} 
                          className={`border-l-4 rounded-lg p-4 ${
                            isPending 
                              ? isOverdue 
                                ? 'bg-red-50 border-red-500' 
                                : 'bg-orange-50 border-orange-500'
                              : 'bg-green-50 border-green-500'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  intervention.categoria === 'seguro' ? 'bg-blue-100 text-blue-800' :
                                  intervention.categoria === 'inspecao' ? 'bg-purple-100 text-purple-800' :
                                  intervention.categoria === 'extintor' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {intervention.tipo}
                                </span>
                                <span className={`text-xs font-medium ${
                                  isPending
                                    ? isOverdue
                                      ? 'text-red-600'
                                      : 'text-orange-600'
                                    : 'text-green-600'
                                }`}>
                                  {isPending ? (isOverdue ? 'VENCIDO' : 'PENDENTE') : 'CONCLUÍDO'}
                                </span>
                              </div>
                              <p className="font-medium text-slate-800">{intervention.descricao}</p>
                              <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                <span>📅 {new Date(intervention.data).toLocaleDateString('pt-PT')}</span>
                                {intervention.km && <span>🚗 {intervention.km.toLocaleString()} km</span>}
                              </div>
                              {intervention.criado_por && (
                                <p className="text-xs text-slate-500 mt-2">
                                  Criado por: {intervention.criado_por}
                                  {intervention.editado_por && ` • Editado por: ${intervention.editado_por}`}
                                </p>
                              )}
                            </div>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditIntervencao(intervention)}
                                className="ml-2"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>Nenhuma intervenção registrada ainda.</p>
                    <p className="text-sm mt-2">Comece adicionando informações de seguro, inspeção, extintor ou revisões.</p>
                  </div>
                )}

                <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                  <h4 className="font-semibold mb-2">Legenda</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>Concluído - Intervenção realizada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span>Pendente - Intervenção futura agendada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span>Vencido - Intervenção atrasada</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </TabsContent>

          {/* Agenda */}
          <TabsContent value="agenda">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Agenda do Veículo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEdit && (
                  <form onSubmit={editingAgendaId ? handleUpdateAgenda : handleAddAgenda} className="space-y-4 border-b pb-4">
                    <h3 className="font-semibold">{editingAgendaId ? 'Editar Evento' : 'Adicionar Evento'}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tipo">Tipo *</Label>
                        <select
                          id="tipo"
                          value={agendaForm.tipo}
                          onChange={(e) => setAgendaForm({...agendaForm, tipo: e.target.value})}
                          className="w-full p-2 border rounded-md"
                          required
                        >
                          <option value="manutencao">Manutenção</option>
                          <option value="inspecao">Inspeção</option>
                          <option value="revisao">Revisão</option>
                          <option value="seguro">Seguro</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="titulo">Título *</Label>
                        <Input
                          id="titulo"
                          value={agendaForm.titulo}
                          onChange={(e) => setAgendaForm({...agendaForm, titulo: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="data">Data *</Label>
                        <Input
                          id="data"
                          type="date"
                          value={agendaForm.data}
                          onChange={(e) => setAgendaForm({...agendaForm, data: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="hora">Hora</Label>
                        <Input
                          id="hora"
                          type="time"
                          value={agendaForm.hora}
                          onChange={(e) => setAgendaForm({...agendaForm, hora: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <textarea
                          id="descricao"
                          value={agendaForm.descricao}
                          onChange={(e) => setAgendaForm({...agendaForm, descricao: e.target.value})}
                          className="w-full p-2 border rounded-md"
                          rows="2"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">
                        {editingAgendaId ? (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Alterações
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar à Agenda
                          </>
                        )}
                      </Button>
                      {editingAgendaId && (
                        <Button type="button" variant="outline" onClick={handleCancelEditAgenda}>
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                )}

                {/* Lista de Agenda */}
                <div>
                  <h3 className="font-semibold mb-3">Próximos Eventos</h3>
                  {agenda.length > 0 ? (
                    <div className="space-y-2">
                      {agenda.map((evento) => (
                        <div key={evento.id} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{evento.titulo}</p>
                              <p className="text-sm text-slate-600">{evento.descricao}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(evento.data).toLocaleDateString('pt-PT')}
                                {evento.hora && ` às ${evento.hora}`}
                              </p>
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {evento.tipo}
                              </span>
                              {canEdit && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditAgenda(evento)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteAgenda(evento.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Nenhum evento agendado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Relatório Ganhos/Perdas */}
          <TabsContent value="relatorio">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Relatório Financeiro</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cards de Resumo */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-green-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Ganhos Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        €{relatorioGanhos.ganhos_total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Despesas Total</p>
                      <p className="text-2xl font-bold text-red-600">
                        €{relatorioGanhos.despesas_total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Lucro</p>
                      <p className="text-2xl font-bold text-blue-600">
                        €{relatorioGanhos.lucro.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detalhes */}
                {relatorioGanhos.detalhes && relatorioGanhos.detalhes.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Detalhes</h3>
                    <div className="space-y-2">
                      {relatorioGanhos.detalhes.map((item, index) => (
                        <div key={index} className="flex justify-between items-center border-b py-2">
                          <div>
                            <p className="font-medium">{item.descricao}</p>
                            <p className="text-xs text-slate-500">{item.data}</p>
                          </div>
                          <p className={`font-semibold ${item.tipo === 'ganho' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.tipo === 'ganho' ? '+' : '-'}€{item.valor.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Edição de Agenda */}
      <Dialog open={isAgendaModalOpen} onOpenChange={setIsAgendaModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Evento da Agenda</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAgenda} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="modal_tipo">Tipo *</Label>
                <select
                  id="modal_tipo"
                  value={agendaForm.tipo}
                  onChange={(e) => setAgendaForm({...agendaForm, tipo: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="manutencao">Manutenção</option>
                  <option value="inspecao">Inspeção</option>
                  <option value="revisao">Revisão</option>
                  <option value="seguro">Seguro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="modal_titulo">Título *</Label>
                <Input
                  id="modal_titulo"
                  value={agendaForm.titulo}
                  onChange={(e) => setAgendaForm({...agendaForm, titulo: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="modal_data">Data *</Label>
                <Input
                  id="modal_data"
                  type="date"
                  value={agendaForm.data}
                  onChange={(e) => setAgendaForm({...agendaForm, data: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="modal_hora">Hora</Label>
                <Input
                  id="modal_hora"
                  type="time"
                  value={agendaForm.hora}
                  onChange={(e) => setAgendaForm({...agendaForm, hora: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="modal_descricao">Descrição</Label>
                <textarea
                  id="modal_descricao"
                  value={agendaForm.descricao}
                  onChange={(e) => setAgendaForm({...agendaForm, descricao: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  rows="3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelEditAgenda}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Intervenção */}
      <Dialog open={isIntervencaoModalOpen} onOpenChange={setIsIntervencaoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Intervenção</DialogTitle>
          </DialogHeader>
          {editingIntervencao && (
            <div className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <p className="font-medium">{editingIntervencao.tipo}</p>
              </div>
              <div>
                <Label>Descrição</Label>
                <p className="text-sm">{editingIntervencao.descricao}</p>
              </div>
              <div>
                <Label>Data</Label>
                <p className="text-sm">{new Date(editingIntervencao.data).toLocaleDateString('pt-PT')}</p>
              </div>
              <div>
                <Label htmlFor="intervencao_status">Estado *</Label>
                <select
                  id="intervencao_status"
                  value={editingIntervencao.status}
                  onChange={(e) => setEditingIntervencao({...editingIntervencao, status: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="pending">Pendente</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
              {editingIntervencao.criado_por && (
                <div className="text-sm text-slate-600 border-t pt-3">
                  <p><strong>Criado por:</strong> {editingIntervencao.criado_por}</p>
                  {editingIntervencao.editado_por && (
                    <p><strong>Última edição por:</strong> {editingIntervencao.editado_por}</p>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsIntervencaoModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveIntervencao}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default FichaVeiculo;
