// TVDEFleet Drivers - App Móvel v3
// COM: GPS Movement Detection + Tickets Acidente/Avaria com Fotos
// Cole este código em https://snack.expo.dev

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, Platform, KeyboardAvoidingView, Image, AppState
} from 'react-native';
import * as Location from 'expo-location';

const API_URL = 'https://fleetmanager-37.preview.emergentagent.com/api';

// ===== CONFIG GPS =====
const GPS_CONFIG = {
  SPEED_THRESHOLD: 5,        // km/h - velocidade mínima para considerar "em movimento"
  STATIONARY_TIME: 10 * 60 * 1000, // 10 minutos em milissegundos
  UPDATE_INTERVAL: 30 * 1000,      // Verificar a cada 30 segundos
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

// ===== GPS MOVEMENT HOOK =====
const useGPSMovement = (isWorking, onStartMoving, onStationary) => {
  const [location, setLocation] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const lastMovementTime = useRef(Date.now());
  const watchRef = useRef(null);
  const stationaryCheckRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('GPS permission denied');
          return;
        }

        // Watch position
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: GPS_CONFIG.UPDATE_INTERVAL,
            distanceInterval: 50, // metros
          },
          (newLocation) => {
            if (!mounted) return;
            
            const speed = (newLocation.coords.speed || 0) * 3.6; // m/s to km/h
            setLocation(newLocation);
            
            if (speed >= GPS_CONFIG.SPEED_THRESHOLD) {
              // Em movimento
              setIsMoving(true);
              lastMovementTime.current = Date.now();
              
              // Se não está a trabalhar e está em movimento, mostrar popup
              if (!isWorking) {
                onStartMoving?.();
              }
            } else {
              setIsMoving(false);
            }
          }
        );

        // Check for stationary
        stationaryCheckRef.current = setInterval(() => {
          if (!mounted) return;
          
          const timeSinceMovement = Date.now() - lastMovementTime.current;
          
          // Se está a trabalhar e parado há mais de 10 minutos
          if (isWorking && timeSinceMovement >= GPS_CONFIG.STATIONARY_TIME) {
            onStationary?.();
            lastMovementTime.current = Date.now(); // Reset para não mostrar popup repetidamente
          }
        }, 60 * 1000); // Verificar a cada minuto

      } catch (error) {
        console.error('GPS Error:', error);
      }
    };

    startTracking();

    return () => {
      mounted = false;
      if (watchRef.current) {
        watchRef.current.remove();
      }
      if (stationaryCheckRef.current) {
        clearInterval(stationaryCheckRef.current);
      }
    };
  }, [isWorking]);

  return { location, isMoving };
};

