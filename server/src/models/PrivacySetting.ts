import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface PrivacySettingAttributes {
    user_id: number;
    searchable_by_username: boolean;
    searchable_by_display_name: boolean;
    show_avatar_to_strangers: boolean;
}
interface PrivacySettingCreationAttributes extends Optional<PrivacySettingAttributes, 'searchable_by_username' | 'searchable_by_display_name' | 'show_avatar_to_strangers'> {
}
class PrivacySetting extends Model<PrivacySettingAttributes, PrivacySettingCreationAttributes> implements PrivacySettingAttributes {
    declare user_id: number;
    declare searchable_by_username: boolean;
    declare searchable_by_display_name: boolean;
    declare show_avatar_to_strangers: boolean;
}
PrivacySetting.init({
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
    },
    searchable_by_username: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    searchable_by_display_name: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    show_avatar_to_strangers: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize,
    tableName: 'privacy_settings',
    underscored: true,
    timestamps: false,
});
export default PrivacySetting;
