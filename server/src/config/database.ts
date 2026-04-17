import { Sequelize } from 'sequelize';
import appConfig from './../appconfig';

const sequelize = new Sequelize(appConfig.DB.NAME ?? 'chatty', appConfig.DB.USER ?? 'root', appConfig.DB.PASSWORD ?? '7355608', {
    host: appConfig.DB.HOST ?? 'localhost',
    port: appConfig.DB.PORT ?? 3306,
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
