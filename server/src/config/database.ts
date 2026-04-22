import { Sequelize } from 'sequelize';
import { getConfig } from './index';

const appConfig = getConfig();

const sequelize = new Sequelize(appConfig.DB.NAME, appConfig.DB.USER, appConfig.DB.PASSWORD, {
    host: appConfig.DB.HOST,
    port: appConfig.DB.PORT,
    dialect: 'mysql',
    logging: false,
    define: {
        underscored: true,
        timestamps: true,
    },
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
export default sequelize;
