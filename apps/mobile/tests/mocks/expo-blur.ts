import React from 'react';

export const BlurView = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export default BlurView;
