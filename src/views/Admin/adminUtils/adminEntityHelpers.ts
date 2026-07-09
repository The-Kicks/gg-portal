/**
 * Formats image object properties into space-separated asset strings.
 * * @param imageObj - Raw image collection data
 * @returns Refined key-value asset map
 */
export const formatEntityImages = (imageObj: Record<string, unknown>): Record<string, string> => {
  const formatted: Record<string, string> = {};

  Object.keys(imageObj).forEach(key => {
    const value = imageObj[key];
    if (Array.isArray(value)) {
      formatted[key] = value
        .flatMap(v => typeof v === 'string' ? v.split(/[\s,]+/) : [])
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');
    } else if (typeof value === 'string') {
      formatted[key] = value
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');
    } else {
      formatted[key] = '';
    }
  });

  return formatted;
};

/**
 * Determines whether a given URL points to a video resource or platform.
 * * @param url - Destination link string
 */
export const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const videoPlatforms = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'streamable.com'];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some(ext => lowerUrl.includes(ext)) ||
    videoPlatforms.some(platform => lowerUrl.includes(platform))
  );
};

/**
 * Parses platform standard URLs into embedded iframe sources.
 * * @param url - Web link to be inspected
 * @returns Embedded source location or null if unmatched
 */
export const getVideoEmbedUrl = (url: string): string | null => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com/watch')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (lowerUrl.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (lowerUrl.includes('vimeo.com/')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  }
  return null;
};