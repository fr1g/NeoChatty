import * as Device from 'expo-device';
import { Platform } from 'react-native';

const SERVER_PORT = 5637;
const DEVICE_API_HOST = 'rus.kami.su'; //'192.168.3.3';
const IOS_SIMULATOR_API_HOST = 'localhost';
const ANDROID_SIMULATOR_API_HOST = '10.0.2.2';
const WEB_API_HOST = 'rus.kami.su';

function getEnvApiOrigin(): string | null {
    const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (!value) {
        return null;
    }
    return value.replace(/\/+$/, '');
}
function getConfiguredHost(): string {
    if (Platform.OS === 'web') {
        return WEB_API_HOST;
    }
    if (Device.isDevice) {
        return DEVICE_API_HOST;
    }
    return Platform.OS === 'android'
        ? ANDROID_SIMULATOR_API_HOST
        : IOS_SIMULATOR_API_HOST;
}
function buildOrigin(host: string): string {
    return `http://${host}:${SERVER_PORT}`;
}
export const API_ORIGIN = getEnvApiOrigin() ?? buildOrigin(getConfiguredHost());
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const SOCKET_BASE_URL = API_ORIGIN;
