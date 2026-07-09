import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { GlassCard, GradientButton, ProgressRing, SectionTitle } from "@/src/components/ui";

const CAT_IMAGES: Record<string, string> = {
  daily: "https://images.pexels.com/photos/8727434/pexels-photo-8727434.jpeg",
  business: "https://images.pexels.com/photos/8463151/pexels-photo-8463151.jpeg",
  interview: "https://images.pexels.com/photos/8674781/pexels-photo-8674781.jpeg",
  travel: "https://images.pexels.com/photos/32021944/pexels-photo-32021944.jpeg",
  ielts: "https://images.unsplash.com/photo-1687197180710-b2b9484a3c5f",
  public: "https://images.unsplash.com/photo-1544531586-fde5298cdd40",
  grammar: "https://images.unsplash.com/photo-1725981934390-d9bc9807ae31",
  vocab: "https://images.pexels.com/photos/36440699/pexels-photo-36440699.jpeg",
  pronunciation: "https://images.pexels.com/photos/6532362/pexels-photo-6532362.jpeg",
};

export default function Home() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api.home(); setData(d); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  }, [load, refresh]);

  if (!data || !user) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} testID="home-loading" />;
  }

  const goalProgress = Math.min(1, (data.daily_goal_completed_minutes || 0) / (data.daily_goal_minutes || 15));

  return (
    <View style={styles.root} testID="home-screen">
      <LinearGradient colors={["#EFF6FF", colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={styles.orb} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.hi}>Hey, {data.welcome_name} 👋</Text>
              <Text style={styles.subHi}>{data.quote}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} testID="home-avatar">
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{data.welcome_name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Streak / XP / Coins strip */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.stripRow}>
            <View style={[styles.chip, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="flame" size={16} color="#F59E0B" />
              <Text style={styles.chipText}>{data.streak} day streak</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="flash" size={16} color="#2563EB" />
              <Text style={[styles.chipText, { color: "#1E3A8A" }]}>{data.xp} XP</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: "#FCE7F3" }]}>
              <Ionicons name="logo-usd" size={14} color="#DB2777" />
              <Text style={[styles.chipText, { color: "#9D174D" }]}>{data.coins}</Text>
            </View>
          </Animated.View>

          {/* Daily goal card */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goalCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalLabel}>Daily Speaking Goal</Text>
                <Text style={styles.goalMinutes}>
                  {data.daily_goal_completed_minutes}<Text style={styles.goalUnit}> / {data.daily_goal_minutes} min</Text>
                </Text>
                <Text style={styles.goalHint}>Keep going — you&apos;re {Math.round(goalProgress * 100)}% there.</Text>
                <TouchableOpacity style={styles.goalCta} onPress={() => router.push("/(tabs)/practice")} testID="home-continue-btn">
                  <Text style={styles.goalCtaText}>Continue Learning</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <ProgressRing size={100} stroke={9} progress={goalProgress} color="#fff" trackColor="rgba(255,255,255,0.25)">
                <Text style={styles.ringText}>{Math.round(goalProgress * 100)}%</Text>
              </ProgressRing>
            </LinearGradient>
          </Animated.View>

          {/* Word of the day */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ marginTop: 18 }}>
            <SectionTitle title="Word of the day" action="See all" onAction={() => router.push("/vocabulary")} />
            <GlassCard testID="home-word-of-day">
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wodWord}>{data.word_of_the_day.word}</Text>
                  <Text style={styles.wodPhonetic}>{data.word_of_the_day.phonetic}</Text>
                  <Text style={styles.wodMeaning}>{data.word_of_the_day.meaning}</Text>
                  <Text style={styles.wodExample}>&quot;{data.word_of_the_day.example}&quot;</Text>
                </View>
                <TouchableOpacity style={styles.wodBtn} onPress={() => router.push("/vocabulary")} testID="home-word-flashcards">
                  <Ionicons name="albums" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 18 }}>
            <SectionTitle title="Speak now" />
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/match")} activeOpacity={0.85} testID="home-quick-match">
                <LinearGradient colors={["#3B82F6", "#0EA5E9"]} style={styles.quickInner}>
                  <Ionicons name="people" size={26} color="#fff" />
                  <Text style={styles.quickTitle}>Random Match</Text>
                  <Text style={styles.quickSub}>Voice call a real learner</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/speaking-test")} activeOpacity={0.85} testID="home-quick-test">
                <LinearGradient colors={["#0F172A", "#1E3A8A"]} style={styles.quickInner}>
                  <Ionicons name="ribbon" size={26} color="#F59E0B" />
                  <Text style={styles.quickTitle}>Speaking Test</Text>
                  <Text style={styles.quickSub}>Get certified</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInDown.delay(260).duration(400)} style={{ marginTop: 22 }}>
            <SectionTitle title="English Lessons" action="Browse all" onAction={() => router.push("/(tabs)/practice")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12, gap: 12 }}>
              {data.categories.map((cat: any) => (
                <TouchableOpacity key={cat.id} onPress={() => router.push(`/lessons/${cat.id}`)} activeOpacity={0.9} testID={`home-cat-${cat.id}`}>
                  <ImageBackground source={{ uri: CAT_IMAGES[cat.id] }} style={styles.catCard} imageStyle={{ borderRadius: radii.lg }}>
                    <LinearGradient colors={["transparent", "rgba(2,6,23,0.85)"]} style={StyleSheet.absoluteFill} />
                    <View style={{ padding: 14 }}>
                      <View style={[styles.catIcon, { backgroundColor: cat.color }]}>
                        <Ionicons name={cat.icon} size={16} color="#fff" />
                      </View>
                      <Text style={styles.catTitle}>{cat.name}</Text>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Daily challenges */}
          <Animated.View entering={FadeInDown.delay(320).duration(400)} style={{ marginTop: 22 }}>
            <SectionTitle title="Daily Challenges" action="View all" onAction={() => router.push("/challenges")} />
            <View style={{ gap: 12 }}>
              {data.challenges.slice(0, 3).map((c: any) => (
                <TouchableOpacity key={c.id} onPress={() => router.push("/challenges")} activeOpacity={0.9} testID={`home-challenge-${c.id}`}>
                  <GlassCard>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={styles.challengeIcon}>
                        <Ionicons name={c.icon} size={20} color="#fff" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.challengeTitle}>{c.title}</Text>
                        <Text style={styles.challengeDesc}>{c.description}</Text>
                      </View>
                      <View style={styles.xpBadge}>
                        <Ionicons name="flash" size={12} color="#1E3A8A" />
                        <Text style={styles.xpText}>+{c.xp}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Premium banner */}
          {!user.is_premium && (
            <TouchableOpacity onPress={() => router.push("/premium")} activeOpacity={0.9} style={{ marginTop: 22 }} testID="home-premium-banner">
              <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumBanner}>
                <View style={{ flex: 1 }}>
                  <View style={styles.premiumTag}><Text style={styles.premiumTagText}>PREMIUM</Text></View>
                  <Text style={styles.premiumTitle}>Unlock unlimited practice</Text>
                  <Text style={styles.premiumSub}>Certificates, advanced analytics & offline lessons.</Text>
                </View>
                <Ionicons name="diamond" size={44} color="#F59E0B" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  orb: { position: "absolute", top: -80, right: -60, width: 260, height: 260, borderRadius: 999, backgroundColor: "rgba(59,130,246,0.15)" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, marginBottom: 18 },
  hi: { ...typography.h1, fontSize: 26 },
  subHi: { ...typography.small, color: colors.textSecondary, marginTop: 4, maxWidth: 250 },
  avatar: { width: 46, height: 46, borderRadius: 999, borderWidth: 2, borderColor: "#fff", ...shadow.soft },
  avatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 18 },
  stripRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { ...typography.small, fontFamily: "Manrope_600SemiBold", color: "#78350F" },

  goalCard: { flexDirection: "row", alignItems: "center", padding: 22, borderRadius: radii.xl, gap: 16, ...shadow.strong },
  goalLabel: { ...typography.small, color: "rgba(255,255,255,0.85)", letterSpacing: 0.4 },
  goalMinutes: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 36, marginTop: 2 },
  goalUnit: { fontSize: 16, color: "rgba(255,255,255,0.8)" },
  goalHint: { ...typography.small, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  goalCta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 12, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, gap: 6 },
  goalCtaText: { ...typography.body, color: colors.primary, fontFamily: "Outfit_600SemiBold" },
  ringText: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 20 },

  wodWord: { ...typography.h2, fontSize: 22 },
  wodPhonetic: { ...typography.small, color: colors.primary, marginTop: 2 },
  wodMeaning: { ...typography.body, marginTop: 8 },
  wodExample: { ...typography.small, color: colors.textSecondary, marginTop: 6, fontStyle: "italic" },
  wodBtn: { width: 46, height: 46, borderRadius: 999, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow.soft },

  quickRow: { flexDirection: "row", gap: 12 },
  quickCard: { flex: 1, borderRadius: radii.xl, overflow: "hidden", ...shadow.card },
  quickInner: { padding: 16, height: 140, justifyContent: "space-between" },
  quickTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 17 },
  quickSub: { color: "rgba(255,255,255,0.75)", fontFamily: "Manrope_500Medium", fontSize: 12 },

  catCard: { width: 160, height: 190, borderRadius: radii.lg, overflow: "hidden", justifyContent: "flex-end" },
  catIcon: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  catTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 15 },

  challengeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  challengeTitle: { ...typography.h3, fontSize: 15 },
  challengeDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#DBEAFE" },
  xpText: { ...typography.small, color: "#1E3A8A", fontFamily: "Manrope_700Bold" },

  premiumBanner: { flexDirection: "row", alignItems: "center", padding: 22, borderRadius: radii.xl, gap: 16, ...shadow.strong },
  premiumTag: { alignSelf: "flex-start", backgroundColor: "rgba(245,158,11,0.2)", borderColor: colors.gold, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  premiumTagText: { color: colors.gold, fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1.5 },
  premiumTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 18, marginTop: 6 },
  premiumSub: { color: "rgba(255,255,255,0.75)", fontFamily: "Manrope_500Medium", fontSize: 12, marginTop: 3 },
});
