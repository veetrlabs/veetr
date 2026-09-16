import Svg, { Path, Circle, Rect } from "react-native-svg";
export default function TrackingIcon({
  name,
  color,
  size = 20,
}: {
  name: "points" | "gps" | "clock" | "stop" | "lock" | "route" | "chevron";
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "points" && (
        <>
          <Circle cx="5" cy="18" r="2" />
          <Circle cx="19" cy="6" r="2" />
          <Path d="M5 16v-5a4 4 0 0 1 4-4h6m0 0-3-3m3 3-3 3" />
        </>
      )}
      {name === "gps" && (
        <>
          <Circle cx="12" cy="12" r="7" />
          <Circle cx="12" cy="12" r="2" />
          <Path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
        </>
      )}
      {name === "clock" && (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3 2" />
        </>
      )}
      {name === "stop" && (
        <>
          <Circle cx="12" cy="13" r="8" />
          <Path d="M9 2h6m-3 0v3" />
          <Rect x="9" y="10" width="6" height="6" rx="1" />
        </>
      )}
      {name === "lock" && (
        <>
          <Rect x="5" y="10" width="14" height="11" rx="2" />
          <Path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" />
        </>
      )}
      {name === "route" && (
        <>
          <Path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15" />
        </>
      )}
      {name === "chevron" && <Path d="m9 5 7 7-7 7" />}
    </Svg>
  );
}
