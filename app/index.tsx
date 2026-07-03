import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store';

const { width, height } = Dimensions.get('window');

// Emojis for subtle background floating effect
const FOOD_ICONS = ['🍳', '🌶️', '🍚', '🥚', '🔥', '🍴', '🧅', '🌿', '⭐', '🥘', '🍗'];

export default function Index() {
  const { isLoading } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);

  // Animations
  const bgFloat = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Background floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgFloat, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bgFloat, { toValue: 0, duration: 8000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();

    // Entrance Animation Sequence
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Progress Bar Animation (for 5 seconds)
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Pulse animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.05, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // 5 second delay before redirect
    const timer = setTimeout(() => {
      setSplashDone(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading && splashDone) {
    return <Redirect href="/tabs" />;
  }

  // Background interpolation
  const translateY1 = bgFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const translateY2 = bgFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 15] });
  const progressBarWidth = progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a0b00', '#4a1e00', '#cc5500']}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Abstract floating food items in background */}
      {FOOD_ICONS.map((emoji, i) => {
        const isEven = i % 2 === 0;
        return (
          <Animated.Text
            key={i}
            style={[
              styles.floatingEmoji,
              {
                left: (i * 45) % width,
                top: (i * 85) % height,
                transform: [{ translateY: isEven ? translateY1 : translateY2 }],
                opacity: 0.08,
              }
            ]}
          >
            {emoji}
          </Animated.Text>
        );
      })}

      {/* Decorative Orbs */}
      <View style={[styles.orb, { top: -100, left: -100, backgroundColor: '#ff6600' }]} />
      <View style={[styles.orb, { bottom: -150, right: -100, backgroundColor: '#ff9933' }]} />

      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Logo Section */}
        <Animated.View 
          style={[
            styles.logoContainer, 
            { 
              opacity: logoOpacity, 
              transform: [{ scale: logoScale }, { scale: pulseScale }] 
            }
          ]}
        >
          <View style={styles.glowRing1} />
          <View style={styles.glowRing2} />
          <Image
            source={require('../assets/logo.jpg')}
            style={styles.logo}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Typography Section */}
        <Animated.View 
          style={[
            styles.textContainer, 
            { 
              opacity: contentOpacity, 
              transform: [{ translateY: contentTranslateY }] 
            }
          ]}
        >
          <Text style={styles.title}>சபரிஷ்</Text>
          <Text style={styles.subtitle}>உணவகம்</Text>
          
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>PREMIUM FAST FOOD</Text>
          </View>
        </Animated.View>
      </View>

      {/* Progress Bar Section */}
      <Animated.View style={[styles.progressWrapper, { opacity: contentOpacity }]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressBarWidth }]} />
        </View>
        <Text style={styles.loadingText}>சுவையாக சமைக்கிறோம்...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 24,
  },
  orb: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.15,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  glowRing1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 102, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 51, 0.3)',
  },
  glowRing2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 153, 51, 0.05)',
  },
  logo: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: -10,
  },
  subtitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#ff9933',
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 20,
  },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  progressWrapper: {
    position: 'absolute',
    bottom: 60,
    width: '65%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff9933',
    borderRadius: 2,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
