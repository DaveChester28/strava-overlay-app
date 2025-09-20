import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectStrava = async () => {
    setIsConnecting(true);
    
    try {
      // Test connection to our backend
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      
      Alert.alert(
        'Backend Connected! 🎉',
        `Server Status: ${data.status}\nMessage: ${data.message}`,
        [{ text: 'Awesome!' }]
      );
    } catch (error) {
      Alert.alert(
        'Backend Not Running',
        'Start the server with: npm run dev:server',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏃‍♂️ Strava Overlay</Text>
      <Text style={styles.subtitle}>
        Create beautiful overlays for your Strava activities
      </Text>
      
      <View style={styles.features}>
        <Text style={styles.feature}>✨ Premium templates</Text>
        <Text style={styles.feature}>📱 Instagram ready formats</Text>
        <Text style={styles.feature}>🔒 Privacy first design</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isConnecting && styles.buttonDisabled]}
        onPress={handleConnectStrava}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Connect with Strava</Text>
        )}
      </TouchableOpacity>
      
      <Text style={styles.powered}>Powered by Strava</Text>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  features: {
    marginBottom: 40,
  },
  feature: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FC4C02',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  powered: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 20,
  },
});
