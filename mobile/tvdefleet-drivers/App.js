import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://tvdefleet.com/api';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'tvdefleet_auth_token',
  USER: 'tvdefleet_user_data'
};

// Helper function for API calls
const api = {
  post: async (url, data, config = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(data)
    });
    const json = await response.json();
    if (!response.ok) {
      const error = new Error(json.detail || 'Request failed');
      error.response = { data: json };
      throw error;
    }
    return { data: json };
  },
  get: async (url, config = {}) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    });
    const json = await response.json();
    if (!response.ok) {
      const error = new Error(json.detail || 'Request failed');
      error.response = { data: json };
      throw error;
    }
    return { data: json };
  }
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Ponto states
  const [pontoAtivo, setPontoAtivo] = useState(false);
  const [horaInicio, setHoraInicio] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState('00:00:00');

  // Check stored token on startup
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsLoggedIn(true);
          checkPontoStatus(storedToken);
        }
      } catch (e) {
        console.log('Auth check error:', e);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Timer
  useEffect(() => {
    let interval;
    if (pontoAtivo && horaInicio) {
      interval = setInterval(() => {
        const agora = new Date();
        const inicio = new Date(horaInicio);
        const diff = Math.floor((agora - inicio) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTempoDecorrido(
          `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pontoAtivo, horaInicio]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha email e password');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post(`${API_URL}/auth/login`, { email, password });
      if (response.data.access_token) {
        const authToken = response.data.access_token;
        const userData = response.data.user;
        
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        
        setToken(authToken);
        setUser(userData);
        setIsLoggedIn(true);
        checkPontoStatus(authToken);
      }
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao fazer login');
    }
    setLoading(false);
  };

  const checkPontoStatus = async (authToken) => {
    try {
      const response = await api.get(`${API_URL}/ponto/estado-atual`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.data.ativo) {
        setPontoAtivo(true);
        setHoraInicio(response.data.hora_inicio);
      }
    } catch (error) {
      console.log('Erro ao verificar ponto:', error);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let location = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      
      const response = await api.post(`${API_URL}/ponto/check-in`, {
        latitude: location?.latitude,
        longitude: location?.longitude,
        hora: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPontoAtivo(true);
      setHoraInicio(response.data.hora_inicio || new Date().toISOString());
      Alert.alert('Sucesso', 'Check-in registado!');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro no check-in');
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    Alert.alert('Confirmar', 'Terminar turno?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', onPress: async () => {
        setLoading(true);
        try {
          await api.post(`${API_URL}/ponto/check-out`, {
            hora: new Date().toISOString()
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setPontoAtivo(false);
          setHoraInicio(null);
          setTempoDecorrido('00:00:00');
          Alert.alert('Sucesso', 'Check-out registado!');
        } catch (error) {
          Alert.alert('Erro', error.response?.data?.detail || 'Erro no check-out');
        }
        setLoading(false);
      }}
    ]);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    setIsLoggedIn(false);
    setToken(null);
    setUser(null);
    setPontoAtivo(false);
    setEmail('');
    setPassword('');
  };

  // Loading screen
  if (loading && !isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>A carregar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loginContainer}>
          <Text style={styles.logo}>🚗</Text>
          <Text style={styles.title}>TVDEFleet</Text>
          <Text style={styles.subtitle}>Drivers</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main app
  return (
    <SafeAreaView style={styles.containerLight}>
      <StatusBar style="dark" />
      <ScrollView style={styles.mainContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Olá, {user?.name || 'Motorista'}</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pontoCard}>
          <Text style={styles.pontoTitle}>Relógio de Ponto</Text>
          
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>{pontoAtivo ? 'Em serviço' : 'Fora de serviço'}</Text>
            <Text style={styles.timer}>{tempoDecorrido}</Text>
          </View>

          {!pontoAtivo ? (
            <TouchableOpacity 
              style={styles.checkInButton} 
              onPress={handleCheckIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Iniciar Turno</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.checkOutButton} 
              onPress={handleCheckOut}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Terminar Turno</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informações</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Parceiro:</Text>
            <Text style={styles.infoValue}>{user?.parceiro_nome || '-'}</Text>
          </View>
        </View>

        <Text style={styles.version}>v1.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e40af',
  },
  containerLight: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: '#93c5fd',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  loginButton: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mainContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  pontoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pontoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e40af',
    fontVariant: ['tabular-nums'],
  },
  checkInButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  checkOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    color: '#64748b',
  },
  infoValue: {
    color: '#1e293b',
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 16,
    marginBottom: 32,
  },
});
