-- The Senedd TV verbatim feed: the same pictures with the floor audio as spoken, named by the
-- Welsh-language player (senedd.tv/cy/{meeting}). Gated on its own first segment like stream_url.
ALTER TABLE plenary_sessions ADD COLUMN stream_url_verbatim TEXT;
ALTER TABLE plenary_sessions ADD COLUMN stream_vbegin_verbatim REAL;
