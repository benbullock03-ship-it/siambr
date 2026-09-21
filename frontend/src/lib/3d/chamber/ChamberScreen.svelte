<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { untrack } from 'svelte';
	import { SRGBColorSpace, VideoTexture, type Texture } from 'three';
	import type { SittingClock } from '$lib/stage/clock.svelte';
	import { HAVE_METADATA, jumpedSince, screenPlan, variant360, type ClockMark } from '$lib/stage/screen';
	import type { ScreenSound } from '$lib/stage/screenVideo.svelte';

	/** One Senedd TV video for all four wall screens; `texture` is set only while a frame at t can show. */
	let {
		clock,
		stream,
		sound,
		held = false,
		texture = $bindable(null)
	}: { clock: SittingClock | null; stream: string | null; sound: ScreenSound; held?: boolean; texture?: Texture | null } = $props();

	const { invalidate } = useThrelte();
	let armed = $state(false);
	$effect(() => {
		if (!stream) armed = false;
		else if (clock?.playing) armed = true;
	});

	let video: HTMLVideoElement | null = null;
	let videoTexture: VideoTexture | null = null;
	let mark: ClockMark | null = null;
	let blank = true;
	let uploadedAt = -1;

	/** Fixed to the 360p variant: native HLS gets the variant URL, hls.js gets it with no master to switch from. */
	async function attach(el: HTMLVideoElement, masterUrl: string, t0: number): Promise<{ destroy(): void } | null> {
		const response = await fetch(masterUrl);
		if (!response.ok) throw new Error(`master playlist ${response.status}`);
		const src = variant360(await response.text(), masterUrl);
		if (!src) throw new Error('no 360p variant');
		if (el.canPlayType('application/vnd.apple.mpegurl')) {
			el.src = src;
			return null;
		}
		const { default: Hls } = await import('hls.js');
		if (!Hls.isSupported()) throw new Error('no Media Source Extensions');
		const hls = new Hls({ startPosition: t0 });
		hls.on(Hls.Events.ERROR, (_event, data) => {
			if (!data.fatal) return;
			console.warn('Siambr: Senedd TV stream stopped', data.details);
			sound.failed = true;
		});
		hls.loadSource(src);
		hls.attachMedia(el);
		return hls;
	}

	$effect(() => {
		if (!armed || !stream || sound.failed) return;
		const el = document.createElement('video');
		el.muted = true;
		el.playsInline = true;
		el.crossOrigin = 'anonymous';
		el.preload = 'auto';
		const tex = new VideoTexture(el);
		tex.colorSpace = SRGBColorSpace;
		const onSeeked = () => (blank = false);
		el.addEventListener('seeked', onSeeked);
		video = el;
		videoTexture = tex;

		let live = true;
		let hls: { destroy(): void } | null = null;
		attach(el, stream, untrack(() => clock?.t ?? 0)).then(
			(h) => (live ? (hls = h) : h?.destroy()),
			(error) => {
				if (!live) return;
				console.warn('Siambr: Senedd TV stream unavailable', error);
				sound.failed = true;
			}
		);

		return () => {
			live = false;
			hls?.destroy();
			el.removeEventListener('seeked', onSeeked);
			el.pause();
			el.removeAttribute('src');
			el.load();
			tex.dispose();
			video = null;
			videoTexture = null;
			texture = null;
			mark = null;
			blank = true;
			uploadedAt = -1;
		};
	});

	// A held or stopped clock pauses the video here too: a hidden tab runs no frames to do it.
	$effect(() => {
		if (held || !clock?.playing) video?.pause();
	});

	useTask(
		() => {
			const el = video;
			if (!el || !clock || el.readyState < HAVE_METADATA) {
				texture = null;
				return;
			}
			const now: ClockMark = { seeks: clock.seeks, speed: clock.speed };
			const jumped = jumpedSince(mark, now);
			mark = now;
			const plan = screenPlan({
				t: clock.t,
				playing: clock.playing && !held,
				speed: clock.speed,
				division: clock.floor.divisionTint !== null,
				jumped,
				blank,
				video: { time: el.currentTime, seeking: el.seeking, readyState: el.readyState }
			});
			if (plan.seekTo !== null) {
				if (jumped) blank = true;
				el.currentTime = plan.seekTo;
			}
			const muted = sound.muted || !plan.audible;
			if (el.muted !== muted) el.muted = muted;
			if (plan.play && el.paused && !el.ended) {
				el.play().catch((error: unknown) => {
					// The browser refused sound without a gesture: play muted and let the toggle say so.
					if ((error as DOMException)?.name !== 'NotAllowedError' || el.muted) return;
					sound.muted = true;
					el.muted = true;
					el.play().catch(() => {});
				});
			}
			else if (!plan.play && !el.paused) el.pause();
			// VideoTexture waits on requestVideoFrameCallback, which Chrome does not always fire for a
			// <video> outside the DOM; upload each new frame from here instead.
			if (plan.show === 'video' && videoTexture && el.currentTime !== uploadedAt) {
				videoTexture.needsUpdate = true;
				uploadedAt = el.currentTime;
				invalidate();
			}
			texture = plan.show === 'video' ? videoTexture : null;
		},
		{ autoInvalidate: false }
	);
</script>
