/**
 * CrossPlay demo shop (B-033) — React Native twin of examples/demo-web and
 * examples/demo-android-kotlin: same screens, same testIDs, same credentials
 * (demo / crossplay), same deliberate asynchrony (~400ms login spinner, 80ms
 * row stagger) so the shared spec runs unchanged (G1/FR-070).
 *
 * testID → resource-id on Android (Fabric); accessibilityRole="button" makes
 * Pressables read as android.widget.Button to UIAutomator so by.role works.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Item {
  id: number;
  name: string;
  price: string;
  blurb: string;
}

const ITEMS: Item[] = [
  { id: 1, name: 'Trace Recorder', price: '$29', blurb: 'Every step, every screenshot, one portable file.' },
  { id: 2, name: 'Auto Waiter', price: '$49', blurb: 'Present, visible, stable, enabled — then act.' },
  { id: 3, name: 'Selector Unifier', price: '$19', blurb: 'One testId for web and Android.' },
  { id: 4, name: 'Flake Eliminator', price: '$99', blurb: '0 failures in 50 runs, or your money back.' },
  { id: 5, name: 'Doctor Kit', price: '$9', blurb: 'Diagnoses your environment in seconds.' },
];

type Screen =
  | { kind: 'login'; error: string | null }
  | { kind: 'spinner' }
  | { kind: 'list' }
  | { kind: 'detail'; item: Item };

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({ kind: 'login', error: null });

  return (
    <SafeAreaView style={styles.root}>
      {screen.kind === 'login' && <Login error={screen.error} onSubmit={(u, p) => {
        setScreen({ kind: 'spinner' });
        setTimeout(() => {
          if (u === 'demo' && p === 'crossplay') setScreen({ kind: 'list' });
          else setScreen({ kind: 'login', error: 'Wrong username or password' });
        }, 400);
      }} />}
      {screen.kind === 'spinner' && (
        <Text testID="spinner" style={styles.dim}>Signing in…</Text>
      )}
      {screen.kind === 'list' && (
        <List onOpen={(item) => setScreen({ kind: 'detail', item })} onLogout={() => setScreen({ kind: 'login', error: null })} />
      )}
      {screen.kind === 'detail' && (
        <Detail item={screen.item} onBack={() => setScreen({ kind: 'list' })} />
      )}
    </SafeAreaView>
  );
}

function Login({ error, onSubmit }: { error: string | null; onSubmit: (u: string, p: string) => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  return (
    <View>
      <Text style={styles.heading}>Demo Shop</Text>
      <Text testID="login_hint">Sign in with demo / crossplay</Text>
      <TextInput testID="username" placeholder="Username" value={user} onChangeText={setUser} style={styles.input} />
      <TextInput testID="password" placeholder="Password" value={pass} onChangeText={setPass} secureTextEntry style={styles.input} />
      <Pressable testID="login_button" accessibilityRole="button" onPress={() => onSubmit(user, pass)} style={styles.button}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      {error !== null && <Text testID="login_error" style={styles.error}>{error}</Text>}
    </View>
  );
}

function List({ onOpen, onLogout }: { onOpen: (i: Item) => void; onLogout: () => void }) {
  // Rows appear one by one — exercises present/stable waiting on the last row.
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const timers = ITEMS.map((_, idx) => setTimeout(() => setVisible((v) => Math.max(v, idx + 1)), 80 * (idx + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View style={styles.fill}>
      <Text style={styles.heading}>Inventory</Text>
      <Text testID="greeting">Welcome back, demo</Text>
      <ScrollView testID="item_list" style={styles.fill}>
        {ITEMS.slice(0, visible).map((item) => (
          <Pressable key={item.id} testID={`item_row_${item.id}`} onPress={() => onOpen(item)} style={styles.row}>
            <Text>{`${item.name} — ${item.price}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable testID="logout_button" accessibilityRole="button" onPress={onLogout} style={styles.button}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

function Detail({ item, onBack }: { item: Item; onBack: () => void }) {
  return (
    <View>
      <Text testID="detail_title" style={styles.heading}>{item.name}</Text>
      <Text testID="detail_price">{item.price}</Text>
      <Text testID="detail_blurb">{item.blurb}</Text>
      <Pressable testID="back_button" accessibilityRole="button" onPress={onBack} style={styles.button}>
        <Text style={styles.buttonText}>Back to list</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  fill: { flex: 1 },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#8884', padding: 10, marginVertical: 4, borderRadius: 4 },
  button: { backgroundColor: '#2563eb', padding: 12, borderRadius: 4, marginTop: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16 },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#8884' },
  error: { color: '#c0392b', marginTop: 8 },
  dim: { opacity: 0.6, textAlign: 'center', marginTop: 40 },
});
