import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { pontoService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PontoScreen = () => {
  const { user } = useAuth();
  const [estado, setEstado] = useState(null); // null, 'ativo', 'pausa'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [horaInicio, setHoraInicio] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState('00:00:00');
  const [resumoSemanal, setResumoSemanal] = useState(null);
  const [location, setLocation] = useState(null);

  // Timer para atualizar tempo decorrido
  useEffect(() => {
    let interval;
    if (estado === 'ativo' && horaInicio) {
      interval = setInterval(() => {
        const agora = new Date();
        const inicio = new Date(horaInicio);
        const diff = Math.floor((agora - inicio) / 1000);
        
        const horas = Math.floor(diff / 3600);
        const minutos = Math.floor((diff % 3600) / 60);
        const segundos = diff % 60;
        
        setTempoDecorrido(
          `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
        );
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [estado, horaInicio]);

  // Carregar estado inicial
  useEffect(() => {
    carregarEstado();
    obterLocalizacao();
  }, []);

  const obterLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Aviso', 'Permissão de localização necessária para registar o ponto');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Erro ao obter localização:', error);
    }
  };

  const carregarEstado = async () => {
    try {
      setLoading(true);
      const [estadoAtual, resumo] = await Promise.all([
        pontoService.getEstadoAtual(),
        pontoService.getResumoSemanal(),
      ]);
      
      if (estadoAtual.ativo) {
        setEstado(estadoAtual.em_pausa ? 'pausa' : 'ativo');
        setHoraInicio(estadoAtual.hora_inicio);
      } else {
        setEstado(null);
      }
      
      setResumoSemanal(resumo);
    } catch (error) {
      console.error('Erro ao carregar estado:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarEstado();
    await obterLocalizacao();
    setRefreshing(false);
  }, []);

  const handleCheckIn = async () => {
    if (!location) {
      Alert.alert('Aviso', 'A obter localização... Tente novamente.');
      await obterLocalizacao();
      return;
    }

    setActionLoading(true);
    try {
      const data = {
        latitude: location.latitude,
        longitude: location.longitude,
        hora: new Date().toISOString(),
      };
      
      const result = await pontoService.checkIn(data);
      setEstado('ativo');
      setHoraInicio(result.hora_inicio || new Date().toISOString());
      Alert.alert('Sucesso', 'Check-in registado com sucesso!');
    } catch (error) {
      console.error('Erro no check-in:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao registar check-in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    Alert.alert(
      'Confirmar Check-out',
      'Tem a certeza que quer terminar o turno?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setActionLoading(true);
            try {
              await obterLocalizacao();
              const data = {
                latitude: location?.latitude,
                longitude: location?.longitude,
                hora: new Date().toISOString(),
              };
              
              await pontoService.checkOut(data);
              setEstado(null);
              setHoraInicio(null);
              setTempoDecorrido('00:00:00');
              Alert.alert('Sucesso', 'Check-out registado com sucesso!');
              carregarEstado();
            } catch (error) {
              console.error('Erro no check-out:', error);
              Alert.alert('Erro', error.response?.data?.detail || 'Erro ao registar check-out');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePausa = async () => {
    setActionLoading(true);
    try {
      const tipo = estado === 'pausa' ? 'retomar' : 'iniciar';
      await pontoService.registarPausa({ tipo, hora: new Date().toISOString() });
      setEstado(estado === 'pausa' ? 'ativo' : 'pausa');
      Alert.alert('Sucesso', estado === 'pausa' ? 'Pausa terminada!' : 'Pausa iniciada!');
    } catch (error) {
      console.error('Erro na pausa:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao registar pausa');
    } finally {
      setActionLoading(false);
    }
  };

  const formatarHoras = (minutos) => {
    if (!minutos) return '0h 0min';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}min`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>A carregar...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] || 'Motorista'}!</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('pt-PT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {/* Status Card */}
      <View style={[styles.statusCard, estado && styles.statusCardActive]}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, estado ? styles.indicatorActive : styles.indicatorInactive]} />
          <Text style={styles.statusText}>
            {estado === 'ativo' ? 'Em Serviço' : estado === 'pausa' ? 'Em Pausa' : 'Fora de Serviço'}
          </Text>
        </View>
        
        <Text style={styles.timerText}>{tempoDecorrido}</Text>
        
        {horaInicio && (
          <Text style={styles.horaInicioText}>
            Início: {new Date(horaInicio).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!estado ? (
          <TouchableOpacity
            style={[styles.mainButton, styles.checkInButton]}
            onPress={handleCheckIn}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.mainButtonIcon}>▶️</Text>
                <Text style={styles.mainButtonText}>Iniciar Turno</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, estado === 'pausa' ? styles.resumeButton : styles.pauseButton]}
                onPress={handlePausa}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonIcon}>
                  {estado === 'pausa' ? '▶️' : '⏸️'}
                </Text>
                <Text style={styles.actionButtonText}>
                  {estado === 'pausa' ? 'Retomar' : 'Pausa'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.checkOutButton]}
                onPress={handleCheckOut}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonIcon}>⏹️</Text>
                <Text style={styles.actionButtonText}>Terminar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Resumo Semanal */}
      <View style={styles.resumoCard}>
        <Text style={styles.resumoTitle}>Resumo Semanal</Text>
        
        <View style={styles.resumoRow}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValue}>
              {formatarHoras(resumoSemanal?.total_minutos || 0)}
            </Text>
            <Text style={styles.resumoLabel}>Horas Trabalhadas</Text>
          </View>
          
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValue}>
              {resumoSemanal?.total_turnos || 0}
            </Text>
            <Text style={styles.resumoLabel}>Turnos</Text>
          </View>
        </View>
        
        <View style={styles.resumoRow}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValue}>
              {formatarHoras(resumoSemanal?.media_diaria || 0)}
            </Text>
            <Text style={styles.resumoLabel}>Média Diária</Text>
          </View>
          
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValue}>
              {resumoSemanal?.dias_trabalhados || 0}
            </Text>
            <Text style={styles.resumoLabel}>Dias</Text>
          </View>
        </View>
      </View>

      {/* Localização */}
      {location && (
        <View style={styles.locationCard}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>
            Localização ativa
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  date: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
    textTransform: 'capitalize',
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  indicatorActive: {
    backgroundColor: '#22c55e',
  },
  indicatorInactive: {
    backgroundColor: '#94a3b8',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e293b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  horaInicioText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  checkInButton: {
    backgroundColor: '#22c55e',
  },
  mainButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
  },
  resumeButton: {
    backgroundColor: '#22c55e',
  },
  checkOutButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resumoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resumoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  resumoItem: {
    alignItems: 'center',
    flex: 1,
  },
  resumoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  resumoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    color: '#0369a1',
    fontSize: 14,
  },
});

export default PontoScreen;
