import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING, SHADOW } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    
    onPress();
  };

  const sizeStyles = {
    sm: { height: 36, paddingHorizontal: SPACING.md, fontSize: FONTS.size.sm },
    md: { height: 48, paddingHorizontal: SPACING.xl, fontSize: FONTS.size.md },
    lg: { height: 56, paddingHorizontal: SPACING['2xl'], fontSize: FONTS.size.lg },
  }[size];

  if (variant === 'primary' || variant === 'secondary') {
    const gradColors = variant === 'primary'
      ? COLORS.gradients?.primary || [COLORS.primary, COLORS.primaryLight]
      : COLORS.gradients?.secondary || [COLORS.successDark, COLORS.success];

    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        style={[fullWidth && styles.fullWidth, style]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={gradColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.base,
            { height: sizeStyles.height, paddingHorizontal: sizeStyles.paddingHorizontal },
            SHADOW.colored(gradColors[0]),
            (disabled || loading) && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              {icon}
              <Text style={[styles.textLight, { fontSize: sizeStyles.fontSize }, textStyle]}>
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[
          styles.base,
          { height: sizeStyles.height, paddingHorizontal: sizeStyles.paddingHorizontal, backgroundColor: COLORS.danger },
          SHADOW.colored(COLORS.danger),
          (disabled || loading) && styles.disabled,
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <Text style={[styles.textLight, { fontSize: sizeStyles.fontSize }, textStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[
          styles.base,
          {
            height: sizeStyles.height,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: COLORS.primary,
          },
          (disabled || loading) && styles.disabled,
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {icon}
        <Text style={[styles.textPrimary, { fontSize: sizeStyles.fontSize }, textStyle]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  // Ghost
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      style={[
        styles.base,
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          backgroundColor: 'transparent',
        },
        (disabled || loading) && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {icon}
      <Text style={[{ color: colors.textSecondary, fontSize: sizeStyles.fontSize, fontWeight: FONTS.weight.medium }, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  textLight: {
    color: '#FFF',
    fontWeight: FONTS.weight.semiBold,
  },
  textPrimary: {
    color: COLORS.primary,
    fontWeight: FONTS.weight.semiBold,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});
