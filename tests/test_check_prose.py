"""T-24: the prose linter reads Svelte copy the way a reader meets it and applies DESIGN.md section 4."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import check_prose

SVELTE = """<script lang="ts">
\tconst heated = 'not copy';
\t// a fiery comment is not copy either
</script>

<h1>Plenary Register</h1>
<p class="lede">
\tPlenary sittings of Senedd Cymru, newest first. Every speech is quoted verbatim from the
\tRecord of Proceedings.
</p>
{#if open}
\t<p>A heated debate in the plenary, led by the Llywydd and three AMs.</p>
{/if}
<button aria-label="Close guide" title="Dismiss the fierce clash">x</button>
<a href="/register">Register</a>

<style>
\t.lede { color: controversial; }
</style>
"""


class ProseLinterTests(unittest.TestCase):
    def lint(self, source: str) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "Sample.svelte"
            path.write_text(source, encoding="utf-8")
            return [f.message for f in check_prose.lint_svelte(path)], [f.line for f in check_prose.lint_svelte(path)]

    def test_script_style_and_comments_are_not_copy(self):
        messages, _ = self.lint(SVELTE)
        self.assertFalse(any("controversial" in m for m in messages), messages)
        self.assertEqual(sum("heated" in m for m in messages), 1)

    def test_findings_name_the_rule_and_the_line(self):
        messages, lines = self.lint(SVELTE)
        joined = "\n".join(messages)
        self.assertIn('spin adjective "heated"', joined)
        self.assertIn('"plenary": write "Plenary"', joined)
        self.assertIn('"Llywydd": write "Y Llywydd"', joined)
        self.assertIn('"AMs": write "Member of the Senedd"', joined)
        self.assertIn('spin adjective "fierce"', joined)
        self.assertIn('spin adjective "clash"', joined)
        self.assertEqual({lines[messages.index(m)] for m in messages if "heated" in m}, {12})

    def test_a_long_sentence_is_capped(self):
        long = "<p>" + " ".join(["word"] * (check_prose.MAX_WORDS + 1)) + ".</p>"
        messages, _ = self.lint(long)
        self.assertEqual(len(messages), 1)
        self.assertIn(f"sentence of {check_prose.MAX_WORDS + 1} words", messages[0])
        short = "<p>" + " ".join(["word"] * check_prose.MAX_WORDS) + ".</p>"
        self.assertEqual(self.lint(short)[0], [])

    def test_expressions_count_as_one_word_and_blocks_end_sentences(self):
        source = "<p>{count} contributions on record {#if x}newest first{/if} " + " ".join(["w"] * 28) + "</p>"
        self.assertEqual(self.lint(source)[0], [])

    def test_y_llywydd_and_the_gloss_pass(self):
        messages, _ = self.lint("<p>Y Llywydd · Presiding Officer</p><p>Y Llywydd calls the vote.</p>")
        self.assertEqual(messages, [])

    def test_the_exported_method_strings_pass(self):
        self.assertEqual([str(f) for f in check_prose.lint_methods()], [])


if __name__ == "__main__":
    unittest.main()
