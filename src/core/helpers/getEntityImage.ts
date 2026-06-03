import type { EntityImages } from "../../types";

/**
 * Detects the type of media based on the file string.
 */
export const getMediaType = (file: string): 'video-file' | 'video-embed' | 'image' => {
  if (!file) return 'image';
  const lowercaseFile = file.toLowerCase();
  
  if (lowercaseFile.includes('youtube.com') || lowercaseFile.includes('youtu.be')) {
    return 'video-embed';
  }
  
  if (lowercaseFile.endsWith('.mp4') || lowercaseFile.endsWith('.webm') || lowercaseFile.endsWith('.ogg')) {
    return 'video-file';
  }
  
  return 'image';
};

/**
 * Centraal startpunt voor media-resolving.
 * Bepaalt of een string een externe URL, lokaal bestand of een Imgur-hash is.
 */
export const getMediaUrl = (input: string | undefined | null): string => {
  if (!input) return '/placeholder.png';

  // 1. Als het al een volledige externe URL is (bijv. YouTube of HTTPS link)
  if (input.startsWith('http')) {
    return input;
  }

  // 2. Als het een slash of extensie-punt bevat, is het een lokaal bestand (bijv. "assets/logo.png")
  if (input.includes('/') || input.includes('.')) {
    return input.startsWith('/') ? input : `/${input}`;
  }

  // 3. Geen slashes, geen punten en geen http? Dan is het een pure Imgur hash code!
  return `https://i.imgur.com/${input}.jpg`;
};

/**
 * Centrally manages entity image retrieval.
 * Supports structural keys (profileCard, heroBanner) and theme-specific keys.
 * * @param image The image object or legacy array
 * @param priorityKey The key to look for (default: profileCard)
 * @param index If the value is an array, which index to pick
 */
export const getEntityImage = (
  image: string[] | EntityImages | undefined, 
  priorityKey: keyof EntityImages = 'profileCard',
  index: number = 0
): string => {
  // 1. Fallback if no image data exists
  if (!image) return '/placeholder.png';

  // 2. Handle Structured Object (New Format)
  if (!Array.isArray(image)) {
    const asset = image[priorityKey];
    
    if (Array.isArray(asset)) {
      const selected = asset[index] || asset[0];
      return getMediaUrl(selected);
    }
    
    if (typeof asset === 'string' && asset.trim() !== '') {
      return getMediaUrl(asset);
    }
    
    // Fallback naar de structurele profileCard als de opgevraagde specifieke sleutel mist
    return image.profileCard ? getMediaUrl(image.profileCard) : '/placeholder.png';
  }

  // 3. Handle Simple Array (Legacy/Fallback Format)
  const fallbackAsset = image[index] || image[0];
  return getMediaUrl(fallbackAsset);
};