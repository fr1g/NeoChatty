import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NodeChatty API Documentation',
            version: '1.0.0',
            description: 'API documentation for NodeChatty - A real-time chat application',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: 'http://localhost:5637/api',
                description: 'Development server',
            },
            {
                url: '/api',
                description: 'Current server',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token',
                },
            },
        },
        security: [],
        tags: [
            {
                name: 'Authentication',
                description: 'User authentication endpoints',
            },
            {
                name: 'Users',
                description: 'User management endpoints',
            },
            {
                name: 'Friends',
                description: 'Friend management endpoints',
            },
            {
                name: 'Conversations',
                description: 'Conversation management endpoints',
            },
            {
                name: 'Messages',
                description: 'Message endpoints',
            },
            {
                name: 'Blocks',
                description: 'Block list management endpoints',
            },
            {
                name: 'Files',
                description: 'File upload and download endpoints',
            },
        ],
    },
    apis: [
        path.join(__dirname, './routes/auth.ts'),
        path.join(__dirname, './routes/users.ts'),
        path.join(__dirname, './routes/friends.ts'),
        path.join(__dirname, './routes/conversations.ts'),
        path.join(__dirname, './routes/messages.ts'),
        path.join(__dirname, './routes/blocks.ts'),
        path.join(__dirname, './routes/files.ts'),
    ],
};

// Lazy load swagger spec to avoid resource issues
let cachedSwaggerSpec: any = null;

export function getSwaggerSpec() {
    if (!cachedSwaggerSpec) {
        cachedSwaggerSpec = swaggerJsdoc(options);
    }
    return cachedSwaggerSpec;
}
