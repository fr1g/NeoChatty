import { useEffect, useRef, useState, useCallback } from 'react';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
    extractFriendDataFromDevice,
    checkBluetoothPermissions,
    requestBluetoothPermissions,
    startBleScan,
    stopBleScan,
    startBleAdvertising,
    stopBleAdvertising,
    isAdvertisementDataValid,
    isBle5Supported,
    BLE5_UNSUPPORTED_MESSAGE,
    BleFriendData,
} from '../utils/bleUtil';

/* 
 this is abstracted. need to be replaced by munim
*/


export interface UseBleAdOptions {
    enabled: boolean;
    userId: number;
    addCode: number;
    expirationTimestamp: number;
}

export interface DiscoveredFriend extends BleFriendData {
    userInfo?: {
        id: number;
        username: string;
        display_name: string;
        avatar_locator?: string;
    };
    lastSeen: number;
}

export interface UseBleAdReturn {
    isLoading: boolean;
    error: string | null;
    isBle5Supported: boolean;
    hasBluetoothPermission: boolean;
    discoveredFriends: DiscoveredFriend[];
    refreshFriends: () => void;
    requestPermissions: () => Promise<boolean>;
}

/**
 * Hook for BLE Advertisement and scanning
 */
export function useBleBroadcast(options: UseBleAdOptions): UseBleAdReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ble5Supported, setBle5Supported] = useState(() => isBle5Supported());
    const [hasBluetoothPermission, setHasBluetoothPermission] = useState(false);
    const [discoveredFriends, setDiscoveredFriends] = useState<DiscoveredFriend[]>([]);

    const bleManagerRef = useRef<BleManager | null>(null);
    const stateSubscriptionRef = useRef<Subscription | null>(null);
    const scanSubscriptionRef = useRef<Subscription | null>(null);
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const discoveredDevicesRef = useRef<Map<string, DiscoveredFriend>>(new Map());

    // init BleManager
    useEffect(() => {
        if (!bleManagerRef.current) {
            bleManagerRef.current = new BleManager();
        }
    }, []);

    // check permission
    const checkPermissions = useCallback(async () => {
        const permCheck = await checkBluetoothPermissions();
        setHasBluetoothPermission(permCheck.hasPermission);

        if (!permCheck.hasPermission) {
            setError(
                permCheck.missingPermissions.length > 0
                    ? `Missing permissions: ${permCheck.missingPermissions.join(', ')}`
                    : 'Bluetooth permissions required'
            );
        }

        return permCheck.hasPermission;
    }, []);

    // get permission
    const requestPermissions = useCallback(async () => {
        try {
            const granted = await requestBluetoothPermissions();
            if (granted) {
                await checkPermissions();
            }
            return granted;
        } catch (err) {
            setError(`Failed to request permissions: ${(err as Error).message}`);
            return false;
        }
    }, [checkPermissions]);

    // start scan
    const startScan = useCallback(async () => {
        if (!bleManagerRef.current || !options.enabled || !isBle5Supported()) {
            return;
        }

        try {
            setIsLoading(true);

            await stopBleScan(bleManagerRef.current);

            // 清除超时的设备（15秒内没有收到更新的设备）
            const now = Date.now();
            discoveredDevicesRef.current.forEach((device, deviceId) => {
                if (now - device.lastSeen > 15000) {
                    discoveredDevicesRef.current.delete(deviceId);
                }
            });

            const subscription = await startBleScan(
                bleManagerRef.current,
                (device: Device) => {
                    const friendData = extractFriendDataFromDevice(device);

                    if (
                        friendData &&
                        isAdvertisementDataValid(friendData)
                    ) {
                        const existing = discoveredDevicesRef.current.get(friendData.deviceId);
                        const updated: DiscoveredFriend = {
                            ...friendData,
                            userInfo: existing?.userInfo,
                            lastSeen: Date.now(),
                        };

                        discoveredDevicesRef.current.set(friendData.deviceId, updated);
                        setDiscoveredFriends(Array.from(discoveredDevicesRef.current.values()));
                    }
                },
                (err) => {
                    console.error('BLE scan error:', err);
                    setError(`Scan error: ${err.message}`);
                }
            );

            if (subscription) {
                scanSubscriptionRef.current = subscription;
            }

            // stop after 10s to save time for other ops
            scanTimeoutRef.current = setTimeout(async () => {
                await stopBleScan(bleManagerRef.current!);
            }, 10000);
        } catch (err) {
            const errorMsg = (err as Error).message;
            setError(`Failed to start scan: ${errorMsg}`);
            console.error('Start scan error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [options.enabled]);

    const refreshFriends = useCallback(async () => {
        if (autoRefreshTimeoutRef.current) {
            clearTimeout(autoRefreshTimeoutRef.current);
        }

        await startScan();

        autoRefreshTimeoutRef.current = setTimeout(() => {
            refreshFriends();
        }, 15000);
    }, [startScan]);

    useEffect(() => {
        if (!options.enabled || !bleManagerRef.current || !options.userId || !options.addCode) {
            return;
        }

        if (!isBle5Supported()) {
            setBle5Supported(false);
            setError(BLE5_UNSUPPORTED_MESSAGE);
            return;
        }

        const startAdvertising = async () => {
            try {
                const result = await startBleAdvertising(
                    bleManagerRef.current!,
                    options.userId,
                    options.addCode,
                    options.expirationTimestamp
                );

                if (!result.success) {
                    setError(result.message);
                }
            } catch (err) {
                setError(`Failed to initialize BLE advertising: ${(err as Error).message}`);
            }
        };

        startAdvertising();
    }, [options.enabled, options.userId, options.addCode, options.expirationTimestamp]);

    useEffect(() => {
        if (!options.enabled) {
            // clean up
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            if (autoRefreshTimeoutRef.current) {
                clearTimeout(autoRefreshTimeoutRef.current);
            }
            if (stateSubscriptionRef.current) {
                stateSubscriptionRef.current.remove();
            }
            if (scanSubscriptionRef.current) {
                scanSubscriptionRef.current.remove();
            }
            if (bleManagerRef.current) {
                stopBleScan(bleManagerRef.current);
                stopBleAdvertising();
            }
            setDiscoveredFriends([]);
            discoveredDevicesRef.current.clear();
            return;
        }

        const initBle = async () => {
            const supported = isBle5Supported();
            setBle5Supported(supported);
            if (!supported) {
                setError(BLE5_UNSUPPORTED_MESSAGE);
                return;
            }

            const hasPermission = await checkPermissions();
            if (!hasPermission) {
                setError('Bluetooth permissions not granted');
                return;
            }

            refreshFriends();
        };

        initBle();

        return () => {
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            if (autoRefreshTimeoutRef.current) {
                clearTimeout(autoRefreshTimeoutRef.current);
            }
        };
    }, [options.enabled, checkPermissions, refreshFriends]);

    useEffect(() => {
        return () => {
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            if (autoRefreshTimeoutRef.current) {
                clearTimeout(autoRefreshTimeoutRef.current);
            }
            if (stateSubscriptionRef.current) {
                stateSubscriptionRef.current.remove();
            }
            if (scanSubscriptionRef.current) {
                scanSubscriptionRef.current.remove();
            }
            if (bleManagerRef.current) {
                stopBleScan(bleManagerRef.current);
                stopBleAdvertising();
            }
        };
    }, []);

    return {
        isLoading,
        error,
        isBle5Supported: ble5Supported,
        hasBluetoothPermission,
        discoveredFriends,
        refreshFriends,
        requestPermissions,
    };
}
