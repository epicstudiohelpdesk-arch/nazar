export const randomUUID = (): string => '12345678-1234-1234-1234-123456789abc';

export enum CryptoDigestAlgorithm {
  SHA1 = 'SHA-1',
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512',
  MD2 = 'MD2',
  MD4 = 'MD4',
  MD5 = 'MD5',
}

export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

export const digestStringAsync = async (
  _algorithm: CryptoDigestAlgorithm,
  data: string,
  _options?: { encoding?: CryptoEncoding }
): Promise<string> => `mock_digest_${data}`;
