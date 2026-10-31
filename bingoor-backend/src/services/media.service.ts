/** Works out how a pasted video link can be played on the website. */
export interface VideoInfo {
  type: 'youtube' | 'vimeo' | 'file';
  /** What to put in an iframe (youtube / vimeo) or a <video> tag (file). */
  embedUrl: string;
  /** A cover image when the host gives us one for free. */
  thumbnail?: string;
}

const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d{6,12})/;
const FILE = /\.(mp4|webm|ogg)(\?.*)?$/i;

export function videoInfo(url: string): VideoInfo | null {
  const yt = YT.exec(url);
  if (yt) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`,
      thumbnail: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = VIMEO.exec(url);
  if (vimeo) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (FILE.test(url)) return { type: 'file', embedUrl: url };
  return null;
}

/** The shape the website and admin panel receive. */
export function presentMedia<T extends { kind: string; url: string; thumbnail?: string }>(item: T) {
  if (item.kind !== 'video') return item;
  const info = videoInfo(item.url);
  return { ...item, videoType: info?.type, embedUrl: info?.embedUrl, thumbnail: item.thumbnail || info?.thumbnail };
}
