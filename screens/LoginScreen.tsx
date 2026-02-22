import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  Image,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  HelperText,
  useTheme,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { useResponsiveTheme } from '../utils/responsive';

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Login'
>;

type Props = {
  navigation: LoginScreenNavigationProp;
};

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await login(username, password);

      if (success) {
        navigation.replace('Dashboard');
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Card style={[styles.card, { maxWidth: lo.modalMaxWidth, alignSelf: 'center', width: '100%' }]}>
            <Card.Content style={{ padding: sp.md }}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/login-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Title style={[styles.title, { color: theme.colors.primary, fontSize: fs.h1 }]}>
                IgoroTech POS
              </Title>
              <Paragraph style={[styles.subtitle, { fontSize: fs.body }]}>
                Professional Point of Sale System
              </Paragraph>

              <TextInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => {}}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>

              <Pressable
                onPress={handleLogin}
                disabled={loading}
                role="button"
                style={({ pressed }) => [
                  styles.signInButton,
                  loading && styles.signInButtonDisabled,
                  pressed && styles.signInButtonPressed
                ]}
              >
                <Text style={styles.signInButtonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </Pressable>

              <View style={styles.copyrightContainer}>
                <Paragraph style={styles.copyrightText}>
                  © {new Date().getFullYear()} IgoroTech POS. All rights reserved.
                </Paragraph>
              </View>
            </Card.Content>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 40,
    paddingVertical: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.7,
  },
  versionContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 2,
  },
  buildText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#1976D2',
    opacity: 0.8,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  signInButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  signInButtonPressed: {
    backgroundColor: '#1976D2',
    opacity: 0.9,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    pointerEvents: 'none',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  demoInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  demoText: {
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
  },
  copyrightContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  copyrightText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    opacity: 0.8,
  },
});