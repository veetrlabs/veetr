import { useLocalSearchParams } from "expo-router";
import RacePhoneScreen from "../tracking/RacePhoneScreen";
export default function RacePhonePage() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  return <RacePhoneScreen eventId={typeof eventId === "string" ? eventId : undefined} />;
}
