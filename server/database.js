import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config();
}

// Database configuration
const dbConfig = process.env.NODE_ENV === 'production' ? {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'apxo_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  ssl: process.env.DB_SSL === 'true',
  dialectOptions: {
    ...(process.env.DB_SSL === 'true' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {}),
    // Force IPv4 to avoid IPv6 connection issues
    connect: {
      family: 4
    }
  }
} : {
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: console.log
};

// Create Sequelize instance
const sequelize = process.env.NODE_ENV === 'production'
  ? new Sequelize(
      process.env.DATABASE_URL || `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
      dbConfig
    )
  : new Sequelize(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
};

export { sequelize, testConnection };
export default sequelize;
