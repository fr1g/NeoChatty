import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// nexg-generation: migrate this relation into Contact
interface BlockAttributes {
    id: number;
    user_id: number;
    blocked_user_id: number;
    created_at?: Date;
}
interface BlockCreationAttributes extends Optional<BlockAttributes, 'id'> {
}
class Block extends Model<BlockAttributes, BlockCreationAttributes> implements BlockAttributes {
    declare id: number;
    declare user_id: number;
    declare blocked_user_id: number;
    declare created_at: Date;
}
Block.init({
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
    blocked_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
}, {
    sequelize,
    tableName: 'blocks',
    underscored: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['user_id', 'blocked_user_id'] }],
});
export default Block;
