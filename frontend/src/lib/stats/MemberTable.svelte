<script lang="ts">
	import type { MemberStat } from '$lib/data/types';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import { count, duration } from './format';

	let { rows, caption }: { rows: MemberStat[]; caption: string } = $props();

	type Key = 'canonical_name' | 'party_id' | 'seconds' | 'contributions' | 'untimed_contributions';
	const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
		{ key: 'canonical_name', label: 'Member', numeric: false },
		{ key: 'party_id', label: 'Party', numeric: false },
		{ key: 'seconds', label: 'Speaking time', numeric: true },
		{ key: 'contributions', label: 'Contributions', numeric: true },
		{ key: 'untimed_contributions', label: 'Untimed', numeric: true }
	];

	let key = $state<Key>('seconds');
	let descending = $state(true);

	const sorted = $derived.by(() => {
		const dir = descending ? -1 : 1;
		return [...rows].sort((a, b) => {
			const x = a[key];
			const y = b[key];
			const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
			return dir * cmp || a.member_id.localeCompare(b.member_id);
		});
	});

	function sortBy(next: Key) {
		if (next === key) descending = !descending;
		else {
			key = next;
			descending = next !== 'canonical_name' && next !== 'party_id';
		}
	}
</script>

<table>
	<caption class="small">{caption}</caption>
	<thead>
		<tr>
			{#each COLUMNS as c (c.key)}
				<th scope="col" aria-sort={key === c.key ? (descending ? 'descending' : 'ascending') : 'none'}>
					<button type="button" onclick={() => sortBy(c.key)}>
						{c.label}<span aria-hidden="true">{key === c.key ? (descending ? ' ▼' : ' ▲') : ''}</span>
					</button>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sorted as r (r.member_id)}
			<tr>
				<th scope="row"><a href="/members/{r.member_id}">{r.canonical_name}</a></th>
				<td><span class="party" style:--party={partyColor(r.party_id)}>{partyLabel(r.party_id)}</span></td>
				<td data-numeric>{duration(r.seconds)}</td>
				<td data-numeric>{count(r.contributions)}</td>
				<td data-numeric>{count(r.untimed_contributions)}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	caption {
		text-align: left;
		color: var(--color-body-text);
		padding-bottom: 0.5rem;
	}

	th,
	td {
		padding: 0.45rem 0.5rem 0.45rem 0;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	thead th {
		padding: 0;
		border-bottom: 1px solid var(--color-rule-strong);
	}

	thead button {
		width: 100%;
		min-height: var(--tap-min);
		padding: 0 0.5rem 0 0;
		background: none;
		border: 0;
		text-align: left;
		font: 600 var(--text-small) var(--font-sans);
		color: var(--color-ink);
		cursor: pointer;
	}

	tbody th {
		font-weight: 600;
	}

	.party::before {
		content: '';
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.35em;
		background: var(--party);
		border-radius: 50%;
	}
</style>
