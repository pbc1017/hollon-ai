-- Hollon-AI Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions in public schema (accessible from all schemas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;  -- 텍스트 검색용

-- Create schemas
CREATE SCHEMA IF NOT EXISTS hollon;
CREATE SCHEMA IF NOT EXISTS hollon_test;

-- Grant permissions on schemas
GRANT ALL ON SCHEMA hollon TO hollon;
GRANT ALL ON SCHEMA hollon_test TO hollon;

-- Grant usage on public schema (for extensions)
GRANT USAGE ON SCHEMA public TO hollon;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Hollon-AI database initialized successfully';
    RAISE NOTICE 'Extensions enabled in public schema: uuid-ossp, vector, pg_trgm';
    RAISE NOTICE 'Schemas created: hollon, hollon_test';
END
$$;
