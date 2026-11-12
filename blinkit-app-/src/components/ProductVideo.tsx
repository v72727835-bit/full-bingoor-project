import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import React, { useState } from 'react';
import { Image, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, hitSlop, ms, radius, space, themed } from '../theme';
import { Txt } from '../ui/Text';

/** Same link rules as the website (bingoor-web/src/lib/video.ts). */
const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d{6,12})/;
const FILE = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

export interface VideoSource {
  kind: 'iframe' | 'file';
  src: string;
  cover?: string;
}

export function videoSource(url?: string): VideoSource | null {
  if (!url) return null;
  const yt = YT.exec(url);
  if (yt) {
    return {
      kind: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&autoplay=1&playsinline=1`,
      cover: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = VIMEO.exec(url);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&playsinline=1` };
  if (FILE.test(url) || /\/uploads\//.test(url)) return { kind: 'file', src: url };
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** One small HTML page plays both uploaded files and YouTube/Vimeo links inside the WebView. */
function playerHtml(v: VideoSource) {
  const media =
    v.kind === 'file'
      ? `<video src="${esc(v.src)}" controls autoplay playsinline></video>`
      : `<iframe src="${esc(v.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}video,iframe{width:100%;height:100%;border:0;object-fit:contain}</style>
</head><body>${media}</body></html>`;
}

/** "Watch video" tile under the gallery; opens a full-screen player. */
export function ProductVideo({ url, name }: { url?: string; name: string }) {
  const video = videoSource(url);
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  if (!video) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`Watch the ${name} video`}
      >
        {video.cover ? <Image source={{ uri: video.cover }} style={styles.cover} /> : <View style={[styles.cover, styles.coverBlank]} />}
        <View style={styles.play}>
          <Ionicons name="play" size={ms(16)} color="#fff" />
        </View>
        <Txt variant="label" weight="700" style={styles.label}>
          Watch product video
        </Txt>
        <Ionicons name="chevron-forward" size={ms(18)} color={colors.ink} />
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.player}>
          {open ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: playerHtml(video), baseUrl: 'https://bingoor.com' }}
              style={{ width, height: Math.min(height * 0.8, width * 1.78), backgroundColor: '#000', flex: 0 }}
              javaScriptEnabled
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
            />
          ) : null}
          <Pressable onPress={() => setOpen(false)} hitSlop={hitSlop} style={styles.close} accessibilityRole="button" accessibilityLabel="Close video">
            <Ionicons name="close" size={ms(22)} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = themed(({ c }) => ({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginTop: space.sm,
    padding: space.xs,
    paddingRight: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  cover: { width: ms(64), height: ms(40), borderRadius: radius.sm, backgroundColor: '#000' },
  coverBlank: { backgroundColor: '#222' },
  play: {
    position: 'absolute',
    left: space.xs + ms(20),
    top: '50%',
    marginTop: -ms(12),
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: c.ink },
  player: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    top: ms(44),
    right: ms(18),
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
