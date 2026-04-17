import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, } from 'react-native';
import { useAuth } from '../../context/AuthContext';
const PRIMARY = '#1277d6';
export default function SettingsScreen() {
    const { logout } = useAuth();
    const confirmLogout = () => {
        Alert.alert('Confirm', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => logout(),
            },
        ]);
    };
    return (<View style={styles.container}>
        <View style={styles.section}>
            <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.footer}>
            <Text style={styles.version}>Version 1.0.0</Text>
        </View>
    </View>);
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    section: { marginTop: 20, backgroundColor: '#fff' },
    logoutBtn: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    logoutText: { fontSize: 16, color: '#FF3B30', fontWeight: '500' },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 30,
    },
    version: { fontSize: 13, color: '#C0C0C0' },
});
