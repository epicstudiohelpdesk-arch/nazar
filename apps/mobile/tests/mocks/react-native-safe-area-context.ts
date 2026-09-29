import React from 'react';

export const useSafeAreaInsets = () => ({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
});

export const useSafeAreaFrame = () => ({
  x: 0,
  y: 0,
  width: 375,
  height: 812,
});

export const SafeAreaProvider = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const SafeAreaView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const SafeAreaInsetsContext = React.createContext({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
});
