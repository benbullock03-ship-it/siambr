-- 005: spec 2.0.0 (2026-09-20) withdraws corridors, plinths and citizen trails.
-- policy_domains.wing_label and bearing_degrees stay as unused columns; nothing reads them.

DROP INDEX IF EXISTS idx_plinths_wing_chunk;
DROP TABLE IF EXISTS spatial_plinths;
DROP TABLE IF EXISTS citizen_trail_stops;
DROP TABLE IF EXISTS citizen_trails;
