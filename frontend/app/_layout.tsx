import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const publicRoutes = ["onboarding", "login", "privacy", "terms"];
    const inPublic = publicRoutes.includes(first as string) || first === undefined;
    if (!user && !inPublic) {
      router.replace("/onboarding");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.splash} testID="root-loading">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 250,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

export default function RootLayout() {
  const [iconLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontsError] = useAppFonts();

  useEffect(() => {
    if ((iconLoaded || iconError) && (fontsLoaded || fontsError)) {
      SplashScreen.hideAsync();
    }
  }, [iconLoaded, iconError, fontsLoaded, fontsError]);

  if ((!iconLoaded && !iconError) || (!fontsLoaded && !fontsError)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
