"""Prose linter for Siambr UI copy, against DESIGN.md section 4 and the editorial standards it inherits.

Usage: python -m scripts.check_prose [PATH ...]

Lints the copy in frontend/src/**/*.svelte (text nodes and the spoken attributes) and the exported
``method`` strings of the derived stats. Prints one ``file:line: message`` per finding and exits 1 on any.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SVELTE_ROOT = REPO_ROOT / "frontend" / "src"
STATS_ROOT = REPO_ROOT / "frontend" / "static" / "data" / "stats"

MAX_WORDS = 32
# A block boundary that costs no newline, so findings keep their source line.
BREAK = "\x1f"

# Adjectives that grade a speech, a debate or a figure. Siambr states what happened, not how it felt.
SPIN_WORDS = (
    "heated", "fiery", "fierce", "furious", "angry", "controversial", "dramatic", "explosive", "blistering",
    "scathing", "damning", "passionate", "impassioned", "stunning", "remarkable", "historic", "landmark",
    "unprecedented", "shocking", "bombshell", "clash", "slams", "slammed", "blasts", "blasted", "outrage",
    "chaotic", "bitter", "extraordinary", "powerful", "compelling", "comprehensive", "cutting-edge",
    "seamless", "immersive",
)
SPIN = re.compile(r"\b(" + "|".join(re.escape(w) for w in SPIN_WORDS) + r")\b", re.IGNORECASE)
SPIN_PHRASES = re.compile(r"\bpowered by AI\b|\bAI[- ]powered\b", re.IGNORECASE)

NOMENCLATURE: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bplenary\b"), 'write "Plenary" (the Senedd\'s name for the meeting is capitalised)'),
    (re.compile(r"\bAssembly Members?\b|\bAMs\b"), 'write "Member of the Senedd" (the Assembly became the Senedd in 2020)'),
    (re.compile(r"\bMSs?\b"), 'write "Member of the Senedd" in copy, not the "MS" initials'),
    (re.compile(r"(?<!Y )(?<!y )\bLlywydd\b"), 'write "Y Llywydd" (the office carries the article)'),
    (re.compile(r"(?<!· )\bPresiding Officer\b"),'write "Y Llywydd" (English gloss only after the Welsh, as "Y Llywydd · Presiding Officer")'),
    (re.compile(r"\bWelsh Assembly\b|\bWelsh Parliament\b|\bNational Assembly\b"), 'write "Senedd Cymru"'),
    (re.compile(r"\bdebating chamber\b", re.IGNORECASE), 'write "Siambr" (the chamber has a name)'),
)

# Attributes that are read aloud or shown as copy.
SPOKEN_ATTRS = ("aria-label", "aria-description", "title", "placeholder", "alt")
INLINE_TAGS = {"a", "abbr", "b", "code", "em", "i", "kbd", "mark", "span", "strong", "sub", "sup", "time", "small", "q"}


@dataclass
class Finding:
    path: Path
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.path.relative_to(REPO_ROOT).as_posix()}:{self.line}: {self.message}"


def _blank(match: re.Match[str]) -> str:
    """Replace a span with whitespace that keeps every newline, so line numbers survive."""
    return re.sub(r"[^\n]", " ", match.group(0))


def _strip_mustaches(text: str) -> str:
    """Svelte expressions become one word; control blocks become a sentence boundary."""
    out: list[str] = []
    i = 0
    while i < len(text):
        if text[i] != "{":
            out.append(text[i])
            i += 1
            continue
        depth, j = 0, i
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        inner = text[i + 1:j]
        newlines = "\n" * inner.count("\n")
        out.append(newlines + (BREAK if inner[:1] in "#:/@" else " X "))
        i = j + 1
    return "".join(out)


def svelte_copy(source: str) -> str:
    """The copy a reader meets, with tags removed and line numbers preserved."""
    text = re.sub(r"<script\b[^>]*>.*?</script>", _blank, source, flags=re.DOTALL)
    text = re.sub(r"<style\b[^>]*>.*?</style>", _blank, text, flags=re.DOTALL)
    text = re.sub(r"<!--.*?-->", _blank, text, flags=re.DOTALL)
    text = _strip_mustaches(text)

    def tag(match: re.Match[str]) -> str:
        body = match.group(0)
        name = re.match(r"</?\s*([\w:.-]+)", body)
        spoken = [v for attr in SPOKEN_ATTRS for v in re.findall(rf'\b{attr}="([^"{{}}]*)"', body)]
        newlines = "\n" * body.count("\n")
        joiner = " " if name and name.group(1).lower() in INLINE_TAGS else BREAK
        return newlines + joiner + "".join(f"{v}{BREAK}" for v in spoken if v.strip())

    return re.sub(r"<[^>]*>", tag, text)


def sentences(text: str):
    """(line, sentence) pairs. Blocks end at a tag, a control block or a blank line; sentences at terminal punctuation."""
    text = re.sub(r"\n([ \t]*\n)", rf"\n{BREAK}\1", text)
    for block in re.finditer(rf"[^{BREAK}]+", text):
        line = text.count("\n", 0, block.start()) + 1
        for raw in re.split(r"(?<=[.!?])\s+", " ".join(block.group(0).split())):
            if raw.strip():
                yield line, raw.strip()


def lint_text(path: Path, text: str) -> list[Finding]:
    findings: list[Finding] = []
    for line, sentence in sentences(text):
        words = [w for w in sentence.split() if w != "X"]
        if len(words) > MAX_WORDS:
            findings.append(Finding(path, line, f"sentence of {len(words)} words (cap {MAX_WORDS}): {sentence[:70]}…"))
        for m in SPIN.finditer(sentence):
            findings.append(Finding(path, line, f'spin adjective "{m.group(0)}": {sentence[:70]}'))
        for m in SPIN_PHRASES.finditer(sentence):
            findings.append(Finding(path, line, f'banned phrase "{m.group(0)}"'))
        for pattern, message in NOMENCLATURE:
            for m in pattern.finditer(sentence):
                findings.append(Finding(path, line, f'"{m.group(0)}": {message}'))
    return findings


def lint_svelte(path: Path) -> list[Finding]:
    return lint_text(path, svelte_copy(path.read_text(encoding="utf-8")))


def lint_methods(root: Path = STATS_ROOT) -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(root.rglob("*.json")):
        method = json.loads(path.read_text(encoding="utf-8")).get("method")
        if isinstance(method, str):
            findings.extend(lint_text(path, method))
    return findings


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    paths = [Path(a) for a in args] or [SVELTE_ROOT]
    findings: list[Finding] = []
    files = 0
    for root in paths:
        for path in sorted(root.rglob("*.svelte") if root.is_dir() else [root]):
            files += 1
            findings.extend(lint_svelte(path))
    if not args:
        findings.extend(lint_methods())
    for f in findings:
        print(f)
    print(f"check_prose: {files} files, {len(findings)} findings")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
