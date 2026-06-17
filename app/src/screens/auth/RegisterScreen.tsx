import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { ServerConfigModal } from '../../components/ServerConfigModal';
import { getClient } from '../../api/client';
const RegisterScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { register } = useAuth();
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showServerModal, setShowServerModal] = useState(false);
    const handleRegister = async () => {
        if (!username.trim()) {
            Alert.alert('Notice', 'Please enter a username');
            return;
        }
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username.trim())) {
            Alert.alert('Notice', 'Username must be 3-20 characters and can only include letters, numbers, and underscores');
            return;
        }
        if (!password) {
            Alert.alert('Notice', 'Please enter a password');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!passwordRegex.test(password)) {
            Alert.alert('Notice', 'Password must be at least 6 characters and include uppercase, lowercase, and a number');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Notice', 'The passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await register(username.trim(), password, displayName.trim() || undefined);
        }
        catch (e: any) {
            const msg = e?.response?.data?.error?.message || e?.message || 'Please try again later';
            Alert.alert('Sign Up Failed', msg);
            // console.log(e, JSON.stringify(e ?? null));
        }
        finally {
            setLoading(false);
        }
    };

    const handleServerConfigConfirm = () => {
        setShowServerModal(false);
        Alert.alert(
            'Configuration Changed',
            'Server configuration has been saved. Please restart the app to apply changes.',
            [{ text: 'OK' }]
        );
    };
    return (<View style={styles.container}>

        <View style={styles.topBackground}>
            <View style={styles.decorationCircle1} />
            <View style={styles.decorationCircle2} />
        </View>

        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="person-add" size={40} color="#fff" style={{ marginLeft: 4 }} />
                    </View>
                    <Text style={styles.title}>Create a new account</Text>
                    <Text style={styles.subtitle}>Join Chatty and stay connected in every conversation</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="happy-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Display name (optional)" placeholderTextColor="#9CA3AF" value={displayName} onChangeText={setDisplayName} />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9CA3AF" secureTextEntry value={password} onChangeText={setPassword} />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#9CA3AF" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
                    </View>

                    <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
                        {loading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.buttonText}>Sign Up</Text>)}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()} activeOpacity={0.6}>
                    <Text style={styles.linkText}>Already have an account?</Text>
                    <Text style={styles.linkTextBold}>Sign in</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.serverLinkRow}
                    onPress={() => setShowServerModal(true)}
                    activeOpacity={0.6}
                >
                    <Text style={styles.serverCurrentText}>
                        {getClient()?.config?.endpoint
                            ? `${getClient()!.config!.useHttps ? 'https' : 'http'}://${getClient()!.config!.endpoint}`
                            : 'Default server'}
                    </Text>
                    <Text style={styles.serverLinkText}>Change Server</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>

        <ServerConfigModal
            visible={showServerModal}
            currentEndpoint={getClient()?.config?.endpoint ?? ''}
            currentUseHttps={getClient()?.config?.useHttps ?? false}
            onClose={() => setShowServerModal(false)}
            onConfirm={handleServerConfigConfirm}
        />
    </View>);
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    topBackground: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: 280,
        backgroundColor: '#1277d6',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        overflow: 'hidden',
    },
    decorationCircle1: {
        position: 'absolute',
        top: -40,
        right: -20,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    decorationCircle2: {
        position: 'absolute',
        top: 60,
        left: -30,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    keyboardView: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        transform: [{ rotate: '5deg' }],
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 8,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        paddingBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        height: 56,
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        color: '#1F2937',
    },
    button: {
        height: 56,
        backgroundColor: '#1277d6',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#1277d6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
        elevation: 0,
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    linkRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 28,
    },
    linkText: {
        color: '#6B7280',
        fontSize: 15,
    },
    linkTextBold: {
        color: '#1277d6',
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 4,
    },
    serverLinkRow: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    serverCurrentText: {
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 4,
    },
    serverLinkText: {
        color: '#1277d6',
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
export default RegisterScreen;
