import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo"
import { tokenCache } from "@clerk/clerk-expo/token-cache"
import * as WebBrowser from "expo-web-browser"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFonts } from "expo-font"
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque"
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from "@expo-google-fonts/atkinson-hyperlegible"
import * as SplashScreen from "expo-splash-screen"
import { Document, listDocuments } from "./src/api"
import { setAuthTokenGetter } from "./src/auth-token"
import { AppLanguage, COPY, LANGUAGE_LABEL, NEXT_LANGUAGE } from "./src/i18n"
import { Palette, ThemeProvider, fonts, palette, spacing } from "./src/theme"
import ChatScreen from "./src/screens/ChatScreen"
import ProfileScreen from "./src/screens/ProfileScreen"

const logo = require("./assets/splash-icon.png")

WebBrowser.maybeCompleteAuthSession()
SplashScreen.preventAutoHideAsync().catch(() => {})

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth()
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [getToken, isSignedIn])
  return null
}

function Root() {
  const { user, isLoaded, isSignedIn } = useUser()
  if (!isLoaded || (isSignedIn && !user?.id)) return null
  return <ActorRoot key={isSignedIn ? `user:${user?.id}` : "signed-out"} />
}

function ActorRoot() {
  const insets = useSafeAreaInsets()

  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  })

  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const [language, setLanguage] = useState<AppLanguage>("en")
  const [anonUserId, setAnonUserId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [profileOpen, setProfileOpen] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [mentionDoc, setMentionDoc] = useState<Document | null>(null)
  const [anonymousAccepted, setAnonymousAccepted] = useState(false)

  const c = palette
  const styles = useMemo(() => createStyles(c), [c])

  useEffect(() => {
    AsyncStorage.getItem("lr-mobile-user-id").then((stored) => {
      if (stored) {
        setAnonUserId(stored)
      } else {
        const next = makeId("lr-mobile")
        AsyncStorage.setItem("lr-mobile-user-id", next)
        setAnonUserId(next)
      }
    })
    AsyncStorage.getItem("lr-mobile-session").then((stored) => {
      if (stored) {
        setSessionId(stored)
      } else {
        const next = makeId("session")
        AsyncStorage.setItem("lr-mobile-session", next)
        setSessionId(next)
      }
    })
    AsyncStorage.getItem("lr-mobile-language").then((stored) => {
      if (stored === "ms" || stored === "en" || stored === "zh") {
        setLanguage(stored)
      }
    })
  }, [])

  const loadDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      setDocs(await listDocuments())
    } catch {
      // Keep whatever list we had; chat shows the no-docs state if empty.
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const applyLanguage = (next: AppLanguage) => {
    setLanguage(next)
    AsyncStorage.setItem("lr-mobile-language", next)
  }

  const toggleLanguage = () => {
    applyLanguage(NEXT_LANGUAGE[language])
  }

  const newChat = () => {
    const next = makeId("session")
    AsyncStorage.setItem("lr-mobile-session", next)
    setSessionId(next)
    setMentionDoc(null)
  }

  const copy = COPY[language]
  const readyDocs = docs.filter((d) => d.status === "ready")
  const userId = isSignedIn ? (user?.id ?? "") : anonUserId

  const appReady = (fontsLoaded || !!fontError) && !!userId && !!sessionId

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [appReady])

  if (!appReady) {
    return (
      <View style={styles.splash}>
        <Image source={logo} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    )
  }

  return (
    <ThemeProvider>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.appName} numberOfLines={1}>
              {copy.appName}
            </Text>
          </View>

          <Pressable
            onPress={newChat}
            style={styles.headerButton}
            accessibilityLabel={copy.newChat}
            hitSlop={8}
          >
            <Text style={styles.headerButtonText}>+</Text>
          </Pressable>

          <Pressable
            onPress={toggleLanguage}
            style={styles.langButton}
            accessibilityLabel={LANGUAGE_LABEL[NEXT_LANGUAGE[language]]}
          >
            <Text style={styles.langText}>
              {LANGUAGE_LABEL[NEXT_LANGUAGE[language]]}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setProfileOpen(true)}
            style={styles.headerButton}
            accessibilityLabel={copy.profileTab}
            hitSlop={8}
          >
            {isSignedIn && user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.headerAvatar} />
            ) : (
              <Text style={styles.icon}>👤</Text>
            )}
          </Pressable>
        </View>

        {!isSignedIn && !anonymousAccepted && (
          <Pressable accessibilityRole="button" onPress={() => setAnonymousAccepted(true)} style={styles.headerButton}>
            <Text>{copy.continueWithoutSaving}</Text>
          </Pressable>
        )}
        <ChatScreen
          key={`${userId}:${sessionId}`}
          copy={copy}
          readyDocs={readyDocs}
          docsLoading={docsLoading}
          userId={userId}
          isSignedIn={!!isSignedIn}
          canAsk={!!isSignedIn || anonymousAccepted}
          anonUserId={anonUserId}
          sessionId={sessionId}
          mentionDoc={mentionDoc}
          onMentionDoc={setMentionDoc}
          onRequestSignIn={() => setProfileOpen(true)}
        />

        <Modal
          visible={profileOpen}
          animationType="slide"
          onRequestClose={() => setProfileOpen(false)}
        >
          <ProfileScreen
            copy={copy}
            language={language}
            onSetLanguage={applyLanguage}
            onClose={() => setProfileOpen(false)}
            userId={userId}
            onSelectSession={(sid) => {
              AsyncStorage.setItem("lr-mobile-session", sid)
              setSessionId(sid)
              setMentionDoc(null)
              setProfileOpen(false)
            }}
          />
        </Modal>
      </View>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <AuthTokenBridge />
        <Root />
      </SafeAreaProvider>
    </ClerkProvider>
  )
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    splash: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xl,
      backgroundColor: c.background,
    },
    splashLogo: {
      width: 120,
      height: 120,
    },
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    headerButton: {
      padding: spacing.xs,
    },
    headerButtonText: {
      fontFamily: fonts.bodyBold,
      fontSize: 20,
      color: c.primary,
    },
    brandRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerLogo: {
      width: 26,
      height: 26,
    },
    appName: {
      flexShrink: 1,
      fontFamily: fonts.display,
      fontSize: 18,
      color: c.primary,
    },
    headerAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.muted,
    },
    langButton: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    langText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.mutedForeground,
    },
    icon: {
      fontSize: 18,
    },
  })
