import React from 'react';

export const Stack = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);
