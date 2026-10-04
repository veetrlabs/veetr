import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { getLocales } from "expo-localization";
import {
  i18n,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  validPreference,
  type LanguagePreference,
} from "./index";

const LanguageContext = createContext<{
  preference: LanguagePreference;
  setPreference: (next: LanguagePreference) => Promise<void>;
} | null>(null);

function applyLanguage(preference: LanguagePreference) {
  const languages = getLocales().map((item) => item.languageTag);
  void i18n.changeLanguage(resolveLanguage(preference, languages));
}

export default function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<LanguagePreference>("system");
  const current = useRef<LanguagePreference>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        if (!alive) return;
        current.current = validPreference(stored);
        applyLanguage(current.current);
        setPreferenceState(current.current);
        setReady(true);
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") applyLanguage(current.current);
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  async function setPreference(next: LanguagePreference) {
    // Persist first: a storage failure must not silently lose the user's choice.
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    current.current = next;
    applyLanguage(next);
    setPreferenceState(next);
  }

  if (!ready) return null;
  return (
    <LanguageContext.Provider value={{ preference, setPreference }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguagePreference() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider missing");
  return context;
}
