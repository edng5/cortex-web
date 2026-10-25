// Normalises a node's `images` + `videos` into renderable media items.
import type { OntologyNode } from '$lib/types';

export type MediaItem =
	| { kind: 'image'; src: string; caption?: string }
	| { kind: 'embed'; src: string; embedUrl: string; provider: 'youtube' | 'vimeo'; thumb?: string; caption?: string }
	| { kind: 'video'; src: string; caption?: string };

export function youtubeId(url: string): string | null {
	const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
	return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
	const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
	return m ? m[1] : null;
}

export function toVideoItem(src: string, caption?: string): MediaItem | null {
	const yt = youtubeId(src);
	// youtube-nocookie: no tracking cookies until the visitor presses play.
	if (yt)
		return {
			kind: 'embed',
			provider: 'youtube',
			src,
			embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
			thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
			caption
		};
	const vm = vimeoId(src);
	if (vm) return { kind: 'embed', provider: 'vimeo', src, embedUrl: `https://player.vimeo.com/video/${vm}?dnt=1`, caption };
	if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(src)) return { kind: 'video', src, caption };
	return null;
}

/** Items for a named in-text carousel (`carousels.<name>` in frontmatter). */
export function carouselMedia(node: OntologyNode, name: string): MediaItem[] {
	return (node.carousels[name] ?? []).map(
		(src): MediaItem => toVideoItem(src, node.captions[src]) ?? { kind: 'image', src, caption: node.captions[src] }
	);
}

/**
 * Videos first (they're usually the richest), then images. `inline`: media shown inside the
 * panel (small screens), which uses `mobileImages` when the node has them.
 */
export function nodeMedia(node: OntologyNode, inline = false): MediaItem[] {
	const videos = node.videos
		.map((v) => toVideoItem(v, node.captions[v]))
		.filter((m): m is MediaItem => m !== null);
	const srcs = inline && node.mobileImages?.length ? node.mobileImages : node.images;
	const images: MediaItem[] = srcs.map((src) => ({ kind: 'image', src, caption: node.captions[src] }));
	return [...videos, ...images];
}
