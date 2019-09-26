/**
 * This takes in the AST generated from schema language. Examples of that would be
 * the output of `graphql-tag` or similar tools which would parse SDL.
 */
import { DocumentNode, SelectionNode, SelectionSetNode, VariableDefinitionNode, ArgumentNode } from 'graphql';
import { JSONSchema6 } from 'json-schema';
import { GraphQLTypeNames, typesMapping } from './typesMapping';

const a: JSONSchema6 = {};

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
        acc[`$${v.variable.name.value}`] = {
          type: typesMapping[<GraphQLTypeNames>v.type.name.value]
        };
        return acc;
      case 'ListType':
        return acc;
      case 'NonNullType':
        if (v.type.type.kind === 'NamedType') {
          acc[`$${v.variable.name.value}`] = {
            type:
              typesMapping[
              <GraphQLTypeNames>v.type.type.name.value
              ]
          };
        }
        variables.required!.push(`$${v.variable.name.value}`);
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
      acc[argName.value] = { "$ref": `#/definitions/${name}/properties/variables/properties/$${value.name.value}` }
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
          acc[selection.name.value] = result
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

        acc[selection.name.value] = {
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
 * @param documentNode parsed graphql query or mutation from SDL
 */
export const fromOperationAST = (
  documentNode: DocumentNode
): GraphQLJSONSchema6 => {
  const ASTNode = documentNode.definitions[0];

  // name can be undefined. Since graphql supports unnamed ones
  if (ASTNode.kind === 'OperationDefinition' && ASTNode.name) {
    const name = ASTNode.name.value;
    let variables = {};
    if (ASTNode.variableDefinitions) {
      variables = getVariables(ASTNode.variableDefinitions);
    }

    const selections = getSelections({ selectionSet: ASTNode.selectionSet, name });

    return {
      $schema: 'http://json-schema.org/draft-06/schema#',
      properties: {},
      definitions: {
        [name]: {
          type: 'object',
          properties: {
            variables,
            selections, // TODO: this matches anything atm
          },
          additionalProperties: false,
        }
      }
    };
  }

  throw new Error('Please provide named Operation query');
};
