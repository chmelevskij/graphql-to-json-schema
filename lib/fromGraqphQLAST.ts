/**
 * This takes in the AST generated from schema language. Examples of that would be
 * the output of `graphql-tag` or similar tools which would parse SDL.
 */
import { NameNode , NamedTypeNode, DocumentNode, SelectionNode, SelectionSetNode, VariableDefinitionNode, ArgumentNode, VariableNode, IntValueNode, FloatValueNode, StringValueNode, BooleanValueNode, ValueNode, DefinitionNode, OperationDefinitionNode, ObjectTypeDefinitionNode, FieldDefinitionNode, TypeNode } from 'graphql';
import { JSONSchema6 } from 'json-schema';
import { GraphQLTypeNames, typesMapping } from './typesMapping';

/**
 * Preliminary implementation for the GraphQL specific schema.
 * NOTE: TS indexable types only support member of the same type,
 * but since empty object or boolean is valid `JSONSchema6` we can use that.
 * This means that even though those properties are optional they have to be provided.
 */
interface GQLJSONSchema6 extends JSONSchema6 {
  properties?: {
    [k: string]: boolean | GraphQLJSONSchema6 | JSONSchema6;
    variables: boolean | GraphQLJSONSchema6 | JSONSchema6;
    selections: GraphQLJSONSchema6 | JSONSchema6;

    arguments: boolean | GraphQLJSONSchema6 | JSONSchema6;
    return: boolean | GraphQLJSONSchema6 | JSONSchema6; // TODO: this is defined as `type` in AST
  };
  definitions?: {
    [k: string]: boolean | GraphQLJSONSchema6 | JSONSchema6;
  };
}

export type GraphQLJSONSchema6 = GQLJSONSchema6 | JSONSchema6;

interface NamedMemo {
  name: string;
  selectionSet: SelectionSetNode;
}

type PrimitiveValueNode =
| IntValueNode
| FloatValueNode
| StringValueNode
| BooleanValueNode;


function isPrimitiveValueNode(node?: ValueNode): node is PrimitiveValueNode {
  if(node === undefined) return false;
  if('value' in node) return true;
  return false;
}

const getName = <T extends { name: NameNode }>(node: T): string => node.name.value;

function getVariables(variableDefinitions: readonly VariableDefinitionNode[]) {

  const variables: JSONSchema6 = {
    type: 'object',
    required: [],
    additionalProperties: false,
  };

  // TODO: start with the primitives
  if (variableDefinitions.length === 0) {
    return false;
  }

  const properties = variableDefinitions.reduce<JSONSchema6['properties']>((acc = {}, v) => {
    switch (v.type.kind) {
      // TODO: rescursive search for definitions
      case 'NamedType':
        acc[`$${getName(v.variable)}`] = {
          type: typesMapping[<GraphQLTypeNames>getName(v.type)],
          ...(isPrimitiveValueNode(v.defaultValue) && { default: v.defaultValue.value }),
        };
        return acc;
      case 'ListType':
        return acc;
      case 'NonNullType':
        if (v.type.type.kind === 'NamedType') {
          acc[`$${getName(v.variable)}`] = {
            type:
              typesMapping[
              <GraphQLTypeNames>getName(v.type.type)
              ]
          };
        }
        variables.required!.push(`$${getName(v.variable)}`);
        return acc;
      default:
        const exhaustive: never = v.type;
        return exhaustive;
    }
  }, {});

  variables.properties = properties;
  return variables;
}

interface Args {
  args: ReadonlyArray<ArgumentNode>;
  name: string;
}

function getArgs({ args, name }: Args) {
  const argObject: JSONSchema6 = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  };

  const properties = args.reduce((acc, { value , name: argName }) => {
    if(value.kind === 'Variable' ) {
      acc[argName.value] = { "$ref": `#/properties/${name}/properties/variables/properties/$${getName(value)}` }
    }
    return acc;
  }, {} as any)

  argObject.properties = properties;
  return argObject;
}

