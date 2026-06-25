import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS, FONTS, SPACING, SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { initializeSheetsHeaders } from '@/services/sheets.service';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuthStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [email, setEmail] = useState('sabarishfoods@gmail.com');
  const [password, setPassword] = useState('091230');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validate = () => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) { setEmailError(t('errors.required')); valid = false; }
    if (!password.trim()) { setPasswordError(t('errors.required')); valid = false; }
    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await signIn(email.trim(), password);
      // Initialize Google Sheets headers on first login (best-effort)
      initializeSheetsHeaders().catch(() => {});
      router.replace('/tabs');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('auth.login'), t('auth.invalid_credentials'));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Header */}
          <LinearGradient
            colors={['#FFF7ED', '#FFD6A5', '#FF8A00']}
            locations={[0, 0.5, 1]}
            style={styles.hero}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>{t('app.name')}</Text>
            <Text style={styles.tagline}>{t('app.tagline')}</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: colors.surface }, SHADOW.lg]}>
            <Text style={[styles.welcome, { color: colors.text }]}>{t('auth.welcome')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.subtitle')}
            </Text>

            <View style={styles.form}>
              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="owner@sabarish.com"
                error={emailError}
                required
              />
              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                error={passwordError}
                required
              />

              <Button
                title={isLoading ? t('auth.signing_in') : t('auth.sign_in')}
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                size="lg"
                style={{ marginTop: SPACING.sm }}
              />
            </View>
          </View>

          <Text style={[styles.footer, { color: colors.textTertiary }]}>
            சபரிஷ் உணவகம் • KN பாளையம்
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF7ED' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING['4xl'],
    paddingBottom: SPACING['5xl'],
    paddingHorizontal: SPACING['2xl'],
  },
  logoImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: SPACING.md,
  },
  appName: {
    color: '#7A3600',
    fontSize: FONTS.size['4xl'],
    fontWeight: FONTS.weight.extraBold,
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#A04700',
    fontSize: FONTS.size.sm,
    marginTop: 4,
    opacity: 0.85,
  },
  formCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    flex: 1,
    padding: SPACING['2xl'],
    paddingTop: SPACING['3xl'],
  },
  welcome: {
    fontSize: FONTS.size['3xl'],
    fontWeight: FONTS.weight.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.size.md,
    marginBottom: SPACING['2xl'],
  },
  form: { gap: SPACING.xs },
  footer: {
    textAlign: 'center',
    fontSize: FONTS.size.xs,
    paddingVertical: SPACING.lg,
    backgroundColor: 'white',
  },
});
