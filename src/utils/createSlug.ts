export const createSlug = (text: string, suffix?: string): string => {
  const baseSlug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0980-\u09FFa-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  const finalSuffix = suffix || Math.random().toString(36).substring(2, 7);

  return `${baseSlug}-${finalSuffix}`;
};
