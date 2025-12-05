-- Hollon-AI Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 텍스트 검색용

-- Create schemas
CREATE SCHEMA IF NOT EXISTS hollon;
CREATE SCHEMA IF NOT EXISTS hollon_test;

-- Grant permissions
GRANT ALL ON SCHEMA hollon TO hollon;
GRANT ALL ON SCHEMA hollon_test TO hollon;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Hollon-AI database initialized successfully';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, vector, pg_trgm';
END
$$;
