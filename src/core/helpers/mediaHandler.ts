/**
 * Resolves een media-input (lokaal bestand, volledige externe URL of een Imgur-code)
 * naar een bruikbare URL voor de browser.
 */
export const getMediaUrl = (input: string | undefined | null): string => {
  if (!input) return '/assets/placeholder-image.png'; // Zorg voor een universele fallback asset

  // RegEx / Check logica:
  // Als de invoer een slash (/) of een punt (.) bevat, is het een lokaal pad of al een volledige URL.
  if (input.includes('/') || input.includes('.')) {
    return input;
  }

  // Zo niet, dan behandelen we het als een pure Imgur-code.
  // We plakken er standaard '.jpg' achter; Imgur's CDN linkt hier automatisch direct naar het juiste mediabestand.
  return `https://i.imgur.com/${input}.jpg`;
};