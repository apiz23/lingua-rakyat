import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
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
  ChatStreamEvent,
  Document,
  RateLimitError,
  SourceChunk,
  askQuestionStream,
} from "../api"
import { Copy } from "../i18n"
import { Palette, fonts, spacing, useTheme } from "../theme"

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
  userId: string
  sessionId: string
  mentionDoc: Document | null
  onMentionDoc: (doc: Document | null) => void
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function ChatScreen({
  copy,
  readyDocs,
  userId,
  sessionId,
  mentionDoc,
  onMentionDoc,
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
  const scrollRef = useRef<ScrollView>(null)

  // Chat-first: the anchored doc (required by the backend) is the pinned
  // mention when set, otherwise the first ready doc. Retrieval still spans
  // every ready doc unless a mention pins it down.
  const anchorDoc = mentionDoc ?? readyDocs[0] ?? null

  // New chat (session change) clears the transcript.
  useEffect(() => {
    setMessages([])
  }, [sessionId])

  // Rate-limit countdown.
  useEffect(() => {
    if (waitSeconds <= 0) return
    const t = setInterval(
      () => setWaitSeconds((s) => (s <= 1 ? 0 : s - 1)),
      1000
    )
    return () => clearInterval(t)
  }, [waitSeconds > 0])

  // "@" mention detection at the end of the input.
  const mentionQuery = useMemo(() => {
    const match = input.match(/@([^\s@]*)$/)
    return match && readyDocs.length > 0 ? match[1] : null
  }, [input, readyDocs.length])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return readyDocs
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 5)
  }, [mentionQuery, readyDocs])

  const selectMention = (doc: Document) => {
    onMentionDoc(doc)
    setInput((prev) => prev.replace(/@([^\s@]*)$/, "").trimEnd())
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
    if (!question || loading || !sessionId || waitSeconds > 0 || !anchorDoc)
      return

    setInput("")
    setLoading(true)
    const msgId = makeId()
    setMessages((prev) => [
      ...prev,
      { id: msgId, question, answer: "", sources: [], streaming: true },
    ])

    const chatHistory = messages
      .filter((m) => !m.streaming && m.answer && !m.error)
      .slice(-3)
      .map((m) => ({ question: m.question, answer: m.answer.slice(0, 400) }))

    // Mention pins retrieval to one doc; otherwise span the whole library.
    const documentIds = mentionDoc
      ? [mentionDoc.id]
      : readyDocs.length > 1
        ? readyDocs.map((d) => d.id)
        : []

    try {
      await askQuestionStream(
        {
          userId,
          documentId: anchorDoc.id,
          documentName: anchorDoc.name,
          sessionId,
          question,
          chatHistory,
          documentIds,
        },
        (event: ChatStreamEvent) => {
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
      // Stream ended without a complete event (connection dropped): don't
      // leave the bubble stuck on the typing indicator.
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
      if (e instanceof RateLimitError) {
        setWaitSeconds(e.waitSeconds)
        updateMessage(msgId, { streaming: false, error: copy.rateLimited })
      } else {
        updateMessage(msgId, {
          streaming: false,
          error: e instanceof Error ? e.message : copy.answerError,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Typing stays enabled while an answer streams (like ChatGPT); only
  // sending is gated on loading.
  const inputDisabled = !sessionId || waitSeconds > 0 || !anchorDoc
  const composerDisabled = inputDisabled || loading

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          messages.length === 0 && styles.scrollContentEmpty,
        ]}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{copy.appName}</Text>
            <Text style={styles.emptyTagline}>{copy.tagline}</Text>
            <Text style={styles.emptyMeta}>
              {readyDocs.length} {copy.readyDocsSuffix}
              {readyDocs.length > 1 ? ` · ${copy.allDocsNote}` : ""}
            </Text>
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
                  {m.confidence_label.toUpperCase()}
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

      <View
        style={[
          styles.composerArea,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {mentionQuery !== null ? (
          <View style={styles.mentionPanel}>
            <Text style={styles.mentionTitle}>{copy.mentionTitle}</Text>
            {mentionMatches.length === 0 ? (
              <Text style={styles.mentionEmpty}>{copy.mentionNoMatch}</Text>
            ) : (
              mentionMatches.map((d) => (
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
              ))
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

        <View style={styles.composer}>
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
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
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
      borderRadius: 16,
      borderBottomRightRadius: 4,
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
      borderRadius: 16,
      borderTopLeftRadius: 4,
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
      borderRadius: 999,
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
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    suggestionText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.primary,
    },
    composerArea: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.card,
    },
    mentionPanel: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    mentionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.mutedForeground,
    },
    mentionEmpty: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.mutedForeground,
    },
    mentionRow: {
      paddingVertical: spacing.sm,
    },
    mentionRowText: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.primary,
    },
    pinnedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    pinnedChip: {
      flexShrink: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.primary,
      backgroundColor: c.highBg,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
      overflow: "hidden",
    },
    pinnedClear: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.mutedForeground,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
    },
    input: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      color: c.foreground,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      maxHeight: 110,
    },
    sendButton: {
      backgroundColor: c.primary,
      borderRadius: 999,
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
