import React, { useState } from 'react';
import { TextInput, type TextInputProps } from './TextInput.js';

export interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry' | 'rightIcon'> {
  readonly showToggle?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  showToggle = true,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(true);

  return (
    <TextInput
      secureTextEntry={isSecure}
      leftIcon="lock"
      rightIcon={showToggle ? (isSecure ? 'eye' : 'eyeOff') : undefined}
      onRightIconPress={() => setIsSecure(!isSecure)}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
    />
  );
};

export const PasswordField = PasswordInput;
