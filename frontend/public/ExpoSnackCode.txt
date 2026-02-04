// TVDEFleet Drivers - App Móvel v4
// COM: GPS, Tickets Acidente/Avaria, Alertas de Horas, Consulta Detalhada, Edição de Registos
// Cole este código em https://snack.expo.dev

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, Platform, KeyboardAvoidingView, Vibration
} from 'react-native';
import * as Location from 'expo-location';

const API_URL = 'https://fleetmanager-37.preview.emergentagent.com/api';

// ===== CONFIG =====
const GPS_CONFIG = {
  SPEED_THRESHOLD: 5,
  STATIONARY_TIME: 10 * 60 * 1000,
  UPDATE_INTERVAL: 30 * 1000,
};

// ===== API SERVICE =====
const api = {
  token: null,
  setToken(token) { this.token = token; },
  
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Erro na requisição');
    }
    return response.json();
  },
  
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }
};

// ===== GPS HOOK =====
const useGPSMovement = (isWorking, onStartMoving, onStationary) => {
  const [isMoving, setIsMoving] = useState(false);
  const lastMovementTime = useRef(Date.now());
  const watchRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: GPS_CONFIG.UPDATE_INTERVAL, distanceInterval: 50 },
        (loc) => {
          if (!mounted) return;
          const speed = (loc.coords.speed || 0) * 3.6;
          if (speed >= GPS_CONFIG.SPEED_THRESHOLD) {
            setIsMoving(true);
            lastMovementTime.current = Date.now();
            if (!isWorking) onStartMoving?.();
          } else {
            setIsMoving(false);
          }
        }
      );

      const interval = setInterval(() => {
        if (!mounted) return;
        if (isWorking && Date.now() - lastMovementTime.current >= GPS_CONFIG.STATIONARY_TIME) {
          onStationary?.();
          lastMovementTime.current = Date.now();
        }
      }, 60000);

      return () => clearInterval(interval);
    };
    startTracking();
    return () => { mounted = false; watchRef.current?.remove(); };
  }, [isWorking]);

  return { isMoving };
};

// ===== LOGIN SCREEN =====
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erro', 'Preencha os campos'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.access_token) { api.setToken(data.access_token); onLogin(data.user, data.access_token); }
      else Alert.alert('Erro', data.detail || 'Credenciais inválidas');
    } catch (e) { Alert.alert('Erro', 'Falha na ligação'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.loginBox}>
        <Text style={styles.title}>🚗 TVDEFleet</Text>
        <Text style={styles.subtitle}>Área do Motorista</Text>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748b" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ===== TAB BAR =====
const TabBar = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'ponto', label: 'Ponto', icon: '⏱️' },
    { id: 'ganhos', label: 'Ganhos', icon: '💰' },
    { id: 'tickets', label: 'Suporte', icon: '🎫' },
    { id: 'config', label: 'Config', icon: '⚙️' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => onTabChange(tab.id)}>
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ===== ALERTA HORAS POPUP =====
const AlertaHorasModal = ({ visible, data, onDismiss }) => {
  if (!visible || !data) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.alertModalOverlay}>
        <View style={styles.alertModalContent}>
          <Text style={styles.alertModalIcon}>⚠️</Text>
          <Text style={styles.alertModalTitle}>Limite de Horas Excedido!</Text>
          <Text style={styles.alertModalText}>
            Trabalhou {data.tempo_trabalho_formatado}.{'\n'}
            Limite configurado: {data.limite_horas}h{'\n\n'}
            {data.mensagem}
          </Text>
          <TouchableOpacity style={styles.alertModalBtn} onPress={onDismiss}>
            <Text style={styles.alertModalBtnText}>Entendi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ===== PONTO SCREEN =====
