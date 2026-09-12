# Historical negative-offset analysis

This file used to claim that negative offsets in `read_file` were broken. That diagnostic is obsolete.

The current behavior is covered by `test-negative-offset-readfile.js`, including tail reads, offsets beyond file length, positive/negative equivalence, and edge cases.

Keep this note out of test discovery so a stale diagnostic cannot report a false-green test result.
