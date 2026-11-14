import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { TalquiChat, TalquiProvider, useTalqui, useTalquiEvent } from '@talqui-oss/react-native';

import { TALQUI_BASE_URL, TALQUI_CONNECTION_ID, TALQUI_TENANT_ID } from './talqui.config';

const Tab = createBottomTabNavigator();

function HomeScreen() {
  const talqui = useTalqui();

  // Your analytics, a banner, a sound: every chat event is available.
  useTalquiEvent('messageReceived', (event) => console.log('New message:', event.preview));

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Talqui chat example</Text>
      <Text style={styles.subtitle}>The chat opens full screen. The “Chat” tab shows it inline.</Text>

      <Button label={talqui.unreadCount > 0 ? `Open chat (${talqui.unreadCount})` : 'Open chat'} onPress={talqui.open} primary />

      <Button
        label="Identify demo user"
        onPress={() => {
          // In a real app: after login. The userHash comes from YOUR backend, never from the app.
          void talqui.identify({ name: 'Ana Souza', email: 'ana@example.com', phone: '+5511999990000' });
          talqui.setContactMeta({ plan: 'demo' });
          talqui.setSessionMeta({ screen: 'home' });
        }}
      />
      <Button label="Update conversation" onPress={() => talqui.setSessionMeta({ step: 'checkout', cart_items: 3 })} />
      <Button label="Prefill a message" onPress={() => talqui.prefill('Hi! I need help with my order.')} />
      <Button label="Log out" onPress={() => void talqui.logout()} />

      <Text style={styles.status}>{talqui.isReady ? 'Chat ready' : 'Chat not loaded yet'}</Text>
    </SafeAreaView>
  );
}

function ChatScreen() {
  // Counts unread messages while another tab is on screen.
  const focused = useIsFocused();
  return (
    <SafeAreaView style={styles.chat} edges={['top']}>
      <TalquiChat style={styles.chat} visible={focused} />
    </SafeAreaView>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TalquiProvider tenantId={TALQUI_TENANT_ID} connectionId={TALQUI_CONNECTION_ID} __unstableBaseUrl={TALQUI_BASE_URL} debug>
        <NavigationContainer>
          <Tab.Navigator screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Chat" component={ChatScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </TalquiProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, backgroundColor: '#F7F8FA' },
  chat: { flex: 1, backgroundColor: '#FFFFFF' },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1E2A', marginTop: 12 },
  subtitle: { fontSize: 15, color: '#666D80', marginBottom: 12 },
  button: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#1A66FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: '#1A66FF' },
  buttonText: { fontSize: 16, color: '#1A66FF', fontWeight: '600' },
  buttonTextPrimary: { color: '#FFFFFF' },
  pressed: { opacity: 0.7 },
  status: { marginTop: 'auto', textAlign: 'center', color: '#666D80' },
});
