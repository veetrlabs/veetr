import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
const topics = [
  [
    "Private sailing and regattas",
    "Start tracking records any sail privately on this phone, without an account or internet. To share a regatta track, sign in and choose an eligible regatta and boat. Joining and sharing makes your boat’s position, speed and trail public live and in replay after you stop. Existing live-only sessions are not added to replay. Anyone can browse published regattas and watch without signing in. An account alone does not grant entry: you must own or edit the boat, and the organizer must have entered it in a published heat. Find regattas opens the website; after arranging entry with the organizer, refresh the list. Private recordings are never uploaded automatically. Stop private tracking before joining; the previous recording stays in History.",
  ],
  [
    "Nautical map layer",
    "The Seamarks button shows OpenSeaMap navigation marks over the base map. Coverage varies by location. This layer does not include depth contours or soundings. New map tiles need internet access; offline chart downloads are not yet supported.",
  ],
  [
    "Speed and course",
    "SOG is speed over ground, shown in knots. COG is the direction you travel across the map. Both come from GPS. Course can be unreliable when stationary, and a dash means no usable reading is available.",
  ],
  [
    "Phone compass heading",
    "HDG in phone mode is magnetic heading from the phone compass. For boat heading, keep the phone’s physical top edge pointing toward the bow, even when using landscape view. Turning the phone changes the reading. The shared compass circle keeps the boat pointing up. N moves around the circle to show north relative to the bow; the blue dashed arrow shows GPS course relative to the bow. Both markers need a usable heading. When true heading is available, north and course use true north. Otherwise N indicates magnetic north and the course arrow is hidden to avoid mixing references; the COG number remains available. Wind indicators appear when Veetr is connected. COG and HDG can differ because wind and current affect your path.",
  ],
  [
    "Compass availability and accuracy",
    "Some phones have no compass. Unavailable, stale or low-accuracy readings appear as a dash. If accuracy is low, move the phone away from magnets and metal and follow any system calibration prompt. The phone compass does not replace GPS position or speed.",
  ],
  [
    "Phone mode and Veetr instruments",
    "The phone provides GPS speed, course, tracking and start-line capture, plus compass heading where supported. Connect Veetr in Bluetooth settings for wind speed, wind angles, heel and dedicated boat instruments.",
  ],
  [
    "Setting a start line",
    "Sail to each end and capture its position. Either end can be set first. Without a connected device, positions are saved on this phone and require a fresh GPS fix with reported accuracy of 30 metres or better. With Veetr connected, capture uses Veetr GPS. Phone and device lines are stored separately. Capture again if a mark moves. With both phone endpoints saved, the dashboard shows the shortest distance in metres to the segment between them (or the nearest end when beyond the line). This is an unsigned distance, not an over-the-line warning. A dash means the current fix is missing, stale or less accurate than 30 metres, or the endpoints are less than a metre apart.",
  ],
  [
    "Recording and screen lock",
    "Live instruments alone do not save a trail. Start recording in Track to save positions for Map and History. Local recording works without an account or internet. On iPhone, choose Allow While Using App first and Always when asked; keep Precise Location enabled. Recordings stop automatically after 12 hours. Allow background location for screen-lock recording; force-closing the app can stop GPS. Check the recording status before sailing.",
  ],
] as const;
export default function QuickGuide({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme(),
    c = themeColors[theme],
    insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 8,
        paddingBottom: 32,
        gap: 16,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Settings"
        onPress={onBack}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ color: c.textSecondary }}>‹ Settings</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 28, fontWeight: "700" }}
      >
        Quick guide
      </Text>
      {topics.map(([title, body], i) => (
        <View
          key={title}
          style={{
            backgroundColor: c.panelBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            onPress={() => setOpen(open === i ? null : i)}
            style={{
              padding: 16,
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text
              style={{
                color: c.text,
                fontSize: 16,
                fontWeight: "600",
                flex: 1,
              }}
            >
              {title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 22 }}>
              {open === i ? "−" : "+"}
            </Text>
          </Pressable>
          {open === i && (
            <Text
              style={{
                color: c.textSecondary,
                fontSize: 15,
                lineHeight: 23,
                paddingHorizontal: 16,
                paddingBottom: 16,
              }}
            >
              {body}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
