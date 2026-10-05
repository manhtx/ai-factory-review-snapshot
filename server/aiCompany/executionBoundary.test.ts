import { expect, it } from 'vitest'; import { classifyChangedFiles } from './executionBoundary';
it('rejects control-plane changes outside the assigned write area',()=>{expect(classifyChangedFiles('/repo',['work/a.ts','.ai-company/runtime/q.jsonl'],['work'])).toEqual({authorized:['work/a.ts'],unauthorized:['.ai-company/runtime/q.jsonl']});});
