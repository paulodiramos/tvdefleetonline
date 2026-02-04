// TVDEFleet Drivers - App Móvel v5
// COM: Período 24h rolante, permissões parceiro, matrícula opcional
// Cole este código em https://snack.expo.dev

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, Platform, KeyboardAvoidingView, Vibration
} from 'react-native';
import * as Location from 'expo-location';

const API_URL = 'https://fleetmanager-38.preview.emergentagent.com/api';

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
  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erro', 'Preencha os campos'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.access_token) { api.setToken(data.access_token); onLogin(data.user, data.access_token); }
      else Alert.alert('Erro', data.detail || 'Credenciais inválidas');
    } catch (e) { Alert.alert('Erro', 'Falha na ligação'); }
    setLoading(false);
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
const TabBar = ({ activeTab, onTabChange }) => (
  <View style={styles.tabBar}>
    {[{ id: 'ponto', icon: '⏱️', label: 'Ponto' }, { id: 'ganhos', icon: '💰', label: 'Ganhos' }, { id: 'tickets', icon: '🎫', label: 'Suporte' }, { id: 'config', icon: '⚙️', label: 'Config' }].map(t => (
      <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.tabActive]} onPress={() => onTabChange(t.id)}>
        <Text style={styles.tabIcon}>{t.icon}</Text>
        <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

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
                <View key={idx} style={styles.registoItem}>
                  <View style={styles.registoHeader}>
                    <Text style={styles.registoHoras}>{reg.hora_inicio} - {reg.hora_fim}</Text>
                    {reg.editado && <View style={styles.badge}><Text style={styles.badgeText}>Editado</Text></View>}
                    {reg.matricula && <Text style={styles.registoMatricula}>🚗 {reg.matricula}</Text>}
                  </View>
                  <Text style={styles.registoTempo}>{reg.tempo_trabalho_formatado}</Text>
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

// ===== GANHOS SCREEN =====
const GanhosScreen = () => {
  const [semanas, setSemanas] = useState([]);
  const [sel, setSel] = useState(null);
  const [ganhos, setGanhos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { (async () => { const d = await api.get('/ponto/semanas-disponiveis?num_semanas=12'); setSemanas(d.semanas); if (d.semanas.length) setSel(d.semanas[0]); })(); }, []);
  useEffect(() => { if (sel) { setLoading(true); (async () => { const g = await api.get(`/ponto/ganhos-semana?semana=${sel.semana}&ano=${sel.ano}`); setGanhos(g); setLoading(false); })(); } }, [sel]);

  if (loading && !ganhos) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.screenTitle}>Ganhos</Text>
      <TouchableOpacity style={styles.semanaSelector} onPress={() => setShowModal(true)}>
        <Text style={styles.semanaSelectorValue}>{sel?.label}</Text>
        <Text style={styles.semanaSelectorArrow}>▼</Text>
      </TouchableOpacity>
      {ganhos && (
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
const TicketsScreen = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: '', categoria: 'outro', descricao: '' });
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { (async () => { setTickets(await api.get('/tickets/meus')); setLoading(false); })(); }, []);

  const criar = async () => {
    if (!form.titulo || !form.descricao) { Alert.alert('Erro', 'Preencha os campos'); return; }
    await api.post('/tickets/criar', form);
    setModal(false);
    setTickets(await api.get('/tickets/meus'));
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (sel) return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <TouchableOpacity onPress={() => setSel(null)}><Text style={styles.backBtn}>← #{sel.numero}</Text></TouchableOpacity>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {sel.mensagens?.map((m, i) => (
          <View key={i} style={[styles.message, m.autor_id === user.id ? styles.messageOwn : styles.messageOther]}>
            <Text style={styles.messageText}>{m.conteudo}</Text>
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

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Suporte</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}><Text style={styles.addBtnText}>+ Novo</Text></TouchableOpacity>
      </View>
      <View style={styles.urgentBtns}>
        <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: '#dc2626' }]} onPress={() => { setForm({ titulo: 'Acidente', categoria: 'acidente', descricao: '' }); setModal(true); }}>
          <Text style={styles.urgentBtnText}>🚨 Acidente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: '#d97706' }]} onPress={() => { setForm({ titulo: 'Avaria', categoria: 'avaria', descricao: '' }); setModal(true); }}>
          <Text style={styles.urgentBtnText}>🔧 Avaria</Text>
        </TouchableOpacity>
      </View>
      <ScrollView>
        {tickets.map(t => (
          <TouchableOpacity key={t.id} style={styles.ticketCard} onPress={() => setSel(t)}>
            <Text style={styles.ticketNumero}>#{t.numero}</Text>
            <Text style={styles.ticketTitulo}>{t.titulo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal visible={modal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Ticket</Text>
            <TextInput style={styles.input} placeholder="Título" placeholderTextColor="#64748b" value={form.titulo} onChangeText={t => setForm({...form, titulo: t})} />
            <TextInput style={[styles.input, { height: 100 }]} placeholder="Descrição..." placeholderTextColor="#64748b" value={form.descricao} onChangeText={t => setForm({...form, descricao: t})} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModal(false)}><Text style={styles.modalBtnCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={criar}><Text style={styles.modalBtnConfirmText}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
const GPSPopup = ({ visible, type, onYes, onNo }) => visible ? (
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
  const shown = useRef({ start: false, stop: false });

  const { isMoving } = useGPS(
    status === 'working',
    () => { if (status === 'off' && !shown.current.start) { shown.current.start = true; setGps({ visible: true, type: 'start' }); } },
    () => { if (status === 'working' && !shown.current.stop) { shown.current.stop = true; setGps({ visible: true, type: 'stop' }); } }
  );

  const handleGPS = async (confirm) => {
    setGps({ visible: false, type: null });
    if (confirm) {
      if (gps.type === 'start') { await api.post('/ponto/check-in', {}); setStatus('working'); }
      else { await api.post('/ponto/check-out', {}); setStatus('off'); }
    }
    setTimeout(() => { shown.current = { start: false, stop: false }; }, 300000);
  };

  if (!user) return <LoginScreen onLogin={(u, t) => { setUser(u); api.setToken(t); }} />;

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TVDEFleet</Text>
        {isMoving && <Text>📍</Text>}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'ponto' && <PontoScreen user={user} status={status} setStatus={setStatus} />}
        {tab === 'ganhos' && <GanhosScreen />}
        {tab === 'tickets' && <TicketsScreen user={user} />}
        {tab === 'config' && <ConfigScreen user={user} onLogout={() => { setUser(null); api.setToken(null); }} />}
      </View>
      <TabBar activeTab={tab} onTabChange={setTab} />
      <GPSPopup visible={gps.visible} type={gps.type} onYes={() => handleGPS(true)} onNo={() => handleGPS(false)} />
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  appContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
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
});
