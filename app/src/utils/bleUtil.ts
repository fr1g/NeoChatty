import { Platform } from 'react-native';
import {
    startAdvertising,
    stopAdvertising,
    startExtendedAdvertising,
    stopExtendedAdvertising,
    startScan,
    stopScan,
    addDeviceFoundListener,
    getCapabilities,
    requestBluetoothPermission,
    isBluetoothEnabled,
} from 'munim-bluetooth';
import type { BLEDevice, BluetoothCapabilities } from 'munim-bluetooth';

/** iOS localName prefix: cab#<AddCode> (plaintext, short) */
export const IOS_LOCAL_NAME_PREFIX = 'cab';
/** Android Extended AD prefix: coarn#<userId>#<addCode>#<expiration> (base64) */
export const ANDROID_AD_PREFIX = 'coarn';

/** Custom 16-bit service UUID used for both platforms (optional filter) */
const AD_SERVICE_UUID = '0000CAB0-0000-1000-8000-00805F9B34FB';

// Base64 helpers (no Node.js Buffer in RN)
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function bytesToBase64(bytes: Uint8Array): string {
    let result = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
        const b1 = bytes[i];
        const b2 = i + 1 < len ? bytes[i + 1] : 0;
        const b3 = i + 2 < len ? bytes[i + 2] : 0;
        result += BASE64_CHARS[b1 >> 2];
        result += BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
        result += i + 1 < len ? BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
        result += i + 2 < len ? BASE64_CHARS[b3 & 0x3f] : '=';
    }
    return result;
}

