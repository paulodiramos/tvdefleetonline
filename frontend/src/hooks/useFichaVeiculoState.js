/**
 * Hook para gestão de estados da Ficha do Veículo
 * Parte 1: Estados básicos e formulários
 * 
 * Este hook encapsula os estados principais usados na FichaVeiculo.js
 * para tornar o componente principal mais limpo e modular.
 */

import { useState, useCallback } from 'react';

// Estado inicial do formulário de seguro
const initialSeguroForm = {
  seguradora: '',
  numero_apolice: '',
  agente_seguros: '',
  data_inicio: '',
  data_validade: '',
  valor: '',
  periodicidade: 'anual'
};

// Estado inicial do formulário de inspeção
const initialInspecaoForm = {
  data_inspecao: '',
  validade: '',
  centro_inspecao: '',
  custo: '',
  observacoes: ''
};

// Estado inicial do formulário de revisão
const initialRevisaoForm = {
  proxima_revisao_km: '',
  proxima_revisao_data: '',
  proxima_revisao_notas: '',
  proxima_revisao_valor_previsto: ''
};

// Estado inicial do formulário de extintor
const initialExtintorForm = {
  numeracao: '',
  fornecedor: '',
  empresa_certificacao: '',
  preco: '',
  data_instalacao: '',
  data_validade: ''
};

// Estado inicial do formulário de agenda
const initialAgendaForm = {
  tipo: 'manutencao',
  titulo: '',
  data: '',
  hora: '',
  descricao: '',
  oficina: '',
  local: ''
};

// Estado inicial do formulário de histórico
const initialHistoricoForm = {
  data: '',
  titulo: '',
  descricao: '',
  tipo: 'observacao'
};

// Estado inicial para alertas
const initialAlertasConfig = {
  dias_aviso_seguro: 30,
  dias_aviso_inspecao: 30,
  dias_aviso_extintor: 30,
  km_aviso_manutencao: 5000
};

// Estado inicial para plano de manutenções
const initialPlanoManutencoes = [
  { nome: 'Revisão', intervalo_km: 15000, ativo: true },
  { nome: 'Pastilhas', intervalo_km: 30000, ativo: true },
  { nome: 'Discos e Pastilhas', intervalo_km: 60000, ativo: true },
  { nome: 'Distribuição', intervalo_km: 80000, ativo: true },
  { nome: 'Pneus', intervalo_km: 40000, ativo: true }
];

// Estado inicial do infoForm (formulário principal de informações do veículo)
const initialInfoForm = {
  tipo: 'aluguer_sem_caucao',
  periodicidade: 'semanal',
  regime: 'full_time',
  horario_turno_1: '',
  horario_turno_2: '',
  horario_turno_3: '',
  horario_turno_4: '',
  valor_aluguer: '',
  valor_caucao: '',
  numero_parcelas_caucao: '',
  valor_epoca_alta: '',
  valor_epoca_baixa: '',
  comissao_parceiro: '',
  comissao_motorista: '',
  inclui_combustivel: false,
  tem_limite_km: false,
  km_semanais_disponiveis: '',
  valor_extra_km: '',
  km_acumula_semanal: false,
  km_por_epoca: false,
  km_epoca_alta: '',
  km_epoca_baixa: '',
  meses_epoca_alta: [],
  meses_epoca_baixa: [],
  km_extra_escalao_1_limite: 500,
  km_extra_escalao_1_valor: '',
  km_extra_escalao_2_valor: '',
  semanada_por_epoca: false,
  semanada_epoca_alta: '',
  semanada_epoca_baixa: '',
  semanada_meses_epoca_alta: [],
  semanada_meses_epoca_baixa: [],
  slot_periodicidade: 'semanal',
  slot_valor_semanal: '',
  slot_valor_mensal: '',
  slot_valor_anual: '',
  tem_garantia: false,
  data_limite_garantia: '',
  contratos: [],
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
  tem_investimento: false,
  tipo_aquisicao: 'compra',
  valor_aquisicao: '',
  valor_aquisicao_com_iva: true,
  iva_aquisicao: '23',
  valor_entrada: '',
  valor_entrada_com_iva: false,
  valor_prestacao: '',
  valor_prestacao_com_iva: false,
  numero_prestacoes: '',
  prestacoes_pagas: '',
  data_inicio_financiamento: '',
  data_fim_financiamento: '',
  entidade_financiadora: '',
  taxa_juro: '',
  valor_residual: '',
  total_juros: '',
  total_pago: '',
  categorias_uber: {
    uberx: false,
    share: false,
    electric: false,
    black: false,
    comfort: false,
    xl: false,
    xxl: false,
    pet: false,
    package: false
  },
  categorias_bolt: {
    economy: false,
    comfort: false,
    executive: false,
    xl: false,
    xxl: false,
    green: false,
    electric: false,
    motorista_privado: false,
    pet: false
  }
};