function getSelectionTree({ selectionSet, name }: NamedMemo, schemaMemo: any = {}): any {
  return selectionSet.selections.reduce((acc, selection) => {
    switch (selection.kind) {
      case 'Field':
        let result = {};
        if (!selection.selectionSet && (selection.arguments && selection.arguments.length === 0)) {
          acc[getName(selection)] = result
          return acc;
        }

        let args = {};
        let selections = {};

        if (selection.arguments && selection.arguments.length > 0) {
          args = getArgs({ name, args: selection.arguments });
        }

        if (selection.selectionSet) {
          selections = {
            type: 'object',
            additionalProperties: false,
            required: [],
            properties: {
              ...getSelectionTree({ selectionSet: selection.selectionSet, name })
            }
          }
        }

        acc[getName(selection)] = {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            selections,
            arguments: args,
          }
        }

        return acc;
      case 'FragmentSpread':
        console.warn('FragmentSpread parsing not yet implemented')
        return acc;
      case 'InlineFragment':
        console.warn('InlineFragment parsing not yet implemented')
        return acc;
      default:
        return acc;
    }
  }, schemaMemo);
}

function getSelections({ selectionSet, name }: NamedMemo) {
  const selections: JSONSchema6 = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  };

  if (selectionSet.selections.length === 0) {
    return selections;
  }

  const properties = getSelectionTree({ selectionSet, name });

  return {
    ...selections,
    properties,
  };

}

/**
 * Given `DocumentNode` used in client generate schema. 
 * @param ASTNode parsed graphql query or mutation from SDL
 */
export const fromOperationASTNode = (
  ASTNode: OperationDefinitionNode,
): GraphQLJSONSchema6 => {

  // name can be undefined. Since graphql supports unnamed ones
  if (ASTNode.name) {
    const name = ASTNode.name.value;
    let variables = {};
    if (ASTNode.variableDefinitions) {
      variables = getVariables(ASTNode.variableDefinitions);
    }

    const selections = getSelections({ selectionSet: ASTNode.selectionSet, name });

    return {
      $schema: 'http://json-schema.org/draft-06/schema#',
      properties: {
        [name]: {
          type: 'object',
          properties: {
            variables,
            selections,
          },
          additionalProperties: false,
        }
      }
    };
  }

  throw new Error('Please provide named Operation query');
};

// Inspired by https://github.com/jakubfiala/graphql-json-schema
function getPropertyType(field: TypeNode): JSONSchema6 {
  switch (field.kind) {
    case 'ListType':
      return {
        type: 'array',
        items: getPropertyType(field.type),
      };

    case 'NonNullType':
      return getPropertyType(field.type); // TODO: handle required
    
    case 'NamedType':
      const typeName = <GraphQLTypeNames>getName(field);
      if(typeName in typesMapping) {
        return {
          type: typesMapping[typeName],
        }
      }
      return {}
  
    default:
      const n: never = field;
      return n;
  }
}

function fieldToProperty(acc: JSONSchema6["properties"], field: FieldDefinitionNode): JSONSchema6['properties'] {
  return {
    ...acc,
    [getName(field)]: getPropertyType(field.type),
  }
};

const getRequiredFields = (fields: ReadonlyArray<FieldDefinitionNode> = []): string[] =>
  fields.reduce<string[]>((acc, field) => {
    if (field.type.kind === 'NonNullType') {
      return [...acc, getName(field)];
    }
    return acc
  }, []);

export const fromObjectTypeDefinition = (node: ObjectTypeDefinitionNode): GraphQLJSONSchema6 => {
  const properties = node.fields
    ? node.fields.reduce<JSONSchema6["properties"]>(fieldToProperty, {})
    : {};

  const required = getRequiredFields(node.fields);

  return {
    $schema: 'http://json-schema.org/draft-06/schema#',
    definitions: {
      [getName(node)]: {
        properties,
        required,
        type: 'object',
      }
    }
  };
}
