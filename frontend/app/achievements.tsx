import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { colors, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";

export default function Achievements() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { try { const d = await api.achievements(); setItems(d.achievements || []); } catch { /* ignore */ } setLoading(false); })();
  }, []);

  const unlocked = items.filter((i) => i.unlocked).length;

  return (
    <View style={styles.root} testID="achievements-screen">
      <LinearGradient colors={["#FFFBEB", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Achievements" showBack onBack={() => router.back()} />
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
            <View style={styles.summary}>
              <Ionicons name="trophy" size={30} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>{unlocked} of {items.length} unlocked</Text>
                <Text style={styles.summarySub}>Keep learning to earn more.</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {items.map((a, i) => (
                <Animated.View key={a.id} entering={FadeInDown.delay(60 + i * 30).duration(400)} style={{ width: "48%" }}>
                  <View style={[styles.card, !a.unlocked && { opacity: 0.55 }]} testID={`achievement-${a.id}`}>
                    <View style={[styles.icon, a.unlocked ? { backgroundColor: "#FEF3C7" } : { backgroundColor: colors.divider }]}>
                      <Ionicons name={a.icon} size={26} color={a.unlocked ? colors.gold : colors.textMuted} />
                    </View>
                    <Text style={styles.title}>{a.title}</Text>
                    <Text style={styles.desc}>{a.description}</Text>
                    {a.unlocked ? <View style={styles.badge}><Text style={styles.badgeText}>UNLOCKED</Text></View> : <View style={[styles.badge, { backgroundColor: colors.divider }]}><Text style={[styles.badgeText, { color: colors.textMuted }]}>LOCKED</Text></View>}
                  </View>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff", borderRadius: radii.lg, marginBottom: 20, ...shadow.soft },
  summaryTitle: { ...typography.h3 },
  summarySub: { ...typography.small, color: colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  card: { padding: 16, borderRadius: radii.lg, backgroundColor: "#fff", alignItems: "center", ...shadow.soft, minHeight: 180 },
  icon: { width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  title: { ...typography.h3, fontSize: 14, textAlign: "center", marginTop: 10 },
  desc: { ...typography.small, color: colors.textSecondary, textAlign: "center", marginTop: 4, minHeight: 32 },
  badge: { marginTop: 8, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: colors.gold, fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1 },
});
