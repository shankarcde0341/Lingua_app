import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { api } from "@/src/api/client";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader, GradientButton } from "@/src/components/ui";

export default function Referral() {
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => { try { const d = await api.getReferral(); setData(d); } catch { /* ignore */ } })();
  }, []);

  const copyCode = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareNative = async () => {
    if (!data) return;
    try {
      await Share.share({ message: data.share_message });
    } catch { /* ignore */ }
  };

  const shareTo = async (network: "whatsapp" | "instagram" | "linkedin" | "twitter" | "telegram") => {
    if (!data) return;
    const msg = encodeURIComponent(data.share_message);
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${msg}`,
      instagram: `https://www.instagram.com/`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://lingua-franca-6.preview.emergentagent.com")}&summary=${msg}`,
      twitter: `https://twitter.com/intent/tweet?text=${msg}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent("https://lingua-franca-6.preview.emergentagent.com")}&text=${msg}`,
    };
    const url = map[network];
    if (network === "instagram") {
      // Instagram doesn't support pre-filled share; copy the message and open IG.
      await Clipboard.setStringAsync(data.share_message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch { /* ignore */ }
  };

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.root} testID="referral-screen">
      <LinearGradient colors={gradients.premium} style={styles.headerBg} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Invite & Earn" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 30,      // Upar se gap
                paddingBottom: 20,
                marginTop: 20,       // Agar upar wale section se overlap ho raha ho
              }}
            >
              <View style={{ marginBottom: 15 }}>
                <Ionicons name="gift" size={40} color="#F59E0B" />
              </View>

              <Text style={{color: '#000080', fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 10,}}>
                Get Upto Rs. 50 Cashback
              </Text>

              <Text style={{color: '#35489c', fontSize: 14, textAlign: 'center', lineHeight: 24, paddingHorizontal: 25,}}>
                Share your code. With your friends and get up to 50Rs Cashback on any Premium plan , and so do you on your friends. Which you can withdraw also.
              </Text>
              
            </View>

          <View style={styles.codeCard} testID="referral-code-card">
            <View>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.codeText}>{data.referral_code}</Text>
            </View>
            <TouchableOpacity onPress={copyCode} style={styles.copyBtn} testID="referral-copy-btn">
              <Ionicons name={copied ? "checkmark" : "copy"} size={18} color="#fff" />
              <Text style={styles.copyBtnText}>{copied ? "Copied" : "Copy"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="referral-count-card">
              <Ionicons name="people" size={22} color={colors.primary} />
              <Text style={styles.statValue}>{data.referral_count}</Text>
              <Text style={styles.statLabel}>Friends invited</Text>
            </View>
            <View style={styles.statCard} testID="referral-discount-card">
              <Ionicons name="wallet-outline" size={22} color={colors.gold} />
              <Text style={styles.statValue}>{data.referral_discount_active ? "20%" : "—"}</Text>
              <Text style={styles.statLabel}>Cashback Earned</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Share via</Text>
          <View style={styles.shareGrid}>
            <ShareTile icon="logo-whatsapp" color="#25D366" label="WhatsApp" onPress={() => shareTo("whatsapp")} testID="share-whatsapp" />
            <ShareTile icon="logo-instagram" color="#E1306C" label="Instagram" onPress={() => shareTo("instagram")} testID="share-instagram" />
            <ShareTile icon="logo-linkedin" color="#0A66C2" label="LinkedIn" onPress={() => shareTo("linkedin")} testID="share-linkedin" />
            <ShareTile icon="logo-twitter" color="#1DA1F2" label="X / Twitter" onPress={() => shareTo("twitter")} testID="share-twitter" />
            <ShareTile icon="paper-plane" color="#0088CC" label="Telegram" onPress={() => shareTo("telegram")} testID="share-telegram" />
            {Platform.OS !== "web" ? (
              <ShareTile icon="share-social" color={colors.primary} label="More" onPress={shareNative} testID="share-native" />
            ) : null}
          </View>

          <View style={{ marginTop: 20 }}>
            <GradientButton label="Copy invite link" icon="link" onPress={copyCode} testID="referral-copy-link" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ShareTile({ icon, color, label, onPress, testID }: { icon: any; color: string; label: string; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.shareTile} testID={testID}>
      <View style={[styles.shareTileIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.shareTileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, height: 240, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  hero: { alignItems: "center", marginTop: 4, marginBottom: 22 },
  giftBox: { width: 80, height: 80, borderRadius: 26, backgroundColor: "rgba(245,158,11,0.15)", borderColor: colors.gold, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 24, marginTop: 14, textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.78)", fontFamily: "Manrope_500Medium", textAlign: "center", marginTop: 8, paddingHorizontal: 10 },
  codeCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", padding: 20, borderRadius: radii.xl, ...shadow.strong },
  codeLabel: { ...typography.tiny, color: colors.textMuted },
  codeText: { fontFamily: "Outfit_800ExtraBold", fontSize: 26, letterSpacing: 2, color: colors.primary, marginTop: 4 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.primary },
  copyBtnText: { color: "#fff", fontFamily: "Manrope_700Bold" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statCard: { flex: 1, alignItems: "center", padding: 16, borderRadius: radii.lg, backgroundColor: "#fff", ...shadow.soft },
  statValue: { ...typography.h1, fontSize: 26, marginTop: 8 },
  statLabel: { ...typography.small, color: colors.textSecondary },
  sectionLabel: { ...typography.tiny, color: colors.textMuted, marginTop: 26, marginBottom: 10 },
  shareGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  shareTile: { width: "31%", backgroundColor: "#fff", borderRadius: radii.lg, padding: 14, alignItems: "center", gap: 8, ...shadow.soft },
  shareTileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  shareTileLabel: { ...typography.small, color: colors.textPrimary, fontFamily: "Manrope_600SemiBold" },
});
