import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, CreditCard, Car, FileText,
  Save, Edit, Euro, Percent, Calculator, TrendingUp, Wallet,
  Receipt, History, AlertCircle, CheckCircle, Clock, Upload,
  Calendar, Globe, IdCard, Shield, FileCheck, Home, Building,
  MessageCircle, Smartphone, Hash, Plus, Trash2, Loader2, Banknote, Zap
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const API = process.env.REACT_APP_BACKEND_URL;

// Helper para classe de input preenchido (cor mais escura quando tem valor)
const getFilledInputClass = (value) => {
  return value && value.toString().trim() !== '' 
    ? 'bg-slate-50 text-slate-900 font-medium border-slate-300' 
    : '';
};

const FichaMotorista = ({ user }) => {
  const { motoristaId } = useParams();
  const navigate = useNavigate();
  
  const [motorista, setMotorista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('dados-pessoais');
  
  // Dados editáveis do motorista
  const [dadosMotorista, setDadosMotorista] = useState({
    // Dados Pessoais
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    
    // Documentos de Identificação
    tipo_documento: 'cc', // cc, residencia, passaporte
    documento_numero: '',
    documento_validade: '',
    
    nif: '',
    seguranca_social: '',
    data_nascimento: '',
    nacionalidade: 'Portuguesa',
    
    // Morada
    morada: '',
    codigo_postal: '',
    localidade: '',
    
    // Registo Criminal
    registo_criminal_codigo: '',
    registo_criminal_validade: '',
    
    // Licença TVDE
    licenca_tvde_numero: '',
    licenca_tvde_validade: '',
    
    // Carta de Condução
    carta_conducao_numero: '',
    carta_conducao_emissao: '',
    carta_conducao_validade: '',
    
    // Dados Bancários
    iban: '',
    
    // Emails e Telefones das Plataformas
    email_uber: '',
    telefone_uber: '',
    email_bolt: '',
    telefone_bolt: '',
    usar_dados_padrao_plataformas: true,
    
    // Contacto de Emergência
    emergencia_nome: '',
    emergencia_telefone: '',
    emergencia_parentesco: '',
    emergencia_email: '',
    emergencia_morada: '',
    emergencia_codigo_postal: '',
    emergencia_localidade: ''
  });
  
  // Documentos
  const [documentos, setDocumentos] = useState({
    cc_frente: null,
    cc_verso: null,
    carta_conducao_frente: null,
    carta_conducao_verso: null,
    licenca_tvde: null,
    registo_criminal: null,
    comprovativo_morada: null,
    comprovativo_iban: null
  });
  
  // Campos financeiros
  const [configFinanceira, setConfigFinanceira] = useState({
    acumular_viaverde: false,
    viaverde_acumulado: 0,
    viaverde_fonte: 'ambos',
    gratificacao_tipo: 'na_comissao',
    gratificacao_valor_fixo: 0,
    incluir_iva_rendimentos: true,
    iva_percentagem: 23,
    comissao_personalizada: false,
    comissao_motorista_percentagem: 70,
    comissao_parceiro_percentagem: 30
  });
  
  // Histórico de Via Verde acumulado
  const [historicoViaVerde, setHistoricoViaVerde] = useState([]);
  
  // Extras/Dívidas do motorista
  const [extras, setExtras] = useState([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [extraModalOpen, setExtraModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [savingExtra, setSavingExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({
    tipo: 'divida',
    descricao: '',
    valor: '',
    semana: '',
    ano: new Date().getFullYear(),
    parcelas_total: '',
    parcela_atual: '',
    pago: false,
    observacoes: ''
  });
  
  const TIPOS_EXTRA = [
    { value: 'divida', label: 'Dívida', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'caucao_parcelada', label: 'Caução Parcelada', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    { value: 'dano', label: 'Dano no Veículo', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    { value: 'multa', label: 'Multa', color: 'bg-purple-100 text-purple-700 border-purple-300' },
    { value: 'credito', label: 'Crédito/Reembolso', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'outro', label: 'Outro', color: 'bg-slate-100 text-slate-700 border-slate-300' }
  ];
  
  // Veículo atribuído
  const [veiculo, setVeiculo] = useState(null);
  
  // Estados para novas funcionalidades - App, Ponto e Turnos
  const [configApp, setConfigApp] = useState(null);
  const [dadosPonto, setDadosPonto] = useState(null);
  const [turnos, setTurnos] = useState(null);
  const [turnosForm, setTurnosForm] = useState([]);
  const [turnoVeiculoId, setTurnoVeiculoId] = useState('');
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingTurnos, setSavingTurnos] = useState(false);
  
  const DIAS_SEMANA_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  
  // Upload states
  const [uploading, setUploading] = useState({});
  
  // Foto do motorista
  const [fotoMotorista, setFotoMotorista] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  
  // Parceiros disponíveis (para admin atribuir)
  const [parceirosDisponiveis, setParceirosDisponiveis] = useState([]);
  const [atribuindoParceiro, setAtribuindoParceiro] = useState(false);
  const [parceiroSelecionado, setParceiroSelecionado] = useState('');

  // Histórico do motorista
  const [historicoAtividade, setHistoricoAtividade] = useState([]);
  const [historicoRendimentos, setHistoricoRendimentos] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoAno, setHistoricoAno] = useState(new Date().getFullYear());

  const handleFotoUpload = async (file) => {
    if (!file) return;
    
    setUploadingFoto(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/api/motoristas/${motoristaId}/foto`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setFotoMotorista(response.data.url);
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao carregar foto:', error);
      toast.error('Erro ao carregar foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const fetchMotorista = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const motoristaData = response.data;
      setMotorista(motoristaData);
      
      // Preencher dados editáveis
      setDadosMotorista(prev => ({
        ...prev,
        name: motoristaData.name || '',
        email: motoristaData.email || '',
        phone: motoristaData.phone || '',
        whatsapp: motoristaData.whatsapp || motoristaData.phone || '',
        tipo_documento: motoristaData.tipo_documento || 'cc',
        documento_numero: motoristaData.documento_numero || motoristaData.cc_numero || '',
        documento_validade: motoristaData.documento_validade || motoristaData.cc_validade || '',
        nif: motoristaData.nif || '',
        seguranca_social: motoristaData.seguranca_social || '',
        data_nascimento: motoristaData.data_nascimento || '',
        nacionalidade: motoristaData.nacionalidade || 'Portuguesa',
        morada: motoristaData.morada || motoristaData.morada_completa || '',
        codigo_postal: motoristaData.codigo_postal || '',
        localidade: motoristaData.localidade || '',
        registo_criminal_codigo: motoristaData.registo_criminal_codigo || '',
        registo_criminal_validade: motoristaData.registo_criminal_validade || '',
        licenca_tvde_numero: motoristaData.licenca_tvde_numero || '',
        licenca_tvde_validade: motoristaData.licenca_tvde_validade || '',
        carta_conducao_numero: motoristaData.carta_conducao_numero || '',
        carta_conducao_emissao: motoristaData.carta_conducao_emissao || '',
        carta_conducao_validade: motoristaData.carta_conducao_validade || '',
        iban: motoristaData.iban || '',
        email_uber: motoristaData.email_uber || motoristaData.email || '',
        telefone_uber: motoristaData.telefone_uber || motoristaData.phone || '',
        uuid_motorista_uber: motoristaData.uuid_motorista_uber || '',
        email_bolt: motoristaData.email_bolt || motoristaData.email || '',
        telefone_bolt: motoristaData.telefone_bolt || motoristaData.phone || '',
        identificador_motorista_bolt: motoristaData.identificador_motorista_bolt || '',
        usar_dados_padrao_plataformas: motoristaData.usar_dados_padrao_plataformas !== false,
        // Contacto de Emergência
        emergencia_nome: motoristaData.emergencia_nome || '',
        emergencia_telefone: motoristaData.emergencia_telefone || '',
        emergencia_parentesco: motoristaData.emergencia_parentesco || motoristaData.emergencia_ligacao || '',
        emergencia_email: motoristaData.emergencia_email || '',
        emergencia_morada: motoristaData.emergencia_morada || '',
        emergencia_codigo_postal: motoristaData.emergencia_codigo_postal || '',
        emergencia_localidade: motoristaData.emergencia_localidade || ''
      }));
      
      // Carregar documentos existentes
      if (motoristaData.documentos) {
        setDocumentos(prev => ({ ...prev, ...motoristaData.documentos }));
      }
      
      // Carregar foto do motorista
      if (motoristaData.foto_url) {
        setFotoMotorista(motoristaData.foto_url);
      }
      
      // Carregar configurações financeiras se existirem
      if (motoristaData.config_financeira) {
        setConfigFinanceira(prev => ({
          ...prev,
          ...motoristaData.config_financeira
        }));
      }
      
      // Carregar veículo se atribuído
      if (motoristaData.veiculo_atribuido) {
        fetchVeiculo(motoristaData.veiculo_atribuido);
      }
      
    } catch (error) {
      console.error('Erro ao carregar motorista:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  }, [motoristaId]);

  const fetchVeiculo = async (veiculoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/vehicles/${veiculoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculo(response.data);
    } catch (error) {
      console.error('Erro ao carregar veículo:', error);
    }
  };

  // Carregar parceiros disponíveis (para admin)
  const fetchParceiros = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/parceiros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parceiros = response.data?.parceiros || response.data || [];
      setParceirosDisponiveis(parceiros);
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    }
  }, [user?.role]);

  // Atribuir parceiro ao motorista
  const handleAtribuirParceiro = async () => {
    if (!parceiroSelecionado) {
      toast.error('Selecione um parceiro');
      return;
    }
    
    setAtribuindoParceiro(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API}/api/motoristas/${motoristaId}/atribuir-parceiro`,
        { parceiro_id: parceiroSelecionado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.utilizador_criado) {
        toast.success(
          `Parceiro atribuído! Password temporária: ${response.data.password_temporaria}`,
          { duration: 10000 }
        );
      } else {
        toast.success('Parceiro atribuído com sucesso');
      }
      
      // Recarregar dados do motorista
      fetchMotorista();
    } catch (error) {
      console.error('Erro ao atribuir parceiro:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atribuir parceiro');
    } finally {
      setAtribuindoParceiro(false);
    }
  };

  const fetchHistoricoViaVerde = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}/viaverde-acumulado`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricoViaVerde(response.data?.historico || []);
      if (response.data?.total_acumulado !== undefined) {
        setConfigFinanceira(prev => ({
          ...prev,
          viaverde_acumulado: response.data.total_acumulado
        }));
      }
    } catch (error) {
      console.log('Histórico Via Verde não disponível');
    }
  }, [motoristaId]);

  // Funções para histórico de atividade e rendimentos
  const fetchHistoricoMotorista = useCallback(async (ano = historicoAno) => {
    setHistoricoLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Buscar histórico de atividade
      const atividadeResponse = await axios.get(
        `${API}/api/motoristas/${motoristaId}/historico-atividade`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistoricoAtividade(atividadeResponse.data?.historico || []);
      
      // Buscar histórico de rendimentos
      const rendimentosResponse = await axios.get(
        `${API}/api/motoristas/${motoristaId}/historico-rendimentos?ano=${ano}&limite=52`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistoricoRendimentos(rendimentosResponse.data || { rendimentos: [], resumo: {} });
      
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico do motorista');
    } finally {
      setHistoricoLoading(false);
    }
  }, [motoristaId, historicoAno]);

  // Funções para App Config, Ponto e Turnos
  const fetchConfigApp = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/ponto/definicoes/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigApp(response.data);
    } catch (error) {
      setConfigApp({
        limite_horas_diarias: 10,
        periodo_descanso_minimo: 8,
        permitir_edicao_registos: true,
        pode_alterar_limite: false
      });
    }
  }, [motoristaId]);

  const fetchDadosPonto = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/ponto/resumo-motorista/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDadosPonto(response.data);
    } catch (error) {
      console.log('Dados de ponto não disponíveis');
    }
  }, [motoristaId]);

  const fetchTurnos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/turnos/motorista/${motoristaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTurnos(response.data);
      setTurnosForm(response.data.turnos || []);
      setTurnoVeiculoId(response.data.veiculo_id || '');
    } catch (error) {
      setTurnos({ turnos: [] });
      setTurnosForm([]);
    }
  }, [motoristaId]);

  const fetchVeiculosDisponiveis = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVeiculosDisponiveis(response.data.vehicles || response.data || []);
    } catch (error) {
      console.log('Veículos não disponíveis');
    }
  }, []);

  const handleSaveConfigApp = async () => {
    setSavingConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/ponto/parceiro/configurar-permissoes`,
        {
          motorista_id: motoristaId,
          limite_horas_diarias: configApp.limite_horas_diarias,
          periodo_descanso_minimo: configApp.periodo_descanso_minimo,
          permitir_edicao_registos: configApp.permitir_edicao_registos,
          pode_alterar_limite: configApp.pode_alterar_limite
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configurações guardadas!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar configurações');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveTurnos = async () => {
    setSavingTurnos(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/turnos/configurar`,
        {
          motorista_id: motoristaId,
          turnos: turnosForm.filter(t => t.hora_inicio && t.hora_fim),
          veiculo_id: turnoVeiculoId || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Turnos guardados!');
      fetchTurnos();
    } catch (error) {
      console.error('Error saving turnos:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar turnos');
    } finally {
      setSavingTurnos(false);
    }
  };

  const toggleDiaTurno = (diaIndex) => {
    const exists = turnosForm.find(t => t.dia_semana === diaIndex);
    if (exists) {
      setTurnosForm(turnosForm.filter(t => t.dia_semana !== diaIndex));
    } else {
      setTurnosForm([...turnosForm, { dia_semana: diaIndex, hora_inicio: '08:00', hora_fim: '18:00', ativo: true }]);
    }
  };

  const updateTurnoHora = (diaIndex, field, value) => {
    setTurnosForm(turnosForm.map(t => 
      t.dia_semana === diaIndex ? { ...t, [field]: value } : t
    ));
  };

  // Funções para Extras/Dívidas
  const fetchExtras = useCallback(async () => {
    setExtrasLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motoristas/${motoristaId}/despesas-extras`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtras(response.data || []);
    } catch (error) {
      console.log('Extras não disponíveis:', error);
    } finally {
      setExtrasLoading(false);
    }
  }, [motoristaId]);

  const resetExtraForm = () => {
    setExtraForm({
      tipo: 'divida',
      descricao: '',
      valor: '',
      semana: '',
      ano: new Date().getFullYear(),
      parcelas_total: '',
      parcela_atual: '',
      pago: false,
      observacoes: ''
    });
    setEditingExtra(null);
  };

  const openExtraModal = (extra = null) => {
    if (extra) {
      setEditingExtra(extra);
      setExtraForm({
        tipo: extra.tipo,
        descricao: extra.descricao,
        valor: extra.valor.toString(),
        semana: extra.semana?.toString() || '',
        ano: extra.ano || new Date().getFullYear(),
        parcelas_total: extra.parcelas_total?.toString() || '',
        parcela_atual: extra.parcela_atual?.toString() || '',
        pago: extra.pago,
        observacoes: extra.observacoes || ''
      });
    } else {
      resetExtraForm();
    }
    setExtraModalOpen(true);
  };

  const handleSaveExtra = async () => {
    if (!extraForm.descricao || !extraForm.valor) {
      toast.error('Preencha a descrição e o valor');
      return;
    }

    setSavingExtra(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...extraForm,
        motorista_id: motoristaId,
        valor: parseFloat(extraForm.valor),
        semana: extraForm.semana ? parseInt(extraForm.semana) : null,
        ano: extraForm.ano ? parseInt(extraForm.ano) : null,
        parcelas_total: extraForm.parcelas_total ? parseInt(extraForm.parcelas_total) : null,
        parcela_atual: extraForm.parcela_atual ? parseInt(extraForm.parcela_atual) : null
      };

      if (editingExtra) {
        await axios.put(
          `${API}/api/motoristas/${motoristaId}/despesas-extras/${editingExtra.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Extra atualizado com sucesso');
      } else {
        await axios.post(
          `${API}/api/motoristas/${motoristaId}/despesas-extras`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Extra criado com sucesso');
      }

      setExtraModalOpen(false);
      resetExtraForm();
      fetchExtras();
    } catch (error) {
      console.error('Erro ao guardar extra:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar extra');
    } finally {
      setSavingExtra(false);
    }
  };

  const handleDeleteExtra = async (extraId) => {
    if (!window.confirm('Tem certeza que deseja eliminar este extra?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/motoristas/${motoristaId}/despesas-extras/${extraId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extra eliminado');
      fetchExtras();
    } catch (error) {
      console.error('Erro ao eliminar extra:', error);
      toast.error('Erro ao eliminar extra');
    }
  };

  const handleTogglePago = async (extra) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/motoristas/${motoristaId}/despesas-extras/${extra.id}`,
        { ...extra, pago: !extra.pago },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(extra.pago ? 'Marcado como pendente' : 'Marcado como pago');
      fetchExtras();
    } catch (error) {
      toast.error('Erro ao atualizar estado');
    }
  };

  const getTipoBadge = (tipo) => {
    const tipoConfig = TIPOS_EXTRA.find(t => t.value === tipo);
    if (!tipoConfig) return <Badge variant="secondary">{tipo}</Badge>;
    return <Badge className={tipoConfig.color}>{tipoConfig.label}</Badge>;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const extrasArray = Array.isArray(extras) ? extras : [];
  const totalExtras = extrasArray.reduce((sum, e) => {
    if (e.tipo === 'credito') return sum - (e.valor || 0);
    return sum + (e.valor || 0);
  }, 0);
  const totalPendentes = extrasArray.filter(e => !e.pago).reduce((sum, e) => {
    if (e.tipo === 'credito') return sum - (e.valor || 0);
    return sum + (e.valor || 0);
  }, 0);

  useEffect(() => {
    if (motoristaId) {
      fetchMotorista();
      fetchHistoricoViaVerde();
      fetchExtras();
      fetchConfigApp();
      fetchDadosPonto();
      fetchTurnos();
      fetchVeiculosDisponiveis();
      fetchParceiros();
    }
  }, [motoristaId, fetchMotorista, fetchHistoricoViaVerde, fetchExtras, fetchConfigApp, fetchDadosPonto, fetchTurnos, fetchVeiculosDisponiveis, fetchParceiros]);

  // Carregar histórico quando a tab é selecionada
  useEffect(() => {
    if (activeTab === 'historico' && motoristaId) {
      fetchHistoricoMotorista(historicoAno);
    }
  }, [activeTab, motoristaId, historicoAno, fetchHistoricoMotorista]);

  const handleSaveDadosMotorista = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Se usar dados padrão, copiar para plataformas
      const dadosParaEnviar = { ...dadosMotorista };
      if (dadosMotorista.usar_dados_padrao_plataformas) {
        dadosParaEnviar.email_uber = dadosMotorista.email;
        dadosParaEnviar.telefone_uber = dadosMotorista.phone;
        dadosParaEnviar.email_bolt = dadosMotorista.email;
        dadosParaEnviar.telefone_bolt = dadosMotorista.phone;
      }
      
      await axios.put(`${API}/api/motoristas/${motoristaId}`, dadosParaEnviar, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Dados guardados com sucesso!');
      setIsEditing(false);
      fetchMotorista();
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfigFinanceira = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/motoristas/${motoristaId}/config-financeira`, configFinanceira, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configurações financeiras guardadas!');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao guardar:', error);
      toast.error('Erro ao guardar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAbaterViaVerde = async () => {
    if (!window.confirm(`Confirma o abate de €${configFinanceira.viaverde_acumulado.toFixed(2)} do Via Verde acumulado?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/motoristas/${motoristaId}/viaverde-abater`, {
        valor: configFinanceira.viaverde_acumulado
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConfigFinanceira(prev => ({ ...prev, viaverde_acumulado: 0 }));
      toast.success('Via Verde abatido com sucesso!');
      fetchHistoricoViaVerde();
    } catch (error) {
      console.error('Erro ao abater:', error);
      toast.error('Erro ao abater Via Verde');
    }
  };

  const handleFileUpload = async (tipoDocumento, file) => {
    if (!file) return;
    
    setUploading(prev => ({ ...prev, [tipoDocumento]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo_documento', tipoDocumento);
      formData.append('converter_pdf', 'true'); // Sempre converter para PDF
      
      const response = await axios.post(
        `${API}/api/motoristas/${motoristaId}/documentos/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setDocumentos(prev => ({
        ...prev,
        [tipoDocumento]: response.data.url
      }));
      
      toast.success(`Documento convertido para PDF e guardado!`);
    } catch (error) {
      console.error('Erro ao carregar documento:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setUploading(prev => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ativo: { label: 'Ativo', className: 'bg-green-500 text-white' },
      inativo: { label: 'Inativo', className: 'bg-gray-500 text-white' },
      pendente: { label: 'Pendente', className: 'bg-yellow-500 text-white' },
      suspenso: { label: 'Suspenso', className: 'bg-red-500 text-white' }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const isDocumentoProximoExpirar = (dataValidade) => {
    if (!dataValidade) return false;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    const diffDias = Math.floor((validade - hoje) / (1000 * 60 * 60 * 24));
    return diffDias <= 30 && diffDias >= 0;
  };

  const isDocumentoExpirado = (dataValidade) => {
    if (!dataValidade) return false;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    return validade < hoje;
  };

  const getDiasParaExpirar = (dataValidade) => {
    if (!dataValidade) return null;
    const hoje = new Date();
    const validade = new Date(dataValidade);
    return Math.floor((validade - hoje) / (1000 * 60 * 60 * 24));
  };

  const getValidadeBadge = (dataValidade, mostrarDias = false) => {
    if (!dataValidade) return <Badge variant="outline">Não definida</Badge>;
    const dias = getDiasParaExpirar(dataValidade);
    
    if (dias < 0) {
      return (
        <Badge className="bg-red-500 text-white animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" /> Expirado há {Math.abs(dias)} dias
        </Badge>
      );
    }
    if (dias <= 30) {
      return (
        <Badge className="bg-yellow-500 text-white animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" /> Expira em {dias} dias
        </Badge>
      );
    }
    if (mostrarDias && dias <= 60) {
      return <Badge className="bg-blue-100 text-blue-800">{dataValidade} ({dias} dias)</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">{dataValidade}</Badge>;
  };

  const isAniversario = (dataNascimento) => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    return hoje.getMonth() === nascimento.getMonth() && hoje.getDate() === nascimento.getDate();
  };

  const diasParaAniversario = (dataNascimento) => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    const aniversarioEsteAno = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
    
    if (aniversarioEsteAno < hoje) {
      aniversarioEsteAno.setFullYear(hoje.getFullYear() + 1);
    }
    
    return Math.floor((aniversarioEsteAno - hoje) / (1000 * 60 * 60 * 24));
  };

  const getAniversarioBadge = (dataNascimento) => {
    if (!dataNascimento) return null;
    
    if (isAniversario(dataNascimento)) {
      return (
        <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white animate-bounce">
          🎂 Parabéns! Feliz Aniversário!
        </Badge>
      );
    }
    
    const dias = diasParaAniversario(dataNascimento);
    if (dias !== null && dias <= 7 && dias > 0) {
      return (
        <Badge className="bg-pink-100 text-pink-800">
          🎁 Aniversário em {dias} {dias === 1 ? 'dia' : 'dias'}
        </Badge>
      );
    }
    
    return null;
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return null;
    
    let nascimento;
    // Suportar múltiplos formatos de data
    if (dataNascimento.includes('/')) {
      // Formato DD/MM/YYYY
      const [dia, mes, ano] = dataNascimento.split('/');
      nascimento = new Date(ano, mes - 1, dia);
    } else if (dataNascimento.includes('-')) {
      // Formato YYYY-MM-DD
      nascimento = new Date(dataNascimento);
    } else {
      return null;
    }
    
    if (isNaN(nascimento.getTime())) return null;
    
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const DocumentUploadCard = ({ titulo, tipoDocumento, icone: Icone, descricao }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icone className="w-5 h-5 text-slate-500" />
          <span className="font-medium">{titulo}</span>
        </div>
        {documentos[tipoDocumento] ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" /> PDF
          </Badge>
        ) : (
          <Badge variant="outline">Pendente</Badge>
        )}
      </div>
      <p className="text-sm text-slate-500">{descricao}</p>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(tipoDocumento, e.target.files[0])}
          disabled={uploading[tipoDocumento]}
          className="text-sm"
        />
        {uploading[tipoDocumento] && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-slate-500">A converter para PDF...</span>
          </div>
        )}
      </div>
      {documentos[tipoDocumento] && (
        <a 
          href={`${process.env.REACT_APP_BACKEND_URL}/api/motoristas/${motoristaId}/documento/${tipoDocumento}/download`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <FileText className="w-4 h-4" /> Ver PDF
        </a>
      )}
    </div>
  );

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!motorista) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Motorista não encontrado</h2>
          <Button onClick={() => navigate('/motoristas')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/motoristas')} data-testid="btn-voltar">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
            <div className="flex items-center gap-4">
              {/* Foto do Motorista com Upload */}
              <div className="relative group">
                <Avatar className="h-20 w-20 border-2 border-slate-200">
                  {fotoMotorista ? (
                    <img 
                      src={`${API}/api/motoristas/${motoristaId}/foto`} 
                      alt={motorista.name}
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                      {getInitials(motorista.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/* Overlay para upload */}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFotoUpload(e.target.files[0])}
                    disabled={uploadingFoto}
                  />
                  {uploadingFoto ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    <Upload className="w-6 h-6 text-white" />
                  )}
                </label>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold" data-testid="motorista-nome">{motorista.name}</h1>
                  {getAniversarioBadge(dadosMotorista.data_nascimento)}
                </div>
                <p className="text-slate-500">{motorista.email}</p>
                {/* Mostrar parceiro atual */}
                {(motorista.parceiro_atribuido || motorista.parceiro_id) && (
                  <p className="text-sm text-blue-600 flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    Parceiro: {parceirosDisponiveis.find(p => p.id === (motorista.parceiro_atribuido || motorista.parceiro_id))?.nome_empresa || 'Atribuído'}
                  </p>
                )}
                {!motorista.parceiro_atribuido && !motorista.parceiro_id && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Sem parceiro atribuído
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(motorista.status_motorista || motorista.status)}
            
            {/* Botão para atribuir parceiro (Admin only) */}
            {user?.role === 'admin' && (
              <Dialog>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer" htmlFor="atribuir-parceiro-trigger">
                    <Building className="w-4 h-4 mr-1" />
                    {motorista.parceiro_atribuido ? 'Alterar Parceiro' : 'Atribuir Parceiro'}
                  </label>
                </Button>
              </Dialog>
            )}
          </div>
        </div>

        {/* Card para atribuir parceiro (Admin only) */}
        {user?.role === 'admin' && !motorista.parceiro_atribuido && !motorista.parceiro_id && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Este motorista não tem parceiro atribuído</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={parceiroSelecionado} onValueChange={setParceiroSelecionado}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Selecionar parceiro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {parceirosDisponiveis.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_empresa || p.name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAtribuirParceiro} 
                    disabled={atribuindoParceiro || !parceiroSelecionado}
                  >
                    {atribuindoParceiro ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A atribuir...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Atribuir</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="dados-pessoais" data-testid="tab-dados-pessoais">
              <User className="w-4 h-4 mr-2" /> Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="documentos" data-testid="tab-documentos">
              <FileText className="w-4 h-4 mr-2" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="plataformas" data-testid="tab-plataformas">
              <Smartphone className="w-4 h-4 mr-2" /> Plataformas
            </TabsTrigger>
            <TabsTrigger value="veiculo" data-testid="tab-veiculo">
              <Car className="w-4 h-4 mr-2" /> Veículo
            </TabsTrigger>
            <TabsTrigger value="financeiro" data-testid="tab-financeiro">
              <Euro className="w-4 h-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="extras" data-testid="tab-extras">
              <Banknote className="w-4 h-4 mr-2" /> Extras
            </TabsTrigger>
            <TabsTrigger value="app-config" data-testid="tab-app-config">
              <Shield className="w-4 h-4 mr-2" /> App
            </TabsTrigger>
            <TabsTrigger value="ponto" data-testid="tab-ponto">
              <Clock className="w-4 h-4 mr-2" /> Ponto
            </TabsTrigger>
            <TabsTrigger value="turnos" data-testid="tab-turnos">
              <Calendar className="w-4 h-4 mr-2" /> Turnos
            </TabsTrigger>
            <TabsTrigger value="historico" data-testid="tab-historico">
              <History className="w-4 h-4 mr-2" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab Dados Pessoais */}
          <TabsContent value="dados-pessoais" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="btn-editar">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveDadosMotorista} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" /> Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input
                      value={dadosMotorista.name}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      data-testid="input-nome"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={dadosMotorista.data_nascimento}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, data_nascimento: e.target.value }))}
                        disabled={!isEditing}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dadosMotorista.data_nascimento && (
                          <Badge variant="outline">
                            {calcularIdade(dadosMotorista.data_nascimento)} anos
                          </Badge>
                        )}
                        {getAniversarioBadge(dadosMotorista.data_nascimento)}
                      </div>
                    </div>
                    <div>
                      <Label>Nacionalidade</Label>
                      <Input
                        value={dadosMotorista.nacionalidade}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, nacionalidade: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>NIF</Label>
                    <Input
                      value={dadosMotorista.nif}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, nif: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <Label>Nº Segurança Social</Label>
                    <Input
                      value={dadosMotorista.seguranca_social}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, seguranca_social: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="12345678901"
                      className={getFilledInputClass(dadosMotorista.seguranca_social)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contactos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5" /> Contactos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email de Contacto
                    </Label>
                    <Input
                      type="email"
                      value={dadosMotorista.email}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Telefone de Contacto
                    </Label>
                    <Input
                      value={dadosMotorista.phone}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="+351 912 345 678"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </Label>
                    <Input
                      value={dadosMotorista.whatsapp}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, whatsapp: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="+351 912 345 678"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> IBAN
                    </Label>
                    <Input
                      value={dadosMotorista.iban}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, iban: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="PT50 0000 0000 0000 0000 0000 0"
                      className={getFilledInputClass(dadosMotorista.iban)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Documento de Identificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IdCard className="w-5 h-5" /> Documento de Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select
                      value={dadosMotorista.tipo_documento}
                      onValueChange={(value) => setDadosMotorista(prev => ({ ...prev, tipo_documento: value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cc">Cartão de Cidadão</SelectItem>
                        <SelectItem value="residencia">Autorização de Residência</SelectItem>
                        <SelectItem value="passaporte">Passaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={dadosMotorista.documento_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, documento_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.documento_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, documento_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.documento_validade)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Morada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Home className="w-5 h-5" /> Morada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Morada Completa</Label>
                    <Input
                      value={dadosMotorista.morada}
                      onChange={(e) => setDadosMotorista(prev => ({ ...prev, morada: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Rua, número, andar..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código Postal</Label>
                      <Input
                        value={dadosMotorista.codigo_postal}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, codigo_postal: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="1234-567"
                      />
                    </div>
                    <div>
                      <Label>Localidade</Label>
                      <Input
                        value={dadosMotorista.localidade}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, localidade: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="Lisboa"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registo Criminal */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Registo Criminal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código de Acesso</Label>
                      <Input
                        value={dadosMotorista.registo_criminal_codigo}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, registo_criminal_codigo: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.registo_criminal_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, registo_criminal_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.registo_criminal_validade)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Licença TVDE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCheck className="w-5 h-5" /> Licença TVDE
                    {(isDocumentoProximoExpirar(dadosMotorista.licenca_tvde_validade) || 
                      isDocumentoExpirado(dadosMotorista.licenca_tvde_validade)) && (
                      <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número da Licença</Label>
                      <Input
                        value={dadosMotorista.licenca_tvde_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, licenca_tvde_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.licenca_tvde_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, licenca_tvde_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.licenca_tvde_validade, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carta de Condução */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Carta de Condução
                    {(isDocumentoProximoExpirar(dadosMotorista.carta_conducao_validade) || 
                      isDocumentoExpirado(dadosMotorista.carta_conducao_validade)) && (
                      <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={dadosMotorista.carta_conducao_numero}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_numero: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Data de Emissão</Label>
                      <Input
                        type="date"
                        value={dadosMotorista.carta_conducao_emissao}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_emissao: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <div className="space-y-1">
                        <Input
                          type="date"
                          value={dadosMotorista.carta_conducao_validade}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, carta_conducao_validade: e.target.value }))}
                          disabled={!isEditing}
                        />
                        {getValidadeBadge(dadosMotorista.carta_conducao_validade, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contacto de Emergência */}
              <Card className="md:col-span-2 border-orange-200 bg-orange-50/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                    <Shield className="w-5 h-5" /> Contacto de Emergência
                  </CardTitle>
                  <CardDescription>Pessoa a contactar em caso de emergência</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome Completo</Label>
                      <Input
                        placeholder="Nome do contacto"
                        value={dadosMotorista.emergencia_nome}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_nome: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_nome)}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        placeholder="+351 9XX XXX XXX"
                        value={dadosMotorista.emergencia_telefone}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_telefone: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_telefone)}
                      />
                    </div>
                    <div>
                      <Label>Parentesco/Ligação</Label>
                      <Input
                        placeholder="Ex: Cônjuge, Pai, Mãe, Irmão..."
                        value={dadosMotorista.emergencia_parentesco}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_parentesco: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_parentesco)}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={dadosMotorista.emergencia_email}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_email: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_email)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Morada</Label>
                      <Input
                        placeholder="Morada completa"
                        value={dadosMotorista.emergencia_morada}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_morada: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_morada)}
                      />
                    </div>
                    <div>
                      <Label>Código Postal</Label>
                      <Input
                        placeholder="XXXX-XXX"
                        value={dadosMotorista.emergencia_codigo_postal}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_codigo_postal: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_codigo_postal)}
                      />
                    </div>
                    <div>
                      <Label>Localidade</Label>
                      <Input
                        placeholder="Cidade"
                        value={dadosMotorista.emergencia_localidade}
                        onChange={(e) => setDadosMotorista(prev => ({ ...prev, emergencia_localidade: e.target.value }))}
                        disabled={!isEditing}
                        className={getFilledInputClass(dadosMotorista.emergencia_localidade)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Documentos</CardTitle>
                <CardDescription>
                  Carregar os documentos necessários para a ficha do motorista
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocumentUploadCard
                    titulo="Documento de Identificação (Frente)"
                    tipoDocumento="cc_frente"
                    icone={IdCard}
                    descricao="CC, Autorização de Residência ou Passaporte - Frente"
                  />
                  <DocumentUploadCard
                    titulo="Documento de Identificação (Verso)"
                    tipoDocumento="cc_verso"
                    icone={IdCard}
                    descricao="CC ou Autorização de Residência - Verso (não necessário para Passaporte)"
                  />
                  <DocumentUploadCard
                    titulo="Carta de Condução (Frente)"
                    tipoDocumento="carta_conducao_frente"
                    icone={CreditCard}
                    descricao="Carta de Condução - Frente"
                  />
                  <DocumentUploadCard
                    titulo="Carta de Condução (Verso)"
                    tipoDocumento="carta_conducao_verso"
                    icone={CreditCard}
                    descricao="Carta de Condução - Verso"
                  />
                  <DocumentUploadCard
                    titulo="Licença TVDE"
                    tipoDocumento="licenca_tvde"
                    icone={FileCheck}
                    descricao="Licença TVDE emitida pelo IMT"
                  />
                  <DocumentUploadCard
                    titulo="Registo Criminal"
                    tipoDocumento="registo_criminal"
                    icone={Shield}
                    descricao="Certificado de Registo Criminal"
                  />
                  <DocumentUploadCard
                    titulo="Comprovativo de Morada"
                    tipoDocumento="comprovativo_morada"
                    icone={Home}
                    descricao="Fatura de serviços ou declaração de morada"
                  />
                  <DocumentUploadCard
                    titulo="Comprovativo de IBAN"
                    tipoDocumento="comprovativo_iban"
                    icone={Building}
                    descricao="Documento bancário com IBAN"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Plataformas */}
          <TabsContent value="plataformas" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveDadosMotorista} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Dados das Plataformas</CardTitle>
                <CardDescription>
                  Configurar os emails e telefones utilizados nas plataformas Uber e Bolt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Usar dados de contacto padrão</Label>
                    <p className="text-sm text-slate-500">
                      Usar o mesmo email e telefone do motorista para todas as plataformas
                    </p>
                  </div>
                  <Switch
                    checked={dadosMotorista.usar_dados_padrao_plataformas}
                    onCheckedChange={(checked) => {
                      setDadosMotorista(prev => ({
                        ...prev,
                        usar_dados_padrao_plataformas: checked,
                        email_uber: checked ? prev.email : prev.email_uber,
                        telefone_uber: checked ? prev.phone : prev.telefone_uber,
                        email_bolt: checked ? prev.email : prev.email_bolt,
                        telefone_bolt: checked ? prev.phone : prev.telefone_bolt
                      }));
                    }}
                    disabled={!isEditing}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Uber */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">U</span>
                        </div>
                        Uber
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Hash className="w-4 h-4" /> ID Uber (UUID)
                        </Label>
                        <Input
                          value={dadosMotorista.uuid_motorista_uber || ''}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, uuid_motorista_uber: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="UUID do motorista na Uber"
                          className="font-mono text-sm"
                          data-testid="input-uuid-uber"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Usado para identificar o motorista nas importações Uber
                        </p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email Uber
                        </Label>
                        <Input
                          type="email"
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.email : dadosMotorista.email_uber}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, email_uber: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="email@uber.com"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Phone className="w-4 h-4" /> Telefone Uber
                        </Label>
                        <Input
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.phone : dadosMotorista.telefone_uber}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, telefone_uber: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="+351 912 345 678"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bolt */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">B</span>
                        </div>
                        Bolt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Hash className="w-4 h-4" /> ID Bolt
                        </Label>
                        <Input
                          value={dadosMotorista.identificador_motorista_bolt || ''}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, identificador_motorista_bolt: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="ID do motorista na Bolt"
                          className="font-mono text-sm"
                          data-testid="input-id-bolt"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Usado para identificar o motorista nas importações Bolt
                        </p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email Bolt
                        </Label>
                        <Input
                          type="email"
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.email : dadosMotorista.email_bolt}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, email_bolt: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="email@bolt.com"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Phone className="w-4 h-4" /> Telefone Bolt
                        </Label>
                        <Input
                          value={dadosMotorista.usar_dados_padrao_plataformas ? dadosMotorista.phone : dadosMotorista.telefone_bolt}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, telefone_bolt: e.target.value }))}
                          disabled={!isEditing || dadosMotorista.usar_dados_padrao_plataformas}
                          placeholder="+351 912 345 678"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Energia */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Energia
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> Contacto de Energia
                        </Label>
                        <Input
                          value={dadosMotorista.contacto_energia || ''}
                          onChange={(e) => setDadosMotorista(prev => ({ ...prev, contacto_energia: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="ID do cartão ou contacto de energia"
                          data-testid="input-contacto-energia"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Usado para identificar o motorista nas importações de carregamentos elétricos
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Veículo */}
          <TabsContent value="veiculo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" /> Veículo Atribuído
                </CardTitle>
              </CardHeader>
              <CardContent>
                {veiculo ? (
                  <div className="space-y-6">
                    {/* Info Principal */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-2xl font-bold">{veiculo.matricula}</p>
                        <p className="text-lg text-slate-600">{veiculo.marca} {veiculo.modelo}</p>
                      </div>
                      <Badge className="text-lg px-4 py-2">{veiculo.ano}</Badge>
                    </div>

                    {/* Detalhes do Contrato */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">Tipo de Contrato</p>
                        <p className="text-lg font-semibold capitalize">
                          {veiculo.tipo_contrato?.tipo === 'aluguer_sem_caucao' ? 'Aluguer sem Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_com_caucao' ? 'Aluguer com Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_caucao_parcelada' ? 'Aluguer com Caução Parcelada' :
                           veiculo.tipo_contrato?.tipo === 'periodo_epoca' ? 'Período de Época' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epocas_sem_caucao' ? 'Aluguer com Épocas sem Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epocas_caucao' ? 'Aluguer com Épocas e Caução' :
                           veiculo.tipo_contrato?.tipo === 'aluguer_epoca_caucao_parcelada' ? 'Aluguer Época com Caução Parcelada' :
                           veiculo.tipo_contrato?.tipo === 'compra_veiculo' ? 'Compra de Veículo' :
                           veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão' :
                           veiculo.tipo_contrato?.tipo === 'motorista_privado' ? 'Motorista Privado' :
                           veiculo.tipo_contrato?.tipo || veiculo.tipo_contrato_veiculo || 'N/A'}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">
                          {veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão Motorista' : 'Valor Aluguer'}
                        </p>
                        <p className="text-lg font-semibold text-green-600">
                          {veiculo.tipo_contrato?.tipo === 'comissao' 
                            ? `${veiculo.tipo_contrato?.comissao_motorista || 0}%`
                            : `€${veiculo.tipo_contrato?.valor_aluguer || veiculo.valor_semanal || 0}`}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">Caução</p>
                        <p className="text-lg font-semibold">
                          {veiculo.tipo_contrato?.valor_caucao 
                            ? `€${veiculo.tipo_contrato.valor_caucao}` 
                            : veiculo.tem_caucao 
                              ? `€${veiculo.valor_caucao || 0}` 
                              : 'Sem caução'}
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500">
                          {veiculo.tipo_contrato?.tipo === 'comissao' ? 'Comissão Parceiro' : 'Periodicidade'}
                        </p>
                        <p className="text-lg font-semibold capitalize">
                          {veiculo.tipo_contrato?.tipo === 'comissao'
                            ? `${veiculo.tipo_contrato?.comissao_parceiro || 0}%`
                            : veiculo.tipo_contrato?.periodicidade || 'Semanal'}
                        </p>
                      </div>
                    </div>

                    {/* Info Adicional */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Combustível</p>
                        <Badge variant="outline" className="capitalize">
                          {veiculo.combustivel || 'N/A'}
                        </Badge>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Cor</p>
                        <Badge variant="outline" className="capitalize">
                          {veiculo.cor || 'N/A'}
                        </Badge>
                      </div>
                    </div>

                    {/* Seguro */}
                    {veiculo.insurance && (
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-slate-500 mb-2">Seguro</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{veiculo.insurance.companhia || 'N/A'}</p>
                            <p className="text-sm text-slate-500">Apólice: {veiculo.insurance.numero_apolice || 'N/A'}</p>
                          </div>
                          {getValidadeBadge(veiculo.insurance.data_validade)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Car className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Sem veículo atribuído</p>
                    <p className="text-sm">Este motorista ainda não tem um veículo atribuído</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Financeiro */}
          <TabsContent value="financeiro" className="space-y-4">
            <div className="flex justify-end">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="btn-editar-financeiro">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveConfigFinanceira} disabled={saving} data-testid="btn-guardar-financeiro">
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Acumulação Via Verde */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" /> Acumulação Via Verde
                  </CardTitle>
                  <CardDescription>
                    Acumula valores de Via Verde dos ganhos até ser cobrado no relatório
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Ativar acumulação</Label>
                    <Switch
                      checked={configFinanceira.acumular_viaverde}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, acumular_viaverde: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-acumular-viaverde"
                    />
                  </div>

                  {configFinanceira.acumular_viaverde && (
                    <>
                      <div>
                        <Label>Fonte dos valores</Label>
                        <Select
                          value={configFinanceira.viaverde_fonte}
                          onValueChange={(value) => 
                            setConfigFinanceira(prev => ({ ...prev, viaverde_fonte: value }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger data-testid="select-viaverde-fonte">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uber">Apenas Uber</SelectItem>
                            <SelectItem value="bolt">Apenas Bolt</SelectItem>
                            <SelectItem value="ambos">Uber + Bolt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Valor Acumulado</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="valor-viaverde-acumulado">
                              €{configFinanceira.viaverde_acumulado.toFixed(2)}
                            </p>
                          </div>
                          {configFinanceira.viaverde_acumulado > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleAbaterViaVerde}
                              data-testid="btn-abater-viaverde"
                            >
                              Abater no Relatório
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Gratificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-purple-600" /> Gratificação
                  </CardTitle>
                  <CardDescription>
                    Configuração de gratificações (gorjetas) em contratos de comissão
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Gratificação</Label>
                    <Select
                      value={configFinanceira.gratificacao_tipo}
                      onValueChange={(value) => 
                        setConfigFinanceira(prev => ({ ...prev, gratificacao_tipo: value }))
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-gratificacao-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na_comissao">Na Comissão (incluído no cálculo)</SelectItem>
                        <SelectItem value="fora_comissao">Fora da Comissão (pago separadamente)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span>Gratificações <strong>incluídas</strong> no cálculo da comissão</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Gratificações <strong>pagas separadamente</strong> (100% motorista)</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuração IVA */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Percent className="w-5 h-5 text-blue-600" /> Configuração IVA
                  </CardTitle>
                  <CardDescription>
                    Define se o IVA é incluído ou excluído dos rendimentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Incluir IVA nos rendimentos</Label>
                    <Switch
                      checked={configFinanceira.incluir_iva_rendimentos}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, incluir_iva_rendimentos: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-incluir-iva"
                    />
                  </div>

                  <div>
                    <Label>Percentagem IVA</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={configFinanceira.iva_percentagem}
                        onChange={(e) => 
                          setConfigFinanceira(prev => ({ 
                            ...prev, 
                            iva_percentagem: parseFloat(e.target.value) || 23 
                          }))
                        }
                        disabled={!isEditing}
                        className="w-24"
                        data-testid="input-iva-percentagem"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {configFinanceira.incluir_iva_rendimentos ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span>Rendimentos <strong>com IVA</strong> ({configFinanceira.iva_percentagem}%)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span>Rendimentos <strong>sem IVA</strong> (líquido)</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comissão Personalizada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-orange-600" /> Comissão
                  </CardTitle>
                  <CardDescription>
                    Percentagens de comissão (se diferente do contrato padrão)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Usar comissão personalizada</Label>
                    <Switch
                      checked={configFinanceira.comissao_personalizada}
                      onCheckedChange={(checked) => 
                        setConfigFinanceira(prev => ({ ...prev, comissao_personalizada: checked }))
                      }
                      disabled={!isEditing}
                      data-testid="switch-comissao-personalizada"
                    />
                  </div>

                  {configFinanceira.comissao_personalizada ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Comissão Motorista</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_motorista_percentagem}
                            onChange={(e) => {
                              const motorista = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_motorista_percentagem: motorista,
                                comissao_parceiro_percentagem: 100 - motorista
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Comissão Parceiro</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            value={configFinanceira.comissao_parceiro_percentagem}
                            onChange={(e) => {
                              const parceiro = parseFloat(e.target.value) || 0;
                              setConfigFinanceira(prev => ({ 
                                ...prev, 
                                comissao_parceiro_percentagem: parceiro,
                                comissao_motorista_percentagem: 100 - parceiro
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-20"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">
                        A usar comissão do veículo: <strong>
                          {veiculo ? (
                            veiculo.tipo_contrato?.tipo === 'comissao'
                              ? `${veiculo.tipo_contrato?.comissao_motorista || 0}% / ${veiculo.tipo_contrato?.comissao_parceiro || 0}%`
                              : 'N/A (Tipo Aluguer)'
                          ) : 'N/A'}
                        </strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Resumo da Configuração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Via Verde</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.acumular_viaverde ? 'Acumulado' : 'Direto'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Gratificação</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.gratificacao_tipo === 'na_comissao' ? 'Na Comissão' : 'Separado'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">IVA</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.incluir_iva_rendimentos ? `${configFinanceira.iva_percentagem}%` : 'Excluído'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-slate-500">Comissão</p>
                    <p className="text-lg font-bold">
                      {configFinanceira.comissao_personalizada 
                        ? `${configFinanceira.comissao_motorista_percentagem}/${configFinanceira.comissao_parceiro_percentagem}`
                        : 'Veículo'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Histórico Via Verde */}
            {configFinanceira.acumular_viaverde && historicoViaVerde.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" /> Histórico Via Verde
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {historicoViaVerde.map((item, index) => (
                      <div key={index} className="flex items-center justify-between border-b py-2">
                        <div>
                          <p className="font-medium">{item.descricao || 'Movimento'}</p>
                          <p className="text-sm text-slate-500">
                            {item.created_at?.substring(0, 10)} {item.created_at?.substring(11, 16) || ''}
                          </p>
                        </div>
                        <div className={`font-bold ${item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.tipo === 'credito' ? '+' : '-'}€{Math.abs(item.valor).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Extras/Dívidas */}
          <TabsContent value="extras" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Extras, Dívidas e Créditos</h2>
                <p className="text-sm text-slate-500">Gerir valores a debitar ou creditar ao motorista</p>
              </div>
              <Button onClick={() => openExtraModal()} data-testid="btn-novo-extra">
                <Plus className="w-4 h-4 mr-2" /> Novo Extra
              </Button>
            </div>

            {/* Resumo Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">Total Registado</div>
                    <Receipt className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-700 mt-1">
                    {formatCurrency(Math.abs(totalExtras))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-amber-700">Pendente</div>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">
                    {formatCurrency(Math.abs(totalPendentes))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-green-700">Registos</div>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold text-green-700 mt-1">
                    {extrasArray.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Extras */}
            <Card>
              <CardContent className="p-0">
                {extrasLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : extrasArray.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                    <Banknote className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="text-sm">Nenhum extra registado</p>
                    <Button variant="link" onClick={() => openExtraModal()} className="mt-2">
                      <Plus className="w-4 h-4 mr-1" /> Adicionar primeiro extra
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-center">Semana</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extrasArray.map((extra) => (
                        <TableRow key={extra.id}>
                          <TableCell>{getTipoBadge(extra.tipo)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{extra.descricao}</p>
                              {extra.parcelas_total && (
                                <p className="text-xs text-slate-500">
                                  Parcela {extra.parcela_atual || 1}/{extra.parcelas_total}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {extra.semana && extra.ano ? (
                              <span className="text-sm">S{extra.semana}/{extra.ano}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${extra.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                            {extra.tipo === 'credito' ? '+' : '-'}{formatCurrency(extra.valor)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePago(extra)}
                              className={extra.pago ? 'text-green-600' : 'text-amber-600'}
                            >
                              {extra.pago ? (
                                <><CheckCircle className="w-4 h-4 mr-1" /> Pago</>
                              ) : (
                                <><Clock className="w-4 h-4 mr-1" /> Pendente</>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openExtraModal(extra)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => handleDeleteExtra(extra.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Modal de Extra */}
            <Dialog open={extraModalOpen} onOpenChange={setExtraModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingExtra ? 'Editar Extra' : 'Novo Extra'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select 
                      value={extraForm.tipo} 
                      onValueChange={(v) => setExtraForm(prev => ({ ...prev, tipo: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_EXTRA.map(tipo => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição *</Label>
                    <Input
                      value={extraForm.descricao}
                      onChange={(e) => setExtraForm(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Ex: Dano no para-choques traseiro"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor (€) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={extraForm.valor}
                        onChange={(e) => setExtraForm(prev => ({ ...prev, valor: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Semana</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="53"
                          value={extraForm.semana}
                          onChange={(e) => setExtraForm(prev => ({ ...prev, semana: e.target.value }))}
                          placeholder="S"
                          className="w-16"
                        />
                        <Input
                          type="number"
                          min="2020"
                          max="2030"
                          value={extraForm.ano}
                          onChange={(e) => setExtraForm(prev => ({ ...prev, ano: e.target.value }))}
                          placeholder="Ano"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {(extraForm.tipo === 'caucao_parcelada' || extraForm.tipo === 'divida') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total de Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          value={extraForm.parcelas_total}
                          onChange={(e) => setExtraForm(prev => ({ ...prev, parcelas_total: e.target.value }))}
                          placeholder="Ex: 4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Parcela Atual</Label>
                        <Input
                          type="number"
                          min="1"
                          value={extraForm.parcela_atual}
                          onChange={(e) => setExtraForm(prev => ({ ...prev, parcela_atual: e.target.value }))}
                          placeholder="Ex: 1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={extraForm.observacoes}
                      onChange={(e) => setExtraForm(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Notas adicionais..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={extraForm.pago}
                      onCheckedChange={(v) => setExtraForm(prev => ({ ...prev, pago: v }))}
                    />
                    <Label>Marcar como pago</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setExtraModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveExtra} disabled={savingExtra}>
                    {savingExtra ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A guardar...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Guardar</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Tab Configurações App */}
          <TabsContent value="app-config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Permissões da App Motorista
                </CardTitle>
                <CardDescription>Configure os limites e permissões do motorista na aplicação móvel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {configApp && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Limite de Horas (24h rolante)</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            value={configApp.limite_horas_diarias}
                            onChange={(e) => setConfigApp({...configApp, limite_horas_diarias: parseInt(e.target.value) || 10})}
                            className="w-20 text-center"
                          />
                          <span className="text-sm text-slate-500">horas</span>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Período de Descanso Mínimo</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            value={configApp.periodo_descanso_minimo}
                            onChange={(e) => setConfigApp({...configApp, periodo_descanso_minimo: parseInt(e.target.value) || 8})}
                            className="w-20 text-center"
                          />
                          <span className="text-sm text-slate-500">horas</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Permitir Edição de Registos</Label>
                          <p className="text-xs text-slate-500">Motorista pode editar horas de início/fim</p>
                        </div>
                        <Switch
                          checked={configApp.permitir_edicao_registos}
                          onCheckedChange={(checked) => setConfigApp({...configApp, permitir_edicao_registos: checked})}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Permitir Alterar Limite de Horas</Label>
                          <p className="text-xs text-slate-500">Motorista pode ajustar o seu limite</p>
                        </div>
                        <Switch
                          checked={configApp.pode_alterar_limite}
                          onCheckedChange={(checked) => setConfigApp({...configApp, pode_alterar_limite: checked})}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleSaveConfigApp} 
                      disabled={savingConfig}
                      className="w-full"
                    >
                      {savingConfig ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {savingConfig ? 'A guardar...' : 'Guardar Configurações'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Relógio de Ponto */}
          <TabsContent value="ponto" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-xs text-slate-500">Últimas 24h</p>
                  <p className="text-2xl font-bold text-blue-600">{dadosPonto?.horas_24h || '0h 0m'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-xs text-slate-500">Esta Semana</p>
                  <p className="text-2xl font-bold text-green-600">{dadosPonto?.horas_semana || '0h 0m'}</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Estado Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${dadosPonto?.estado === 'working' ? 'bg-green-500 animate-pulse' : dadosPonto?.estado === 'paused' ? 'bg-yellow-500' : 'bg-slate-400'}`} />
                  <span className="font-medium">
                    {dadosPonto?.estado === 'working' ? 'A Trabalhar' : dadosPonto?.estado === 'paused' ? 'Em Pausa' : 'Offline'}
                  </span>
                  {dadosPonto?.turno_inicio && (
                    <span className="text-sm text-slate-500">desde {dadosPonto.turno_inicio}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Últimos Registos</CardTitle>
              </CardHeader>
              <CardContent>
                {dadosPonto?.ultimos_registos && dadosPonto.ultimos_registos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosPonto.ultimos_registos.map((reg, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{reg.data}</TableCell>
                          <TableCell>{reg.hora_inicio}</TableCell>
                          <TableCell>{reg.hora_fim || 'Em curso'}</TableCell>
                          <TableCell>{reg.duracao}</TableCell>
                          <TableCell>
                            <Badge variant={reg.tipo === 'pessoal' ? 'outline' : 'default'}>
                              {reg.tipo === 'pessoal' ? 'Pessoal' : 'Trabalho'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-6">Sem registos recentes</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Turnos */}
          <TabsContent value="turnos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Horário de Turnos
                </CardTitle>
                <CardDescription>Configure o horário de trabalho semanal do motorista</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Veículo Atribuído para os Turnos</Label>
                  <Select value={turnoVeiculoId || "none"} onValueChange={(v) => setTurnoVeiculoId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar veículo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem veículo específico</SelectItem>
                      {veiculosDisponiveis.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          <Car className="w-4 h-4 inline mr-2" />
                          {v.matricula} - {v.marca} {v.modelo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  {DIAS_SEMANA_LABELS.map((dia, idx) => {
                    const turno = turnosForm.find(t => t.dia_semana === idx);
                    const isActive = !!turno;
                    
                    return (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center space-x-3">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleDiaTurno(idx)}
                          />
                          <span className={`text-sm font-medium ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                            {dia}
                          </span>
                        </div>
                        
                        {isActive && (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="time"
                              value={turno.hora_inicio}
                              onChange={(e) => updateTurnoHora(idx, 'hora_inicio', e.target.value)}
                              className="w-28 text-center"
                            />
                            <span className="text-slate-400">→</span>
                            <Input
                              type="time"
                              value={turno.hora_fim}
                              onChange={(e) => updateTurnoHora(idx, 'hora_fim', e.target.value)}
                              className="w-28 text-center"
                            />
                          </div>
                        )}
                        
                        {!isActive && (
                          <Badge variant="outline" className="text-slate-400">Folga</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <Button 
                  onClick={handleSaveTurnos} 
                  disabled={savingTurnos}
                  className="w-full"
                >
                  {savingTurnos ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {savingTurnos ? 'A guardar...' : 'Guardar Turnos'}
                </Button>
                
                {turnos?.valido_desde && (
                  <p className="text-xs text-slate-500 text-center">
                    Válido desde: {turnos.valido_desde}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {/* Estado Atual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Estado Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Badge 
                        className={motorista?.ativo !== false ? 'bg-green-500' : 'bg-red-500'}
                        data-testid="badge-estado-ativo"
                      >
                        {motorista?.ativo !== false ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {motorista?.bloqueado && (
                        <Badge variant="destructive" data-testid="badge-estado-bloqueado">
                          Bloqueado
                        </Badge>
                      )}
                      {motorista?.data_ativacao && (
                        <span className="text-sm text-gray-500">
                          Ativado em: {motorista.data_ativacao}
                        </span>
                      )}
                      {motorista?.data_desativacao && (
                        <span className="text-sm text-gray-500">
                          Desativado em: {motorista.data_desativacao}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Histórico de Atividade */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Histórico de Atividade
                    </CardTitle>
                    <CardDescription>
                      Registo de ativações, desativações e bloqueios
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicoAtividade.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Sem registos de atividade
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Registado por</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historicoAtividade.map((entrada, index) => (
                            <TableRow key={entrada.id || index}>
                              <TableCell>
                                {entrada.data ? new Date(entrada.data).toLocaleDateString('pt-PT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    entrada.tipo === 'ativado' || entrada.tipo === 'desbloqueado' 
                                      ? 'default' 
                                      : 'destructive'
                                  }
                                  className={
                                    entrada.tipo === 'ativado' || entrada.tipo === 'desbloqueado'
                                      ? 'bg-green-500'
                                      : ''
                                  }
                                >
                                  {entrada.tipo?.charAt(0).toUpperCase() + entrada.tipo?.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {entrada.motivo || '-'}
                              </TableCell>
                              <TableCell>{entrada.registado_por_nome || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Histórico de Rendimentos */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Histórico de Rendimentos
                        </CardTitle>
                        <CardDescription>
                          Resumo semanal de ganhos e pagamentos
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoricoAno(prev => prev - 1)}
                          data-testid="btn-ano-anterior"
                        >
                          &lt;
                        </Button>
                        <span className="font-semibold px-2">{historicoAno}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoricoAno(prev => prev + 1)}
                          disabled={historicoAno >= new Date().getFullYear()}
                          data-testid="btn-ano-seguinte"
                        >
                          &gt;
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Resumo */}
                    {historicoRendimentos?.resumo && (
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <p className="text-sm text-blue-600">Semanas</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {historicoRendimentos.resumo.total_semanas || 0}
                          </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <p className="text-sm text-green-600">Total Líquido</p>
                          <p className="text-2xl font-bold text-green-700">
                            {(historicoRendimentos.resumo.total_liquido || 0).toLocaleString('pt-PT', {
                              style: 'currency',
                              currency: 'EUR'
                            })}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <p className="text-sm text-purple-600">Média Semanal</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {(historicoRendimentos.resumo.media_semanal || 0).toLocaleString('pt-PT', {
                              style: 'currency',
                              currency: 'EUR'
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tabela de rendimentos */}
                    {(!historicoRendimentos?.rendimentos || historicoRendimentos.rendimentos.length === 0) ? (
                      <p className="text-gray-500 text-center py-4">
                        Sem registos de rendimentos para {historicoAno}
                      </p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Semana</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Uber</TableHead>
                              <TableHead className="text-right">Bolt</TableHead>
                              <TableHead className="text-right">Aluguer</TableHead>
                              <TableHead className="text-right">Líquido</TableHead>
                              <TableHead>Empresa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historicoRendimentos.rendimentos.map((r, index) => (
                              <TableRow key={`${r.ano}-${r.semana}-${index}`}>
                                <TableCell className="font-medium">
                                  S{r.semana}/{r.ano}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline"
                                    className={
                                      r.status === 'pago' ? 'border-green-500 text-green-600' :
                                      r.status === 'a_pagamento' ? 'border-blue-500 text-blue-600' :
                                      r.status === 'aprovado' ? 'border-yellow-500 text-yellow-600' :
                                      'border-gray-400 text-gray-500'
                                    }
                                  >
                                    {r.status || 'pendente'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {(r.uber || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €
                                </TableCell>
                                <TableCell className="text-right">
                                  {(r.bolt || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €
                                </TableCell>
                                <TableCell className="text-right text-red-600">
                                  -{(r.aluguer || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {(r.valor_liquido || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">
                                  {r.empresa_faturacao?.nome || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FichaMotorista;