function base64ToBytes(base64: string): Uint8Array | null {
    try {
        let str = base64.replace(/[^A-Za-z0-9+/=]/g, '');
        if (str.length % 4 !== 0) return null;
        const padding = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
        const outputLen = (str.length * 3) / 4 - padding;
        const bytes = new Uint8Array(outputLen);
        let pos = 0;
        for (let i = 0; i < str.length; i += 4) {
            const c1 = BASE64_CHARS.indexOf(str[i]);
            const c2 = BASE64_CHARS.indexOf(str[i + 1]);
            const c3 = str[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(str[i + 2]);
            const c4 = str[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(str[i + 3]);
            if (c1 === -1 || c2 === -1 || c3 === -1 || c4 === -1) return null;
            bytes[pos++] = (c1 << 2) | (c2 >> 4);
            if (str[i + 2] !== '=') bytes[pos++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
            if (str[i + 3] !== '=') bytes[pos++] = ((c3 & 0x03) << 6) | c4;
        }
        return bytes;
    } catch {
        return null;
    }
}

export interface BleFriendData {
    userId: number;           // 0 if unknown (iOS localName source)
    addCode: number;
    expirationTimestamp: number;
    deviceId: string;
    deviceName?: string;
    /** Whether the source is iOS localName (missing userId) */
    isIosLocalName: boolean;
}

export interface AdvertisingHandle {
    stop: () => Promise<void>;
}

let cachedCapabilities: BluetoothCapabilities | null = null;

export async function fetchCapabilities(): Promise<BluetoothCapabilities> {
    if (!cachedCapabilities) {
        cachedCapabilities = await getCapabilities();
    }
    return cachedCapabilities;
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

export async function isExtendedAdvertisingSupported(): Promise<boolean> {
    const caps = await fetchCapabilities();
    return caps.supportsExtendedAdvertising === true;
}

/**
 * Check if BLE is actually available on this device.
 * On Android emulators, the Bluetooth stack is typically absent or incomplete,
 * so even if the OS version is 8+, BLE advertising/scanning won't work.
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


// Build iOS localName: cab#<AddCode> 
export function buildIosLocalName(addCode: number): string {
    return `${IOS_LOCAL_NAME_PREFIX}#${addCode}`;
}

// Build Android full payload: coarn#<userId>#<addCode>#<expiration> 
export function buildAndroidPayload(
    userId: number,
    addCode: number,
    expirationTimestamp: number,
): string {
    return `${ANDROID_AD_PREFIX}#${userId}#${addCode}#${expirationTimestamp}`;
}

// Encode Android payload as Base64 for Extended AD manufacturerData 
export function encodeAndroidPayload(
    userId: number,
    addCode: number,
    expirationTimestamp: number,
): string {
    const plain = buildAndroidPayload(userId, addCode, expirationTimestamp);
    // React Native does not have global Buffer; use TextEncoder + base64
    const bytes = new TextEncoder().encode(plain);
    return bytesToBase64(bytes);
}

// Try to decode a localName starting with "cab#" 
function decodeIosLocalName(localName: string): { addCode: number } | null {
    if (!localName || !localName.startsWith(`${IOS_LOCAL_NAME_PREFIX}#`)) {
        return null;
    }
    const parts = localName.split('#');
    if (parts.length !== 2) return null;
    const addCode = parseInt(parts[1], 10);
    if (!Number.isFinite(addCode) || addCode <= 0) return null;
    return { addCode };
}

// Try to decode an Android manufacturerData (base64 -> coarn#...) 
function decodeAndroidPayload(encoded: string): BleFriendData | null {
    try {
        let plain: string;
        if (encoded.startsWith(`${ANDROID_AD_PREFIX}#`)) {
            plain = encoded;
        } else {
            const bytes = base64ToBytes(encoded);
            if (!bytes) return null;
            plain = new TextDecoder().decode(bytes);
        }
        if (!plain.startsWith(`${ANDROID_AD_PREFIX}#`)) return null;

        const parts = plain.split('#');
        if (parts.length !== 4) return null;

        const userId = parseInt(parts[1], 10);
        const addCode = parseInt(parts[2], 10);
        const expirationTimestamp = parseInt(parts[3], 10);

        if (
            !Number.isFinite(userId) || userId <= 0 ||
            !Number.isFinite(addCode) || addCode <= 0 ||
            !Number.isFinite(expirationTimestamp)
        ) {
            return null;
        }

        return {
            userId,
            addCode,
            expirationTimestamp,
            deviceId: '',
            isIosLocalName: false,
        };
    } catch {
        return null;
    }
}

/**
 * Extract BleFriendData from a scanned BLEDevice.
 * - iOS localName: cab#<addCode>  → userId=0, isIosLocalName=true
 * - Android manufacturerData: base64(coarn#...) → full data
 */
export function extractFriendDataFromDevice(device: BLEDevice): BleFriendData | null {

    const localName = device.localName || device.name || '';
    const iosMatch = decodeIosLocalName(localName);
    if (iosMatch) {
        return {
            userId: 0,               // unknown
            addCode: iosMatch.addCode,
            expirationTimestamp: 0,  // unknown
            deviceId: device.id,
            deviceName: localName || 'Unknown',
            isIosLocalName: true,
        };
    }


    const mfrData = device.manufacturerData;
    if (mfrData) {
        const androidMatch = decodeAndroidPayload(mfrData);
        if (androidMatch) {
            androidMatch.deviceId = device.id;
            androidMatch.deviceName = device.name || device.localName || 'Unknown';
            return androidMatch;
        }
    }

    return null;
}




/**
 * Start BLE advertising.
 *
 * iOS: uses startAdvertising with localName = cab#<AddCode>
 * Android: uses startExtendedAdvertising with manufacturerData = base64(full payload)
 */
export async function startBleAdvertising(
    userId: number,
    addCode: number,
    expirationTimestamp: number,
): Promise<{ success: boolean; message: string; handle?: AdvertisingHandle }> {
    if (!isBle5Supported()) {
        return {
            success: false,
            message: 'Your device does not support Bluetooth 5.0',
        };
    }

    try {
        if (Platform.OS === 'ios') {
            // iOS: advertise via localName only
            const localName = buildIosLocalName(addCode);
            startAdvertising({
                serviceUUIDs: [AD_SERVICE_UUID],
                localName,
            });
            return {
                success: true,
                message: 'BLE advertising started (iOS localName)',
                handle: {
                    stop: async () => { stopAdvertising(); },
                },
            };
        }

        // Android: use Extended AD with Base64 payload
        const base64Payload = encodeAndroidPayload(userId, addCode, expirationTimestamp);
        const advertisingId = await startExtendedAdvertising({
            serviceUUIDs: [AD_SERVICE_UUID],
            manufacturerData: base64Payload,
            connectable: false,
            scannable: true,
            legacyMode: false,
            includeTxPower: true,
        });

        return {
            success: true,
            message: 'BLE Extended Advertising started (Android)',
            handle: {
                stop: async () => { stopExtendedAdvertising(advertisingId); },
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
export async function checkBluetoothPermissions(): Promise<{
    hasPermission: boolean;
    isSupported: boolean;
    missingPermissions: string[];
}> {
    try {
        const enabled = await isBluetoothEnabled();
        if (!enabled) {
            return {
                hasPermission: false,
                isSupported: true,
                missingPermissions: ['BLUETOOTH_DISABLED'],
            };
        }
        return {
            hasPermission: true,
            isSupported: true,
            missingPermissions: [],
        };
    } catch (error) {
        console.error('Failed to check Bluetooth status:', error);
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
    // iOS localName sources have no expiration info; always treat as valid
    if (data.isIosLocalName) {
        return data.addCode > 0;
    }

    // Android full payload: validate all fields
    if (data.expirationTimestamp < Date.now()) {
        return false;
    }
    if (data.userId <= 0 || data.addCode <= 0) {
        return false;
    }
    return true;
}
