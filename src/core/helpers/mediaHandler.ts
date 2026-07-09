/**
 * Resolves a raw media input string into a web-ready browser URL by evaluating formatting criteria:
 * - Returns a universal fallback asset path if the input is empty or undefined.
 * - Returns the input directly if it contains path characters indicating a local file structure or absolute external URL.
 * - Appends the input to the standard Imgur CDN domain prefix as a raw hash string default fallback.
 */
export const getMediaUrl = (input: string | undefined | null): string => {
  if (!input) return '/assets/placeholder-image.png';

  if (input.includes('/') || input.includes('.')) {
    return input;
  }

  return `https://i.imgur.com/${input}.jpg`;
};