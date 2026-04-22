import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ContactAttributes {
    id: number;
    user_id: number;
    friend_id: number;
    created_at?: Date;
}
interface ContactCreationAttributes extends Optional<ContactAttributes, 'id'> {
}
class Contact extends Model<ContactAttributes, ContactCreationAttributes> implements ContactAttributes {
    declare id: number;
    declare user_id: number;
    declare friend_id: number;
    declare created_at: Date;
}
Contact.init({
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
    tableName: 'contacts',
    underscored: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['user_id', 'friend_id'] }],
});
export default Contact;
