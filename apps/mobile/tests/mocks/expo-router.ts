import React from 'react';

export const Stack = (props: React.PropsWithChildren<Record<string, unknown>>) =>
  React.createElement('div', props, props.children);

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => true,
  setParams: () => {},
});

export const useLocalSearchParams = () => ({});
export const usePathname = () => '/';
export const useSegments = () => [];
export const useFocusEffect = (cb: () => void) => React.useEffect(cb, []);
