#!/usr/bin/env node
import { randomUUID } from 'crypto';
import sequelize, { testConnection } from '../database.js';
import { GameSession, Team } from '../models.js';
import { DataTypes, Op } from 'sequelize';

const slugify = (value = '') => value
  .toString()
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/--+/g, '-');

async function ensureDefaultSession() {
  let session = await GameSession.findOne({ order: [['updatedAt', 'DESC']] });
  if (!session) {
    session = await GameSession.create({
      name: 'Default Session',
      slug: 'default-session',
      currentRound: 0,
      isActive: false
    });
  }
  return session;
}

async function ensureColumn(tableName, columnName, definition) {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    console.log(`Adding column ${columnName} to ${tableName}`);
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function ensureUniqueIndex(tableName, columnName, indexName) {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some(idx => idx.name === indexName)) {
    console.log(`Creating unique index ${indexName} on ${tableName}(${columnName})`);
    await queryInterface.addIndex(tableName, [columnName], {
      name: indexName,
      unique: true
    });
  }
}

async function migrateGameSessions() {
  const sessions = await GameSession.findAll();
  const takenSlugs = new Set();

  for (const session of sessions) {
    if (session.slug) {
      takenSlugs.add(session.slug);
    }
  }

  for (const session of sessions) {
    let hasChanges = false;

    if (!session.name) {
      session.name = session.slug
        ? session.slug.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
        : `Session ${session.id.slice(0, 8)}`;
      hasChanges = true;
    }

    if (!session.slug) {
      let baseSlug = slugify(session.name) || `session-${session.id.slice(0, 8)}`;
      let candidate = baseSlug;
      let suffix = 1;
      while (takenSlugs.has(candidate)) {
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      session.slug = candidate;
      takenSlugs.add(candidate);
      hasChanges = true;
    }

    if (hasChanges) {
      await session.save();
      console.log(`Updated session ${session.id} → name="${session.name}", slug="${session.slug}"`);
    }
  }

  if (!sessions.length) {
    const defaultSession = await ensureDefaultSession();
    console.log(`Created default session ${defaultSession.id}`);
  }
}

async function migrateTeams() {
  await ensureColumn('Teams', 'gameSessionId', {
    type: DataTypes.UUID,
    allowNull: true
  });
  const defaultSession = await ensureDefaultSession();
  const teamsWithoutSession = await Team.findAll({
    where: { gameSessionId: null },
    attributes: ['id', 'name']
  });

  for (const team of teamsWithoutSession) {
    await Team.update(
      { gameSessionId: defaultSession.id },
      { where: { id: team.id } }
    );
    console.log(`Assigned team "${team.name}" (${team.id}) to session ${defaultSession.id}`);
  }

  const sessionOwners = new Map();
  const teamsBySession = await Team.findAll({
    where: {
      isActive: true,
      gameSessionId: { [Op.ne]: null }
    },
    attributes: ['id', 'gameSessionId']
  });

  for (const team of teamsBySession) {
    if (!team.gameSessionId) continue;
    if (!sessionOwners.has(team.gameSessionId)) {
      sessionOwners.set(team.gameSessionId, team.id);
    }
  }

  for (const [sessionId, ownerTeamId] of sessionOwners.entries()) {
    const session = await GameSession.findByPk(sessionId);
    if (session && !session.ownerTeamId) {
      session.ownerTeamId = ownerTeamId;
      await session.save();
      console.log(`Marked team ${ownerTeamId} as owner for session ${sessionId}`);
    }
  }
}

async function main() {
  try {
    console.log('▶️  Running session migration...');
    await testConnection();
    await ensureColumn('GameSessions', 'name', { type: DataTypes.STRING, allowNull: true });
    await ensureColumn('GameSessions', 'slug', { type: DataTypes.STRING, allowNull: true });
    await ensureColumn('GameSessions', 'ownerTeamId', { type: DataTypes.UUID, allowNull: true });
    await ensureColumn('Teams', 'gameSessionId', { type: DataTypes.UUID, allowNull: true });

    await migrateGameSessions();
    await migrateTeams();

    // Ensure slug uniqueness via index
    await ensureUniqueIndex('GameSessions', 'slug', 'game_sessions_slug_unique');

    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