// Estado inicial para nova manutenção
const initialNovaManutencao = {
  tipo_manutencao: '',
  descricao: '',
  data: new Date().toISOString().split('T')[0],
  km_realizada: '',
  valor: '',
  fornecedor: '',
  responsavel: 'parceiro',
  atribuir_motorista: false,
  fatura_numero: '',
  fatura_data: '',
  fatura_fornecedor: ''
};

/**
 * Hook para gestão de estados básicos da Ficha do Veículo
 */
export function useFichaVeiculoBasicState() {
  // Estados principais
  const [vehicle, setVehicle] = useState(null);
  const [motorista, setMotorista] = useState(null);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Estados de categorias
  const [categoriasUber, setCategoriasUber] = useState([]);
  const [categoriasBolt, setCategoriasBolt] = useState([]);
  const [hasModuloEventos, setHasModuloEventos] = useState(false);
  
  // Estados de uploads
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [faturaFile, setFaturaFile] = useState(null);
  const [uploadingFatura, setUploadingFatura] = useState(false);
  
  // Estados de verificação
  const [verificacaoDanosAtiva, setVerificacaoDanosAtiva] = useState(false);

  return {
    // Estados principais
    vehicle, setVehicle,
    motorista, setMotorista,
    motoristasDisponiveis, setMotoristasDisponiveis,
    loading, setLoading,
    editMode, setEditMode,
    activeTab, setActiveTab,
    
    // Estados de categorias
    categoriasUber, setCategoriasUber,
    categoriasBolt, setCategoriasBolt,
    hasModuloEventos, setHasModuloEventos,
    
    // Estados de uploads
    uploadingDoc, setUploadingDoc,
    faturaFile, setFaturaFile,
    uploadingFatura, setUploadingFatura,
    
    // Estados de verificação
    verificacaoDanosAtiva, setVerificacaoDanosAtiva
  };
}

/**
 * Hook para gestão de formulários da Ficha do Veículo
 */
