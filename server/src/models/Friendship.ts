import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface FriendshipAttributes {
    id: number;
    user_id: number;
    friend_id: number;
    created_at?: Date;
}
interface FriendshipCreationAttributes extends Optional<FriendshipAttributes, 'id'> {
}
class Friendship extends Model<FriendshipAttributes, FriendshipCreationAttributes> implements FriendshipAttributes {
    declare id: number;
    declare user_id: number;
    declare friend_id: number;
    declare created_at: Date;
}
Friendship.init({
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
    friend_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
}, {
    sequelize,
    tableName: 'friendships',
    underscored: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['user_id', 'friend_id'] }],
});
export default Friendship;
