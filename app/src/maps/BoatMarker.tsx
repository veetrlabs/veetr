import { distinctCourse } from './courseVector';
import { headingRay, type MapRegion } from './headingRay';
import { useRef } from 'react';
import { Platform, View } from 'react-native';
import type { MapMarker } from 'react-native-maps/lib/MapMarker';
import { SvgXml } from 'react-native-svg';
import { Marker, Polyline } from '../components/NativeMap';
import { boatSymbol, boatBearings, type BoatReading } from './boatSymbol';
export default function BoatMarker({ coordinate, reading, title, description, color = '#008c80', zIndex = 10, region, mapBearing = 0, showDirectionLines = true }: {
  coordinate: { latitude: number; longitude: number }; reading: BoatReading;
  title?: string; description?: string; color?: string; zIndex?: number; region?: MapRegion; mapBearing?: number; showDirectionLines?: boolean;
}) {
  const marker = useRef<MapMarker>(null);
  const ray = showDirectionLines && region ? headingRay(coordinate, reading, region) : [];
  const course = distinctCourse(reading);
  const courseRay = showDirectionLines && region && course !== null ? headingRay(coordinate, { cogDeg: course }, region) : [];
  const dash = boatBearings(reading).courseOnly ? [6, 5] : undefined;
  return <>
    {ray.length > 0 && <Polyline coordinates={ray} strokeColor="black" strokeWidth={1} lineDashPattern={dash} geodesic={false} zIndex={9} />}
    {courseRay.length > 0 && <Polyline coordinates={courseRay} strokeColor="#2563eb" strokeWidth={1} lineDashPattern={[8, 6]} geodesic={false} zIndex={9} />}
    <Marker ref={marker} style={{ width: 112, height: 112 }} coordinate={coordinate} title={title} description={description} anchor={{ x: .5, y: .5 }} centerOffset={{ x: 0, y: 0 }} flat={false} rotation={0} zIndex={zIndex} tracksViewChanges>
    <View onLayout={Platform.OS === 'android' ? () => marker.current?.redraw() : undefined} collapsable={false} style={{ width: 112, height: 112 }}>
      <SvgXml xml={boatSymbol(reading, color, mapBearing)} width={112} height={112} />
    </View>
  </Marker></>;
}
