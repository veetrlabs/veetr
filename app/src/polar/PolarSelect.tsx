import { Children, isValidElement, useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
interface OptionProps {
  label: string;
  value: string | number;
}
function Option(_props: OptionProps) {
  return null;
}
/** A collapsed select with checked radio options, consistent on native and web. */
export function PolarSelect<T extends string | number>({
  selectedValue,
  onValueChange,
  children,
  enabled = true,
  accessibilityLabel,
}: {
  selectedValue: T;
  onValueChange: (value: T) => void;
  children: ReactNode;
  enabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<TextStyle>;
}) {
  const [expanded, setExpanded] = useState(false),
    c = themeColors[useTheme().theme];
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((child) => child.props);
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          text: options.find((o) => o.value === selectedValue)?.label ?? "—",
        }}
        accessibilityState={{ expanded, disabled: !enabled }}
        disabled={!enabled}
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => ({
          minHeight: 48,
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.inputBg,
          opacity: !enabled ? 0.5 : pressed ? 0.7 : 1,
          flexDirection: "row",
          gap: 12,
        })}
      >
        <Text style={{ color: c.text, flex: 1 }}>
          {options.find((o) => o.value === selectedValue)?.label ?? "—"}
        </Text>
        <Text style={{ color: c.text }}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      {expanded && (
        <View
          accessibilityRole="radiogroup"
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8 }}
        >
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{
                checked: o.value === selectedValue,
                disabled: !enabled,
              }}
              disabled={!enabled}
              onPress={() => {
                setExpanded(false);
                onValueChange(o.value as T);
              }}
              style={({ pressed }) => ({
                minHeight: 44,
                padding: 12,
                flexDirection: "row",
                gap: 8,
                backgroundColor: pressed ? c.buttonBg : "transparent",
              })}
            >
              <Text style={{ color: c.text, flex: 1 }}>{o.label}</Text>
              {o.value === selectedValue && (
                <Text style={{ color: c.text }}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
PolarSelect.Item = Option;
