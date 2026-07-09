import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";

export default function Challenges() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const d = await api.challenges(); setChallenges(d.challenges || []); setCompleted(d.completed || []); } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const complete = async (c: any) => {
    if (completed.includes(c.id)) return;
    if (c.type === "quiz") { router.push("/quiz"); return; }
    if (c.type === "lesson") { router.push("/(tabs)/practice"); return; }
    if (c.type === "speak") { router.push("/match"); return; }
    setProcessing(c.id);
    try {
      const res = await api.completeChallenge(c.id);
      setCompleted((p) => [...p, c.id]);
      setToast(`+${res.xp_earned} XP earned!`);
      setTimeout(() => setToast(null), 2500);
      await refresh();
    } catch { /* ignore */ }
    setProcessing(null);
  };

  return (
    <View style={styles.root} testID="challenges-screen">
      <LinearGradient colors={["#FFFBEB", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Daily Challenges" showBack onBack={() => router.back()} right={
          <TouchableOpacity onPress={() => router.push("/leaderboard")} testID="challenges-leaderboard-btn">
            <View style={styles.trophyBtn}><Ionicons name="podium" size={16} color="#fff" /></View>
          </TouchableOpacity>
        } />
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            <View style={styles.headerCard}>
              <LinearGradient colors={["#F59E0B", "#EF4444"]} style={StyleSheet.absoluteFill} />
              <View>
                <Text style={styles.headerTitle}>Today&apos;s challenges</Text>
                <Text style={styles.headerSub}>{completed.length} of {challenges.length} completed</Text>
              </View>
              <Ionicons name="trophy" size={40} color="#fff" />
            </View>

            {challenges.map((c, i) => {
              const done = completed.includes(c.id);
              return (
                <Animated.View key={c.id} entering={FadeInDown.delay(80 + i * 40).duration(400)} style={{ marginTop: 12 }}>
                  <View style={[styles.card, done && { opacity: 0.6 }]}>
                    <View style={[styles.cIcon, done && { backgroundColor: colors.accent }]}>
                      <Ionicons name={done ? "checkmark" : c.icon} size={22} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cTitle}>{c.title}</Text>
                      <Text style={styles.cDesc}>{c.description}</Text>
                      <View style={styles.cReward}><Ionicons name="flash" size={12} color={colors.gold} /><Text style={styles.cRewardText}>+{c.xp} XP</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => complete(c)} disabled={done || processing === c.id} style={[styles.cBtn, done && styles.cBtnDone]} testID={`challenge-btn-${c.id}`}>
                      {processing === c.id ? <ActivityIndicator size="small" color={colors.primary} /> : (
                        <Text style={[styles.cBtnText, done && styles.cBtnTextDone]}>
                          {done ? "Done" : c.type === "quiz" ? "Start" : c.type === "lesson" ? "Learn" : c.type === "speak" ? "Speak" : "Claim"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
      {toast ? (
        <View style={styles.toast} testID="challenges-toast">
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  trophyBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  headerCard: { padding: 22, borderRadius: radii.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden", ...shadow.strong },
  headerTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 22 },
  headerSub: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontFamily: "Manrope_500Medium" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#fff", borderRadius: radii.lg, ...shadow.soft },
  cIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  cTitle: { ...typography.h3, fontSize: 15 },
  cDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  cReward: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  cRewardText: { ...typography.small, color: colors.gold, fontFamily: "Manrope_700Bold" },
  cBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#DBEAFE" },
  cBtnDone: { backgroundColor: "#DCFCE7" },
  cBtnText: { ...typography.small, color: colors.primary, fontFamily: "Manrope_700Bold" },
  cBtnTextDone: { color: "#166534" },
  toast: { position: "absolute", bottom: 100, left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 999, ...shadow.strong },
  toastText: { color: "#fff", fontFamily: "Manrope_700Bold" },
});
