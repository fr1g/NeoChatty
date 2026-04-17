import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface MessageAttributes {
    id: number;
    sender_id: number;
    receiver_id: number;
    type: 'text' | 'image' | 'video' | 'file';
    content: string | null;
    file_locator: string | null;
    file_name: string | null;
    file_size: number | null;
    is_recalled: boolean;
    is_read: boolean;
    created_at?: Date;
}
interface MessageCreationAttributes extends Optional<MessageAttributes, 'id' | 'type' | 'content' | 'file_locator' | 'file_name' | 'file_size' | 'is_recalled' | 'is_read'> {
}
class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
    declare id: number;
    declare sender_id: number;
    declare receiver_id: number;
    declare type: 'text' | 'image' | 'video' | 'file';
    declare content: string | null;
    declare file_locator: string | null;
    declare file_name: string | null;
    declare file_size: number | null;
    declare is_recalled: boolean;
    declare is_read: boolean;
    declare created_at: Date;
}
Message.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    sender_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    receiver_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    type: {
        type: DataTypes.ENUM('text', 'image', 'video', 'file'),
        allowNull: false,
        defaultValue: 'text',
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    file_locator: {
        type: DataTypes.STRING(64),
        allowNull: true,
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    file_size: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
    },
    is_recalled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    sequelize,
    tableName: 'messages',
    underscored: true,
    updatedAt: false,
    indexes: [
        { fields: ['sender_id', 'receiver_id', 'created_at'] },
        { fields: ['receiver_id', 'is_read'] },
    ],
});
export default Message;
