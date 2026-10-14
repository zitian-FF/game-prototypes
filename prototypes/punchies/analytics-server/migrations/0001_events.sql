CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,pid TEXT NOT NULL,first_at INTEGER NOT NULL,last_at INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS daily_caps(day TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,received_at INTEGER NOT NULL,sid TEXT NOT NULL,pid TEXT NOT NULL,edition TEXT NOT NULL CHECK(edition='itchbeta'),build TEXT NOT NULL,n INTEGER NOT NULL,t INTEGER NOT NULL,e TEXT NOT NULL,p_json TEXT NOT NULL,UNIQUE(sid,n));
CREATE INDEX IF NOT EXISTS events_event ON events(e,received_at);
CREATE INDEX IF NOT EXISTS events_received ON events(received_at);
CREATE INDEX IF NOT EXISTS events_pid_day ON events(pid,received_at);
CREATE TRIGGER IF NOT EXISTS event_counts AFTER INSERT ON events BEGIN
 UPDATE sessions SET count=count+1,last_at=NEW.received_at WHERE sid=NEW.sid;
 INSERT INTO daily_caps(day,count) VALUES(strftime('%Y-%m-%d',NEW.received_at,'unixepoch'),1) ON CONFLICT(day) DO UPDATE SET count=count+1;
END;
