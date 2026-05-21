import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import Navigation from './src/navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeClient } from './src/api';

export default function App() {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                await initializeClient();
                setInitialized(true);
            } catch (error) {
                console.error('Failed to initialize client:', error);
                setInitialized(true); // Continue anyway
            }
        };
        init();
    }, []);

    if (!initialized) {
        return null; // or a loading screen
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />
            <AuthProvider>
                <Navigation />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
