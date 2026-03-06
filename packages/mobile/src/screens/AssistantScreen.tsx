import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  topics?: string[];
}

const SUGGESTIONS = [
  "Why was food cost high last week?",
  "What should I order for next week?",
  "How are we trending on waste?",
  "Compare my store to the others",
  "Which ingredients are running low?",
  "Any anomalies I should know about?",
];

export function AssistantScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const s = makeStyles(colors);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedStoreId || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await api.askAssistant(selectedStoreId, text.trim());
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: result.answer,
        timestamp: result.timestamp,
        topics: result.topicsAnalyzed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Sorry, I couldn't process that request. ${err.message || "Please try again."}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        s.messageBubble,
        item.role === "user"
          ? [s.userBubble, { backgroundColor: colors.primary }]
          : [s.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
      ]}
    >
      <Text
        style={[
          s.messageText,
          item.role === "user" ? s.userText : { color: colors.text },
        ]}
      >
        {item.text}
      </Text>
      {item.topics && (
        <View style={s.topicsRow}>
          {item.topics.map((topic) => (
            <View key={topic} style={[s.topicTag, { backgroundColor: colors.background }]}>
              <Text style={[s.topicText, { color: colors.textSecondary }]}>{topic}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (!selectedStoreId) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>FoodWise Assistant</Text>
          <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
            Select a store from the Dashboard to start asking questions
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <StorePicker />

      {messages.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>FoodWise Assistant</Text>
          <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
            Ask me anything about your store's operations
          </Text>
          <View style={s.suggestionsGrid}>
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={[s.suggestionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => sendMessage(suggestion)}
              >
                <Text style={[s.suggestionText, { color: colors.primary }]}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {loading && (
        <View style={s.typingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[s.typingText, { color: colors.textSecondary }]}>Analyzing your data...</Text>
        </View>
      )}

      <View style={[s.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          style={[s.input, { backgroundColor: colors.background, color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
          editable={!loading}
        />
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && s.sendDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={s.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    emptyTitle: { fontSize: fontSize.xl, fontWeight: "800", marginBottom: spacing.xs },
    emptySubtitle: { fontSize: fontSize.md, marginBottom: spacing.xl, textAlign: "center" },
    suggestionsGrid: { width: "100%" },
    suggestionBtn: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
    suggestionText: { fontSize: fontSize.sm },
    messageList: { padding: spacing.md },
    messageBubble: { maxWidth: "85%", borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
    userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
    assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
    messageText: { fontSize: fontSize.md, lineHeight: 22 },
    userText: { color: "#fff" },
    topicsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm, gap: spacing.xs },
    topicTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    topicText: { fontSize: fontSize.xs },
    typingIndicator: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
    typingText: { fontSize: fontSize.sm },
    inputBar: { flexDirection: "row", alignItems: "flex-end", padding: spacing.md, borderTopWidth: 1 },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, maxHeight: 100 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginLeft: spacing.sm },
    sendDisabled: { opacity: 0.4 },
    sendText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },
  });
