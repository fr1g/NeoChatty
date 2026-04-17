import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert, ActivityIndicator, } from 'react-native';
import { users } from '../../api';
const PRIMARY = '#1277d6';
interface PrivacyState {
    searchable_by_username: boolean;
    searchable_by_display_name: boolean;
    show_avatar_to_strangers: boolean;
}
export default function PrivacySettingsScreen() {
    const [settings, setSettings] = useState<PrivacyState | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try {
                const res = await users.getMyPrivacy();
                const data = res.data.data;
                if (data)
                    setSettings(data);
            }
            catch {
                Alert.alert('Error', 'Failed to load privacy settings');
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    const toggle = async (key: keyof PrivacyState) => {
        if (!settings)
            return;
        const newVal = !settings[key];
        const prev = { ...settings };
        setSettings({ ...settings, [key]: newVal });
        try {
            await users.updatePrivacy({ [key]: newVal });
        }
        catch {
            setSettings(prev);
            Alert.alert('Error', 'Update failed');
        }
    };
    if (loading) {
        return (<View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
        </View>);
    }
    if (!settings) {
        return (<View style={styles.center}>
            <Text style={styles.errorText}>Failed to load</Text>
        </View>);
    }
    const items: {
        key: keyof PrivacyState;
        label: string;
    }[] = [
            { key: 'searchable_by_username', label: 'Allow search by username' },
            { key: 'searchable_by_display_name', label: 'Allow search by display name' },
            { key: 'show_avatar_to_strangers', label: 'Show avatar to non-contacts' },
        ];
    return (<View style={styles.container}>
        <View style={styles.section}>
            {items.map((item, idx) => (<View key={item.key} style={[styles.row, idx === items.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>{item.label}</Text>
                <Switch value={settings[item.key]} onValueChange={() => toggle(item.key)} trackColor={{ false: '#E0E0E0', true: PRIMARY }} thumbColor="#fff" />
            </View>))}
        </View>
    </View>);
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    section: { backgroundColor: '#fff', marginTop: 10 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5E5',
    },
    label: { fontSize: 16, color: '#333' },
    errorText: { fontSize: 15, color: '#999' },
});
