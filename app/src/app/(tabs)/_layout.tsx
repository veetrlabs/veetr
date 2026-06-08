import { View, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import Svg, { Path, Circle, Polygon, Line, Rect } from 'react-native-svg'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'

function TabIcon({ name, color, size }: { name: string; color: string; size?: number }) {
  const s = size || 24
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (name) {
    case 'dashboard':
      return (
        <Svg {...props}>
          <Rect x="3" y="3" width="7" height="7" />
          <Rect x="14" y="3" width="7" height="7" />
          <Rect x="14" y="14" width="7" height="7" />
          <Rect x="3" y="14" width="7" height="7" />
        </Svg>
      )
    case 'map':
      return (
        <Svg {...props}>
          <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <Line x1="8" y1="2" x2="8" y2="18" />
          <Line x1="16" y1="6" x2="16" y2="22" />
        </Svg>
      )
    case 'history':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" />
          <Polygon points="12 6 12 12 16 14" />
        </Svg>
      )
    case 'connect':
      return (
        <Svg {...props}>
          <Path d="M14.5 2h-5v4h5z" />
          <Path d="M14.5 18h-5v4h5z" />
          <Path d="M9.5 8v8" />
          <Path d="M6.5 11h-4" />
          <Path d="M18.5 11h-4" />
          <Path d="M7.5 9l-3 3 3 3" />
          <Path d="M16.5 9l3 3-3 3" />
        </Svg>
      )
    case 'settings':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </Svg>
      )
    default:
      return <Svg {...props}><Circle cx="12" cy="12" r="10" /></Svg>
  }
}

export default function TabLayout() {
  const { theme } = useTheme()
  const colors = themeColors[theme]

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.panelBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 4,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Data',
          tabBarIcon: ({ color, size }) => <TabIcon name="dashboard" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <TabIcon name="map" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <TabIcon name="history" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: 'Connect',
          tabBarIcon: ({ color, size }) => <TabIcon name="connect" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <TabIcon name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
