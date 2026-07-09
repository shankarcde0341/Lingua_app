import { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { colors, gradients, radii, shadow, typography } from "@/src/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Speak with real people",
    subtitle: "Match with English learners worldwide and practice one voice-call at a time.",
    image: "https://images.pexels.com/photos/8727434/pexels-photo-8727434.jpeg",
    icon: "people",
  },
  {
    id: "2",
    title: "Master every skill",
    subtitle: "Business, IELTS, travel, interviews — bite-sized lessons that stick.",
    image: "https://images.pexels.com/photos/8463151/pexels-photo-8463151.jpeg",
    icon: "school",
  },
  {
    id: "3",
    title: "Track your growth",
    subtitle: "Streaks, XP, certificates and daily challenges to keep you unstoppable.",
    image: "https://images.pexels.com/photos/6532362/pexels-photo-6532362.jpeg",
    icon: "trending-up",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const next = () => {
    if (index < SLIDES.length - 1) {
      const n = index + 1;
      setIndex(n);
      listRef.current?.scrollToIndex({ index: n, animated: true });
    } else {
      router.replace("/login");
    }
  };

  const skip = () => router.replace("/login");

  return (
    <View style={styles.root} testID="onboarding-screen">
      <LinearGradient colors={gradients.soft} style={StyleSheet.absoluteFill} />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <LinearGradient colors={gradients.primary} style={styles.logoMini}>
              <Ionicons name="mic" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.brandSmall}>Lingua Franca</Text>
          </View>
          <TouchableOpacity onPress={skip} testID="onboarding-skip-btn">
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(i) => i.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, paddingHorizontal: 24 }}>
              <Animated.View entering={FadeIn.delay(80).duration(400)} style={styles.imageWrap}>
                <Image source={{ uri: item.image }} style={styles.img} />
                <LinearGradient colors={["transparent", "rgba(15,23,42,0.55)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.iconBadge}>
                  <Ionicons name={item.icon as any} size={22} color="#fff" />
                </View>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </Animated.View>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity activeOpacity={0.9} onPress={next} testID="onboarding-next-btn">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Text style={styles.ctaText}>{index === SLIDES.length - 1 ? "Get Started" : "Next"}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => router.push("/privacy")} testID="onboarding-privacy-link">
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => router.push("/terms")} testID="onboarding-terms-link">
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: "absolute", top: -90, right: -60, width: 240, height: 240, borderRadius: 999, backgroundColor: "rgba(59,130,246,0.18)" },
  orb2: { position: "absolute", bottom: -120, left: -80, width: 280, height: 280, borderRadius: 999, backgroundColor: "rgba(13,148,136,0.15)" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMini: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  brandSmall: { ...typography.h3, fontSize: 16 },
  skip: { ...typography.body, color: colors.textSecondary },
  imageWrap: { width: "100%", height: 340, borderRadius: radii.xl, overflow: "hidden", marginTop: 12, ...shadow.card },
  img: { width: "100%", height: "100%" },
  iconBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(255,255,255,0.25)", padding: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  card: { marginTop: 22, backgroundColor: colors.glass, borderRadius: radii.xl, padding: 22, borderWidth: 1, borderColor: colors.glassBorder, ...shadow.soft },
  title: { ...typography.h1, fontSize: 26 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: 10, lineHeight: 22 },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#CBD5E1" },
  dotActive: { width: 22, backgroundColor: colors.primaryLight },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 999, ...shadow.strong },
  ctaText: { ...typography.button },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 14, gap: 6 },
  legalLink: { ...typography.small, color: colors.primary },
  legalDot: { color: colors.textMuted },
});
