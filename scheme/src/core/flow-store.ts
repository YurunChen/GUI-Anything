/**
 * ABOUTME: SQLite persistence layer for flow mode using Bun's built-in SQLite.
 * Stores sessions, nodes, raw events, and summaries in a single database file.
 */

import { Database } from 'bun:sqlite';
import path from 'path';
import os from 'os';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.claude', 'scheme5', 'flow.db');

export interface FlowSessionRow {
  id: string;
  prompt: string;
  model: string;
  status: string;
  started_at: number;
  ended_at: number | null;
}

export interface FlowNodeRow {
  id: string;
  session_id: string;
  parent_id: string | null;
  type: string;
  timestamp: number;
  summary: string;
  phase: string | null;
  tool_name: string | null;
  tool_input_preview: string | null;
  result_preview: string | null;
}

export interface FlowEventRow {
  id: number;
  node_id: string;
  event_type: string;
  raw_json: string;
  seq: number;
}

export interface FlowSummaryRow {
  id: string;
  session_id: string;
  title: string;
  content: string;
  node_refs: string;
  created_at: number;
}

export class FlowStore {
  private db: Database;

  constructor(dbPath?: string) {
    const resolved = dbPath || process.env.FLOW_DB_PATH || DEFAULT_DB_PATH;
    const dir = path.dirname(resolved);
    require('fs').mkdirSync(dir, { recursive: true });
    this.db = new Database(resolved);
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flow_sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        model TEXT DEFAULT '',
        status TEXT DEFAULT 'running',
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS flow_nodes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        phase TEXT,
        tool_name TEXT,
        tool_input_preview TEXT,
        result_preview TEXT,
        FOREIGN KEY (session_id) REFERENCES flow_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_session ON flow_nodes(session_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON flow_nodes(parent_id);

      CREATE TABLE IF NOT EXISTS flow_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        seq INTEGER NOT NULL,
        FOREIGN KEY (node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_events_node ON flow_events(node_id);

      CREATE TABLE IF NOT EXISTS flow_summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        node_refs TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES flow_sessions(id) ON DELETE CASCADE
      );
    `);
  }

  /**
   * Delete a session and all related data (cascades via foreign keys)
   */
  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM flow_sessions WHERE id = ?').run(id);
  }

  createSession(id: string, prompt: string, model: string): void {
    this.db.prepare(
      'INSERT INTO flow_sessions (id, prompt, model, status, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, prompt, model, 'running', Date.now());
  }

  insertNode(
    nodeId: string,
    sessionId: string,
    type: string,
    summary: string,
    phase: string | null,
    toolName?: string,
    inputPreview?: string,
    resultPreview?: string,
    parentId?: string
  ): void {
    // Use INSERT with conflict handling to avoid accidental overwrites
    // If node exists with same ID, update it; otherwise insert
    const existing = this.db.prepare('SELECT id FROM flow_nodes WHERE id = ?').get(nodeId);
    if (existing) {
      // Update existing node (preserving timestamp)
      this.db.prepare(
        `UPDATE flow_nodes SET
         session_id = ?, parent_id = ?, type = ?, summary = ?, phase = ?,
         tool_name = ?, tool_input_preview = ?, result_preview = ?
         WHERE id = ?`
      ).run(sessionId, parentId ?? null, type, summary, phase, toolName ?? null, inputPreview ?? null, resultPreview ?? null, nodeId);
    } else {
      this.db.prepare(
        `INSERT INTO flow_nodes
         (id, session_id, parent_id, type, timestamp, summary, phase, tool_name, tool_input_preview, result_preview)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(nodeId, sessionId, parentId ?? null, type, Date.now(), summary, phase, toolName ?? null, inputPreview ?? null, resultPreview ?? null);
    }
  }

  insertEvent(nodeId: string, eventType: string, rawJson: string, seq: number): void {
    this.db.prepare(
      'INSERT INTO flow_events (node_id, event_type, raw_json, seq) VALUES (?, ?, ?, ?)'
    ).run(nodeId, eventType, rawJson, seq);
  }

  updateSessionStatus(id: string, status: string, endedAt?: number): void {
    this.db.prepare(
      'UPDATE flow_sessions SET status = ?, ended_at = ? WHERE id = ?'
    ).run(status, endedAt ?? null, id);
  }

  insertSummary(sessionId: string, title: string, content: string, nodeRefs: string[]): void {
    // Use crypto.randomUUID for collision-resistant ID generation
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `sum_${crypto.randomUUID()}`
      : `sum_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    this.db.prepare(
      'INSERT INTO flow_summaries (id, session_id, title, content, node_refs, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, sessionId, title, content, JSON.stringify(nodeRefs), Date.now());
  }

  getAllSessions(): FlowSessionRow[] {
    return this.db.prepare(
      'SELECT * FROM flow_sessions ORDER BY started_at DESC'
    ).all() as FlowSessionRow[];
  }

  getSession(sessionId: string): { session: FlowSessionRow | null; nodes: FlowNodeRow[]; summaries: FlowSummaryRow[] } {
    const session = this.db.prepare(
      'SELECT * FROM flow_sessions WHERE id = ?'
    ).get(sessionId) as FlowSessionRow | null;
    const nodes = this.db.prepare(
      'SELECT * FROM flow_nodes WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId) as FlowNodeRow[];
    const summaries = this.db.prepare(
      'SELECT * FROM flow_summaries WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as FlowSummaryRow[];
    return { session, nodes, summaries };
  }

  getNodeEvents(nodeId: string): FlowEventRow[] {
    return this.db.prepare(
      'SELECT * FROM flow_events WHERE node_id = ? ORDER BY seq ASC'
    ).all(nodeId) as FlowEventRow[];
  }

  close(): void {
    this.db.close();
  }
}
