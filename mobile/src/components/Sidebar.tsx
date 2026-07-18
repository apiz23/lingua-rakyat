import React, { useEffect, useMemo, useRef } from "react"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth, useUser } from "@clerk/clerk-expo"
import { Document } from "../api"
import { Copy } from "../i18n"
import { Palette, fonts, spacing, useTheme } from "../theme"

const DRAWER_WIDTH = Math.min(300, Dimensions.get("window").width * 0.82)

const logo = require("../../assets/splash-icon.png")

interface Props {
  visible: boolean
  copy: Copy
  docs: Document[]
  loading: boolean
  onClose: () => void
  onNewChat: () => void
  onPickDoc: (doc: Document) => void
  onRefresh: () => void
  onOpenProfile: () => void
}

export default function Sidebar({
  visible,
  copy,
  docs,
  loading,
  onClose,
  onNewChat,
  onPickDoc,
  onRefresh,
  onOpenProfile,
}: Props) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(c), [c])
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const [mounted, setMounted] = React.useState(visible)

  const { user } = useUser()
  const { isSignedIn } = useAuth()

  const displayName =
    user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress

  // useNativeDriver:false on purpose — with the native driver (new arch),
  // the transform is applied visually but hit-testing keeps the pre-transform
  // position, so every tap lands on the overlay behind the drawer.
  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start()
    } else {
      Animated.timing(slide, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: false,
      }).start(() => setMounted(false))
    }
  }, [visible, slide])

  if (!mounted) return null

  const readyDocs = docs.filter((d) => d.status === "ready")

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.overlay} onPress={onClose} />

      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slide }],
            paddingTop: insets.top + spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        <View style={styles.wordmarkRow}>
          <Image
            source={logo}
            style={styles.wordmarkLogo}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>{copy.appName}</Text>
        </View>

        <Pressable style={styles.newChatButton} onPress={onNewChat}>
          <Text style={styles.newChatText}>+ {copy.newChat}</Text>
        </Pressable>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{copy.documents}</Text>
          <Pressable onPress={onRefresh} hitSlop={8}>
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={c.primary}
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <FlatList
            data={readyDocs}
            keyExtractor={(d) => d.id}
            keyboardShouldPersistTaps="handled"
            style={styles.docListFlex}
            contentContainerStyle={styles.docList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{copy.noDocs}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.docRow,
                  pressed && styles.docRowPressed,
                ]}
                onPress={() => onPickDoc(item)}
              >
                {item.agency ? (
                  <Text style={styles.agency}>{item.agency}</Text>
                ) : null}
                <Text style={styles.docName} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        )}

        <View style={styles.accountBlock}>
          <Pressable
            style={({ pressed }) => [
              styles.profileRow,
              pressed && styles.profileRowPressed,
            ]}
            onPress={onOpenProfile}
            accessibilityLabel={copy.profileTab}
          >
            {isSignedIn && user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {isSignedIn
                    ? (displayName ?? "?").slice(0, 1).toUpperCase()
                    : "?"}
                </Text>
              </View>
            )}
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>
                {isSignedIn ? (displayName ?? user?.id) : copy.guest}
              </Text>
              {isSignedIn && user?.primaryEmailAddress?.emailAddress ? (
                <Text style={styles.profileHint} numberOfLines={1}>
                  {user.primaryEmailAddress.emailAddress}
                </Text>
              ) : null}
            </View>
            <Text style={styles.profileChevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          {readyDocs.length} {copy.readyDocsSuffix}
        </Text>
      </Animated.View>
    </View>
  )
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    drawer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: DRAWER_WIDTH,
      backgroundColor: c.background,
      borderRightWidth: 1,
      borderRightColor: c.border,
      paddingHorizontal: spacing.lg,
      zIndex: 2,
      elevation: 8,
    },
    wordmarkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    wordmarkLogo: {
      width: 30,
      height: 30,
    },
    wordmark: {
      flexShrink: 1,
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.primary,
    },
    newChatButton: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 12,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    newChatText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.primary,
    },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.mutedForeground,
    },
    refreshText: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: c.mutedForeground,
    },
    docListFlex: {
      flex: 1,
    },
    docList: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    docRow: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      gap: 2,
    },
    docRowPressed: {
      borderColor: c.primary,
    },
    agency: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.primary,
    },
    docName: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.foreground,
      lineHeight: 18,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.mutedForeground,
    },
    footerNote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.mutedForeground,
      marginTop: spacing.sm,
    },
    accountBlock: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.md,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: spacing.md,
    },
    profileRowPressed: {
      borderColor: c.primary,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.muted,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: c.primary,
    },
    profileText: {
      flex: 1,
      gap: 1,
    },
    profileName: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.foreground,
    },
    profileHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
    },
    profileChevron: {
      fontFamily: fonts.body,
      fontSize: 22,
      color: c.mutedForeground,
    },
  })