const PontoScreen = ({ user, status, setStatus, showHoursAlert, setShowHoursAlert }) => {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertaData, setAlertaData] = useState(null);
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [diaRegistos, setDiaRegistos] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRegisto, setEditingRegisto] = useState(null);
  const [editForm, setEditForm] = useState({ horaInicio: '', horaFim: '', justificacao: '' });
  const [definicoes, setDefinicoes] = useState(null);
  const alertCheckRef = useRef(null);

  const loadData = async () => {
    try {
      const estado = await api.get('/ponto/estado-atual');
      setStatus(estado.ativo ? (estado.em_pausa ? 'paused' : 'working') : 'off');
      const resumoData = await api.get('/ponto/resumo-semanal');
      setResumo(resumoData);
      const defs = await api.get('/ponto/definicoes');
      setDefinicoes(defs);
    } catch (e) { console.error(e); }
  };

  const checkHoursAlert = async () => {
    try {
      const result = await api.get('/ponto/verificar-alerta-horas');
      if (result.alerta && result.em_turno) {
        setAlertaData(result);
        setShowHoursAlert(true);
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (status === 'working') {
      checkHoursAlert();
      alertCheckRef.current = setInterval(checkHoursAlert, 5 * 60 * 1000);
    } else {
      if (alertCheckRef.current) clearInterval(alertCheckRef.current);
    }
    return () => { if (alertCheckRef.current) clearInterval(alertCheckRef.current); };
  }, [status]);

  const handlePonto = async (action) => {
    try {
      setLoading(true);
      if (action === 'checkin') { await api.post('/ponto/check-in', {}); setStatus('working'); Alert.alert('Sucesso', 'Check-in!'); }
      else if (action === 'pause') { await api.post('/ponto/pausa', { tipo: 'iniciar' }); setStatus('paused'); }
      else if (action === 'resume') { await api.post('/ponto/pausa', { tipo: 'retomar' }); setStatus('working'); }
      else if (action === 'checkout') {
        const result = await api.post('/ponto/check-out', {});
        setStatus('off');
        Alert.alert('Check-out', `Tempo: ${Math.floor(result.tempo_trabalho_minutos / 60)}h ${result.tempo_trabalho_minutos % 60}m`);
      }
      await loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
    finally { setLoading(false); }
  };

  const loadDiaRegistos = async (data) => {
    try {
      const result = await api.get(`/ponto/registos-dia/${data}`);
      setDiaRegistos(result);
    } catch (e) { console.error(e); }
  };

  const openDiaModal = () => {
    loadDiaRegistos(selectedDate);
    setShowDiaModal(true);
  };

  const handleEditRegisto = (registo) => {
    if (!definicoes?.permitir_edicao_registos) {
      Alert.alert('Não Autorizado', 'O seu parceiro não autorizou a edição de registos. Contacte-o para solicitar esta permissão.');
      return;
    }
    setEditingRegisto(registo);
    setEditForm({ horaInicio: registo.hora_inicio, horaFim: registo.hora_fim === 'Em curso' ? '' : registo.hora_fim, justificacao: '' });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.horaInicio || !editForm.horaFim || !editForm.justificacao) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    try {
      await api.post(`/ponto/registos/${editingRegisto.id}/editar`, {
        hora_inicio_real: editForm.horaInicio,
        hora_fim_real: editForm.horaFim,
        justificacao: editForm.justificacao
      });
      Alert.alert('Sucesso', 'Registo atualizado');
      setShowEditModal(false);
      loadDiaRegistos(selectedDate);
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const formatMin = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
    loadDiaRegistos(newDate);
  };

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>
      <Text style={styles.screenTitle}>Relógio de Ponto</Text>
      
      {/* Status Card */}
      <View style={styles.card}>
        <View style={styles.statusBox}>
          <Text style={styles.statusIcon}>{status === 'off' ? '⚪' : status === 'working' ? '🟢' : '🟡'}</Text>
          <Text style={styles.statusText}>{status === 'off' ? 'Offline' : status === 'working' ? 'A trabalhar' : 'Em pausa'}</Text>
        </View>
        
        <View style={styles.buttonGroup}>
          {status === 'off' && (
            <TouchableOpacity style={[styles.actionBtn, styles.btnGreen]} onPress={() => handlePonto('checkin')} disabled={loading}>
              <Text style={styles.actionBtnText}>▶️ Check-in</Text>
            </TouchableOpacity>
          )}
          {status === 'working' && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.btnYellow]} onPress={() => handlePonto('pause')}><Text style={styles.actionBtnText}>⏸️ Pausa</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnRed]} onPress={() => handlePonto('checkout')}><Text style={styles.actionBtnText}>⏹️ Sair</Text></TouchableOpacity>
            </>
          )}
          {status === 'paused' && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen]} onPress={() => handlePonto('resume')}><Text style={styles.actionBtnText}>▶️ Retomar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnRed]} onPress={() => handlePonto('checkout')}><Text style={styles.actionBtnText}>⏹️ Sair</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Resumo Semanal */}
      {resumo && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Esta Semana</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{formatMin(resumo.total_minutos)}</Text><Text style={styles.statLabel}>Total</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{resumo.total_turnos}</Text><Text style={styles.statLabel}>Turnos</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{resumo.dias_trabalhados}</Text><Text style={styles.statLabel}>Dias</Text></View>
          </View>
        </View>
      )}

      {/* Ver Registos do Dia */}
      <TouchableOpacity style={styles.viewDayBtn} onPress={openDiaModal}>
        <Text style={styles.viewDayBtnIcon}>📅</Text>
        <Text style={styles.viewDayBtnText}>Ver Registos do Dia</Text>
      </TouchableOpacity>

      {/* Modal Registos do Dia */}
      <Modal visible={showDiaModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.dateNav}>
              <TouchableOpacity onPress={() => changeDate(-1)}><Text style={styles.dateNavBtn}>◀</Text></TouchableOpacity>
              <View>
                <Text style={styles.dateNavTitle}>{diaRegistos?.data_formatada || selectedDate}</Text>
                <Text style={styles.dateNavSubtitle}>{diaRegistos?.dia_semana}</Text>
              </View>
              <TouchableOpacity onPress={() => changeDate(1)}><Text style={styles.dateNavBtn}>▶</Text></TouchableOpacity>
            </View>

            {diaRegistos && (
              <View style={styles.daySummary}>
                <Text style={styles.daySummaryText}>Total: {diaRegistos.total_formatado} | {diaRegistos.total_turnos} turnos</Text>
              </View>
            )}

            <ScrollView style={styles.registosList}>
              {diaRegistos?.registos?.length === 0 && (
                <Text style={styles.emptyText}>Sem registos neste dia</Text>
              )}
              {diaRegistos?.registos?.map((reg, idx) => (
                <View key={idx} style={styles.registoItem}>
                  <View style={styles.registoHeader}>
                    <Text style={styles.registoHoras}>{reg.hora_inicio} - {reg.hora_fim}</Text>
                    {reg.editado && <Text style={styles.editedBadge}>Editado</Text>}
                    {reg.em_curso && <Text style={styles.emCursoBadge}>Em curso</Text>}
                  </View>
                  <Text style={styles.registoTempo}>{reg.tempo_trabalho_formatado}</Text>
                  {reg.pausas_minutos > 0 && <Text style={styles.registoPausas}>Pausas: {formatMin(reg.pausas_minutos)}</Text>}
                  {reg.editado && (
                    <Text style={styles.registoEditInfo}>Horas reais: {reg.hora_inicio_real} - {reg.hora_fim_real}</Text>
                  )}
                  {!reg.em_curso && (
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleEditRegisto(reg)}>
                      <Text style={styles.editBtnText}>✏️ Editar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDiaModal(false)}>
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Registo */}
      <Modal visible={showEditModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Registo</Text>
            <Text style={styles.modalSubtitle}>Defina as horas reais de trabalho</Text>
            
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeInputLabel}>Início</Text>
                <TextInput style={styles.timeInput} value={editForm.horaInicio} onChangeText={(t) => setEditForm({...editForm, horaInicio: t})} placeholder="HH:MM" placeholderTextColor="#64748b" />
              </View>
              <Text style={styles.timeInputSeparator}>→</Text>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeInputLabel}>Fim</Text>
                <TextInput style={styles.timeInput} value={editForm.horaFim} onChangeText={(t) => setEditForm({...editForm, horaFim: t})} placeholder="HH:MM" placeholderTextColor="#64748b" />
              </View>
            </View>

            <Text style={styles.timeInputLabel}>Justificação *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editForm.justificacao} onChangeText={(t) => setEditForm({...editForm, justificacao: t})} placeholder="Explique o motivo da alteração..." placeholderTextColor="#64748b" multiline numberOfLines={3} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={submitEdit}>
                <Text style={styles.modalBtnConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertaHorasModal visible={showHoursAlert} data={alertaData} onDismiss={() => setShowHoursAlert(false)} />
    </ScrollView>
  );
};

