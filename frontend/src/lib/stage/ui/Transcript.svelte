<script lang="ts">
	import type { MemberLight, Sitting, TabledText } from '$lib/data/types';
	import { memberOf, speakerName } from '$lib/data/speaker';
	import { BADGE } from '$lib/data/provenance';
	import { partyColor, partyLabel } from '$lib/dossier/parties';
	import DivisionPlate from '$lib/hud/DivisionPlate.svelte';
	import ExternalLink from '$lib/hud/ExternalLink.svelte';
	import type { SittingClock } from '../clock.svelte';
	import type { Beat, DivisionBeat } from '../timeline';
	import { agreedAmendmentTexts, debateItemOf, itemTitle, memberNamed, readMotion, tabledTextFor, tabledTextsOf, targetLabel, type VoteTarget } from '../votes';

	let { clock, sitting }: { clock: SittingClock; sitting: Sitting } = $props();

	const live = $derived<Beat | null>(clock.floor.live);
	const contribution = $derived(live?.kind === 'contribution' ? live.contribution : null);
	const speaker = $derived<MemberLight | null>(contribution ? memberOf(sitting.speakers, contribution) : null);
	const item = $derived(live ? (sitting.items.find((i) => i.id === live.itemId) ?? null) : null);
	const untimed = $derived(live?.kind === 'contribution' && !live.timed);
	let portraitFailed = $state(false);
	$effect(() => {
		void speaker?.id;
		portraitFailed = false;
	});

	// Votes: every division beat, the debate each one decided, and the call that opened it.
	const divisionBeats = $derived(clock.timeline.beats.filter((b): b is DivisionBeat => b.kind === 'division'));
	const votesByDebate = $derived.by(() => {
		const out = new Map<string, DivisionBeat[]>();
		for (const b of divisionBeats) {
			const debate = debateItemOf(b.division, sitting.items);
			if (debate) out.set(debate.id, [...(out.get(debate.id) ?? []), b]);
		}
		return out;
	});
	/** The vote this contribution calls, if it is one of Y Llywydd's calls. */
	const calledVote = $derived(contribution ? (divisionBeats.find((b) => b.calledBy === contribution.id) ?? null) : null);
	/** Votes decided later on the debate now on the floor. */
	const laterVotes = $derived(live?.kind === 'contribution' && item ? (votesByDebate.get(item.id) ?? []) : []);
	const vote = $derived(live?.kind === 'division' ? live : null);
	const reading = $derived(vote ? readMotion(vote.division.motion_text) : null);
	const debate = $derived(vote ? debateItemOf(vote.division, sitting.items) : null);
	const debateBoundary = $derived(debate ? (clock.timeline.items.find((i) => i.id === debate.id) ?? null) : null);
	const votesInItem = $derived(vote ? divisionBeats.filter((b) => b.itemId === vote.itemId) : []);
	const voteOrdinal = $derived(vote ? votesInItem.findIndex((b) => b.index === vote.index) + 1 : 0);
	const caller = $derived(vote?.calledBy ? (sitting.contributions.find((c) => c.id === vote.calledBy) ?? null) : null);
	const callerBeat = $derived(caller ? (clock.timeline.beats[clock.timeline.beatIndexByContributionId.get(caller.id) ?? -1] ?? null) : null);
	const callerName = $derived(caller ? speakerName(caller, sitting.speakers) : '');
	const total = $derived(vote ? vote.division.votes_for + vote.division.votes_against + vote.division.votes_abstain : 0);
	// The printed text the vote decided, the Member who tabled it, and every text tabled for the debate.
	const votedText = $derived(vote ? tabledTextFor(vote.division, sitting) : null);
	const tabler = $derived(reading ? memberNamed(reading.tabledBy, sitting.speakers) : null);
	const debateTexts = $derived(debate ? tabledTextsOf(debate.id, sitting) : []);
	const debateVotes = $derived(debate ? (votesByDebate.get(debate.id) ?? []) : []);
	const agreedAmendments = $derived(
		debateVotes
			.map((b) => ({ target: readMotion(b.division.motion_text).target, result: b.division.result }))
			.filter((v): v is { target: { kind: 'amendment'; number: number }; result: 'agreed' } => v.target.kind === 'amendment' && v.result === 'agreed')
			.map((v) => v.target.number)
			.sort((a, b) => a - b)
	);
	const lines = (t: TabledText) => t.text_english.split(/\n+/).map((l) => l.trim()).filter(Boolean);
	const agreedTexts = $derived(vote ? agreedAmendmentTexts(vote.division, debateVotes.map((b) => b.division), sitting) : []);
	/** How each vote on a printed text went, in the order the divisions were taken. */
	const outcomesOf = (t: TabledText) =>
		debateVotes
			.map((b) => ({ beat: b, target: readMotion(b.division.motion_text).target as VoteTarget, result: b.division.result }))
			.filter(({ target }) => (t.kind === 'amendment' ? target.kind === 'amendment' && target.number === t.amendment_number : target.kind !== 'amendment'));
	const share = (n: number) => (total ? `${(n / total) * 100}%` : '0%');

	// Auto-scroll: the text advances with the beat's real pace and yields to the visitor's own
	// scrolling until the next contribution starts.
	let column = $state<HTMLElement>();
	let held = $state(false);
	let lastBeatIndex = -1;
	let programmatic = 0;
	// The scroll range is measured on resize, never on a tick: reading layout every frame forces it.
	let range = $state(0);
	let lastTop = -1;
	$effect(() => {
		const el = column;
		void live;
		if (!el) return;
		const measure = () => (range = el.scrollHeight - el.clientHeight);
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		for (const child of el.children) observer.observe(child);
		measure();
		return () => observer.disconnect();
	});
	$effect(() => {
		const beat = live;
		const t = clock.t;
		const el = column;
		if (!el || !beat) return;
		if (beat.index !== lastBeatIndex) {
			lastBeatIndex = beat.index;
			held = false;
			programmatic = 1;
			el.scrollTop = lastTop = 0;
		}
		if (held || beat.kind === 'division') return;
		const length = beat.tEnd - beat.t;
		const k = length > 0 ? Math.min(1, Math.max(0, (t - beat.t) / length)) : 0;
		const top = Math.round(range * k);
		if (top !== lastTop) {
			programmatic = 1;
			el.scrollTop = lastTop = top;
		}
	});
	function onscroll() {
		if (programmatic) {
			programmatic = 0;
			return;
		}
		held = true;
	}
	const hold = () => (held = true);
