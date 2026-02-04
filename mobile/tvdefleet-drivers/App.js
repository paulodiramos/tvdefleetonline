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
import axios from 'axios';

const API_URL = 'https://fleet-guardian-7.preview.emergentagent.com/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Ponto states
  const [pontoAtivo, setPontoAtivo] = useState(false);
  const [horaInicio, setHoraInicio] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState('00:00:00');

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
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      if (response.data.access_token) {
        setToken(response.data.access_token);
        setUser(response.data.user);
        setIsLoggedIn(true);
        
        // Verificar estado do ponto
        checkPontoStatus(response.data.access_token);
      }
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao fazer login');
    }
    setLoading(false);
  };

  const checkPontoStatus = async (authToken) => {
    try {
      const response = await axios.get(`${API_URL}/ponto/estado-atual`, {
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
      
      const response = await axios.post(`${API_URL}/ponto/check-in`, {
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
          await axios.post(`${API_URL}/ponto/check-out`, {
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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken(null);
    setUser(null);
    setPontoAtivo(false);
    setEmail('');
    setPassword('');
  };

  // LOGIN SCREEN
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

  // MAIN SCREEN (Ponto)
  return (
    <SafeAreaView style={styles.containerLight}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.mainContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] || 'Motorista'}!</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.statusCard, pontoAtivo && styles.statusCardActive]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, pontoAtivo ? styles.dotActive : styles.dotInactive]} />
            <Text style={[styles.statusText, pontoAtivo && styles.statusTextActive]}>
              {pontoAtivo ? 'Em Serviço' : 'Fora de Serviço'}
            </Text>
          </View>
          <Text style={[styles.timer, pontoAtivo && styles.timerActive]}>{tempoDecorrido}</Text>
          {horaInicio && (
            <Text style={[styles.startTime, pontoAtivo && styles.startTimeActive]}>
              Início: {new Date(horaInicio).toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'})}
            </Text>
          )}
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
              <>
                <Text style={styles.buttonIcon}>▶️</Text>
                <Text style={styles.buttonText}>Iniciar Turno</Text>
              </>
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
              <>
                <Text style={styles.buttonIcon}>⏹️</Text>
                <Text style={styles.buttonText}>Terminar Turno</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <Text style={styles.footer}>TVDEFleet Drivers v1.0</Text>
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
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusCardActive: {
    backgroundColor: '#1e40af',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#22c55e',
  },
  dotInactive: {
    backgroundColor: '#94a3b8',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusTextActive: {
    color: '#fff',
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  timerActive: {
    color: '#fff',
  },
  startTime: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  startTimeActive: {
    color: '#93c5fd',
  },
  checkInButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
  },
  checkOutButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 32,
    fontSize: 12,
  },
});
