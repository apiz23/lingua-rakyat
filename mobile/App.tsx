import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context"
import { useColorScheme } from "react-native"
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
import {
  Palette,
  ThemeMode,
  ThemeProvider,
  fonts,
  isDarkPalette,
  radius,
  resolvePalette,
  spacing,
} from "./src/theme"
import ChatScreen from "./src/screens/ChatScreen"
import ProfileScreen from "./src/screens/ProfileScreen"
import Sidebar from "./src/components/Sidebar"

const logo = require("./assets/splash-icon.png")

// Completes the pending OAuth browser session when the app regains focus.
WebBrowser.maybeCompleteAuthSession()

// Hold the native splash (Lingua Rakyat logo) until fonts and identity load.
SplashScreen.preventAutoHideAsync().catch(() => {})

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Feeds Clerk's session token to the plain-fetch API client (src/api.ts),
// mirroring the web app's auth-token bridge.
function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth()
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [getToken, isSignedIn])
  return null
}


function Root() {
  const systemScheme = useColorScheme()
  const insets = useSafeAreaInsets()

  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  })

  const { user } = useUser()
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [language, setLanguage] = useState<AppLanguage>("en")
  const [anonUserId, setAnonUserId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [mentionDoc, setMentionDoc] = useState<Document | null>(null)

  const c = resolvePalette(themeMode, systemScheme)
  const styles = useMemo(() => createStyles(c), [c])

  // Anonymous identity, workspace session, and language preference —
  // persisted across launches.
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
    AsyncStorage.getItem("lr-mobile-theme").then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeMode(stored)
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

  const toggleTheme = () => {
    const next: ThemeMode =
      themeMode === "system"
        ? systemScheme === "dark"
          ? "light"
          : "dark"
        : themeMode === "dark"
          ? "light"
          : "system"
    setThemeMode(next)
    AsyncStorage.setItem("lr-mobile-theme", next)
  }

  const newChat = () => {
    const next = makeId("session")
    AsyncStorage.setItem("lr-mobile-session", next)
    setSessionId(next)
    setMentionDoc(null)
    setDrawerOpen(false)
  }

  const copy = COPY[language]
  const readyDocs = docs.filter((d) => d.status === "ready")
  // Signed-in citizens keep one history across web + mobile via the Clerk
  // user id; everyone else stays on the device-local anonymous id.
  const userId = user?.id ?? anonUserId

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
    <ThemeProvider mode={themeMode}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style={isDarkPalette(c) ? "light" : "dark"} />

        <View style={styles.header}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          style={styles.iconButton}
          accessibilityLabel={copy.menu}
          hitSlop={8}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>

        <View style={styles.brandRow}>
          <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.appName} numberOfLines={1}>
            {copy.appName}
          </Text>
        </View>

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
          onPress={toggleTheme}
          style={styles.iconButton}
          accessibilityLabel="Toggle theme"
          hitSlop={8}
        >
          <Text style={styles.themeIcon}>
            {themeMode === "system"
              ? "◐"
              : themeMode === "dark"
                ? "☀"
                : "●"}
          </Text>
        </Pressable>
      </View>

      <ChatScreen
        copy={copy}
        readyDocs={readyDocs}
        userId={userId}
        sessionId={sessionId}
        mentionDoc={mentionDoc}
        onMentionDoc={setMentionDoc}
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
          themeMode={themeMode}
          onSetTheme={(mode) => {
            setThemeMode(mode)
            AsyncStorage.setItem("lr-mobile-theme", mode)
          }}
          onClose={() => setProfileOpen(false)}
        />
      </Modal>

      <Sidebar
        visible={drawerOpen}
        copy={copy}
        docs={docs}
        loading={docsLoading}
        onClose={() => setDrawerOpen(false)}
        onNewChat={newChat}
        onPickDoc={(doc) => {
          setMentionDoc(doc)
          setDrawerOpen(false)
        }}
        onRefresh={loadDocs}
        onOpenProfile={() => {
          setDrawerOpen(false)
          setProfileOpen(true)
        }}
      />
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
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    iconButton: {
      padding: spacing.xs,
    },
    menuIcon: {
      fontFamily: fonts.body,
      fontSize: 20,
      color: c.foreground,
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
    langButton: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    langText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.mutedForeground,
    },
    themeIcon: {
      fontFamily: fonts.body,
      fontSize: 20,
      color: c.foreground,
    },
  })
