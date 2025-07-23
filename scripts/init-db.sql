-- Script d'initialisation de la base de données NYOTA
-- Ce script est exécuté automatiquement lors du premier démarrage de PostgreSQL

-- Créer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Créer des bases de données séparées pour les environnements
CREATE DATABASE nyota_users_dev;
CREATE DATABASE nyota_users_test;
CREATE DATABASE nyota_users_prod;

-- Configurer les paramètres de sécurité
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Créer un utilisateur de lecture seule pour les rapports
CREATE USER nyota_readonly WITH PASSWORD 'NyotaReadOnly2024!';
GRANT CONNECT ON DATABASE nyota_users TO nyota_readonly;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Bases de données NYOTA initialisées avec succès';
END $$;