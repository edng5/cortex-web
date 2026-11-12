// Hoops POC: body tracking from the webcam, in the browser. MediaPipe's pose model finds 33 body
// points in each camera frame; we keep only a few numbers per frame (see features()). No video is
// recorded, stored or sent anywhere: frames go straight from the camera to the model and are dropped.

const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** One body point: x, y in 0..1 of the camera image (y down), and how sure the model is. */
export interface Pt {
	x: number;
	y: number;
	/** Depth (toward the camera is smaller), roughly in the same units as x, from the hips. */
	z?: number;
	visibility?: number;
}
export type Pose = Pt[];

// MediaPipe's body point numbers.
export const P = {
	nose: 0,
	lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
	lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28
} as const;

export interface Tracker {
	stop(): void;
}

/** Starts the camera and the pose model; calls `onPose` for every frame with a body in it. */
export async function startTracking(video: HTMLVideoElement, onPose: (pose: Pose, t: number) => void, onStatus: (s: string) => void): Promise<Tracker> {
	onStatus('Loading the body tracker…');
	const vision = await import(/* @vite-ignore */ `${TASKS}/vision_bundle.mjs`);
	const fileset = await vision.FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
	const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
		baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
		runningMode: 'VIDEO',
		numPoses: 1
	});
	onStatus('Asking for the camera…');
	const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
	video.srcObject = stream;
	await video.play();
	onStatus('');
	let raf = 0;
	let last = -1;
	const loop = () => {
		raf = requestAnimationFrame(loop);
		if (video.readyState < 2 || video.currentTime == last) return;
		last = video.currentTime;
		const t = performance.now();
		const res = landmarker.detectForVideo(video, t);
		if (res.landmarks?.[0]) onPose(res.landmarks[0] as Pose, t);
	};
	loop();
	return {
		stop() {
			cancelAnimationFrame(raf);
			stream.getTracks().forEach((tr) => tr.stop());
			landmarker.close?.();
		}
	};
}

// ── The few numbers kept per frame ──
const angle = (a: Pt, b: Pt, c: Pt) => {
	const v1 = [a.x - b.x, a.y - b.y];
	const v2 = [c.x - b.x, c.y - b.y];
	const d = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]) || 1;
	return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180) / Math.PI;
};

/**
 * A frame as 8 small numbers, measured against the player's own shoulders (so it doesn't matter how
 * far from the camera they stand): each wrist's height above its shoulder, elbow and knee bends,
 * how low the hips are, and how far apart the hands are.
 */
export function features(p: Pose): number[] {
	const sw = Math.hypot(p[P.lShoulder].x - p[P.rShoulder].x, p[P.lShoulder].y - p[P.rShoulder].y) || 0.1;
	const hipY = (p[P.lHip].y + p[P.rHip].y) / 2;
	const ankleY = (p[P.lAnkle].y + p[P.rAnkle].y) / 2;
	return [
		(p[P.lShoulder].y - p[P.lWrist].y) / sw,
		(p[P.rShoulder].y - p[P.rWrist].y) / sw,
		angle(p[P.lShoulder], p[P.lElbow], p[P.lWrist]) / 180,
		angle(p[P.rShoulder], p[P.rElbow], p[P.rWrist]) / 180,
		angle(p[P.lHip], p[P.lKnee], p[P.lAnkle]) / 180,
		angle(p[P.rHip], p[P.rKnee], p[P.rAnkle]) / 180,
		(ankleY - hipY) / sw,
		Math.abs(p[P.lWrist].x - p[P.rWrist].x) / sw
	];
}

/**
 * Where the body is in the picture (mirrored, so moving to your right is +): the middle of the
 * hips across, the hips' height, the shoulder width (bigger = closer to the camera), and the
 * hands' middle across.
 */
export function body(p: Pose) {
	return {
		cx: 1 - (p[P.lHip].x + p[P.rHip].x) / 2,
		hipY: (p[P.lHip].y + p[P.rHip].y) / 2,
		sw: Math.hypot(p[P.lShoulder].x - p[P.rShoulder].x, p[P.lShoulder].y - p[P.rShoulder].y) || 0.1,
		handX: 1 - (p[P.lWrist].x + p[P.rWrist].x) / 2,
		/**
		 * Lean: how far the shoulders (and head) are toward the camera (+) or away (-) from the hips,
		 * in shoulder widths. Leaning toward the camera moves you forward.
		 */
		lean: -(((p[P.lShoulder].z ?? 0) + (p[P.rShoulder].z ?? 0) + (p[P.nose].z ?? 0)) / 3 - ((p[P.lHip].z ?? 0) + (p[P.rHip].z ?? 0)) / 2) / (Math.hypot(p[P.lShoulder].x - p[P.rShoulder].x, p[P.lShoulder].y - p[P.rShoulder].y) || 0.1),
		/**
		 * Which way the body is turned, from the shoulders' depth (radians; + = turned to the
		 * player's own right: the left shoulder comes toward the camera, the right one goes back).
		 */
		yaw: Math.atan2((p[P.rShoulder].z ?? 0) - (p[P.lShoulder].z ?? 0), Math.abs(p[P.lShoulder].x - p[P.rShoulder].x) || 0.01),
		/**
		 * The torso's length (shoulders to hips) in the picture: smaller when you step back from the
		 * camera, but (unlike the shoulders' width) the same when you turn.
		 */
		torso: Math.hypot((p[P.lShoulder].x + p[P.rShoulder].x - p[P.lHip].x - p[P.rHip].x) / 2, (p[P.lShoulder].y + p[P.rShoulder].y - p[P.lHip].y - p[P.rHip].y) / 2) || 0.1,
		/** How sure the model is that the upper body is in view (0..1). */
		seen: Math.min(p[P.lShoulder].visibility ?? 1, p[P.rShoulder].visibility ?? 1, p[P.lHip].visibility ?? 1, p[P.rHip].visibility ?? 1)
	};
}

/** Packs features into whole numbers (-127..127) for saving: 8 bytes a frame. */
export const quantize = (f: number[]) => f.map((v) => Math.max(-127, Math.min(127, Math.round(v * 40))));
export const dequantize = (q: number[]) => q.map((v) => v / 40);
