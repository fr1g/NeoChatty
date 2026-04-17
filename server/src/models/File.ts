import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
interface FileAttributes {
    id: number;
    locator: string;
    original_name: string;
    storage_path: string;
    file_size: number;
    mime_type: string;
    uploader_id: number;
    created_at?: Date;
}
interface FileCreationAttributes extends Optional<FileAttributes, 'id'> {
}
class File extends Model<FileAttributes, FileCreationAttributes> implements FileAttributes {
    declare id: number;
    declare locator: string;
    declare original_name: string;
    declare storage_path: string;
    declare file_size: number;
    declare mime_type: string;
    declare uploader_id: number;
    declare created_at: Date;
}
File.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    locator: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
    },
    original_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    storage_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    file_size: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    uploader_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
    },
}, {
    sequelize,
    tableName: 'files',
    underscored: true,
    updatedAt: false,
});
export default File;
