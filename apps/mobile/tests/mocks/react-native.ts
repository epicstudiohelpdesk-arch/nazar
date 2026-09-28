import React from 'react';

export const View = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const Text = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('span', props, props.children);

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};
