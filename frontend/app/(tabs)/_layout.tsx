import { Tabs } from "expo-router";
import { View, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { colors, typography } from "@/src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName; iconInactive: IconName }[] = [
  { name: "index", label: "Home", icon: "home", iconInactive: "home-outline" },
  { name: "practice", label: "Practice", icon: "mic", iconInactive: "mic-outline" },
  { name: "live", label: "Live", icon: "radio", iconInactive: "radio-outline" },
  { name: "profile", label: "Profile", icon: "person-circle", iconInactive: "person-circle-outline" },
];

function TabButton({ focused, icon, iconInactive, label, onPress, testID }: { focused: boolean; icon: IconName; iconInactive: IconName; label: string; onPress: () => void; testID: string }) {
  const scale = useSharedValue(focused ? 1 : 0.9);
  scale.value = withSpring(focused ? 1.05 : 0.95, { damping: 12 });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <TouchableOpacity onPress={onPress} style={styles.tab} activeOpacity={0.8} testID={testID}>
      <Animated.View style={[styles.iconWrap, focused && styles.iconWrapActive, style]}>
        <Ionicons name={focused ? icon : iconInactive} size={22} color={focused ? "#fff" : colors.textSecondary} />
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
      tabBar={({ state, navigation }) => (
        <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="bottom-tab-bar">
          <BlurView intensity={Platform.OS === "ios" ? 40 : 30} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.tabsRow}>
            {state.routes.map((route, idx) => {
              const cfg = TABS.find((t) => t.name === route.name);
              if (!cfg) return null;
              const focused = state.index === idx;
              return (
                <TabButton
                  key={route.key}
                  focused={focused}
                  icon={cfg.icon}
                  iconInactive={cfg.iconInactive}
                  label={cfg.label}
                  testID={`tab-${cfg.name === "index" ? "home" : cfg.name}`}
                  onPress={() => {
                    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="practice" />
      <Tabs.Screen name="live" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.75)",
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  tabsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: 10 },
  tab: { alignItems: "center", justifyContent: "center", flex: 1, paddingVertical: 4 },
  iconWrap: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: colors.primary },
  label: { ...typography.tiny, color: colors.textMuted, marginTop: 4, fontSize: 10, letterSpacing: 0.6 },
  labelActive: { color: colors.primary },
});
