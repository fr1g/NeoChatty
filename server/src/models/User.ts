import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface UserAttributes {
    id: number;
    username: string;
    display_name: string;
    password_hash: string;
    avatar_locator: string | null;
    background_locator: string | null;
    token_version: number;
    created_at?: Date;
    updated_at?: Date;
}
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'avatar_locator' | 'background_locator' | 'token_version'> {
}
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    declare id: number;
    declare username: string;
    declare display_name: string;
    declare password_hash: string;
    declare avatar_locator: string | null;
    declare background_locator: string | null;
    declare token_version: number;
    declare created_at: Date;
    declare updated_at: Date;
}
User.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    display_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    avatar_locator: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
    },
    background_locator: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: null,
    },
    token_version: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize,
    tableName: 'users',
    underscored: true,
});
export default User;
