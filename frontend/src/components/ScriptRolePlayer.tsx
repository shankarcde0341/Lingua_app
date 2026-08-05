import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import Animated, { FadeInDown } from "react-native-reanimated";

import { GradientButton } from "@/src/components/ui";
import { colors, radii, shadow, spacing, typography } from "@/src/theme";

export type ScriptLine = {
  line_id: string;
  speaker: string;
  text: string;
  audio_url?: string;
};

const DAILY_AUDIO_ASSETS: Record<string, Record<string, number>> = {
  "daily-1": {
    "d1-l1": require("../../assets/audio/intro/alex_L1.mp3"),
    "d1-l2": require("../../assets/audio/intro/priya_L1.mp3"),
    "d1-l3": require("../../assets/audio/intro/alex_L2.mp3"),
    "d1-l4": require("../../assets/audio/intro/priya_L2.mp3"),
    "d1-l5": require("../../assets/audio/intro/alex_L3.mp3"),
    "d1-l6": require("../../assets/audio/intro/priya_L3.mp3"),
    "d1-l7": require("../../assets/audio/intro/alex_L4.mp3"),
    "d1-l8": require("../../assets/audio/intro/priya_L4.mp3"),
    "d1-l9": require("../../assets/audio/intro/alex_L5.mp3"),
  },
};

const getAudioSource = (lessonId: string, line: ScriptLine) => {
  return DAILY_AUDIO_ASSETS[lessonId]?.[line.line_id] ?? line.audio_url ?? null;
};

type ScriptRolePlayerProps = {
  script: ScriptLine[];
  lessonId: string;
};

