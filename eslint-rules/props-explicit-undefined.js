import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const DEFAULT_INTERFACE_NAME_PATTERN = '^(.*Props|Use.*Props|.*Value)$';

function isUndefinedInUnion(typeNode) {
  if (typeNode.type === 'TSUndefinedKeyword') return true;
  if (typeNode.type === 'TSUnionType') {
    return typeNode.types.some((t) => t.type === 'TSUndefinedKeyword');
  }
  return false;
}

function isStyledTag(tagNode) {
  if (!tagNode) return false;
  if (tagNode.type === 'MemberExpression') {
    return (
      tagNode.object.type === 'Identifier' &&
      tagNode.object.name === 'styled'
    );
  }
  if (tagNode.type === 'CallExpression') {
    return (
      tagNode.callee.type === 'Identifier' &&
      tagNode.callee.name === 'styled'
    );
  }
  return false;
}

function buildFix(fixer, node, sourceCode) {
  const typeNode = node.typeAnnotation && node.typeAnnotation.typeAnnotation;
  if (!typeNode) return null;
  if (typeNode.type === 'TSFunctionType') {
    const original = sourceCode.getText(typeNode);
    return fixer.replaceText(typeNode, `(${original}) | undefined`);
  }
  return fixer.insertTextAfter(typeNode, ' | undefined');
}

const propsExplicitUndefined = createRule({
  name: 'props-explicit-undefined',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Optional fields on React component prop interfaces, hook option-bag interfaces, ' +
        'context value interfaces, and inline styled-component type arguments must be declared ' +
        'as `field?: T | undefined` so EOPT permits the canonical `prop={cond ? x : undefined}` pattern.',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          interfaceNamePattern: { type: 'string' },
          includeStyledTypeArgs: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUndefined:
        'Optional field `{{field}}` on `{{kind}}` must include `| undefined` in its type. ' +
        'See CLAUDE.md "Type strictness baseline" for the convention.',
    },
  },
  defaultOptions: [
    {
      interfaceNamePattern: DEFAULT_INTERFACE_NAME_PATTERN,
      includeStyledTypeArgs: true,
    },
  ],
  create(context, [options]) {
    const namePattern = new RegExp(
      (options && options.interfaceNamePattern) || DEFAULT_INTERFACE_NAME_PATTERN,
    );
    const includeStyled =
      !options || options.includeStyledTypeArgs !== false;
    const sourceCode = context.sourceCode || context.getSourceCode();

    function fieldName(node) {
      const key = node.key;
      if (!key) return '<anonymous>';
      if (key.type === 'Identifier') return key.name;
      if (key.type === 'Literal') return String(key.value);
      return sourceCode.getText(key);
    }

    function report(node, kind) {
      if (!node.optional) return;
      const annotation = node.typeAnnotation && node.typeAnnotation.typeAnnotation;
      if (!annotation) return;
      if (isUndefinedInUnion(annotation)) return;
      context.report({
        node,
        messageId: 'missingUndefined',
        data: { field: fieldName(node), kind },
        fix(fixer) {
          return buildFix(fixer, node, sourceCode);
        },
      });
    }

    const listeners = {
      [`TSInterfaceDeclaration[id.name=/${namePattern.source}/] > TSInterfaceBody > TSPropertySignature[optional=true]`](
        node,
      ) {
        const interfaceDecl = node.parent && node.parent.parent;
        const interfaceName =
          interfaceDecl && interfaceDecl.id ? interfaceDecl.id.name : 'interface';
        report(node, interfaceName);
      },
    };

    if (includeStyled) {
      listeners[
        'TaggedTemplateExpression > TSTypeParameterInstantiation > TSTypeLiteral > TSPropertySignature[optional=true]'
      ] = (node) => {
        const typeLiteral = node.parent;
        const typeParams = typeLiteral && typeLiteral.parent;
        const tagged = typeParams && typeParams.parent;
        if (!tagged || tagged.type !== 'TaggedTemplateExpression') return;
        if (!isStyledTag(tagged.tag)) return;
        report(node, 'styled type args');
      };
    }

    return listeners;
  },
});

export default propsExplicitUndefined;