// ===== LOGIN SCREEN =====
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha email e password');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        api.setToken(data.access_token);
        onLogin(data.user, data.access_token);
      } else {
        Alert.alert('Erro', data.detail || 'Credenciais inválidas');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na ligação ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.loginBox}>
        <Text style={styles.title}>🚗 TVDEFleet</Text>
        <Text style={styles.subtitle}>Área do Motorista</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.btn, loading && styles.btnDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
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
    { id: 'documentos', label: 'Docs', icon: '📄' },
    { id: 'tickets', label: 'Suporte', icon: '🎫' },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          onPress={() => onTabChange(tab.id)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ===== PONTO SCREEN =====
const PontoScreen = ({ user, status, setStatus, onCheckIn, onCheckOut }) => {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const estado = await api.get('/ponto/estado-atual');
      if (estado.ativo) {
        setStatus(estado.em_pausa ? 'paused' : 'working');
      } else {
        setStatus('off');
      }
      
      const resumoData = await api.get('/ponto/resumo-semanal');
      setResumo(resumoData);
      
      const hist = await api.get('/ponto/historico');
      setHistorico(hist.slice(0, 5));
    } catch (e) {
      console.error('Erro:', e);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePonto = async (action) => {
    try {
      setLoading(true);
      
      if (action === 'checkin') {
        await api.post('/ponto/check-in', {});
        setStatus('working');
        onCheckIn?.();
        Alert.alert('Sucesso', 'Check-in registado!');
      } else if (action === 'pause') {
        await api.post('/ponto/pausa', { tipo: 'iniciar' });
        setStatus('paused');
        Alert.alert('Sucesso', 'Pausa iniciada');
      } else if (action === 'resume') {
        await api.post('/ponto/pausa', { tipo: 'retomar' });
        setStatus('working');
        Alert.alert('Sucesso', 'Pausa terminada');
      } else if (action === 'checkout') {
        const result = await api.post('/ponto/check-out', {});
        setStatus('off');
        onCheckOut?.();
        const horas = Math.floor(result.tempo_trabalho_minutos / 60);
        const mins = result.tempo_trabalho_minutos % 60;
        Alert.alert('Check-out', `Tempo trabalhado: ${horas}h ${mins}m`);
      }
      
      await loadData();
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutos = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.screenTitle}>Relógio de Ponto</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado Atual</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusIcon}>
            {status === 'off' ? '⚪' : status === 'working' ? '🟢' : '🟡'}
          </Text>
          <Text style={styles.statusText}>
            {status === 'off' ? 'Offline' : status === 'working' ? 'A trabalhar' : 'Em pausa'}
          </Text>
        </View>
        
        <View style={styles.buttonGroup}>
          {status === 'off' && (
            <TouchableOpacity style={[styles.actionBtn, styles.btnGreen]} onPress={() => handlePonto('checkin')} disabled={loading}>
              <Text style={styles.actionBtnText}>▶️ Check-in</Text>
            </TouchableOpacity>
          )}
          
          {status === 'working' && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.btnYellow]} onPress={() => handlePonto('pause')} disabled={loading}>
                <Text style={styles.actionBtnText}>⏸️ Pausa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnRed]} onPress={() => handlePonto('checkout')} disabled={loading}>
                <Text style={styles.actionBtnText}>⏹️ Check-out</Text>
              </TouchableOpacity>
            </>
          )}
          
          {status === 'paused' && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen]} onPress={() => handlePonto('resume')} disabled={loading}>
                <Text style={styles.actionBtnText}>▶️ Retomar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnRed]} onPress={() => handlePonto('checkout')} disabled={loading}>
                <Text style={styles.actionBtnText}>⏹️ Check-out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {resumo && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Esta Semana</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatMinutos(resumo.total_minutos)}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{resumo.total_turnos}</Text>
              <Text style={styles.statLabel}>Turnos</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{resumo.dias_trabalhados}</Text>
              <Text style={styles.statLabel}>Dias</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Últimos Registos</Text>
        {historico.length === 0 ? (
          <Text style={styles.emptyText}>Sem registos</Text>
        ) : (
          historico.map((reg, idx) => (
            <View key={idx} style={styles.historyItem}>
              <Text style={styles.historyDate}>{new Date(reg.check_in).toLocaleDateString('pt-PT')}</Text>
              <Text style={styles.historyTime}>
                {reg.tempo_trabalho_minutos ? formatMinutos(reg.tempo_trabalho_minutos) : 'Em curso'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

// ===== GANHOS SCREEN =====
const GanhosScreen = ({ user }) => {
  const [semanas, setSemanas] = useState([]);
  const [selectedSemana, setSelectedSemana] = useState(null);
  const [ganhos, setGanhos] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSemanaModal, setShowSemanaModal] = useState(false);

  const loadSemanas = async () => {
    try {
      const data = await api.get('/ponto/semanas-disponiveis?num_semanas=12');
      setSemanas(data.semanas);
      if (data.semanas.length > 0 && !selectedSemana) {
        setSelectedSemana(data.semanas[0]);
      }
    } catch (e) { console.error('Erro:', e); }
  };

  const loadGanhos = async (semana, ano) => {
    try {
      setLoading(true);
      const data = await api.get(`/ponto/ganhos-semana?semana=${semana}&ano=${ano}`);
      setGanhos(data);
      const reciboData = await api.get(`/ponto/recibo-semanal/${semana}/${ano}`);
      setRecibo(reciboData.recibo);
    } catch (e) { console.error('Erro:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSemanas(); }, []);
  useEffect(() => { if (selectedSemana) loadGanhos(selectedSemana.semana, selectedSemana.ano); }, [selectedSemana]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedSemana) await loadGanhos(selectedSemana.semana, selectedSemana.ano);
    setRefreshing(false);
  };

  const handleUploadRecibo = () => {
    if (recibo) {
      Alert.alert('Recibo Existente', `Já existe um recibo para esta semana.\n\nEnviado em: ${new Date(recibo.created_at).toLocaleDateString('pt-PT')}\n\nPara alterar, contacte o seu parceiro ou gestor.`);
      return;
    }
    Alert.alert('Upload de Recibo', `Para carregar o recibo da ${selectedSemana.label}, use a versão web.`, [{ text: 'OK' }]);
  };

  if (loading && !ganhos) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.screenTitle}>Ganhos e Relatórios</Text>
      
      <TouchableOpacity style={styles.semanaSelector} onPress={() => setShowSemanaModal(true)}>
        <View>
          <Text style={styles.semanaSelectorLabel}>Semana selecionada</Text>
          <Text style={styles.semanaSelectorValue}>{selectedSemana ? selectedSemana.label : 'Selecionar...'}</Text>
          {selectedSemana && <Text style={styles.semanaSelectorPeriodo}>{selectedSemana.periodo}</Text>}
        </View>
        <Text style={styles.semanaSelectorArrow}>▼</Text>
      </TouchableOpacity>

      {ganhos && (
        <View style={styles.card}>
          <View style={styles.ganhoBox}>
            <Text style={styles.ganhoLabel}>Valor Líquido</Text>
            <Text style={[styles.ganhoValor, ganhos.valor_liquido >= 0 ? styles.positive : styles.negative]}>
              €{ganhos.valor_liquido.toFixed(2)}
            </Text>
          </View>
          
          <TouchableOpacity style={[styles.reciboBtn, recibo ? styles.reciboBtnExiste : styles.reciboBtnNovo]} onPress={handleUploadRecibo}>
            <Text style={styles.reciboBtnIcon}>{recibo ? '✓' : '📤'}</Text>
            <Text style={styles.reciboBtnText}>{recibo ? 'Recibo Enviado' : 'Enviar Recibo'}</Text>
          </TouchableOpacity>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Ganhos</Text>
            <View style={styles.row}><Text style={styles.label}>Uber</Text><Text style={styles.value}>€{ganhos.ganhos.uber.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Bolt</Text><Text style={styles.value}>€{ganhos.ganhos.bolt.toFixed(2)}</Text></View>
            <View style={[styles.row, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>€{ganhos.ganhos.total.toFixed(2)}</Text></View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📉 Despesas</Text>
            <View style={styles.row}><Text style={styles.label}>Via Verde</Text><Text style={styles.value}>€{ganhos.despesas.via_verde.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Combustível</Text><Text style={styles.value}>€{ganhos.despesas.combustivel.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Aluguer</Text><Text style={styles.value}>€{ganhos.despesas.aluguer.toFixed(2)}</Text></View>
            <View style={[styles.row, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={[styles.totalValue, styles.negative]}>€{ganhos.despesas.total.toFixed(2)}</Text></View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏱️ Horas</Text>
            <View style={styles.row}><Text style={styles.label}>Total</Text><Text style={styles.value}>{ganhos.horas_trabalhadas.formatado}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Turnos</Text><Text style={styles.value}>{ganhos.horas_trabalhadas.total_turnos}</Text></View>
          </View>
        </View>
      )}

      <Modal visible={showSemanaModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Semana</Text>
            <ScrollView style={styles.semanaList}>
              {semanas.map((s) => (
                <TouchableOpacity
                  key={`${s.semana}-${s.ano}`}
                  style={[styles.semanaItem, selectedSemana?.semana === s.semana && selectedSemana?.ano === s.ano && styles.semanaItemActive]}
                  onPress={() => { setSelectedSemana(s); setShowSemanaModal(false); }}
                >
                  <Text style={[styles.semanaItemLabel, selectedSemana?.semana === s.semana && styles.semanaItemLabelActive]}>{s.label}</Text>
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

// ===== DOCUMENTOS SCREEN =====
const DocumentosScreen = ({ user }) => {
  const [documentos, setDocumentos] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tiposDocumentos = {
    recibo: { nome: 'Recibo de Vencimento', icon: '🧾' },
    registo_criminal: { nome: 'Registo Criminal', icon: '📋' },
    carta_conducao: { nome: 'Carta de Condução', icon: '🪪' },
    certificado_tvde: { nome: 'Certificado TVDE', icon: '🎓' },
    cc_cidadao: { nome: 'Cartão de Cidadão', icon: '🆔' },
    iban: { nome: 'Comprovativo IBAN', icon: '🏦' }
  };

  const loadData = async () => {
    try {
      const data = await api.get('/documentos-motorista/meus');
      setDocumentos(data.documentos_ativos || {});
    } catch (e) { console.error('Erro:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>
      <Text style={styles.screenTitle}>Meus Documentos</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documentos Obrigatórios</Text>
        {Object.entries(tiposDocumentos).map(([tipo, info]) => {
          const doc = documentos[tipo];
          return (
            <View key={tipo} style={styles.docItem}>
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>{info.icon}</Text>
                <View>
                  <Text style={styles.docNome}>{info.nome}</Text>
                  <Text style={[styles.docStatus, doc ? (doc.validado ? styles.statusOk : styles.statusPending) : styles.statusMissing]}>
                    {doc ? (doc.validado ? '✓ Validado' : '⏳ Aguarda validação') : '❌ Não enviado'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

// ===== TICKETS SCREEN (COM ACIDENTE/AVARIA E FOTOS) =====
const TicketsScreen = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [novoTicket, setNovoTicket] = useState({ titulo: '', categoria: 'outro', descricao: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');

  const categorias = [
    { id: 'acidente', nome: '🚨 Acidente', urgente: true, requerFotos: true },
    { id: 'avaria', nome: '🔧 Avaria', urgente: true, requerFotos: true },
    { id: 'problema_tecnico', nome: 'Problema Técnico' },
    { id: 'pagamentos', nome: 'Pagamentos' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'veiculo', nome: 'Veículo' },
    { id: 'contrato', nome: 'Contrato' },
    { id: 'outro', nome: 'Outro' }
  ];

  const statusColors = {
    aberto: '#22c55e', em_analise: '#3b82f6', a_processar: '#8b5cf6',
    aguardar_resposta: '#f59e0b', resolvido: '#6b7280', fechado: '#374151'
  };

  const loadData = async () => {
    try {
      const data = await api.get('/tickets/meus');
      setTickets(data);
    } catch (e) { console.error('Erro:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const criarTicket = async () => {
    if (!novoTicket.titulo || !novoTicket.descricao) {
      Alert.alert('Erro', 'Preencha título e descrição');
      return;
    }
    
    const categoria = categorias.find(c => c.id === novoTicket.categoria);
    
    if (categoria?.requerFotos) {
      Alert.alert(
        '📸 Fotos Obrigatórias',
        `Para tickets de ${categoria.nome}, é obrigatório adicionar fotos após criar o ticket.\n\nO ticket será criado como URGENTE.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Criar e Adicionar Fotos', onPress: async () => {
            try {
              const result = await api.post('/tickets/criar', novoTicket);
              Alert.alert('Sucesso', `Ticket #${result.numero} criado!\n\nAgora adicione fotos do ${categoria.nome.toLowerCase()}.`);
              setModalVisible(false);
              setNovoTicket({ titulo: '', categoria: 'outro', descricao: '' });
              loadData();
            } catch (e) { Alert.alert('Erro', e.message); }
          }}
        ]
      );
      return;
    }
    
    try {
      await api.post('/tickets/criar', novoTicket);
      Alert.alert('Sucesso', 'Ticket criado!');
      setModalVisible(false);
      setNovoTicket({ titulo: '', categoria: 'outro', descricao: '' });
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim()) return;
    try {
      await api.post(`/tickets/${selectedTicket.id}/mensagem`, { conteudo: novaMensagem });
      setNovaMensagem('');
      const updated = await api.get(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated);
      loadData();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const adicionarFoto = () => {
    Alert.alert(
      '📸 Adicionar Foto',
      'Para adicionar fotos ao ticket, use a versão web da aplicação ou aguarde a próxima atualização com suporte a câmara.',
      [{ text: 'OK' }]
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (selectedTicket) {
    const isAcidenteAvaria = ['acidente', 'avaria'].includes(selectedTicket.categoria);
    
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedTicket(null)}>
            <Text style={styles.backBtn}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.chatTitle}>#{selectedTicket.numero}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedTicket.status] }]}>
            <Text style={styles.statusBadgeText}>{selectedTicket.status}</Text>
          </View>
        </View>
        
        {isAcidenteAvaria && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentBannerText}>
              {selectedTicket.categoria === 'acidente' ? '🚨 ACIDENTE' : '🔧 AVARIA'} - URGENTE
            </Text>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={adicionarFoto}>
              <Text style={styles.addPhotoBtnText}>📷 Adicionar Fotos ({selectedTicket.fotos?.length || 0})</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <ScrollView style={styles.chatMessages}>
          {selectedTicket.mensagens?.map((msg, idx) => (
            <View key={idx} style={[styles.message, msg.autor_id === user.id ? styles.messageOwn : styles.messageOther]}>
              <Text style={styles.messageAuthor}>{msg.autor_nome}</Text>
              <Text style={styles.messageText}>{msg.conteudo}</Text>
              <Text style={styles.messageTime}>{new Date(msg.created_at).toLocaleString('pt-PT')}</Text>
            </View>
          ))}
        </ScrollView>
        
        {selectedTicket.status !== 'fechado' && (
          <View style={styles.chatInput}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Escreva uma mensagem..."
              placeholderTextColor="#64748b"
              value={novaMensagem}
              onChangeText={setNovaMensagem}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={enviarMensagem}>
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
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>
      
      {/* Botões rápidos para Acidente/Avaria */}
      <View style={styles.urgentButtons}>
        <TouchableOpacity 
          style={styles.urgentBtn}
          onPress={() => { setNovoTicket({ titulo: 'Acidente de Viação', categoria: 'acidente', descricao: '' }); setModalVisible(true); }}
        >
          <Text style={styles.urgentBtnIcon}>🚨</Text>
          <Text style={styles.urgentBtnText}>Acidente</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.urgentBtn, styles.urgentBtnAvaria]}
          onPress={() => { setNovoTicket({ titulo: 'Avaria do Veículo', categoria: 'avaria', descricao: '' }); setModalVisible(true); }}
        >
          <Text style={styles.urgentBtnIcon}>🔧</Text>
          <Text style={styles.urgentBtnText}>Avaria</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>
        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={styles.emptyText}>Sem tickets</Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TouchableOpacity key={ticket.id} style={styles.ticketCard} onPress={() => setSelectedTicket(ticket)}>
              <View style={styles.ticketHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {['acidente', 'avaria'].includes(ticket.categoria) && (
                    <Text style={{ marginRight: 6 }}>{ticket.categoria === 'acidente' ? '🚨' : '🔧'}</Text>
                  )}
                  <Text style={styles.ticketNumero}>#{ticket.numero}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[ticket.status] }]}>
                  <Text style={styles.statusBadgeText}>{ticket.status}</Text>
                </View>
              </View>
              <Text style={styles.ticketTitulo}>{ticket.titulo}</Text>
              <Text style={styles.ticketData}>{new Date(ticket.created_at).toLocaleDateString('pt-PT')}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Ticket</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Título"
              placeholderTextColor="#64748b"
              value={novoTicket.titulo}
              onChangeText={(t) => setNovoTicket({...novoTicket, titulo: t})}
            />
            
            <View style={styles.categoryPicker}>
              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    novoTicket.categoria === cat.id && styles.categoryBtnActive,
                    cat.urgente && styles.categoryBtnUrgent
                  ]}
                  onPress={() => setNovoTicket({...novoTicket, categoria: cat.id})}
                >
                  <Text style={[styles.categoryBtnText, novoTicket.categoria === cat.id && styles.categoryBtnTextActive]}>
                    {cat.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {['acidente', 'avaria'].includes(novoTicket.categoria) && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Este tipo de ticket requer fotos obrigatórias e será marcado como URGENTE
                </Text>
              </View>
            )}
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva o problema..."
              placeholderTextColor="#64748b"
              value={novoTicket.descricao}
              onChangeText={(t) => setNovoTicket({...novoTicket, descricao: t})}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={criarTicket}>
                <Text style={styles.modalBtnConfirmText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ===== GPS POPUP MODAL =====
const GPSPopupModal = ({ visible, type, onConfirm, onDismiss }) => {
  if (!visible) return null;

  const isStarting = type === 'start';

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.gpsModalOverlay}>
        <View style={styles.gpsModalContent}>
          <Text style={styles.gpsModalIcon}>{isStarting ? '🚗' : '⏸️'}</Text>
          <Text style={styles.gpsModalTitle}>
            {isStarting ? 'Detetámos Movimento!' : 'Parado há 10+ minutos'}
          </Text>
          <Text style={styles.gpsModalText}>
            {isStarting 
              ? 'Parece que começou a conduzir. Deseja iniciar o turno?' 
              : 'Não detetamos movimento. Deseja terminar o turno?'}
          </Text>
          <View style={styles.gpsModalButtons}>
            <TouchableOpacity style={[styles.gpsModalBtn, styles.gpsModalBtnSecondary]} onPress={onDismiss}>
              <Text style={styles.gpsModalBtnSecondaryText}>Agora Não</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gpsModalBtn, styles.gpsModalBtnPrimary]} onPress={onConfirm}>
              <Text style={styles.gpsModalBtnPrimaryText}>{isStarting ? 'Iniciar Turno' : 'Terminar Turno'}</Text>
            </TouchableOpacity>
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
  const [workStatus, setWorkStatus] = useState('off'); // off, working, paused
  const [gpsPopup, setGpsPopup] = useState({ visible: false, type: null });
  const popupShownRef = useRef({ start: false, stop: false });

  const handleLogin = (userData, token) => {
    setUser(userData);
    api.setToken(token);
  };

  const handleLogout = () => {
    setUser(null);
    api.setToken(null);
    setActiveTab('ponto');
    setWorkStatus('off');
  };

  // GPS Movement Detection
  const { location, isMoving } = useGPSMovement(
    workStatus === 'working',
    // onStartMoving - show popup to start work
    () => {
      if (workStatus === 'off' && !popupShownRef.current.start) {
        popupShownRef.current.start = true;
        setGpsPopup({ visible: true, type: 'start' });
      }
    },
    // onStationary - show popup to stop work
    () => {
      if (workStatus === 'working' && !popupShownRef.current.stop) {
        popupShownRef.current.stop = true;
        setGpsPopup({ visible: true, type: 'stop' });
      }
    }
  );

  const handleGPSPopupConfirm = async () => {
    setGpsPopup({ visible: false, type: null });
    
    if (gpsPopup.type === 'start') {
      // Auto check-in
      try {
        await api.post('/ponto/check-in', {});
        setWorkStatus('working');
        Alert.alert('Sucesso', 'Check-in automático registado!');
      } catch (e) {
        Alert.alert('Erro', e.message);
      }
    } else {
      // Auto check-out
      try {
        const result = await api.post('/ponto/check-out', {});
        setWorkStatus('off');
        const horas = Math.floor(result.tempo_trabalho_minutos / 60);
        const mins = result.tempo_trabalho_minutos % 60;
        Alert.alert('Check-out', `Tempo trabalhado: ${horas}h ${mins}m`);
      } catch (e) {
        Alert.alert('Erro', e.message);
      }
    }
    
    // Reset popup flags after some time
    setTimeout(() => {
      popupShownRef.current = { start: false, stop: false };
    }, 5 * 60 * 1000); // 5 minutos
  };

  const handleGPSPopupDismiss = () => {
    setGpsPopup({ visible: false, type: null });
    // Reset after 5 minutes to allow showing again
    setTimeout(() => {
      if (gpsPopup.type === 'start') popupShownRef.current.start = false;
      else popupShownRef.current.stop = false;
    }, 5 * 60 * 1000);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TVDEFleet</Text>
        <View style={styles.headerRight}>
          {isMoving && <Text style={styles.gpsIndicator}>📍</Text>}
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutBtn}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.content}>
        {activeTab === 'ponto' && (
          <PontoScreen 
            user={user} 
            status={workStatus} 
            setStatus={setWorkStatus}
            onCheckIn={() => { popupShownRef.current.start = true; }}
            onCheckOut={() => { popupShownRef.current.stop = true; }}
          />
        )}
        {activeTab === 'ganhos' && <GanhosScreen user={user} />}
        {activeTab === 'documentos' && <DocumentosScreen user={user} />}
        {activeTab === 'tickets' && <TicketsScreen user={user} />}
      </View>
      
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <GPSPopupModal 
        visible={gpsPopup.visible}
        type={gpsPopup.type}
        onConfirm={handleGPSPopupConfirm}
        onDismiss={handleGPSPopupDismiss}
      />
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  appContainer: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  gpsIndicator: { fontSize: 16, marginRight: 10 },
  logoutBtn: { color: '#94a3b8', fontSize: 14 },
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
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  historyDate: { color: '#94a3b8', fontSize: 14 },
  historyTime: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyText: { color: '#64748b', textAlign: 'center', padding: 20 },
  
  semanaSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  semanaSelectorLabel: { fontSize: 12, color: '#64748b' },
  semanaSelectorValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 2 },
  semanaSelectorPeriodo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  semanaSelectorArrow: { fontSize: 16, color: '#64748b' },
  
  reciboBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginBottom: 16 },
  reciboBtnNovo: { backgroundColor: '#3b82f6' },
  reciboBtnExiste: { backgroundColor: '#22c55e' },
  reciboBtnIcon: { fontSize: 18, marginRight: 8 },
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
  totalRow: { backgroundColor: '#0f172a', marginTop: 8, padding: 12, borderRadius: 8, borderBottomWidth: 0 },
  totalLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  totalValue: { color: '#22c55e', fontWeight: 'bold', fontSize: 16 },
  
  semanaList: { maxHeight: 300 },
  semanaItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  semanaItemActive: { backgroundColor: '#3b82f6', borderRadius: 8 },
  semanaItemLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  semanaItemLabelActive: { color: '#fff' },
  semanaItemPeriodo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  
  docItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  docInfo: { flexDirection: 'row', alignItems: 'center' },
  docIcon: { fontSize: 24, marginRight: 12 },
  docNome: { color: '#fff', fontSize: 14, fontWeight: '500' },
  docStatus: { fontSize: 12, marginTop: 2 },
  statusOk: { color: '#22c55e' },
  statusPending: { color: '#f59e0b' },
  statusMissing: { color: '#ef4444' },
  
  // Urgent Buttons
  urgentButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  urgentBtn: { flex: 1, backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  urgentBtnAvaria: { backgroundColor: '#d97706' },
  urgentBtnIcon: { fontSize: 28, marginBottom: 4 },
  urgentBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  urgentBanner: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 8 },
  urgentBannerText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  addPhotoBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 8 },
  addPhotoBtnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  
  warningBox: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16 },
  warningText: { color: '#92400e', fontSize: 13 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  ticketCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketNumero: { color: '#64748b', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  ticketTitulo: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  ticketData: { color: '#64748b', fontSize: 11 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  modalCloseBtn: { backgroundColor: '#334155', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalCloseBtnText: { color: '#fff', fontWeight: '600' },
  textArea: { height: 100, textAlignVertical: 'top' },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#334155' },
  categoryBtnActive: { backgroundColor: '#3b82f6' },
  categoryBtnUrgent: { borderWidth: 1, borderColor: '#dc2626' },
  categoryBtnText: { color: '#94a3b8', fontSize: 12 },
  categoryBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#334155' },
  modalBtnConfirm: { backgroundColor: '#3b82f6' },
  modalBtnCancelText: { color: '#94a3b8', fontWeight: '600' },
  modalBtnConfirmText: { color: '#fff', fontWeight: '600' },
  
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn: { color: '#3b82f6', fontSize: 16 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chatMessages: { flex: 1, padding: 16 },
  message: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 12 },
  messageOwn: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#334155' },
  messageAuthor: { color: '#94a3b8', fontSize: 11, marginBottom: 4 },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  messageTime: { color: '#94a3b8', fontSize: 10, marginTop: 4, textAlign: 'right' },
  chatInput: { flexDirection: 'row', padding: 16, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', alignItems: 'flex-end' },
  chatTextInput: { flex: 1, backgroundColor: '#334155', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', maxHeight: 100, marginRight: 8 },
  sendBtn: { backgroundColor: '#3b82f6', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18 },
  
  // GPS Popup
  gpsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  gpsModalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  gpsModalIcon: { fontSize: 64, marginBottom: 16 },
  gpsModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  gpsModalText: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  gpsModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  gpsModalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  gpsModalBtnSecondary: { backgroundColor: '#334155' },
  gpsModalBtnPrimary: { backgroundColor: '#3b82f6' },
  gpsModalBtnSecondaryText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  gpsModalBtnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
