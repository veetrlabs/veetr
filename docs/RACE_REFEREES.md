---
title: "Referees"
description: "Record finishes, correct results, and operate live race tracking."
---

Referees work within their assigned series. They can change the course map, heat entries, results, and publication status, and operate race tracking. Ask a series manager to change the series configuration, other race settings, categories, or heat setup.

## Set the course map

Open a race or one of its heats, select **Map & replay**, and choose **Set course** or **Edit course**. Pan and zoom to the sailing area, then place start line ends **A** and **B**. Use **Add mark** to place buoys or turning points; drag a point to adjust its position or enter its coordinates.

Arrange the numbered marks in sailing order, and choose **Leave to port (left)** or **Leave to starboard (right)**. The map shows numbered marks, sailing direction arrows, and the start line. Optional course notes can describe laps or other instructions.

Choose **Save course** to apply the draft. The course belongs to the race and appears alongside boat tracks in **Map & replay**, shared by all its heats. The coordinate list and **Export GPX** are below the map. Replay uses the current course layout. Public visitors can see it once the race has a published or locked heat. Positions are approximate. To remove the course, remove its marks, start line and notes, then save.

### Set the start from a phone

In **Edit course**, stand at the referee end and choose **Read phone position**, then **Use position for referee end A**. The displayed accuracy helps you decide when to capture it; the editor rejects fixes older than 15 seconds or less accurate than 50 metres. End B can be placed on the map, entered from coordinates supplied by someone at the buoy, or captured there by another assigned official using their phone. Coordinate edits between officials and reopen the editor after another person saves.

If the buoy position is unknown, choose **Bearing and length** in the start-line method selector for B. Enter a bearing measured clockwise from true north, or use **Point phone at buoy** beside the bearing field while holding the phone flat and pointing its physical top edge toward the buoy. Supply the local magnetic declination (east positive) before using the compass reading. Without a distance, the map shows a direction ray and does not claim a buoy position. An optional distance produces an explicitly estimated end B. The bearing, compass button and length controls are grouped in the B settings below the map: adjust them after setting the bearing to move B along that bearing without changing direction, then save. Compass readings and GPS positions remain approximate; this does not automatically judge start-line crossings.

After saving and syncing, choose **Fixed position** or **Live phone position** on the detail page. Fixed mode uses the captured position. Live mode starts only when you press **Start live referee position**, shares the phone position as A, and updates at most once every five seconds. A measured B stays fixed; a captured bearing also stays fixed until you aim again. Use **Stop and freeze start line** to keep the last saved position.

Live mode requires the browser page to stay visible and the screen awake. It stops on loss of usable GPS, a conflicting course edit, or leaving the page. If the final freeze cannot reach the server, public pages label the last position stale after 15 seconds. Sensor access requires browser permission and HTTPS; manual map and bearing entry remain available when sensors cannot be used.

## Record finishes

1. Open the assigned series in [race management](/races/manage/).
2. Open the race, then the heat you are officiating.
3. Check the registered entries before the start.
4. Tap boats in the finish-line view as they finish.
5. Record a non-finish status where appropriate.

The finish log captures overall arrival order. Category standings use the order within the selected category. GPS tracking does not automatically record official finishes.

## Correct a result

Use the result controls to change a status, move a boat upward, or clear an incorrect result. You can undo the last recorded result. Check the standings after a correction; shared results can be corrected without taking the whole race offline.

A missing result is not automatically DNS. Record DNS, DNF, DSQ, RET, or OCS deliberately. See [Scoring and results](/docs/race-scoring/).

## Prepare phones

A sailor can join through their boat access in the signed-in mobile app, or use a private series-phone invitation without an account. Share one invitation per boat from **Series → Fleet → boat menu → Share invitation**. The sailor pairs the phone once, then selects each race and presses **Ready to race**.

Finishing race tracking keeps the series pairing available for the next race. Cancel the series invitation only to remove access or replace the phone; cancellation affects all its races. Existing race-only links remain limited to their original race.

Check the race’s fleet and tracking status. A ready phone still needs an eligible published heat entry and live tracking to be opened. Sending an invitation does not begin publishing positions.

## Start, pause, and finish tracking

If tracking has not been prepared yet, use **Prepare race tracking** after setting the race start time. Use **Start live tracking for ready phones** when you want ready, eligible phones to share positions. Use **Pause live tracking** to pause publication. Use **Finish race tracking** when the race tracking session is over.

Check the map after starting. A stale position or an unreachable phone is not proof that the boat has stopped: it can indicate reception, connectivity, or phone settings. Coordinate with the sailor if updates are missing.

## Work through a connection loss

Finish edits can be saved locally while a previously loaded session is offline. Initial sign-in and cloud setup require a connection. Watch the save and sync indicators before closing the browser.

If a sync conflict appears, export your local work before choosing to reload the cloud version. Avoid having multiple officials edit the same series simultaneously without coordinating.
