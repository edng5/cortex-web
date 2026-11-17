// Keyboard Karaoke: hearing each other in a room. The two players' browsers connect directly
// (WebRTC), set up through the room's own messages; the voices go straight from one to the other,
// live: nothing is recorded, and nothing passes through or stays on the site's server. (Public
// STUN servers only tell each browser its own internet address, to find a way through.)
//
// The host offers, the joiner answers. Each side's microphone (with its echo) can be switched in
// and out at any time without connecting again.

const STUN: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
/**
 * The servers that help the two browsers find each other. STUN alone fails on strict networks
 * (some mobile data, offices, campus Wi-Fi): then a TURN server passes the voices on, if the site
 * has one configured (fetched once from the site; nothing about the call is stored there).
 */
let ICE: RTCIceServer[] = STUN;
let iceLoaded: Promise<void> | null = null;
export function loadIce(): Promise<void> {
	iceLoaded ??= fetch('/api/games/karaoke?rtc=1')
		.then((r) => (r.ok ? r.json() : null))
		.then((j: { ice?: RTCIceServer[] } | null) => {
			if (j?.ice?.length) ICE = [...STUN, ...j.ice];
		})
		.catch(() => {});
	return iceLoaded;
}
export type LinkState = 'connecting' | 'connected' | 'failed' | 'closed';

export class VoiceLink {
	private pc: RTCPeerConnection;
	private audio = new Audio();
	private track: MediaStreamTrack | null = null;
	/** Hearing the other player (turning voice off stops this too). */
	private hearing = true;
	closed = false;

	constructor(
		/** Sends a message to the other player through the room. */
		private signal: (m: Record<string, unknown>) => void,
		/** The host (it makes the offer). */
		private offerer: boolean,
		/** Told when the connection comes up, drops or fails. */
		private onState: (s: LinkState) => void = () => {}
	) {
		this.audio.autoplay = true;
		this.pc = new RTCPeerConnection({ iceServers: ICE });
		this.pc.onicecandidate = (e) => e.candidate && this.signal({ k: 'rtc', ice: e.candidate.toJSON() });
		this.pc.onconnectionstatechange = () => {
			if (this.closed) return;
			const c = this.pc.connectionState;
			this.onState(c == 'connected' ? 'connected' : c == 'failed' ? 'failed' : c == 'closed' ? 'closed' : 'connecting');
		};
		this.onState('connecting');
		this.pc.ontrack = (e) => {
			this.audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
			this.audio.muted = !this.hearing;
			void this.audio.play().catch(() => {});
		};
		if (offerer) {
			this.pc.addTransceiver('audio', { direction: 'sendrecv' });
			void this.offer();
		}
	}
	private async offer() {
		const o = await this.pc.createOffer();
		await this.pc.setLocalDescription(o);
		this.signal({ k: 'rtc', sdp: this.pc.localDescription?.toJSON() });
	}
	/** Messages are handled one at a time, in order (an address can't come before the offer). */
	private chain: Promise<void> = Promise.resolve();
	/** A message from the other player's link. */
	handle(m: Record<string, unknown>) {
		this.chain = this.chain.then(() => this.take(m));
	}
	private async take(m: Record<string, unknown>) {
		if (this.closed) return;
		try {
			if (m.sdp) {
				const d = m.sdp as RTCSessionDescriptionInit;
				await this.pc.setRemoteDescription(d);
				if (d.type == 'offer') {
					// The joiner: send back as well as receive, with the microphone if it's on already.
					const tr = this.pc.getTransceivers()[0];
					if (tr) {
						tr.direction = 'sendrecv';
						if (this.track) await tr.sender.replaceTrack(this.track);
					}
					await this.pc.setLocalDescription(await this.pc.createAnswer());
					this.signal({ k: 'rtc', sdp: this.pc.localDescription?.toJSON() });
				}
			} else if (m.ice) await this.pc.addIceCandidate(m.ice as RTCIceCandidateInit);
		} catch (err) {
			console.warn('[karaoke voice]', err);
		}
	}
	/** Your voice to send (or null: silent). */
	async send(track: MediaStreamTrack | null) {
		this.track = track;
		const tr = this.pc.getTransceivers()[0];
		if (tr) await tr.sender.replaceTrack(track).catch(() => {});
	}
	/** Hear the other player, or not. */
	hear(on: boolean) {
		this.hearing = on;
		this.audio.muted = !on;
		if (on) void this.audio.play().catch(() => {});
	}
	/** Their voice's volume, 0..1. */
	setVolume(v: number) {
		this.audio.volume = Math.max(0, Math.min(1, v));
	}
	get connected() {
		return this.pc.connectionState == 'connected';
	}
	close() {
		if (!this.closed) this.onState('closed');
		this.closed = true;
		this.pc.close();
		this.audio.srcObject = null;
	}
}
