import React, { useMemo, useState } from "react"
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth, useSSO, useUser } from "@clerk/clerk-expo"
import * as AuthSession from "expo-auth-session"
import { AppLanguage, Copy, LANGUAGE_LABEL } from "../i18n"
import { Palette, fonts, spacing, useTheme } from "../theme"
import { GitHubLogo, GoogleLogo } from "../components/ProviderLogos"

const logo = require("../../assets/splash-icon.png")

const APP_VERSION = "1.0.0"

const LANGUAGES: AppLanguage[] = ["ms", "en", "zh"]

const LANGUAGE_FULL: Record<AppLanguage, string> = {
  ms: "Bahasa Melayu",
  en: "English",
  zh: "中文",
}

interface Props {
  copy: Copy
  language: AppLanguage
  onSetLanguage: (lang: AppLanguage) => void
  onClose: () => void
}

export default function ProfileScreen({
  copy,
  language,
  onSetLanguage,
  onClose,
}: Props) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(c), [c])
  const [authError, setAuthError] = useState(false)

  const { user } = useUser()
  const { signOut, isSignedIn } = useAuth()
  const { startSSOFlow } = useSSO()

  const signInWith = async (strategy: "oauth_google" | "oauth_github") => {
    setAuthError(false)
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      })
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
      }
    } catch {
      setAuthError(true)
    }
  }

  const displayName =
    user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress
  const email = user?.primaryEmailAddress?.emailAddress

  // Android's Modal already renders below the status bar; only iOS
  // full-screen modals draw underneath it.
  const topInset = Platform.OS === "ios" ? insets.top : 0

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel={copy.back}
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>{copy.profileTab}</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <View style={styles.identityBlock}>
          <View style={styles.avatarRing}>
            {isSignedIn && user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Image
                  source={logo}
                  style={styles.avatarLogo}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>

          <Text style={styles.identityName} numberOfLines={1}>
            {isSignedIn ? (displayName ?? user?.id) : copy.guest}
          </Text>

          {isSignedIn && email ? (
            <Text style={styles.identitySub} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {!isSignedIn ? (
            <Text style={styles.identitySub}>{copy.signInPrompt}</Text>
          ) : null}
        </View>

        {/* Account actions */}
        <Text style={styles.sectionTitle}>{copy.account}</Text>
        <View style={styles.card}>
          {isSignedIn ? (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() => signOut()}
              accessibilityLabel={copy.signOut}
            >
              <Text style={styles.rowIcon}>⎋</Text>
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>
                {copy.signOut}
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => signInWith("oauth_google")}
                accessibilityLabel={copy.signInGoogle}
              >
                <View style={styles.rowIconBox}>
                  <GoogleLogo size={18} />
                </View>
                <Text style={styles.rowLabel}>{copy.signInGoogle}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>

              <View style={styles.rowDivider} />

              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => signInWith("oauth_github")}
                accessibilityLabel={copy.signInGitHub}
              >
                <View style={styles.rowIconBox}>
                  <GitHubLogo size={18} color={c.foreground} />
                </View>
                <Text style={styles.rowLabel}>{copy.signInGitHub}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            </>
          )}
        </View>
        {authError ? (
          <Text style={styles.authErrorText}>{copy.signInError}</Text>
        ) : null}

        {/* Language */}
        <Text style={styles.sectionTitle}>{copy.language}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, i) => {
            const active = lang === language
            return (
              <React.Fragment key={lang}>
                {i > 0 ? <View style={styles.rowDivider} /> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => onSetLanguage(lang)}
                  accessibilityLabel={LANGUAGE_FULL[lang]}
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.langBadge}>
                    <Text style={styles.langBadgeText}>
                      {LANGUAGE_LABEL[lang]}
                    </Text>
                  </View>
                  <Text
                    style={[styles.rowLabel, active && styles.rowLabelActive]}
                  >
                    {LANGUAGE_FULL[lang]}
                  </Text>
                  <View
                    style={[styles.radio, active && styles.radioActive]}
                  >
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Image source={logo} style={styles.footerLogo} resizeMode="contain" />
          <Text style={styles.footerName}>{copy.appName}</Text>
          <Text style={styles.footerVersion}>
            {copy.version} {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    closeButton: {
      width: 36,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    closeIcon: {
      fontFamily: fonts.body,
      fontSize: 18,
      color: c.mutedForeground,
    },
    topBarTitle: {
      fontFamily: fonts.display,
      fontSize: 16,
      color: c.foreground,
    },
    content: {
      paddingHorizontal: spacing.lg,
    },
    identityBlock: {
      alignItems: "center",
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.xs,
    },
    avatarRing: {
      padding: 3,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: c.primary,
      marginBottom: spacing.sm,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.muted,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    avatarLogo: {
      width: 56,
      height: 56,
    },
    identityName: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.foreground,
      maxWidth: "90%",
    },
    identitySub: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      color: c.mutedForeground,
      textAlign: "center",
      maxWidth: "85%",
    },
    sectionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.mutedForeground,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
    },
    rowPressed: {
      backgroundColor: c.muted,
    },
    rowDivider: {
      height: 1,
      backgroundColor: c.border,
      marginLeft: spacing.lg,
    },
    rowIconBox: {
      width: 28,
      alignItems: "center",
    },
    rowIcon: {
      width: 28,
      textAlign: "center",
      fontFamily: fonts.body,
      fontSize: 17,
      color: c.destructive,
    },
    rowLabel: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.foreground,
    },
    rowLabelActive: {
      color: c.primary,
    },
    rowLabelDanger: {
      color: c.destructive,
    },
    rowChevron: {
      fontFamily: fonts.body,
      fontSize: 20,
      color: c.mutedForeground,
    },
    langBadge: {
      width: 28,
      alignItems: "center",
    },
    langBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: c.mutedForeground,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: c.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
    authErrorText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.destructive,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
    footer: {
      alignItems: "center",
      gap: 2,
      marginTop: spacing.xl * 2,
    },
    footerLogo: {
      width: 32,
      height: 32,
      marginBottom: spacing.xs,
    },
    footerName: {
      fontFamily: fonts.display,
      fontSize: 13,
      color: c.mutedForeground,
    },
    footerVersion: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.mutedForeground,
      opacity: 0.8,
    },
  })
