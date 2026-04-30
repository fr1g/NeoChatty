import express from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import sequelize from './config/database';
import { setupSocket } from './socket';
import { getConfig } from './config/index';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import friendsRoutes from './routes/friends';
import blocksRoutes from './routes/blocks';
import filesRoutes from './routes/files';
import messagesRoutes from './routes/messages';
import conversationsRoutes from './routes/conversations';
import { cleanupDuplicateIndexes } from './utils/database';
import { getSwaggerSpec } from './swagger';
import './models';
import { renderMOTD } from './utils/motd';

const appConfig = getConfig();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Swagger documentation routes
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(getSwaggerSpec()));
app.get('/api/swagger.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(getSwaggerSpec());
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
});
setupSocket(server);
const PORT = process.env.PORT || appConfig.PORT;
function getLanAddresses(): string[] {
    const networkInterfaces = os.networkInterfaces();
    const addresses = new Set<string>();
    for (const entries of Object.values(networkInterfaces)) {
        for (const entry of entries ?? []) {
            const isIPv4 = String(entry.family) === 'IPv4' || String(entry.family) === '4';
            if (!isIPv4 || entry.internal) {
                continue;
            }
            addresses.add(entry.address);
        }
    }
    return [...addresses];
}
function logServerAddresses(port: string | number) {
    const useHttps = appConfig.USE_HTTPS;
    const localOrigin = `http${useHttps ? 's' : ''}://localhost:${port}`;
    const lanOrigins = getLanAddresses().map((address) => `http${useHttps ? 's' : ''}://${address}:${port}`);
    if (lanOrigins.length === 0) {
        return;
    }
    for (const origin of lanOrigins) { // ...
    }
}

async function start() {
    try {
        console.log('Chatty: Starting server...');
        await sequelize.authenticate();
        console.log('Chatty: Complete: Sequelize initialization');
        await cleanupDuplicateIndexes();
        console.log('Chatty: Complete: Index cleanup');

        const shouldAlterSchema = process.env.DB_SYNC_ALTER === 'true';

        await sequelize.sync({ alter: shouldAlterSchema });
        console.log('Chatty: Complete: Sequelize sync');

        server.listen(PORT, () => {
            logServerAddresses(PORT);
            console.log(`Chatty: Server listening on port ${PORT}`);

        });
    }
    catch (err) {
        process.exit(1);
    }
}
start();

const scriptDir = __dirname;
const workingDir = process.cwd();
console.log(`
    Chatty: Server Info
    -----
    DIR
    -----
    scriptDir: ${scriptDir}
    workingDir: ${workingDir}
    -----
    CONFIG
    -----
    USE_HTTPS: ${appConfig.USE_HTTPS}
    PORT: ${appConfig.PORT}
    DB:
        NAME: ${appConfig.DB.NAME}
        USER: ${appConfig.DB.USER}
        HOST: ${appConfig.DB.HOST}
        PORT: ${appConfig.DB.PORT}
    -----
    MOTD
    -----
        ${renderMOTD(true)}
    -----
`);

console.log('Chatty: Server ready');
