import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import PontoScreen from './src/screens/PontoScreen';

// Placeholder screens (a desenvolver)
const DocumentosScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>📄</Text>
    <Text style={styles.placeholderText}>Documentos</Text>
    <Text style={styles.placeholderSubtext}>Em desenvolvimento...</Text>
  </View>
);

const VistoriaScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>🚗</Text>
    <Text style={styles.placeholderText}>Vistoria</Text>
    <Text style={styles.placeholderSubtext}>Em desenvolvimento...</Text>
  </View>
);

const PerfilScreen = () => {
  const { user, logout } = useAuth();
  
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>👤</Text>
      <Text style={styles.placeholderText}>{user?.name || 'Perfil'}</Text>
      <Text style={styles.placeholderSubtext}>{user?.email}</Text>
      <View style={styles.logoutButton}>
        <Text style={styles.logoutText} onPress={logout}>Sair</Text>
      </View>
    </View>
  );
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator para utilizadores autenticados
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Ponto"
        component={PontoScreen}
        options={{
          title: 'Relógio de Ponto',
          tabBarLabel: 'Ponto',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>⏱️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Documentos"
        component={DocumentosScreen}
        options={{
          title: 'Documentos',
          tabBarLabel: 'Docs',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📄</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Vistoria"
        component={VistoriaScreen}
        options={{
          title: 'Vistoria',
          tabBarLabel: 'Vistoria',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🚗</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Componente principal de navegação
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>A carregar...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
};

// App principal
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e40af',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 24,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#64748b',
  },
  logoutButton: {
    marginTop: 32,
    backgroundColor: '#ef4444',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
