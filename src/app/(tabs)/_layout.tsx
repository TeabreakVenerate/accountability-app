import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#f5b212',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#002236',
          borderTopColor: 'rgba(245, 178, 18, 0.25)',
          borderTopWidth: 1,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: insets.bottom > 0 ? 56 + insets.bottom : 62,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Command',
          tabBarLabel: 'Command',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.65 }}>🛡️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          title: 'Targets',
          tabBarLabel: 'Targets',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.65 }}>🎯</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Comms',
          tabBarLabel: 'Comms',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.65 }}>💬</Text>
          ),
        }}
      />
    </Tabs>
  );
}
