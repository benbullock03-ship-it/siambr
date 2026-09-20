import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DossierPlate from './DossierPlate.svelte';
import { dossier, speech } from '$lib/dossier/fixtures';

const plate = dossier({
	source_xml_url: 'https://record.senedd.wales/Plenary/2026-06-10.xml',
	senedd_tv_clip_url: 'https://senedd.tv/clip/1',
	contributions: [
		speech('m1', 'labour', 'First Minister', { video_timestamp_start: 60, video_timestamp_end: 120 }),
		speech('c1', 'conservatives', null, { spoken_language: 'cy' })
	]
});

describe('DossierPlate', () => {
	afterEach(cleanup);

	it('is a labelled modal dialog that takes focus on open', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		const dialog = screen.getByRole('dialog', { name: 'Fixture item' });
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('closes on Escape', async () => {
		const onclose = vi.fn();
		render(DossierPlate, { dossier: plate, onclose });
		await userEvent.keyboard('{Escape}');
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('traps Tab and Shift+Tab inside the drawer', async () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		const dialog = screen.getByRole('dialog');
		const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
		const first = focusables[0];
		const last = focusables[focusables.length - 1];

		last.focus();
		await userEvent.tab();
		expect(document.activeElement).toBe(first);

		await userEvent.tab({ shift: true });
		expect(document.activeElement).toBe(last);
	});

	it('restores focus to the opener when unmounted', () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();
		const { unmount } = render(DossierPlate, { dossier: plate, onclose: () => {} });
		unmount();
		expect(document.activeElement).toBe(opener);
		opener.remove();
	});

	it('renders verbatim speeches with their speaker, role and language', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		expect(document.getElementById('speech-c1')).toBeTruthy();
		expect(screen.getByText('First Minister')).toBeTruthy();
		expect(screen.getByText('Fixture text c1.')).toBeTruthy();
		expect(screen.getByLabelText('Spoken in Welsh')).toBeTruthy();
	});

	it('links the timestamped broadcast and the official record', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		const tv = screen.getByRole('link', { name: /Watch on Senedd TV/ });
		expect(tv.getAttribute('href')).toBe('https://senedd.tv/clip/1?startPos=60');
		const cite = screen.getByRole('link', { name: /Official Record of Proceedings/ });
		expect(cite.getAttribute('href')).toBe('https://record.senedd.wales/Plenary/2026-06-10.xml');
	});
});
