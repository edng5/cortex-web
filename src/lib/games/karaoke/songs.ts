// Keyboard Karaoke's song list: the songs shown under "Song book" (anyone can also search YouTube
// or paste a link). Add your own here:
//   { id: '<YouTube video id>', title: 'Song', artist: 'Artist' }
// and optionally:
//   offset: seconds to shift the lyrics (+ later), when the video has an intro the recording hasn't;
//   chart: an UltraStar note chart (the text of a .txt), for the pitch guide and full scoring.
// Without a chart, lyrics are found automatically (LRCLIB) and the song is scored on timing and
// pitch control.

export interface Song {
	/** YouTube video id, or '' for a built-in song played by the game's own synth. */
	id: string;
	title: string;
	artist: string;
	offset?: number;
	chart?: string;
}

/**
 * The warm-up: a public-domain nursery rhyme with a full note chart, played on the game's synth
 * (no YouTube needed), to try the pitch guide and calibrate your microphone.
 */
export const WARMUP: Song = {
	id: '',
	title: 'Twinkle, Twinkle, Little Star',
	artist: 'Traditional (warm-up)',
	chart: `#TITLE:Twinkle, Twinkle, Little Star
#ARTIST:Traditional
#BPM:200
#GAP:2000
: 0 7 0 Twin
: 8 7 0 kle
: 16 7 7  twin
: 24 7 7 kle
: 32 7 9  lit
: 40 7 9 tle
: 48 15 7  star
- 64
: 64 7 5 How
: 72 7 5  I
: 80 7 4  won
: 88 7 4 der
: 96 7 2  what
: 104 7 2  you
* 112 15 0  are
- 128
: 128 7 7 Up
: 136 7 7  a
: 144 7 5 bove
: 152 7 5  the
: 160 7 4  world
: 168 7 4  so
: 176 15 2  high
- 192
: 192 7 7 Like
: 200 7 7  a
: 208 7 5  di
: 216 7 5 a
: 224 7 4 mond
: 232 7 4  in the
: 240 15 2  sky
- 256
: 256 7 0 Twin
: 264 7 0 kle
: 272 7 7  twin
: 280 7 7 kle
: 288 7 9  lit
: 296 7 9 tle
: 304 15 7  star
- 320
: 320 7 5 How
: 328 7 5  I
: 336 7 4  won
: 344 7 4 der
: 352 7 2  what
: 360 7 2  you
* 368 23 0  are
E`
};

/** The song book: add songs here (see the top of this file). */
export const SONGS: Song[] = [WARMUP];
