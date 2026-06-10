import { Platform } from 'react-native';
import {
    startAdvertising,
    stopAdvertising,
    startScan,
    stopScan,
    addDeviceFoundListener,
    requestBluetoothPermission,
    isBluetoothEnabled,
} from 'munim-bluetooth';
import type { BLEDevice } from 'munim-bluetooth';

/**
 * Unified BLE payload prefix.
 * Format: cab#<addCode>#<userId>
 * - iOS: placed in localName (plaintext)
 * - Android: placed in manufacturerData (hex-encoded)
 */
const AD_PREFIX = 'cab';

/** iOS-only: service UUID required by CoreBluetooth. */
const AD_SERVICE_UUID = '0000CAB0-0000-1000-8000-00805F9B34FB';

// Hex helpers — munim-bluetooth Android uses hexStringToByteArray() for
// manufacturerData, so we must encode payloads as hex.
function bytesToHex(bytes: Uint8Array): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        result += bytes[i].toString(16).padStart(2, '0');
    }
    return result;
}

function hexToBytes(hex: string): Uint8Array | null {
    try {
        const clean = hex.replace(/[^0-9a-fA-F]/g, '');
        if (clean.length % 2 !== 0) return null;
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < clean.length; i += 2) {
            bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
        }
        return bytes;
    } catch {
        return null;
    }
}



export interface BleFriendData {
    userId: number;
    addCode: number;
    deviceId: string;
    deviceName?: string;
}

export interface AdvertisingHandle {
    stop: () => Promise<void>;
}

export function isBle5Supported(): boolean {
    // Bluetooth 5.0 requires Android 8+ (API 26) or iOS 13+
    const version = typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (Platform.OS === 'ios') {
        return version >= 13;
    }
    return version >= 26;
}

/**
 * Check if BLE is actually available on this device.
 * On Android emulators, the Bluetooth stack is typically absent or incomplete.
 */
export async function isBleActuallyAvailable(): Promise<{
    available: boolean;
    reason: string;
}> {
    try {
        const enabled = await isBluetoothEnabled();
        if (!enabled) {
            return {
                available: false,
                reason: 'Bluetooth is not enabled on this device',
            };
        }
        return {
            available: true,
            reason: '',
        };
    } catch (error) {
        return {
            available: false,
            reason: `Bluetooth not available: ${(error as Error).message}`,
        };
    }
}


/**
 * Build unified payload: cab#<addCode>#<userId>
 */
function buildPayload(addCode: number, userId: number): string {
    return `${AD_PREFIX}#${addCode}#${userId}`;
}

/**
 * Encode payload as hex for Android manufacturerData.
 * munim-bluetooth's Android layer calls hexStringToByteArray().
 */
function encodePayload(addCode: number, userId: number): string {
    const plain = buildPayload(addCode, userId);
    const bytes = new TextEncoder().encode(plain);
    return bytesToHex(bytes);
}

/**
 * Decode a payload string (hex-encoded or plaintext).
 * Returns BleFriendData or null if invalid.
 */
function decodePayload(encoded: string): BleFriendData | null {
    try {
        let plain: string;
        if (encoded.startsWith(`${AD_PREFIX}#`)) {
            // Already plaintext (iOS localName)
            plain = encoded;
        } else {
            // Hex-encoded (Android manufacturerData)
            const hexBytes = hexToBytes(encoded);
            if (!hexBytes) return null;
            plain = new TextDecoder().decode(hexBytes);
        }

        if (!plain.startsWith(`${AD_PREFIX}#`)) return null;

        const parts = plain.split('#');
        if (parts.length !== 3) return null;

        const addCode = parseInt(parts[1], 10);
        const userId = parseInt(parts[2], 10);

        if (!Number.isFinite(userId) || userId <= 0 ||
            !Number.isFinite(addCode) || addCode <= 0) {
            return null;
        }

        return {
            userId,
            addCode,
            deviceId: '',
        };
    } catch {
        return null;
    }
}

/**
 * Extract BleFriendData from a scanned BLEDevice.
 * - iOS: checks localName for cab#<addCode>#<userId> (plaintext)
 * - Android: checks manufacturerData for hex-encoded payload
 */
export function extractFriendDataFromDevice(device: BLEDevice): BleFriendData | null {
    // Try localName first (iOS source)
    const localName = device.localName || device.name || '';
    const fromLocalName = decodePayload(localName);
    if (fromLocalName) {
        fromLocalName.deviceId = device.id;
        fromLocalName.deviceName = localName || 'Unknown';
        return fromLocalName;
    }

    // Try manufacturerData (Android source)
    const mfrData = device.manufacturerData;
    if (mfrData) {
        const fromMfr = decodePayload(mfrData);
        if (fromMfr) {
            fromMfr.deviceId = device.id;
            fromMfr.deviceName = device.name || device.localName || 'Unknown';
            return fromMfr;
        }
    }

    return null;
}




