import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { GlassCard, SectionTitle } from "@/src/components/ui";

const CAT_IMAGES: Record<string, string> = {
  daily: "https://images.pexels.com/photos/8199231/pexels-photo-8199231.jpeg",
  business: "https://images.pexels.com/photos/8463151/pexels-photo-8463151.jpeg",
  interview: "https://images.pexels.com/photos/9870148/pexels-photo-9870148.jpeg",
  travel: "https://images.pexels.com/photos/32021944/pexels-photo-32021944.jpeg",
  ielts: "https://images.unsplash.com/photo-1687197180710-b2b9484a3c5f",
  public: "https://images.unsplash.com/photo-1544531586-fde5298cdd40",
  grammar: "https://images.unsplash.com/photo-1725981934390-d9bc9807ae31",
  vocab: "https://images.pexels.com/photos/36440699/pexels-photo-36440699.jpeg",
  pronunciation: "https://images.pexels.com/photos/6532362/pexels-photo-6532362.jpeg",
};

export default function Practice() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try { const d = await api.lessonCategories(); setCategories(d.categories || []); } catch { /* ignore */ }
    })();
  }, []);

  return (
    <View style={styles.root} testID="practice-screen">
      <LinearGradient colors={["#F0F7FF", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Practice</Text>
          <Text style={styles.sub}>Pick a mode. Speak. Progress.</Text>

          {/* Featured Modes */}
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 18, gap: 14 }}>
            <TouchableOpacity onPress={() => router.push("/match")} activeOpacity={0.9} testID="practice-match-btn">
              <LinearGradient colors={gradients.primary} style={styles.modeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTag}>REAL PEOPLE</Text>
                  <Text style={styles.modeTitle}>Speak with real people</Text>
                  <Text style={styles.modeSub}>Match with a learner instantly and talk.</Text>
                </View>
                <View style={styles.modeIconWrap}>
                  <Ionicons name="people" size={36} color="#fff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => router.push("/speaking-test")} activeOpacity={0.9} style={{ flex: 1 }} testID="practice-test-btn">
                <LinearGradient colors={["#0F172A", "#1E3A8A"]} style={styles.smallMode}>
                  <Ionicons name="ribbon" size={22} color={colors.gold} />
                  <Text style={styles.smallModeTitle}>Speaking Test</Text>
                  <Text style={styles.smallModeSub}>Beginner · Advanced</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/quiz")} activeOpacity={0.9} style={{ flex: 1 }} testID="practice-quiz-btn">
                <LinearGradient colors={["#7C3AED", "#EC4899"]} style={styles.smallMode}>
                  <Ionicons name="help-circle" size={22} color="#fff" />
                  <Text style={styles.smallModeTitle}>Quiz</Text>
                  <Text style={styles.smallModeSub}>Test yourself · +30 XP</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => router.push("/vocabulary")} activeOpacity={0.9} style={{ flex: 1 }} testID="practice-vocab-btn">
                <LinearGradient colors={["#14B8A6", "#0EA5E9"]} style={styles.smallMode}>
                  <Ionicons name="library" size={22} color="#fff" />
                  <Text style={styles.smallModeTitle}>Vocabulary</Text>
                  <Text style={styles.smallModeSub}>Flashcards · Save words</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/challenges")} activeOpacity={0.9} style={{ flex: 1 }} testID="practice-challenges-btn">
                <LinearGradient colors={["#F59E0B", "#EF4444"]} style={styles.smallMode}>
                  <Ionicons name="trophy" size={22} color="#fff" />
                  <Text style={styles.smallModeTitle}>Challenges</Text>
                  <Text style={styles.smallModeSub}>Daily rewards</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={{ marginTop: 26 }}>
            <SectionTitle title="Lesson Categories" />
            <View style={styles.catGrid}>
              {categories.map((cat, i) => (
                <Animated.View key={cat.id} entering={FadeInDown.delay(80 + i * 40).duration(400)} style={{ width: "48%" }}>
                  <TouchableOpacity onPress={() => router.push(`/lessons/${cat.id}`)} activeOpacity={0.9} testID={`practice-cat-${cat.id}`}>
                    <ImageBackground source={{ uri: CAT_IMAGES[cat.id] }} imageStyle={{ borderRadius: radii.lg }} style={styles.catCard}>
                      <LinearGradient colors={["transparent", "rgba(2,6,23,0.85)"]} style={StyleSheet.absoluteFill} />
                      <View style={{ padding: 12 }}>
                        <View style={[styles.catIcon, { backgroundColor: cat.color }]}>
                          <Ionicons name={cat.icon} size={16} color="#fff" />
                        </View>
                        <Text style={styles.catTitle}>{cat.name}</Text>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 26 }}>
            <SectionTitle title="Community" />
            <TouchableOpacity onPress={() => router.push("/leaderboard")} activeOpacity={0.9} testID="practice-leaderboard">
              <GlassCard>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.miniIcon, { backgroundColor: "#F59E0B" }]}><Ionicons name="podium" size={18} color="#fff" /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemTitle}>Weekly Leaderboard</Text>
                    <Text style={styles.itemSub}>Compete with learners worldwide</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </GlassCard>
            </TouchableOpacity>

            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => router.push("/call-history")} activeOpacity={0.9} testID="practice-call-history">
              <GlassCard>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.miniIcon, { backgroundColor: colors.primaryLight }]}><Ionicons name="time" size={18} color="#fff" /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemTitle}>Call History</Text>
                    <Text style={styles.itemSub}>Review your past voice sessions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </GlassCard>
            </TouchableOpacity>

            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => router.push("/friends")} activeOpacity={0.9} testID="practice-friends">
              <GlassCard>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.miniIcon, { backgroundColor: colors.accent }]}><Ionicons name="person-add" size={18} color="#fff" /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemTitle}>Friend Requests</Text>
                    <Text style={styles.itemSub}>Connect with speaking partners</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { ...typography.h1, fontSize: 30, marginTop: 6 },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  modeCard: { flexDirection: "row", alignItems: "center", padding: 22, borderRadius: radii.xl, gap: 12, ...shadow.strong },
  modeTag: { color: "rgba(255,255,255,0.75)", fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1.4 },
  modeTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 22, marginTop: 4 },
  modeSub: { color: "rgba(255,255,255,0.8)", fontFamily: "Manrope_500Medium", fontSize: 13, marginTop: 4 },
  modeIconWrap: { width: 68, height: 68, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  smallMode: { padding: 16, borderRadius: radii.lg, gap: 6, minHeight: 116, ...shadow.card },
  smallModeTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 16, marginTop: 8 },
  smallModeSub: { color: "rgba(255,255,255,0.8)", fontFamily: "Manrope_500Medium", fontSize: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  catCard: { height: 130, borderRadius: radii.lg, overflow: "hidden", justifyContent: "flex-end" },
  catIcon: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  catTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 14 },
  miniIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemTitle: { ...typography.h3, fontSize: 15 },
  itemSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
});
