import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Platform } from 'react-native';

/** react-native-ble-plx extended with advertising API */
interface BleAdvertisingManager {
    startAdvertising(options: {
        allowDuplicates?: boolean;
        manufacturerData?: string;
        isConnectable?: boolean;
        txPowerLevel?: number;
    }): Promise<void>;
    stopAdvertising?(): Promise<void>;
}

function asAdvertisingManager(manager: BleManager): BleAdvertisingManager {
    return manager as unknown as BleAdvertisingManager;
}
import { PERMISSIONS, RESULTS, checkMultiple, requestMultiple, Permission } from 'react-native-permissions';

/**
 * BLE payload coarn#<userId>#<addCode>#<expirationTimestamp> as base64
 */
export interface BleFriendData {
    userId: number;
    addCode: number;
    expirationTimestamp: number;
    deviceId: string;
    deviceName?: string;
}

export const BLE_AD_PREFIX = 'coarn';
export const BLE5_UNSUPPORTED_MESSAGE =
    `Your device doesn't support Bluetooth 5`;

function getBluetoothPermissions(): Permission[] {
    if (Platform.OS === 'ios') {
        return [PERMISSIONS.IOS.BLUETOOTH];
    }

    const androidVersion = typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;
    // Android
    if (androidVersion >= 31) {
        // Android 12+
        return [
            PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
            PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
            PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
            PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ];
    }

    // Android 11 及以下
    return [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ];
}

// easy way: only by OS version (dangerous)
export function isBle5Supported(): boolean {
    const version = typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (Platform.OS === 'ios') {
        return version >= 13;
    }
    return version >= 26;
}

export function buildAdvertisementPayload(
    userId: number,
    addCode: number,
    expirationTimestamp: number
): string {
    return `${BLE_AD_PREFIX}#${userId}#${addCode}#${expirationTimestamp}`;
}

export function encodeAdvertisementData(
    userId: number,
    addCode: number,
    expirationTimestamp: number
): string {
    const plain = buildAdvertisementPayload(userId, addCode, expirationTimestamp);
    return Buffer.from(plain, 'utf8').toString('base64');
}




export function decodeAdvertisementData(encoded: string): BleFriendData | null {
    try {
        let plain: string;
        if (encoded.startsWith(`${BLE_AD_PREFIX}#`)) {
            plain = encoded;
        } else {
            plain = Buffer.from(encoded, 'base64').toString('utf8');
        }

        const parts = plain.split('#');
        if (parts.length !== 4 || parts[0] !== BLE_AD_PREFIX) {
            return null;
        }

        const userId = parseInt(parts[1], 10);
        const addCode = parseInt(parts[2], 10);
        const expirationTimestamp = parseInt(parts[3], 10);

        if (
            !Number.isFinite(userId) ||
            !Number.isFinite(addCode) ||
            !Number.isFinite(expirationTimestamp)
        ) {
            return null;
        }

        return {
            userId,
            addCode,
            expirationTimestamp,
            deviceId: '',
        };
    } catch (error) {
        console.error('Failed to decode BLE advertisement data:', error);
        return null;
    }
}



export function extractFriendDataFromDevice(device: Device): BleFriendData | null {
    try {
        if (!device.manufacturerData) {
            return null;
        }

        const friendData = decodeAdvertisementData(device.manufacturerData);

        if (friendData) {
            friendData.deviceId = device.id;
            friendData.deviceName = device.name || device.localName || 'Unknown';
            return friendData;
        }

        return null;
    } catch (error) {
        console.error('Failed to extract friend data from device:', error);
        return null;
    }
}

export async function checkBluetoothPermissions(): Promise<{
    hasPermission: boolean;
    isSupported: boolean;
    missingPermissions: string[];
}> {
    try {
        const permissions = getBluetoothPermissions();

        const results = await checkMultiple(permissions);

        const missingPermissions: string[] = [];
        Object.entries(results).forEach(([permission, status]) => {
            if (status !== RESULTS.GRANTED) {
                missingPermissions.push(permission);
            }
        });

        return {
            hasPermission: missingPermissions.length === 0,
            isSupported: true,
            missingPermissions,
        };
    } catch (error) {
        console.error('Failed to check Bluetooth permissions:', error);
        return {
            hasPermission: false,
            isSupported: false,
            missingPermissions: ['BLUETOOTH'],
        };
    }
}

export async function requestBluetoothPermissions(): Promise<boolean> {
    try {
        const permissions = getBluetoothPermissions();


        const results = await requestMultiple(permissions);

        const allGranted = Object.values(results).every(
            status => status === RESULTS.GRANTED
        );

        return allGranted;
    } catch (error) {
        console.error('Failed to request Bluetooth permissions:', error);
        return false;
    }
}

export async function startBleScan(
    manager: BleManager,
    onDeviceFound: (device: Device) => void,
    onError?: (error: Error) => void
): Promise<Subscription | null> {
    try {
        const subscription = manager.onStateChange((state) => {
            if (state === 'PoweredOn') {
                manager.startDeviceScan(null, null, (error, device) => {
                    if (error) {
                        console.error('BLE scan error:', error);
                        onError?.(error);
                        return;
                    }

                    if (device) {
                        onDeviceFound(device);
                    }
                });
            }
        });

        return subscription;
    } catch (error) {
        console.error('Failed to start BLE scan:', error);
        onError?.(error as Error);
        return null;
    }
}

export async function stopBleScan(manager: BleManager): Promise<void> {
    try {
        manager.stopDeviceScan();
    } catch (error) {
        console.error('Failed to stop BLE scan:', error);
    }
}

interface AdvertisingState {
    manager: BleManager | null;
    isAdvertising: boolean;
    stateSubscription: Subscription | null;
    error: string | null;
}

const advertisingState: AdvertisingState = {
    manager: null,
    isAdvertising: false,
    stateSubscription: null,
    error: null,
};

export async function startBleAdvertising(
    manager: BleManager,
    userId: number,
    addCode: number,
    expirationTimestamp: number
): Promise<{ success: boolean; message: string }> {
    if (!isBle5Supported()) {
        return { success: false, message: BLE5_UNSUPPORTED_MESSAGE };
    }

    try {
        const base64Payload = encodeAdvertisementData(userId, addCode, expirationTimestamp);

        await asAdvertisingManager(manager).startAdvertising({
            allowDuplicates: true,
            manufacturerData: base64Payload,
            isConnectable: false,
            txPowerLevel: 2,
        });

        advertisingState.manager = manager;
        advertisingState.isAdvertising = true;
        advertisingState.error = null;

        return { success: true, message: 'BLE advertising started' };
    } catch (error) {
        const errorMsg = `Failed to start BLE advertising: ${(error as Error).message}`;
        console.error(errorMsg);
        advertisingState.error = errorMsg;
        return { success: false, message: errorMsg };
    }
}

export async function stopBleAdvertising(): Promise<void> {
    try {
        if (advertisingState.manager) {
            await asAdvertisingManager(advertisingState.manager).stopAdvertising?.();
            advertisingState.isAdvertising = false;
            console.log('BLE advertising stopped');
        }
    } catch (error) {
        console.error('Failed to stop BLE advertising:', error);
        advertisingState.error = `Failed to stop advertising: ${(error as Error).message}`;
    }
}

export function getAdvertisingState(): AdvertisingState {
    return { ...advertisingState };
}

export function isAdvertisementDataValid(data: BleFriendData): boolean { // local
    if (data.expirationTimestamp < Date.now()) {
        return false;
    }

    if (data.userId <= 0 || data.addCode <= 0) {
        return false;
    }

    return true;
}