</script>

<section class="transcript" aria-label="Transcript">
	{#if contribution}
		<header class="head">
			{#if speaker?.portrait_url && !portraitFailed}
				<img class="portrait" src={speaker.portrait_url} alt="" width="64" height="64" loading="lazy" onerror={() => (portraitFailed = true)} />
			{/if}
			<div>
				{#if item}<p class="kicker">{item.title_en}</p>{/if}
				{#if speaker}
					<h2 class="name">{speaker.canonical_name}</h2>
					{#if speaker.cymraeg_name && speaker.cymraeg_name !== speaker.canonical_name}
						<p class="name-cy" lang="cy">{speaker.cymraeg_name}</p>
					{/if}
					<p class="meta small">
						<span class="party" style:--party={partyColor(speaker.party_id)}>{partyLabel(speaker.party_id)}</span>
						<span>{speaker.constituency_name_en}</span>
						{#if speaker.role_title_en}<span>· {speaker.role_title_en}</span>{/if}
						<span class="lang">{contribution.lang === 'cy' ? 'Cymraeg' : 'English'}</span>
					</p>
				{:else}
					<h2 class="name">{contribution.speaker_name ?? 'Speaker not named'}</h2>
					<p class="meta small">
						{#if contribution.speaker_role}<span>· {contribution.speaker_role}</span>{/if}
						<span class="lang">{contribution.lang === 'cy' ? 'Cymraeg' : 'English'}</span>
					</p>
					<p class="meta small unattributed">The Record does not attribute this speech to a Member.</p>
				{/if}
			</div>
		</header>

		{#if calledVote}
			{@const r = readMotion(calledVote.division.motion_text)}
			{@const d = debateItemOf(calledVote.division, sitting.items)}
			<button type="button" class="link-card calls" onclick={() => clock.seek(calledVote.t)}>
				<span class="link-kicker">Calls a vote</span>
				<span class="link-title">{targetLabel(r.target)}{#if r.tabledBy}, tabled by {r.tabledBy}{/if}</span>
				<span class="link-sub small">on {d ? itemTitle(d.title_en) : r.topic}</span>
				<span class="link-go small">Result <span aria-hidden="true">→</span></span>
			</button>
		{:else if laterVotes.length}
			<button type="button" class="link-card later" onclick={() => clock.seek(laterVotes[0].t)}>
				<span class="link-kicker">Goes to a vote</span>
				<span class="link-title">{laterVotes.length === 1 ? 'One division' : `${laterVotes.length} divisions`} at Voting Time</span>
				<span class="link-sub small">{laterVotes.map((b) => targetLabel(readMotion(b.division.motion_text).target)).join(' · ')}</span>
				<span class="link-go small">Jump to the votes <span aria-hidden="true">→</span></span>
			</button>
		{/if}

		<!-- A scrolling region must take focus so a keyboard can scroll it and Space can play from it. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="body" bind:this={column} {onscroll} onwheel={hold} ontouchmove={hold} role="group" aria-label="Contribution text" tabindex="0">
			<p class="badge small">{BADGE.verbatim}</p>
			<div class="text" lang={contribution.lang}>
				{#each contribution.text_original.split(/\n+/) as para, i (i)}
					<p>{para}</p>
				{/each}
			</div>
			{#if contribution.lang === 'cy'}
				<p class="rule small" role="separator">Official English translation</p>
				<div class="text translation" lang="en">
					{#each contribution.text_english.split(/\n+/) as para, i (i)}
						<p>{para}</p>
					{/each}
				</div>
			{/if}
			<p class="small tv">
				{#if untimed}
					No broadcast timestamp published for this contribution.
				{:else if contribution.tv_url}
					<ExternalLink href={contribution.tv_url}>Watch this moment on Senedd TV</ExternalLink>
				{/if}
			</p>
			{#if sitting.record_page_url}
				<p class="small record"><ExternalLink href={sitting.record_page_url}>Read this in the Record</ExternalLink></p>
			{/if}
		</div>
	{:else if vote && reading}
		<header class="head vote-head" class:agreed={vote.division.result === 'agreed'}>
			<div class="vote-titles">
				<p class="kicker">{item ? item.title_en : 'Division'}{#if votesInItem.length > 1}<span class="sep" aria-hidden="true">·</span>Vote {voteOrdinal} of {votesInItem.length}{/if}</p>
				<h2 class="name">{targetLabel(reading.target)}</h2>
				{#if reading.tabledBy}<p class="meta small">Tabled in the name of {reading.tabledBy}</p>{/if}
			</div>
			<p class="verdict" aria-label="Result">{vote.division.result === 'agreed' ? 'Agreed' : 'Not agreed'}</p>
		</header>

		<div class="body plate" bind:this={column}>
			<div class="on">
				<p class="kicker">On the debate</p>
				<p class="on-title">{debate ? itemTitle(debate.title_en) : reading.topic}</p>
				<p class="on-actions small">
					{#if debateBoundary}
						<button type="button" class="text-button" onclick={() => clock.seek(debateBoundary.firstTimedT ?? debateBoundary.t)}>Replay the debate</button>
					{/if}
					{#if debate}
						<a href="/register?item={encodeURIComponent(debate.id)}">Read it in the Register</a>
					{/if}
				</p>
			</div>

			<section class="voted" aria-label="What was voted on">
				<p class="kicker">What was voted on</p>
				{#if votedText}
					{@const [head, ...body] = lines(votedText)}
					<p class="badge small">{BADGE.verbatim} · as tabled</p>
					{#if reading.target.kind === 'motion_as_amended'}
						<p class="small as-amended">
							The Record prints no merged text. The Senedd agreed the motion as changed by
							{agreedAmendments.length ? `amendment${agreedAmendments.length > 1 ? 's' : ''} ${agreedAmendments.join(', ')}` : 'no agreed amendment'}
							(from the division results). Each agreed amendment is printed first, then the motion as tabled.
						</p>
						{#each agreedTexts as t (t.id)}
							{@const [ahead, ...abody] = lines(t)}
							{@const amender = memberNamed(ahead.replace(/^Amendment\s+\d+\s*[—–-]?\s*/i, ''), sitting.speakers)}
							<article class="tabled-item agreed-amendment">
								<p class="voted-head">
									<span>{ahead}</span>
									{#if amender?.party_id}<span class="party-tag" style:--party={partyColor(amender.party_id)} title="Derived by Siambr from the Members register">{partyLabel(amender.party_id)}</span>{/if}
									<span class="outcome agreed static">Agreed</span>
								</p>
								<div class="text tabled" lang="en">
									{#each abody as para, i (i)}<p>{para}</p>{/each}
								</div>
							</article>
						{/each}
						<p class="kicker sub">The motion as tabled</p>
					{/if}
					<p class="voted-head">
						<span>{head}</span>
						{#if tabler?.party_id}<span class="party-tag" style:--party={partyColor(tabler.party_id)} title="Derived by Siambr from the Members register">{partyLabel(tabler.party_id)}</span>{/if}
					</p>
					<div class="text tabled" lang="en">
						{#each body as para, i (i)}<p>{para}</p>{/each}
					</div>
					{#if votedText.lang === 'cy'}
						<details class="cy">
							<summary class="small">Yn Gymraeg · as printed</summary>
							<div class="text tabled" lang="cy">
								{#each votedText.text_original.split(/\n+/).filter((l) => l.trim()) as para, i (i)}<p>{para}</p>{/each}
							</div>
						</details>
					{/if}
				{:else}
					<p class="small">The Record prints no text for this {targetLabel(reading.target).toLowerCase()} at the head of the debate.</p>
				{/if}
			</section>

			<div class="tally" role="img" aria-label="{vote.division.votes_for} for, {vote.division.votes_against} against, {vote.division.votes_abstain} abstained">
				<div class="bar" aria-hidden="true">
					<span class="for" style:width={share(vote.division.votes_for)}></span>
					<span class="abstain" style:width={share(vote.division.votes_abstain)}></span>
					<span class="against" style:width={share(vote.division.votes_against)}></span>
				</div>
				<p class="figures" data-numeric>
					<span class="for"><strong>{vote.division.votes_for}</strong> for</span>
					<span class="abstain"><strong>{vote.division.votes_abstain}</strong> abstain</span>
					<span class="against"><strong>{vote.division.votes_against}</strong> against</span>
				</p>
			</div>

			{#if caller}
				<figure class="call">
					<p class="badge small">{BADGE.verbatim} · {callerName}</p>
					<blockquote lang="en">{caller.text_english}</blockquote>
					{#if callerBeat}
						<figcaption class="small"><button type="button" class="text-button" onclick={() => clock.seek(callerBeat.t)}>Replay the call</button></figcaption>
					{/if}
				</figure>
			{/if}

			{#if debateTexts.length}
				<details class="all-texts">
					<summary>Every text tabled for this debate <span class="small" data-numeric>{debateTexts.length}</span></summary>
					<p class="badge small">{BADGE.verbatim} · as tabled</p>
					{#each debateTexts as t (t.id)}
						{@const [head, ...body] = lines(t)}
						{@const outcomes = outcomesOf(t)}
						<article class="tabled-item" class:current={votedText?.id === t.id}>
							<p class="voted-head">
								<span>{head}</span>
								{#each outcomes as o (o.beat.index)}
									<button type="button" class="outcome" class:agreed={o.result === 'agreed'} onclick={() => clock.seek(o.beat.t)} title="Go to this vote">
										{o.target.kind === 'motion_as_amended' ? 'As amended: ' : ''}{o.result === 'agreed' ? 'Agreed' : 'Not agreed'}
									</button>
								{:else}
									<span class="outcome none">No division</span>
								{/each}
							</p>
							<div class="text tabled small" lang="en">
								{#each body as para, i (i)}<p>{para}</p>{/each}
							</div>
						</article>
					{/each}
				</details>
			{/if}

			<DivisionPlate division={vote.division} speakers={sitting.speakers} items={sitting.items} date={sitting.date} context={false} members />
			{#if vote.division.casting_vote}
				<p class="small">Y Llywydd's casting vote was cast {vote.division.casting_vote}. It sits outside the tally.</p>
			{/if}
			{#if vote.division.source_url}
				<p class="small tv"><ExternalLink href={vote.division.source_url}>The Record's Votes document for this meeting</ExternalLink></p>
			{/if}
		</div>
	{:else}
		<div class="body empty">
			<p class="small">No one holds the floor. Press Play, or choose a contribution from the running order.</p>
		</div>
	{/if}
</section>

<style>
	.transcript {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--color-ground);
		font-family: var(--font-sans);
	}

	.head {
		display: flex;
		gap: 0.9rem;
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.portrait {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: var(--rounded-small);
		background: var(--color-panel);
	}

	.kicker {
		margin: 0 0 0.2rem;
	}

	.name {
		margin: 0;
		font: 600 1.25rem var(--font-serif);
	}

	.name-cy {
		margin: 0;
		font-family: var(--font-serif);
		color: var(--color-timber-cedar-dark);
	}

	.meta {
		margin: 0.25rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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

	.lang {
		margin-left: auto;
		padding: 0 0.4rem;
		border: 1px solid var(--color-border);
		font-family: var(--font-mono);
	}

	/* A vote's own head: cedar rule, the question as the title, the verdict set against it. */
	.vote-head {
		align-items: flex-start;
		justify-content: space-between;
		border-left: 4px solid var(--color-timber-cedar);
		padding-left: calc(1.25rem - 4px);
		background: var(--color-panel);
	}

	.vote-head.agreed {
		border-left-color: var(--color-success);
	}

	.vote-titles {
		min-width: 0;
	}

	.sep {
		margin: 0 0.4em;
	}

	.verdict {
		flex-shrink: 0;
		margin: 0;
		padding: 0.25rem 0.6rem;
		font: 700 var(--text-small) var(--font-sans);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-ground);
		background: var(--color-timber-cedar-dark);
	}

	.agreed .verdict {
		background: var(--color-success);
	}

	/* The cross-link between a speech and its vote, in either direction. */
	.link-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'kicker go' 'title go' 'sub go';
		gap: 0 0.75rem;
		width: 100%;
		margin: 0;
		padding: 0.6rem 1.25rem;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		border-left: 4px solid var(--color-timber-cedar);
		padding-left: calc(1.25rem - 4px);
		background: var(--color-panel);
		color: var(--color-ink);
		text-align: left;
		font-family: var(--font-sans);
		cursor: pointer;
	}

	.link-card:hover {
		background: #e4e1d6;
	}

	.link-kicker {
		grid-area: kicker;
		font-size: var(--text-kicker);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-timber-cedar-dark);
	}

	.link-title {
		grid-area: title;
		font: 600 1rem var(--font-serif);
	}

	.link-sub {
		grid-area: sub;
		color: var(--color-body-text);
	}

	.link-go {
		grid-area: go;
		align-self: center;
		font-weight: 600;
		color: var(--color-accent-plum-dark);
		white-space: nowrap;
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem 1.25rem 1.5rem;
	}

	.badge {
		margin: 0 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
	}

	.text p {
		font-family: var(--font-serif);
		font-size: 1.05rem;
		line-height: 1.65;
		margin: 0 0 0.9em;
	}

	.rule {
		margin: 1rem 0 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-rule-strong);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
	}

	.translation p {
		color: var(--color-body-text);
	}

	.tv {
		margin-top: 1rem;
	}

	.record {
		margin-top: 0.35rem;
	}

	.on {
		margin: 0 0 1rem;
	}

	.on-title {
		margin: 0;
		font: 600 1.15rem var(--font-serif);
		color: var(--color-ink);
	}

	.on-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin: 0.35rem 0 0;
	}

	.text-button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 600;
		color: var(--color-accent-plum-dark);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.on-actions a {
		font-weight: 600;
		color: var(--color-body-text);
	}

	.voted {
		margin: 0 0 1.25rem;
		padding: 0.75rem 1rem 0.5rem;
		border-left: 3px solid var(--color-timber-cedar);
		background: var(--color-panel);
	}

	/* Muted grey reads 4.1:1 on the panel tint; the kicker needs 4.5:1 at 12 px. */
	.vote-head .kicker,
	.voted .kicker {
		color: var(--color-body-text);
	}

	.voted .badge {
		margin-bottom: 0.35rem;
	}

	.voted-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem;
		font: 600 1.05rem var(--font-serif);
		color: var(--color-ink);
	}

	.party-tag {
		padding: 0 0.45rem;
		font: 600 var(--text-kicker) var(--font-sans);
		color: var(--color-ground);
		background: var(--party);
		border-radius: var(--rounded-pill);
	}

	.as-amended {
		margin: 0 0 0.5rem;
		color: var(--color-body-text);
	}

	.text.tabled p {
		font-size: 0.98rem;
		line-height: 1.55;
		margin: 0 0 0.6em;
	}

	.text.tabled.small p {
		font-size: 0.9rem;
	}

	.cy summary {
		cursor: pointer;
		color: var(--color-body-text);
	}

	.all-texts {
		margin: 0 0 1.25rem;
		border-top: 1px solid var(--color-rule-strong);
		padding-top: 0.75rem;
	}

	.all-texts > summary {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		min-height: var(--tap-min);
		cursor: pointer;
		font-weight: 600;
	}

	.all-texts > summary .small {
		color: var(--color-muted);
	}

	.tabled-item {
		padding: 0.6rem 0 0.4rem 0.75rem;
		border-left: 3px solid var(--color-border);
		margin-bottom: 0.5rem;
	}

	.tabled-item.current,
	.tabled-item.agreed-amendment {
		border-left-color: var(--color-timber-cedar);
	}

	.tabled-item.agreed-amendment {
		margin-bottom: 1rem;
	}

	.kicker.sub {
		margin: 0.25rem 0 0.4rem;
	}

	.outcome.static {
		cursor: default;
	}

	.outcome {
		padding: 0.1rem 0.5rem;
		border: 0;
		background: var(--color-timber-cedar-dark);
		color: var(--color-ground);
		font: 700 var(--text-kicker) var(--font-sans);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		cursor: pointer;
	}

	.outcome.agreed {
		background: var(--color-success);
	}

	.outcome.none {
		background: none;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		cursor: default;
	}

	.tally {
		margin: 0 0 1.25rem;
	}

	.bar {
		display: flex;
		height: 0.7rem;
		background: var(--color-inset-bar);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
	}

	.bar .for,
	.figures .for strong {
		color: var(--color-success);
	}

	.bar .for {
		background: var(--color-success);
	}

	.bar .against {
		background: var(--color-timber-cedar-dark);
	}

	.figures .against strong {
		color: var(--color-timber-cedar-dark);
	}

	.bar .abstain {
		background: #8c8979;
	}

	.figures {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.35rem 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-small);
		color: var(--color-body-text);
	}

	.figures strong {
		font-size: 1.1rem;
	}

	.call {
		margin: 0 0 1.25rem;
		padding: 0.75rem 1rem;
		border-left: 3px solid var(--color-border);
		background: var(--color-panel);
	}

	.call blockquote {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 1rem;
		line-height: 1.55;
	}

	.call figcaption {
		margin-top: 0.4rem;
	}

	.plate :global(.division) {
		border-top: 1px solid var(--color-rule-strong);
		padding-top: 1rem;
	}

	.plate :global(.division h3) {
		font-size: 1rem;
		color: var(--color-body-text);
	}

	.empty {
		display: grid;
		place-items: center;
		text-align: center;
	}
</style>
