/**
 * This takes in the AST generated from schema language. Examples of that would be
 * the output of `graphql-tag` or similar tools which would parse SDL.
 */
import { GraphQLSchema, DocumentNode } from 'graphql';
import { JSONSchema6, JSONSchema6TypeName } from 'json-schema';
import { typesMapping, GraphQLTypeNames } from './typesMapping';

const a: JSONSchema6 = {}

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
        selections: boolean | GraphQLJSONSchema6 | JSONSchema6;

        arguments: boolean | GraphQLJSONSchema6 | JSONSchema6;
        return: boolean | GraphQLJSONSchema6 | JSONSchema6; // TODO: this is defined as `type` in AST
    },
    definitions?: {
        [k: string]: boolean | GraphQLJSONSchema6 | JSONSchema6;
    }
}

export type GraphQLJSONSchema6 = GQLJSONSchema6 | JSONSchema6;

const getVariables = (documentNode: DocumentNode) => {
    // TODO: need to parse multiple definitions
    const firstLevel = documentNode.definitions[0];    

    if(firstLevel.kind === 'OperationDefinition') {
        const variables: JSONSchema6 = {
            type: 'object',
            required: [],
            additionalProperties: false,
        };

        // TODO: start with the primitives
        if(!firstLevel.variableDefinitions) return false;
        if(firstLevel.variableDefinitions.length === 0) return false;

        const properties = firstLevel.variableDefinitions.reduce<JSONSchema6["properties"]>((acc = {}, v) => { 
            switch (v.type.kind) {
                case 'NamedType':
                    acc[`$${v.variable.name.value}`] = { type: typesMapping[<GraphQLTypeNames>v.type.name.value]};
                    return acc;
                case 'ListType':
                    return acc;
                case 'NonNullType':
                    // TODO: this will be required part
                    return acc;
                default:
                    const exhaustive: never = v.type;
                    return exhaustive;
            }
        }, {});

        variables.properties = properties;
        return variables;
    }
    return {}
};
    
export const fromGraphQLAST = (documentNode: DocumentNode): GraphQLJSONSchema6 => {
    // TODO: implement.
    return {
        $schema: 'http://json-schema.org/draft-06/schema#',
        properties: {
            variables: getVariables(documentNode),
            selections: false
        },
        definitions: {},
    };
};