export function useFichaVeiculoForms() {
  // Formulários de documentos/datas
  const [seguroForm, setSeguroForm] = useState(initialSeguroForm);
  const [inspecaoForm, setInspecaoForm] = useState(initialInspecaoForm);
  const [revisaoForm, setRevisaoForm] = useState(initialRevisaoForm);
  const [extintorForm, setExtintorForm] = useState(initialExtintorForm);
  
  // Formulário de informações gerais
  const [infoForm, setInfoForm] = useState(initialInfoForm);
  
  // Formulários de agenda e histórico
  const [agendaForm, setAgendaForm] = useState(initialAgendaForm);
  const [historicoForm, setHistoricoForm] = useState(initialHistoricoForm);
  
  // Estados para edição
  const [editingAgendaId, setEditingAgendaId] = useState(null);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isIntervencaoModalOpen, setIsIntervencaoModalOpen] = useState(false);
  const [editingIntervencao, setEditingIntervencao] = useState(null);
  
  // Estados de configuração
  const [planoManutencoes, setPlanoManutencoes] = useState(initialPlanoManutencoes);
  const [alertasConfig, setAlertasConfig] = useState(initialAlertasConfig);
  
  // Estados de dados
  const [historico, setHistorico] = useState([]);
  const [historicoEditavel, setHistoricoEditavel] = useState([]);
  const [agenda, setAgenda] = useState([]);
  
  // Estados para manutenção
  const [showAddManutencao, setShowAddManutencao] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState(initialNovaManutencao);
  
  // Estados para relatórios
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
  
  // Estados originais para restaurar em caso de cancelamento
  const [originalInfoForm, setOriginalInfoForm] = useState(null);
  const [originalSeguroForm, setOriginalSeguroForm] = useState(null);
  const [originalInspecaoForm, setOriginalInspecaoForm] = useState(null);
  const [originalRevisaoForm, setOriginalRevisaoForm] = useState(null);
  const [originalExtintorForm, setOriginalExtintorForm] = useState(null);

  // Funções para reset de formulários
  const resetAgendaForm = useCallback(() => {
    setAgendaForm(initialAgendaForm);
    setEditingAgendaId(null);
  }, []);

  const resetHistoricoForm = useCallback(() => {
    setHistoricoForm(initialHistoricoForm);
  }, []);

  const resetNovaManutencao = useCallback(() => {
    setNovaManutencao(initialNovaManutencao);
  }, []);

  // Função para guardar estados originais
  const saveOriginalForms = useCallback(() => {
    setOriginalInfoForm(JSON.parse(JSON.stringify(infoForm)));
    setOriginalSeguroForm(JSON.parse(JSON.stringify(seguroForm)));
    setOriginalInspecaoForm(JSON.parse(JSON.stringify(inspecaoForm)));
    setOriginalRevisaoForm(JSON.parse(JSON.stringify(revisaoForm)));
    setOriginalExtintorForm(JSON.parse(JSON.stringify(extintorForm)));
  }, [infoForm, seguroForm, inspecaoForm, revisaoForm, extintorForm]);

  // Função para restaurar estados originais
  const restoreOriginalForms = useCallback(() => {
    if (originalInfoForm) setInfoForm(JSON.parse(JSON.stringify(originalInfoForm)));
    if (originalSeguroForm) setSeguroForm(JSON.parse(JSON.stringify(originalSeguroForm)));
    if (originalInspecaoForm) setInspecaoForm(JSON.parse(JSON.stringify(originalInspecaoForm)));
    if (originalRevisaoForm) setRevisaoForm(JSON.parse(JSON.stringify(originalRevisaoForm)));
    if (originalExtintorForm) setExtintorForm(JSON.parse(JSON.stringify(originalExtintorForm)));
  }, [originalInfoForm, originalSeguroForm, originalInspecaoForm, originalRevisaoForm, originalExtintorForm]);

  return {
    // Formulários de documentos
    seguroForm, setSeguroForm,
    inspecaoForm, setInspecaoForm,
    revisaoForm, setRevisaoForm,
    extintorForm, setExtintorForm,
    
    // Formulário de informações
    infoForm, setInfoForm,
    
    // Formulários de agenda e histórico
    agendaForm, setAgendaForm,
    historicoForm, setHistoricoForm,
    
    // Estados de edição
    editingAgendaId, setEditingAgendaId,
    isAgendaModalOpen, setIsAgendaModalOpen,
    isIntervencaoModalOpen, setIsIntervencaoModalOpen,
    editingIntervencao, setEditingIntervencao,
    
    // Estados de configuração
    planoManutencoes, setPlanoManutencoes,
    alertasConfig, setAlertasConfig,
    
    // Estados de dados
    historico, setHistorico,
    historicoEditavel, setHistoricoEditavel,
    agenda, setAgenda,
    
    // Estados para manutenção
    showAddManutencao, setShowAddManutencao,
    novaManutencao, setNovaManutencao,
    
    // Estados para relatórios
    relatorioGanhos, setRelatorioGanhos,
    relatorioIntervencoes, setRelatorioIntervencoes,
    
    // Estados originais
    originalInfoForm,
    originalSeguroForm,
    originalInspecaoForm,
    originalRevisaoForm,
    originalExtintorForm,
    
    // Funções de reset
    resetAgendaForm,
    resetHistoricoForm,
    resetNovaManutencao,
    saveOriginalForms,
    restoreOriginalForms
  };
}

// Exportar também os estados iniciais para uso em outros componentes
export {
  initialSeguroForm,
  initialInspecaoForm,
  initialRevisaoForm,
  initialExtintorForm,
  initialAgendaForm,
  initialHistoricoForm,
  initialAlertasConfig,
  initialPlanoManutencoes,
  initialInfoForm,
  initialNovaManutencao
};
