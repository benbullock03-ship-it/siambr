import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ScreenAudio from './ScreenAudio.svelte';
import { ScreenSound } from '../screenVideo.svelte';

const AUDIO_TRACK = 'Audio: English interpretation (Senedd TV)';
const SCREEN_CREDIT = '© Senedd Commission · Senedd TV';
const NO_STREAM = 'No Senedd TV stream for this sitting.';

describe('ScreenAudio', () => {
	afterEach(cleanup);

	it('starts with sound on and names the track and the credit', () => {
		render(ScreenAudio, { sound: new ScreenSound(), available: true, missing: false });
		expect(screen.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByText(AUDIO_TRACK)).toBeTruthy();
		expect(screen.getByText(SCREEN_CREDIT)).toBeTruthy();
		expect(screen.queryByText(NO_STREAM)).toBeNull();
	});

	it('toggles mute from the keyboard', async () => {
		const sound = new ScreenSound();
		render(ScreenAudio, { sound, available: true, missing: false });
		const user = userEvent.setup();
		await user.tab();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mute' }));
		await user.keyboard('{Enter}');
		expect(sound.muted).toBe(true);
		expect(screen.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('true');
		await user.keyboard(' ');
		expect(sound.muted).toBe(false);
	});

	it('shows one line and no credit for a sitting with no stream', () => {
		render(ScreenAudio, { sound: new ScreenSound(), available: false, missing: true });
		expect(screen.getByText(NO_STREAM)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
		expect(screen.queryByText(SCREEN_CREDIT)).toBeNull();
	});

	it('says when the recording carries no timestamp to anchor it', () => {
		const { container } = render(ScreenAudio, { sound: new ScreenSound(), available: true, missing: false, unanchored: true });
		expect(container.textContent).toContain('not clock-anchored');
		expect(screen.getByText(AUDIO_TRACK)).toBeTruthy();
	});

	it('shows nothing where the screens do not run', () => {
		const { container } = render(ScreenAudio, { sound: new ScreenSound(), available: false, missing: false });
		expect(container.textContent?.trim()).toBe('');
	});
});

describe('ScreenAudio track switch', () => {
	afterEach(cleanup);

	it('offers English interpretation and the floor audio when both feeds exist', async () => {
		const sound = new ScreenSound();
		render(ScreenAudio, { sound, available: true, missing: false, verbatim: true });
		const english = screen.getByRole('button', { name: 'English' });
		const spoken = screen.getByRole('button', { name: 'As spoken' });
		expect(english.getAttribute('aria-pressed')).toBe('true');
		expect(spoken.getAttribute('aria-pressed')).toBe('false');
		await userEvent.setup().click(spoken);
		expect(sound.feed).toBe('verbatim');
		expect(spoken.getAttribute('aria-pressed')).toBe('true');
		expect(screen.getByText('Audio: as spoken in the Siambr (Senedd TV)')).toBeTruthy();
		expect(screen.queryByText(AUDIO_TRACK)).toBeNull();
	});

	it('has no switch when only the interpretation feed exists', () => {
		render(ScreenAudio, { sound: new ScreenSound(), available: true, missing: false });
		expect(screen.queryByRole('button', { name: 'As spoken' })).toBeNull();
		expect(screen.getByText(AUDIO_TRACK)).toBeTruthy();
	});
});
