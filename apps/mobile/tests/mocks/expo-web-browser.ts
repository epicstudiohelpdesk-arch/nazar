export const maybeCompleteAuthSession = () => ({ type: 'dismiss' });
export const openAuthSessionAsync = async () => ({ type: 'dismiss' });
export const dismissAuthSession = () => {};

export default {
  maybeCompleteAuthSession,
  openAuthSessionAsync,
  dismissAuthSession,
};
