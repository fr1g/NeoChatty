import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface ConversationAttributes {
    id: number;
    user_id: number;
    peer_id: number;
    last_message_id: number | null;
    unread_count: number;
    updated_at?: Date;
}
interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id' | 'last_message_id' | 'unread_count'> {
}
class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
    declare id: number;
    declare user_id: number;
    declare peer_id: number;
    declare last_message_id: number | null;
    declare unread_count: number;
    declare updated_at: Date;
}
Conversation.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    peer_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    last_message_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
    },
    unread_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize,
    tableName: 'conversations',
    underscored: true,
    createdAt: false,
    indexes: [{ unique: true, fields: ['user_id', 'peer_id'] }],
});
export default Conversation;
