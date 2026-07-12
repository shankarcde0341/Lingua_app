import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";

const FEATURES = [
  { icon: "mic", text: "Unlimited voice calls with real people" },
  { icon: "sparkles", text: "AI Pronunciation & Grammar coach" },
  { icon: "analytics", text: "Advanced analytics & progress reports" },
  { icon: "cloud-download", text: "Offline lessons" },
  { icon: "ribbon", text: "Premium certificates" },
  { icon: "diamond", text: "Priority matching & ad-free experience" },
];

export default function Premium() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<any | null>(null);
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => { try { const d = await api.subscriptionPlans(); setPlans(d.plans); } catch { /* ignore */ } })();
  }, []);

  const originUrl = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
    return process.env.EXPO_PUBLIC_BACKEND_URL || "";
  };

  const subscribe = async () => {
    setBusy(true);
    try {
      const res = await api.createCheckout(selected, originUrl());
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = res.url;
      } else {
        const opened = await WebBrowser.openBrowserAsync(res.url);
        // After user closes browser, poll status
        setTimeout(async () => {
          try {
            const status = await api.pollCheckout(res.session_id);
            if (status.payment_status === "paid") {
              await refresh();
              router.replace({ pathname: "/premium/success", params: { session_id: res.session_id } });
            }
          } catch { /* ignore */ }
        }, 1000);
      }
    } catch (e: any) {
      Alert.alert("Checkout error", e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root} testID="premium-screen">
      <LinearGradient colors={["#EFF6FF", colors.bg] as const} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Premium" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.diamondBox}><Ionicons name="diamond" size={44} color="#F59E0B" /></View>
            <Text style={styles.hero}>Unlock Lingua Franca Premium</Text>
            <Text style={styles.subhero}>Everything you need to sound fluent, confident, and unstoppable.</Text>
          </View>

          {user?.is_premium ? (
            <View style={styles.activeCard}>
              <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>You&apos;re Premium 🎉</Text>
                <Text style={styles.activeSub}>Plan: {user.premium_plan} · Valid until {user.premium_until?.split("T")[0]}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.plansRow}>
            <PlanCard
              testID="plan-monthly"
              selected={selected === "monthly"}
              onSelect={() => setSelected("monthly")}
              title="Monthly"
              price={plans?.monthly?.amount || 9.99}
              per="/ month"
              tag={null}
            />
            <PlanCard
              testID="plan-yearly"
              selected={selected === "yearly"}
              onSelect={() => setSelected("yearly")}
              title="Yearly"
              price={plans?.yearly?.amount || 79.99}
              per="/ year"
              tag="SAVE 33%"
            />
          </View>

          <View style={{ marginTop: 24 }}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featRow} testID={`premium-feature-${i}`}>
                <View style={styles.featIcon}><Ionicons name={f.icon as any} size={16} color={colors.primary} /></View>
                <Text style={styles.featText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {!user?.is_premium ? (
            <TouchableOpacity onPress={subscribe} disabled={busy} activeOpacity={0.9} style={{ marginTop: 26 }} testID="premium-subscribe-btn">
              <LinearGradient colors={["#F59E0B", "#EF4444"]} style={styles.ctaBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="diamond" size={20} color="#fff" />
                    <Text style={styles.ctaText}>Continue with {selected === "yearly" ? "Yearly" : "Monthly"}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.note}>
            Secure checkout by Stripe. Cancel anytime. Prices in USD.
          </Text>
          <TouchableOpacity onPress={() => router.push("/privacy")}>
            <Text style={styles.legal}>Terms and Privacy Policy apply</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlanCard({ title, price, per, tag, selected, onSelect, testID, discounted }: { title: string; price: number; per: string; tag: string | null; selected: boolean; onSelect: () => void; testID: string; discounted?: boolean }) {
  const finalPrice = discounted ? Number((price * 0.8).toFixed(2)) : price;
  return (
    <TouchableOpacity onPress={onSelect} activeOpacity={0.9} style={{ flex: 1 }} testID={testID}>
      <View style={[styles.planCard, selected && styles.planCardSelected]}>
        {tag ? <View style={styles.tagRibbon}><Text style={styles.tagRibbonText}>{tag}</Text></View> : null}
        <Text style={styles.planTitle}>{title}</Text>
        {discounted ? (
          <>
            <Text style={styles.planStrike}>${price}</Text>
            <Text style={styles.planPrice}>${finalPrice}<Text style={styles.planPer}>{per}</Text></Text>
          </>
        ) : (
          <Text style={styles.planPrice}>${price}<Text style={styles.planPer}>{per}</Text></Text>
        )}
        <View style={styles.planRadio}>
          {selected ? <View style={styles.planRadioInner} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroCard: { alignItems: "center", marginTop: 4, backgroundColor: "#fff", paddingVertical: 24, paddingHorizontal: 20, borderRadius: radii.xl, ...shadow.card, borderWidth: 1, borderColor: "#DBEAFE" },
  diamondBox: { width: 76, height: 76, borderRadius: 24, backgroundColor: "#1E3A8A", alignItems: "center", justifyContent: "center", ...shadow.strong },
  hero: { color: "#1E3A8A", fontFamily: "Outfit_800ExtraBold", fontSize: 24, marginTop: 18, textAlign: "center", letterSpacing: -0.3 },
  subhero: { color: colors.textSecondary, fontFamily: "Manrope_500Medium", textAlign: "center", marginTop: 8, paddingHorizontal: 10 },
  activeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#DCFCE7", padding: 14, borderRadius: radii.lg, marginTop: 20, borderWidth: 1, borderColor: "#86EFAC" },
  activeTitle: { ...typography.h3, color: "#166534" },
  activeSub: { ...typography.small, color: "#166534" },
  plansRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  planCard: { padding: 18, borderRadius: radii.lg, backgroundColor: "#fff", borderWidth: 2, borderColor: colors.divider, minHeight: 120, ...shadow.soft },
  planCardSelected: { borderColor: colors.primary, backgroundColor: "#EFF6FF" },
  tagRibbon: { position: "absolute", top: -10, right: 12, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagRibbonText: { color: "#fff", fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1 },
  planTitle: { ...typography.h3, fontSize: 15 },
  planPrice: { fontFamily: "Outfit_700Bold", fontSize: 26, color: colors.primary, marginTop: 6 },
  planPer: { fontFamily: "Manrope_500Medium", fontSize: 13, color: colors.textSecondary },
  planStrike: { fontFamily: "Manrope_500Medium", fontSize: 14, color: colors.textMuted, textDecorationLine: "line-through", marginTop: 4 },
  refBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#DCFCE7", padding: 12, borderRadius: radii.lg, marginTop: 14, borderWidth: 1, borderColor: "#86EFAC" },
  refBannerText: { color: "#166534", fontFamily: "Manrope_700Bold", fontSize: 13 },
  refPromo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: radii.lg, marginTop: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.divider },
  refPromoText: { flex: 1, ...typography.small, color: colors.textPrimary, fontFamily: "Manrope_500Medium" },
  planRadio: { width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: colors.primary, position: "absolute", top: 12, right: 12, alignItems: "center", justifyContent: "center" },
  planRadioInner: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.primary },
  featRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  featIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  featText: { ...typography.body, flex: 1 },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 999, ...shadow.strong },
  ctaText: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 17 },
  note: { ...typography.small, color: colors.textSecondary, textAlign: "center", marginTop: 18 },
  legal: { ...typography.small, color: colors.primary, textAlign: "center", marginTop: 6, textDecorationLine: "underline" },
});

