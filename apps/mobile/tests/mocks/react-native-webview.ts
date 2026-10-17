import React from 'react';
import { View } from 'react-native';

export const WebView = React.forwardRef<any, any>((props, ref) => {
  return React.createElement(View, { ...props, ref, testID: props.testID || 'mock-webview' });
});

export default WebView;
