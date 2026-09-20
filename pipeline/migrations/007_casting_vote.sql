-- T-05: the Presiding Officer's casting vote on a tied division, as the Record lists it.
-- Outside votes_for/votes_against; never a member_votes row.
ALTER TABLE division_votes ADD COLUMN casting_vote TEXT CHECK (casting_vote IN ('for', 'against'));
