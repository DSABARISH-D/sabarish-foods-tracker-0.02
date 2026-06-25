import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  containerStyle?: ViewStyle;
  required?: boolean;
  hint?: string;
}

export function Input({
  label,
  error,
  prefix,
  suffix,
  containerStyle,
  required,
  hint,
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPasswordField = secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            {label}
            {required && <Text style={{ color: COLORS.danger }}> *</Text>}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderColor: error ? COLORS.danger : isFocused ? COLORS.primary : colors.border,
            borderWidth: isFocused ? 1.5 : 1,
          },
          SHADOW.sm,
        ]}
      >
        {prefix && (
          <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text>
        )}
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            prefix ? styles.inputWithPrefix : null,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPasswordField && !isPasswordVisible}
          {...props}
        />
        {suffix && (
          <Text style={[styles.suffix, { color: colors.textSecondary }]}>{suffix}</Text>
        )}
        {isPasswordField && (
          <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeBtn}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  labelRow: {
    marginBottom: 6,
  },
  label: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semiBold,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.regular,
    paddingVertical: SPACING.sm,
  },
  inputWithPrefix: {
    marginLeft: SPACING.xs,
  },
  prefix: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  suffix: {
    fontSize: FONTS.size.sm,
    marginLeft: SPACING.xs,
  },
  eyeBtn: {
    padding: 4,
  },
  error: {
    color: COLORS.danger,
    fontSize: FONTS.size.xs,
    marginTop: 4,
  },
  hint: {
    fontSize: FONTS.size.xs,
    marginTop: 4,
  },
});
