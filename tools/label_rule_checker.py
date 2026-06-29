#!/usr/bin/env python3
"""
Validate annotation JSON files under a works root.

Layout: {root}/{subfolder}/annotations/{subfolder}_pNNN.json

25 fps; 1 frame = 40 ms.

Paired highlight windows are stripped in memory (file unchanged) before all
checks except highlight marker pairing.

Reports five severity groups: Critical, Very bad, Bad, Recommended, Suspicious.
Exits 1 if any Critical, Very bad, or Bad findings exist.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

FRAME_MS = 40
MIN_GAP_MS = 80
MIN_PAIR_FRAMES = 6
REFEREE_MIN_FRAMES = 4
TACKLE_FOUL_LOOKBACK_FRAMES = 24
TACKLE_FOUL_VALID_GAPS = frozenset({4, 6, 8, 10, 12})
REFEREE_MAX_FRAMES = 150
TAKE_ON_RECOMMEND_FRAMES = 100

RECOVERY_TRIGGERS = frozenset({"TACKLE", "AERIAL_DUEL", "INTERCEPTION", "CLEARANCE"})

ANSI_RESET = "\033[0m"
SECTION_STYLES: dict[str, str] = {
    "Critical": "\033[1;91m",         # bold bright red
    "Very bad": "\033[1;38;5;208m",  # bold orange (256-color)
    "Bad": "\033[1;38;5;208m",       # bold orange (256-color)
    "Recommended": "\033[1;93m",     # bold yellow
    "Suspicious": "\033[1;38;5;130m",   # bold brown (256-color)
}


def _enable_windows_ansi() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes
        handle = ctypes.windll.kernel32.GetStdHandle(-11)
        mode = ctypes.c_ulong()
        if ctypes.windll.kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            ctypes.windll.kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except (AttributeError, OSError):
        pass


def _use_color(no_color: bool) -> bool:
    if no_color or not sys.stdout.isatty():
        return False
    if os.environ.get("NO_COLOR") is not None:
        return False
    return True


def normalize_path(p: Path) -> Path:
    return Path(str(p).strip().strip('"').strip("'").rstrip("/\\"))


def label_up(ann: dict) -> str:
    return ann.get("label", "").strip().upper()


def get_pos(ann: dict) -> int:
    v = ann["position"]
    return int(v) if isinstance(v, int) else int(str(v).strip())


def frames_between(a_ms: int, b_ms: int) -> int:
    return abs(b_ms - a_ms) // FRAME_MS


def ms_to_frame(ms: int) -> int:
    return ms // FRAME_MS


@dataclass
class Finding:
    rule: str
    message: str
    frames: list[int] = field(default_factory=list)


def make_finding(rule: str, message: str, *positions_ms: int) -> Finding:
    return Finding(rule, message, [ms_to_frame(ms) for ms in positions_ms])


@dataclass
class FileReport:
    path: Path
    critical: list[Finding] = field(default_factory=list)
    very_bad: list[Finding] = field(default_factory=list)
    bad: list[Finding] = field(default_factory=list)
    recommended: list[Finding] = field(default_factory=list)
    suspicious: list[Finding] = field(default_factory=list)


def _annotation_file_sort_key(filename: str) -> tuple[str, int]:
    """Sort {name}_pNNN.json by subfolder prefix then p-index."""
    match = re.search(r"_p(\d+)", filename, re.IGNORECASE)
    if not match:
        return (filename.lower(), 999999)
    prefix = filename[: match.start()]
    return (prefix.lower(), int(match.group(1)))


def discover_annotation_files(root: Path, subfolder_filter: str | None = None) -> list[Path]:
    """Find {subfolder}/annotations/{subfolder}_pNNN.json under root."""
    files: list[Path] = []
    subfolders = sorted(
        (p for p in root.iterdir() if p.is_dir()),
        key=lambda p: p.name.lower(),
    )
    if subfolder_filter is not None:
        subfolders = [p for p in subfolders if p.name.lower() == subfolder_filter.lower()]

    for subfolder in subfolders:
        ann_dir = subfolder / "annotations"
        if not ann_dir.is_dir():
            continue
        name = subfolder.name
        pattern = re.compile(rf"^{re.escape(name)}_p\d{{3}}$")
        for path in sorted(
            ann_dir.glob(f"{name}_p*.json"),
            key=lambda p: _annotation_file_sort_key(p.name),
        ):
            if "_post" in path.stem or path.stem.endswith("_old"):
                continue
            if pattern.match(path.stem):
                files.append(path)
    return files


def check_marker_pairing(
    annotations: list[dict],
    start_label: str,
    end_label: str,
    human_name: str,
) -> list[Finding]:
    """Stack-based START/END pairing in time order (START before END at same ms)."""
    markers: list[tuple[int, int, str]] = []
    for ann in annotations:
        lab = label_up(ann)
        if lab == start_label:
            markers.append((get_pos(ann), 0, "START"))
        elif lab == end_label:
            markers.append((get_pos(ann), 1, "END"))

    if not markers:
        return []

    markers.sort(key=lambda t: (t[0], t[1]))
    findings: list[Finding] = []
    stack: list[int] = []
    for pos, _tie, kind in markers:
        if kind == "START":
            stack.append(pos)
        else:
            if not stack:
                findings.append(
                    make_finding(
                        human_name,
                        f"{end_label} without matching {start_label}",
                        pos,
                    )
                )
            else:
                start_pos = stack.pop()
                if pos < start_pos:
                    findings.append(
                        make_finding(
                            human_name,
                            f"{end_label} is before {start_label}",
                            start_pos,
                            pos,
                        )
                    )
    for start_pos in stack:
        findings.append(
            make_finding(
                human_name,
                f"{start_label} without matching {end_label}",
                start_pos,
            )
        )
    return findings


def _highlight_pairs(annotations: list[dict]) -> list[tuple[int, int]]:
    """Return (start_ms, end_ms) for each paired HIGHLIGHT_START/HIGHLIGHT_END."""
    markers: list[tuple[int, int, str]] = []
    for ann in annotations:
        lab = label_up(ann)
        if lab == "HIGHLIGHT_START":
            markers.append((get_pos(ann), 0, "START"))
        elif lab == "HIGHLIGHT_END":
            markers.append((get_pos(ann), 1, "END"))
    markers.sort(key=lambda t: (t[0], t[1]))

    pairs: list[tuple[int, int]] = []
    stack: list[int] = []
    for pos, _tie, kind in markers:
        if kind == "START":
            stack.append(pos)
        elif stack:
            start_pos = stack.pop()
            if pos >= start_pos:
                pairs.append((start_pos, pos))
    return pairs


def _is_inside_highlight(pos: int, pairs: list[tuple[int, int]]) -> bool:
    return any(start <= pos <= end for start, end in pairs)


def strip_highlight_events(
    annotations: list[dict], pairs: list[tuple[int, int]]
) -> list[dict]:
    """Return a new list with events inside paired highlight windows removed (in memory only)."""
    if not pairs:
        return list(annotations)
    return [a for a in annotations if not _is_inside_highlight(get_pos(a), pairs)]


def _highlight_between(pos_a: int, pos_b: int, pairs: list[tuple[int, int]]) -> bool:
    """True if a paired highlight window lies strictly between two positions."""
    lo, hi = min(pos_a, pos_b), max(pos_a, pos_b)
    return any(lo < start and end < hi for start, end in pairs)


def check_min_gap(annotations: list[dict]) -> list[Finding]:
    findings: list[Finding] = []
    sorted_ann = sorted(annotations, key=get_pos)

    for i in range(len(sorted_ann) - 1):
        a, b = sorted_ann[i], sorted_ann[i + 1]
        gap = get_pos(b) - get_pos(a)
        if gap < MIN_GAP_MS:
            findings.append(
                make_finding(
                    "min_gap",
                    f"gap={gap} ms (< {MIN_GAP_MS} ms) between "
                    f"{a.get('label')!r} and {b.get('label')!r}",
                    get_pos(a),
                    get_pos(b),
                )
            )
    return findings


def _take_on_pairs(annotations: list[dict]) -> list[tuple[int, int]]:
    markers: list[tuple[int, int, str]] = []
    for ann in annotations:
        lab = label_up(ann)
        if lab == "TAKE_ON":
            markers.append((get_pos(ann), 0, "START"))
        elif lab == "TAKE_ON_END":
            markers.append((get_pos(ann), 1, "END"))
    markers.sort(key=lambda t: (t[0], t[1]))

    pairs: list[tuple[int, int]] = []
    stack: list[int] = []
    for pos, _tie, kind in markers:
        if kind == "START":
            stack.append(pos)
        elif stack:
            start_pos = stack.pop()
            if pos >= start_pos:
                pairs.append((start_pos, pos))
    return pairs


def check_take_on_timing(annotations: list[dict]) -> list[Finding]:
    findings: list[Finding] = []
    for start_pos, end_pos in _take_on_pairs(annotations):
        frames = frames_between(start_pos, end_pos)
        if frames < MIN_PAIR_FRAMES:
            findings.append(
                make_finding(
                    "take_on_timing",
                    f"TAKE_ON -> TAKE_ON_END: {frames} frame(s) (< {MIN_PAIR_FRAMES})",
                    start_pos,
                    end_pos,
                )
            )
        elif frames % 2 != 0:
            findings.append(
                make_finding(
                    "take_on_timing",
                    f"TAKE_ON -> TAKE_ON_END: {frames} frame(s) (must be even)",
                    start_pos,
                    end_pos,
                )
            )
    return findings


def check_tackle_foul(annotations: list[dict]) -> tuple[list[Finding], list[Finding]]:
    """Returns (bad, suspicious) findings for tackle/foul pairing."""
    bad: list[Finding] = []
    suspicious: list[Finding] = []
    valid = ", ".join(str(g) for g in sorted(TACKLE_FOUL_VALID_GAPS))

    tackles = sorted(
        (get_pos(a), a.get("label")) for a in annotations if label_up(a) == "TACKLE"
    )
    sorted_ann = sorted(annotations, key=get_pos)

    for i, ann in enumerate(sorted_ann):
        if label_up(ann) != "FOUL":
            continue
        if i > 0 and label_up(sorted_ann[i - 1]) == "PASS":
            continue
        foul_pos = get_pos(ann)
        preceding = [
            t_pos
            for t_pos, _ in tackles
            if t_pos <= foul_pos
            and frames_between(t_pos, foul_pos) <= TACKLE_FOUL_LOOKBACK_FRAMES
        ]
        if not preceding:
            suspicious.append(
                make_finding(
                    "tackle_foul",
                    f"FOUL with no TACKLE within "
                    f"{TACKLE_FOUL_LOOKBACK_FRAMES} frames before it",
                    foul_pos,
                )
            )
            continue

        tackle_pos = max(preceding)
        frames = frames_between(tackle_pos, foul_pos)
        if frames not in TACKLE_FOUL_VALID_GAPS:
            bad.append(
                make_finding(
                    "tackle_foul",
                    f"TACKLE -> FOUL: {frames} frame(s) "
                    f"(must be {valid})",
                    tackle_pos,
                    foul_pos,
                )
            )

    return bad, suspicious


def _referee_followup_after(annotations: list[dict], after_ms: int) -> int | None:
    """Nearest REFEREE after after_ms within REFEREE_MAX_FRAMES, or None."""
    refs = [
        get_pos(a)
        for a in annotations
        if label_up(a) == "REFEREE"
        and get_pos(a) > after_ms
        and frames_between(after_ms, get_pos(a)) <= REFEREE_MAX_FRAMES
    ]
    return min(refs) if refs else None


def check_referee_followup(annotations: list[dict]) -> tuple[list[Finding], list[Finding]]:
    bad: list[Finding] = []
    suspicious: list[Finding] = []

    triggers = [
        (label_up(a), get_pos(a))
        for a in annotations
        if label_up(a) in ("BALL_OUT_OF_PLAY", "FOUL")
    ]

    for trigger_label, trigger_pos in sorted(triggers, key=lambda t: t[1]):
        ref_pos = _referee_followup_after(annotations, trigger_pos)
        if ref_pos is None:
            suspicious.append(
                make_finding(
                    "referee_followup",
                    f"{trigger_label} not followed by REFEREE "
                    f"within {REFEREE_MAX_FRAMES} frames",
                    trigger_pos,
                )
            )
            continue

        frames = frames_between(trigger_pos, ref_pos)
        if frames < REFEREE_MIN_FRAMES:
            bad.append(
                make_finding(
                    "referee_followup",
                    f"{trigger_label} -> REFEREE: {frames} frame(s) (< {REFEREE_MIN_FRAMES})",
                    trigger_pos,
                    ref_pos,
                )
            )
        elif frames % 2 != 0:
            bad.append(
                make_finding(
                    "referee_followup",
                    f"{trigger_label} -> REFEREE: {frames} frame(s) (must be even)",
                    trigger_pos,
                    ref_pos,
                )
            )

    return bad, suspicious


def _recovery_check_skipped(trigger_lab: str, trigger_pos: int, nxt: dict) -> bool:
    nxt_lab = label_up(nxt)
    gap = get_pos(nxt) - trigger_pos

    if trigger_lab == "TACKLE" and nxt_lab == "TACKLE":
        return True

    if trigger_lab == "TACKLE" and nxt_lab == "FOUL":
        return True

    if trigger_lab == "TACKLE" and nxt_lab == "CLEARANCE":
        return True

    if trigger_lab == "TACKLE" and nxt_lab in ("TAKE_ON", "TAKE_ON_END"):
        return True

    if trigger_lab in ("TACKLE", "INTERCEPTION") and nxt_lab == "PASS":
        return True

    if trigger_lab == "INTERCEPTION" and nxt_lab == "CLEARANCE":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "AERIAL_DUEL":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "PASS_RECEIVED":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "FOUL":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "SHOT":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "REFEREE":
        return True

    if trigger_lab == "CLEARANCE" and nxt_lab == "CLEARANCE":
        return True

    if trigger_lab == "AERIAL_DUEL" and nxt_lab == "BALL_OUT_OF_PLAY":
        return True

    if trigger_lab == "AERIAL_DUEL" and nxt_lab == "AERIAL_DUEL":
        return True

    if trigger_lab == "AERIAL_DUEL" and nxt_lab == "CLEARANCE":
        return True

    if trigger_lab == "AERIAL_DUEL" and nxt_lab == "SHOT":
        return True

    if trigger_lab == "AERIAL_DUEL" and nxt_lab == "PASS" and gap // FRAME_MS in (2, 3):
        return True

    if (
        trigger_lab in RECOVERY_TRIGGERS
        and nxt_lab == "HIGHLIGHT_START"
    ):
        return True

    if (
        trigger_lab in ("TACKLE", "CLEARANCE", "INTERCEPTION")
        and nxt_lab == "BALL_OUT_OF_PLAY"
    ):
        return True

    return False


def check_recovery(
    annotations: list[dict], highlight_pairs: list[tuple[int, int]] | None = None
) -> tuple[list[Finding], list[Finding]]:
    """Returns (very_bad for clearance, suspicious for other triggers)."""
    very_bad: list[Finding] = []
    suspicious: list[Finding] = []
    pairs = highlight_pairs or []
    sorted_ann = sorted(annotations, key=get_pos)
    for i, ann in enumerate(sorted_ann[:-1]):
        lab = label_up(ann)
        if lab not in RECOVERY_TRIGGERS:
            continue
        nxt = sorted_ann[i + 1]
        if label_up(nxt) == "RECOVERY":
            continue
        pos_ann, pos_nxt = get_pos(ann), get_pos(nxt)
        if _highlight_between(pos_ann, pos_nxt, pairs):
            continue
        if _recovery_check_skipped(lab, pos_ann, nxt):
            continue
        finding = make_finding(
            "recovery",
            f"{lab} not followed by RECOVERY (next: {nxt.get('label')!r})",
            get_pos(ann),
            get_pos(nxt),
        )
        if lab == "CLEARANCE":
            very_bad.append(finding)
        else:
            suspicious.append(finding)
    return very_bad, suspicious


def check_forbidden_at_start(annotations: list[dict]) -> list[Finding]:
    """PASS_RECEIVED or RECOVERY must not be the first event."""
    if not annotations:
        return []
    first = min(annotations, key=get_pos)
    lab = label_up(first)
    if lab not in ("PASS_RECEIVED", "RECOVERY"):
        return []
    return [
        make_finding(
            "forbidden_at_start",
            f"{lab} must not be the first event",
            get_pos(first),
        )
    ]


def check_forbidden_after_highlight_end(full_annotations: list[dict]) -> list[Finding]:
    """PASS_RECEIVED or RECOVERY must not immediately follow HIGHLIGHT_END."""
    findings: list[Finding] = []
    sorted_ann = sorted(full_annotations, key=get_pos)
    for i, ann in enumerate(sorted_ann[:-1]):
        if label_up(ann) != "HIGHLIGHT_END":
            continue
        nxt = sorted_ann[i + 1]
        nxt_lab = label_up(nxt)
        if nxt_lab not in ("PASS_RECEIVED", "RECOVERY"):
            continue
        findings.append(
            make_finding(
                "after_highlight_end",
                f"{nxt_lab} must not immediately follow HIGHLIGHT_END",
                get_pos(ann),
                get_pos(nxt),
            )
        )
    return findings


def check_take_on_recommended(
    annotations: list[dict], highlight_pairs: list[tuple[int, int]] | None = None
) -> list[Finding]:
    """Long gap after PASS_RECEIVED/RECOVERY may indicate a missing take_on."""
    findings: list[Finding] = []
    pairs = highlight_pairs or []
    sorted_ann = sorted(annotations, key=get_pos)
    for i in range(len(sorted_ann) - 1):
        ann = sorted_ann[i]
        lab = label_up(ann)
        if lab not in ("PASS_RECEIVED", "RECOVERY"):
            continue
        nxt = sorted_ann[i + 1]
        nxt_lab = label_up(nxt)
        if nxt_lab in ("TAKE_ON", "TAKE_ON_END"):
            continue
        pos_ann, pos_nxt = get_pos(ann), get_pos(nxt)
        if _highlight_between(pos_ann, pos_nxt, pairs):
            continue
        gap_frames = frames_between(pos_ann, pos_nxt)
        if gap_frames > TAKE_ON_RECOMMEND_FRAMES:
            findings.append(
                make_finding(
                    "take_on_recommended",
                    f"{lab} is {gap_frames} frame(s) before "
                    f"{nxt.get('label')!r} (> {TAKE_ON_RECOMMEND_FRAMES}); "
                    f"take_on may be missing",
                    pos_ann,
                    pos_nxt,
                )
            )
    return findings


def check_consecutive_pass(
    annotations: list[dict], highlight_pairs: list[tuple[int, int]] | None = None
) -> list[Finding]:
    suspicious: list[Finding] = []
    pairs = highlight_pairs or []
    sorted_ann = sorted(annotations, key=get_pos)
    for i in range(len(sorted_ann) - 1):
        a, b = sorted_ann[i], sorted_ann[i + 1]
        if label_up(a) != "PASS" or label_up(b) != "PASS":
            continue
        pos_a, pos_b = get_pos(a), get_pos(b)
        if _highlight_between(pos_a, pos_b, pairs):
            continue
        suspicious.append(
            make_finding(
                "consecutive_pass",
                f"PASS immediately followed by PASS "
                f"(gap={pos_b - pos_a} ms)",
                pos_a,
                pos_b,
            )
        )
    return suspicious


def check_pass_tackle(
    annotations: list[dict], highlight_pairs: list[tuple[int, int]] | None = None
) -> list[Finding]:
    suspicious: list[Finding] = []
    pairs = highlight_pairs or []
    sorted_ann = sorted(annotations, key=get_pos)
    for i in range(len(sorted_ann) - 1):
        a, b = sorted_ann[i], sorted_ann[i + 1]
        if label_up(a) != "PASS" or label_up(b) != "TACKLE":
            continue
        pos_a, pos_b = get_pos(a), get_pos(b)
        if _highlight_between(pos_a, pos_b, pairs):
            continue
        suspicious.append(
            make_finding(
                "pass_tackle",
                f"PASS immediately followed by TACKLE "
                f"(gap={pos_b - pos_a} ms)",
                pos_a,
                pos_b,
            )
        )
    return suspicious


def check_file(path: Path) -> FileReport:
    report = FileReport(path=path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        report.critical.append(Finding("io", f"read/parse error: {e}"))
        return report

    if not isinstance(data, dict):
        report.critical.append(Finding("structure", "root is not a JSON object"))
        return report
    raw = data.get("annotations")
    if not isinstance(raw, list):
        report.critical.append(Finding("structure", "missing or invalid annotations array"))
        return report

    full_annotations = [a for a in raw if isinstance(a, dict)]
    for ann in full_annotations:
        if "position" not in ann:
            report.critical.append(Finding("structure", f"annotation missing position: {ann!r}"))
            return report

    report.critical.extend(check_marker_pairing(
        full_annotations, "HIGHLIGHT_START", "HIGHLIGHT_END", "highlight_pairing"
    ))
    report.very_bad.extend(check_forbidden_after_highlight_end(full_annotations))

    highlight_pairs = _highlight_pairs(full_annotations)
    annotations = strip_highlight_events(full_annotations, highlight_pairs)

    report.critical.extend(check_marker_pairing(
        annotations, "TAKE_ON", "TAKE_ON_END", "take_on_pairing"
    ))
    report.critical.extend(check_min_gap(annotations))
    report.critical.extend(check_take_on_timing(annotations))

    tackle_bad, tackle_susp = check_tackle_foul(annotations)
    report.bad.extend(tackle_bad)
    report.suspicious.extend(tackle_susp)

    ref_bad, ref_susp = check_referee_followup(annotations)
    report.critical.extend(ref_bad)
    report.suspicious.extend(ref_susp)

    clearance_bad, recovery_susp = check_recovery(annotations, highlight_pairs)
    report.very_bad.extend(clearance_bad)
    report.suspicious.extend(recovery_susp)

    report.very_bad.extend(check_forbidden_at_start(annotations))
    report.suspicious.extend(check_consecutive_pass(annotations, highlight_pairs))
    report.suspicious.extend(check_pass_tackle(annotations, highlight_pairs))
    report.recommended.extend(check_take_on_recommended(annotations, highlight_pairs))

    return report


def _category_style(category: str) -> str:
    return SECTION_STYLES.get(category, "\033[1m")


def _format_category_label(category: str, use_color: bool) -> str:
    if not use_color:
        return category
    return f"{_category_style(category)}{category}{ANSI_RESET}"


def _format_finding_line(category: str, finding: Finding, use_color: bool) -> str:
    if finding.frames:
        frames_str = ",".join(str(f) for f in finding.frames)
        if use_color:
            style = _category_style(category)
            rule_part = f"{finding.rule}({style}{frames_str}{ANSI_RESET})"
        else:
            rule_part = f"{finding.rule}({frames_str})"
    else:
        rule_part = finding.rule
    return f"    {rule_part}: {finding.message}"


CATEGORY_ATTRS: tuple[tuple[str, str], ...] = (
    ("Critical", "critical"),
    ("Very bad", "very_bad"),
    ("Bad", "bad"),
    ("Recommended", "recommended"),
    ("Suspicious", "suspicious"),
)


def print_report(reports: list[FileReport], use_color: bool) -> list[tuple[str, list[tuple[Path, Finding]]]]:
    """Print findings grouped by file, then category. Returns sections for summary stats."""
    sections: list[tuple[str, list[tuple[Path, Finding]]]] = []
    for title, attr in CATEGORY_ATTRS:
        items: list[tuple[Path, Finding]] = []
        for rep in reports:
            for f in getattr(rep, attr):
                items.append((rep.path, f))
        sections.append((title, items))

    by_file: dict[str, dict[str, list[Finding]]] = {}
    file_order: list[str] = []
    for title, items in sections:
        for path, finding in items:
            name = path.name
            if name not in by_file:
                by_file[name] = {}
                file_order.append(name)
            by_file[name].setdefault(title, []).append(finding)

    if not file_order:
        print("\n(no findings)\n")
        return sections

    file_order.sort(key=_annotation_file_sort_key)

    print()
    for name in file_order:
        print(name)
        for title, _ in CATEGORY_ATTRS:
            findings = by_file[name].get(title)
            if not findings:
                continue
            print(f"  {_format_category_label(title, use_color)}")
            for finding in findings:
                print(_format_finding_line(title, finding, use_color))
        print()

    return sections


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        required=True,
        help="Works root (e.g. 05-11-darnsin/works); scans subfolder/annotations/*_pNNN.json",
    )
    parser.add_argument(
        "--filter",
        metavar="SUBFOLDER",
        help="Only check this subfolder under --root (e.g. 3754079_2)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored section headings",
    )
    args = parser.parse_args()

    use_color = _use_color(args.no_color)
    if use_color:
        _enable_windows_ansi()

    root = normalize_path(args.root).resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 1

    subfolder_filter = args.filter.strip() if args.filter else None
    if subfolder_filter == "":
        subfolder_filter = None

    if subfolder_filter is not None:
        match = next(
            (p for p in root.iterdir() if p.is_dir() and p.name.lower() == subfolder_filter.lower()),
            None,
        )
        if match is None:
            print(f"No subfolder matching {subfolder_filter!r} under {root}", file=sys.stderr)
            return 1
        subfolder_filter = match.name

    paths = discover_annotation_files(root, subfolder_filter)
    if not paths:
        if subfolder_filter is not None:
            print(f"No annotation files found for {subfolder_filter!r} under {root}")
        else:
            print(f"No annotation files found under {root}")
        return 0

    reports = [check_file(p) for p in paths]

    sections = print_report(reports, use_color)

    print("=" * 60)
    print(
        f"Scanned {len(paths)} file(s) in {len({p.parent.parent for p in paths})} subfolder(s)."
    )
    for title, items in sections:
        files = len({p for p, _ in items})
        print(f"{title.upper()}: {len(items)} finding(s) in {files} file(s)")
    print("=" * 60)

    fail = any(items for title, items in sections[:3])
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
