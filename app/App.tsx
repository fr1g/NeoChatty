import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import Navigation from './src/navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />
            <AuthProvider>
                <Navigation />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
