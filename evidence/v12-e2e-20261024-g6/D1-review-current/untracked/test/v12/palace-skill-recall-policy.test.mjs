import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const skillPath=fileURLToPath(new URL('../../skills/palace-cli/SKILL.md',import.meta.url));

test('Palace Skill uses one bounded recall before broad incident inspection and abstains on no match',async()=>{
  const text=await fs.readFile(skillPath,'utf8');
  assert.match(text,/before broad workspace\/archive\/log inspection/i);
  assert.match(text,/run one bounded `palace search`/i);
  assert.match(text,/If nothing relevant is returned[\s\S]*do not keep searching Palace/i);
  assert.match(text,/exact `validated` procedure[\s\S]*avoid a broad archive scan/i);
  assert.match(text,/Verify the current target\/postcondition independently/i);
  assert.match(text,/Do not recall for self-contained formatting\/limits or clearly novel work/i);
});
