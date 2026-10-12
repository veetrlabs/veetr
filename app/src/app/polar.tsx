import { Redirect } from "expo-router";
// Keep old links working; boat-owned polar setup now lives in boat details.
export default function PolarScreen() {
  return <Redirect href="/my-boats" />;
}
