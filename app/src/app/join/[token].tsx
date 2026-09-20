import { useLocalSearchParams } from "expo-router";
import RacePhoneScreen from "../../tracking/RacePhoneScreen";
export default function JoinRace() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <RacePhoneScreen token={typeof token === "string" ? token : undefined} />
  );
}
