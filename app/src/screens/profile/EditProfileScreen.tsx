import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { users, files } from '../../api';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { getApiErrorMessage, normalizeUploadAsset, } from '../../utils/upload';
const PRIMARY = '#1277d6';
export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user, updateUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name ?? '');
    const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
    const [bgPreviewUri, setBgPreviewUri] = useState<string | null>(null);
    const [newAvatarLocator, setNewAvatarLocator] = useState<string | null>(null);
    const [newBgLocator, setNewBgLocator] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const pickImage = async (type: 'avatar' | 'background') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: type === 'avatar' ? [1, 1] : [16, 9],
        });
        if (result.canceled)
            return;
        const asset = result.assets[0];
        let cleanupUri: string | undefined;
        try {
            const prepared = await normalizeUploadAsset({
                uri: asset.uri,
                fileName: asset.fileName || 'image.jpg',
                mimeType: asset.mimeType,
                fallbackMimeType: 'image/jpeg',
                fallbackBaseName: 'image',
            });
            cleanupUri = prepared.cleanupUri;
            const res = await files.uploadFile({
                uri: prepared.uri,
                name: prepared.fileName,
                type: prepared.mimeType,
            });
            const locator = res.data.data?.locator;
            if (!locator)
                throw new Error('Upload failed');
            if (type === 'avatar') {
                setAvatarPreviewUri(asset.uri);
                setNewAvatarLocator(locator);
            }
            else {
                setBgPreviewUri(asset.uri);
                setNewBgLocator(locator);
            }
        }
        catch (e: any) {
            Alert.alert('Error', getApiErrorMessage(e, 'Failed to upload image'));
        }
        finally {
            if (cleanupUri) {
                LegacyFileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => { });
            }
        }
    };
    const save = async () => {
        if (!displayName.trim()) {
            Alert.alert('Notice', 'Display name cannot be empty');
            return;
        }
        setSaving(true);
        try {
            const data: any = {};
            if (displayName !== user?.display_name)
                data.display_name = displayName.trim();
            if (newAvatarLocator)
                data.avatar_locator = newAvatarLocator;
            if (newBgLocator)
                data.background_locator = newBgLocator;
            const res = await users.updateProfile(data);
            const updated = res.data.data;
            if (updated)
                updateUser(updated);
            Alert.alert('Success', 'Profile updated');
            navigation.goBack();
        }
        catch {
            Alert.alert('Error', 'Failed to save');
        }
        finally {
            setSaving(false);
        }
    };
    return (<KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F3F4F6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Edit Profile</Text>

            <View style={styles.card}>
                <Text style={styles.label}>Display Name</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Enter your display name..." placeholderTextColor="#9CA3AF" />
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Avatar</Text>
                <View style={styles.imageRow}>
                    {avatarPreviewUri ? (<Image source={{ uri: avatarPreviewUri }} style={styles.avatarPreview} />) : user?.avatar_locator ? (<Image source={files.getFileSource(user.avatar_locator)} style={styles.avatarPreview} />) : (<View style={[styles.avatarPreview, styles.placeholder]}>
                        <Ionicons name="person" size={32} color="#ffffff" />
                    </View>)}
                    <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage('avatar')} activeOpacity={0.6}>
                        <Text style={styles.changeBtnText}>Change Avatar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Profile Cover</Text>
                <View style={styles.imageRow}>
                    <View style={styles.bgPreviewContainer}>
                        {bgPreviewUri ? (<Image source={{ uri: bgPreviewUri }} style={styles.bgPreview} />) : user?.background_locator ? (<Image source={files.getFileSource(user.background_locator)} style={styles.bgPreview} />) : (<View style={[styles.bgPreview, styles.placeholder]}>
                            <Ionicons name="image-outline" size={28} color="#ffffff" />
                        </View>)}
                    </View>
                    <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage('background')} activeOpacity={0.6}>
                        <Text style={styles.changeBtnText}>Change Cover</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving} activeOpacity={0.8}>
                {saving ? (<ActivityIndicator color="#fff" />) : (<>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Save All Changes</Text>
                </>)}
            </TouchableOpacity>
        </ScrollView>
    </KeyboardAvoidingView>);
}
const styles = StyleSheet.create({
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 20,
        marginTop: 10,
        paddingHorizontal: 8,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    label: {
        fontSize: 15,
        color: '#4B5563',
        fontWeight: '600',
        marginBottom: 12
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        height: 52,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#111827',
    },
    imageRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarPreview: {
        width: 76,
        height: 76,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    bgPreviewContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    bgPreview: {
        width: 140,
        height: 78,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    placeholder: {
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0,
    },
    changeBtn: {
        backgroundColor: 'rgba(7, 193, 96, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginLeft: 20,
        borderWidth: 0,
    },
    changeBtnText: {
        color: PRIMARY,
        fontSize: 14,
        fontWeight: '600'
    },
    saveBtn: {
        flexDirection: 'row',
        backgroundColor: PRIMARY,
        marginTop: 16,
        borderRadius: 16,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnDisabled: {
        backgroundColor: '#9CA3AF',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
});
