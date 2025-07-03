import React, { useState, useRef, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import {
  SafeAreaView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  StyleSheet,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { initLlama, loadLlamaModelInfo } from "llama.rn";

// Types
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ActionBubble = {
  id: string;
  text: string;
  scale: Animated.Value;
  opacity: Animated.Value;
};

type ChatHeaderProps = {
  isDarkMode: boolean;
  clearChat: () => void;
  onMenuPress: () => void;
};

type ErrorMessageProps = {
  error: string;
};

type ProgressBarProps = {
  progress: number;
  isDarkMode: boolean;
};

type MessageBubbleProps = {
  message: Message;
  isDarkMode: boolean;
};

type ChatInputProps = {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  sendMessage: () => void;
  isProcessing: boolean;
  isDarkMode: boolean;
  onVoiceInput: () => void;
};

const therapyPrompts = [
  "I'm feeling stressed",
  "Can't sleep",
  "Need motivation",
  "Feeling lonely",
  "Need calm thoughts",
  "Stress relief",
  "Help me relax",
  "Feeling down",
];

// Components
const ActionBubble: React.FC<{
  bubble: ActionBubble;
  onPress: (id: string) => void;
  isDarkMode: boolean;
}> = ({ bubble, onPress, isDarkMode }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onPress(bubble.id));
  };

  return (
    <Animated.View
      style={[
        styles.actionBubble,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        isDarkMode && styles.darkActionBubble,
      ]}
    >
      <TouchableOpacity onPress={animatePress} style={styles.actionBubbleInner}>
        <Text style={[styles.actionBubbleText, isDarkMode && styles.darkText]}>
          {bubble.text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChatHeader: React.FC<ChatHeaderProps> = ({
  isDarkMode,
  clearChat,
  onMenuPress,
}) => {
  const animateNewChat = () => {
    const clearWithAnimation = () => {
      // Add a subtle scale animation
      Animated.sequence([
        Animated.timing(new Animated.Value(1), {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(new Animated.Value(0.95), {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(clearChat);
    };
    clearWithAnimation();
  };

  return (
    <View>
      <StatusBar
        backgroundColor={isDarkMode ? "#242634" : "#FFFFFF"}
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <View style={[styles.header, isDarkMode && styles.darkHeader]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
        >
          <Icon
            name="menu"
            size={24}
            color={isDarkMode ? "#FFFFFF" : "#888888"}
          />
        </TouchableOpacity>
        <Text style={[styles.timeText, isDarkMode && styles.darkText]}>
          rlbachen
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={animateNewChat}
          activeOpacity={0.7}
        >
          <Icon
            name="plus"
            size={24}
            color={isDarkMode ? "#FFFFFF" : "#888888"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const LoadingSpinner = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#382c52" />
  </View>
);

const Error = ({ error }: ErrorMessageProps) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{error}</Text>
  </View>
);

const ProgressBar = ({ progress, isDarkMode }: ProgressBarProps) => (
  <View style={styles.progressContainer}>
    <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
  </View>
);

const BrainIcon = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <View style={styles.brainIconContainer}>
    <FontAwesome6
      name="brain"
      size={24}
      color={isDarkMode ? "#FFFFFF" : "#382c52"}
      style={styles.brainIcon}
    />
  </View>
);

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isDarkMode,
}) => (
  <View
    style={[
      styles.messageContainer,
      message.role === "user" && styles.userMessage,
      message.role === "user" && { borderRadius: 25 },
      message.role === "assistant" && {
        flexDirection: "column",
        alignItems: "flex-start",
      },
    ]}
  >
    {message.role === "assistant" && <BrainIcon isDarkMode={isDarkMode} />}
    <Text
      style={[
        styles.messageText,
        isDarkMode ? styles.darkText : styles.lightText,
        message.role === "assistant" && { marginTop: 10 },
      ]}
    >
      {message.content}
    </Text>
  </View>
);

const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  setInputMessage,
  sendMessage,
  isProcessing,
  isDarkMode,
  onVoiceInput,
}) => {
  const [actionBubbles, setActionBubbles] = useState<ActionBubble[]>([]);
  const scrollViewRef = useRef(null);
  const [showBubbles, setShowBubbles] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);

  const createBubbles = () => {
    return therapyPrompts.slice(0, 5).map((text, index) => ({
      id: index.toString(),
      text,
      scale: new Animated.Value(1),
      opacity: new Animated.Value(1),
    }));
  };

  const handleBubblePress = (bubbleId: string) => {
    const bubble = actionBubbles.find((b) => b.id === bubbleId);
    if (bubble) {
      setShowBubbles(false);
      setInputMessage(bubble.text);
      sendMessage();
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    setShowBubbles(false);
  };

  useEffect(() => {
    if (showBubbles) {
      setActionBubbles(createBubbles());
    }
  }, [showBubbles]);

  return (
    <View style={styles.footerContainer}>
      {showBubbles && !inputFocused && (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionBubblesContainer}
          contentContainerStyle={styles.actionBubblesContent}
        >
          {actionBubbles.map((bubble) => (
            <ActionBubble
              key={bubble.id}
              bubble={bubble}
              onPress={handleBubblePress}
              isDarkMode={isDarkMode}
            />
          ))}
        </ScrollView>
      )}

      <View
        style={[
          styles.inputContainer,
          isDarkMode ? styles.darkInput : styles.lightInput,
        ]}
      >
        <TextInput
          style={[styles.input, { color: isDarkMode ? "#FFFFFF" : "#000000" }]}
          value={inputMessage}
          onChangeText={setInputMessage}
          onFocus={handleInputFocus}
          placeholder="Ask me anything..."
          placeholderTextColor={isDarkMode ? "#999" : "#666"}
          multiline
          editable={!isProcessing}
        />

        <TouchableOpacity style={styles.iconButton} onPress={onVoiceInput}>
          <Icon
            name="mic"
            size={20}
            color={isDarkMode ? "#FFFFFF" : "#888888"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, isProcessing && { opacity: 0.5 }]}
          onPress={sendMessage}
          disabled={isProcessing}
        >
          <Icon name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [context, setContext] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const MODEL_URL =
    "https://pub-741c015d579d42f8acfe54bd0788c5ef.r2.dev/gemma-2-2b-it-Q8_0.gguf";
  const modelDirectory = `${FileSystem.documentDirectory}models/`;
  const localModelPath = `${modelDirectory}gemma-2-2b-it-Q8_0-011.gguf`;

  const handleMenuPress = () => {};

  const clearChat = () => {
    setMessages([]);
    setInputMessage("");
  };

  const handleVoiceInput = () => {
    console.log("Voice input triggered");
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  async function loadModel() {
    try {
      console.log("Loading model...");
      setIsProcessing(true);
      const dirInfo = await FileSystem.getInfoAsync(modelDirectory);
      if (!dirInfo.exists) {
        console.log("Creating model directory...");
        await FileSystem.makeDirectoryAsync(modelDirectory, {
          intermediates: true,
        });
      }

      const modelInfo = await FileSystem.getInfoAsync(localModelPath);
      if (!modelInfo.exists) {
        console.log("Downloading model...");
        const downloadResumable = FileSystem.createDownloadResumable(
          MODEL_URL,
          localModelPath,
          {},
          (downloadProgress: {
            totalBytesWritten: number;
            totalBytesExpectedToWrite: number;
          }) => {
            const progress =
              downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
            console.log(`Download progress: ${(progress * 100).toFixed(2)}%`);
          },
        );

        try {
          await downloadResumable.downloadAsync();
          console.log("Model download complete");
        } catch (downloadError: any) {
          if (downloadError?.message?.includes("timed out")) {
            setError(
              "Download timed out. Please check your internet connection and try again.",
            );
            setIsProcessing(false);
            return;
          }
          throw downloadError;
        }

        const fileInfo = await FileSystem.getInfoAsync(localModelPath, {
          md5: true,
        });
        console.log("Model file info:", fileInfo);
      }

      console.log("Loading model info...", localModelPath);
      await loadLlamaModelInfo(localModelPath);
      console.log("Initializing Llama...");

      const llamaContext = await initLlama({
        model: localModelPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 0,
        use_progress_callback: true,
      });
      setContext(llamaContext);
      console.log("Model loaded successfully");
    } catch (e: any) {
      console.error("Error loading model:", e);
      setError(e.message || "Failed to load model");
    } finally {
      setIsProcessing(false);
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    if (!context) {
      await loadModel();
      if (!context) return;
    }

    const messageToSend = inputMessage;
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: messageToSend },
    ];
    setMessages(newMessages);
    setInputMessage("");

    try {
      setIsProcessing(true);
      const msgResult = await context.completion(
        {
          messages: [
            {
              role: "system",
              content:
                "This is a conversation between user and assistant, an AI Therapist chatbot.",
            },
            ...newMessages,
          ],
          n_predict: 512,
          stop: [
            "</s>",
            "<|end|>",
            "<|eot_id|>",
            "<|end_of_text|>",
            "<|im_end|>",
            "<|EOT|>",
            "<|END_OF_TURN_TOKEN|>",
            "<end_of_turn>",
            "<end_of_turn><eos>",
            "<|endoftext|>",
            "<|end_of_text|>",
          ],
        },
        (data: { token: string }) => {
          // Token handling if needed in future
        },
      );

      const response: Message = { role: "assistant", content: msgResult.text };
      setMessages([...newMessages, response]);
    } catch (e: any) {
      console.error("Error sending message:", e);
      setError(e.message || "Failed to send message");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isDarkMode ? styles.darkContainer : styles.lightContainer,
      ]}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ChatHeader
            isDarkMode={isDarkMode}
            clearChat={clearChat}
            onMenuPress={handleMenuPress}
          />

          {error && <Error error={error} />}

          {downloadProgress > 0 && downloadProgress < 1 && (
            <ProgressBar progress={downloadProgress} isDarkMode={isDarkMode} />
          )}

          {isProcessing && !messages.length && <LoadingSpinner />}

          <ScrollView
            style={styles.messageContainer}
            ref={scrollViewRef}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <ChatInput
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            sendMessage={sendMessage}
            isProcessing={isProcessing}
            isDarkMode={isDarkMode}
            onVoiceInput={handleVoiceInput}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(229, 229, 234, 0.3)",
  },
  darkHeader: {
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  timeText: {
    fontSize: 16,
    fontFamily: "System",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBubblesContainer: {
    height: 50,
    marginBottom: 10,
  },
  actionBubblesContent: {
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  actionBubble: {
    backgroundColor: "rgba(179, 155, 216, 0.9)",
    borderRadius: 25,
    padding: 12,
    marginHorizontal: 5,
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  darkActionBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  actionBubbleInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionBubbleText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "left",
    fontWeight: "600",
  },
  messageContainer: {
    flex: 1,
    padding: 15,
    marginVertical: 5,
  },
  userMessage: {
    backgroundColor: "#b39bd8",
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "System",
  },
  footerContainer: {
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 25,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: "System",
  },
  sendButton: {
    backgroundColor: "#b39bd8",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  darkContainer: {
    backgroundColor: "#242634",
  },
  lightContainer: {
    backgroundColor: "#FFFFFF",
  },
  darkText: {
    color: "#FFFFFF",
  },
  lightText: {
    color: "#000000",
  },
  darkInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  lightInput: {
    backgroundColor: "#F7F7F8",
  },
  errorContainer: {
    padding: 10,
    margin: 10,
    backgroundColor: "#ff0000",
    borderRadius: 5,
  },
  errorText: {
    color: "#FFFFFF",
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#b39bd8",
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 2,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#b39bd8",
    borderRadius: 2,
  },
  brainIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#b39bd8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  brainIcon: {
    transform: [{ rotate: "45deg" }],
  },
});
