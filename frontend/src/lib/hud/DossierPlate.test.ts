import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DossierPlate from './DossierPlate.svelte';
import { dossier, member, speech } from '$lib/dossier/fixtures';

const plate = dossier({
	sitting: {
		date: '2026-06-10',
		id: 'session-1',
		meeting_id: null,
		term: 7,
		source_xml_url: 'https://record.senedd.wales/Plenary/2026-06-10.xml',
		record_page_url: 'https://record.senedd.wales/Plenary/1',
		record_published_at: '2026-06-11T06:00:00',
		meeting_start_time: '13:30:00'
	},
	item: { ...dossier().item, clip_url: 'https://senedd.tv/clip/1' },
	contributions: [
		speech('m1', { t_start: 60, t_end_derived: 120, tv_url: 'https://senedd.tv/clip/1?startPos=60' }),
		speech('c1', { lang: 'cy', text_original: 'Testun Cymraeg c1.', text_english: 'Welsh text c1.' })
	],
	speakers: {
		'ms-m1': member('ms-m1', 'Member One', { party_id: 'labour', role_title_en: 'First Minister' }),
		'ms-c1': member('ms-c1', 'Member Two', { party_id: 'conservatives' })
	}
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

	it('renders verbatim speeches with speaker, role, party and language from the sitting file', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		expect(document.getElementById('speech-c1')).toBeTruthy();
		expect(screen.getByText('Member One')).toBeTruthy();
		expect(screen.getByText('First Minister')).toBeTruthy();
		expect(screen.getByText('Testun Cymraeg c1.')).toBeTruthy();
		expect(screen.getByText('Welsh text c1.')).toBeTruthy();
		expect(screen.getByLabelText('Spoken in Welsh')).toBeTruthy();
	});

	it('badges the derived grouping and shows when the Senedd published the record', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		expect(screen.getByText('Item types and policy domains grouped by Siambr engine — speeches verbatim.')).toBeTruthy();
		expect(screen.getByText('2026-06-11 06:00:00')).toBeTruthy();
	});

	it('links the timestamped broadcast, the stage moment and the official record', () => {
		render(DossierPlate, { dossier: plate, onclose: () => {} });
		const tv = screen.getByRole('link', { name: /Watch on Senedd TV/ });
		expect(tv.getAttribute('href')).toBe('https://senedd.tv/clip/1?startPos=60');
		const stage = screen.getByRole('link', { name: /Watch it play in the chamber/ });
		expect(stage.getAttribute('href')).toBe('/sitting/2026-06-10?t=60');
		const cite = screen.getByRole('link', { name: /Official Record of Proceedings/ });
		expect(cite.getAttribute('href')).toBe('https://record.senedd.wales/Plenary/2026-06-10.xml');
		const record = screen.getAllByRole('link', { name: 'Read this in the Record' });
		expect(record.length).toBe(plate.contributions.length);
		expect(record.every((a) => a.getAttribute('href') === 'https://record.senedd.wales/Plenary/1')).toBe(true);
	});
});
