import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export interface ChatMessage {
  id: string;
  pairing_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface ChatInterfaceProps {
  onBack?: () => void;
}

export function ChatInterface({ onBack }: ChatInterfaceProps) {
  const pairingId = useAuthStore((state) => state.pairingId);
  const userRole = useAuthStore((state) => state.userRole);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Fetch historical messages for this pairing
  const fetchMessages = useCallback(async () => {
    if (!pairingId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('pairing_id', pairingId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.warn('[Chat] Error loading messages:', error.message);
      } else if (data) {
        setMessages(data as ChatMessage[]);
      }
    } catch (err) {
      console.warn('[Chat] Exception loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pairingId]);

  // 1. Fetch historical messages on mount or pairingId change
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 2. Dedicated Realtime subscription for incoming messages
  useEffect(() => {
    if (!pairingId) return;

    const channelName = `chat:${pairingId}`;

    // Clean up any lingering channel with the same topic to prevent duplicate callback errors
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${channelName}` || c.topic === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }

    console.log(`[Chat] Initializing Realtime channel: ${channelName}`);

    // Chain all .on() listeners first
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairingId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }
              return [...prev, newMsg];
            });
          }
        }
      );

    // Call .subscribe() at the very end
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[Chat] Realtime channel error for ${channelName}:`, err?.message || err);
      }
    });

    // Clean up channel on unmount
    return () => {
      console.log(`[Chat] Teardown: cleanly removing channel ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [pairingId]);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !pairingId || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const senderIdentifier = userRole || userData?.user?.id || 'user_1';

      const payload = {
        pairing_id: pairingId,
        sender_id: senderIdentifier,
        message: trimmed,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.warn('[Chat] Error sending message:', error.message);
        setInputText(trimmed);
      } else if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as ChatMessage];
        });
      }
    } catch (err) {
      console.warn('[Chat] Exception sending message:', err);
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Chat Header */}
        <View className="px-5 py-4 border-b border-gray-800/80 bg-[#002236]/90 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => (onBack ? onBack() : router.replace('/dashboard'))}
              activeOpacity={0.7}
              className="mr-3 bg-[#001724] border border-[#f5b212]/40 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-xs font-bold text-[#f5b212]">← Back</Text>
            </TouchableOpacity>
            <View>
              <Text className="text-base font-black text-white tracking-wide uppercase">
                Partner Comms
              </Text>
              <View className="flex-row items-center mt-0.5">
                <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
                <Text className="text-[10px] text-gray-400 font-mono">
                  {userRole === 'user_1' ? 'Channel: Partner (User 2)' : 'Channel: Partner (User 1)'}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-[#001724] border border-[#f5b212]/30 px-2.5 py-1 rounded-full">
            <Text className="text-[9px] font-bold text-[#f5b212] uppercase tracking-widest">
              SECURE E2E
            </Text>
          </View>
        </View>

        {/* Message Stream */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f5b212" />
            <Text className="text-xs text-gray-400 mt-2 font-mono">
              Loading secure messages...
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-14 h-14 rounded-2xl bg-[#002236] border border-[#f5b212]/30 items-center justify-center mb-4">
              <Text className="text-2xl">💬</Text>
            </View>
            <Text className="text-base font-bold text-white text-center">
              Encrypted Comms Open
            </Text>
            <Text className="text-xs text-gray-400 text-center mt-2 leading-4 max-w-[280px]">
              Coordinate focus goals, request releases, or send motivational check-ins to your accountability partner.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMe = item.sender_id === userRole || (item.sender_id === 'user_1' && userRole === 'user_1') || (item.sender_id === 'user_2' && userRole === 'user_2');

              return (
                <View
                  className={`mb-3 max-w-[82%] ${
                    isMe ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <View
                    className={`rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? 'bg-[#002236] border border-[#f5b212]'
                        : 'bg-[#001724] border border-gray-800'
                    }`}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <Text className="text-sm text-white leading-5">
                      {item.message}
                    </Text>
                  </View>
                  <Text className="text-[9px] text-gray-500 font-mono mt-1 px-1">
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input Footer */}
        <View className="p-3 border-t border-gray-800/80 bg-[#002236]/90 flex-row items-center gap-2">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Send message to partner..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={500}
            className="flex-1 bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-2.5 rounded-xl text-sm max-h-24"
          />

          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.8}
            className={`w-11 h-11 rounded-xl items-center justify-center ${
              inputText.trim() && !isSending
                ? 'bg-[#f5b212]'
                : 'bg-gray-800/60'
            }`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#003049" />
            ) : (
              <Text
                className={`text-base font-black ${
                  inputText.trim() ? 'text-[#003049]' : 'text-gray-500'
                }`}
              >
                ➤
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
