import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Car, User, Shield, ClipboardCheck, Wrench, Calendar, 
  TrendingUp, History, Edit, Save, X, Plus, FileText, Upload, Download, Trash2, AlertCircle, Bell, CheckCircle, CreditCard, MapPin 
} from 'lucide-react';

// Helper function to parse DD/MM/YYYY dates
const parseDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // If already a Date object, return it
  if (dateStr instanceof Date) return dateStr;
  
  // Check if it's DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  
  // Otherwise try standard Date parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const FichaVeiculo = ({ user, onLogout }) => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [motorista, setMotorista] = useState(null);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
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
    descricao: '',
    oficina: '',
    local: ''
  });
  
  const [editingAgendaId, setEditingAgendaId] = useState(null);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isIntervencaoModalOpen, setIsIntervencaoModalOpen] = useState(false);
  const [editingIntervencao, setEditingIntervencao] = useState(null);
  const [categoriasUber, setCategoriasUber] = useState([]);
  const [categoriasBolt, setCategoriasBolt] = useState([]);
  const [hasModuloEventos, setHasModuloEventos] = useState(false);

  const [extintorForm, setExtintorForm] = useState({
    numeracao: '',
    fornecedor: '',
    empresa_certificacao: '',
    preco: '',
    data_instalacao: '',
    data_validade: ''
  });

  const [planoManutencoes, setPlanoManutencoes] = useState([
    { nome: 'Revisão', intervalo_km: 15000, ativo: true },
    { nome: 'Pastilhas', intervalo_km: 30000, ativo: true },
    { nome: 'Discos e Pastilhas', intervalo_km: 60000, ativo: true },
    { nome: 'Distribuição', intervalo_km: 80000, ativo: true },
    { nome: 'Pneus', intervalo_km: 40000, ativo: true }
  ]);

  const [alertasConfig, setAlertasConfig] = useState({
    dias_aviso_seguro: 30,
    dias_aviso_inspecao: 30,
    dias_aviso_extintor: 30,
    km_aviso_manutencao: 5000
  });

  const [verificacaoDanosAtiva, setVerificacaoDanosAtiva] = useState(false);

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
    // Condições de KM
    tem_limite_km: false,
    km_semanais_disponiveis: '',
    valor_extra_km: '',
    km_acumula_semanal: false,
    // KM por Época (se aplicável)
    km_por_epoca: false,
    km_epoca_alta: '',
    km_epoca_baixa: '',
    meses_epoca_alta: [], // Array de meses [6, 7, 8, 9] para Jun-Set
    meses_epoca_baixa: [], // Array de meses restantes
    // Contratos
    contratos: [], // Lista de contratos {id, data, tipo, documento_url, assinado_motorista, assinado_parceiro}
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
    // Investimento/Aquisição do Veículo (para ROI)
    tem_investimento: false,
    tipo_aquisicao: 'compra', // 'compra', 'credito', 'leasing'
    // Valores de Compra
    valor_aquisicao: '',
    valor_aquisicao_com_iva: true,
    iva_aquisicao: '23',
    // Crédito/Leasing
    valor_entrada: '',
    valor_entrada_com_iva: false,
    valor_prestacao: '',
    valor_prestacao_com_iva: false, // false para crédito, true para leasing
    numero_prestacoes: '',
    prestacoes_pagas: '',
    data_inicio_financiamento: '',
    data_fim_financiamento: '',
    entidade_financiadora: '',
    taxa_juro: '',
    valor_residual: '', // Para leasing
    // Totais calculados
    total_juros: '',
    total_pago: '',
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
  
  // Estado para adicionar manutenção
  const [showAddManutencao, setShowAddManutencao] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState({
    tipo_manutencao: '',
    descricao: '',
    data: new Date().toISOString().split('T')[0],
    km_realizada: '',
    valor: '',
    fornecedor: '',
    responsavel: 'parceiro', // 'motorista' ou 'parceiro'
    atribuir_motorista: false // se true, deduz do motorista atribuído
  });

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

  const canEdit = user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro';
  const canEditPlanoManutencao = user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro';
  const canEditAlertas = user.role === 'admin' || user.role === 'gestao' || user.role === 'parceiro';

  // Debug: Log user and permissions
  console.log('🔍 FichaVeiculo - User:', user);
  console.log('🔍 FichaVeiculo - User role:', user?.role);
  console.log('🔍 FichaVeiculo - canEdit:', canEdit);
  console.log('🔍 FichaVeiculo - editMode:', editMode);

  useEffect(() => {
    fetchVehicleData();
    fetchCategorias();
    fetchMotoristasDisponiveis();
    if (user.role === 'parceiro') {
      checkModuloEventos();
    }
  }, [vehicleId]);
  
  const fetchMotoristasDisponiveis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motoristas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotoristasDisponiveis(response.data);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  };

  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/configuracoes/categorias-plataformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCategoriasUber(response.data.uber || []);
      setCategoriasBolt(response.data.bolt || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Use defaults if API fails
      setCategoriasUber(['UberX', 'Share', 'Electric', 'Black', 'Comfort', 'XL', 'XXL', 'Pet', 'Package']);
      setCategoriasBolt(['Economy', 'Comfort', 'Executive', 'XL', 'Green', 'XXL', 'Motorista Privado', 'Pet']);
    }
  };

  const checkModuloEventos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/users/${user.id}/verificar-modulo/gestao_eventos_veiculo`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHasModuloEventos(response.data.tem_acesso || false);
    } catch (error) {
      console.error('Error checking module:', error);
      setHasModuloEventos(false);
    }
  };

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
      console.log('🔍 handleSaveInfo iniciado', { silent, vehicle, infoForm });
      
      // Verificar se vehicle existe
      if (!vehicle) {
        console.error('❌ Vehicle é null/undefined');
        if (!silent) toast.error('Erro: dados do veículo não carregados');
        return;
      }
      
      const token = localStorage.getItem('token');
      
      const payload = {
        // Campos básicos do veículo
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        versao: vehicle.versao,
        ano: vehicle.ano,
        matricula: vehicle.matricula,
        data_matricula: vehicle.data_matricula,
        validade_matricula: vehicle.validade_matricula,
        cor: vehicle.cor,
        combustivel: vehicle.combustivel,
        caixa: vehicle.caixa,
        lugares: vehicle.lugares,
        km_atual: vehicle.km_atual,
        motorista_atribuido: vehicle.motorista_atribuido || null,
        via_verde_id: vehicle.via_verde_id || null,
        cartao_frota_id: vehicle.cartao_frota_id || null,
        cartao_frota_eletric_id: vehicle.cartao_frota_eletric_id || null,
        tipo_contrato: {
          tipo: infoForm?.tipo || 'aluguer_sem_caucao',
          periodicidade: infoForm?.periodicidade || 'semanal',
          regime: infoForm?.regime || 'full_time',
          horario_turno_1: infoForm?.horario_turno_1 || '',
          horario_turno_2: infoForm?.horario_turno_2 || '',
          horario_turno_3: infoForm?.horario_turno_3 || '',
          horario_turno_4: infoForm?.horario_turno_4 || '',
          valor_aluguer: parseFloat(infoForm?.valor_aluguer) || null,
          valor_caucao: parseFloat(infoForm?.valor_caucao) || null,
          numero_parcelas_caucao: parseInt(infoForm?.numero_parcelas_caucao) || null,
          valor_epoca_alta: parseFloat(infoForm?.valor_epoca_alta) || null,
          valor_epoca_baixa: parseFloat(infoForm?.valor_epoca_baixa) || null,
          comissao_parceiro: parseFloat(infoForm?.comissao_parceiro) || null,
          comissao_motorista: parseFloat(infoForm?.comissao_motorista) || null,
          inclui_combustivel: infoForm?.inclui_combustivel || false,
          // Condições de KM
          tem_limite_km: infoForm?.tem_limite_km || false,
          km_semanais_disponiveis: parseInt(infoForm?.km_semanais_disponiveis) || null,
          valor_extra_km: parseFloat(infoForm?.valor_extra_km) || null,
          km_acumula_semanal: infoForm?.km_acumula_semanal || false,
          // KM por Época
          km_por_epoca: infoForm?.km_por_epoca || false,
          km_epoca_alta: parseInt(infoForm?.km_epoca_alta) || null,
          km_epoca_baixa: parseInt(infoForm?.km_epoca_baixa) || null,
          meses_epoca_alta: infoForm?.meses_epoca_alta || [],
          meses_epoca_baixa: infoForm?.meses_epoca_baixa || [],
          valor_compra_veiculo: parseFloat(infoForm?.valor_compra_veiculo) || null,
          numero_semanas_compra: parseInt(infoForm?.numero_semanas_compra) || null,
          com_slot: infoForm?.com_slot || false,
          extra_seguro: infoForm?.extra_seguro || false,
          valor_extra_seguro: parseFloat(infoForm?.valor_extra_seguro) || null,
          valor_semanal_compra: parseFloat(infoForm?.valor_semanal_compra) || null,
          periodo_compra: parseInt(infoForm?.periodo_compra) || null,
          valor_acumulado: parseFloat(infoForm?.valor_acumulado) || null,
          valor_falta_cobrar: parseFloat(infoForm?.valor_falta_cobrar) || null,
          custo_slot: parseFloat(infoForm?.custo_slot) || null
        },
        // Investimento/Aquisição do Veículo
        investimento: {
          tem_investimento: infoForm?.tem_investimento || false,
          tipo_aquisicao: infoForm?.tipo_aquisicao || 'compra',
          valor_aquisicao: parseFloat(infoForm?.valor_aquisicao) || null,
          valor_aquisicao_com_iva: infoForm?.valor_aquisicao_com_iva || false,
          iva_aquisicao: infoForm?.iva_aquisicao || '23',
          valor_entrada: parseFloat(infoForm?.valor_entrada) || null,
          valor_entrada_com_iva: infoForm?.valor_entrada_com_iva || false,
          valor_prestacao: parseFloat(infoForm?.valor_prestacao) || null,
          numero_prestacoes: parseInt(infoForm?.numero_prestacoes) || null,
          prestacoes_pagas: parseInt(infoForm?.prestacoes_pagas) || null,
          data_inicio_financiamento: infoForm?.data_inicio_financiamento || null,
          data_fim_financiamento: infoForm?.data_fim_financiamento || null,
          entidade_financiadora: infoForm?.entidade_financiadora || null,
          taxa_juro: parseFloat(infoForm?.taxa_juro) || null,
          valor_residual: parseFloat(infoForm?.valor_residual) || null
        },
        categorias_uber: infoForm?.categorias_uber || {},
        categorias_bolt: infoForm?.categorias_bolt || {}
      };
      
      console.log('📤 Payload a enviar:', payload);
      
      const response = await axios.put(`${API}/vehicles/${vehicleId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Resposta do servidor:', response.data);

      if (!silent) {
        toast.success('Informações atualizadas com sucesso!');
        fetchVehicleData();
      }
    } catch (error) {
      console.error('❌ Error saving info:', error);
      console.error('❌ Error details:', error.response?.data);
      if (!silent) toast.error('Erro ao salvar informações');
      throw error;
    }
  };

  const handleSaveAllChanges = async () => {
    console.log('🚀 handleSaveAllChanges iniciado');
    
    const confirmed = window.confirm('Tem certeza que deseja guardar todas as alterações?');
    console.log('👤 Confirmação do utilizador:', confirmed);
    
    if (!confirmed) {
      console.log('❌ Utilizador cancelou operação');
      return;
    }

    try {
      console.log('💾 Iniciando gravação de formulários...');
      
      // Save all forms silently (no individual toasts)
      console.log('1️⃣ Salvando Info...');
      await handleSaveInfo(true);
      console.log('✅ Info salvo');
      
      console.log('2️⃣ Salvando Seguro...');
      await handleSaveSeguro(true);
      console.log('✅ Seguro salvo');
      
      console.log('3️⃣ Salvando Inspeção...');
      await handleSaveInspecao(true);
      console.log('✅ Inspeção salva');
      
      console.log('4️⃣ Salvando Revisão...');
      await handleSaveRevisao(true);
      console.log('✅ Revisão salva');
      
      console.log('5️⃣ Salvando Extintor...');
      await handleSaveExtintor(true);
      console.log('✅ Extintor salvo');
      
      // Refresh data and exit edit mode
      console.log('🔄 Recarregando dados...');
      await fetchVehicleData();
      console.log('✅ Dados recarregados');
      
      setEditMode(false);
      toast.success('Todas as alterações foram guardadas com sucesso!');
      console.log('🎉 Todas as alterações guardadas com sucesso!');
    } catch (error) {
      console.error('❌ Error saving changes:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error response:', error.response?.data);
      toast.error('Erro ao guardar algumas alterações');
    }
  };

  const handleSavePlanoManutencoes = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/vehicles/${vehicleId}`, 
        { 
          plano_manutencoes: planoManutencoes,
          alertas_configuracao: alertasConfig,
          verificacao_danos_ativa: verificacaoDanosAtiva
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      await fetchVehicleData();
      toast.success('Plano de manutenções e alertas atualizados!');
    } catch (error) {
      console.error('Error saving plano:', error);
      toast.error('Erro ao atualizar plano de manutenções');
    }
  };

  const handleAddPlanoItem = () => {
    setPlanoManutencoes([...planoManutencoes, { nome: 'Nova Manutenção', intervalo_km: 10000, ativo: true }]);
  };

  const handleRemovePlanoItem = (index) => {
    const newPlano = planoManutencoes.filter((_, i) => i !== index);
    setPlanoManutencoes(newPlano);
  };

  const handleUpdatePlanoItem = (index, field, value) => {
    const newPlano = [...planoManutencoes];
    newPlano[index][field] = value;
    setPlanoManutencoes(newPlano);
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

      // Load plano de manutenções and alertas
      if (vehicleRes.data.plano_manutencoes && vehicleRes.data.plano_manutencoes.length > 0) {
        setPlanoManutencoes(vehicleRes.data.plano_manutencoes);
      }
      if (vehicleRes.data.alertas_configuracao) {
        setAlertasConfig(vehicleRes.data.alertas_configuracao);
      }
      setVerificacaoDanosAtiva(vehicleRes.data.verificacao_danos_ativa || false);

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
          // Condições de KM
          tem_limite_km: vehicleRes.data.tipo_contrato.tem_limite_km || false,
          km_semanais_disponiveis: vehicleRes.data.tipo_contrato.km_semanais_disponiveis || '',
          valor_extra_km: vehicleRes.data.tipo_contrato.valor_extra_km || '',
          km_acumula_semanal: vehicleRes.data.tipo_contrato.km_acumula_semanal || false,
          // KM por Época
          km_por_epoca: vehicleRes.data.tipo_contrato.km_por_epoca || false,
          km_epoca_alta: vehicleRes.data.tipo_contrato.km_epoca_alta || '',
          km_epoca_baixa: vehicleRes.data.tipo_contrato.km_epoca_baixa || '',
          meses_epoca_alta: vehicleRes.data.tipo_contrato.meses_epoca_alta || [],
          meses_epoca_baixa: vehicleRes.data.tipo_contrato.meses_epoca_baixa || [],
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
          // Investimento/Aquisição
          tem_investimento: vehicleRes.data.investimento?.tem_investimento || false,
          tipo_aquisicao: vehicleRes.data.investimento?.tipo_aquisicao || 'compra',
          valor_aquisicao: vehicleRes.data.investimento?.valor_aquisicao || '',
          valor_aquisicao_com_iva: vehicleRes.data.investimento?.valor_aquisicao_com_iva || false,
          iva_aquisicao: vehicleRes.data.investimento?.iva_aquisicao || '23',
          valor_entrada: vehicleRes.data.investimento?.valor_entrada || '',
          valor_entrada_com_iva: vehicleRes.data.investimento?.valor_entrada_com_iva || false,
          valor_prestacao: vehicleRes.data.investimento?.valor_prestacao || '',
          numero_prestacoes: vehicleRes.data.investimento?.numero_prestacoes || '',
          prestacoes_pagas: vehicleRes.data.investimento?.prestacoes_pagas || '',
          data_inicio_financiamento: vehicleRes.data.investimento?.data_inicio_financiamento || '',
          data_fim_financiamento: vehicleRes.data.investimento?.data_fim_financiamento || '',
          entidade_financiadora: vehicleRes.data.investimento?.entidade_financiadora || '',
          taxa_juro: vehicleRes.data.investimento?.taxa_juro || '',
          valor_residual: vehicleRes.data.investimento?.valor_residual || '',
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
      descricao: evento.descricao || '',
      oficina: evento.oficina || '',
      local: evento.local || ''
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
        descricao: '',
        oficina: '',
        local: ''
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
      descricao: '',
      oficina: '',
      local: ''
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

  // Handler para adicionar manutenção ao histórico
  const handleAddManutencao = async (e) => {
    e.preventDefault();
    if (!novaManutencao.tipo_manutencao || !novaManutencao.data) {
      toast.error('Preencha pelo menos o tipo e a data');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const manutencaoData = {
        tipo_manutencao: novaManutencao.tipo_manutencao,
        descricao: novaManutencao.descricao,
        data: novaManutencao.data,
        km_realizada: parseInt(novaManutencao.km_realizada) || 0,
        valor: parseFloat(novaManutencao.valor) || 0,
        fornecedor: novaManutencao.fornecedor,
        responsavel: novaManutencao.responsavel || 'parceiro',
        atribuir_motorista: novaManutencao.atribuir_motorista || false,
        motorista_id: novaManutencao.atribuir_motorista ? vehicle.motorista_atribuido : null,
        motorista_nome: novaManutencao.atribuir_motorista ? vehicle.motorista_atribuido_nome : null,
        created_at: new Date().toISOString()
      };

      // Adicionar ao array de manutenções existente
      const manutencoes = vehicle.manutencoes || [];
      manutencoes.unshift(manutencaoData); // Adicionar no início

      await axios.put(`${API}/vehicles/${vehicleId}`, {
        manutencoes: manutencoes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Também adicionar aos custos do veículo para o ROI
      if (manutencaoData.valor > 0) {
        await axios.post(`${API}/vehicles/${vehicleId}/custos`, {
          categoria: novaManutencao.tipo_manutencao === 'Troca de Pneus' ? 'pneus' : 
                    novaManutencao.tipo_manutencao === 'Chapa e Pintura' ? 'reparacao' :
                    ['Multa', 'Dano'].includes(novaManutencao.tipo_manutencao) ? 'multa' : 'revisao',
          descricao: `${manutencaoData.tipo_manutencao}: ${manutencaoData.descricao || 'Sem descrição'}`,
          valor: manutencaoData.valor,
          data: manutencaoData.data,
          fornecedor: manutencaoData.fornecedor,
          responsavel: manutencaoData.responsavel,
          atribuir_motorista: manutencaoData.atribuir_motorista,
          motorista_id: manutencaoData.motorista_id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      toast.success('Manutenção registada com sucesso!');
      setShowAddManutencao(false);
      setNovaManutencao({
        tipo_manutencao: '',
        descricao: '',
        data: new Date().toISOString().split('T')[0],
        km_realizada: '',
        valor: '',
        fornecedor: '',
        responsavel: 'parceiro',
        atribuir_motorista: false
      });
      fetchVehicleData();
    } catch (error) {
      console.error('Error adding manutencao:', error);
      toast.error('Erro ao registar manutenção');
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
      
      // Usar endpoint dedicado para download com content-type correcto
      const downloadUrl = `${API}/vehicles/download/${encodeURIComponent(documentPath)}`;
      
      // Fazer fetch com autenticação
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download');
      }
      
      // Obter o blob do ficheiro
      const blob = await response.blob();
      
      // Criar URL temporário e fazer download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extrair nome do ficheiro
      const filename = documentPath.split('/').pop() || `${documentName}.pdf`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Download de ${documentName} concluído`);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Fallback: abrir numa nova tab
      const baseUrl = process.env.REACT_APP_BACKEND_URL;
      const fullUrl = documentPath.startsWith('http') 
        ? documentPath 
        : `${baseUrl}/${documentPath}`;
      window.open(fullUrl, '_blank');
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <a 
                    href={`/motorista/${motorista.id}`}
                    className="text-lg font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                  >
                    {motorista.name}
                  </a>
                  <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded">Ativo</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span className="text-slate-700 font-medium">
                      {motorista.phone || motorista.personal?.phone || motorista.whatsapp || 'Sem telefone'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="16" x="2" y="4" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <span className="text-slate-600 truncate">{motorista.email}</span>
                  </div>
                </div>
                {motorista.professional?.licenca_tvde && (
                  <p className="text-xs text-slate-500">Licença TVDE: {motorista.professional.licenca_tvde}</p>
                )}
                {vehicle?.motorista_atribuido_desde && (
                  <p className="text-xs text-slate-400">
                    Desde: {new Date(vehicle.motorista_atribuido_desde).toLocaleDateString('pt-PT')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Nenhum motorista atribuído</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="dispositivos">Dispositivos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
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
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.marca}
                          onChange={(e) => setVehicle({...vehicle, marca: e.target.value})}
                          placeholder="Ex: Toyota"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.marca}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Modelo</Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.modelo}
                          onChange={(e) => setVehicle({...vehicle, modelo: e.target.value})}
                          placeholder="Ex: Corolla"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.modelo}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Versão</Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.versao || ''}
                          onChange={(e) => setVehicle({...vehicle, versao: e.target.value})}
                          placeholder="Ex: Hybrid"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.versao || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Ano</Label>
                      {canEdit && editMode ? (
                        <Input
                          type="number"
                          value={vehicle.ano || ''}
                          onChange={(e) => setVehicle({...vehicle, ano: parseInt(e.target.value) || null})}
                          placeholder="Ex: 2020"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.ano || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Matrícula</Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.matricula}
                          onChange={(e) => setVehicle({...vehicle, matricula: e.target.value.toUpperCase()})}
                          placeholder="Ex: AA-00-BB"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.matricula}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Data de Matrícula</Label>
                      {canEdit && editMode ? (
                        <Input
                          type="date"
                          value={vehicle.data_matricula ? vehicle.data_matricula.split('T')[0] : ''}
                          onChange={(e) => setVehicle({...vehicle, data_matricula: e.target.value})}
                        />
                      ) : (
                        <p className="font-medium">
                          {vehicle.data_matricula ? (
                            parseDate(vehicle.data_matricula)?.toLocaleDateString('pt-PT') || 'Data inválida'
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Validade da Matrícula</Label>
                      {canEdit && editMode ? (
                        <Input
                          type="date"
                          value={vehicle.validade_matricula ? vehicle.validade_matricula.split('T')[0] : ''}
                          onChange={(e) => setVehicle({...vehicle, validade_matricula: e.target.value})}
                        />
                      ) : (
                        <p className="font-medium">
                          {vehicle.validade_matricula ? (
                            parseDate(vehicle.validade_matricula)?.toLocaleDateString('pt-PT') || 'Data inválida'
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Cor</Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.cor || ''}
                          onChange={(e) => setVehicle({...vehicle, cor: e.target.value})}
                          placeholder="Ex: Branco"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.cor}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Combustível</Label>
                      {canEdit && editMode ? (
                        <select
                          value={vehicle.combustivel || ''}
                          onChange={(e) => setVehicle({...vehicle, combustivel: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Selecione</option>
                          <option value="Gasolina">Gasolina</option>
                          <option value="Diesel">Diesel</option>
                          <option value="Híbrido">Híbrido</option>
                          <option value="Elétrico">Elétrico</option>
                          <option value="GPL">GPL</option>
                        </select>
                      ) : (
                        <p className="font-medium">{vehicle.combustivel}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Caixa</Label>
                      {canEdit && editMode ? (
                        <select
                          value={vehicle.caixa || ''}
                          onChange={(e) => setVehicle({...vehicle, caixa: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Selecione</option>
                          <option value="Manual">Manual</option>
                          <option value="Automática">Automática</option>
                        </select>
                      ) : (
                        <p className="font-medium">{vehicle.caixa}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">Lugares</Label>
                      {canEdit && editMode ? (
                        <Input
                          type="number"
                          value={vehicle.lugares || ''}
                          onChange={(e) => setVehicle({...vehicle, lugares: parseInt(e.target.value) || null})}
                          placeholder="Ex: 5"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.lugares}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-slate-600">KM Atual</Label>
                      {canEdit && editMode ? (
                        <Input
                          type="number"
                          value={vehicle.km_atual || 0}
                          onChange={(e) => setVehicle({...vehicle, km_atual: parseInt(e.target.value) || 0})}
                          placeholder="Ex: 50000"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.km_atual || 0} km</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card de DUA - Documento Único Automóvel */}
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    DUA - Documento Único Automóvel
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DUA Frente */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-medium">DUA - Frente</Label>
                        {vehicle.documento_dua_frente && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadDocument(vehicle.documento_dua_frente, 'DUA_Frente')}
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
                            if (file) handleUploadDocument(file, 'dua-frente');
                          }}
                          disabled={uploadingDoc}
                          className="mt-2"
                        />
                      )}
                      <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG</p>
                      {vehicle.documento_dua_frente && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" /> Carregado
                        </Badge>
                      )}
                    </div>

                    {/* DUA Verso */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-base font-medium">DUA - Verso</Label>
                        {vehicle.documento_dua_verso && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadDocument(vehicle.documento_dua_verso, 'DUA_Verso')}
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
                            if (file) handleUploadDocument(file, 'dua-verso');
                          }}
                          disabled={uploadingDoc}
                          className="mt-2"
                        />
                      )}
                      <p className="text-xs text-slate-500 mt-1">Formatos: PDF, JPG, PNG</p>
                      {vehicle.documento_dua_verso && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" /> Carregado
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Atribuição - Motorista, Via Verde e Cartões */}
              <Card className="mt-4 border-2 border-blue-200">
                <CardHeader className="pb-2 bg-blue-50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Atribuição - Motorista & Cartões
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Motorista */}
                    <div className="md:col-span-2">
                      <Label className="text-slate-600 font-medium">Motorista Atribuído</Label>
                      {canEdit && editMode ? (
                        <select
                          value={vehicle.motorista_atribuido || ''}
                          onChange={(e) => setVehicle({...vehicle, motorista_atribuido: e.target.value})}
                          className="w-full p-2 border rounded-md mt-1"
                        >
                          <option value="">Nenhum motorista atribuído</option>
                          {motoristasDisponiveis.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="font-medium text-lg">
                          {vehicle.motorista_atribuido_nome || 'Não atribuído'}
                        </p>
                      )}
                    </div>

                    {/* Via Verde */}
                    <div>
                      <Label className="text-slate-600">
                        🛣️ Via Verde ID
                        {vehicle.via_verde_id && vehicle.motorista_atribuido_nome && (
                          <span className="text-xs text-green-600 ml-2">✓ Associado</span>
                        )}
                      </Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.via_verde_id || ''}
                          onChange={(e) => setVehicle({...vehicle, via_verde_id: e.target.value, via_verde_disponivel: !!e.target.value})}
                          placeholder="Ex: 1234567890"
                          className="mt-1"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.via_verde_id || 'Não configurado'}</p>
                      )}
                      {vehicle.via_verde_id && vehicle.motorista_atribuido_nome && (
                        <p className="text-xs text-green-600 mt-1">
                          → Associado a: {vehicle.motorista_atribuido_nome}
                        </p>
                      )}
                    </div>

                    {/* Cartão Frota Combustível */}
                    <div>
                      <Label className="text-slate-600">
                        ⛽ Cartão Frota (Combustível)
                        {vehicle.cartao_frota_id && vehicle.motorista_atribuido_nome && (
                          <span className="text-xs text-green-600 ml-2">✓ Associado</span>
                        )}
                      </Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.cartao_frota_id || ''}
                          onChange={(e) => setVehicle({...vehicle, cartao_frota_id: e.target.value, cartao_frota_disponivel: !!e.target.value})}
                          placeholder="7824731736480003"
                          className="mt-1"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.cartao_frota_id || 'Não configurado'}</p>
                      )}
                      {vehicle.cartao_frota_id && vehicle.motorista_atribuido_nome && (
                        <p className="text-xs text-green-600 mt-1">
                          → Associado a: {vehicle.motorista_atribuido_nome}
                        </p>
                      )}
                    </div>
                    
                    {/* Cartão Frota Elétrico */}
                    <div>
                      <Label className="text-slate-600">
                        🔌 Cartão Frota Elétrico (Carregamentos)
                        {vehicle.cartao_frota_eletric_id && vehicle.motorista_atribuido_nome && (
                          <span className="text-xs text-green-600 ml-2">✓ Associado</span>
                        )}
                      </Label>
                      {canEdit && editMode ? (
                        <Input
                          value={vehicle.cartao_frota_eletric_id || ''}
                          onChange={(e) => setVehicle({...vehicle, cartao_frota_eletric_id: e.target.value})}
                          placeholder="PTPRIO6087131736480003"
                          className="mt-1"
                        />
                      ) : (
                        <p className="font-medium">{vehicle.cartao_frota_eletric_id || 'Não configurado'}</p>
                      )}
                      {vehicle.cartao_frota_eletric_id && vehicle.motorista_atribuido_nome && (
                        <p className="text-xs text-green-600 mt-1">
                          → Associado a: {vehicle.motorista_atribuido_nome}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <Label className="text-slate-600">Status do Veículo</Label>
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
                          className="w-full p-2 border rounded-md mt-1"
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="atribuido">Atribuído</option>
                          <option value="manutencao">Manutenção</option>
                          <option value="venda">Venda</option>
                          <option value="condicoes">Condições</option>
                        </select>
                      ) : (
                        <p className="font-medium capitalize">
                          {vehicle.status === 'disponivel' ? '🟢 Disponível' :
                           vehicle.status === 'atribuido' ? '🔵 Atribuído' :
                           vehicle.status === 'manutencao' ? '🟡 Manutenção' :
                           vehicle.status === 'venda' ? '🔴 Venda' :
                           vehicle.status === 'condicoes' ? '🟠 Condições' :
                           '🟢 Disponível'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Informação de associação automática */}
                  {vehicle.motorista_atribuido && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                      <strong>ℹ️ Nota:</strong> Ao guardar, os cartões Via Verde e Frota serão automaticamente associados ao motorista <strong>{vehicle.motorista_atribuido_nome}</strong> para facilitar o registo de despesas.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tipo de Contrato Detalhado */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tipo de Contrato Detalhado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Tipo de Contrato */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                        {canEdit && editMode ? (
                          <select
                            id="tipo_contrato"
                            value={infoForm.tipo}
                            onChange={(e) => setInfoForm({...infoForm, tipo: e.target.value})}
                            className="w-full p-2 border rounded-md"
                          >
                            <option value="aluguer_sem_caucao">Aluguer sem Caução</option>
                            <option value="aluguer_com_caucao">Aluguer com Caução</option>
                            <option value="aluguer_caucao_parcelada">Aluguer com Caução Parcelada</option>
                            <option value="periodo_epoca">Período de Época</option>
                            <option value="aluguer_epocas_sem_caucao">Aluguer com Épocas sem Caução</option>
                            <option value="aluguer_epocas_caucao">Aluguer com Épocas e Caução</option>
                            <option value="aluguer_epoca_caucao_parcelada">Aluguer Época com Caução Parcelada</option>
                            <option value="compra_veiculo">Compra de Veículo</option>
                            <option value="comissao">Comissão</option>
                            <option value="motorista_privado">Motorista Privado</option>
                            <option value="outros">Outros</option>
                          </select>
                        ) : (
                          <p className="font-medium text-sm">
                            {vehicle.tipo_contrato?.tipo === 'aluguer_sem_caucao' ? 'Aluguer sem Caução' :
                             vehicle.tipo_contrato?.tipo === 'aluguer_com_caucao' ? 'Aluguer com Caução' :
                             vehicle.tipo_contrato?.tipo === 'aluguer_caucao_parcelada' ? 'Aluguer com Caução Parcelada' :
                             vehicle.tipo_contrato?.tipo === 'periodo_epoca' ? 'Período de Época' :
                             vehicle.tipo_contrato?.tipo === 'aluguer_epocas_sem_caucao' ? 'Aluguer com Épocas sem Caução' :
                             vehicle.tipo_contrato?.tipo === 'aluguer_epocas_caucao' ? 'Aluguer com Épocas e Caução' :
                             vehicle.tipo_contrato?.tipo === 'aluguer_epoca_caucao_parcelada' ? 'Aluguer Época com Caução Parcelada' :
                             vehicle.tipo_contrato?.tipo === 'compra_veiculo' ? 'Compra de Veículo' :
                             vehicle.tipo_contrato?.tipo === 'comissao' ? 'Comissão' :
                             vehicle.tipo_contrato?.tipo === 'motorista_privado' ? 'Motorista Privado' :
                             vehicle.tipo_contrato?.tipo === 'aluguer' ? 'Aluguer (Legacy)' :
                             'N/A'}
                          </p>
                        )}
                      </div>
                      
                      {/* Periodicidade */}
                      <div>
                        <Label htmlFor="periodicidade">Periodicidade</Label>
                        {canEdit && editMode ? (
                          <select
                            id="periodicidade"
                            value={infoForm.periodicidade}
                            onChange={(e) => setInfoForm({...infoForm, periodicidade: e.target.value})}
                            className="w-full p-2 border rounded-md"
                          >
                            <option value="semanal">Semanal</option>
                            <option value="mensal">Mensal</option>
                          </select>
                        ) : (
                          <p className="font-medium capitalize">{vehicle.tipo_contrato?.periodicidade || 'semanal'}</p>
                        )}
                      </div>
                    </div>

                    {/* Campos específicos por tipo */}
                    
                    {/* Valor Aluguer (para todos os tipos de aluguer incluindo legacy) */}
                    {((editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo)?.includes('aluguer') || 
                      (editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'periodo_epoca') && (
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

                    {/* Caução (para tipos com caução) */}
                    {['aluguer_com_caucao', 'aluguer_caucao_parcelada', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) && (
                      <div className="grid grid-cols-2 gap-3 bg-blue-50 p-3 rounded-lg">
                        <div className="col-span-2 font-semibold text-sm text-blue-900">Caução</div>
                        <div>
                          <Label htmlFor="valor_caucao">Valor Caução (€)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="valor_caucao"
                              type="number"
                              step="0.01"
                              value={infoForm.valor_caucao}
                              onChange={(e) => setInfoForm({...infoForm, valor_caucao: e.target.value})}
                              placeholder="Ex: 500.00"
                            />
                          ) : (
                            <p className="font-medium">€{vehicle.tipo_contrato?.valor_caucao || '0.00'}</p>
                          )}
                        </div>
                        {['aluguer_caucao_parcelada', 'aluguer_epoca_caucao_parcelada'].includes(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) && (
                          <div>
                            <Label htmlFor="numero_parcelas_caucao">Número de Parcelas</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="numero_parcelas_caucao"
                                type="number"
                                value={infoForm.numero_parcelas_caucao}
                                onChange={(e) => setInfoForm({...infoForm, numero_parcelas_caucao: e.target.value})}
                                placeholder="Ex: 4"
                              />
                            ) : (
                              <p className="font-medium">{vehicle.tipo_contrato?.numero_parcelas_caucao || '0'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Épocas (para tipos com época) */}
                    {['periodo_epoca', 'aluguer_epocas_sem_caucao', 'aluguer_epocas_caucao', 'aluguer_epoca_caucao_parcelada'].includes(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) && (
                      <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3 rounded-lg">
                        <div className="col-span-2 font-semibold text-sm text-amber-900">Épocas</div>
                        <div>
                          <Label htmlFor="valor_epoca_alta">Época Alta (€)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="valor_epoca_alta"
                              type="number"
                              step="0.01"
                              value={infoForm.valor_epoca_alta}
                              onChange={(e) => setInfoForm({...infoForm, valor_epoca_alta: e.target.value})}
                              placeholder="Ex: 300.00"
                            />
                          ) : (
                            <p className="font-medium">€{vehicle.tipo_contrato?.valor_epoca_alta || '0.00'}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="valor_epoca_baixa">Época Baixa (€)</Label>
                          {canEdit && editMode ? (
                            <Input
                              id="valor_epoca_baixa"
                              type="number"
                              step="0.01"
                              value={infoForm.valor_epoca_baixa}
                              onChange={(e) => setInfoForm({...infoForm, valor_epoca_baixa: e.target.value})}
                              placeholder="Ex: 200.00"
                            />
                          ) : (
                            <p className="font-medium">€{vehicle.tipo_contrato?.valor_epoca_baixa || '0.00'}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'comissao' && (
                      <div className="space-y-3 bg-green-50 p-3 rounded-lg">
                        <div className="font-semibold text-sm text-green-900">Comissão</div>
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
                        <div className="flex items-center space-x-2">
                          {canEdit && editMode ? (
                            <>
                              <input
                                type="checkbox"
                                id="inclui_combustivel"
                                checked={infoForm.inclui_combustivel}
                                onChange={(e) => setInfoForm({...infoForm, inclui_combustivel: e.target.checked})}
                                className="rounded"
                              />
                              <Label htmlFor="inclui_combustivel" className="cursor-pointer">Combustível Incluído</Label>
                            </>
                          ) : (
                            <p className="text-sm">
                              Combustível: {vehicle.tipo_contrato?.inclui_combustivel ? '✓ Incluído' : '✗ Não incluído'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {(editMode ? infoForm.tipo : vehicle.tipo_contrato?.tipo) === 'compra_veiculo' && (
                      <div className="space-y-3 bg-purple-50 p-3 rounded-lg">
                        <div className="font-semibold text-sm text-purple-900">Compra de Veículo</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="valor_compra_veiculo">Valor Total Compra (€)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="valor_compra_veiculo"
                                type="number"
                                step="0.01"
                                value={infoForm.valor_compra_veiculo}
                                onChange={(e) => setInfoForm({...infoForm, valor_compra_veiculo: e.target.value})}
                                placeholder="Ex: 15000.00"
                              />
                            ) : (
                              <p className="font-medium">€{vehicle.tipo_contrato?.valor_compra_veiculo || '0.00'}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="numero_semanas_compra">Número de Semanas</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="numero_semanas_compra"
                                type="number"
                                value={infoForm.numero_semanas_compra}
                                onChange={(e) => setInfoForm({...infoForm, numero_semanas_compra: e.target.value})}
                                placeholder="Ex: 104"
                              />
                            ) : (
                              <p className="font-medium">{vehicle.tipo_contrato?.numero_semanas_compra || 0} semanas</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex items-center space-x-2">
                            {canEdit && editMode ? (
                              <>
                                <input
                                  type="checkbox"
                                  id="com_slot"
                                  checked={infoForm.com_slot}
                                  onChange={(e) => setInfoForm({...infoForm, com_slot: e.target.checked})}
                                  className="rounded"
                                />
                                <Label htmlFor="com_slot" className="cursor-pointer">Com Slot</Label>
                              </>
                            ) : (
                              <p className="text-sm">Slot: {vehicle.tipo_contrato?.com_slot ? '✓ Sim' : '✗ Não'}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {canEdit && editMode ? (
                              <>
                                <input
                                  type="checkbox"
                                  id="extra_seguro"
                                  checked={infoForm.extra_seguro}
                                  onChange={(e) => setInfoForm({...infoForm, extra_seguro: e.target.checked})}
                                  className="rounded"
                                />
                                <Label htmlFor="extra_seguro" className="cursor-pointer">Extra Seguro</Label>
                              </>
                            ) : (
                              <p className="text-sm">Extra Seguro: {vehicle.tipo_contrato?.extra_seguro ? '✓ Sim' : '✗ Não'}</p>
                            )}
                          </div>
                          {(editMode ? infoForm.extra_seguro : vehicle.tipo_contrato?.extra_seguro) && (
                            <div>
                              <Label htmlFor="valor_extra_seguro">Valor (€)</Label>
                              {canEdit && editMode ? (
                                <Input
                                  id="valor_extra_seguro"
                                  type="number"
                                  step="0.01"
                                  value={infoForm.valor_extra_seguro}
                                  onChange={(e) => setInfoForm({...infoForm, valor_extra_seguro: e.target.value})}
                                  placeholder="Ex: 50.00"
                                />
                              ) : (
                                <p className="font-medium">€{vehicle.tipo_contrato?.valor_extra_seguro || '0.00'}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 border-t pt-2 mt-2">Legacy (compatibilidade):</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="valor_semanal_compra">Valor Semanal (€) [Legacy]</Label>
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

              {/* Condições de Quilometragem */}
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Condições de Quilometragem
                  </CardTitle>
                  <p className="text-xs text-slate-500">Limite de KM semanais e valor extra por KM excedido</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Toggle limite KM */}
                    <div className="flex items-center space-x-2">
                      {canEdit && editMode ? (
                        <>
                          <input
                            type="checkbox"
                            id="tem_limite_km"
                            checked={infoForm.tem_limite_km || false}
                            onChange={(e) => setInfoForm({...infoForm, tem_limite_km: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <Label htmlFor="tem_limite_km" className="cursor-pointer font-medium">
                            Aplicar limite de quilometragem semanal
                          </Label>
                        </>
                      ) : (
                        <p className="font-medium">
                          {vehicle.tipo_contrato?.tem_limite_km ? '✓ Com limite de KM' : '✗ Sem limite de KM'}
                        </p>
                      )}
                    </div>

                    {(editMode ? infoForm.tem_limite_km : vehicle.tipo_contrato?.tem_limite_km) && (
                      <div className="bg-amber-50 p-4 rounded-lg space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* KM Disponíveis */}
                          <div>
                            <Label htmlFor="km_semanais_disponiveis">KM Semanais Disponíveis</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="km_semanais_disponiveis"
                                type="number"
                                value={infoForm.km_semanais_disponiveis || ''}
                                onChange={(e) => setInfoForm({...infoForm, km_semanais_disponiveis: e.target.value})}
                                placeholder="Ex: 1500"
                              />
                            ) : (
                              <p className="font-medium text-lg">{vehicle.tipo_contrato?.km_semanais_disponiveis?.toLocaleString() || 0} km</p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Plafond semanal atribuído</p>
                          </div>

                          {/* Valor Extra por KM */}
                          <div>
                            <Label htmlFor="valor_extra_km">Valor Extra por KM (€)</Label>
                            {canEdit && editMode ? (
                              <Input
                                id="valor_extra_km"
                                type="number"
                                step="0.01"
                                value={infoForm.valor_extra_km || ''}
                                onChange={(e) => setInfoForm({...infoForm, valor_extra_km: e.target.value})}
                                placeholder="Ex: 0.15"
                              />
                            ) : (
                              <p className="font-medium text-lg text-orange-600">€{vehicle.tipo_contrato?.valor_extra_km || 0}/km</p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Valor a cobrar por KM excedido</p>
                          </div>

                          {/* Acumulação */}
                          <div>
                            <Label>Acumulação de KM</Label>
                            {canEdit && editMode ? (
                              <div className="mt-2">
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    id="km_acumula_semanal"
                                    checked={infoForm.km_acumula_semanal || false}
                                    onChange={(e) => setInfoForm({...infoForm, km_acumula_semanal: e.target.checked})}
                                    className="mr-2 w-4 h-4"
                                  />
                                  <span className="text-sm">KM não usados acumulam</span>
                                </label>
                              </div>
                            ) : (
                              <p className="font-medium">
                                {vehicle.tipo_contrato?.km_acumula_semanal 
                                  ? '✓ Com acumulação semanal' 
                                  : '✗ Sem acumulação (reset semanal)'}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Se KM não usados passam para próxima semana</p>
                          </div>
                        </div>

                        {/* KM por Época */}
                        <div className="mt-4">
                          <div className="flex items-center space-x-2 mb-3">
                            {canEdit && editMode ? (
                              <>
                                <input
                                  type="checkbox"
                                  id="km_por_epoca"
                                  checked={infoForm.km_por_epoca || false}
                                  onChange={(e) => setInfoForm({...infoForm, km_por_epoca: e.target.checked})}
                                  className="w-4 h-4"
                                />
                                <Label htmlFor="km_por_epoca" className="cursor-pointer font-medium">
                                  KM diferentes por época (Alta/Baixa)
                                </Label>
                              </>
                            ) : (
                              <p className="font-medium">
                                {vehicle.tipo_contrato?.km_por_epoca ? '✓ KM por época' : '✗ KM único todo o ano'}
                              </p>
                            )}
                          </div>

                          {(editMode ? infoForm.km_por_epoca : vehicle.tipo_contrato?.km_por_epoca) && (
                            <div className="bg-gradient-to-r from-orange-50 to-blue-50 p-4 rounded-lg space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Época Alta */}
                                <div className="bg-orange-100 p-3 rounded-lg">
                                  <Label className="font-semibold text-orange-800 flex items-center gap-2">
                                    ☀️ Época Alta
                                  </Label>
                                  <div className="mt-2">
                                    <Label className="text-sm">KM Semanais</Label>
                                    {canEdit && editMode ? (
                                      <Input
                                        type="number"
                                        value={infoForm.km_epoca_alta || ''}
                                        onChange={(e) => setInfoForm({...infoForm, km_epoca_alta: e.target.value})}
                                        placeholder="Ex: 2000"
                                        className="mt-1"
                                      />
                                    ) : (
                                      <p className="font-bold text-lg text-orange-700">{vehicle.tipo_contrato?.km_epoca_alta?.toLocaleString() || 0} km</p>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <Label className="text-sm">Meses</Label>
                                    {canEdit && editMode ? (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((mes, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                              const meses = infoForm.meses_epoca_alta || [];
                                              const newMeses = meses.includes(idx + 1)
                                                ? meses.filter(m => m !== idx + 1)
                                                : [...meses, idx + 1];
                                              setInfoForm({...infoForm, meses_epoca_alta: newMeses});
                                            }}
                                            className={`px-2 py-1 text-xs rounded ${
                                              (infoForm.meses_epoca_alta || []).includes(idx + 1)
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-white border'
                                            }`}
                                          >
                                            {mes}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-orange-600">
                                        {(vehicle.tipo_contrato?.meses_epoca_alta || []).map(m => 
                                          ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1]
                                        ).join(', ') || 'Não definido'}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Época Baixa */}
                                <div className="bg-blue-100 p-3 rounded-lg">
                                  <Label className="font-semibold text-blue-800 flex items-center gap-2">
                                    ❄️ Época Baixa
                                  </Label>
                                  <div className="mt-2">
                                    <Label className="text-sm">KM Semanais</Label>
                                    {canEdit && editMode ? (
                                      <Input
                                        type="number"
                                        value={infoForm.km_epoca_baixa || ''}
                                        onChange={(e) => setInfoForm({...infoForm, km_epoca_baixa: e.target.value})}
                                        placeholder="Ex: 1200"
                                        className="mt-1"
                                      />
                                    ) : (
                                      <p className="font-bold text-lg text-blue-700">{vehicle.tipo_contrato?.km_epoca_baixa?.toLocaleString() || 0} km</p>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <Label className="text-sm">Meses (restantes)</Label>
                                    <p className="text-sm text-blue-600 mt-1">
                                      {editMode 
                                        ? `Meses não selecionados na época alta`
                                        : (vehicle.tipo_contrato?.meses_epoca_baixa || []).map(m => 
                                            ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1]
                                          ).join(', ') || 'Restantes'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Resumo/Exemplo */}
                        {!editMode && vehicle.tipo_contrato?.km_semanais_disponiveis && (
                          <div className="bg-white p-3 rounded-lg border mt-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2">📊 Exemplo de Cálculo</p>
                            <p className="text-xs text-slate-600">
                              Se o motorista fizer <strong>{(vehicle.tipo_contrato?.km_semanais_disponiveis || 0) + 200} km</strong> numa semana, 
                              excede <strong>200 km</strong> do plafond, resultando em despesa extra de{' '}
                              <strong className="text-orange-600">
                                €{(200 * (vehicle.tipo_contrato?.valor_extra_km || 0)).toFixed(2)}
                              </strong> a adicionar ao relatório.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Contratos do Veículo */}
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Contratos
                  </CardTitle>
                  <p className="text-xs text-slate-500">Contratos assinados pelo motorista e parceiro</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Upload de novo contrato */}
                    {canEdit && editMode && (
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <Label className="font-semibold mb-2 block">Adicionar Contrato Assinado</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm">Documento (PDF)</Label>
                            <Input
                              type="file"
                              accept=".pdf"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('tipo', 'contrato_veiculo');
                                    const token = localStorage.getItem('token');
                                    const response = await axios.post(
                                      `${API}/vehicles/${vehicleId}/upload-contrato`,
                                      formData,
                                      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
                                    );
                                    toast.success('Contrato carregado com sucesso!');
                                    fetchVehicleData();
                                  } catch (error) {
                                    toast.error('Erro ao carregar contrato');
                                  }
                                }
                              }}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lista de contratos */}
                    {vehicle.contratos && vehicle.contratos.length > 0 ? (
                      <div className="space-y-2">
                        {vehicle.contratos.map((contrato, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-medium">{contrato.tipo || 'Contrato'}</p>
                                <p className="text-xs text-slate-500">
                                  {contrato.data ? new Date(contrato.data).toLocaleString('pt-PT') : 'Data não disponível'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {contrato.assinado_motorista && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Motorista ✓</Badge>
                              )}
                              {contrato.assinado_parceiro && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">Parceiro ✓</Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadDocument(contrato.documento_url, `Contrato_${idx + 1}`)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Nenhum contrato registado</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Investimento / Aquisição do Veículo (para ROI) */}
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Investimento do Veículo
                  </CardTitle>
                  <p className="text-xs text-slate-500">Dados de aquisição para cálculo de ROI (Retorno sobre Investimento)</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Toggle investimento */}
                    <div className="flex items-center space-x-2">
                      {canEdit && editMode ? (
                        <>
                          <input
                            type="checkbox"
                            id="tem_investimento"
                            checked={infoForm.tem_investimento || false}
                            onChange={(e) => setInfoForm({...infoForm, tem_investimento: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <Label htmlFor="tem_investimento" className="cursor-pointer font-medium">
                            Registar dados de investimento/aquisição
                          </Label>
                        </>
                      ) : (
                        <p className="font-medium">
                          {vehicle.investimento?.tem_investimento ? '✓ Com dados de investimento' : '✗ Sem dados de investimento'}
                        </p>
                      )}
                    </div>

                    {(editMode ? infoForm.tem_investimento : vehicle.investimento?.tem_investimento) && (
                      <div className="space-y-4">
                        {/* Tipo de Aquisição */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <Label className="font-semibold mb-2 block">Tipo de Aquisição</Label>
                          <div className="grid grid-cols-3 gap-4">
                            {canEdit && editMode ? (
                              <>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${infoForm.tipo_aquisicao === 'compra' ? 'bg-blue-100 border-blue-500' : 'bg-white'}`}>
                                  <input
                                    type="radio"
                                    name="tipo_aquisicao"
                                    value="compra"
                                    checked={infoForm.tipo_aquisicao === 'compra'}
                                    onChange={(e) => setInfoForm({...infoForm, tipo_aquisicao: e.target.value})}
                                    className="mr-2"
                                  />
                                  <div>
                                    <p className="font-medium">Compra</p>
                                    <p className="text-xs text-slate-500">Pagamento integral</p>
                                  </div>
                                </label>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${infoForm.tipo_aquisicao === 'credito' ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                                  <input
                                    type="radio"
                                    name="tipo_aquisicao"
                                    value="credito"
                                    checked={infoForm.tipo_aquisicao === 'credito'}
                                    onChange={(e) => setInfoForm({...infoForm, tipo_aquisicao: e.target.value})}
                                    className="mr-2"
                                  />
                                  <div>
                                    <p className="font-medium">Crédito</p>
                                    <p className="text-xs text-slate-500">Prestações s/ IVA</p>
                                  </div>
                                </label>
                                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${infoForm.tipo_aquisicao === 'leasing' ? 'bg-purple-100 border-purple-500' : 'bg-white'}`}>
                                  <input
                                    type="radio"
                                    name="tipo_aquisicao"
                                    value="leasing"
                                    checked={infoForm.tipo_aquisicao === 'leasing'}
                                    onChange={(e) => setInfoForm({...infoForm, tipo_aquisicao: e.target.value})}
                                    className="mr-2"
                                  />
                                  <div>
                                    <p className="font-medium">Leasing</p>
                                    <p className="text-xs text-slate-500">Prestações c/ IVA</p>
                                  </div>
                                </label>
                              </>
                            ) : (
                              <p className="font-medium capitalize col-span-3">
                                {vehicle.investimento?.tipo_aquisicao === 'compra' ? '💰 Compra (Pagamento Integral)' :
                                 vehicle.investimento?.tipo_aquisicao === 'credito' ? '🏦 Crédito (Prestações s/ IVA)' :
                                 vehicle.investimento?.tipo_aquisicao === 'leasing' ? '📋 Leasing (Prestações c/ IVA)' : 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Valor de Aquisição */}
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <Label className="font-semibold mb-2 block">Valor de Aquisição</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Valor Total (€)</Label>
                              {canEdit && editMode ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={infoForm.valor_aquisicao || ''}
                                  onChange={(e) => setInfoForm({...infoForm, valor_aquisicao: e.target.value})}
                                  placeholder="Ex: 25000.00"
                                />
                              ) : (
                                <p className="font-medium text-lg">€{vehicle.investimento?.valor_aquisicao || 0}</p>
                              )}
                            </div>
                            <div>
                              <Label>IVA (%)</Label>
                              {canEdit && editMode ? (
                                <select
                                  value={infoForm.iva_aquisicao || '23'}
                                  onChange={(e) => setInfoForm({...infoForm, iva_aquisicao: e.target.value})}
                                  className="w-full p-2 border rounded-md"
                                >
                                  <option value="0">Isento (0%)</option>
                                  <option value="6">Reduzido (6%)</option>
                                  <option value="13">Intermédio (13%)</option>
                                  <option value="23">Normal (23%)</option>
                                </select>
                              ) : (
                                <p className="font-medium">{vehicle.investimento?.iva_aquisicao || 0}%</p>
                              )}
                            </div>
                            <div className="flex items-center">
                              {canEdit && editMode ? (
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={infoForm.valor_aquisicao_com_iva || false}
                                    onChange={(e) => setInfoForm({...infoForm, valor_aquisicao_com_iva: e.target.checked})}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Valor inclui IVA</span>
                                </label>
                              ) : (
                                <p className="text-sm">{vehicle.investimento?.valor_aquisicao_com_iva ? '✓ Com IVA incluído' : '✗ Sem IVA'}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Campos de Crédito/Leasing */}
                        {(editMode ? ['credito', 'leasing'].includes(infoForm.tipo_aquisicao) : ['credito', 'leasing'].includes(vehicle.investimento?.tipo_aquisicao)) && (
                          <div className={`p-4 rounded-lg ${(editMode ? infoForm.tipo_aquisicao : vehicle.investimento?.tipo_aquisicao) === 'leasing' ? 'bg-purple-50' : 'bg-green-50'}`}>
                            <Label className="font-semibold mb-2 block">
                              {(editMode ? infoForm.tipo_aquisicao : vehicle.investimento?.tipo_aquisicao) === 'leasing' ? 'Dados do Leasing' : 'Dados do Crédito'}
                            </Label>
                            
                            {/* Entrada */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <Label>Valor Entrada (€)</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={infoForm.valor_entrada || ''}
                                    onChange={(e) => setInfoForm({...infoForm, valor_entrada: e.target.value})}
                                    placeholder="Ex: 5000.00"
                                  />
                                ) : (
                                  <p className="font-medium">€{vehicle.investimento?.valor_entrada || 0}</p>
                                )}
                              </div>
                              <div className="flex items-end pb-2">
                                {canEdit && editMode ? (
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={infoForm.valor_entrada_com_iva || false}
                                      onChange={(e) => setInfoForm({...infoForm, valor_entrada_com_iva: e.target.checked})}
                                      className="mr-2"
                                    />
                                    <span className="text-sm">Entrada c/ IVA</span>
                                  </label>
                                ) : (
                                  <p className="text-sm">{vehicle.investimento?.valor_entrada_com_iva ? '✓ c/ IVA' : '✗ s/ IVA'}</p>
                                )}
                              </div>
                              <div>
                                <Label>Entidade Financiadora</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    value={infoForm.entidade_financiadora || ''}
                                    onChange={(e) => setInfoForm({...infoForm, entidade_financiadora: e.target.value})}
                                    placeholder="Ex: Banco XYZ"
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.entidade_financiadora || 'N/A'}</p>
                                )}
                              </div>
                              <div>
                                <Label>Taxa de Juro (%)</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={infoForm.taxa_juro || ''}
                                    onChange={(e) => setInfoForm({...infoForm, taxa_juro: e.target.value})}
                                    placeholder="Ex: 5.5"
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.taxa_juro || 0}%</p>
                                )}
                              </div>
                            </div>

                            {/* Prestações */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <Label>Valor Prestação (€)</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={infoForm.valor_prestacao || ''}
                                    onChange={(e) => setInfoForm({...infoForm, valor_prestacao: e.target.value})}
                                    placeholder="Ex: 350.00"
                                  />
                                ) : (
                                  <p className="font-medium text-orange-600">€{vehicle.investimento?.valor_prestacao || 0}/mês</p>
                                )}
                              </div>
                              <div className="flex items-end pb-2">
                                {(editMode ? infoForm.tipo_aquisicao : vehicle.investimento?.tipo_aquisicao) === 'leasing' ? (
                                  <Badge className="bg-purple-100 text-purple-800">Prestação c/ IVA</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800">Prestação s/ IVA</Badge>
                                )}
                              </div>
                              <div>
                                <Label>Nº Prestações</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="number"
                                    value={infoForm.numero_prestacoes || ''}
                                    onChange={(e) => setInfoForm({...infoForm, numero_prestacoes: e.target.value})}
                                    placeholder="Ex: 60"
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.numero_prestacoes || 0} meses</p>
                                )}
                              </div>
                              <div>
                                <Label>Prestações Pagas</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="number"
                                    value={infoForm.prestacoes_pagas || ''}
                                    onChange={(e) => setInfoForm({...infoForm, prestacoes_pagas: e.target.value})}
                                    placeholder="Ex: 12"
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.prestacoes_pagas || 0}</p>
                                )}
                              </div>
                            </div>

                            {/* Datas e Valor Residual */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <Label>Data Início</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="date"
                                    value={infoForm.data_inicio_financiamento || ''}
                                    onChange={(e) => setInfoForm({...infoForm, data_inicio_financiamento: e.target.value})}
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.data_inicio_financiamento || 'N/A'}</p>
                                )}
                              </div>
                              <div>
                                <Label>Data Fim</Label>
                                {canEdit && editMode ? (
                                  <Input
                                    type="date"
                                    value={infoForm.data_fim_financiamento || ''}
                                    onChange={(e) => setInfoForm({...infoForm, data_fim_financiamento: e.target.value})}
                                  />
                                ) : (
                                  <p className="font-medium">{vehicle.investimento?.data_fim_financiamento || 'N/A'}</p>
                                )}
                              </div>
                              {(editMode ? infoForm.tipo_aquisicao : vehicle.investimento?.tipo_aquisicao) === 'leasing' && (
                                <div>
                                  <Label>Valor Residual (€)</Label>
                                  {canEdit && editMode ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={infoForm.valor_residual || ''}
                                      onChange={(e) => setInfoForm({...infoForm, valor_residual: e.target.value})}
                                      placeholder="Ex: 5000.00"
                                    />
                                  ) : (
                                    <p className="font-medium">€{vehicle.investimento?.valor_residual || 0}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Resumo ROI */}
                        {!editMode && vehicle.investimento?.valor_aquisicao && (
                          <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-3">📊 Resumo do Investimento</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="p-2 bg-blue-50 rounded">
                                <p className="text-slate-500">Valor Aquisição</p>
                                <p className="font-bold text-blue-600 text-lg">
                                  €{(vehicle.investimento?.valor_aquisicao || 0).toLocaleString('pt-PT', {minimumFractionDigits: 2})}
                                </p>
                              </div>
                              {['credito', 'leasing'].includes(vehicle.investimento?.tipo_aquisicao) && (
                                <>
                                  <div className="p-2 bg-green-50 rounded">
                                    <p className="text-slate-500">Total Pago</p>
                                    <p className="font-bold text-green-600 text-lg">
                                      €{((vehicle.investimento?.valor_entrada || 0) + (vehicle.investimento?.prestacoes_pagas || 0) * (vehicle.investimento?.valor_prestacao || 0)).toLocaleString('pt-PT', {minimumFractionDigits: 2})}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-orange-50 rounded">
                                    <p className="text-slate-500">Em Falta</p>
                                    <p className="font-bold text-orange-600 text-lg">
                                      €{(((vehicle.investimento?.numero_prestacoes || 0) - (vehicle.investimento?.prestacoes_pagas || 0)) * (vehicle.investimento?.valor_prestacao || 0)).toLocaleString('pt-PT', {minimumFractionDigits: 2})}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-purple-50 rounded">
                                    <p className="text-slate-500">Total c/ Juros</p>
                                    <p className="font-bold text-purple-600 text-lg">
                                      €{((vehicle.investimento?.valor_entrada || 0) + (vehicle.investimento?.numero_prestacoes || 0) * (vehicle.investimento?.valor_prestacao || 0) + (vehicle.investimento?.valor_residual || 0)).toLocaleString('pt-PT', {minimumFractionDigits: 2})}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
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
                    {categoriasUber.map((cat) => {
                      const catKey = cat.toLowerCase().replace(/\s+/g, '_');
                      return (
                        <div key={catKey} className="flex items-center space-x-2">
                          {canEdit && editMode ? (
                            <input
                              type="checkbox"
                              id={`uber_${catKey}`}
                              checked={infoForm.categorias_uber[catKey] || false}
                              onChange={(e) => setInfoForm({
                                ...infoForm,
                                categorias_uber: {...infoForm.categorias_uber, [catKey]: e.target.checked}
                              })}
                              className="w-4 h-4"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={vehicle.categorias_uber?.[catKey] || false}
                              disabled
                              className="w-4 h-4"
                            />
                          )}
                          <Label htmlFor={`uber_${catKey}`}>{cat}</Label>
                        </div>
                      );
                    })}
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
                    {categoriasBolt.map((cat) => {
                      const catKey = cat.toLowerCase().replace(/\s+/g, '_');
                      return (
                        <div key={catKey} className="flex items-center space-x-2">
                          {canEdit && editMode ? (
                            <input
                              type="checkbox"
                              id={`bolt_${catKey}`}
                              checked={infoForm.categorias_bolt[catKey] || false}
                              onChange={(e) => setInfoForm({
                                ...infoForm,
                                categorias_bolt: {...infoForm.categorias_bolt, [catKey]: e.target.checked}
                              })}
                              className="w-4 h-4"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={vehicle.categorias_bolt?.[catKey] || false}
                              disabled
                              className="w-4 h-4"
                            />
                          )}
                          <Label htmlFor={`bolt_${catKey}`}>{cat}</Label>
                        </div>
                      );
                    })}
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

          {/* Dispositivos */}
          <TabsContent value="dispositivos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span>Dispositivos Associados</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-gray-500">
                  Configure os dispositivos associados a este veículo. Quando um motorista é atribuído, 
                  herda automaticamente estes dispositivos.
                </p>
                
                <div className="grid grid-cols-2 gap-6">
                  {/* OBU Via Verde */}
                  <div className="space-y-2">
                    <Label htmlFor="obu_via_verde" className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      OBU Via Verde
                    </Label>
                    <Input
                      id="obu_via_verde"
                      placeholder="Número do identificador OBU"
                      value={vehicle?.via_verde_id || ''}
                      onChange={(e) => setVehicle({...vehicle, via_verde_id: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                    <p className="text-xs text-gray-400">Identificador do dispositivo Via Verde</p>
                  </div>

                  {/* GPS */}
                  <div className="space-y-2">
                    <Label htmlFor="gps_matricula" className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      GPS (Matrícula)
                    </Label>
                    <Input
                      id="gps_matricula"
                      value={vehicle?.matricula || ''}
                      disabled={true}
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-400">O GPS é identificado pela matrícula do veículo</p>
                  </div>

                  {/* Cartão Combustível Fóssil */}
                  <div className="space-y-2">
                    <Label htmlFor="cartao_fossil" className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                      Cartão Combustível Fóssil
                    </Label>
                    <Input
                      id="cartao_fossil"
                      placeholder="Número do cartão de frota"
                      value={vehicle?.cartao_frota_id || ''}
                      onChange={(e) => setVehicle({...vehicle, cartao_frota_id: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                    <p className="text-xs text-gray-400">Cartão para abastecimentos de combustível</p>
                  </div>

                  {/* Cartão Combustível Elétrico */}
                  <div className="space-y-2">
                    <Label htmlFor="cartao_eletrico" className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                      Cartão Combustível Elétrico
                    </Label>
                    <Input
                      id="cartao_eletrico"
                      placeholder="Número do cartão de carregamento"
                      value={vehicle?.cartao_frota_eletric_id || ''}
                      onChange={(e) => setVehicle({...vehicle, cartao_frota_eletric_id: e.target.value})}
                      disabled={!canEdit || !editMode}
                    />
                    <p className="text-xs text-gray-400">Cartão para carregamentos elétricos</p>
                  </div>
                </div>

                {/* Motorista Atribuído */}
                {vehicle?.motorista_atribuido && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Motorista Atribuído</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm"><strong>Nome:</strong> {vehicle.motorista_atribuido_nome}</p>
                        {vehicle.motorista_atribuido_desde && (
                          <p className="text-xs text-gray-500">
                            Desde: {new Date(vehicle.motorista_atribuido_desde).toLocaleString('pt-PT')}
                          </p>
                        )}
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Dispositivos sincronizados
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico de Atribuições */}
          <TabsContent value="historico">
            <HistoricoAtribuicoesTab vehicleId={vehicleId} canEdit={canEdit} user={user} />
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
                </CardContent>
              </Card>

              {/* Plano de Manutenções e Alertas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Plano de Manutenções e Alertas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="alertas" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="alertas">Alertas</TabsTrigger>
                      <TabsTrigger value="plano">Plano de Manutenção</TabsTrigger>
                    </TabsList>

                    {/* Tab Alertas */}
                    <TabsContent value="alertas" className="space-y-4">
                      {user.role === 'parceiro' && editMode && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <p className="text-sm text-green-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <strong>Modo Edição Ativo:</strong> Pode configurar os alertas deste veículo
                          </p>
                        </div>
                      )}
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                          <Bell className="w-5 h-5" />
                          Configurar Alertas para este Veículo
                        </h4>
                        <p className="text-xs text-amber-700 mb-4">
                          Configure quantos dias/km antes você quer ser alertado sobre vencimentos e manutenções. 
                          Ative o modo edição para fazer alterações.
                        </p>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="dias_aviso_seguro">Aviso Seguro (dias antes)</Label>
                              <Input
                                id="dias_aviso_seguro"
                                type="number"
                                value={alertasConfig.dias_aviso_seguro}
                                onChange={(e) => setAlertasConfig({...alertasConfig, dias_aviso_seguro: parseInt(e.target.value) || 30})}
                                placeholder="30"
                                disabled={!canEditAlertas || !editMode}
                              />
                            </div>
                            <div>
                              <Label htmlFor="dias_aviso_inspecao">Aviso Inspeção (dias antes)</Label>
                              <Input
                                id="dias_aviso_inspecao"
                                type="number"
                                value={alertasConfig.dias_aviso_inspecao}
                                onChange={(e) => setAlertasConfig({...alertasConfig, dias_aviso_inspecao: parseInt(e.target.value) || 30})}
                                placeholder="30"
                                disabled={!canEditAlertas || !editMode}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="dias_aviso_extintor">Aviso Extintor (dias antes)</Label>
                              <Input
                                id="dias_aviso_extintor"
                                type="number"
                                value={alertasConfig.dias_aviso_extintor}
                                onChange={(e) => setAlertasConfig({...alertasConfig, dias_aviso_extintor: parseInt(e.target.value) || 30})}
                                placeholder="30"
                                disabled={!canEditAlertas || !editMode}
                              />
                            </div>
                            <div>
                              <Label htmlFor="km_aviso_manutencao">Aviso Manutenção (km antes)</Label>
                              <Input
                                id="km_aviso_manutencao"
                                type="number"
                                value={alertasConfig.km_aviso_manutencao}
                                onChange={(e) => setAlertasConfig({...alertasConfig, km_aviso_manutencao: parseInt(e.target.value) || 5000})}
                                placeholder="5000"
                                disabled={!canEditAlertas || !editMode}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded border border-amber-200">
                            <div>
                              <Label htmlFor="verificacao_danos">Verificação de Danos</Label>
                              <p className="text-xs text-slate-500">Ativar verificação de danos pelo gestor</p>
                            </div>
                            <Switch
                              id="verificacao_danos"
                              checked={verificacaoDanosAtiva}
                              onCheckedChange={setVerificacaoDanosAtiva}
                              disabled={!canEditAlertas || !editMode}
                            />
                          </div>
                        </div>

                        {canEditAlertas && editMode && (
                          <Button 
                            onClick={handleSavePlanoManutencoes}
                            className="mt-4 w-full"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Configurações de Alertas
                          </Button>
                        )}
                      </div>
                    </TabsContent>

                    {/* Tab Plano de Manutenção */}
                    <TabsContent value="plano" className="space-y-4">
                      {user.role === 'parceiro' && editMode && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <p className="text-sm text-green-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <strong>Modo Edição Ativo:</strong> Pode configurar o plano de manutenção deste veículo
                          </p>
                        </div>
                      )}
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <Wrench className="w-5 h-5" />
                          Plano de Manutenções Periódicas (baseado em KM)
                        </h4>
                        <p className="text-xs text-blue-700 mb-4">
                          Configure os intervalos de manutenção específicos para este veículo. Desative itens não aplicáveis (ex: carros elétricos não têm mudanças de óleo).
                          Ative o modo edição para fazer alterações.
                        </p>

                        <div className="space-y-3">
                          {planoManutencoes.map((item, index) => (
                            <div key={index} className="flex items-center space-x-3 p-3 bg-white rounded border border-blue-200">
                              <Switch
                                checked={item.ativo}
                                onCheckedChange={(checked) => handleUpdatePlanoItem(index, 'ativo', checked)}
                                disabled={!canEditPlanoManutencao || !editMode}
                              />
                              <div className="flex-1">
                                {canEditPlanoManutencao && editMode ? (
                                  <Input
                                    value={item.nome}
                                    onChange={(e) => handleUpdatePlanoItem(index, 'nome', e.target.value)}
                                    placeholder="Nome da manutenção"
                                    className="font-medium"
                                  />
                                ) : (
                                  <Label className="font-medium">{item.nome}</Label>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-slate-600">Cada</span>
                                <Input
                                  type="number"
                                  value={item.intervalo_km}
                                  onChange={(e) => handleUpdatePlanoItem(index, 'intervalo_km', parseInt(e.target.value) || 0)}
                                  className="w-24"
                                  disabled={!canEditPlanoManutencao || !editMode || !item.ativo}
                                />
                                <span className="text-sm text-slate-600">km</span>
                              </div>
                              {canEditPlanoManutencao && editMode && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemovePlanoItem(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {canEditPlanoManutencao && editMode && (
                          <Button
                            onClick={handleAddPlanoItem}
                            variant="outline"
                            className="w-full mt-3 border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Item de Manutenção
                          </Button>
                        )}

                        {canEditPlanoManutencao && editMode && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <Label htmlFor="ultima_revisao_km">Última Revisão (KM)</Label>
                              <Input
                                id="ultima_revisao_km"
                                type="number"
                                value={vehicle.ultima_revisao_km || 0}
                                onChange={async (e) => {
                                  try {
                                    const token = localStorage.getItem('token');
                                    await axios.put(`${API}/vehicles/${vehicleId}`, 
                                      { ultima_revisao_km: parseInt(e.target.value) || 0 },
                                      { headers: { Authorization: `Bearer ${token}` }}
                                    );
                                    fetchVehicleData();
                                    toast.success('KM da última revisão atualizado!');
                                  } catch (error) {
                                    toast.error('Erro ao atualizar KM');
                                  }
                                }}
                                placeholder="Ex: 80000"
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                Este valor é usado como referência para calcular as próximas manutenções
                              </p>
                            </div>

                            <Button 
                              onClick={handleSavePlanoManutencoes}
                              className="w-full"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Guardar Plano de Manutenção
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Histórico de Manutenções */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Histórico de Manutenções</CardTitle>
                  {canEdit && editMode && (
                    <Button 
                      size="sm"
                      onClick={() => setShowAddManutencao(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Registar Manutenção
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="mt-2">
                  {vehicle.manutencoes && vehicle.manutencoes.length > 0 ? (
                    <div className="space-y-3">
                      {vehicle.manutencoes.map((man, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800">{man.tipo_manutencao}</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {man.data}
                                </span>
                                {man.responsavel === 'motorista' && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                    Motorista
                                  </span>
                                )}
                                {man.responsavel === 'parceiro' && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                    Parceiro
                                  </span>
                                )}
                              </div>
                              {man.descricao && (
                                <p className="text-sm text-slate-600 mb-2">{man.descricao}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                {man.km_realizada && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {man.km_realizada.toLocaleString()} km
                                  </span>
                                )}
                                {man.fornecedor && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    {man.fornecedor}
                                  </span>
                                )}
                                {man.atribuir_motorista && man.motorista_nome && (
                                  <span className="flex items-center gap-1 text-orange-600">
                                    <User className="w-3 h-3" />
                                    Deduzido: {man.motorista_nome}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-emerald-600">€{(man.valor || 0).toFixed(2)}</p>
                              <p className="text-xs text-slate-400">custo</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm text-center py-4">Nenhuma manutenção registada</p>
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
                {/* 🆕 Atalhos Rápidos para Agendar Vistorias */}
                {canEdit && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                    <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4" />
                      Agendar Vistoria Rápida
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-purple-100 border-purple-300"
                        onClick={() => {
                          const proximaData = vehicle?.inspection?.proxima_inspecao 
                            ? new Date(new Date(vehicle.inspection.proxima_inspecao).getTime() - 7*24*60*60*1000).toISOString().split('T')[0]
                            : new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
                          setAgendaForm({
                            tipo: 'inspecao',
                            titulo: 'Inspeção Periódica',
                            data: proximaData,
                            hora: '10:00',
                            descricao: `Agendar inspeção para ${vehicle?.matricula || 'veículo'}`
                          });
                        }}
                      >
                        🔍 Inspeção
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-blue-100 border-blue-300"
                        onClick={() => {
                          const proximaData = vehicle?.seguro?.data_validade 
                            ? new Date(new Date(vehicle.seguro.data_validade).getTime() - 30*24*60*60*1000).toISOString().split('T')[0]
                            : new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
                          setAgendaForm({
                            tipo: 'seguro',
                            titulo: 'Renovação Seguro',
                            data: proximaData,
                            hora: '',
                            descricao: `Renovar seguro do veículo ${vehicle?.matricula || ''}`
                          });
                        }}
                      >
                        🛡️ Seguro
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-yellow-100 border-yellow-300"
                        onClick={() => {
                          const proximaData = vehicle?.revisao?.proxima_revisao_data 
                            ? new Date(new Date(vehicle.revisao.proxima_revisao_data).getTime() - 7*24*60*60*1000).toISOString().split('T')[0]
                            : new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
                          setAgendaForm({
                            tipo: 'revisao',
                            titulo: 'Revisão Periódica',
                            data: proximaData,
                            hora: '09:00',
                            descricao: `Revisão programada - KM atual: ${vehicle?.km_atual || 'N/A'}`
                          });
                        }}
                      >
                        🔧 Revisão
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-red-100 border-red-300"
                        onClick={() => {
                          const proximaData = vehicle?.extintor?.data_validade 
                            ? new Date(new Date(vehicle.extintor.data_validade).getTime() - 30*24*60*60*1000).toISOString().split('T')[0]
                            : new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
                          setAgendaForm({
                            tipo: 'manutencao',
                            titulo: 'Verificação Extintor',
                            data: proximaData,
                            hora: '',
                            descricao: 'Verificar e renovar extintor se necessário'
                          });
                        }}
                      >
                        🧯 Extintor
                      </Button>
                    </div>
                    
                    {/* Alertas de Vistorias Próximas */}
                    {(
                      (vehicle?.inspection?.proxima_inspecao && new Date(vehicle.inspection.proxima_inspecao) <= new Date(Date.now() + 30*24*60*60*1000)) ||
                      (vehicle?.seguro?.data_validade && new Date(vehicle.seguro.data_validade) <= new Date(Date.now() + 30*24*60*60*1000)) ||
                      (vehicle?.extintor?.data_validade && new Date(vehicle.extintor.data_validade) <= new Date(Date.now() + 30*24*60*60*1000))
                    ) && (
                      <div className="mt-3 p-2 bg-orange-100 rounded border border-orange-300">
                        <p className="text-xs text-orange-800 font-medium">⚠️ Atenção: Existem documentos/vistorias a vencer nos próximos 30 dias!</p>
                      </div>
                    )}
                  </div>
                )}

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
                      <div>
                        <Label htmlFor="oficina">Oficina</Label>
                        <Input
                          id="oficina"
                          value={agendaForm.oficina}
                          onChange={(e) => setAgendaForm({...agendaForm, oficina: e.target.value})}
                          placeholder="Nome da oficina"
                        />
                      </div>
                      <div>
                        <Label htmlFor="local">Local/Morada</Label>
                        <Input
                          id="local"
                          value={agendaForm.local}
                          onChange={(e) => setAgendaForm({...agendaForm, local: e.target.value})}
                          placeholder="Endereço ou localização"
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
                              {(evento.oficina || evento.local) && (
                                <div className="text-sm text-slate-600 mt-1">
                                  {evento.oficina && (
                                    <span className="inline-flex items-center gap-1 mr-3">
                                      <Wrench className="w-3 h-3" />
                                      {evento.oficina}
                                    </span>
                                  )}
                                  {evento.local && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {evento.local}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
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

          {/* Relatório Ganhos/Perdas com ROI */}
          <TabsContent value="relatorio">
            <RelatorioFinanceiroTab 
              vehicleId={vehicleId} 
              canEdit={canEdit} 
              user={user}
              relatorioGanhos={relatorioGanhos}
              setRelatorioGanhos={setRelatorioGanhos}
            />
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

      {/* Modal Adicionar Manutenção */}
      <Dialog open={showAddManutencao} onOpenChange={setShowAddManutencao}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registar Manutenção / Custo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddManutencao} className="space-y-4">
            <div>
              <Label>Tipo de Intervenção/Custo *</Label>
              <select
                value={novaManutencao.tipo_manutencao}
                onChange={(e) => setNovaManutencao({...novaManutencao, tipo_manutencao: e.target.value})}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">Selecione o tipo</option>
                <optgroup label="Manutenção">
                  <option value="Revisão">Revisão</option>
                  <option value="Troca de Óleo">Troca de Óleo</option>
                  <option value="Troca de Filtros">Troca de Filtros</option>
                  <option value="Troca de Pneus">Troca de Pneus</option>
                  <option value="Travões">Travões</option>
                  <option value="Suspensão">Suspensão</option>
                  <option value="Embraiagem">Embraiagem</option>
                  <option value="Correia de Distribuição">Correia de Distribuição</option>
                  <option value="Bateria">Bateria</option>
                  <option value="Ar Condicionado">Ar Condicionado</option>
                </optgroup>
                <optgroup label="Reparação">
                  <option value="Reparação Mecânica">Reparação Mecânica</option>
                  <option value="Reparação Elétrica">Reparação Elétrica</option>
                  <option value="Chapa e Pintura">Chapa e Pintura</option>
                </optgroup>
                <optgroup label="Custos/Danos">
                  <option value="Multa">Multa</option>
                  <option value="Dano">Dano</option>
                  <option value="Seguro">Seguro</option>
                  <option value="Outro">Outro</option>
                </optgroup>
              </select>
            </div>
            <div>
              <Label>Descrição (o que foi feito)</Label>
              <textarea
                value={novaManutencao.descricao}
                onChange={(e) => setNovaManutencao({...novaManutencao, descricao: e.target.value})}
                className="w-full p-2 border rounded-md min-h-[80px]"
                placeholder="Descreva os trabalhos realizados..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={novaManutencao.data}
                  onChange={(e) => setNovaManutencao({...novaManutencao, data: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>KM na Intervenção</Label>
                <Input
                  type="number"
                  value={novaManutencao.km_realizada}
                  onChange={(e) => setNovaManutencao({...novaManutencao, km_realizada: e.target.value})}
                  placeholder="Ex: 85000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor/Despesa (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaManutencao.valor}
                  onChange={(e) => setNovaManutencao({...novaManutencao, valor: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label>Fornecedor/Oficina</Label>
                <Input
                  value={novaManutencao.fornecedor}
                  onChange={(e) => setNovaManutencao({...novaManutencao, fornecedor: e.target.value})}
                  placeholder="Nome da oficina"
                />
              </div>
            </div>
            
            {/* Secção de Responsabilidade */}
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
              <Label className="text-amber-900 font-semibold">Atribuição de Custo</Label>
              <p className="text-xs text-amber-700">
                Defina quem é responsável pelo custo. Multas e danos são tipicamente do motorista. 
                Pneus e seguros podem ser do motorista ou parceiro.
              </p>
              <div>
                <Label>Responsável pelo Custo</Label>
                <select
                  value={novaManutencao.responsavel}
                  onChange={(e) => setNovaManutencao({...novaManutencao, responsavel: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="parceiro">Parceiro (Empresa)</option>
                  <option value="motorista">Motorista</option>
                </select>
              </div>
              
              {novaManutencao.responsavel === 'motorista' && vehicle.motorista_atribuido && (
                <div className="flex items-center gap-3 p-3 bg-white rounded border">
                  <input
                    type="checkbox"
                    id="atribuir_motorista"
                    checked={novaManutencao.atribuir_motorista}
                    onChange={(e) => setNovaManutencao({...novaManutencao, atribuir_motorista: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <Label htmlFor="atribuir_motorista" className="font-medium cursor-pointer">
                      Deduzir do motorista: {vehicle.motorista_atribuido_nome}
                    </Label>
                    <p className="text-xs text-slate-500">
                      O valor será registado para desconto no próximo relatório semanal
                    </p>
                  </div>
                </div>
              )}
              
              {novaManutencao.responsavel === 'motorista' && !vehicle.motorista_atribuido && (
                <p className="text-xs text-amber-600 italic">
                  ⚠️ Nenhum motorista atribuído a este veículo
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddManutencao(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Registar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// Componente para o tab de Histórico de Atribuições
const HistoricoAtribuicoesTab = ({ vehicleId, canEdit, user }) => {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/vehicles/${vehicleId}/historico-atribuicoes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistorico(response.data.historico || []);
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        toast.error('Erro ao carregar histórico de atribuições');
      } finally {
        setLoading(false);
      }
    };

    if (vehicleId) {
      fetchHistorico();
    }
  }, [vehicleId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="w-5 h-5" />
          <span>Histórico de Atribuições</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum histórico de atribuições encontrado.</p>
            <p className="text-sm">O histórico será registado quando atribuir motoristas a este veículo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historico.map((entry, index) => (
              <div 
                key={entry.id} 
                className={`p-4 rounded-lg border ${!entry.data_fim ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold">{entry.motorista_nome}</span>
                    {!entry.data_fim && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Entrada: {formatDate(entry.data_inicio)}</p>
                    <p>Saída: {entry.data_fim ? formatDate(entry.data_fim) : 'Em curso'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {/* KM */}
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Inicial</p>
                    <p className="font-medium">{entry.km_inicial?.toLocaleString() || '-'}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Final</p>
                    <p className="font-medium">{entry.km_final?.toLocaleString() || '-'}</p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">KM Percorridos</p>
                    <p className="font-medium text-blue-600">
                      {entry.km_percorridos?.toLocaleString() || '-'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <p className="text-gray-500 text-xs">Valor Aluguer/Semana</p>
                    <p className="font-medium">{formatCurrency(entry.valor_aluguer_semanal)}</p>
                  </div>
                </div>

                {/* Ganhos do Período */}
                {entry.ganhos_periodo && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">Ganhos no Período</p>
                    <div className="flex gap-4 text-sm">
                      <span className="bg-black text-white px-2 py-1 rounded">
                        Uber: {formatCurrency(entry.ganhos_periodo.uber)}
                      </span>
                      <span className="bg-green-600 text-white px-2 py-1 rounded">
                        Bolt: {formatCurrency(entry.ganhos_periodo.bolt)}
                      </span>
                      <span className="bg-blue-600 text-white px-2 py-1 rounded">
                        Total: {formatCurrency(entry.ganhos_periodo.total)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dispositivos */}
                {entry.dispositivos && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">Dispositivos Associados</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {entry.dispositivos.obu_via_verde && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          Via Verde: {entry.dispositivos.obu_via_verde}
                        </span>
                      )}
                      {entry.dispositivos.cartao_combustivel_fossil && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          Combustível: {entry.dispositivos.cartao_combustivel_fossil}
                        </span>
                      )}
                      {entry.dispositivos.cartao_combustivel_eletrico && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Elétrico: {entry.dispositivos.cartao_combustivel_eletrico}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente para o tab de Relatório Financeiro com ROI
const RelatorioFinanceiroTab = ({ vehicleId, canEdit, user, relatorioGanhos, setRelatorioGanhos }) => {
  const [periodo, setPeriodo] = useState('total');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddCusto, setShowAddCusto] = useState(false);
  const [custoForm, setCustoForm] = useState({
    categoria: 'outros',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    fornecedor: ''
  });

  const categorias = [
    { value: 'revisao', label: 'Revisão', icon: '🔧' },
    { value: 'vistoria', label: 'Vistoria/Inspeção', icon: '📋' },
    { value: 'seguro', label: 'Seguro', icon: '🛡️' },
    { value: 'pneus', label: 'Pneus', icon: '⚙️' },
    { value: 'reparacao', label: 'Reparação', icon: '🔨' },
    { value: 'combustivel', label: 'Combustível', icon: '⛽' },
    { value: 'lavagem', label: 'Lavagem', icon: '🚿' },
    { value: 'multa', label: 'Multa', icon: '📃' },
    { value: 'outros', label: 'Outros', icon: '📦' }
  ];

  const anos = [2023, 2024, 2025, 2026];
  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/vehicles/${vehicleId}/relatorio-ganhos?periodo=${periodo}`;
      if (periodo === 'ano') url += `&ano=${ano}`;
      if (periodo === 'mes') url += `&ano=${ano}&mes=${mes}`;
      if (periodo === 'custom' && dataInicio && dataFim) {
        url += `&data_inicio=${dataInicio}&data_fim=${dataFim}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRelatorioGanhos(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      toast.error('Erro ao carregar relatório financeiro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      // Para custom, só buscar se tiver ambas as datas
      if (periodo === 'custom' && (!dataInicio || !dataFim)) {
        return;
      }
      fetchRelatorio();
    }
  }, [vehicleId, periodo, ano, mes, dataInicio, dataFim]);

  const handleAddCusto = async (e) => {
    e.preventDefault();
    if (!custoForm.descricao || !custoForm.valor || !custoForm.data) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/vehicles/${vehicleId}/custos`, custoForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Custo adicionado com sucesso!');
      setShowAddCusto(false);
      setCustoForm({
        categoria: 'outros',
        descricao: '',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        fornecedor: ''
      });
      fetchRelatorio();
    } catch (error) {
      console.error('Erro ao adicionar custo:', error);
      toast.error('Erro ao adicionar custo');
    }
  };

  const getRoiColor = (roi) => {
    if (roi >= 20) return 'text-green-600 bg-green-50';
    if (roi >= 0) return 'text-blue-600 bg-blue-50';
    return 'text-red-600 bg-red-50';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  return (
    <div className="space-y-4">
      {/* Filtros de Período */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Período:</span>
              <select 
                value={periodo} 
                onChange={(e) => setPeriodo(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="total">Total (desde aquisição)</option>
                <option value="ano">Por Ano</option>
                <option value="mes">Por Mês</option>
                <option value="custom">Entre Datas</option>
              </select>
            </div>
            
            {(periodo === 'ano' || periodo === 'mes') && (
              <select 
                value={ano} 
                onChange={(e) => setAno(Number(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            
            {periodo === 'mes' && (
              <select 
                value={mes} 
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}

            {periodo === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm"
                />
                <span className="text-sm text-slate-500">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm"
                />
              </div>
            )}

            {canEdit && (
              <Button 
                size="sm" 
                onClick={() => setShowAddCusto(true)}
                className="ml-auto"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Custo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo com ROI */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-green-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Receitas</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(relatorioGanhos.ganhos_total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Alugueres cobrados</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Custos</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(relatorioGanhos.despesas_total)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Manutenção, seguro, etc.</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Lucro</p>
            <p className={`text-2xl font-bold ${relatorioGanhos.lucro >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(relatorioGanhos.lucro)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Receitas - Custos</p>
          </CardContent>
        </Card>
        <Card className={getRoiColor(relatorioGanhos.roi || 0)}>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">ROI</p>
            <p className="text-2xl font-bold">
              {(relatorioGanhos.roi || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Retorno sobre investimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Custos por Categoria */}
      {relatorioGanhos.custos?.por_categoria && Object.keys(relatorioGanhos.custos.por_categoria).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(relatorioGanhos.custos.por_categoria).map(([cat, valor]) => {
                const catInfo = categorias.find(c => c.value === cat) || { label: cat, icon: '📦' };
                return (
                  <div key={cat} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">
                      {catInfo.icon} {catInfo.label}
                    </span>
                    <span className="font-medium text-red-600">{formatCurrency(valor)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de Movimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : relatorioGanhos.detalhes && relatorioGanhos.detalhes.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {relatorioGanhos.detalhes.map((item, index) => (
                <div key={index} className="flex justify-between items-center border-b py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.tipo === 'ganho' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <div>
                      <p className="font-medium text-sm">{item.descricao}</p>
                      <p className="text-xs text-slate-500">
                        {item.data} {item.categoria && `• ${item.categoria}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${item.tipo === 'ganho' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.tipo === 'ganho' ? '+' : '-'}{formatCurrency(item.valor)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum movimento registado para este período.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar Custo */}
      <Dialog open={showAddCusto} onOpenChange={setShowAddCusto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Custo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCusto} className="space-y-4">
            <div>
              <Label>Categoria *</Label>
              <select
                value={custoForm.categoria}
                onChange={(e) => setCustoForm({...custoForm, categoria: e.target.value})}
                className="w-full p-2 border rounded-md"
              >
                {categorias.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={custoForm.descricao}
                onChange={(e) => setCustoForm({...custoForm, descricao: e.target.value})}
                placeholder="Ex: Troca de óleo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={custoForm.valor}
                  onChange={(e) => setCustoForm({...custoForm, valor: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={custoForm.data}
                  onChange={(e) => setCustoForm({...custoForm, data: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Fornecedor/Oficina</Label>
              <Input
                value={custoForm.fornecedor}
                onChange={(e) => setCustoForm({...custoForm, fornecedor: e.target.value})}
                placeholder="Nome do fornecedor (opcional)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddCusto(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Modal Adicionar Manutenção (movido de volta para o componente pai)
// Este modal é usado no separador Revisão/Intervenções do FichaVeiculo

export default FichaVeiculo;
