import type { EntityImages } from "../../types";

/**
 * Analyzes a file path or URL string to identify whether it represents 
 * a direct video file, an embedded video streaming reference, or a standard image asset.
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
 * Parses raw configuration inputs to construct a valid URL path, resolving 
 * absolute external references, local directory locations, or raw Imgur hashes.
 */
export const getMediaUrl = (input: string | undefined | null): string => {
  if (!input) return '/placeholder.png';

  if (input.startsWith('http')) {
    return input;
  }

  if (input.includes('/') || input.includes('.')) {
    return input.startsWith('/') ? input : `/${input}`;
  }

  return `https://i.imgur.com/${input}.jpg`;
};

/**
 * Normalizes entity asset definitions across legacy array listings and structural theme object shapes 
 * to extract a valid source URL based on key precedence, array index indexing, and asset fallbacks.
 */
export const getEntityImage = (
  image: string[] | EntityImages | undefined, 
  priorityKey: keyof EntityImages = 'profileCard',
  index: number = 0
): string => {
  if (!image) return '/placeholder.png';

  if (!Array.isArray(image)) {
    const asset = image[priorityKey];
    
    if (Array.isArray(asset)) {
      const selected = asset[index] || asset[0];
      return getMediaUrl(selected);
    }
    
    if (typeof asset === 'string' && asset.trim() !== '') {
      return getMediaUrl(asset);
    }
    
    return image.profileCard ? getMediaUrl(image.profileCard) : '/placeholder.png';
  }

  const fallbackAsset = image[index] || image[0];
  return getMediaUrl(fallbackAsset);
};