export const makeRedirectUri = () => 'nazar://oauthredirect';

export const ResponseType = {
  Code: 'code',
  Token: 'token',
  IdToken: 'id_token',
};

export class AuthRequest {
  constructor(public config: any) {}
  async promptAsync() {
    return { type: 'dismiss' };
  }
}

export const exchangeCodeAsync = async () => ({
  idToken: 'mock-google-id-token',
  accessToken: 'mock-google-access-token',
});

export default {
  makeRedirectUri,
  ResponseType,
  AuthRequest,
  exchangeCodeAsync,
};
