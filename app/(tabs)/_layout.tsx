import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          title: "Project",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="briefcase.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="seats"
        options={{
          title: "Seats",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="briefcase.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cad"
        options={{
          title: "CAD",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="cube.transparent" color={color} />,
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: "Agent",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cae"
        options={{
          title: "CAE",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="point.3.connected.trianglepath.dotted" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gates"
        options={{
          title: "Gates",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="checkmark.shield.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="recovery" options={{ href: null }} />
    </Tabs>
  );
}
