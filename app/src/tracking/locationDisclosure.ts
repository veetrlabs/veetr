import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, AppState, Platform } from "react-native";

const CONSENT_KEY = "veetr.background-location-disclosure.v1";

/** Called only when the user starts recording or enables background tracking. */
export async function confirmTrackingLocationUse(): Promise<void> {
  if (Platform.OS !== "android") return;
  if ((await AsyncStorage.getItem(CONSENT_KEY)) === "accepted") return;
  if (AppState.currentState !== "active") {
    throw new Error("Open Veetr to enable location recording.");
  }
  const accepted = await new Promise<boolean>((resolve) => {
    Alert.alert(
      "Location for recording",
      "Veetr collects location data to record your sailing route, speed and course even when the app is closed or not in use, including when the screen is locked.\n\n" +
        "Private trips stay on this phone unless you choose to upload or share them. If you enable race sharing, your location is sent to Veetr and is visible to race viewers.\n\n" +
        "Android shows a notification while recording. You can stop recording or race sharing in Veetr. On the next permission screens, allow precise location and select Allow all the time for screen-lock recording.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
  if (!accepted) throw new Error("Location recording was not started.");
  await AsyncStorage.setItem(CONSENT_KEY, "accepted");
}
