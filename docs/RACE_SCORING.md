---
title: "Scoring and results"
description: "Understand heat scores, race starting points, discards, and provisional standings."
---

Veetr uses lower-is-better points. Agree on the event’s scoring settings before racing and check them with the referee.

## From heats to the series

Record finishes in each heat. Race standings combine heat scores after any heat discards. For races calculated from heats, a boat’s race rank becomes its series score:

**Series score for the race = race rank − 1 + starting points**

The race’s **Starting points** default is 0:

| Race place | Default: 0 | A race starting at −1 |
| --- | --- | --- |
| 1st | 0 | −1 |
| 2nd | 1 | 0 |
| 3rd | 2 | 1 |

Set −1 on the 24-hour race if that is your agreed rule. The setting belongs to the race only. Heats count equally; there is no heat weight control or duplicated “×2” race contribution.

Imported aggregate results use the imported scores rather than inventing individual heat finishes. Check imported race standings against the original results before using them.

## Categories and all boats

The all-boats view scores the overall finish order. Selecting a category scores places within that category and uses its entry count for entry-based penalties. Changing categories can therefore change positions and points without changing the recorded overall arrival order.

There is no handicap or corrected-time calculation in this scoring model.

## Missing and non-finish results

Record non-finish statuses deliberately: DNS, DNF, DSQ, RET, and OCS are supported. The default penalty is the applicable registered entry count plus one.

A missing result is not automatically converted to DNS. A boat without recorded results can remain unranked. This is one reason live standings are provisional.

## Discards

Configure heat discards on the race and race discards on the series. Without a rule, nothing is discarded.

Heat discard thresholds use completed heats; series thresholds use races marked completed. For example, “discard 1 after 4 completed races” starts excluding one eligible worst race score once that threshold is reached.

Discarded scores remain visible with a strikethrough. They are excluded from the counted total.

## Ties and corrections

The default tie-break compares counted totals, then counted scores from best to worst, then results from the latest race backward. An exact remaining tie shares a rank.

Referees can correct results after publication. Tracking times and map positions do not replace official finish entry. Use [Referees](/docs/race-referees/) for the operational workflow.
