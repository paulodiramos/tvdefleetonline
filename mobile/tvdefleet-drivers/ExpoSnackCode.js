// TVDEFleet Drivers - App Móvel v7
// COM: Vistorias tipo WeProov, período 24h rolante, permissões, fotos tickets, turnos
// Cole este código em https://snack.expo.dev

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, Platform, KeyboardAvoidingView, Vibration, Image,
  Dimensions, PanResponder
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';

const API_URL = 'https://fleet-guardian-7.preview.emergentagent.com/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ===== API SERVICE =====
const api = {
  token: null,
  setToken(token) { this.token = token; },
  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(this.token && { 'Authorization': `Bearer ${this.token}` }), ...options.headers };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail || 'Erro'); }
    return response.json();
  },
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

// ===== GPS HOOK =====
const useGPS = (isWorking, onMove, onStop) => {
  const [isMoving, setIsMoving] = useState(false);
  const lastMove = useRef(Date.now());
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
        (loc) => {
          if (!mounted) return;
          const speed = (loc.coords.speed || 0) * 3.6;
          if (speed >= 5) { setIsMoving(true); lastMove.current = Date.now(); if (!isWorking) onMove?.(); }
          else setIsMoving(false);
        }
      );
      const interval = setInterval(() => {
        if (mounted && isWorking && Date.now() - lastMove.current >= 600000) { onStop?.(); lastMove.current = Date.now(); }
      }, 60000);
      return () => { watch.remove(); clearInterval(interval); };
    })();
    return () => { mounted = false; };
  }, [isWorking]);
  return { isMoving };
};

