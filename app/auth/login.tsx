import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store';
import { COLORS, SHADOW } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { loginWithMpin, completeFirstLogin, initialize, user, isLoading } = useAuthStore();

  const [mpin, setMpin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [connecting, setConnecting] = useState(true);

  // First Login setup state
  const [firstLoginUser, setFirstLoginUser] = useState<any | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'login' | 'new_pin' | 'confirm_pin'>('login');

  // Lockout states
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  // 1. Silent initialization on launch
  useEffect(() => {
    const runInit = async () => {
      await initialize();
      setConnecting(false);

      // Check lockout status on launch
      const lockoutVal = await AsyncStorage.getItem('@sabarish_lockout_until');
      if (lockoutVal) {
        const lockoutUntil = parseInt(lockoutVal, 10);
        if (Date.now() < lockoutUntil) {
          setLockoutTime(lockoutUntil);
          setRemainingTime(Math.ceil((lockoutUntil - Date.now()) / 1000));
        } else {
          await AsyncStorage.removeItem('@sabarish_lockout_until');
          await AsyncStorage.removeItem('@sabarish_failed_attempts');
        }
      }
    };
    runInit();
  }, []);

  // 2. Lockout Countdown Timer
  useEffect(() => {
    if (!lockoutTime) return;
    const interval = setInterval(async () => {
      const diff = lockoutTime - Date.now();
      if (diff <= 0) {
        setLockoutTime(null);
        setRemainingTime(0);
        await AsyncStorage.removeItem('@sabarish_lockout_until');
        await AsyncStorage.removeItem('@sabarish_failed_attempts');
        clearInterval(interval);
      } else {
        setRemainingTime(Math.ceil(diff / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handleKeyPress = async (digit: string) => {
    if (lockoutTime) {
      
      return;
    }

    
    setErrorMessage('');

    if (setupStep === 'login') {
      if (mpin.length >= 4) return;
      const updated = mpin + digit;
      setMpin(updated);

      if (updated.length === 4) {
        // Trigger login
        setTimeout(() => performLogin(updated), 100);
      }
    } else if (setupStep === 'new_pin') {
      if (newPin.length >= 4) return;
      const updated = newPin + digit;
      setNewPin(updated);

      if (updated.length === 4) {
        if (updated === '0909') {
          
          setErrorMessage('Cannot use the default MPIN (0909)');
          setNewPin('');
          return;
        }
        // Proceed to confirm step
        
        setSetupStep('confirm_pin');
      }
    } else if (setupStep === 'confirm_pin') {
      if (confirmPin.length >= 4) return;
      const updated = confirmPin + digit;
      setConfirmPin(updated);

      if (updated.length === 4) {
        if (updated !== newPin) {
          
          setErrorMessage('MPINs do not match. Try again.');
          setNewPin('');
          setConfirmPin('');
          setSetupStep('new_pin');
          return;
        }
        // Save new MPIN
        setTimeout(() => saveNewMpin(updated), 100);
      }
    }
  };

  const handleBackspace = () => {
    
    setErrorMessage('');
    if (setupStep === 'login') {
      setMpin(mpin.slice(0, -1));
    } else if (setupStep === 'new_pin') {
      setNewPin(newPin.slice(0, -1));
    } else if (setupStep === 'confirm_pin') {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const performLogin = async (enteredPin: string) => {
    const res = await loginWithMpin(enteredPin);
    if (res.success) {
      if (res.forceChangePin) {
        
        setFirstLoginUser(res.user);
        setSetupStep('new_pin');
        setErrorMessage('');
      } else {
        
        router.replace('/tabs');
      }
    } else {
      
      setMpin('');
      
      // Update failed attempts and lock if >= 5
      const attemptsStr = await AsyncStorage.getItem('@sabarish_failed_attempts');
      const attempts = (attemptsStr ? parseInt(attemptsStr, 10) : 0) + 1;
      await AsyncStorage.setItem('@sabarish_failed_attempts', attempts.toString());

      if (attempts >= 5) {
        const lockUntil = Date.now() + 5 * 60 * 1000; // 5 mins
        await AsyncStorage.setItem('@sabarish_lockout_until', lockUntil.toString());
        setLockoutTime(lockUntil);
        setRemainingTime(300);
        setErrorMessage('Too many failed attempts. Login locked for 5 minutes.');
      } else {
        setErrorMessage(`Invalid MPIN. (${5 - attempts} attempts remaining)`);
      }
    }
  };

  const saveNewMpin = async (completedPin: string) => {
    if (!firstLoginUser) return;
    const res = await completeFirstLogin(firstLoginUser.id, completedPin);
    if (res.success) {
      
      Alert.alert('Setup Complete', 'Your new MPIN has been saved successfully.', [
        {
          text: 'Continue',
          onPress: () => router.replace('/tabs'),
        },
      ]);
    } else {
      
      setErrorMessage(res.error || 'Failed to save new MPIN');
      setNewPin('');
      setConfirmPin('');
      setSetupStep('new_pin');
    }
  };

  const formatRemainingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (connecting) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Connecting to server...</Text>
      </SafeAreaView>
    );
  }

  const currentPinLength =
    setupStep === 'login'
      ? mpin.length
      : setupStep === 'new_pin'
      ? newPin.length
      : confirmPin.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Restaurant Header */}
      <LinearGradient
        colors={['#FFF7ED', '#FFD6A5', '#FFF']}
        locations={[0, 0.5, 1]}
        style={styles.hero}
      >
        <Image
          source={require('../../assets/logo.jpg')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Sabarish Foods</Text>
      </LinearGradient>

      {/* MPIN Input Area */}
      <View style={styles.inputSection}>
        <Text style={styles.welcomeText}>
          {setupStep === 'login'
            ? 'Enter Security MPIN'
            : setupStep === 'new_pin'
            ? 'Setup New MPIN'
            : 'Confirm New MPIN'}
        </Text>
        <Text style={styles.subtext}>
          {setupStep === 'login'
            ? lockoutTime
              ? `Login locked. Please wait ${formatRemainingTime(remainingTime)}`
              : 'Enter your 4-digit security code'
            : setupStep === 'new_pin'
            ? 'First-time setup: Choose a secure 4-digit MPIN'
            : 'Re-enter your new 4-digit code to verify'}
        </Text>

        {/* Pin Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentPinLength > index && styles.dotFilled,
                errorMessage.length > 0 && styles.dotError,
              ]}
            />
          ))}
        </View>

        {errorMessage.length > 0 && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}
      </View>

      {/* Numeric Keyboard */}
      <View style={styles.keyboardContainer}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIndex) => (
          <View key={rIndex} style={styles.keyboardRow}>
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                style={[styles.keyBtn, lockoutTime ? styles.keyDisabled : null]}
                disabled={!!lockoutTime || isLoading}
                onPress={() => handleKeyPress(digit)}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.keyboardRow}>
          <View style={styles.keyBtnEmpty} />
          <TouchableOpacity
            style={[styles.keyBtn, lockoutTime ? styles.keyDisabled : null]}
            disabled={!!lockoutTime || isLoading}
            onPress={() => handleKeyPress('0')}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.keyBtn}
            disabled={isLoading}
            onPress={handleBackspace}
          >
            <Ionicons name="backspace-outline" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>சபரிஷ் உணவகம் • KN பாளையம்</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  loadingSafe: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  logoImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 12,
  },
  appName: {
    color: '#7A3600',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#A04700',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  inputSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dotFilled: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    marginBottom: 20,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyBtnEmpty: {
    flex: 1,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 16,
    color: '#94A3B8',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
