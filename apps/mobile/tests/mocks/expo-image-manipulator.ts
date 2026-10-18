export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
} as const;

export type SaveFormatType = (typeof SaveFormat)[keyof typeof SaveFormat];

export const manipulateAsync = async (
  uri: string,
  _actions: any[] = [],
  _saveOptions: any = {}
) => {
  return {
    uri,
    width: 800,
    height: 1000,
  };
};

export default {
  SaveFormat,
  manipulateAsync,
};
