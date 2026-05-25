/**
 * Claude spawn context for /llm-wiki — project root for skill discovery + wiki dir for writes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveWikiRoot } from '../../data/env';

/** Repo root (where .claude/skills/llm-wiki lives). */
export function resolveProjectRoot(): string {
  const fromEnv = process.env.FLOW_ROOT_DIR || process.env.FLOW_PROJECT_DIR;
  if (fromEnv) return fromEnv;

  let dir = process.cwd();
  for (let depth = 0; depth < 4; depth += 1) {
    const skillLink = path.join(dir, '.claude', 'skills', 'llm-wiki');
    const skillSource = path.join(dir, 'skills', 'llm-wiki', 'SKILL.md');
    if (fs.existsSync(skillLink) || fs.existsSync(skillSource)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function resolveWikiClaudeCwd(): string {
  return resolveProjectRoot();
}

/** Directories passed to Claude --add-dir for wiki agent runs. */
export function resolveWikiAgentAddDirs(wikiRoot?: string): string[] {
  const projectRoot = resolveProjectRoot();
  const wiki = wikiRoot ?? resolveWikiRoot();
  const dirs = [projectRoot, wiki];
  const skillLink = path.join(projectRoot, '.claude', 'skills', 'llm-wiki');
  if (fs.existsSync(skillLink)) {
    return dirs;
  }
  const skillSource = path.join(projectRoot, 'skills', 'llm-wiki');
  if (fs.existsSync(path.join(skillSource, 'SKILL.md'))) {
    dirs.push(skillSource);
  }
  return dirs;
}
