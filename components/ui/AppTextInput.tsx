import React, { useState, forwardRef } from 'react';
import { TextInput, TextInputProps, StyleSheet, Platform } from 'react-native';

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    // Filter out styles that might conflict or override the border
    const { style, onFocus, onBlur, ...rest } = props;

    return (
      <TextInput
        ref={ref}
        underlineColorAndroid="transparent"
        placeholderTextColor="#9ca3af"
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
        }}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          Platform.OS === 'web' && { outlineStyle: 'none' } as any,
          style,
        ]}
        {...rest}
      />
    );
  }
);

AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  inputFocused: {
    borderColor: '#FF7A3D',
    borderWidth: 2,
  },
});
