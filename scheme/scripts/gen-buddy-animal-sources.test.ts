import { describe, expect, it } from 'bun:test';

import { redactApiErrorBody } from './gen-buddy-animal-sources';

describe('gen-buddy-animal-sources', () => {
  it('redacts OpenAI API keys from image generation errors', () => {
    const body = 'Incorrect API key provided: sk-live_1234567890abcdef. Check your account.';

    expect(redactApiErrorBody(body)).toBe(
      'Incorrect API key provided: sk-[redacted]. Check your account.',
    );
  });
});
