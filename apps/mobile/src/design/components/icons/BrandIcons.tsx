import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Official Google multi-color G icon
 */
export const GoogleIcon: React.FC<IconProps> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

/**
 * Official Apple vector glyph
 */
export const AppleIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 170 170" fill="none">
    <Path
      d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.19-9.35-11.13-20.2-14.81-32.55-3.69-12.35-5.54-23.75-5.54-34.19 0-14.9 3.73-27.14 11.2-36.72 7.47-9.58 16.92-14.48 28.34-14.71 4.58 0 9.77 1.25 15.57 3.74 5.8 2.49 9.53 3.8 11.2 3.92 1.67-.12 5.56-1.46 11.66-4.04 6.1-2.58 11.18-3.74 15.24-3.47 11.29.56 20.47 4.7 27.52 12.43-9.84 5.99-14.66 14.28-14.46 24.87.21 8.5 3.42 15.68 9.64 21.55 6.22 5.87 13.43 9.28 21.63 10.23-2.13 6.42-4.53 12.34-7.21 17.76zm-31.54-106.6c0 6.64-2.4 12.7-7.2 18.17-4.8 5.48-10.74 8.89-17.81 10.24-.22-1.35-.33-2.6-.33-3.74 0-6.42 2.5-12.63 7.51-18.64 5.01-6.01 11.02-9.44 18.03-10.29.11 1.45.17 2.87.17 4.26z"
      fill={color}
    />
  </Svg>
);

/**
 * Sleek biometric / Passkey key icon
 */
export const PasskeyIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5-2 2 1.5 1.5-2 2 1.5 1.5-1 1"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="7.5"
      cy="16.5"
      r="4.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="7.5" cy="16.5" r="1.5" fill={color} />
  </Svg>
);

/**
 * Nazar signature eye emblem
 */
export const NazarEmblem: React.FC<IconProps> = ({ size = 36, color = '#E63920' }) => (
  <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <Defs>
      <LinearGradient id="nazarEyeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FF4A32" />
        <Stop offset="100%" stopColor="#C91807" />
      </LinearGradient>
    </Defs>
    <Path
      d="M18 6C10.5 6 4.2 11.4 1.5 18c2.7 6.6 9 12 16.5 12s13.8-5.4 16.5-12C31.8 11.4 25.5 6 18 6z"
      stroke="url(#nazarEyeGrad)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="18" cy="18" r="6" stroke="#FFFFFF" strokeWidth={2} fill={color} />
    <Circle cx="18" cy="18" r="2.5" fill="#FFFFFF" />
  </Svg>
);
