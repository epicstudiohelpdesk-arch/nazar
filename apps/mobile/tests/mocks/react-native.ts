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

export const Vibration = {
  vibrate: (_pattern?: number | number[]) => {},
  cancel: () => {},
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  isScreenReaderEnabled: async () => false,
  announceForAccessibility: (_announcement: string) => {},
  addEventListener: (_event: string, _handler: any) => ({ remove: () => {} }),
};

export class AnimatedValue {
  constructor(public val: number) {}
  setValue(v: number) {
    this.val = v;
  }
  interpolate(_config: any) {
    return this;
  }
}

export class AnimatedValueXY {
  constructor(public val: { x: number; y: number } = { x: 0, y: 0 }) {}
  setValue(v: { x: number; y: number }) {
    this.val = v;
  }
}

export const Animated = {
  Value: AnimatedValue,
  ValueXY: AnimatedValueXY,
  timing: (_val: any, _config: any) => ({
    start: (cb?: any) => {
      cb?.({ finished: true });
    },
    stop: () => {},
  }),
  spring: (_val: any, _config: any) => ({
    start: (cb?: any) => {
      cb?.({ finished: true });
    },
    stop: () => {},
  }),
  parallel: (_animations: any[]) => ({
    start: (cb?: any) => {
      cb?.({ finished: true });
    },
    stop: () => {},
  }),
  sequence: (_animations: any[]) => ({
    start: (cb?: any) => {
      cb?.({ finished: true });
    },
    stop: () => {},
  }),
  loop: (_animation: any) => ({
    start: (cb?: any) => {
      cb?.({ finished: true });
    },
    stop: () => {},
  }),
  View: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, props.children),
};

export const Keyboard = {
  dismiss: () => {},
  addListener: () => ({ remove: () => {} }),
};

export const TouchableWithoutFeedback = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const KeyboardAvoidingView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const InputAccessoryView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const Modal = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const StatusBar = (_props: Record<string, unknown>) => null;

export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android ?? obj.ios ?? obj.default,
};