export function ScriptRolePlayer({ script, lessonId }: ScriptRolePlayerProps) {
  const [mode, setMode] = useState<"idle" | "listening" | "role-select" | "practicing" | "complete">("idle");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uniqueRoles = useMemo(() => Array.from(new Set(script.map((line) => line.speaker))), [script]);
  const currentLine = script[currentLineIndex];
  const isUserTurn = selectedRole !== null && currentLine?.speaker === selectedRole;

  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch {
        // ignore cleanup failures
      }
      playerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const cleanupCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdownProgress(0);
  }, []);

  const setupAudioMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });
    } catch (audioModeError) {
      console.error("Audio mode setup failed", audioModeError);
    }
  }, []);

  const goToNextLine = useCallback(() => {
    cleanupPlayer();
    cleanupCountdown();
    setCurrentLineIndex((index) => {
      if (index >= script.length - 1) {
        setMode("complete");
        return index;
      }
      return index + 1;
    });
  }, [cleanupCountdown, cleanupPlayer, script.length]);

  const stopPractice = useCallback(() => {
    cleanupPlayer();
    cleanupCountdown();
    setMode("idle");
    setSelectedRole(null);
    setCurrentLineIndex(0);
    setError(null);
  }, [cleanupCountdown, cleanupPlayer]);

  const maybePlayLine = useCallback(async () => {
    try {
      cleanupPlayer();
      cleanupCountdown();
      setError(null);

      if (!currentLine) {
        goToNextLine();
        return;
      }

      const source = getAudioSource(lessonId, currentLine);
      if (!source) {
        console.warn(`Missing audio for line_id=${currentLine.line_id}`);
        goToNextLine();
        return;
      }

      await setupAudioMode();

      console.log("Playing audio source", source, "line_id=", currentLine.line_id);
      const player = createAudioPlayer(source, {
        updateInterval: 200,
        keepAudioSessionActive: false,
        downloadFirst: true,
      });
      playerRef.current = player;
      setIsPlaying(true);
      player.addListener("playbackStatusUpdate", (status: any) => {
        console.log("Audio status update", status, "line_id=", currentLine.line_id);
        if (status.error) {
          console.error("Audio status error", status.error, "line_id=", currentLine.line_id);
        }
        if (status.didJustFinish) {
          goToNextLine();
        }
      });
      player.play();
    } catch (playError) {
      console.error("Audio playback failed:", playError, "line_id=", currentLine?.line_id);
      goToNextLine();
    }
  }, [cleanupCountdown, cleanupPlayer, currentLine, goToNextLine, lessonId, setupAudioMode]);

  const startCountdown = useCallback(() => {
    cleanupCountdown();
    setCountdownProgress(0);

    const start = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / 4000);
      setCountdownProgress(progress);

      if (progress >= 1) {
        cleanupCountdown();
        goToNextLine();
      }
    }, 100);
  }, [cleanupCountdown, goToNextLine]);

  useEffect(() => {
    if (mode === "listening") {
      maybePlayLine();
      return;
    }

    if (mode === "practicing") {
      if (isUserTurn) {
        startCountdown();
      } else {
        maybePlayLine();
      }
    }
  }, [currentLineIndex, isUserTurn, mode, maybePlayLine, startCountdown]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        cleanupPlayer();
        cleanupCountdown();
      }
    });

    return () => {
      cleanupPlayer();
      cleanupCountdown();
      subscription.remove();
    };
  }, [cleanupCountdown, cleanupPlayer]);

  const handleListenPress = () => {
    setSelectedRole(null);
    setCurrentLineIndex(0);
    setMode("listening");
  };

  const handlePracticePress = () => {
    setCurrentLineIndex(0);
    setSelectedRole(null);
    setMode("role-select");
  };

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setCurrentLineIndex(0);
    setMode("practicing");
  };

  const handleContinue = () => {
    cleanupCountdown();
    goToNextLine();
  };

  const handleRestart = () => {
    cleanupPlayer();
    cleanupCountdown();
    setMode("role-select");
    setSelectedRole(null);
    setCurrentLineIndex(0);
    setError(null);
  };

  const handleBackToLesson = () => {
    cleanupPlayer();
    cleanupCountdown();
    setMode("idle");
    setSelectedRole(null);
    setCurrentLineIndex(0);
    setError(null);
  };

  const roleSelectionVisible = mode === "role-select";
  const showStop = (mode === "listening" || mode === "practicing") && isPlaying;
  const showContinue = mode === "practicing" && isUserTurn && !isPlaying;

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Script Practice</Text>
          <Text style={styles.subTitle}>Listen, choose a role, and practice the convo.</Text>
        </View>
        {showStop ? (
          <GradientButton
            label="Stop"
            onPress={stopPractice}
            testID="script-stop-btn"
            style={styles.stopButton}
          />
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <GradientButton label="Listen" onPress={handleListenPress} testID="script-listen-btn" style={styles.wideButton} />
        <GradientButton label="Practice" onPress={handlePracticePress} testID="script-practice-btn" style={styles.wideButton} />
      </View>

      {roleSelectionVisible ? (
        <View style={styles.roleCardGrid}>
          <Text style={styles.roleTitle}>Choose your role</Text>
          {uniqueRoles.map((role) => {
            const active = selectedRole === role;
            return (
              <TouchableOpacity
                key={role}
                activeOpacity={0.85}
                style={[styles.roleCard, active && styles.roleCardActive]}
                onPress={() => handleRoleSelect(role)}
                testID="script-role-option"
              >
                <Text style={[styles.roleCardText, active && styles.roleCardTextActive]}>{role}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scriptScroll} contentContainerStyle={{ paddingBottom: 6 }}>
        {script.map((line, index) => {
          const active = index === currentLineIndex && (mode === "listening" || mode === "practicing");
          const isUserLine = selectedRole !== null && line.speaker === selectedRole;
          const lineBorderColor = active ? (isUserLine ? colors.gold : colors.primaryLight) : colors.divider;

          return (
            <View key={line.line_id} style={[styles.lineCard, { borderColor: lineBorderColor }, active && styles.activeLineCard]}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineSpeaker}>{line.speaker}</Text>
                <Text style={styles.lineLabel}>{`Line ${index + 1}`}</Text>
              </View>
              <Text style={styles.lineText}>{line.text}</Text>
              {active && mode === "practicing" && isUserLine ? (
                <View style={styles.userTurnRow}>
                  <Text style={styles.userTurnText}>Your turn — tap to continue</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {showContinue ? (
        <View style={styles.controlRow}>
          <View style={styles.countdownBarBackground}>
            <View style={[styles.countdownBarFill, { width: `${Math.round(countdownProgress * 100)}%` }]} />
          </View>
          <GradientButton
            label="Continue"
            onPress={handleContinue}
            testID="script-continue-btn"
            style={styles.continueButton}
          />
        </View>
      ) : null}

      {mode === "complete" ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Practice Complete</Text>
          <Text style={styles.completeSubtitle}>Great work! You finished the script.</Text>
          <View style={styles.completeActions}>
            <GradientButton label="Restart" onPress={handleRestart} testID="script-restart-btn" style={styles.wideButton} />
            <GradientButton label="Back to Lesson" onPress={handleBackToLesson} style={styles.wideButton} />
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.l,
    padding: spacing.m,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  sectionTitle: {
    ...typography.h3,
  },
  subTitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.s,
    marginBottom: spacing.m,
  },
  wideButton: {
    flex: 1,
  },
  stopButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
  },
  roleCardGrid: {
    marginBottom: spacing.m,
    gap: spacing.s,
  },
  roleTitle: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.s,
  },
  roleCard: {
    backgroundColor: colors.chipBg,
    borderRadius: radii.lg,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderWidth: 1,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  roleCardActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.primaryLight,
  },
  roleCardText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  roleCardTextActive: {
    color: colors.surface,
  },
  scriptScroll: {
    maxHeight: 420,
    marginBottom: spacing.m,
  },
  lineCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.m,
    marginBottom: spacing.s,
    backgroundColor: colors.surface,
  },
  activeLineCard: {
    ...shadow.strong,
    transform: [{ scale: 1.01 }],
  },
  lineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.s,
  },
  lineSpeaker: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  lineLabel: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  lineText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  userTurnRow: {
    marginTop: spacing.s,
    padding: spacing.s,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.md,
    backgroundColor: colors.chipBg,
  },
  userTurnText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  controlRow: {
    gap: spacing.s,
  },
  countdownBarBackground: {
    height: 8,
    backgroundColor: colors.divider,
    borderRadius: radii.pill,
    overflow: "hidden",
    marginBottom: spacing.s,
  },
  countdownBarFill: {
    height: "100%",
    backgroundColor: colors.primaryLight,
  },
  continueButton: {
    width: "100%",
  },
  completeCard: {
    marginTop: spacing.l,
    padding: spacing.m,
    borderRadius: radii.lg,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  completeTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  completeSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  completeActions: {
    flexDirection: "row",
    gap: spacing.s,
  },
  errorRow: {
    marginTop: spacing.s,
    padding: spacing.s,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.flame,
  },
  errorText: {
    ...typography.small,
    color: colors.flame,
  },
});
