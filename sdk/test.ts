import * as readline from 'readline';
import { ChattyClient, ChattyClientConfig } from './client';
import { ConstructClient } from './index';
import * as ChattySocket from './socket';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function runTest() {
    console.log('=== SDK Test Suite ===\n');

    try {

        console.log('Please enter server configuration:');
        const endpoint = await question('Server endpoint (default: localhost): ');
        const portStr = await question('Server port (default: 5637): ');
        const httpsStr = await question('Enable HTTPS? (yes/no, default: no): ');

        const serverEndpoint = endpoint || 'localhost';
        const serverPort = portStr ? parseInt(portStr, 10) : 5637;
        const useHttps = httpsStr.toLowerCase() === 'yes' || httpsStr.toLowerCase() === 'y';

        console.log(`\n[Config] Endpoint: ${serverEndpoint}, Port: ${serverPort}, HTTPS: ${useHttps}\n`);

        const config = new ChattyClientConfig(useHttps, serverEndpoint);
        console.log('[✓] ChattyClientConfig created');
        console.log(`    API URL: ${config.getApi()}`);
        console.log(`    Socket URL: ${config.getSocket()}\n`);

        const chattyClient = new ChattyClient(config);
        console.log('[✓] ChattyClient created\n');

        const mockStorage: Record<string, string> = {};
        const set = (key: string, value: string) => {
            mockStorage[key] = value;
        };
        const get = (key: string) => {
            return mockStorage[key] || null;
        };
        const remove = (key: string) => {
            delete mockStorage[key];
        };

        chattyClient.initClient(set, get, remove);
        console.log('[✓] ChattyClient initialized with sync method\n');

        const api = ConstructClient(chattyClient);
        console.log('[✓] API client constructed\n');

        console.log('Testing API endpoints...\n');
        setTimeout(async () => {
            try {
                console.log('  [*] Testing GET /api/health...');
                const healthResponse = await api.system.getHealth();
                console.log('  [✓] Health check successful');
                console.log('      Response:', JSON.stringify(healthResponse.data, null, 2));
            } catch (error: any) {
                console.log('  [✗] Health check failed');
                console.log('      Error:', error.message || error);
            }
        }, 123);

        setTimeout(async () => {
            try {
                console.log('\n  [*] Testing GET /api/motd...');
                const motdResponse = await api.system.getMotd();
                console.log('  [✓] MOTD fetch successful');
                console.log('      Response:', JSON.stringify(motdResponse.data, null, 2));
            } catch (error: any) {
                console.log('  [✗] MOTD fetch failed');
                console.log('      Error:', error.message || error);
            }
        }, 123);


        console.log('\n\nTesting Socket endpoints...\n');
        try {
            console.log('  [*] Connecting to public socket at /chathub/public...');
            const socketUrl = config.getSocket();
            ChattySocket.connectPublic(socketUrl);

            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });

            console.log('  [✓] Connected to public socket\n');

            console.log('  [*] Sending ping...');
            await new Promise<void>((resolve) => {
                console.log('  [*] Sending ping (in promise)...');

                ChattySocket.ping((response) => {
                    console.log('  [✓] Ping successful');
                    console.log('      Server timestamp:', response.timestamp);
                    console.log('      Client timestamp:', Date.now());
                    console.log('      Latency (approx):', Math.abs(Date.now() - response.timestamp), 'ms');
                    ChattySocket.disconnectPublic();
                    resolve();
                });

                setTimeout(() => {
                    console.log('  [✗] Ping timeout (5 seconds)');
                    ChattySocket.disconnectPublic();
                    resolve();
                }, 5000);
            });
        } catch (error: any) {
            console.log('  [✗] Socket connection failed');
            console.log('      Error:', error.message || error);
        }

        console.log('\n=== Test Suite Completed ===\n');
    } catch (error: any) {
        console.error('Fatal error:', error.message || error);
    } finally {
        rl.close();
        process.exit(0);
    }
}

// 运行测试
runTest().catch((error) => {
    console.error('Unhandled error:', error);
    rl.close();
    process.exit(1);
});
