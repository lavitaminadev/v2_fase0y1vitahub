import '../config/load-environment';
import { DataSource, DataSourceOptions } from 'typeorm';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'vitahub';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_DATABASE = process.env.DB_DATABASE || 'vitahub';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  extra: {
    charset: 'utf8mb4_unicode_ci',
  },
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
