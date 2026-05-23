import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';

import propsExplicitUndefined from '../props-explicit-undefined.js';

const RULE_ID = 'vorbis/props-explicit-undefined';

const flatConfig = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      vorbis: {
        rules: {
          'props-explicit-undefined':
            propsExplicitUndefined as unknown as Linter.RuleModule,
        },
      },
    },
    rules: { [RULE_ID]: 'error' as const },
  },
];

function lint(code: string) {
  return new Linter().verify(code, flatConfig, { filename: 'test.tsx' });
}

function fix(code: string) {
  return new Linter().verifyAndFix(code, flatConfig, { filename: 'test.tsx' });
}

describe('props-explicit-undefined', () => {
  describe('valid', () => {
    it('interface with explicit | undefined is clean', () => {
      // #given a *Props interface declaring optional with `| undefined`
      const code = `interface FooProps { bar?: string | undefined }`;
      // #then no diagnostics fire
      expect(lint(code)).toHaveLength(0);
    });

    it('required field is not flagged', () => {
      const code = `interface FooProps { bar: string }`;
      expect(lint(code)).toHaveLength(0);
    });

    it('non-matching interface name is ignored', () => {
      const code = `interface CacheEntry { bar?: string }`;
      expect(lint(code)).toHaveLength(0);
    });

    it('styled with explicit undefined is clean', () => {
      const code = `const X = styled.div<{ $active?: boolean | undefined }>\`\`;`;
      expect(lint(code)).toHaveLength(0);
    });

    it('domain models with same shape but non-Props name pass', () => {
      const code = `interface MediaTrack { albumId?: string }`;
      expect(lint(code)).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('reports bare optional on FooProps and adds | undefined', () => {
      // #given an interface named *Props with bare optional
      const code = `interface FooProps { bar?: string }`;
      // #when running the rule with auto-fix
      const result = fix(code);
      // #then the output gains `| undefined`
      expect(result.fixed).toBe(true);
      expect(result.output).toBe(`interface FooProps { bar?: string | undefined }`);
    });

    it('reports Use*Props interfaces', () => {
      const code = `interface UseFooProps { cb?: () => void }`;
      const result = fix(code);
      expect(result.fixed).toBe(true);
      // Function types must be parenthesised before union
      expect(result.output).toBe(`interface UseFooProps { cb?: (() => void) | undefined }`);
    });

    it('reports *Value interfaces (context value pattern)', () => {
      const code = `interface FooValue { count?: number }`;
      const result = fix(code);
      expect(result.fixed).toBe(true);
      expect(result.output).toBe(`interface FooValue { count?: number | undefined }`);
    });

    it('reports inline styled.x type args', () => {
      const code = `const X = styled.div<{ $active?: boolean }>\`\`;`;
      const result = fix(code);
      expect(result.fixed).toBe(true);
      expect(result.output).toBe(`const X = styled.div<{ $active?: boolean | undefined }>\`\`;`);
    });

    it('reports styled(component)<{...}> call form', () => {
      const code = `const X = styled('div')<{ $on?: boolean }>\`\`;`;
      const result = fix(code);
      expect(result.fixed).toBe(true);
      expect(result.output).toBe(`const X = styled('div')<{ $on?: boolean | undefined }>\`\`;`);
    });

    it('emits one violation per offending field', () => {
      const code = `interface FooProps { a?: string; b: number; c?: number }`;
      const diagnostics = lint(code);
      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.ruleId === RULE_ID)).toBe(true);
    });
  });
});
