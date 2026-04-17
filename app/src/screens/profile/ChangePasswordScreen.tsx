import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, } from 'react-native';
import { auth } from '../../api';
import { useAuth } from '../../context/AuthContext';
const PRIMARY = '#1277d6';
export default function ChangePasswordScreen() {
    const { logout } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const handleChange = async () => {
        if (!oldPassword) {
            Alert.alert('Notice', 'Please enter your current password');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('Notice', 'New password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Notice', 'The new passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await auth.changePassword(oldPassword, newPassword);
            Alert.alert('Success', 'Password changed. Please sign in again', [
                { text: 'Confirm', onPress: () => logout() },
            ]);
        }
        catch {
            Alert.alert('Error', 'Failed to change password. Please check your current password.');
        }
        finally {
            setLoading(false);
        }
    };
    return (<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
                <View style={styles.field}>
                    <Text style={styles.label}>Current Password</Text>
                    <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="Enter your current password" placeholderTextColor="#999" />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor="#999" />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Enter the new password again" placeholderTextColor="#999" />
                </View>
            </View>

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleChange} disabled={loading}>
                {loading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.btnText}>Change Password</Text>)}
            </TouchableOpacity>
        </ScrollView>
    </KeyboardAvoidingView>);
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    form: { backgroundColor: '#fff', marginTop: 10 },
    field: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    label: { fontSize: 14, color: '#999', marginBottom: 6 },
    input: {
        fontSize: 16,
        color: '#333',
        padding: 0,
    },
    btn: {
        backgroundColor: PRIMARY,
        marginHorizontal: 16,
        marginTop: 24,
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
