/** How a pasted product-video link plays on the page. */
export interface VideoSource {
  kind: 'iframe' | 'file';
  src: string;
  /** A cover picture when the host gives one for free. */
  cover?: string;
}

const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d{6,12})/;
const FILE = /\.(mp4|webm|ogg)(\?.*)?$/i;

export function videoSource(url: string | undefined): VideoSource | null {
  if (!url) return null;
  const yt = YT.exec(url);
  if (yt) {
    return {
      kind: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&autoplay=1`,
      cover: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = VIMEO.exec(url);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  if (FILE.test(url)) return { kind: 'file', src: url };
  return null;
}