// ===== GANHOS SCREEN =====
const GanhosScreen = () => {
  const [semanas, setSemanas] = useState([]);
  const [selectedSemana, setSelectedSemana] = useState(null);
  const [ganhos, setGanhos] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSemanaModal, setShowSemanaModal] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await api.get('/ponto/semanas-disponiveis?num_semanas=12');
      setSemanas(data.semanas);
      if (data.semanas.length > 0) setSelectedSemana(data.semanas[0]);
    })();
  }, []);

  useEffect(() => {
    if (selectedSemana) {
      setLoading(true);
      (async () => {
        const g = await api.get(`/ponto/ganhos-semana?semana=${selectedSemana.semana}&ano=${selectedSemana.ano}`);
        setGanhos(g);
        const r = await api.get(`/ponto/recibo-semanal/${selectedSemana.semana}/${selectedSemana.ano}`);
        setRecibo(r.recibo);
        setLoading(false);
      })();
    }
  }, [selectedSemana]);

  if (loading && !ganhos) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>Ganhos</Text>
      
      <TouchableOpacity style={styles.semanaSelector} onPress={() => setShowSemanaModal(true)}>
        <View>
          <Text style={styles.semanaSelectorLabel}>Semana</Text>
          <Text style={styles.semanaSelectorValue}>{selectedSemana?.label}</Text>
        </View>
        <Text style={styles.semanaSelectorArrow}>▼</Text>
      </TouchableOpacity>

      {ganhos && (
        <View style={styles.card}>
          <View style={styles.ganhoBox}>
            <Text style={styles.ganhoLabel}>Líquido</Text>
            <Text style={[styles.ganhoValor, ganhos.valor_liquido >= 0 ? styles.positive : styles.negative]}>€{ganhos.valor_liquido.toFixed(2)}</Text>
          </View>
          
          <TouchableOpacity style={[styles.reciboBtn, recibo ? styles.reciboBtnExiste : styles.reciboBtnNovo]} onPress={() => Alert.alert(recibo ? 'Recibo Enviado' : 'Upload', recibo ? `Enviado em ${new Date(recibo.created_at).toLocaleDateString('pt-PT')}` : 'Use a versão web')}>
            <Text style={styles.reciboBtnText}>{recibo ? '✓ Recibo' : '📤 Recibo'}</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Ganhos</Text>
            <View style={styles.row}><Text style={styles.label}>Uber</Text><Text style={styles.value}>€{ganhos.ganhos.uber.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Bolt</Text><Text style={styles.value}>€{ganhos.ganhos.bolt.toFixed(2)}</Text></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📉 Despesas</Text>
            <View style={styles.row}><Text style={styles.label}>Via Verde</Text><Text style={styles.value}>€{ganhos.despesas.via_verde.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Combustível</Text><Text style={styles.value}>€{ganhos.despesas.combustivel.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Aluguer</Text><Text style={styles.value}>€{ganhos.despesas.aluguer.toFixed(2)}</Text></View>
          </View>
        </View>
      )}

      <Modal visible={showSemanaModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Semana</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {semanas.map(s => (
                <TouchableOpacity key={`${s.semana}-${s.ano}`} style={[styles.semanaItem, selectedSemana?.semana === s.semana && styles.semanaItemActive]} onPress={() => { setSelectedSemana(s); setShowSemanaModal(false); }}>
                  <Text style={styles.semanaItemLabel}>{s.label}</Text>
                  <Text style={styles.semanaItemPeriodo}>{s.periodo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSemanaModal(false)}>
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ===== TICKETS SCREEN =====
const TicketsScreen = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [novoTicket, setNovoTicket] = useState({ titulo: '', categoria: 'outro', descricao: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');

  const categorias = [
    { id: 'acidente', nome: '🚨 Acidente', urgente: true },
    { id: 'avaria', nome: '🔧 Avaria', urgente: true },
    { id: 'pagamentos', nome: 'Pagamentos' },
    { id: 'veiculo', nome: 'Veículo' },
    { id: 'outro', nome: 'Outro' }
  ];

  const statusColors = { aberto: '#22c55e', em_analise: '#3b82f6', aguardar_resposta: '#f59e0b', fechado: '#374151' };

  useEffect(() => { (async () => { setTickets(await api.get('/tickets/meus')); setLoading(false); })(); }, []);

  const criarTicket = async () => {
    if (!novoTicket.titulo || !novoTicket.descricao) { Alert.alert('Erro', 'Preencha os campos'); return; }
    await api.post('/tickets/criar', novoTicket);
    Alert.alert('Sucesso', 'Ticket criado!');
    setModalVisible(false);
    setTickets(await api.get('/tickets/meus'));
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (selectedTicket) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedTicket(null)}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
          <Text style={styles.chatTitle}>#{selectedTicket.numero}</Text>
        </View>
        <ScrollView style={styles.chatMessages}>
          {selectedTicket.mensagens?.map((msg, idx) => (
            <View key={idx} style={[styles.message, msg.autor_id === user.id ? styles.messageOwn : styles.messageOther]}>
              <Text style={styles.messageText}>{msg.conteudo}</Text>
              <Text style={styles.messageTime}>{new Date(msg.created_at).toLocaleString('pt-PT')}</Text>
            </View>
          ))}
        </ScrollView>
        {selectedTicket.status !== 'fechado' && (
          <View style={styles.chatInput}>
            <TextInput style={styles.chatTextInput} value={novaMensagem} onChangeText={setNovaMensagem} placeholder="Mensagem..." placeholderTextColor="#64748b" multiline />
            <TouchableOpacity style={styles.sendBtn} onPress={async () => { await api.post(`/tickets/${selectedTicket.id}/mensagem`, { conteudo: novaMensagem }); setNovaMensagem(''); setSelectedTicket(await api.get(`/tickets/${selectedTicket.id}`)); }}>
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Suporte</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}><Text style={styles.addBtnText}>+ Novo</Text></TouchableOpacity>
      </View>
      
      <View style={styles.urgentButtons}>
        <TouchableOpacity style={styles.urgentBtn} onPress={() => { setNovoTicket({ titulo: 'Acidente', categoria: 'acidente', descricao: '' }); setModalVisible(true); }}>
          <Text style={styles.urgentBtnIcon}>🚨</Text><Text style={styles.urgentBtnText}>Acidente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: '#d97706' }]} onPress={() => { setNovoTicket({ titulo: 'Avaria', categoria: 'avaria', descricao: '' }); setModalVisible(true); }}>
          <Text style={styles.urgentBtnIcon}>🔧</Text><Text style={styles.urgentBtnText}>Avaria</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {tickets.map(t => (
          <TouchableOpacity key={t.id} style={styles.ticketCard} onPress={() => setSelectedTicket(t)}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketNumero}>#{t.numero}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[t.status] || '#666' }]}><Text style={styles.statusBadgeText}>{t.status}</Text></View>
            </View>
            <Text style={styles.ticketTitulo}>{t.titulo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Ticket</Text>
            <TextInput style={styles.input} placeholder="Título" placeholderTextColor="#64748b" value={novoTicket.titulo} onChangeText={t => setNovoTicket({...novoTicket, titulo: t})} />
            <View style={styles.categoryPicker}>
              {categorias.map(c => (
                <TouchableOpacity key={c.id} style={[styles.categoryBtn, novoTicket.categoria === c.id && styles.categoryBtnActive]} onPress={() => setNovoTicket({...novoTicket, categoria: c.id})}>
                  <Text style={[styles.categoryBtnText, novoTicket.categoria === c.id && styles.categoryBtnTextActive]}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Descrição..." placeholderTextColor="#64748b" value={novoTicket.descricao} onChangeText={t => setNovoTicket({...novoTicket, descricao: t})} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModalVisible(false)}><Text style={styles.modalBtnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={criarTicket}><Text style={styles.modalBtnConfirmText}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ===== CONFIG SCREEN =====
const ConfigScreen = ({ user, onLogout }) => {
  const [definicoes, setDefinicoes] = useState(null);
  const [alertaHoras, setAlertaHoras] = useState('10');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const defs = await api.get('/ponto/definicoes');
      setDefinicoes(defs);
      setAlertaHoras(String(defs.alerta_horas_maximas || 10));
      setLoading(false);
    })();
  }, []);

  const salvarDefinicoes = async () => {
    const horas = parseInt(alertaHoras);
    if (isNaN(horas) || horas < 1 || horas > 24) {
      Alert.alert('Erro', 'Horas deve ser entre 1 e 24');
      return;
    }
    await api.post('/ponto/definicoes', { alerta_horas_maximas: horas });
    Alert.alert('Sucesso', 'Definições guardadas');
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>Configurações</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Perfil</Text>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱️ Alerta de Horas</Text>
        <Text style={styles.configLabel}>Alertar quando ultrapassar:</Text>
        <View style={styles.hoursInputRow}>
          <TextInput style={styles.hoursInput} value={alertaHoras} onChangeText={setAlertaHoras} keyboardType="numeric" maxLength={2} />
          <Text style={styles.hoursLabel}>horas</Text>
        </View>
        <Text style={styles.configHint}>Receberá um alerta quando ultrapassar este limite durante um turno.</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={salvarDefinicoes}>
          <Text style={styles.saveBtnText}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Edição de Registos</Text>
        <View style={[styles.statusIndicator, { backgroundColor: definicoes?.permitir_edicao_registos ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.statusIndicatorText}>
            {definicoes?.permitir_edicao_registos ? '✓ Autorizado pelo parceiro' : '✗ Não autorizado'}
          </Text>
        </View>
        {!definicoes?.permitir_edicao_registos && (
          <Text style={styles.configHint}>Contacte o seu parceiro para solicitar autorização para editar os seus registos de ponto.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Terminar Sessão</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ===== GPS POPUP =====
const GPSPopupModal = ({ visible, type, onConfirm, onDismiss }) => {
  if (!visible) return null;
  const isStart = type === 'start';
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.gpsModalOverlay}>
        <View style={styles.gpsModalContent}>
          <Text style={styles.gpsModalIcon}>{isStart ? '🚗' : '⏸️'}</Text>
          <Text style={styles.gpsModalTitle}>{isStart ? 'Em Movimento!' : 'Parado há 10min'}</Text>
          <Text style={styles.gpsModalText}>{isStart ? 'Iniciar turno?' : 'Terminar turno?'}</Text>
          <View style={styles.gpsModalButtons}>
            <TouchableOpacity style={[styles.gpsModalBtn, styles.gpsModalBtnSecondary]} onPress={onDismiss}><Text style={styles.gpsModalBtnSecondaryText}>Não</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.gpsModalBtn, styles.gpsModalBtnPrimary]} onPress={onConfirm}><Text style={styles.gpsModalBtnPrimaryText}>Sim</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ===== MAIN APP =====
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ponto');
  const [workStatus, setWorkStatus] = useState('off');
  const [gpsPopup, setGpsPopup] = useState({ visible: false, type: null });
  const [showHoursAlert, setShowHoursAlert] = useState(false);
  const popupShown = useRef({ start: false, stop: false });

  const { isMoving } = useGPSMovement(
    workStatus === 'working',
    () => { if (workStatus === 'off' && !popupShown.current.start) { popupShown.current.start = true; setGpsPopup({ visible: true, type: 'start' }); } },
    () => { if (workStatus === 'working' && !popupShown.current.stop) { popupShown.current.stop = true; setGpsPopup({ visible: true, type: 'stop' }); } }
  );

  const handleGPSConfirm = async () => {
    setGpsPopup({ visible: false, type: null });
    if (gpsPopup.type === 'start') {
      await api.post('/ponto/check-in', {});
      setWorkStatus('working');
    } else {
      await api.post('/ponto/check-out', {});
      setWorkStatus('off');
    }
    setTimeout(() => { popupShown.current = { start: false, stop: false }; }, 300000);
  };

  if (!user) return <LoginScreen onLogin={(u, t) => { setUser(u); api.setToken(t); }} />;

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TVDEFleet</Text>
        {isMoving && <Text style={styles.gpsIndicator}>📍</Text>}
      </View>
      <View style={styles.content}>
        {activeTab === 'ponto' && <PontoScreen user={user} status={workStatus} setStatus={setWorkStatus} showHoursAlert={showHoursAlert} setShowHoursAlert={setShowHoursAlert} />}
        {activeTab === 'ganhos' && <GanhosScreen />}
        {activeTab === 'tickets' && <TicketsScreen user={user} />}
        {activeTab === 'config' && <ConfigScreen user={user} onLogout={() => { setUser(null); api.setToken(null); }} />}
      </View>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <GPSPopupModal visible={gpsPopup.visible} type={gpsPopup.type} onConfirm={handleGPSConfirm} onDismiss={() => { setGpsPopup({ visible: false, type: null }); setTimeout(() => { popupShown.current[gpsPopup.type === 'start' ? 'start' : 'stop'] = false; }, 300000); }} />
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  appContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  gpsIndicator: { fontSize: 16 },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', paddingBottom: 20 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderTopWidth: 2, borderTopColor: '#3b82f6' },
  tabIcon: { fontSize: 20, marginBottom: 4 },
  tabLabel: { fontSize: 11, color: '#64748b' },
  tabLabelActive: { color: '#3b82f6', fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  screen: { flex: 1, padding: 16 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginBottom: 12 },
  statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#0f172a', borderRadius: 12, marginBottom: 16 },
  statusIcon: { fontSize: 32, marginRight: 12 },
  statusText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#22c55e' },
  btnYellow: { backgroundColor: '#eab308' },
  btnRed: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  viewDayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', padding: 16, borderRadius: 12, marginBottom: 16 },
  viewDayBtnIcon: { fontSize: 20, marginRight: 8 },
  viewDayBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateNavBtn: { fontSize: 24, color: '#3b82f6', padding: 8 },
  dateNavTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  dateNavSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  daySummary: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 16 },
  daySummaryText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  registosList: { maxHeight: 400 },
  registoItem: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginBottom: 12 },
  registoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  registoHoras: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1 },
  editedBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  emCursoBadge: { backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, color: '#fff', fontSize: 10, marginLeft: 8 },
  registoTempo: { color: '#94a3b8', marginBottom: 4 },
  registoPausas: { color: '#64748b', fontSize: 12 },
  registoEditInfo: { color: '#f59e0b', fontSize: 12, marginTop: 4 },
  editBtn: { marginTop: 8, padding: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: 13 },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  timeInputGroup: { flex: 1 },
  timeInputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  timeInput: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, color: '#fff', fontSize: 18, textAlign: 'center' },
  timeInputSeparator: { color: '#64748b', fontSize: 20, marginHorizontal: 12 },
  semanaSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  semanaSelectorLabel: { fontSize: 12, color: '#64748b' },
  semanaSelectorValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 2 },
  semanaSelectorArrow: { fontSize: 16, color: '#64748b' },
  reciboBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginBottom: 16 },
  reciboBtnNovo: { backgroundColor: '#3b82f6' },
  reciboBtnExiste: { backgroundColor: '#22c55e' },
  reciboBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  ganhoBox: { backgroundColor: '#0f172a', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  ganhoLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  ganhoValor: { fontSize: 36, fontWeight: 'bold' },
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  label: { color: '#94a3b8', fontSize: 14 },
  value: { color: '#fff', fontSize: 14, fontWeight: '500' },
  semanaItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  semanaItemActive: { backgroundColor: '#3b82f6', borderRadius: 8 },
  semanaItemLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  semanaItemPeriodo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  urgentButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  urgentBtn: { flex: 1, backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  urgentBtnIcon: { fontSize: 28, marginBottom: 4 },
  urgentBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  ticketCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketNumero: { color: '#64748b', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  ticketTitulo: { color: '#fff', fontSize: 16, fontWeight: '600' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profileEmail: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  configLabel: { color: '#fff', fontSize: 14, marginBottom: 8 },
  hoursInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hoursInput: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, color: '#fff', fontSize: 24, fontWeight: 'bold', width: 80, textAlign: 'center', marginRight: 12 },
  hoursLabel: { color: '#94a3b8', fontSize: 16 },
  configHint: { color: '#64748b', fontSize: 12, marginTop: 8, lineHeight: 18 },
  saveBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusIndicator: { padding: 12, borderRadius: 8, alignItems: 'center' },
  statusIndicatorText: { color: '#fff', fontWeight: '600' },
  logoutBtn: { backgroundColor: '#ef4444', padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  logoutBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  modalCloseBtn: { backgroundColor: '#334155', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalCloseBtnText: { color: '#fff', fontWeight: '600' },
  textArea: { height: 100, textAlignVertical: 'top' },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#334155' },
  categoryBtnActive: { backgroundColor: '#3b82f6' },
  categoryBtnText: { color: '#94a3b8', fontSize: 12 },
  categoryBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#334155' },
  modalBtnConfirm: { backgroundColor: '#3b82f6' },
  modalBtnCancelText: { color: '#94a3b8', fontWeight: '600' },
  modalBtnConfirmText: { color: '#fff', fontWeight: '600' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn: { color: '#3b82f6', fontSize: 16 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 16 },
  chatMessages: { flex: 1, padding: 16 },
  message: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 12 },
  messageOwn: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#334155' },
  messageText: { color: '#fff', fontSize: 14 },
  messageTime: { color: '#94a3b8', fontSize: 10, marginTop: 4, textAlign: 'right' },
  chatInput: { flexDirection: 'row', padding: 16, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  chatTextInput: { flex: 1, backgroundColor: '#334155', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', maxHeight: 100, marginRight: 8 },
  sendBtn: { backgroundColor: '#3b82f6', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18 },
  emptyText: { color: '#64748b', textAlign: 'center', padding: 20 },
  gpsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  gpsModalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  gpsModalIcon: { fontSize: 64, marginBottom: 16 },
  gpsModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  gpsModalText: { fontSize: 16, color: '#94a3b8', marginBottom: 24 },
  gpsModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  gpsModalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  gpsModalBtnSecondary: { backgroundColor: '#334155' },
  gpsModalBtnPrimary: { backgroundColor: '#3b82f6' },
  gpsModalBtnSecondaryText: { color: '#94a3b8', fontWeight: '600' },
  gpsModalBtnPrimaryText: { color: '#fff', fontWeight: '600' },
  alertModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertModalContent: { backgroundColor: '#7f1d1d', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  alertModalIcon: { fontSize: 64, marginBottom: 16 },
  alertModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  alertModalText: { fontSize: 16, color: '#fecaca', marginBottom: 24, textAlign: 'center', lineHeight: 24 },
  alertModalBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' },
  alertModalBtnText: { color: '#7f1d1d', fontWeight: 'bold', fontSize: 16 },
});
