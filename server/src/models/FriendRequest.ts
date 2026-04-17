import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface FriendRequestAttributes {
    id: number;
    from_user_id: number;
    to_user_id: number;
    status: 'pending' | 'accepted' | 'rejected';
    created_at?: Date;
    updated_at?: Date;
}
interface FriendRequestCreationAttributes extends Optional<FriendRequestAttributes, 'id' | 'status'> {
}
class FriendRequest extends Model<FriendRequestAttributes, FriendRequestCreationAttributes> implements FriendRequestAttributes {
    declare id: number;
    declare from_user_id: number;
    declare to_user_id: number;
    declare status: 'pending' | 'accepted' | 'rejected';
    declare created_at: Date;
    declare updated_at: Date;
}
FriendRequest.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    from_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    to_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
    status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    },
}, {
    sequelize,
    tableName: 'friend_requests',
    underscored: true,
    indexes: [
        { fields: ['from_user_id', 'to_user_id'] },
        { fields: ['to_user_id', 'status'] },
    ],
});
export default FriendRequest;