/**
 * Start BLE advertising.
 *
 * iOS:   startAdvertising with localName = cab#<addCode>#<userId> (plaintext)
 *        Must include serviceUUIDs (CoreBluetooth requirement).
 *
 * Android: startAdvertising with serviceUUIDs + manufacturerData (hex).
 *          Uses 16-bit UUID format (0000CAB0-...) which BLE auto-compresses
 *          to 4 bytes in legacy 31-byte packets.  Does NOT set localName
 *          (avoids permanent system Bluetooth name change).
 */
export async function startBleAdvertising(
    userId: number,
    addCode: number,
    _expirationTimestamp: number,
): Promise<{ success: boolean; message: string; handle?: AdvertisingHandle }> {
    if (!isBle5Supported()) {
        return {
            success: false,
            message: 'Your device does not support Bluetooth 5.0',
        };
    }

    try {
        if (Platform.OS === 'ios') {
            const localName = buildPayload(addCode, userId);
            startAdvertising({
                serviceUUIDs: [AD_SERVICE_UUID],
                localName,
            });
            return {
                success: true,
                message: 'BLE advertising started (iOS)',
                handle: {
                    stop: async () => { stopAdvertising(); },
                },
            };
        }

        // Android: legacy advertising with 16-bit UUID + hex manufacturerData.
        // munim-bluetooth's Android layer calls hexStringToByteArray() on
        // manufacturerData, so we must pass a hex string.
        // The 0000CAB0-... UUID format is auto-compressed to 16-bit (4 bytes)
        // in BLE advertising, leaving ~23 bytes for payload data.
        const hexPayload = encodePayload(addCode, userId);
        startAdvertising({
            serviceUUIDs: [AD_SERVICE_UUID],
            manufacturerData: hexPayload,
        });

        return {
            success: true,
            message: 'BLE advertising started (Android)',
            handle: {
                stop: async () => { stopAdvertising(); },
            },
        };
    } catch (error) {
        const msg = `Failed to start BLE advertising: ${(error as Error).message}`;
        console.error(msg);
        return { success: false, message: msg };
    }
}




export type DeviceFoundCallback = (device: BLEDevice) => void;
let removeDeviceFoundListener: (() => void) | null = null;

/**
 * Start BLE scanning for nearby devices.
 * Returns a cleanup function.
 */
export function startBleScan(
    onDeviceFound: DeviceFoundCallback,
): () => void {
    // Remove any previous listener
    if (removeDeviceFoundListener) {
        removeDeviceFoundListener();
        removeDeviceFoundListener = null;
    }

    removeDeviceFoundListener = addDeviceFoundListener((device: BLEDevice) => {
        onDeviceFound(device);
    });

    startScan({
        allowDuplicates: true,
        scanMode: 'lowLatency',
    });

    // Return cleanup function
    return () => {
        if (removeDeviceFoundListener) {
            removeDeviceFoundListener();
            removeDeviceFoundListener = null;
        }
        stopScan();
    };
}

// Stop BLE scanning and remove listener.
export function stopBleScan(): void {
    if (removeDeviceFoundListener) {
        removeDeviceFoundListener();
        removeDeviceFoundListener = null;
    }
    stopScan();
}


// Permission helpers

/**
 * Check if the app has been granted the required Bluetooth runtime permissions.
 *
 * On Android 12+, we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT.
 * We probe by calling isBluetoothEnabled() — if it throws a SecurityException
 * (or any error), it means the app lacks runtime permissions.
 *
 * NOTE: isBluetoothEnabled() returning false does NOT mean permissions are
 * missing — it only means the system Bluetooth radio is off.  Permissions
 * are checked separately via the error path.
 */
export async function checkBluetoothPermissions(): Promise<{
    hasPermission: boolean;
    isSupported: boolean;
    missingPermissions: string[];
}> {
    try {
        // Probe: if we can call this without an error, permissions are granted.
        await isBluetoothEnabled();
        return {
            hasPermission: true,
            isSupported: true,
            missingPermissions: [],
        };
    } catch (error) {
        console.error('Failed to check Bluetooth status (likely missing permissions):', error);
        return {
            hasPermission: false,
            isSupported: false,
            missingPermissions: ['BLUETOOTH'],
        };
    }
}

export async function requestBluetoothPermissions(): Promise<boolean> {
    try {
        return await requestBluetoothPermission();
    } catch (error) {
        console.error('Failed to request Bluetooth permissions:', error);
        return false;
    }
}

export function isAdvertisementDataValid(data: BleFriendData): boolean {
    return data.userId > 0 && data.addCode > 0;
}
