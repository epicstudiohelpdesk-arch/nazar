import React from 'react';

export const View = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const Text = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('span', props, props.children);

export const TouchableOpacity = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('button', props, props.children);

export const Pressable = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('button', props, props.children);

export const ScrollView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const TextInput = (props: Record<string, unknown>) => React.createElement('input', props);

export const Image = (props: Record<string, unknown>) => React.createElement('img', props);

export const ActivityIndicator = (props: Record<string, unknown>) =>
  React.createElement('div', props);

export const SafeAreaView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const FlatList = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const RefreshControl = (props: Record<string, unknown>) => React.createElement('div', props);

export const Dimensions = {
  get: (_type: string) => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};
