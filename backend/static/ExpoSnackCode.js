// TVDEFleet Drivers - Aplicação Móvel Completa
// Cole este código em https://snack.expo.dev

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, Platform, KeyboardAvoidingView
} from 'react-native';

const API_URL = 'https://fleet-refactor.preview.emergentagent.com/api';

// ===== CONTEXT =====
const AuthContext = React.createContext(null);

const useAuth = () => React.useContext(AuthContext);

// ===== API SERVICE =====
const api = {
  token: null,
  
  setToken(token) {
    this.token = token;
  },
  
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Erro na requisição');
    }
    
    return response.json();
  },
  
  get(endpoint) {
    return this.request(endpoint);
  },
  
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// ===== COMPONENTS =====

// Login Screen
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.loginBox}>
        <Text style={styles.title}>🚗 TVDEFleet</Text>
        <Text style={styles.subtitle}>Área do Motorista</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.btn, loading && styles.btnDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// Bottom Tab Navigation
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
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Ponto Screen (Relógio de Ponto)
const PontoScreen = ({ user }) => {
  const [status, setStatus] = useState('off'); // off, working, paused
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      // Carregar estado atual
      const estado = await api.get('/ponto/estado-atual');
      if (estado.ativo) {
        setStatus(estado.em_pausa ? 'paused' : 'working');
      } else {
        setStatus('off');
      }
      
      // Carregar resumo semanal
      const resumoData = await api.get('/ponto/resumo-semanal');
      setResumo(resumoData);
      
      // Carregar histórico
      const hist = await api.get('/ponto/historico');
      setHistorico(hist.slice(0, 5));
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const formatMinutos = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <ScrollView 
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.screenTitle}>Relógio de Ponto</Text>
      
      {/* Status Atual */}
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
            <TouchableOpacity 
              style={[styles.actionBtn, styles.btnGreen]} 
              onPress={() => handlePonto('checkin')}
              disabled={loading}
            >
              <Text style={styles.actionBtnText}>▶️ Check-in</Text>
            </TouchableOpacity>
          )}
          
          {status === 'working' && (
            <>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnYellow]} 
                onPress={() => handlePonto('pause')}
                disabled={loading}
              >
                <Text style={styles.actionBtnText}>⏸️ Pausa</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnRed]} 
                onPress={() => handlePonto('checkout')}
                disabled={loading}
              >
                <Text style={styles.actionBtnText}>⏹️ Check-out</Text>
              </TouchableOpacity>
            </>
          )}
          
          {status === 'paused' && (
            <>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnGreen]} 
                onPress={() => handlePonto('resume')}
                disabled={loading}
              >
                <Text style={styles.actionBtnText}>▶️ Retomar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnRed]} 
                onPress={() => handlePonto('checkout')}
                disabled={loading}
              >
                <Text style={styles.actionBtnText}>⏹️ Check-out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Resumo Semanal */}
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

      {/* Histórico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Últimos Registos</Text>
        {historico.length === 0 ? (
          <Text style={styles.emptyText}>Sem registos</Text>
        ) : (
          historico.map((reg, idx) => (
            <View key={idx} style={styles.historyItem}>
              <Text style={styles.historyDate}>
                {new Date(reg.check_in).toLocaleDateString('pt-PT')}
              </Text>
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

// Ganhos Screen
const GanhosScreen = ({ user }) => {
  const [semanaAtual, setSemanaAtual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const ganhos = await api.get('/ponto/ganhos-semana');
      setSemanaAtual(ganhos);
      
      // Histórico simplificado (últimas 4 semanas)
      const hist = [];
      const hoje = new Date();
      let semana = ganhos.semana;
      let ano = ganhos.ano;
      
      for (let i = 0; i < 4; i++) {
        try {
          const g = await api.get(`/ponto/ganhos-semana?semana=${semana}&ano=${ano}`);
          hist.push(g);
        } catch (e) {}
        
        semana--;
        if (semana <= 0) {
          semana = 52;
          ano--;
        }
      }
      
      setHistorico(hist);
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.screenTitle}>Ganhos e Relatórios</Text>
      
      {semanaAtual && (
        <>
          {/* Resumo Atual */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{semanaAtual.periodo}</Text>
            
            <View style={styles.ganhoBox}>
              <Text style={styles.ganhoLabel}>Valor Líquido</Text>
              <Text style={[
                styles.ganhoValor, 
                semanaAtual.valor_liquido >= 0 ? styles.positive : styles.negative
              ]}>
                €{semanaAtual.valor_liquido.toFixed(2)}
              </Text>
            </View>
            
            {/* Ganhos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Ganhos</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Uber</Text>
                <Text style={styles.value}>€{semanaAtual.ganhos.uber.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Bolt</Text>
                <Text style={styles.value}>€{semanaAtual.ganhos.bolt.toFixed(2)}</Text>
              </View>
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Ganhos</Text>
                <Text style={styles.totalValue}>€{semanaAtual.ganhos.total.toFixed(2)}</Text>
              </View>
            </View>
            
            {/* Despesas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📉 Despesas</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Via Verde</Text>
                <Text style={styles.value}>€{semanaAtual.despesas.via_verde.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Combustível</Text>
                <Text style={styles.value}>€{semanaAtual.despesas.combustivel.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Elétrico</Text>
                <Text style={styles.value}>€{semanaAtual.despesas.eletrico.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Aluguer</Text>
                <Text style={styles.value}>€{semanaAtual.despesas.aluguer.toFixed(2)}</Text>
              </View>
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Despesas</Text>
                <Text style={[styles.totalValue, styles.negative]}>
                  €{semanaAtual.despesas.total.toFixed(2)}
                </Text>
              </View>
            </View>
            
            {/* Horas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏱️ Horas Trabalhadas</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Total</Text>
                <Text style={styles.value}>{semanaAtual.horas_trabalhadas.formatado}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Turnos</Text>
                <Text style={styles.value}>{semanaAtual.horas_trabalhadas.total_turnos}</Text>
              </View>
            </View>
          </View>

          {/* Histórico */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Histórico</Text>
            {historico.slice(1).map((h, idx) => (
              <View key={idx} style={styles.historyRow}>
                <Text style={styles.historyPeriod}>S{h.semana}/{h.ano}</Text>
                <Text style={[
                  styles.historyValue,
                  h.valor_liquido >= 0 ? styles.positive : styles.negative
                ]}>
                  €{h.valor_liquido.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

// Documentos Screen
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
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpload = (tipo) => {
    // Em produção, usar expo-document-picker
    Alert.alert(
      'Upload de Documento',
      `Para carregar ${tiposDocumentos[tipo].nome}, use a versão web da aplicação ou aguarde a próxima atualização.`,
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.screenTitle}>Meus Documentos</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documentos Obrigatórios</Text>
        
        {Object.entries(tiposDocumentos).map(([tipo, info]) => {
          const doc = documentos[tipo];
          const temDoc = !!doc;
          const validado = doc?.validado;
          
          return (
            <TouchableOpacity 
              key={tipo} 
              style={styles.docItem}
              onPress={() => handleUpload(tipo)}
            >
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>{info.icon}</Text>
                <View>
                  <Text style={styles.docNome}>{info.nome}</Text>
                  <Text style={[
                    styles.docStatus,
                    temDoc ? (validado ? styles.statusOk : styles.statusPending) : styles.statusMissing
                  ]}>
                    {temDoc ? (validado ? '✓ Validado' : '⏳ Aguarda validação') : '❌ Não enviado'}
                  </Text>
                </View>
              </View>
              <Text style={styles.docArrow}>›</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Os documentos são guardados com histórico. Quando atualizar um documento, o anterior fica arquivado e visível para o parceiro.
        </Text>
      </View>
    </ScrollView>
  );
};

// Tickets/Suporte Screen
const TicketsScreen = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [novoTicket, setNovoTicket] = useState({ titulo: '', categoria: 'outro', descricao: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');

  const categorias = [
    { id: 'problema_tecnico', nome: 'Problema Técnico' },
    { id: 'pagamentos', nome: 'Pagamentos' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'veiculo', nome: 'Veículo' },
    { id: 'contrato', nome: 'Contrato' },
    { id: 'outro', nome: 'Outro' }
  ];

  const statusColors = {
    aberto: '#22c55e',
    em_analise: '#3b82f6',
    a_processar: '#8b5cf6',
    aguardar_resposta: '#f59e0b',
    resolvido: '#6b7280',
    fechado: '#374151'
  };

  const loadData = async () => {
    try {
      const data = await api.get('/tickets/meus');
      setTickets(data);
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const criarTicket = async () => {
    if (!novoTicket.titulo || !novoTicket.descricao) {
      Alert.alert('Erro', 'Preencha título e descrição');
      return;
    }
    
    try {
      await api.post('/tickets/criar', novoTicket);
      Alert.alert('Sucesso', 'Ticket criado com sucesso!');
      setModalVisible(false);
      setNovoTicket({ titulo: '', categoria: 'outro', descricao: '' });
      loadData();
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim()) return;
    
    try {
      await api.post(`/tickets/${selectedTicket.id}/mensagem`, { conteudo: novaMensagem });
      setNovaMensagem('');
      // Recarregar ticket
      const updated = await api.get(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated);
      loadData();
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Modal de Chat do Ticket
  if (selectedTicket) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screen}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedTicket(null)}>
            <Text style={styles.backBtn}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.chatTitle}>#{selectedTicket.numero}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedTicket.status] }]}>
            <Text style={styles.statusBadgeText}>{selectedTicket.status}</Text>
          </View>
        </View>
        
        <ScrollView style={styles.chatMessages}>
          {selectedTicket.mensagens?.map((msg, idx) => (
            <View 
              key={idx} 
              style={[
                styles.message,
                msg.autor_id === user.id ? styles.messageOwn : styles.messageOther
              ]}
            >
              <Text style={styles.messageAuthor}>{msg.autor_nome}</Text>
              <Text style={styles.messageText}>{msg.conteudo}</Text>
              <Text style={styles.messageTime}>
                {new Date(msg.created_at).toLocaleString('pt-PT')}
              </Text>
            </View>
          ))}
        </ScrollView>
        
        {selectedTicket.status !== 'fechado' && (
          <View style={styles.chatInput}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Escreva uma mensagem..."
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
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addBtnText}>+ Novo Ticket</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={styles.emptyText}>Sem tickets</Text>
            <Text style={styles.emptySubtext}>Crie um ticket para contactar o suporte</Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TouchableOpacity 
              key={ticket.id} 
              style={styles.ticketCard}
              onPress={() => setSelectedTicket(ticket)}
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketNumero}>#{ticket.numero}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[ticket.status] }]}>
                  <Text style={styles.statusBadgeText}>{ticket.status}</Text>
                </View>
              </View>
              <Text style={styles.ticketTitulo}>{ticket.titulo}</Text>
              <Text style={styles.ticketCategoria}>
                {categorias.find(c => c.id === ticket.categoria)?.nome || ticket.categoria}
              </Text>
              <Text style={styles.ticketData}>
                {new Date(ticket.created_at).toLocaleDateString('pt-PT')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal Novo Ticket */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Ticket</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Título"
              value={novoTicket.titulo}
              onChangeText={(t) => setNovoTicket({...novoTicket, titulo: t})}
            />
            
            <View style={styles.categoryPicker}>
              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    novoTicket.categoria === cat.id && styles.categoryBtnActive
                  ]}
                  onPress={() => setNovoTicket({...novoTicket, categoria: cat.id})}
                >
                  <Text style={[
                    styles.categoryBtnText,
                    novoTicket.categoria === cat.id && styles.categoryBtnTextActive
                  ]}>
                    {cat.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva o seu problema..."
              value={novoTicket.descricao}
              onChangeText={(t) => setNovoTicket({...novoTicket, descricao: t})}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={criarTicket}
              >
                <Text style={styles.modalBtnConfirmText}>Criar Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Main App
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('ponto');

  const handleLogin = (userData, token) => {
    setUser(userData);
    api.setToken(token);
  };

  const handleLogout = () => {
    setUser(null);
    api.setToken(null);
    setActiveTab('ponto');
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <View style={styles.appContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TVDEFleet</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutBtn}>Sair</Text>
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'ponto' && <PontoScreen user={user} />}
        {activeTab === 'ganhos' && <GanhosScreen user={user} />}
        {activeTab === 'documentos' && <DocumentosScreen user={user} />}
        {activeTab === 'tickets' && <TicketsScreen user={user} />}
      </View>
      
      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  // App Layout
  appContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutBtn: {
    color: '#94a3b8',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: '#3b82f6',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  
  // Login
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loginBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btn: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Screens
  screen: {
    flex: 1,
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Cards
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  
  // Ponto
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 16,
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnGreen: { backgroundColor: '#22c55e' },
  btnYellow: { backgroundColor: '#eab308' },
  btnRed: { backgroundColor: '#ef4444' },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyDate: {
    color: '#94a3b8',
    fontSize: 14,
  },
  historyTime: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  
  // Ganhos
  ganhoBox: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  ganhoLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  ganhoValor: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    backgroundColor: '#0f172a',
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  totalLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  totalValue: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyPeriod: {
    color: '#94a3b8',
  },
  historyValue: {
    fontWeight: 'bold',
  },
  
  // Documentos
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  docNome: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  docStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  statusOk: { color: '#22c55e' },
  statusPending: { color: '#f59e0b' },
  statusMissing: { color: '#ef4444' },
  docArrow: {
    color: '#64748b',
    fontSize: 20,
  },
  infoBox: {
    backgroundColor: '#1e3a5f',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 20,
  },
  
  // Tickets
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  ticketCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumero: {
    color: '#64748b',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  ticketTitulo: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ticketCategoria: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  ticketData: {
    color: '#64748b',
    fontSize: 11,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
  },
  categoryBtnText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  categoryBtnTextActive: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#334155',
  },
  modalBtnConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalBtnCancelText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalBtnConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Chat
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    color: '#3b82f6',
    fontSize: 16,
  },
  chatTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatMessages: {
    flex: 1,
    padding: 16,
  },
  message: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
  },
  messageAuthor: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  chatInput: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'flex-end',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
  },
});
