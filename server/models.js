import { DataTypes } from 'sequelize';
import sequelize from './database.js';

// Team Model
export const Team = sequelize.define('Team', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  socketId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  resumeToken: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  resumeUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  decisions: {
    type: DataTypes.JSON,
    defaultValue: {
      price: 500,
      fixSeatsRequested: 0,
      fixSeatsPurchased: 0,
      fixSeatsAllocated: 0,
      poolingAllocation: 0,
      fixSeatBidPrice: null,
      fixSeatClearingPrice: null
    }
  },
  totalProfit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Game Session Model
export const GameSession = sequelize.define('GameSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  currentRound: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      baseDemand: 100,
      spread: 50,
      shock: 0.1,
      sharedMarket: true,
      seed: 42,
      roundTime: 180,
      priceElasticity: -1.5,
      crossElasticity: 0.3,
      costVolatility: 0.05,
      demandVolatility: 0.1,
      marketConcentration: 0.7,
      fixSeatShare: 0,
      fixSeatMinBid: 80,
      airlinePriceMin: 80,
      airlinePriceMax: 400
    }
  },
  adminSocketId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Round Result Model
export const RoundResult = sequelize.define('RoundResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  gameSessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: GameSession,
      key: 'id'
    }
  },
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  teamId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Team,
      key: 'id'
    }
  },
  sold: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  revenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  profit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  unsold: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  marketShare: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0
  },
  demand: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  avgPrice: {
    type: DataTypes.DECIMAL(8, 2),
    defaultValue: 0
  },
  capacity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  insolvent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// High Score Model
export const HighScore = sequelize.define('HighScore', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  teamName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  roundsPlayed: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  avgRevenuePerRound: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  gameSessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: GameSession,
      key: 'id'
    }
  },
  achievedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Define associations
GameSession.hasMany(RoundResult, { foreignKey: 'gameSessionId', onDelete: 'CASCADE' });
RoundResult.belongsTo(GameSession, { foreignKey: 'gameSessionId' });

Team.hasMany(RoundResult, { foreignKey: 'teamId', onDelete: 'CASCADE' });
RoundResult.belongsTo(Team, { foreignKey: 'teamId' });

GameSession.hasMany(HighScore, { foreignKey: 'gameSessionId', onDelete: 'CASCADE' });
HighScore.belongsTo(GameSession, { foreignKey: 'gameSessionId' });

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
  }
};

export { syncDatabase };
export default { Team, GameSession, RoundResult, HighScore, syncDatabase };
