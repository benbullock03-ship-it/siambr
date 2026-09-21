-- T-31: the Senedd TV HLS master playlist for the meeting, as player.senedd.tv serves it (https).
-- stream_vbegin is the unix time of the first segment's EXT-X-PROGRAM-DATE-TIME, i.e. video
-- position 0; the playlist's vbegin parameter snaps back to that segment boundary.
ALTER TABLE plenary_sessions ADD COLUMN stream_url TEXT;
ALTER TABLE plenary_sessions ADD COLUMN stream_vbegin REAL;
