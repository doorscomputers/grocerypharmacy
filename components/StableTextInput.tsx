import React, { useCallback, memo, useRef, useEffect } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { TextInput, TextInputProps } from 'react-native-paper';

interface StableTextInputProps extends Omit<TextInputProps, 'onChangeText' | 'value' | 'defaultValue'> {
  onChangeText: (text: string) => void;
  value: string;
}

/**
 * StableTextInput - Fixes cursor jumping issue in React Native Paper TextInput
 *
 * The fix: Use `defaultValue` instead of `value` to make the input uncontrolled,
 * which prevents cursor jumping. We use a ref to sync values when needed.
 *
 * Source: https://github.com/callstack/react-native-paper/issues/2565
 */
export const StableTextInput = memo(function StableTextInput({
  onChangeText,
  value,
  ...props
}: StableTextInputProps) {
  const inputRef = useRef<RNTextInput>(null);
  const lastValueRef = useRef(value);

  // Sync value from parent only when it changes externally (not from typing)
  useEffect(() => {
    if (inputRef.current && value !== lastValueRef.current) {
      // Value changed from outside (e.g., clearing form, loading data)
      inputRef.current.setNativeProps({ text: value });
      lastValueRef.current = value;
    }
  }, [value]);

  const handleChangeText = useCallback((text: string) => {
    lastValueRef.current = text;
    onChangeText(text);
  }, [onChangeText]);

  return (
    <TextInput
      {...props}
      ref={inputRef as any}
      defaultValue={value}
      onChangeText={handleChangeText}
    />
  );
});

export default StableTextInput;
