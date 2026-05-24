import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Switch,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { saveServerConfig } from '../api/serverConfig';

interface ServerConfigModalProps {
    visible: boolean;
    currentEndpoint?: string;
    currentUseHttps?: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
    visible,
    currentEndpoint = '',
    currentUseHttps = false,
    onClose,
    onConfirm,
}) => {
    const [endpoint, setEndpoint] = useState(currentEndpoint);
    const [useHttps, setUseHttps] = useState(currentUseHttps);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const validateEndpoint = (addr: string): boolean => {
        // IPv4 或域名，无协议前缀，无端口号，无路径、参数列表和hash
        if (!addr.trim()) {
            setError('Endpoint cannot be empty');
            return false;
        }

        // 检查是否包含无效字符
        if (addr.includes('://') || addr.includes(':') || addr.includes('/') || addr.includes('?') || addr.includes('#')) {
            setError(
                'Invalid format. Use only domain or IP address without protocol, port, path, query, or hash.'
            );
            return false;
        }

        // 简单的IP或域名验证
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!ipv4Regex.test(addr) && !domainRegex.test(addr)) {
            setError(
                'Invalid IP address or domain name'
            );
            return false;
        }

        setError('');
        return true;
    };

    const handleConfirm = async () => {
        if (!validateEndpoint(endpoint)) {
            return;
        }

        setLoading(true);
        try {
            await saveServerConfig(endpoint.trim(), useHttps);
            onConfirm();
        } catch (err) {
            setError('Failed to save configuration. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setEndpoint(currentEndpoint);
        setUseHttps(currentUseHttps ?? false);
        setError('');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.container}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.title}>Change Server</Text>
                        <Text style={styles.description}>
                            Enter the server address (IPv4 or domain only, no protocol or port)
                        </Text>

                        <View style={styles.inputSection}>
                            <Text style={styles.label}>Server Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., rus.kami.su or 192.168.1.1"
                                placeholderTextColor="#999"
                                value={endpoint}
                                onChangeText={setEndpoint}
                                editable={!loading}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.httpsSection}>
                            <Text style={styles.label}>Enable HTTPS</Text>
                            <Switch
                                value={useHttps}
                                onValueChange={setUseHttps}
                                disabled={loading}
                                trackColor={{
                                    false: '#E5E5E5',
                                    true: '#1277d6',
                                }}
                                thumbColor={useHttps ? '#1277d6' : '#f4f3f4'}
                            />
                        </View>

                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={handleClose}
                                disabled={loading}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.confirmButton,
                                    loading && styles.buttonDisabled,
                                ]}
                                onPress={handleConfirm}
                                disabled={loading}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {loading ? 'Saving...' : 'Confirm'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    description: {
        fontSize: 13,
        color: '#666',
        marginBottom: 20,
        lineHeight: 18,
    },
    inputSection: {
        marginBottom: 16,
    },
    httpsSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E5E5',
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#333',
        backgroundColor: '#fafafa',
    },
    errorText: {
        fontSize: 12,
        color: '#e74c3c',
        marginBottom: 16,
        lineHeight: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#E8E8E8',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: '#1277d6',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