// ===== LOGIN =====
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erro', 'Preencha os campos'); return; }
    setLoading(true);
    try {
      console.log('A tentar login em:', `${API_URL}/auth/login`);
      const res = await fetch(`${API_URL}/auth/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email, password }) 
      });
      console.log('Response status:', res.status);
      const data = await res.json();
      if (data.access_token) { 
        api.setToken(data.access_token); 
        onLogin(data.user, data.access_token); 
      } else {
        Alert.alert('Erro', data.detail || 'Credenciais inválidas');
      }
    } catch (e) { 
      console.error('Erro login:', e);
      Alert.alert('Erro de Ligação', `Não foi possível conectar ao servidor.\n\nURL: ${API_URL}\nErro: ${e.message}\n\nVerifique a sua ligação à internet.`); 
    }
    setLoading(false);
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.loginBox}>
        <Text style={styles.title}>🚗 TVDEFleet</Text>
        <Text style={styles.subtitle}>App Móvel</Text>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.passwordContainer}>
          <TextInput 
            style={styles.passwordInput} 
            placeholder="Password" 
            placeholderTextColor="#64748b" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry={!showPassword} 
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ===== TAB BAR DINÂMICA =====
const getTabsForRole = (role) => {
  // Motorista: Ponto, Turnos, Ganhos, Suporte (SEM VISTORIAS - apenas consulta na webapp)
  if (role === 'motorista') {
    return [
      { id: 'ponto', icon: '⏱️', label: 'Ponto' }, 
      { id: 'turnos', icon: '📅', label: 'Turnos' },
      { id: 'ganhos', icon: '💰', label: 'Ganhos' }, 
      { id: 'tickets', icon: '🎫', label: 'Suporte' }, 
    ];
  }
  // Inspetor: Apenas Vistorias (fazer até ao final)
  if (role === 'inspetor') {
    return [
      { id: 'vistorias', icon: '🔍', label: 'Vistoria' },
    ];
  }
  // Gestor/Parceiro: Vistorias (podem fazer), Recibos, Resumo Semanal, Extras, Alertas
  if (role === 'gestao' || role === 'parceiro') {
    return [
      { id: 'vistorias', icon: '🔍', label: 'Vistorias' },
      { id: 'recibos', icon: '📄', label: 'Recibos' },
      { id: 'resumo', icon: '📊', label: 'Resumo' },
      { id: 'extras', icon: '💸', label: 'Extras' },
      { id: 'alertas', icon: '🔔', label: 'Alertas' },
    ];
  }
  // Default para outros roles
  return [
    { id: 'ponto', icon: '⏱️', label: 'Ponto' },
  ];
};

const TabBar = ({ activeTab, onTabChange, userRole }) => {
  const tabs = getTabsForRole(userRole);
  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.tabActive]} onPress={() => onTabChange(t.id)}>
          <Text style={styles.tabIcon}>{t.icon}</Text>
          <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ===== PONTO SCREEN =====
const PontoScreen = ({ user, status, setStatus }) => {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [definicoes, setDefinicoes] = useState(null);
  const [podeIniciar, setPodeIniciar] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showDiaModal, setShowDiaModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [diaRegistos, setDiaRegistos] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRegisto, setEditingRegisto] = useState(null);
  const [editForm, setEditForm] = useState({ horaInicio: '', horaFim: '', justificacao: '' });
  const alertRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [turnoStartTime, setTurnoStartTime] = useState(null);
  const timerRef = useRef(null);

  const loadData = async () => {
    try {
      const estado = await api.get('/ponto/estado-atual');
      setStatus(estado.ativo ? (estado.em_pausa ? 'paused' : 'working') : 'off');
      if (estado.ativo && estado.hora_inicio) {
        setTurnoStartTime(new Date(estado.hora_inicio).getTime());
      } else {
        setTurnoStartTime(null);
      }
      const r = await api.get('/ponto/resumo-semanal');
      setResumo(r);
      const d = await api.get('/ponto/definicoes');
      setDefinicoes(d);
      const p = await api.get('/ponto/pode-iniciar');
      setPodeIniciar(p);
    } catch (e) { console.error(e); }
  };

  // Timer em tempo real
  useEffect(() => {
    if (status === 'working' && turnoStartTime) {
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - turnoStartTime) / 1000);
        setCurrentTime(elapsed);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setCurrentTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, turnoStartTime]);

  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const checkAlert = async () => {
    try {
      const result = await api.get('/ponto/verificar-alerta-horas');
      if (result.alerta && result.em_turno) {
        Vibration.vibrate([0, 500, 200, 500]);
        Alert.alert('⚠️ Limite de Horas', result.mensagem || `Atingiu o limite de ${result.limite_horas}h nas últimas 24h`);
      }
    } catch (e) {}
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (status === 'working') { checkAlert(); alertRef.current = setInterval(checkAlert, 300000); }
    else if (alertRef.current) clearInterval(alertRef.current);
    return () => { if (alertRef.current) clearInterval(alertRef.current); };
  }, [status]);

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      await api.post('/ponto/check-in', { matricula: matricula || null });
      setStatus('working');
      setShowCheckInModal(false);
      setMatricula('');
      Alert.alert('Sucesso', 'Check-in registado!');
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
    setLoading(false);
  };

  const handlePonto = async (action) => {
    setLoading(true);
    try {
      if (action === 'pause') { await api.post('/ponto/pausa', { tipo: 'iniciar' }); setStatus('paused'); }
      else if (action === 'resume') { await api.post('/ponto/pausa', { tipo: 'retomar' }); setStatus('working'); }
      else if (action === 'checkout') {
        const result = await api.post('/ponto/check-out', {});
        setStatus('off');
        Alert.alert('Check-out', `Tempo: ${Math.floor(result.tempo_trabalho_minutos / 60)}h ${result.tempo_trabalho_minutos % 60}m`);
      }
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
    setLoading(false);
  };

  const loadDiaRegistos = async (data) => {
    try { const r = await api.get(`/ponto/registos-dia/${data}`); setDiaRegistos(r); } catch (e) {}
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
    loadDiaRegistos(newDate);
  };

  const handleEditRegisto = (reg) => {
    if (!definicoes?.permitir_edicao_registos) {
      Alert.alert('Bloqueado', 'O seu parceiro bloqueou a edição de registos.');
      return;
    }
    setEditingRegisto(reg);
    setEditForm({ 
      horaInicio: reg.hora_inicio, 
      horaFim: reg.hora_fim === 'Em curso' ? '' : reg.hora_fim, 
      justificacao: '',
      tipo: reg.tipo || 'trabalho'
    });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.horaInicio || !editForm.horaFim || !editForm.justificacao) { Alert.alert('Erro', 'Preencha todos os campos'); return; }
    try {
      await api.post(`/ponto/registos/${editingRegisto.id}/editar`, { 
        hora_inicio_real: editForm.horaInicio, 
        hora_fim_real: editForm.horaFim, 
        justificacao: editForm.justificacao,
        tipo: editForm.tipo
      });
      Alert.alert('Sucesso', 'Registo atualizado');
      setShowEditModal(false);
      loadDiaRegistos(selectedDate);
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const formatMin = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min.toString().padStart(2, '0')}m`;
  };

  // Calcular progresso das 24h
  const getHoras24h = () => {
    if (!definicoes) return { worked: 0, limit: 10, percent: 0 };
    const worked = parseFloat(definicoes.horas_trabalhadas_24h) || 0;
    const limit = definicoes.horas_maximas || 10;
    const percent = Math.min((worked / limit) * 100, 100);
    return { worked, limit, percent };
  };

  const horas24h = getHoras24h();

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>
      <Text style={styles.screenTitle}>Relógio de Ponto</Text>

      {/* Timer em tempo real quando a trabalhar */}
      {status === 'working' && (
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>TURNO ATUAL</Text>
          <Text style={styles.timerValue}>{formatTimer(currentTime)}</Text>
          <View style={styles.timerPulse} />
        </View>
      )}

      {/* Barra de progresso 24h */}
      {definicoes && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>⏱️ Últimas 24 horas</Text>
            <Text style={styles.progressValue}>
              <Text style={styles.progressWorked}>{horas24h.worked.toFixed(1)}</Text>
              <Text style={styles.progressSep}> / </Text>
              <Text style={styles.progressLimit}>{horas24h.limit}h</Text>
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[
              styles.progressBarFill, 
              { width: `${horas24h.percent}%` },
              horas24h.percent >= 90 ? styles.progressBarDanger : 
              horas24h.percent >= 70 ? styles.progressBarWarning : 
              styles.progressBarNormal
            ]} />
          </View>
          <View style={styles.progressFooter}>
            <Text style={styles.progressRemaining}>
              {horas24h.limit - horas24h.worked > 0 
                ? `Restam ${(horas24h.limit - horas24h.worked).toFixed(1)}h` 
                : '⚠️ Limite atingido'}
            </Text>
            {horas24h.percent >= 90 && (
              <Text style={styles.progressAlert}>Aproximando do limite!</Text>
            )}
          </View>
          {podeIniciar && !podeIniciar.pode_iniciar && (
            <View style={styles.blockedAlert}>
              <Text style={styles.blockedAlertText}>🚫 {podeIniciar.mensagem}</Text>
            </View>
          )}
        </View>
      )}

      {/* Status */}
      <View style={styles.card}>
        <View style={styles.statusBox}>
          <Text style={styles.statusIcon}>{status === 'off' ? '⚪' : status === 'working' ? '🟢' : '🟡'}</Text>
          <Text style={styles.statusText}>{status === 'off' ? 'Offline' : status === 'working' ? 'A trabalhar' : 'Em pausa'}</Text>
        </View>

        <View style={styles.buttonGroup}>
          {status === 'off' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.btnGreen, !podeIniciar?.pode_iniciar && styles.btnDisabled]} 
              onPress={() => podeIniciar?.pode_iniciar ? setShowCheckInModal(true) : Alert.alert('Bloqueado', podeIniciar?.mensagem)}
              disabled={loading}
            >
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
          <Text style={styles.cardTitle}>📊 Esta Semana</Text>
          <View style={styles.weekSummary}>
            <View style={styles.weekMainStat}>
              <Text style={styles.weekHours}>{Math.floor(resumo.total_minutos / 60)}</Text>
              <Text style={styles.weekHoursLabel}>h</Text>
              <Text style={styles.weekMinutes}>{(resumo.total_minutos % 60).toString().padStart(2, '0')}</Text>
              <Text style={styles.weekMinutesLabel}>m</Text>
            </View>
            <Text style={styles.weekSubLabel}>tempo total</Text>
          </View>
          <View style={styles.weekStats}>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatValue}>{resumo.total_turnos}</Text>
              <Text style={styles.weekStatLabel}>turnos</Text>
            </View>
            <View style={styles.weekStatDivider} />
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatValue}>
                {resumo.total_turnos > 0 ? formatMin(Math.round(resumo.total_minutos / resumo.total_turnos)) : '-'}
              </Text>
              <Text style={styles.weekStatLabel}>média/turno</Text>
            </View>
          </View>
        </View>
      )}

      {/* Ver Registos */}
      <TouchableOpacity style={styles.viewDayBtn} onPress={() => { loadDiaRegistos(selectedDate); setShowDiaModal(true); }}>
        <Text style={styles.viewDayBtnIcon}>📅</Text>
        <Text style={styles.viewDayBtnText}>Ver Registos do Dia</Text>
      </TouchableOpacity>

      {/* Modal Check-in */}
      <Modal visible={showCheckInModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Iniciar Turno</Text>
            <Text style={styles.modalSubtitle}>Horas restantes: {podeIniciar?.horas_restantes}</Text>
            
            <Text style={styles.inputLabel}>Matrícula do Veículo (opcional)</Text>
            <TextInput style={styles.input} placeholder="Ex: AA-00-BB" placeholderTextColor="#64748b" value={matricula} onChangeText={setMatricula} autoCapitalize="characters" />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowCheckInModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleCheckIn} disabled={loading}>
                <Text style={styles.modalBtnConfirmText}>{loading ? 'A iniciar...' : 'Iniciar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Registos Dia */}
      <Modal visible={showDiaModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.dateNav}>
              <TouchableOpacity onPress={() => changeDate(-1)}><Text style={styles.dateNavBtn}>◀</Text></TouchableOpacity>
              <Text style={styles.dateNavTitle}>{diaRegistos?.data_formatada || selectedDate}</Text>
              <TouchableOpacity onPress={() => changeDate(1)}><Text style={styles.dateNavBtn}>▶</Text></TouchableOpacity>
            </View>
            {diaRegistos && <Text style={styles.daySummary}>Total: {diaRegistos.total_formatado} | {diaRegistos.total_turnos} turnos</Text>}
            <ScrollView style={{ maxHeight: 400 }}>
              {diaRegistos?.registos?.length === 0 && <Text style={styles.emptyText}>Sem registos</Text>}
              {diaRegistos?.registos?.map((reg, idx) => (
                <View key={idx} style={[styles.registoItem, reg.tipo === 'pessoal' && styles.registoItemPessoal]}>
                  <View style={styles.registoHeader}>
                    <Text style={styles.registoHoras}>{reg.hora_inicio} - {reg.hora_fim}</Text>
                    {reg.tipo === 'pessoal' && <View style={[styles.badge, styles.badgePessoal]}><Text style={styles.badgeText}>Pessoal</Text></View>}
                    {reg.editado && <View style={styles.badge}><Text style={styles.badgeText}>Editado</Text></View>}
                    {reg.matricula && <Text style={styles.registoMatricula}>🚗 {reg.matricula}</Text>}
                  </View>
                  <Text style={styles.registoTempo}>
                    {reg.tempo_trabalho_formatado}
                    {reg.tipo === 'pessoal' && <Text style={styles.registoPessoalNote}> (não conta)</Text>}
                  </Text>
                  {reg.editado && <Text style={styles.registoEdit}>Real: {reg.hora_inicio_real} - {reg.hora_fim_real}</Text>}
                  {!reg.em_curso && definicoes?.permitir_edicao_registos && (
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

      {/* Modal Editar */}
      <Modal visible={showEditModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Registo</Text>
            
            {/* Tipo de Registo */}
            <Text style={styles.inputLabel}>Tipo de Registo</Text>
            <View style={styles.tipoSelector}>
              <TouchableOpacity 
                style={[styles.tipoBtn, editForm.tipo === 'trabalho' && styles.tipoBtnActive]} 
                onPress={() => setEditForm({...editForm, tipo: 'trabalho'})}
              >
                <Text style={[styles.tipoBtnText, editForm.tipo === 'trabalho' && styles.tipoBtnTextActive]}>💼 Trabalho</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tipoBtn, editForm.tipo === 'pessoal' && styles.tipoBtnPessoalActive]} 
                onPress={() => setEditForm({...editForm, tipo: 'pessoal'})}
              >
                <Text style={[styles.tipoBtnText, editForm.tipo === 'pessoal' && styles.tipoBtnTextActive]}>🏠 Pessoal</Text>
              </TouchableOpacity>
            </View>
            {editForm.tipo === 'pessoal' && (
              <Text style={styles.tipoHint}>⚠️ Tempo pessoal não conta para horas de trabalho</Text>
            )}
            
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.inputLabel}>Início</Text>
                <TextInput style={styles.timeInput} value={editForm.horaInicio} onChangeText={t => setEditForm({...editForm, horaInicio: t})} placeholder="HH:MM" placeholderTextColor="#64748b" />
              </View>
              <Text style={styles.timeSep}>→</Text>
              <View style={styles.timeCol}>
                <Text style={styles.inputLabel}>Fim</Text>
                <TextInput style={styles.timeInput} value={editForm.horaFim} onChangeText={t => setEditForm({...editForm, horaFim: t})} placeholder="HH:MM" placeholderTextColor="#64748b" />
              </View>
            </View>
            <Text style={styles.inputLabel}>Justificação *</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={editForm.justificacao} onChangeText={t => setEditForm({...editForm, justificacao: t})} placeholder="Motivo..." placeholderTextColor="#64748b" multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowEditModal(false)}><Text style={styles.modalBtnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={submitEdit}><Text style={styles.modalBtnConfirmText}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ===== ECRÃS PARA GESTOR/PARCEIRO =====

// Ecrã de Gestão de Recibos
const RecibosGestaoScreen = ({ user }) => {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('pendente');

  const loadRecibos = async () => {
    try {
      const data = await api.get(`/ponto/parceiro/recibos-pendentes?status=${filtro}`);
      setRecibos(data.recibos || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadRecibos(); }, [filtro]);

  const handleAprovar = async (reciboId) => {
    try {
      await api.post(`/ponto/parceiro/aprovar-recibo/${reciboId}`, {});
      Alert.alert('Sucesso', 'Recibo aprovado');
      loadRecibos();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const handleRejeitar = async (reciboId) => {
    try {
      await api.post(`/ponto/parceiro/rejeitar-recibo/${reciboId}`, {});
      Alert.alert('Sucesso', 'Recibo rejeitado');
      loadRecibos();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadRecibos(); setRefreshing(false); }} />}>
      <Text style={styles.screenTitle}>📄 Verificar Recibos</Text>
      
      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {['pendente', 'aprovado', 'rejeitado'].map(f => (
          <TouchableOpacity key={f} style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]} onPress={() => setFiltro(f)}>
            <Text style={[styles.filtroBtnText, filtro === f && styles.filtroBtnTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {recibos.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>Sem recibos {filtro}s</Text></View>
      ) : recibos.map(r => (
        <View key={r.id} style={styles.card}>
          <View style={styles.reciboHeader}>
            <Text style={styles.cardTitle}>{r.motorista_nome}</Text>
            <Text style={styles.reciboSemana}>Semana {r.semana}/{r.ano}</Text>
          </View>
          <Text style={styles.cardSubtitle}>Ganhos: €{r.total_ganhos?.toFixed(2) || '0.00'}</Text>
          {filtro === 'pendente' && (
            <View style={styles.reciboActions}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnApprove]} onPress={() => handleAprovar(r.id)}>
                <Text style={styles.actionBtnText}>✓ Aprovar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnReject]} onPress={() => handleRejeitar(r.id)}>
                <Text style={styles.actionBtnText}>✗ Rejeitar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

// Ecrã de Resumo Semanal (Gestor/Parceiro) - CORRIGIDO
const ResumoSemanalGestaoScreen = ({ user }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semana, setSemana] = useState(null);
  const [ano, setAno] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const now = new Date();
    const oneJan = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
    setSemana(weekNum);
    setAno(now.getFullYear());
  }, []);

  const loadResumo = async () => {
    if (!semana || !ano) return;
    try {
      const data = await api.get(`/ponto/parceiro/resumo-semanal?semana=${semana}&ano=${ano}`);
      setMotoristas(data.motoristas || []);
    } catch (e) { console.error('Erro ao carregar resumo:', e); }
    setLoading(false);
  };

  useEffect(() => { if (semana && ano) loadResumo(); }, [semana, ano]);

  const handleAlterarEstado = async (motoristaId, novoEstado) => {
    try {
      await api.post(`/ponto/parceiro/alterar-estado-resumo?motorista_id=${motoristaId}&semana=${semana}&ano=${ano}&estado=${novoEstado}`, {});
      Alert.alert('Sucesso', 'Estado alterado');
      loadResumo();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadResumo(); setRefreshing(false); }} />}>
      <Text style={styles.screenTitle}>📊 Resumo Semanal</Text>
      
      {/* Seletor de semana */}
      <View style={styles.semanaSelector}>
        <TouchableOpacity onPress={() => { setSemana(s => s > 1 ? s - 1 : 52); if (semana === 1) setAno(a => a - 1); }} style={styles.semanaBtn}><Text style={styles.semanaBtnText}>←</Text></TouchableOpacity>
        <Text style={styles.semanaText}>Semana {semana}/{ano}</Text>
        <TouchableOpacity onPress={() => { setSemana(s => s < 52 ? s + 1 : 1); if (semana === 52) setAno(a => a + 1); }} style={styles.semanaBtn}><Text style={styles.semanaBtnText}>→</Text></TouchableOpacity>
      </View>

      {motoristas.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>Sem motoristas associados</Text></View>
      ) : motoristas.map(m => (
        <View key={m.id} style={styles.card}>
          <Text style={styles.cardTitle}>{m.nome}</Text>
          <Text style={styles.cardSubtitle}>{m.email}</Text>
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>Ganhos Uber:</Text>
            <Text style={styles.resumoValue}>€{m.ganhos_uber?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>Ganhos Bolt:</Text>
            <Text style={styles.resumoValue}>€{m.ganhos_bolt?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>Via Verde:</Text>
            <Text style={[styles.resumoValue, { color: '#ef4444' }]}>-€{m.via_verde?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>Líquido:</Text>
            <Text style={[styles.resumoValue, { color: '#22c55e', fontWeight: 'bold' }]}>€{m.liquido?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.estadoRow}>
            <Text style={styles.estadoLabel}>Estado: {m.estado === 'sem_dados' ? '📭 Sem dados' : m.estado}</Text>
            <View style={styles.estadoBtns}>
              {['pendente', 'pago', 'confirmado'].map(e => (
                <TouchableOpacity key={e} style={[styles.estadoBtn, m.estado === e && styles.estadoBtnActive]} onPress={() => handleAlterarEstado(m.id, e)}>
                  <Text style={[styles.estadoBtnText, m.estado === e && styles.estadoBtnTextActive]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// Ecrã de Extras/Dívidas (Gestor/Parceiro)
const ExtrasGestaoScreen = ({ user }) => {
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [extraForm, setExtraForm] = useState({ tipo: 'debito', descricao: '', valor: '' });

  const loadMotoristas = async () => {
    try {
      const data = await api.get('/motoristas/meus');
      setMotoristas(data.motoristas || data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadMotoristas(); }, []);

  const handleAddExtra = async () => {
    if (!extraForm.descricao || !extraForm.valor) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    try {
      await api.post('/extras-motorista/adicionar', {
        motorista_id: selectedMotorista.id,
        tipo: extraForm.tipo,
        descricao: extraForm.descricao,
        valor: parseFloat(extraForm.valor)
      });
      Alert.alert('Sucesso', 'Extra adicionado');
      setShowModal(false);
      setExtraForm({ tipo: 'debito', descricao: '', valor: '' });
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>💸 Extras / Dívidas</Text>
      <Text style={styles.cardSubtitle}>Adicionar débitos ou créditos aos motoristas</Text>

      {motoristas.map(m => (
        <TouchableOpacity key={m.id} style={styles.card} onPress={() => { setSelectedMotorista(m); setShowModal(true); }}>
          <View style={styles.motoristaRow}>
            <View>
              <Text style={styles.cardTitle}>{m.name || m.nome}</Text>
              <Text style={styles.cardSubtitle}>{m.email}</Text>
            </View>
            <Text style={styles.addBtn}>+ Adicionar</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Modal para adicionar extra */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Extra</Text>
            <Text style={styles.modalSubtitle}>{selectedMotorista?.name || selectedMotorista?.nome}</Text>
            
            <View style={styles.tipoSelector}>
              <TouchableOpacity 
                style={[styles.tipoBtn, extraForm.tipo === 'debito' && styles.tipoBtnDebito]} 
                onPress={() => setExtraForm({ ...extraForm, tipo: 'debito' })}
              >
                <Text style={styles.tipoBtnText}>Débito (-)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tipoBtn, extraForm.tipo === 'credito' && styles.tipoBtnCredito]} 
                onPress={() => setExtraForm({ ...extraForm, tipo: 'credito' })}
              >
                <Text style={styles.tipoBtnText}>Crédito (+)</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="Descrição" 
              placeholderTextColor="#64748b"
              value={extraForm.descricao}
              onChangeText={(t) => setExtraForm({ ...extraForm, descricao: t })}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Valor (€)" 
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={extraForm.valor}
              onChangeText={(t) => setExtraForm({ ...extraForm, valor: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={handleAddExtra}>
                <Text style={styles.btnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// Ecrã de Alertas (Gestor/Parceiro)
const AlertasGestaoScreen = ({ user }) => {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlertas = async () => {
    try {
      const data = await api.get('/alertas/parceiro');
      setAlertas(data.alertas || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadAlertas(); }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>🔔 Alertas</Text>
      
      {alertas.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>✅ Sem alertas pendentes</Text>
        </View>
      ) : alertas.map(a => (
        <View key={a.id} style={[styles.card, a.prioridade === 'alta' && styles.cardAlerta]}>
          <View style={styles.alertaHeader}>
            <Text style={styles.alertaIcon}>{a.tipo === 'documento' ? '📄' : a.tipo === 'veiculo' ? '🚗' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{a.titulo}</Text>
              <Text style={styles.cardSubtitle}>{a.descricao}</Text>
            </View>
            {a.prioridade === 'alta' && <Text style={styles.alertaPrioridade}>URGENTE</Text>}
          </View>
          {a.motorista_nome && <Text style={styles.alertaMotorista}>Motorista: {a.motorista_nome}</Text>}
          {a.data_limite && <Text style={styles.alertaData}>Data limite: {a.data_limite}</Text>}
        </View>
      ))}
    </ScrollView>
  );
};

// ===== GANHOS SCREEN =====
const GanhosScreen = () => {
  const [semanas, setSemanas] = useState([]);
  const [sel, setSel] = useState(null);
  const [ganhos, setGanhos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enviandoRecibo, setEnviandoRecibo] = useState(false);

  const loadGanhos = async () => {
    if (sel) {
      const g = await api.get(`/ponto/ganhos-semana?semana=${sel.semana}&ano=${sel.ano}`);
      setGanhos(g);
    }
  };

  useEffect(() => { (async () => { const d = await api.get('/ponto/semanas-disponiveis?num_semanas=12'); setSemanas(d.semanas); if (d.semanas.length) setSel(d.semanas[0]); })(); }, []);
  useEffect(() => { if (sel) { setLoading(true); loadGanhos().then(() => setLoading(false)); } }, [sel]);

  const enviarRecibo = async () => {
    setEnviandoRecibo(true);
    try {
      await api.post('/documentos-motorista/recibo-semanal', { 
        semana: sel.semana, 
        ano: sel.ano,
        valor_liquido: ganhos.valor_liquido
      });
      Alert.alert('Sucesso', 'Recibo enviado para aprovação!');
      loadGanhos();
    } catch (e) { Alert.alert('Erro', e.message); }
    setEnviandoRecibo(false);
  };

  if (loading && !ganhos) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  const reciboStatus = ganhos?.recibo_status || 'nao_enviado';
  const podeMudar = reciboStatus === 'nao_enviado' || reciboStatus === 'rejeitado';

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>Ganhos</Text>
      <TouchableOpacity style={styles.semanaSelector} onPress={() => setShowModal(true)}>
        <Text style={styles.semanaSelectorValue}>{sel?.label}</Text>
        <Text style={styles.semanaSelectorArrow}>▼</Text>
      </TouchableOpacity>
      {ganhos && (
        <>
          <View style={styles.card}>
            <View style={styles.ganhoBox}>
              <Text style={styles.ganhoLabel}>Líquido</Text>
              <Text style={[styles.ganhoValor, ganhos.valor_liquido >= 0 ? styles.positive : styles.negative]}>€{ganhos.valor_liquido.toFixed(2)}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Ganhos: €{ganhos.ganhos.total.toFixed(2)}</Text>
              <View style={styles.row}><Text style={styles.label}>Uber</Text><Text style={styles.value}>€{ganhos.ganhos.uber.toFixed(2)}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Bolt</Text><Text style={styles.value}>€{ganhos.ganhos.bolt.toFixed(2)}</Text></View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📉 Despesas: €{ganhos.despesas.total.toFixed(2)}</Text>
              <View style={styles.row}><Text style={styles.label}>Via Verde</Text><Text style={styles.value}>€{ganhos.despesas.via_verde.toFixed(2)}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Combustível</Text><Text style={styles.value}>€{ganhos.despesas.combustivel.toFixed(2)}</Text></View>
            </View>
          </View>
          
          {/* Secção Recibo */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📄 Recibo Semanal</Text>
            
            {reciboStatus === 'nao_enviado' && (
              <View style={styles.reciboSection}>
                <Text style={styles.reciboInfo}>Envie o recibo para confirmação do parceiro</Text>
                <TouchableOpacity 
                  style={[styles.reciboBtn, enviandoRecibo && styles.btnDisabled]} 
                  onPress={enviarRecibo}
                  disabled={enviandoRecibo}
                >
                  <Text style={styles.reciboBtnText}>{enviandoRecibo ? 'A enviar...' : '📤 Enviar Recibo'}</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {reciboStatus === 'pendente' && (
              <View style={[styles.reciboStatus, styles.reciboStatusPendente]}>
                <Text style={styles.reciboStatusIcon}>⏳</Text>
                <Text style={styles.reciboStatusText}>Recibo enviado - Aguarda aprovação</Text>
              </View>
            )}
            
            {reciboStatus === 'aprovado' && (
              <View style={[styles.reciboStatus, styles.reciboStatusAprovado]}>
                <Text style={styles.reciboStatusIcon}>✅</Text>
                <Text style={styles.reciboStatusText}>Recibo aprovado e pago</Text>
              </View>
            )}
            
            {reciboStatus === 'rejeitado' && (
              <View style={styles.reciboSection}>
                <View style={[styles.reciboStatus, styles.reciboStatusRejeitado]}>
                  <Text style={styles.reciboStatusIcon}>❌</Text>
                  <Text style={styles.reciboStatusText}>Recibo rejeitado</Text>
                </View>
                {ganhos.recibo_motivo && <Text style={styles.reciboMotivo}>Motivo: {ganhos.recibo_motivo}</Text>}
                <TouchableOpacity 
                  style={[styles.reciboBtn, enviandoRecibo && styles.btnDisabled]} 
                  onPress={enviarRecibo}
                  disabled={enviandoRecibo}
                >
                  <Text style={styles.reciboBtnText}>{enviandoRecibo ? 'A enviar...' : '🔄 Reenviar Recibo'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Semana</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {semanas.map(s => (
                <TouchableOpacity key={`${s.semana}-${s.ano}`} style={[styles.semanaItem, sel?.semana === s.semana && styles.semanaItemActive]} onPress={() => { setSel(s); setShowModal(false); }}>
                  <Text style={styles.semanaItemLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)}><Text style={styles.modalCloseBtnText}>Fechar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ===== TICKETS SCREEN =====
const CATEGORIAS = [
  { id: 'pagamentos', icon: '💳', label: 'Pagamentos', color: '#3b82f6', foto: false },
  { id: 'tecnico', icon: '🔧', label: 'Técnico', color: '#8b5cf6', foto: false },
  { id: 'esclarecimentos', icon: '❓', label: 'Esclarecimentos', color: '#06b6d4', foto: false },
  { id: 'relatorios', icon: '📊', label: 'Relatórios', color: '#10b981', foto: false },
  { id: 'acidente', icon: '🚨', label: 'Acidente', color: '#dc2626', foto: true },
  { id: 'avaria', icon: '🛠️', label: 'Avaria', color: '#d97706', foto: true },
  { id: 'outro', icon: '📝', label: 'Outro', color: '#64748b', foto: false },
];

const TicketsScreen = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [vistoriasPendentes, setVistoriasPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: '', categoria: 'esclarecimentos', descricao: '', fotos: [] });
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState('');
  const [showCategorias, setShowCategorias] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState(null);
  const [activeSection, setActiveSection] = useState('tickets'); // 'tickets' ou 'vistorias'

  useEffect(() => { 
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ticketsData = await api.get('/tickets/meus');
      setTickets(ticketsData || []);
      // Carregar vistorias pendentes de aceitação para motorista
      if (user.role === 'motorista') {
        try {
          const vistoriasData = await api.get('/vistorias/pendentes-aceitacao');
          setVistoriasPendentes(vistoriasData.vistorias || []);
        } catch (e) { console.log('Sem vistorias pendentes'); }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const tirarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erro', 'Permissão de câmara necessária'); return; }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, fotos: [...f.fotos, result.assets[0]] }));
    }
  };

  const escolherFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erro', 'Permissão de galeria necessária'); return; }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: true,
    });
    
    if (!result.canceled && result.assets) {
      setForm(f => ({ ...f, fotos: [...f.fotos, ...result.assets] }));
    }
  };

  const removerFoto = (index) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== index) }));
  };

  const criar = async () => {
    if (!form.titulo || !form.descricao) { Alert.alert('Erro', 'Preencha os campos'); return; }
    setEnviando(true);
    try {
      // Criar ticket com fotos em base64
      const ticketData = {
        titulo: form.titulo,
        categoria: form.categoria,
        descricao: form.descricao,
        fotos: form.fotos.map(f => ({ base64: f.base64, uri: f.uri }))
      };
      await api.post('/tickets/criar', ticketData);
      setModal(false);
      setForm({ titulo: '', categoria: 'esclarecimentos', descricao: '', fotos: [] });
      setTickets(await api.get('/tickets/meus'));
      Alert.alert('Sucesso', 'Ticket criado!');
    } catch (e) { Alert.alert('Erro', e.message); }
    setEnviando(false);
  };

  const getCategoriaInfo = (catId) => CATEGORIAS.find(c => c.id === catId) || CATEGORIAS[CATEGORIAS.length - 1];
  const categoriaAtual = getCategoriaInfo(form.categoria);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (sel) return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <TouchableOpacity onPress={() => setSel(null)}><Text style={styles.backBtn}>← #{sel.numero}</Text></TouchableOpacity>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Fotos do ticket */}
        {sel.fotos && sel.fotos.length > 0 && (
          <View style={styles.ticketFotosContainer}>
            <Text style={styles.ticketFotosLabel}>📷 Fotos anexadas:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sel.fotos.map((foto, i) => (
                <Image key={i} source={{ uri: foto.url || foto.uri }} style={styles.ticketFotoThumb} />
              ))}
            </ScrollView>
          </View>
        )}
        {sel.mensagens?.map((m, i) => (
          <View key={i} style={[styles.message, m.autor_id === user.id ? styles.messageOwn : styles.messageOther]}>
            <Text style={styles.messageText}>{m.conteudo}</Text>
            {m.anexo && <Text style={styles.messageAnexo}>📎 Anexo</Text>}
          </View>
        ))}
      </ScrollView>
      {sel.status !== 'fechado' && (
        <View style={styles.chatInput}>
          <TextInput style={styles.chatTextInput} value={msg} onChangeText={setMsg} placeholder="Mensagem..." placeholderTextColor="#64748b" />
          <TouchableOpacity style={styles.sendBtn} onPress={async () => { await api.post(`/tickets/${sel.id}/mensagem`, { conteudo: msg }); setMsg(''); setSel(await api.get(`/tickets/${sel.id}`)); }}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  // Aceitar ou rejeitar vistoria
  const handleAceitarVistoria = async (vistoriaId, aceitar) => {
    try {
      await api.post(`/vistorias/${vistoriaId}/confirmar-motorista`, { aceitar });
      Alert.alert('Sucesso', aceitar ? 'Vistoria aceite!' : 'Vistoria rejeitada');
      setVistoriaSelecionada(null);
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  // Modal de detalhe da vistoria para aceitar
  if (vistoriaSelecionada) {
    return (
      <ScrollView style={styles.screen}>
        <TouchableOpacity onPress={() => setVistoriaSelecionada(null)}>
          <Text style={styles.backBtn}>← Voltar</Text>
        </TouchableOpacity>
        
        <Text style={styles.screenTitle}>📋 Relatório de Vistoria</Text>
        <Text style={styles.vistoriaInfo}>
          {vistoriaSelecionada.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'} - {vistoriaSelecionada.data}
        </Text>
        
        {/* Info do Veículo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚗 Veículo</Text>
          <Text style={styles.vistoriaDetalhe}>Matrícula: {vistoriaSelecionada.veiculo_matricula || 'N/A'}</Text>
          <Text style={styles.vistoriaDetalhe}>Quilometragem: {vistoriaSelecionada.km?.toLocaleString()} km</Text>
          <Text style={styles.vistoriaDetalhe}>Combustível: {vistoriaSelecionada.nivel_combustivel}%</Text>
        </View>
        
        {/* Danos Detetados */}
        {vistoriaSelecionada.danos && vistoriaSelecionada.danos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Danos Registados ({vistoriaSelecionada.danos.length})</Text>
            {vistoriaSelecionada.danos.map((d, i) => (
              <View key={i} style={styles.danoItem}>
                <Text style={styles.danoTipo}>{d.tipo}</Text>
                <Text style={styles.danoDesc}>{d.descricao || 'Sem descrição'}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Análise IA */}
        {vistoriaSelecionada.analise_ia && (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#8b5cf6' }]}>
            <Text style={styles.cardTitle}>🤖 Análise Automática (IA)</Text>
            {vistoriaSelecionada.analise_ia.danos_detetados?.length > 0 ? (
              vistoriaSelecionada.analise_ia.danos_detetados.map((d, i) => (
                <Text key={i} style={styles.vistoriaDetalhe}>• {d.tipo}: {d.descricao}</Text>
              ))
            ) : (
              <Text style={[styles.vistoriaDetalhe, { color: '#22c55e' }]}>✅ Sem danos detetados</Text>
            )}
          </View>
        )}
        
        {/* Observações */}
        {vistoriaSelecionada.observacoes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📝 Observações</Text>
            <Text style={styles.vistoriaDetalhe}>{vistoriaSelecionada.observacoes}</Text>
          </View>
        )}
        
        {/* Inspetor */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Inspetor</Text>
          <Text style={styles.vistoriaDetalhe}>{vistoriaSelecionada.inspetor_nome || 'N/A'}</Text>
          <Text style={styles.vistoriaDetalhe}>{vistoriaSelecionada.created_at}</Text>
        </View>
        
        {/* Botões de Ação */}
        <View style={styles.vistoriaActions}>
          <TouchableOpacity 
            style={[styles.actionBtnLarge, { backgroundColor: '#ef4444' }]}
            onPress={() => Alert.alert(
              'Rejeitar Vistoria',
              'Tem a certeza que deseja rejeitar esta vistoria? Será notificado o parceiro.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Rejeitar', style: 'destructive', onPress: () => handleAceitarVistoria(vistoriaSelecionada.id, false) }
              ]
            )}
          >
            <Text style={styles.actionBtnLargeText}>✗ Rejeitar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtnLarge, { backgroundColor: '#22c55e' }]}
            onPress={() => handleAceitarVistoria(vistoriaSelecionada.id, true)}
          >
            <Text style={styles.actionBtnLargeText}>✓ Aceitar</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.aceitarAviso}>
          Ao aceitar, confirma que concorda com os dados da vistoria. O relatório será enviado para o seu email.
        </Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Suporte</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}><Text style={styles.addBtnText}>+ Novo</Text></TouchableOpacity>
      </View>
      
      {/* Tabs para Motorista: Vistorias Pendentes / Tickets */}
      {user.role === 'motorista' && vistoriasPendentes.length > 0 && (
        <View style={styles.sectionTabs}>
          <TouchableOpacity 
            style={[styles.sectionTab, activeSection === 'vistorias' && styles.sectionTabActive]}
            onPress={() => setActiveSection('vistorias')}
          >
            <Text style={[styles.sectionTabText, activeSection === 'vistorias' && styles.sectionTabTextActive]}>
              🔍 Vistorias ({vistoriasPendentes.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sectionTab, activeSection === 'tickets' && styles.sectionTabActive]}
            onPress={() => setActiveSection('tickets')}
          >
            <Text style={[styles.sectionTabText, activeSection === 'tickets' && styles.sectionTabTextActive]}>
              🎫 Tickets ({tickets.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Vistorias Pendentes de Aceitação */}
      {user.role === 'motorista' && activeSection === 'vistorias' && vistoriasPendentes.length > 0 && (
        <View style={styles.vistoriasPendentesSection}>
          <Text style={styles.vistoriasPendentesTitle}>⚠️ Vistorias a Confirmar</Text>
          <Text style={styles.vistoriasPendentesSubtitle}>Reveja e aceite as vistorias realizadas ao seu veículo</Text>
          <ScrollView>
            {vistoriasPendentes.map(v => (
              <TouchableOpacity 
                key={v.id} 
                style={styles.vistoriaPendenteCard}
                onPress={() => setVistoriaSelecionada(v)}
              >
                <View style={styles.vistoriaPendenteHeader}>
                  <Text style={styles.vistoriaPendenteTipo}>
                    {v.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}
                  </Text>
                  <Text style={styles.vistoriaPendenteData}>{v.data}</Text>
                </View>
                <Text style={styles.vistoriaPendenteVeiculo}>🚗 {v.veiculo_matricula || 'Veículo'}</Text>
                {v.danos && v.danos.length > 0 && (
                  <Text style={styles.vistoriaPendenteDanos}>⚠️ {v.danos.length} dano(s) registado(s)</Text>
                )}
                <Text style={styles.vistoriaPendenteAction}>Toque para ver relatório →</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Conteúdo de Tickets (apenas se secção ativa for tickets ou não houver vistorias) */}
      {(activeSection === 'tickets' || vistoriasPendentes.length === 0) && (
        <>
          {/* Botões Urgentes */}
          <View style={styles.urgentBtns}>
            <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: '#dc2626' }]} onPress={() => { setForm({ titulo: 'Acidente', categoria: 'acidente', descricao: '', fotos: [] }); setModal(true); }}>
              <Text style={styles.urgentBtnText}>🚨 Acidente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: '#d97706' }]} onPress={() => { setForm({ titulo: 'Avaria', categoria: 'avaria', descricao: '', fotos: [] }); setModal(true); }}>
              <Text style={styles.urgentBtnText}>🛠️ Avaria</Text>
            </TouchableOpacity>
          </View>
          
          {/* Categorias Rápidas */}
          <View style={styles.categoriasGrid}>
            {CATEGORIAS.filter(c => !['acidente', 'avaria'].includes(c.id)).map(cat => (
              <TouchableOpacity 
                key={cat.id} 
                style={[styles.categoriaQuick, { borderColor: cat.color }]}
                onPress={() => { setForm({ ...form, categoria: cat.id }); setModal(true); }}
              >
                <Text style={styles.categoriaQuickIcon}>{cat.icon}</Text>
                <Text style={styles.categoriaQuickLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Lista de Tickets */}
          <Text style={styles.ticketListTitle}>Meus Tickets</Text>
          <ScrollView>
            {tickets.length === 0 && <Text style={styles.emptyText}>Sem tickets</Text>}
            {tickets.map(t => {
              const cat = getCategoriaInfo(t.categoria);
              return (
                <TouchableOpacity key={t.id} style={styles.ticketCard} onPress={() => setSel(t)}>
                  <View style={styles.ticketHeader}>
                    <View style={[styles.ticketCategoria, { backgroundColor: cat.color }]}>
                      <Text style={styles.ticketCategoriaText}>{cat.icon} {cat.label}</Text>
                    </View>
                    <Text style={styles.ticketNumero}>#{t.numero}</Text>
                  </View>
                  <Text style={styles.ticketTitulo}>{t.titulo}</Text>
                  {t.tem_anexos && <Text style={styles.ticketAnexos}>📎 Com anexos</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
      
      {/* Modal Novo Ticket */}
      <Modal visible={modal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Novo Ticket</Text>
            
            {/* Selector de Categoria */}
            <Text style={styles.inputLabel}>Categoria</Text>
            <TouchableOpacity style={styles.categoriaSelector} onPress={() => setShowCategorias(!showCategorias)}>
              <Text style={styles.categoriaSelectorText}>
                {getCategoriaInfo(form.categoria).icon} {getCategoriaInfo(form.categoria).label}
              </Text>
              <Text style={styles.categoriaSelectorArrow}>{showCategorias ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showCategorias && (
              <View style={styles.categoriasList}>
                {CATEGORIAS.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[styles.categoriaItem, form.categoria === cat.id && { backgroundColor: cat.color + '20' }]}
                    onPress={() => { setForm({...form, categoria: cat.id}); setShowCategorias(false); }}
                  >
                    <Text style={styles.categoriaItemText}>{cat.icon} {cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <TextInput style={styles.input} placeholder="Título" placeholderTextColor="#64748b" value={form.titulo} onChangeText={t => setForm({...form, titulo: t})} />
            <TextInput style={[styles.input, { height: 100 }]} placeholder="Descrição detalhada..." placeholderTextColor="#64748b" value={form.descricao} onChangeText={t => setForm({...form, descricao: t})} multiline />
            
            {/* Secção de Fotos - sempre visível mas destacada para acidente/avaria */}
            <View style={[styles.fotosSection, categoriaAtual.foto && styles.fotosSectionDestaque]}>
              <Text style={styles.fotosSectionTitle}>
                {categoriaAtual.foto ? '📷 Fotos (Recomendado)' : '📷 Fotos (Opcional)'}
              </Text>
              
              {form.fotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosPreview}>
                  {form.fotos.map((foto, idx) => (
                    <View key={idx} style={styles.fotoPreviewItem}>
                      <Image source={{ uri: foto.uri }} style={styles.fotoPreviewImg} />
                      <TouchableOpacity style={styles.fotoRemoveBtn} onPress={() => removerFoto(idx)}>
                        <Text style={styles.fotoRemoveBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              
              <View style={styles.fotoBtns}>
                <TouchableOpacity style={styles.fotoBtn} onPress={tirarFoto}>
                  <Text style={styles.fotoBtnText}>📸 Tirar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fotoBtn} onPress={escolherFoto}>
                  <Text style={styles.fotoBtnText}>🖼️ Galeria</Text>
                </TouchableOpacity>
              </View>
              
              {categoriaAtual.foto && form.fotos.length === 0 && (
                <Text style={styles.fotoHint}>⚠️ Para {categoriaAtual.label.toLowerCase()}, é importante anexar fotos</Text>
              )}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => { setModal(false); setShowCategorias(false); setForm({ titulo: '', categoria: 'esclarecimentos', descricao: '', fotos: [] }); }}><Text style={styles.modalBtnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm, enviando && styles.btnDisabled]} onPress={criar} disabled={enviando}>
                <Text style={styles.modalBtnConfirmText}>{enviando ? 'A enviar...' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ===== TURNOS SCREEN =====
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const TurnosScreen = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [turnos, setTurnos] = useState(null);
  const [historicoTurnos, setHistoricoTurnos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTurnos = async () => {
    try {
      const data = await api.get('/turnos/meus');
      setTurnos(data.turnos_atuais);
      setHistoricoTurnos(data.historico || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadTurnos(); }, []);

  const formatHora = (h) => h ? h.substring(0, 5) : '--:--';

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView 
      style={styles.screen} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadTurnos(); setRefreshing(false); }} />}
    >
      <Text style={styles.screenTitle}>Meus Turnos</Text>
      
      {/* Turnos Atuais */}
      {turnos && turnos.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Horário Atual</Text>
          {turnos.map((turno, idx) => (
            <View key={idx} style={styles.turnoItem}>
              <View style={styles.turnoDia}>
                <Text style={styles.turnoDiaText}>{DIAS_SEMANA[turno.dia_semana]}</Text>
              </View>
              <View style={styles.turnoHoras}>
                <Text style={styles.turnoHoraText}>{formatHora(turno.hora_inicio)}</Text>
                <Text style={styles.turnoSep}>→</Text>
                <Text style={styles.turnoHoraText}>{formatHora(turno.hora_fim)}</Text>
              </View>
              {turno.veiculo_matricula && (
                <Text style={styles.turnoVeiculo}>🚗 {turno.veiculo_matricula}</Text>
              )}
            </View>
          ))}
          {turnos[0]?.valido_desde && (
            <Text style={styles.turnoValidade}>Válido desde: {turnos[0].valido_desde}</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.semTurnos}>
            <Text style={styles.semTurnosIcon}>📅</Text>
            <Text style={styles.semTurnosText}>Sem turnos configurados</Text>
            <Text style={styles.semTurnosHint}>O seu parceiro ainda não definiu o seu horário de trabalho</Text>
          </View>
        </View>
      )}
      
      {/* Próximos Turnos da Semana */}
      {turnos && turnos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📆 Esta Semana</Text>
          {(() => {
            const hoje = new Date();
            const diaSemana = hoje.getDay() === 0 ? 6 : hoje.getDay() - 1; // Converter para Segunda=0
            const proximosTurnos = [];
            
            for (let i = 0; i < 7; i++) {
              const diaIdx = (diaSemana + i) % 7;
              const turno = turnos.find(t => t.dia_semana === diaIdx);
              const data = new Date(hoje);
              data.setDate(data.getDate() + i);
              
              proximosTurnos.push({
                dia: DIAS_SEMANA[diaIdx],
                data: data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
                turno,
                isHoje: i === 0
              });
            }
            
            return proximosTurnos.map((item, idx) => (
              <View key={idx} style={[styles.proximoTurno, item.isHoje && styles.proximoTurnoHoje]}>
                <View style={styles.proximoTurnoDia}>
                  <Text style={[styles.proximoTurnoDiaText, item.isHoje && styles.proximoTurnoHojeText]}>
                    {item.isHoje ? '📍 Hoje' : item.dia}
                  </Text>
                  <Text style={styles.proximoTurnoData}>{item.data}</Text>
                </View>
                {item.turno ? (
                  <Text style={styles.proximoTurnoHora}>
                    {formatHora(item.turno.hora_inicio)} - {formatHora(item.turno.hora_fim)}
                  </Text>
                ) : (
                  <Text style={styles.proximoTurnoFolga}>Folga</Text>
                )}
              </View>
            ));
          })()}
        </View>
      )}
      
      {/* Histórico de Horários */}
      {historicoTurnos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📜 Histórico de Horários</Text>
          {historicoTurnos.map((hist, idx) => (
            <View key={idx} style={styles.historicoItem}>
              <Text style={styles.historicoPeriodo}>
                {hist.data_inicio} - {hist.data_fim || 'Atual'}
              </Text>
              <Text style={styles.historicoResumo}>
                {hist.dias_semana?.length || 0} dias/semana
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

// ===== VISTORIAS SCREEN (Tipo WeProov) =====
const FOTOS_OBRIGATORIAS = [
  { id: 'frente', label: 'Frente do Veículo', icon: '🚗', instrucao: 'Fotografe a frente completa do veículo' },
  { id: 'traseira', label: 'Traseira', icon: '🚙', instrucao: 'Fotografe a traseira completa' },
  { id: 'lateral_esq', label: 'Lateral Esquerda', icon: '◀️', instrucao: 'Fotografe o lado esquerdo completo' },
  { id: 'lateral_dir', label: 'Lateral Direita', icon: '▶️', instrucao: 'Fotografe o lado direito completo' },
  { id: 'interior_frente', label: 'Interior Frente', icon: '🪑', instrucao: 'Fotografe o painel e bancos dianteiros' },
  { id: 'interior_tras', label: 'Interior Traseiro', icon: '🛋️', instrucao: 'Fotografe os bancos traseiros' },
  { id: 'km', label: 'Quilometragem', icon: '📊', instrucao: 'Fotografe o conta-quilómetros claramente' },
  { id: 'combustivel', label: 'Nível Combustível', icon: '⛽', instrucao: 'Fotografe o indicador de combustível' },
];

const TIPOS_DANO = [
  { id: 'risco', label: 'Risco', color: '#f59e0b' },
  { id: 'amolgadela', label: 'Amolgadela', color: '#ef4444' },
  { id: 'vidro_partido', label: 'Vidro Partido', color: '#dc2626' },
  { id: 'falta_peca', label: 'Falta Peça', color: '#7c3aed' },
  { id: 'sujidade', label: 'Sujidade', color: '#6b7280' },
  { id: 'outro', label: 'Outro', color: '#3b82f6' },
];

// Componente do diagrama do carro para marcar danos
const CarDiagram = ({ danos, onAddDano, onRemoveDano }) => {
  const [selectedTipo, setSelectedTipo] = useState('risco');
  
  const handlePress = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const newDano = {
      id: Date.now().toString(),
      x: locationX,
      y: locationY,
      tipo: selectedTipo,
      descricao: ''
    };
    onAddDano(newDano);
  };

  return (
    <View style={styles.diagramContainer}>
      <Text style={styles.diagramTitle}>📍 Toque para marcar danos</Text>
      
      {/* Seletor de tipo de dano */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiposDanoScroll}>
        {TIPOS_DANO.map(tipo => (
          <TouchableOpacity
            key={tipo.id}
            style={[styles.tipoDanoBtn, selectedTipo === tipo.id && { backgroundColor: tipo.color }]}
            onPress={() => setSelectedTipo(tipo.id)}
          >
            <View style={[styles.tipoDanoDot, { backgroundColor: tipo.color }]} />
            <Text style={[styles.tipoDanoText, selectedTipo === tipo.id && { color: '#fff' }]}>{tipo.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Diagrama do carro */}
      <TouchableOpacity 
        style={styles.carDiagramArea}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.carShape}>
          {/* Vista de cima do carro simplificada */}
          <View style={styles.carBody}>
            <View style={styles.carFront} />
            <View style={styles.carMiddle}>
              <Text style={styles.carLabel}>TOPO</Text>
            </View>
            <View style={styles.carRear} />
          </View>
          <Text style={styles.carSideLabel}>ESQ</Text>
          <Text style={[styles.carSideLabel, styles.carSideLabelRight]}>DIR</Text>
        </View>
        
        {/* Marcadores de danos */}
        {danos.map((dano, idx) => {
          const tipoInfo = TIPOS_DANO.find(t => t.id === dano.tipo) || TIPOS_DANO[0];
          return (
            <TouchableOpacity
              key={dano.id}
              style={[styles.danoMarker, { left: dano.x - 12, top: dano.y - 12, backgroundColor: tipoInfo.color }]}
              onPress={() => onRemoveDano(dano.id)}
            >
              <Text style={styles.danoMarkerText}>{idx + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </TouchableOpacity>
      
      {/* Lista de danos */}
      {danos.length > 0 && (
        <View style={styles.danosLista}>
          <Text style={styles.danosListaTitle}>Danos marcados ({danos.length}):</Text>
          {danos.map((dano, idx) => {
            const tipoInfo = TIPOS_DANO.find(t => t.id === dano.tipo) || TIPOS_DANO[0];
            return (
              <View key={dano.id} style={styles.danoItem}>
                <View style={[styles.danoItemDot, { backgroundColor: tipoInfo.color }]} />
                <Text style={styles.danoItemText}>{idx + 1}. {tipoInfo.label}</Text>
                <TouchableOpacity onPress={() => onRemoveDano(dano.id)}>
                  <Text style={styles.danoItemRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const VistoriasScreen = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [vistorias, setVistorias] = useState([]);
  const [showNovaVistoria, setShowNovaVistoria] = useState(false);
  const [vistoriaAtual, setVistoriaAtual] = useState(null);
  const [step, setStep] = useState(0); // 0: selecao motorista, 1: fotos, 2: danos, 3: obs, 4: assinatura, 5: resumo
  const [tipoVistoria, setTipoVistoria] = useState('entrada'); // entrada, saida
  const [fotos, setFotos] = useState({});
  const [danos, setDanos] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [km, setKm] = useState('');
  const [combustivel, setCombustivel] = useState('50');
  const [assinatura, setAssinatura] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Novos estados para seleção de motorista/veículo
  const [motoristas, setMotoristas] = useState([]);
  const [selectedMotorista, setSelectedMotorista] = useState(null);
  const [showMotoristaPicker, setShowMotoristaPicker] = useState(false);

  const loadVistorias = async () => {
    try {
      const data = await api.get('/vistorias/minhas');
      setVistorias(data.vistorias || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadMotoristas = async () => {
    // Carregar motoristas apenas para inspetor/parceiro/gestor
    if (user.role !== 'motorista') {
      try {
        const data = await api.get('/motoristas/meus');
        setMotoristas(data.motoristas || data || []);
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => { 
    loadVistorias(); 
    loadMotoristas();
  }, []);

  const iniciarVistoria = (tipo) => {
    setTipoVistoria(tipo);
    setFotos({});
    setDanos([]);
    setObservacoes('');
    setKm('');
    setCombustivel('50');
    setAssinatura(null);
    setSelectedMotorista(null);
    // Para inspetor/parceiro, começar com seleção de motorista (step 0)
    // Para motorista, ir direto para fotos (step 1)
    setStep(user.role === 'motorista' ? 1 : 0);
    setShowNovaVistoria(true);
  };

  const tirarFoto = async (fotoId) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erro', 'Permissão de câmara necessária'); return; }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      setFotos(prev => ({ ...prev, [fotoId]: result.assets[0] }));
    }
  };

  const fotosCompletas = () => {
    const obrigatorias = ['frente', 'traseira', 'lateral_esq', 'lateral_dir', 'km'];
    return obrigatorias.every(id => fotos[id]);
  };

  const enviarVistoria = async () => {
    if (!fotosCompletas()) { Alert.alert('Erro', 'Complete todas as fotos obrigatórias'); return; }
    if (!km) { Alert.alert('Erro', 'Introduza a quilometragem'); return; }
    // Validar motorista para inspetor/parceiro
    if (user.role !== 'motorista' && !selectedMotorista) {
      Alert.alert('Erro', 'Selecione um motorista');
      return;
    }
    
    setEnviando(true);
    try {
      const fotosBase64 = {};
      Object.keys(fotos).forEach(key => {
        if (fotos[key]?.base64) {
          fotosBase64[key] = fotos[key].base64;
        }
      });

      await api.post('/vistorias/criar', {
        tipo: tipoVistoria,
        fotos: fotosBase64,
        danos: danos,
        km: parseInt(km),
        nivel_combustivel: parseInt(combustivel),
        observacoes: observacoes,
        assinatura: assinatura?.base64 || null,
        motorista_id: selectedMotorista?.id || null,
        veiculo_id: selectedMotorista?.veiculo_atribuido || null
      });
      
      Alert.alert('Sucesso', 'Vistoria enviada com sucesso! O motorista será notificado para confirmar.');
      setShowNovaVistoria(false);
      loadVistorias();
    } catch (e) { 
      Alert.alert('Erro', e.message); 
    }
    setEnviando(false);
  };

  const addDano = (dano) => setDanos(prev => [...prev, dano]);
  const removeDano = (id) => setDanos(prev => prev.filter(d => d.id !== id));

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  // Modal de Nova Vistoria
  if (showNovaVistoria) {
    const minStep = user.role === 'motorista' ? 1 : 0;
    const totalSteps = user.role === 'motorista' ? 5 : 6;
    
    return (
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.vistoriaHeader}>
          <TouchableOpacity onPress={() => { if (step > minStep) setStep(step - 1); else setShowNovaVistoria(false); }}>
            <Text style={styles.vistoriaBack}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.vistoriaHeaderTitle}>
            {tipoVistoria === 'entrada' ? '📥 Vistoria de Entrada' : '📤 Vistoria de Saída'}
          </Text>
          <Text style={styles.vistoriaStep}>Passo {step}/{totalSteps - 1}</Text>
        </View>

        {/* Progresso - Clicável para navegar entre passos */}
        <View style={styles.progressBar}>
          {[...Array(totalSteps - 1)].map((_, i) => {
            const s = minStep + i;
            return (
              <TouchableOpacity 
                key={s} 
                style={[styles.progressDot, s <= step && styles.progressDotActive, s === step && styles.progressDotCurrent]} 
                onPress={() => s < step && setStep(s)}
              >
                <Text style={styles.progressDotText}>{i + 1}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }}>
          {/* Step 0: Seleção de Motorista (apenas para inspetor/parceiro/gestor) */}
          {step === 0 && user.role !== 'motorista' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>👤 Selecionar Motorista</Text>
              <Text style={styles.stepSubtitle}>Escolha o motorista e veículo para a vistoria</Text>
              
              {selectedMotorista ? (
                <View style={styles.selectedMotoristaCard}>
                  <View style={styles.selectedMotoristaInfo}>
                    <Text style={styles.selectedMotoristaName}>{selectedMotorista.name || selectedMotorista.nome}</Text>
                    <Text style={styles.selectedMotoristaEmail}>{selectedMotorista.email}</Text>
                    {selectedMotorista.veiculo_matricula && (
                      <Text style={styles.selectedMotoristaVeiculo}>🚗 {selectedMotorista.veiculo_matricula}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.changeMotoristaBtn}
                    onPress={() => setSelectedMotorista(null)}
                  >
                    <Text style={styles.changeMotoristaBtnText}>Alterar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.motoristasListContainer}>
                  {motoristas.length === 0 ? (
                    <Text style={styles.noMotoristasText}>Nenhum motorista encontrado</Text>
                  ) : (
                    motoristas.map(m => (
                      <TouchableOpacity 
                        key={m.id} 
                        style={styles.motoristaSelectCard}
                        onPress={() => setSelectedMotorista(m)}
                      >
                        <View>
                          <Text style={styles.motoristaSelectName}>{m.name || m.nome}</Text>
                          <Text style={styles.motoristaSelectEmail}>{m.email}</Text>
                        </View>
                        {m.veiculo_matricula && (
                          <Text style={styles.motoristaSelectVeiculo}>🚗 {m.veiculo_matricula}</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              
              {selectedMotorista && (
                <TouchableOpacity style={styles.stepNextBtn} onPress={() => setStep(1)}>
                  <Text style={styles.stepNextBtnText}>Continuar →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Step 1: Fotos */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📷 Fotografar Veículo</Text>
              <Text style={styles.stepSubtitle}>Tire as fotos obrigatórias (*) do veículo</Text>
              
              <View style={styles.fotosGrid}>
                {FOTOS_OBRIGATORIAS.map(foto => {
                  const tirada = fotos[foto.id];
                  const obrigatoria = ['frente', 'traseira', 'lateral_esq', 'lateral_dir', 'km'].includes(foto.id);
                  
                  return (
                    <TouchableOpacity 
                      key={foto.id} 
                      style={[styles.fotoCard, tirada && styles.fotoCardDone]}
                      onPress={() => tirarFoto(foto.id)}
                    >
                      {tirada ? (
                        <Image source={{ uri: tirada.uri }} style={styles.fotoThumb} />
                      ) : (
                        <Text style={styles.fotoIcon}>{foto.icon}</Text>
                      )}
                      <Text style={styles.fotoLabel}>
                        {foto.label}{obrigatoria ? ' *' : ''}
                      </Text>
                      {tirada && <Text style={styles.fotoCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Km e Combustível */}
              <View style={styles.kmCombustivelRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputGroupLabel}>Quilometragem *</Text>
                  <TextInput
                    style={styles.kmInput}
                    value={km}
                    onChangeText={setKm}
                    placeholder="Ex: 45000"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputGroupLabel}>Combustível %</Text>
                  <TextInput
                    style={styles.kmInput}
                    value={combustivel}
                    onChangeText={setCombustivel}
                    placeholder="50"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.nextBtn, !fotosCompletas() && styles.nextBtnDisabled]}
                onPress={() => fotosCompletas() ? setStep(2) : Alert.alert('Atenção', 'Complete as fotos obrigatórias')}
              >
                <Text style={styles.nextBtnText}>Próximo: Marcar Danos →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Danos */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>🔍 Marcar Danos</Text>
              <Text style={styles.stepSubtitle}>Toque no diagrama para marcar danos existentes</Text>
              
              <CarDiagram danos={danos} onAddDano={addDano} onRemoveDano={removeDano} />

              {/* Fotos de danos */}
              {danos.length > 0 && (
                <View style={styles.fotosDanosSection}>
                  <Text style={styles.fotosDanosTitle}>📸 Fotografar cada dano</Text>
                  {danos.map((dano, idx) => {
                    const tipoInfo = TIPOS_DANO.find(t => t.id === dano.tipo);
                    return (
                      <View key={dano.id} style={styles.fotosDanoItem}>
                        <Text style={styles.fotosDanoLabel}>{idx + 1}. {tipoInfo?.label}</Text>
                        <TouchableOpacity 
                          style={styles.fotosDanoBtn}
                          onPress={async () => {
                            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
                            if (!result.canceled) {
                              setDanos(prev => prev.map(d => d.id === dano.id ? { ...d, foto: result.assets[0] } : d));
                            }
                          }}
                        >
                          {dano.foto ? (
                            <Image source={{ uri: dano.foto.uri }} style={styles.fotosDanoThumb} />
                          ) : (
                            <Text style={styles.fotosDanoBtnText}>📷</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Próximo: Observações →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Observações */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📝 Observações</Text>
              <Text style={styles.stepSubtitle}>Adicione notas relevantes sobre o estado do veículo</Text>
              
              <TextInput
                style={styles.obsInput}
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Ex: Veículo limpo, sem danos visíveis no interior. Pneus em bom estado..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)}>
                <Text style={styles.nextBtnText}>Próximo: Assinatura →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 4: Assinatura */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>✍️ Assinatura</Text>
              <Text style={styles.stepSubtitle}>Assine para confirmar a vistoria</Text>
              
              <View style={styles.assinaturaBox}>
                {assinatura ? (
                  <View>
                    <Image source={{ uri: assinatura.uri }} style={styles.assinaturaPreview} />
                    <TouchableOpacity style={styles.assinaturaRedo} onPress={() => setAssinatura(null)}>
                      <Text style={styles.assinaturaRedoText}>🔄 Refazer assinatura</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.assinaturaBtn}
                    onPress={async () => {
                      // Simular assinatura com foto (em produção usaria biblioteca de signature)
                      Alert.alert(
                        'Assinatura',
                        'Em produção, aqui apareceria uma área para desenhar. Por agora, tire uma foto da sua assinatura.',
                        [
                          { text: 'Cancelar' },
                          { text: 'Fotografar', onPress: async () => {
                            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true });
                            if (!result.canceled) setAssinatura(result.assets[0]);
                          }}
                        ]
                      );
                    }}
                  >
                    <Text style={styles.assinaturaBtnIcon}>✍️</Text>
                    <Text style={styles.assinaturaBtnText}>Toque para assinar</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(5)}>
                <Text style={styles.nextBtnText}>Próximo: Resumo →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 5: Resumo */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📋 Resumo da Vistoria</Text>
              <Text style={styles.stepSubtitle}>Confirme os dados antes de enviar</Text>
              
              <View style={styles.resumoCard}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Tipo:</Text>
                  <Text style={styles.resumoValue}>{tipoVistoria === 'entrada' ? '📥 Entrada' : '📤 Saída'}</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Km:</Text>
                  <Text style={styles.resumoValue}>{km} km</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Combustível:</Text>
                  <Text style={styles.resumoValue}>{combustivel}%</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Fotos:</Text>
                  <Text style={styles.resumoValue}>{Object.keys(fotos).length} / {FOTOS_OBRIGATORIAS.length}</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Danos:</Text>
                  <Text style={styles.resumoValue}>{danos.length} marcados</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Assinatura:</Text>
                  <Text style={styles.resumoValue}>{assinatura ? '✓ Assinado' : '✗ Não assinado'}</Text>
                </View>
                {observacoes && (
                  <View style={styles.resumoObs}>
                    <Text style={styles.resumoLabel}>Observações:</Text>
                    <Text style={styles.resumoObsText}>{observacoes}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, enviando && styles.submitBtnDisabled]}
                onPress={enviarVistoria}
                disabled={enviando}
              >
                <Text style={styles.submitBtnText}>
                  {enviando ? '⏳ A enviar...' : '✅ Confirmar e Enviar Vistoria'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Lista de Vistorias
  return (
    <ScrollView 
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadVistorias(); setRefreshing(false); }} />}
    >
      <Text style={styles.screenTitle}>Vistorias</Text>

      {/* Botões Nova Vistoria */}
      <View style={styles.novaVistoriaBtns}>
        <TouchableOpacity style={[styles.novaVistoriaBtn, styles.novaVistoriaBtnEntrada]} onPress={() => iniciarVistoria('entrada')}>
          <Text style={styles.novaVistoriaBtnIcon}>📥</Text>
          <Text style={styles.novaVistoriaBtnText}>Vistoria de Entrada</Text>
          <Text style={styles.novaVistoriaBtnHint}>Ao receber o veículo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.novaVistoriaBtn, styles.novaVistoriaBtnSaida]} onPress={() => iniciarVistoria('saida')}>
          <Text style={styles.novaVistoriaBtnIcon}>📤</Text>
          <Text style={styles.novaVistoriaBtnText}>Vistoria de Saída</Text>
          <Text style={styles.novaVistoriaBtnHint}>Ao devolver o veículo</Text>
        </TouchableOpacity>
      </View>

      {/* Histórico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📜 Histórico de Vistorias</Text>
        {vistorias.length === 0 ? (
          <View style={styles.emptyVistorias}>
            <Text style={styles.emptyVistoriasIcon}>🔍</Text>
            <Text style={styles.emptyVistoriasText}>Sem vistorias registadas</Text>
            <Text style={styles.emptyVistoriasHint}>Faça a sua primeira vistoria acima</Text>
          </View>
        ) : (
          vistorias.map((v, idx) => (
            <TouchableOpacity key={idx} style={styles.vistoriaItem} onPress={() => setVistoriaAtual(v)}>
              <View style={styles.vistoriaItemHeader}>
                <Text style={styles.vistoriaItemTipo}>
                  {v.tipo === 'entrada' ? '📥' : '📤'} {v.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </Text>
                <Text style={styles.vistoriaItemData}>{v.data}</Text>
              </View>
              <View style={styles.vistoriaItemInfo}>
                <Text style={styles.vistoriaItemKm}>🚗 {v.km} km</Text>
                <Text style={styles.vistoriaItemDanos}>
                  {v.total_danos > 0 ? `⚠️ ${v.total_danos} danos` : '✓ Sem danos'}
                </Text>
              </View>
              {/* Estado de aceitação do motorista */}
              <View style={styles.vistoriaAceitacaoStatus}>
                {v.motorista_aceite === true && (
                  <View style={[styles.aceitacaoBadge, { backgroundColor: '#22c55e' }]}>
                    <Text style={styles.aceitacaoBadgeText}>✓ Motorista Aceitou</Text>
                  </View>
                )}
                {v.motorista_aceite === false && (
                  <View style={[styles.aceitacaoBadge, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.aceitacaoBadgeText}>✗ Motorista Rejeitou</Text>
                  </View>
                )}
                {v.motorista_aceite === null || v.motorista_aceite === undefined && (
                  <View style={[styles.aceitacaoBadge, { backgroundColor: '#f59e0b' }]}>
                    <Text style={styles.aceitacaoBadgeText}>⏳ Aguarda Aceitação</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

// ===== CONFIG SCREEN =====
const ConfigScreen = ({ user, onLogout }) => {
  const [defs, setDefs] = useState(null);
  const [horas, setHoras] = useState('10');
  const [espac, setEspac] = useState('24');
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { const d = await api.get('/ponto/definicoes'); setDefs(d); setHoras(String(d.horas_maximas)); setEspac(String(d.espacamento_horas)); setLoading(false); })(); }, []);

  const salvar = async (tipo) => {
    try {
      if (tipo === 'horas') {
        if (!defs.permitir_alterar_horas_maximas) { Alert.alert('Bloqueado', 'O seu parceiro não autorizou esta alteração'); return; }
        await api.post('/ponto/definicoes', { alerta_horas_maximas: parseInt(horas) });
      } else {
        if (!defs.permitir_alterar_espacamento) { Alert.alert('Bloqueado', 'O seu parceiro não autorizou esta alteração'); return; }
        await api.post('/ponto/definicoes', { espacamento_horas: parseInt(espac) });
      }
      Alert.alert('Sucesso', 'Guardado');
    } catch (e) { Alert.alert('Erro', e.message); }
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
        <Text style={styles.cardTitle}>⏱️ Limite de Horas (24h)</Text>
        <Text style={styles.configDesc}>Alerta quando atingir este limite num período de 24h rolante</Text>
        <View style={styles.configRow}>
          <TextInput style={styles.configInput} value={horas} onChangeText={setHoras} keyboardType="numeric" editable={defs?.permitir_alterar_horas_maximas} />
          <Text style={styles.configUnit}>horas</Text>
          {defs?.permitir_alterar_horas_maximas ? (
            <TouchableOpacity style={styles.configSaveBtn} onPress={() => salvar('horas')}><Text style={styles.configSaveBtnText}>Guardar</Text></TouchableOpacity>
          ) : (
            <View style={styles.configLocked}><Text style={styles.configLockedText}>🔒</Text></View>
          )}
        </View>
        {!defs?.permitir_alterar_horas_maximas && <Text style={styles.configHint}>Contacte o parceiro para alterar</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Período de Descanso</Text>
        <Text style={styles.configDesc}>Após atingir o limite, só pode trabalhar novamente após este período</Text>
        <View style={styles.configRow}>
          <TextInput style={styles.configInput} value={espac} onChangeText={setEspac} keyboardType="numeric" editable={defs?.permitir_alterar_espacamento} />
          <Text style={styles.configUnit}>horas</Text>
          {defs?.permitir_alterar_espacamento ? (
            <TouchableOpacity style={styles.configSaveBtn} onPress={() => salvar('espac')}><Text style={styles.configSaveBtnText}>Guardar</Text></TouchableOpacity>
          ) : (
            <View style={styles.configLocked}><Text style={styles.configLockedText}>🔒</Text></View>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Edição de Registos</Text>
        <View style={[styles.configStatus, { backgroundColor: defs?.permitir_edicao_registos ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.configStatusText}>{defs?.permitir_edicao_registos ? '✓ Permitido' : '✗ Bloqueado pelo parceiro'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Terminar Sessão</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ===== GPS POPUP =====
const GPSPopup = ({ visible, type, onYes, onNo, onDoNotDisturb }) => visible ? (
  <Modal visible={visible} animationType="fade" transparent={true}>
    <View style={styles.gpsOverlay}>
      <View style={styles.gpsBox}>
        <Text style={styles.gpsIcon}>{type === 'start' ? '🚗' : '⏸️'}</Text>
        <Text style={styles.gpsTitle}>{type === 'start' ? 'Em movimento!' : 'Parado há 10min'}</Text>
        <Text style={styles.gpsText}>{type === 'start' ? 'Iniciar turno?' : 'Terminar turno?'}</Text>
        <View style={styles.gpsButtons}>
          <TouchableOpacity style={styles.gpsNo} onPress={onNo}><Text style={styles.gpsNoText}>Não</Text></TouchableOpacity>
          <TouchableOpacity style={styles.gpsYes} onPress={onYes}><Text style={styles.gpsYesText}>Sim</Text></TouchableOpacity>
        </View>
        {type === 'stop' && (
          <TouchableOpacity style={styles.dndBtn} onPress={onDoNotDisturb}>
            <Text style={styles.dndText}>🔕 Não incomodar (30 min)</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </Modal>
) : null;

// ===== MAIN APP =====
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('ponto');
  const [status, setStatus] = useState('off');
  const [gps, setGps] = useState({ visible: false, type: null });
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const shown = useRef({ start: false, stop: false });

  const { isMoving } = useGPS(
    status === 'working',
    () => { if (status === 'off' && !shown.current.start) { shown.current.start = true; setGps({ visible: true, type: 'start' }); } },
    () => { 
      // Só mostrar popup de parar se NÃO estiver em modo "não incomodar"
      if (status === 'working' && !shown.current.stop && !doNotDisturb) { 
        shown.current.stop = true; 
        setGps({ visible: true, type: 'stop' }); 
      } 
    }
  );

  const handleGPS = async (confirm) => {
    setGps({ visible: false, type: null });
    if (confirm) {
      if (gps.type === 'start') { await api.post('/ponto/check-in', {}); setStatus('working'); }
      else { await api.post('/ponto/check-out', {}); setStatus('off'); }
    }
    setTimeout(() => { shown.current = { start: false, stop: false }; }, 300000);
  };

  // Ativar modo "não incomodar" por 30 minutos
  const handleDoNotDisturb = () => {
    setGps({ visible: false, type: null });
    setDoNotDisturb(true);
    Alert.alert('Não Incomodar', 'Não será interrompido durante 30 minutos.\n\nÚtil quando está no trânsito.');
    // Desativar após 30 minutos
    setTimeout(() => {
      setDoNotDisturb(false);
      shown.current = { start: false, stop: false };
    }, 30 * 60 * 1000); // 30 minutos
  };

  // Quando user faz login, definir tab inicial baseado no role
  const handleLogin = (u, t) => {
    setUser(u);
    api.setToken(t);
    // Definir tab inicial baseado no role
    if (u.role === 'inspetor') {
      setTab('vistorias');
    } else if (u.role === 'gestao' || u.role === 'parceiro') {
      setTab('vistorias');
    } else {
      setTab('ponto'); // motorista
    }
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  // Determinar título baseado no role
  const getRoleTitle = () => {
    if (user.role === 'inspetor') return '🔍 Inspetor';
    if (user.role === 'gestao') return '👔 Gestor';
    if (user.role === 'parceiro') return '🏢 Parceiro';
    if (doNotDisturb) return '🔕 Não Incomodar';
    return '🚗 Motorista';
  };

  // Renderizar ecrãs baseados no role
  const renderScreen = () => {
    const role = user.role;
    
    // INSPETOR: Apenas vistorias
    if (role === 'inspetor') {
      if (tab === 'vistorias') return <VistoriasScreen user={user} canCreate={true} />;
      return null;
    }
    
    // GESTOR/PARCEIRO: Vistorias, Recibos, Resumo, Extras, Alertas
    if (role === 'gestao' || role === 'parceiro') {
      if (tab === 'vistorias') return <VistoriasScreen user={user} canCreate={true} />;
      if (tab === 'recibos') return <RecibosGestaoScreen user={user} />;
      if (tab === 'resumo') return <ResumoSemanalGestaoScreen user={user} />;
      if (tab === 'extras') return <ExtrasGestaoScreen user={user} />;
      if (tab === 'alertas') return <AlertasGestaoScreen user={user} />;
      return null;
    }
    
    // MOTORISTA: Ponto, Turnos, Ganhos, Tickets (com vistorias pendentes)
    if (tab === 'ponto') return <PontoScreen user={user} status={status} setStatus={setStatus} />;
    if (tab === 'turnos') return <TurnosScreen user={user} />;
    if (tab === 'ganhos') return <GanhosScreen />;
    if (tab === 'tickets') return <TicketsScreen user={user} />;
    return null;
  };

  // Função de logout
  const handleLogout = () => {
    Alert.alert(
      'Terminar Sessão',
      'Tem a certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => {
          api.setToken(null);
          setUser(null);
          setStatus('off');
          setDoNotDisturb(false);
        }}
      ]
    );
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TVDEFleet {getRoleTitle()}</Text>
        <View style={styles.headerRight}>
          {isMoving && <Text style={styles.gpsIndicator}>📍</Text>}
          {doNotDisturb && <Text style={styles.dndIndicator}>🔕</Text>}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>
      <TabBar activeTab={tab} onTabChange={setTab} userRole={user.role} />
      <GPSPopup visible={gps.visible} type={gps.type} onYes={() => handleGPS(true)} onNo={() => handleGPS(false)} onDoNotDisturb={handleDoNotDisturb} />
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  appContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gpsIndicator: { fontSize: 16 },
  dndIndicator: { fontSize: 16 },
  logoutBtn: { padding: 8 },
  logoutIcon: { fontSize: 20 },
  container: { flex: 1, backgroundColor: '#0f172a' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: '#fff' },
  eyeBtn: { padding: 16 },
  eyeIcon: { fontSize: 20 },
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', paddingBottom: 20 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderTopWidth: 2, borderTopColor: '#3b82f6' },
  tabIcon: { fontSize: 20, marginBottom: 4 },
  tabLabel: { fontSize: 11, color: '#64748b' },
  tabLabelActive: { color: '#3b82f6', fontWeight: '600' },
  screen: { flex: 1, padding: 16 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginBottom: 12 },
  info24h: { backgroundColor: '#1e3a5f', padding: 12, borderRadius: 12, marginBottom: 16 },
  info24hText: { color: '#93c5fd', fontSize: 14, textAlign: 'center' },
  info24hAlert: { color: '#fca5a5', fontSize: 12, textAlign: 'center', marginTop: 4 },
  // Timer styles
  timerCard: { backgroundColor: '#22c55e', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  timerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  timerValue: { fontSize: 48, fontWeight: 'bold', color: '#fff', fontVariant: ['tabular-nums'] },
  timerPulse: { position: 'absolute', top: 10, right: 10, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', opacity: 0.8 },
  // Progress bar styles  
  progressCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  progressValue: { flexDirection: 'row', alignItems: 'baseline' },
  progressWorked: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  progressSep: { color: '#64748b', fontSize: 16 },
  progressLimit: { color: '#64748b', fontSize: 16 },
  progressBarBg: { height: 12, backgroundColor: '#0f172a', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressBarNormal: { backgroundColor: '#22c55e' },
  progressBarWarning: { backgroundColor: '#eab308' },
  progressBarDanger: { backgroundColor: '#ef4444' },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressRemaining: { color: '#94a3b8', fontSize: 12 },
  progressAlert: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  blockedAlert: { backgroundColor: '#7f1d1d', padding: 12, borderRadius: 8, marginTop: 12 },
  blockedAlertText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', fontWeight: '600' },
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
  // Week summary styles
  weekSummary: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155', marginBottom: 16 },
  weekMainStat: { flexDirection: 'row', alignItems: 'baseline' },
  weekHours: { fontSize: 56, fontWeight: 'bold', color: '#fff' },
  weekHoursLabel: { fontSize: 24, color: '#94a3b8', marginRight: 4 },
  weekMinutes: { fontSize: 40, fontWeight: 'bold', color: '#94a3b8' },
  weekMinutesLabel: { fontSize: 20, color: '#64748b' },
  weekSubLabel: { color: '#64748b', fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  weekStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  weekStatItem: { alignItems: 'center', flex: 1 },
  weekStatValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  weekStatLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  weekStatDivider: { width: 1, height: 30, backgroundColor: '#334155' },
  viewDayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', padding: 16, borderRadius: 12 },
  viewDayBtnIcon: { fontSize: 20, marginRight: 8 },
  viewDayBtnText: { color: '#fff', fontWeight: '600' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateNavBtn: { fontSize: 24, color: '#3b82f6', padding: 8 },
  dateNavTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  daySummary: { color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  registoItem: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginBottom: 12 },
  registoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  registoHoras: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginRight: 8 },
  registoMatricula: { color: '#94a3b8', fontSize: 12 },
  registoTempo: { color: '#94a3b8' },
  registoEdit: { color: '#f59e0b', fontSize: 12, marginTop: 4 },
  badge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  editBtn: { marginTop: 8, padding: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  timeCol: { flex: 1 },
  timeSep: { color: '#64748b', fontSize: 20, marginHorizontal: 12 },
  timeInput: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, color: '#fff', fontSize: 18, textAlign: 'center' },
  semanaSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  semanaSelectorValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  semanaSelectorArrow: { color: '#64748b' },
  semanaItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  semanaItemActive: { backgroundColor: '#3b82f6', borderRadius: 8 },
  semanaItemLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  ganhoBox: { backgroundColor: '#0f172a', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  ganhoLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  ganhoValor: { fontSize: 36, fontWeight: 'bold' },
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  label: { color: '#94a3b8', fontSize: 14 },
  value: { color: '#fff', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  urgentBtns: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  urgentBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  urgentBtnText: { color: '#fff', fontWeight: 'bold' },
  ticketCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  ticketNumero: { color: '#64748b', fontSize: 12 },
  ticketTitulo: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  backBtn: { color: '#3b82f6', fontSize: 16, padding: 16 },
  message: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 12 },
  messageOwn: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#334155' },
  messageText: { color: '#fff', fontSize: 14 },
  chatInput: { flexDirection: 'row', padding: 16, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  chatTextInput: { flex: 1, backgroundColor: '#334155', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', marginRight: 8 },
  sendBtn: { backgroundColor: '#3b82f6', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profileEmail: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  configDesc: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  configRow: { flexDirection: 'row', alignItems: 'center' },
  configInput: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, color: '#fff', fontSize: 24, fontWeight: 'bold', width: 80, textAlign: 'center' },
  configUnit: { color: '#94a3b8', fontSize: 16, marginLeft: 12, flex: 1 },
  configSaveBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  configSaveBtnText: { color: '#fff', fontWeight: '600' },
  configLocked: { backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  configLockedText: { fontSize: 16 },
  configHint: { color: '#64748b', fontSize: 11, marginTop: 8 },
  configStatus: { padding: 12, borderRadius: 8, alignItems: 'center' },
  configStatusText: { color: '#fff', fontWeight: '600' },
  logoutBtn: { backgroundColor: '#ef4444', padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  logoutBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#64748b', textAlign: 'center', padding: 20 },
  // Secção Tabs (Tickets/Vistorias)
  sectionTabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#1e293b', borderRadius: 12, padding: 4 },
  sectionTab: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  sectionTabActive: { backgroundColor: '#3b82f6' },
  sectionTabText: { color: '#64748b', fontWeight: '600' },
  sectionTabTextActive: { color: '#fff' },
  // Vistorias Pendentes Motorista
  vistoriasPendentesSection: { flex: 1 },
  vistoriasPendentesTitle: { fontSize: 18, fontWeight: 'bold', color: '#f59e0b', marginBottom: 4 },
  vistoriasPendentesSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  vistoriaPendenteCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  vistoriaPendenteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  vistoriaPendenteTipo: { color: '#fff', fontWeight: '600' },
  vistoriaPendenteData: { color: '#64748b', fontSize: 12 },
  vistoriaPendenteVeiculo: { color: '#94a3b8', marginBottom: 4 },
  vistoriaPendenteDanos: { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  vistoriaPendenteAction: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  // Detalhe Vistoria para Aceitar
  vistoriaInfo: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  vistoriaDetalhe: { color: '#fff', fontSize: 14, marginBottom: 4 },
  danoItem: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 8 },
  danoTipo: { color: '#f59e0b', fontWeight: '600', marginBottom: 4 },
  danoDesc: { color: '#94a3b8', fontSize: 13 },
  vistoriaActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtnLarge: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnLargeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  aceitarAviso: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 32 },
  // Estado Aceitação na lista
  vistoriaAceitacaoStatus: { marginTop: 8 },
  aceitacaoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  aceitacaoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  modalCloseBtn: { backgroundColor: '#334155', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalCloseBtnText: { color: '#fff', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#334155' },
  modalBtnConfirm: { backgroundColor: '#3b82f6' },
  modalBtnCancelText: { color: '#94a3b8', fontWeight: '600' },
  modalBtnConfirmText: { color: '#fff', fontWeight: '600' },
  gpsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  gpsBox: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  gpsIcon: { fontSize: 64, marginBottom: 16 },
  gpsTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  gpsText: { fontSize: 16, color: '#94a3b8', marginBottom: 24 },
  gpsButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  gpsNo: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center' },
  gpsNoText: { color: '#94a3b8', fontWeight: '600' },
  gpsYes: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center' },
  gpsYesText: { color: '#fff', fontWeight: '600' },
  dndBtn: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center', width: '100%' },
  dndText: { color: '#94a3b8', fontSize: 13 },
  // Tipo selector styles
  tipoSelector: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tipoBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center', borderWidth: 2, borderColor: '#334155' },
  tipoBtnActive: { borderColor: '#22c55e', backgroundColor: '#22c55e20' },
  tipoBtnPessoalActive: { borderColor: '#f59e0b', backgroundColor: '#f59e0b20' },
  tipoBtnText: { color: '#94a3b8', fontWeight: '600' },
  tipoBtnTextActive: { color: '#fff' },
  tipoHint: { color: '#f59e0b', fontSize: 12, marginBottom: 16, textAlign: 'center' },
  // Registo pessoal styles
  registoItemPessoal: { backgroundColor: '#1c1917', borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  badgePessoal: { backgroundColor: '#f59e0b' },
  registoPessoalNote: { color: '#f59e0b', fontSize: 12 },
  // Recibo styles
  reciboSection: { alignItems: 'center' },
  reciboInfo: { color: '#94a3b8', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  reciboBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  reciboBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reciboStatus: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, width: '100%', justifyContent: 'center' },
  reciboStatusPendente: { backgroundColor: '#78350f' },
  reciboStatusAprovado: { backgroundColor: '#14532d' },
  reciboStatusRejeitado: { backgroundColor: '#7f1d1d' },
  reciboStatusIcon: { fontSize: 24, marginRight: 12 },
  reciboStatusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  reciboMotivo: { color: '#fca5a5', fontSize: 12, marginTop: 8, marginBottom: 12, textAlign: 'center' },
  // Ticket categorias styles
  categoriasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoriaQuick: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  categoriaQuickIcon: { fontSize: 14, marginRight: 6 },
  categoriaQuickLabel: { color: '#fff', fontSize: 12, fontWeight: '500' },
  ticketListTitle: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketCategoria: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ticketCategoriaText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  ticketAnexos: { color: '#64748b', fontSize: 11, marginTop: 4 },
  categoriaSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 14, borderRadius: 12, marginBottom: 12 },
  categoriaSelectorText: { color: '#fff', fontSize: 16 },
  categoriaSelectorArrow: { color: '#64748b' },
  categoriasList: { backgroundColor: '#0f172a', borderRadius: 12, marginBottom: 16, maxHeight: 200 },
  categoriaItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  categoriaItemText: { color: '#fff', fontSize: 14 },
  anexoInfo: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 8 },
  anexoInfoText: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  messageAnexo: { color: '#93c5fd', fontSize: 11, marginTop: 4 },
  // Fotos styles
  fotosSection: { backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 16 },
  fotosSectionDestaque: { borderWidth: 2, borderColor: '#f59e0b', borderStyle: 'dashed' },
  fotosSectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  fotosPreview: { marginBottom: 12 },
  fotoPreviewItem: { position: 'relative', marginRight: 12 },
  fotoPreviewImg: { width: 80, height: 80, borderRadius: 8 },
  fotoRemoveBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fotoRemoveBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  fotoBtns: { flexDirection: 'row', gap: 12 },
  fotoBtn: { flex: 1, backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center' },
  fotoBtnText: { color: '#fff', fontSize: 13 },
  fotoHint: { color: '#f59e0b', fontSize: 11, marginTop: 8, textAlign: 'center' },
  ticketFotosContainer: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, marginBottom: 16 },
  ticketFotosLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  ticketFotoThumb: { width: 100, height: 100, borderRadius: 8, marginRight: 8 },
  // Turnos styles
  turnoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8 },
  turnoDia: { width: 90 },
  turnoDiaText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  turnoHoras: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  turnoHoraText: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
  turnoSep: { color: '#64748b', fontSize: 14, marginHorizontal: 8 },
  turnoVeiculo: { color: '#64748b', fontSize: 11 },
  turnoValidade: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8 },
  semTurnos: { alignItems: 'center', padding: 24 },
  semTurnosIcon: { fontSize: 48, marginBottom: 12 },
  semTurnosText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  semTurnosHint: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  proximoTurno: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  proximoTurnoHoje: { backgroundColor: '#1e3a5f', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8, marginVertical: 4 },
  proximoTurnoDia: {},
  proximoTurnoDiaText: { color: '#94a3b8', fontSize: 13 },
  proximoTurnoHojeText: { color: '#3b82f6', fontWeight: 'bold' },
  proximoTurnoData: { color: '#64748b', fontSize: 11 },
  proximoTurnoHora: { color: '#fff', fontSize: 14, fontWeight: '600' },
  proximoTurnoFolga: { color: '#64748b', fontSize: 13, fontStyle: 'italic' },
  historicoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  historicoPeriodo: { color: '#94a3b8', fontSize: 13 },
  historicoResumo: { color: '#64748b', fontSize: 12 },
  // ===== VISTORIAS STYLES =====
  novaVistoriaBtns: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  novaVistoriaBtn: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center' },
  novaVistoriaBtnEntrada: { backgroundColor: '#166534' },
  novaVistoriaBtnSaida: { backgroundColor: '#1e40af' },
  novaVistoriaBtnIcon: { fontSize: 32, marginBottom: 8 },
  novaVistoriaBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  novaVistoriaBtnHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },
  emptyVistorias: { alignItems: 'center', padding: 32 },
  emptyVistoriasIcon: { fontSize: 48, marginBottom: 12, opacity: 0.5 },
  emptyVistoriasText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  emptyVistoriasHint: { color: '#64748b', fontSize: 12, marginTop: 4 },
  vistoriaItem: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, marginBottom: 8 },
  vistoriaItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  vistoriaItemTipo: { color: '#fff', fontSize: 14, fontWeight: '600' },
  vistoriaItemData: { color: '#64748b', fontSize: 12 },
  vistoriaItemInfo: { flexDirection: 'row', gap: 16 },
  vistoriaItemKm: { color: '#94a3b8', fontSize: 13 },
  vistoriaItemDanos: { color: '#94a3b8', fontSize: 13 },
  // Vistoria Modal
  vistoriaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1e293b' },
  vistoriaBack: { color: '#3b82f6', fontSize: 16 },
  vistoriaHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  vistoriaStep: { color: '#64748b', fontSize: 12 },
  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#1e293b' },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: '#22c55e' },
  progressDotCurrent: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
  progressDotText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  stepContent: { padding: 16 },
  stepTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  stepSubtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  // Seleção de Motorista
  selectedMotoristaCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderWidth: 2, borderColor: '#22c55e' },
  selectedMotoristaInfo: { flex: 1 },
  selectedMotoristaName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  selectedMotoristaEmail: { color: '#94a3b8', fontSize: 13 },
  selectedMotoristaVeiculo: { color: '#3b82f6', fontSize: 13, marginTop: 4 },
  changeMotoristaBtn: { backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  changeMotoristaBtnText: { color: '#fff', fontSize: 13 },
  motoristasListContainer: { gap: 8 },
  motoristaSelectCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  motoristaSelectName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  motoristaSelectEmail: { color: '#64748b', fontSize: 12 },
  motoristaSelectVeiculo: { color: '#3b82f6', fontSize: 13 },
  noMotoristasText: { color: '#64748b', textAlign: 'center', padding: 40 },
  stepNextBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  stepNextBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Fotos Grid
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  fotoCard: { width: (SCREEN_WIDTH - 56) / 2, height: 100, backgroundColor: '#1e293b', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed' },
  fotoCardDone: { borderColor: '#22c55e', borderStyle: 'solid' },
  fotoIcon: { fontSize: 28, marginBottom: 4 },
  fotoThumb: { width: '100%', height: '100%', borderRadius: 10 },
  fotoLabel: { color: '#94a3b8', fontSize: 11, textAlign: 'center', position: 'absolute', bottom: 6 },
  fotoCheck: { position: 'absolute', top: 6, right: 6, color: '#22c55e', fontSize: 16 },
  kmCombustivelRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  inputGroup: { flex: 1 },
  inputGroupLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  kmInput: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, textAlign: 'center' },
  nextBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#334155' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Diagrama Danos
  diagramContainer: { marginBottom: 20 },
  diagramTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  tiposDanoScroll: { marginBottom: 12 },
  tipoDanoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 8 },
  tipoDanoDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  tipoDanoText: { color: '#94a3b8', fontSize: 12 },
  carDiagramArea: { height: 200, backgroundColor: '#1e293b', borderRadius: 12, position: 'relative', overflow: 'hidden' },
  carShape: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carBody: { width: 100, height: 160, backgroundColor: '#334155', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  carFront: { position: 'absolute', top: 0, width: 60, height: 30, backgroundColor: '#475569', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  carMiddle: { alignItems: 'center', justifyContent: 'center' },
  carLabel: { color: '#64748b', fontSize: 10 },
  carRear: { position: 'absolute', bottom: 0, width: 70, height: 25, backgroundColor: '#475569', borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
  carSideLabel: { position: 'absolute', left: 20, top: '50%', color: '#64748b', fontSize: 10 },
  carSideLabelRight: { left: 'auto', right: 20 },
  danoMarker: { position: 'absolute', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  danoMarkerText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  danosLista: { marginTop: 12 },
  danosListaTitle: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  danoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  danoItemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  danoItemText: { color: '#fff', fontSize: 13, flex: 1 },
  danoItemRemove: { color: '#ef4444', fontSize: 14, padding: 4 },
  fotosDanosSection: { marginTop: 16 },
  fotosDanosTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  fotosDanoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fotosDanoLabel: { color: '#fff', fontSize: 13 },
  fotosDanoBtn: { width: 60, height: 60, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fotosDanoBtnText: { fontSize: 24 },
  fotosDanoThumb: { width: 60, height: 60, borderRadius: 8 },
  // Observações
  obsInput: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, color: '#fff', fontSize: 14, minHeight: 160, marginBottom: 20 },
  // Assinatura
  assinaturaBox: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, minHeight: 200, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  assinaturaBtn: { alignItems: 'center' },
  assinaturaBtnIcon: { fontSize: 48, marginBottom: 12 },
  assinaturaBtnText: { color: '#94a3b8', fontSize: 14 },
  assinaturaPreview: { width: 200, height: 100, borderRadius: 8 },
  assinaturaRedo: { marginTop: 12, alignItems: 'center' },
  assinaturaRedoText: { color: '#3b82f6', fontSize: 14 },
  // Resumo
  resumoCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  resumoLabel: { color: '#94a3b8', fontSize: 14 },
  resumoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resumoObs: { marginTop: 12 },
  resumoObsText: { color: '#fff', fontSize: 13, marginTop: 8 },
  submitBtn: { backgroundColor: '#22c55e', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#334155' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Estilos Gestor/Parceiro
  filtrosRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  filtroBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  filtroBtnActive: { backgroundColor: '#3b82f6' },
  filtroBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filtroBtnTextActive: { color: '#fff' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 },
  reciboHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reciboSemana: { color: '#64748b', fontSize: 12 },
  reciboActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnApprove: { backgroundColor: '#22c55e' },
  actionBtnReject: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: '600' },
  semanaBtn: { padding: 12, backgroundColor: '#334155', borderRadius: 8 },
  semanaBtnText: { color: '#fff', fontSize: 18 },
  semanaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  estadoRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  estadoLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  estadoBtns: { flexDirection: 'row', gap: 8 },
  estadoBtn: { flex: 1, padding: 8, borderRadius: 6, backgroundColor: '#334155', alignItems: 'center' },
  estadoBtnActive: { backgroundColor: '#3b82f6' },
  estadoBtnText: { color: '#64748b', fontSize: 12 },
  estadoBtnTextActive: { color: '#fff' },
  motoristaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipoSelector: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tipoBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
  tipoBtnDebito: { backgroundColor: '#ef4444' },
  tipoBtnCredito: { backgroundColor: '#22c55e' },
  tipoBtnText: { color: '#fff', fontWeight: '600' },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { color: '#fff', fontWeight: '600' },
  cardAlerta: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  alertaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  alertaIcon: { fontSize: 24 },
  alertaPrioridade: { color: '#ef4444', fontSize: 10, fontWeight: 'bold', backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  alertaMotorista: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  alertaData: { color: '#f59e0b', fontSize: 12, marginTop: 4 },
});
