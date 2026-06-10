import { useEffect, useRef, useState, useCallback } from 'react';
import {
    extractFriendDataFromDevice,
    checkBluetoothPermissions,
    requestBluetoothPermissions,
    startBleScan,
    startBleAdvertising,
    isAdvertisementDataValid,
    isBle5Supported,
    isBleActuallyAvailable,
    BleFriendData,
    AdvertisingHandle,
} from '../utils/bleUtil';


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
    isBleActuallyAvailable: boolean;
    hasBluetoothPermission: boolean;
    discoveredFriends: DiscoveredFriend[];
    refreshFriends: () => void;
    requestPermissions: () => Promise<boolean>;
}

const SCAN_DURATION_MS = 10_000;
const AUTO_REFRESH_INTERVAL_MS = 15_000;
const DEVICE_STALE_THRESHOLD_MS = 16_000;



// Hook
export function useBleBroadcast(options: UseBleAdOptions): UseBleAdReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ble5Supported, setBle5Supported] = useState(() => isBle5Supported());
    const [bleActuallyAvailable, setBleActuallyAvailable] = useState(false);
    const [hasBluetoothPermission, setHasBluetoothPermission] = useState(false);
    const [discoveredFriends, setDiscoveredFriends] = useState<DiscoveredFriend[]>([]);

    // Refs for mutable state that shouldn't trigger re-renders
    const advertisingHandleRef = useRef<AdvertisingHandle | null>(null);
    const stopScanRef = useRef<(() => void) | null>(null);
    const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const discoveredDevicesRef = useRef<Map<string, DiscoveredFriend>>(new Map());

    // Track whether the hook is still mounted
    const mountedRef = useRef(true);


    // Permission check


    const checkPermissions = useCallback(async (): Promise<boolean> => {
        const result = await checkBluetoothPermissions();
        if (!mountedRef.current) return false;
        setHasBluetoothPermission(result.hasPermission);
        if (!result.hasPermission && result.missingPermissions.length > 0) {
            setError(`Missing: ${result.missingPermissions.join(', ')}`);
        }
        return result.hasPermission;
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const granted = await requestBluetoothPermissions();
            if (granted && mountedRef.current) {
                await checkPermissions();
            }
            return granted;
        } catch (err) {
            if (mountedRef.current) {
                setError(`Permission error: ${(err as Error).message}`);
            }
            return false;
        }
    }, [checkPermissions]);


    // Scan helpers


    // Remove stale devices and update state 
    const purgeStaleDevices = useCallback(() => {
        const now = Date.now();
        let changed = false;
        discoveredDevicesRef.current.forEach((device, deviceId) => {
            if (now - device.lastSeen > DEVICE_STALE_THRESHOLD_MS) {
                discoveredDevicesRef.current.delete(deviceId);
                changed = true;
            }
        });
        if (changed && mountedRef.current) {
            setDiscoveredFriends(Array.from(discoveredDevicesRef.current.values()));
        }
    }, []);

    // Run a single scan cycle 
    const startScan = useCallback(() => {
        if (!mountedRef.current) return;

        // Stop any existing scan first
        if (stopScanRef.current) {
            stopScanRef.current();
            stopScanRef.current = null;
        }

        setIsLoading(true);

        // Device-found handler
        stopScanRef.current = startBleScan((device) => {
            if (!mountedRef.current) return;

            const friendData = extractFriendDataFromDevice(device);
            if (!friendData || !isAdvertisementDataValid(friendData)) return;

            const key = friendData.deviceId;
            const existing = discoveredDevicesRef.current.get(key);

            // If we already have this device with userInfo, preserve it
            const updated: DiscoveredFriend = {
                ...friendData,
                userInfo: existing?.userInfo,
                lastSeen: Date.now(),
            };

            discoveredDevicesRef.current.set(key, updated);
            if (mountedRef.current) {
                setDiscoveredFriends(Array.from(discoveredDevicesRef.current.values()));
            }
        });

        // Auto-stop scan after SCAN_DURATION_MS
        scanTimerRef.current = setTimeout(() => {
            if (stopScanRef.current) {
                stopScanRef.current();
                stopScanRef.current = null;
            }
            purgeStaleDevices();
            if (mountedRef.current) setIsLoading(false);
        }, SCAN_DURATION_MS);
    }, [purgeStaleDevices]);


    // Refresh (manual + auto)
    const refreshFriends = useCallback(() => {
        // Clear auto-refresh timer
        if (autoRefreshTimerRef.current) {
            clearTimeout(autoRefreshTimerRef.current);
            autoRefreshTimerRef.current = null;
        }

        startScan();

        // Schedule next auto-refresh
        autoRefreshTimerRef.current = setTimeout(() => {
            if (mountedRef.current) refreshFriends();
        }, AUTO_REFRESH_INTERVAL_MS);
    }, [startScan]);


    // Advertising effect
    useEffect(() => {
        if (!options.enabled || !options.userId || !options.addCode) return;
        if (!isBle5Supported()) return;

        let cancelled = false;

        const doAdvertise = async () => {
            // Ensure permissions
            const permOk = await checkPermissions();
            if (!permOk) {
                if (mountedRef.current) {
                    setError('Bluetooth permissions not granted');
                }
                return;
            }

            const result = await startBleAdvertising(
                options.userId,
                options.addCode,
                options.expirationTimestamp,
            );
            if (cancelled || !mountedRef.current) return;

            if (result.success && result.handle) {
                advertisingHandleRef.current = result.handle;
                if (mountedRef.current) setError(null);
            } else {
                if (mountedRef.current) setError(result.message);
            }
        };

        doAdvertise();

        return () => {
            cancelled = true;
            if (advertisingHandleRef.current) {
                advertisingHandleRef.current.stop();
                advertisingHandleRef.current = null;
            }
        };
    }, [options.enabled, options.userId, options.addCode, options.expirationTimestamp, checkPermissions]);


    // Main init / teardown effect
    useEffect(() => {
        if (!options.enabled) {
            // Clean up all resources when disabled
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
            if (stopScanRef.current) {
                stopScanRef.current();
                stopScanRef.current = null;
            }
            if (advertisingHandleRef.current) {
                advertisingHandleRef.current.stop();
                advertisingHandleRef.current = null;
            }
            setDiscoveredFriends([]);
            discoveredDevicesRef.current.clear();
            return;
        }

        const initBle = async () => {
            const supported = isBle5Supported();
            if (!supported) {
                if (mountedRef.current) {
                    setBle5Supported(false);
                    setError('Your device does not support Bluetooth 5.0');
                }
                return;
            }

            // Step 1: Request runtime permissions FIRST.
            let hasPermission = await checkPermissions();
            if (!hasPermission) {
                const granted = await requestBluetoothPermissions();
                if (!granted) {
                    if (mountedRef.current) {
                        setError('Bluetooth permissions not granted');
                    }
                    return;
                }
                hasPermission = await checkPermissions();
                if (!hasPermission) {
                    if (mountedRef.current) {
                        setError('Bluetooth permissions not granted');
                    }
                    return;
                }
            }

            // Step 2: Now that permissions are granted, check the actual
            // Bluetooth hardware / radio state.
            const bleStatus = await isBleActuallyAvailable();
            if (!bleStatus.available) {
                if (mountedRef.current) {
                    setBleActuallyAvailable(false);
                    // Provide a user-friendly message that distinguishes
                    // "Bluetooth is off" from "no Bluetooth hardware".
                    setError(bleStatus.reason || 'Bluetooth is not available on this device');
                }
                return;
            }
            if (mountedRef.current) {
                setBleActuallyAvailable(true);
            }

            // Step 3: Start periodic scanning
            if (mountedRef.current) {
                refreshFriends();
            }
        };

        initBle();

        return () => {
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
        };
    }, [options.enabled, checkPermissions, refreshFriends]);


    // Final cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
            if (stopScanRef.current) {
                stopScanRef.current();
                stopScanRef.current = null;
            }
            if (advertisingHandleRef.current) {
                advertisingHandleRef.current.stop();
                advertisingHandleRef.current = null;
            }
            discoveredDevicesRef.current.clear();
        };
    }, []);

    return {
        isLoading,
        error,
        isBle5Supported: ble5Supported,
        isBleActuallyAvailable: bleActuallyAvailable,
        hasBluetoothPermission,
        discoveredFriends,
        refreshFriends,
        requestPermissions,
    };
}
