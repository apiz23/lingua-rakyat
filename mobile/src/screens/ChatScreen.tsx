import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  AuthRequiredError,
  ChatStreamEvent,
  Document,
  RateLimitError,
  SourceChunk,
  askQuestionStream,
} from "../api"
import { Copy } from "../i18n"
import { Palette, fonts, radius, spacing, useTheme } from "../theme"

interface Message {
  id: string
  question: string
  answer: string
  sources: SourceChunk[]
  confidence_label?: "high" | "medium" | "low"
  suggestions?: string[]
  streaming: boolean
  error?: string
}

interface Props {
  copy: Copy
  readyDocs: Document[]
  docsLoading: boolean
  userId: string
  isSignedIn: boolean
  canAsk: boolean
  anonUserId: string
  sessionId: string
  mentionDoc: Document | null
  onMentionDoc: (doc: Document | null) => void
  onRequestSignIn: () => void
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const PICKER_MAX_HEIGHT = 260
const MENTION_MAX_HEIGHT = 200

export default function ChatScreen({
  copy,
  readyDocs,
  docsLoading,
  userId,
  isSignedIn,
  canAsk,
  anonUserId,
  sessionId,
  mentionDoc,
  onMentionDoc,
  onRequestSignIn,
}: Props) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(c), [c])
  const confidenceStyle = useMemo(
    () => ({
      high: { color: c.high, backgroundColor: c.highBg },
      medium: { color: c.medium, backgroundColor: c.mediumBg },
      low: { color: c.low, backgroundColor: c.lowBg },
    }),
    [c]
  )

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const requestRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    return () => {
      generationRef.current += 1
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [userId, sessionId])

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setDocPickerOpen(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    })
    return () => showSub.remove()
  }, [])

  const anchorDoc = mentionDoc ?? readyDocs[0] ?? null

  useEffect(() => {
    setMessages([])
  }, [sessionId])

  useEffect(() => {
    if (waitSeconds <= 0) return
    const t = setInterval(
      () => setWaitSeconds((s) => (s <= 1 ? 0 : s - 1)),
      1000
    )
    return () => clearInterval(t)
  }, [waitSeconds > 0])

  const mentionQuery = useMemo(() => {
    const match = input.match(/@([^\s@]*)$/)
    return match && readyDocs.length > 0 ? match[1] : null
  }, [input, readyDocs.length])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return readyDocs
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [mentionQuery, readyDocs])

  const selectMention = (doc: Document) => {
    onMentionDoc(doc)
    setInput((prev) => prev.replace(/@([^\s@]*)$/, "").trimEnd())
  }

  const selectFromPicker = (doc: Document) => {
    onMentionDoc(doc)
    setDocPickerOpen(false)
  }

  const updateMessage = (id: string, patch: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
  }

  const appendAnswer = (id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, answer: m.answer + text } : m))
    )
  }

  const submit = async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim()
    if (!canAsk || !question || loading || !sessionId || waitSeconds > 0 || !anchorDoc)
      return

    setInput("")
    setDocPickerOpen(false)
    setAuthRequired(false)
    setLoading(true)
    const msgId = makeId()
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const generation = ++generationRef.current
    const current = () => generationRef.current === generation && !controller.signal.aborted
    setMessages((prev) => [
      ...prev,
      { id: msgId, question, answer: "", sources: [], streaming: true },
    ])

    const chatHistory = messages
      .filter((m) => !m.streaming && m.answer && !m.error)
      .slice(-3)
      .map((m) => ({ question: m.question, answer: m.answer.slice(0, 400) }))

    const documentIds = mentionDoc
      ? [mentionDoc.id]
      : readyDocs.length > 1
        ? readyDocs.map((d) => d.id)
        : []

    try {
      await askQuestionStream(
        {
          userId,
          anonUserId,
          documentId: anchorDoc.id,
          documentName: anchorDoc.name,
          sessionId,
          question,
          chatHistory,
          documentIds,
          requireAuth: isSignedIn,
          signal: controller.signal,
        },
        (event: ChatStreamEvent) => {
          if (!current()) return
          if (event.type === "token") {
            appendAnswer(msgId, event.text)
          } else if (event.type === "complete") {
            updateMessage(msgId, {
              answer: event.answer,
              sources: event.sources ?? [],
              confidence_label: event.confidence_label,
              streaming: false,
            })
          } else if (event.type === "suggestions") {
            updateMessage(msgId, { suggestions: event.questions })
          } else if (event.type === "error") {
            updateMessage(msgId, {
              streaming: false,
              error: event.detail || copy.answerError,
            })
          }
        }
      )
      if (!current()) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.streaming
            ? {
                ...m,
                streaming: false,
                error: m.answer ? undefined : copy.answerError,
              }
            : m
        )
      )
    } catch (e) {
      if (!current()) return
      if (e instanceof AuthRequiredError) {
        setAuthRequired(true)
        updateMessage(msgId, { streaming: false, error: copy.sessionExpired })
      } else if (e instanceof RateLimitError) {
        setWaitSeconds(e.waitSeconds)
        updateMessage(msgId, { streaming: false, error: copy.rateLimited })
      } else {
        updateMessage(msgId, {
          streaming: false,
          error: e instanceof Error ? e.message : copy.answerError,
        })
      }
    } finally {
      if (current()) { setLoading(false); requestRef.current = null }
    }
  }

  const inputDisabled = !canAsk || !sessionId || waitSeconds > 0 || !anchorDoc
  const composerDisabled = inputDisabled || loading

  const renderDocItem = ({ item }: { item: Document }) => {
    const isSelected = item.id === mentionDoc?.id
    return (
      <Pressable
        style={({ pressed }) => [
          styles.pickerRow,
          isSelected && styles.pickerRowSelected,
          pressed && styles.pickerRowPressed,
        ]}
        onPress={() => selectFromPicker(item)}
      >
        <View style={styles.pickerDocInfo}>
          {item.agency ? (
            <Text style={styles.pickerAgency} numberOfLines={1}>
              {item.agency}
            </Text>
          ) : null}
          <Text style={styles.pickerDocName} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
        {isSelected ? (
          <Text style={styles.pickerCheck}>✓</Text>
        ) : (
          <Text style={styles.pickerChevron}>›</Text>
        )}
      </Pressable>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          messages.length === 0 && styles.scrollContentEmpty,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{copy.appName}</Text>
            <Text style={styles.emptyTagline}>{copy.tagline}</Text>
            {docsLoading ? (
              <View style={styles.emptyLoadingRow}>
                <ActivityIndicator size="small" color={c.primary} />
                <Text style={styles.emptyMeta}>{copy.loadingDocuments}</Text>
              </View>
            ) : (
              <Text style={styles.emptyMeta}>
                {readyDocs.length} {copy.readyDocsSuffix}
                {readyDocs.length > 1 ? ` · ${copy.allDocsNote}` : ""}
              </Text>
            )}
            <Text style={styles.emptyHint}>{copy.emptyHint}</Text>
          </View>
        ) : null}

        {messages.map((m) => (
          <View key={m.id} style={styles.turn}>
            <View style={styles.questionBubble}>
              <Text style={styles.questionText}>{m.question}</Text>
            </View>

            <View style={styles.answerCard}>
              {m.error ? (
                <Text style={styles.errorText}>{m.error}</Text>
              ) : m.answer ? (
                <Text style={styles.answerText}>{m.answer}</Text>
              ) : (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={styles.thinkingText}>{copy.thinking}</Text>
                </View>
              )}

              {!m.streaming && !m.error && m.confidence_label ? (
                <Text
                  style={[
                    styles.confidenceChip,
                    confidenceStyle[m.confidence_label],
                  ]}
                >
                  {m.confidence_label === 'high' ? copy.confidenceHigh : m.confidence_label === 'medium' ? copy.confidenceMedium : copy.confidenceLow}
                </Text>
              ) : null}

              {!m.streaming && m.sources.length > 0 ? (
                <View style={styles.sourcesBlock}>
                  <Text style={styles.sourcesTitle}>{copy.sources}</Text>
                  {m.sources.slice(0, 3).map((s, i) => (
                    <Text key={i} style={styles.sourceLine} numberOfLines={1}>
                      {s.doc_name || anchorDoc?.name || ""}
                      {s.page_start ? ` · ${copy.page}${s.page_start}` : ""}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            {!m.streaming && m.suggestions && m.suggestions.length > 0 ? (
              <View style={styles.suggestionsBlock}>
                <Text style={styles.suggestionsTitle}>{copy.suggestions}</Text>
                {m.suggestions.slice(0, 3).map((q, i) => (
                  <Pressable
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => submit(q)}
                    disabled={composerDisabled}
                  >
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {q}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {docPickerOpen ? (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>
              {copy.documents}
              {docsLoading
                ? ""
                : readyDocs.length > 0
                  ? ` · ${readyDocs.length}`
                  : ""}
            </Text>
            <Pressable
              onPress={() => setDocPickerOpen(false)}
              hitSlop={8}
              style={styles.pickerCloseBtn}
            >
              <Text style={styles.pickerClose}>✕</Text>
            </Pressable>
          </View>
          {docsLoading ? (
            <View style={styles.skeletonList}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <View style={styles.skeletonBadge} />
                  <View style={styles.skeletonTextBlock}>
                    <View style={[styles.skeletonLine, { width: "70%" }]} />
                    <View style={[styles.skeletonLine, { width: "45%" }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : readyDocs.length > 0 ? (
            <FlatList
              data={readyDocs}
              keyExtractor={(d) => d.id}
              renderItem={renderDocItem}
              style={{ maxHeight: PICKER_MAX_HEIGHT }}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.pickerDivider} />}
            />
          ) : (
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>{copy.noDocs}</Text>
            </View>
          )}
        </View>
      ) : null}

      {mentionQuery !== null ? (
        <View style={styles.mentionPanel}>
          <Text style={styles.mentionTitle}>{copy.mentionTitle}</Text>
          {mentionMatches.length === 0 ? (
            <Text style={styles.mentionEmpty}>{copy.mentionNoMatch}</Text>
          ) : (
            <View>
              <ScrollView
                style={{ maxHeight: MENTION_MAX_HEIGHT }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {mentionMatches.map((d) => (
                  <Pressable
                    key={d.id}
                    style={styles.mentionRow}
                    onPress={() => selectMention(d)}
                  >
                    <Text style={styles.mentionRowText} numberOfLines={1}>
                      {d.agency ? `${d.agency} · ` : ""}
                      {d.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {mentionMatches.length >= 5 ? (
                <View style={styles.scrollIndicator}>
                  <Text style={styles.scrollIndicatorText}>↕ {copy.scroll}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {mentionDoc ? (
        <View style={styles.pinnedRow}>
          <Text style={styles.pinnedChip} numberOfLines={1}>
            @{mentionDoc.name}
          </Text>
          <Pressable onPress={() => onMentionDoc(null)} hitSlop={8}>
            <Text style={styles.pinnedClear}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.composerArea,
          { paddingBottom: insets.bottom || spacing.sm },
        ]}
      >
        {authRequired ? (
          <View style={styles.authBanner} accessibilityLiveRegion="polite">
            <Text style={styles.authBannerText}>{copy.sessionExpired}</Text>
            <Pressable
              onPress={onRequestSignIn}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.authBannerAction}>{copy.signIn}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable
            style={[
              styles.attachButton,
              docsLoading && styles.attachButtonLoading,
            ]}
            onPress={() => {
              Keyboard.dismiss()
              setDocPickerOpen((prev) => !prev)
            }}
            disabled={docsLoading}
            accessibilityLabel={copy.documents}
          >
            {docsLoading ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <Text style={styles.attachIcon}>📄</Text>
            )}
          </Pressable>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={
              waitSeconds > 0
                ? `${copy.rateLimited} ${waitSeconds}s`
                : copy.askPlaceholder
            }
            placeholderTextColor={c.mutedForeground}
            editable={!inputDisabled}
            multiline
          />
          <Pressable
            style={[
              styles.sendButton,
              (composerDisabled || !input.trim()) && styles.sendButtonDisabled,
            ]}
            onPress={() => submit()}
            disabled={composerDisabled || !input.trim()}
          >
            <Text style={styles.sendText}>{copy.send}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    scrollContentEmpty: {
      flexGrow: 1,
      justifyContent: "center",
    },
    emptyState: {
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: c.primary,
      textAlign: "center",
    },
    emptyTagline: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.foreground,
      textAlign: "center",
    },
    emptyMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
      textAlign: "center",
    },
    emptyLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      overflow: "hidden",
    },
    turn: {
      gap: spacing.sm,
    },
    questionBubble: {
      alignSelf: "flex-end",
      maxWidth: "85%",
      backgroundColor: c.primary,
      borderRadius: radius,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    questionText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: c.primaryForeground,
      lineHeight: 21,
    },
    answerCard: {
      alignSelf: "flex-start",
      maxWidth: "92%",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    answerText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: c.foreground,
      lineHeight: 23,
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.destructive,
    },
    thinkingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    thinkingText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.mutedForeground,
    },
    confidenceChip: {
      alignSelf: "flex-start",
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius,
      overflow: "hidden",
    },
    sourcesBlock: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm,
      gap: 2,
    },
    sourcesTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: c.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    sourceLine: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
    },
    suggestionsBlock: {
      gap: spacing.xs,
    },
    suggestionsTitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
    },
    suggestionChip: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    suggestionText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.primary,
    },

    pickerContainer: {
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    pickerTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.mutedForeground,
    },
    pickerCloseBtn: {
      padding: spacing.xs,
    },
    pickerClose: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: c.mutedForeground,
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    pickerRowSelected: {
      backgroundColor: c.highBg,
    },
    pickerRowPressed: {
      backgroundColor: c.muted,
    },
    pickerDocInfo: {
      flex: 1,
      gap: 2,
    },
    pickerAgency: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.primary,
    },
    pickerDocName: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.foreground,
      lineHeight: 18,
    },
    pickerCheck: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.primary,
    },
    pickerChevron: {
      fontFamily: fonts.body,
      fontSize: 18,
      color: c.mutedForeground,
    },
    pickerDivider: {
      height: 1,
      backgroundColor: c.border,
      marginLeft: spacing.lg,
    },
    pickerEmpty: {
      padding: spacing.lg,
      alignItems: "center",
    },
    pickerEmptyText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.mutedForeground,
    },

    skeletonList: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    skeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    skeletonBadge: {
      width: 32,
      height: 12,
      borderRadius: 4,
      backgroundColor: c.muted,
    },
    skeletonTextBlock: {
      flex: 1,
      gap: 4,
    },
    skeletonLine: {
      height: 10,
      borderRadius: 4,
      backgroundColor: c.muted,
    },

    mentionPanel: {
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    mentionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.mutedForeground,
      marginBottom: spacing.xs,
    },
    mentionEmpty: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.mutedForeground,
    },
    mentionRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    mentionRowText: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.primary,
    },
    scrollIndicator: {
      alignItems: "center",
      paddingVertical: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    scrollIndicatorText: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: c.mutedForeground,
      letterSpacing: 0.5,
    },

    pinnedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: c.card,
    },
    pinnedChip: {
      flexShrink: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.primary,
      backgroundColor: c.highBg,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
      overflow: "hidden",
    },
    pinnedClear: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.mutedForeground,
    },

    composerArea: {
      flexShrink: 0,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.card,
    },
    authBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: c.lowBg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    authBannerText: {
      flexShrink: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.destructive,
    },
    authBannerAction: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.primary,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
    },
    attachButton: {
      justifyContent: "center",
      alignItems: "center",
      width: 40,
      height: 40,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    attachButtonLoading: {
      opacity: 0.6,
    },
    attachIcon: {
      fontSize: 18,
    },
    input: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      color: c.foreground,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.input,
      borderRadius: radius,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      maxHeight: 110,
    },
    sendButton: {
      backgroundColor: c.primary,
      borderRadius: radius,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    sendText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.primaryForeground,
    },
  })
