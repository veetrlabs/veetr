import { Text, View } from "react-native";
import { Marker, Polyline } from "../components/NativeMap";
import { t, useLanguageRefresh } from "../i18n";
import { courseRoute, startGeometry, type RaceCourse } from "../../../veetr.org/src/features/racing/course";
export type { RaceCourse };
export const courseCoordinates = (course?: RaceCourse | null) => course ? [...startGeometry(course), ...course.marks] : [];

export default function CourseLayer({ course }: { course?: RaceCourse | null }) {
  useLanguageRefresh();
  if (!course) return null;
  const ends = startGeometry(course);
  const route = courseRoute(course);
  const estimated = !!course.startBearing;
  const marker = (id: string, point: {latitude: number; longitude: number}, label: string, title: string, color: string) => (
    <Marker key={id} coordinate={point} title={title} anchor={{x: 0.5, y: 0.5}}>
      <View style={{backgroundColor: color, borderColor: "white", borderWidth: 2, borderRadius: id.startsWith("start") ? 6 : 20, minWidth: 36, height: 36, paddingHorizontal: 5, alignItems: "center", justifyContent: "center"}}>
        <Text style={{color: "white", fontSize: 15, fontWeight: "700"}}>{label}</Text>
      </View>
    </Marker>
  );
  return <>
    {ends.length === 2 && <Polyline coordinates={ends} strokeColor="#805508" strokeWidth={4} lineDashPattern={estimated ? [8, 6] : undefined} />}
    {route.length > 1 && <Polyline coordinates={route} strokeColor="#25638f" strokeWidth={3} lineDashPattern={[8, 6]} />}
    {ends[0] && marker("start-a", ends[0], "A", t("Start line end A"), "#805508")}
    {ends[1] && (!estimated || course.startBearing?.distanceMetres) && marker("start-b", ends[1], "B", t("Start line end B"), "#805508")}
    {course.marks.map((point, i) => marker(point.id, point, `${i + 1} ${point.rounding === "port" ? "↶" : "↷"}`, `${i + 1} · ${t(point.rounding === "port" ? "Leave to port (left)" : "Leave to starboard (right)")}`, point.rounding === "port" ? "#aa292d" : "#14674c"))}
  </>;
}
