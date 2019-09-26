import { parse } from 'graphql/language/parser';
import { JSONSchema6 } from 'json-schema';
import { fromOperationAST, GraphQLJSONSchema6 } from '../lib/fromGraqphQLAST';

/**
 * There are 2 main approaches to structuring the corresponding schema:
 * 1. create schema with properties as the main arguments for the top level function E.G.
 *    like in `mutation1SchemaWithProperties`
 * 2. create only definitions from the mutation
 * 
 * Both approaches would need to be able to be merged/reference the root schema
 * 
 * At the moment schema will fail if additional properties are specified. Graphql
 * queries on the other hand fail if additional fields are provided. Need to verify but most likely
 * this would need `additionalProperties` added o al lthe objects and etc.
 * 
 * 
 */
const mutation1 = `
mutation CreateObjectWithName($name: String!) {
    createObject(input: {name: $name, age: 66, color: "black"}  ) {
        object {
            id
            name
        }
    }
}
`;

const mutation1SchemaWithProperties: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    properties: {
        variables: {
            type: 'object',
            properties: {
                $name: { $ref: '#/definitions/$name' },
            },
            required: ['$name'],
        },
        selections: {
            // TODO: selections is the term used in gql AST, other implementation users return
            type: 'object',
            properties: {
                createObject: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            properties: {
                                input: {
                                    type: 'object',
                                    properties: {
                                        name: { $ref: '#/definitions/$name' }, // TODO: this should reference the variable from here
                                        age: { type: 'number', default: 66 },
                                        color: { type: 'string', default: 'black' },
                                    }
                                }
                            }
                        },
                        // TODO: Selections on the type from the actual types from previous definitions
                        selections: {
                            type: 'object',
                            properties: {
                                object: {
                                    type: 'object',
                                    properties: {
                                        // TODO: these should come from refs from te gql 2 schema
                                        id: { type: 'string' },
                                        name: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    definitions: {
        $name: { type: 'string' }, // TODO: verify the $ is safe to use in jsonSchema keys
    }
};

const mutation1Schema: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    definitions: {
        CreateObjectWithName: {
            type: 'object',
            properties: {
                variables: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                    },
                    required: ['name']
                },
                selections: { // TODO: selections is the term used in gql AST, other implementation users return
                    type: 'object',
                    properties: {
                        createObject: {
                            type: 'object',
                            properties: {
                                arguments: {
                                    type: 'object',
                                    properties: {
                                        input: {
                                            type: 'object',
                                            properties: {
                                                name: { type: 'string' }, // TODO: this should reference the variable from here
                                                age: { type: 'number', default: 66 },
                                                color: { type: 'string', default: 'black' },
                                            }
                                        }
                                    }
                                },
                                // TODO: Selections on the type from the actual types from previous definitions
                                selections: {
                                    type: 'object',
                                    properties: {
                                        object: {
                                            type: 'object',
                                            properties: {
                                                // TODO: these should come from refs from te gql 2 schema
                                                id: { type: 'string' },
                                                name: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

const mutation2 = `
mutation removeRecipe {
  removeRecipe(id:"1")
}
`;

// TODO: what needs to be done with missing properties?
const mutation2Schema: GraphQLJSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    properties: {
        variables: {},
        selections: {
            type: 'object',
            properties: {
                removeRecipe: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                            },
                            required: [],
                        },
                        selections: {
                            type: 'object',
                            properties: {
                                removeRecipe: {
                                    type: 'object',
                                    properties: {
                                        arguments: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', default: '1' }
                                            },
                                            required: [],
                                        }
                                    }
                                }
                            }
                        },
                    }
                },
            },
        },
    },
    definitions: {},
};

const mutation3 = `
mutation addRecipe{
  addRecipe (newRecipeData:{
    title: "TOMTOM",
    description:"very good"
    ingredients:["miau"]
  }) {
    id
  }
}   
`;

const mutation3Schema: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    properties: {
        variables: {}, // TODO: does this need to say it's an object?
        selections: {
            type: 'object',
            properties: {
                addRecipe: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            properties: {
                                newRecipeData: {
                                    type: 'object',
                                    properties: {
                                        title: {
                                            type: 'string', // TODO: how to get the type from the query? Maybe use `typeof` or just set default???
                                            default: 'TOMTOM',
                                        },
                                        description: { default: 'very good' },
                                        ingredients: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        }
                                    }
                                }
                            },
                        },
                        selections: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                            }
                        }
                    }
                }
            },
        },
    },
    definitions: {},
};

/**
 * When variables are used they are passed in into the mutation.
 * Usually the mutation would have it's types comming from introspection query, so
 * we would know the types already. What we are actually interested in is the reference from
 * mutation arguments to the client query variables. Does JSONSchema support that?
 */
let query = `query RollDice($dice: Int!, $sides: Int) {
  rollDice(numDice: $dice, numSides: $sides)
}`;

const querySchema: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    properties: {
        variables: {
            type: 'object',
            properties: {
                $dice: { $ref: '#/definitions/$dice' },
                $sides: { $ref: '#/definitions/$sides' }
            },
            required: ['$dice']
        },
        selections: {
            type: 'object',
            properties: {
                rollDice: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            properties: {
                                // TODO: these are actually types in here, but te query itself talks about the values, need to make sure they mean the same thing and rferecne each other. Need to verify with schema
                                numDice: { $ref: '#/definitions/$dice' },
                                numSides: { $ref: '#/definitions/$sides' }
                            }
                        }
                    }
                }
            }
        }
    },
    definitions: {
        // TODO: these prefixes might clash with the schema keywords, need to verify
        $dice: { type: 'integer' },
        $sides: { type: 'integer' },
    },
};

const mutationWithReservedSchemaWords = `mutation someMutation($id: Int, $schema: SomeType, $ref: String!) {
   createSomething(id: $id, schema: $schema, ref: $ref)
}`;

/**
 * in regards of the keywords,  this seem to validate just find with the reserved keywords.
 * The fact that they are at differen levels helps here.
 */
const mutationWithReservedSchemaWordsSchema: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    properties: {
        variables: {
            type: 'object',
            properties: {
                $id: { $ref: '#/definitions/$id' },
                $schema: { $ref: '#/definitions/$schema' },
                $ref: { $ref: '#/definitions/$ref' },
            },
            required: ['$ref']
        },
        selections: {
            type: 'object',
            properties: {
                createSomething: {
                    type: 'object',
                    properties: {
                        // NOTE: technically we already know the types from the introspection,
                        // Would need to just bind them to variables somehow.
                        variables: {
                            type: 'object',
                            properties: {
                                id: { $ref: '#/definitions/$id' },
                                schema: { $ref: '#/definitions/$schema' },
                                ref: { $ref: '#/definitions/$ref' },
                            },
                            additionalProperties: false,
                        }
                    }
                }
            }
        }
    },
    definitions: {
        $id: { type: 'integer' },
        $schema: { $ref: '#/some/link/to/schema' },
        $ref: { type: 'string' },
    },
};

/**
 * Another option for work with variables is assigning $id to the definition and using that.
 */

const mutatoinWithId = `
 mutation WithID($name: String) {
     hello(name: $name)
 }
 `;

const mutatoinWithIdSchema: JSONSchema6 = {
    $schema: 'http://json-schema.org/draft-06/schema#',
    type: 'object',
    properties: {
        variables: {
            type: 'object',
            properties: {
                $name: {
                    $id: '$name',
                    type: 'string',
                },
            },
            additionalProperties: false,
            required: []
        },
        selections: {
            type: 'object',
            properties: {
                hello: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            properties: {
                                name: { $ref: '#name' },
                            },
                            required: [],
                        }
                    }
                }
            }
        }
    }
};

// TODO: need to parse default variables as well.

const printJSON = (v: any) => console.log(JSON.stringify(v, null, 2));

import * as ajv from 'ajv';

function runTest(sdl: string, expectedSchema: JSONSchema6) {
    const ast = parse(sdl);
    const result = fromOperationAST(ast);
    expect(result).toMatchObject(expectedSchema);
    const validator = new ajv();
    validator.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
    expect(validator.validateSchema(result)).toBe(true);
}

describe('fromGraphQLAST', () => {
    test('parses the primitive variables', () => {

        const primitivesVariables = `
        mutation removeRecipe($a: String, $b: Int, $c: Float, $d: Boolean, $e: ID){
            miau
        }
        `;

        /**
         * the end result will be put in definitions, because it will have to be merged
         * with the rest of the schema.
         * NOTE: GraphQL, `Document` has `ExecutableDefinition`, `TypeSystemDefinition` fields
         * current implementation only understands `TypeSystemDefinition`, and treats that as top level schema.
         * this should be fixed and top level should have operations and schema `properties` at the top
         * this could also work by referencing every serparately.
         */
        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                removeRecipe: {
                    type: 'object',
                    properties: {
                        variables: {
                            type: 'object',
                            properties: {
                                $a: { type: 'string' },
                                $b: { type: 'number' },
                                $c: { type: 'number' },
                                $d: { type: 'boolean' },
                                $e: { type: 'string' }
                            },
                            additionalProperties: false,
                            required: []
                        },
                        selections: {
                            type: 'object',
                            properties: {
                                miau: {},
                            },
                            additionalProperties: false,
                        }
                    }
                }
            }
        };

        runTest(primitivesVariables, primitivesVariablesSchema)
    });

    test('parses the primitive variables with required variables', () => {

        const primitivesVariables = `
        mutation removeRecipe($a: String!, $b: Int!, $c: Float!, $d: Boolean!, $e: ID!){
            miau
        }
        `;

        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                removeRecipe: {
                    type: 'object',
                    properties: {
                        variables: {
                            type: 'object',
                            properties: {
                                $a: { type: 'string' },
                                $b: { type: 'number' },
                                $c: { type: 'number' },
                                $d: { type: 'boolean' },
                                $e: { type: 'string' }
                            },
                            additionalProperties: false,
                            required: ['$a', '$b', '$c', '$d', '$e'],
                        },
                        selections: {
                            type: 'object',
                            properties: {
                                miau: {},
                            },
                            additionalProperties: false,
                        }
                    }
                }
            }
        };

        runTest(primitivesVariables, primitivesVariablesSchema)
    });

    test('Parses selections without definitions', () => {
        const simpleSelection = `
            mutation A {
                b
            }
        `;

        const simpleSelectionSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                A: {
                    type: 'object',
                    properties: {
                        variables: false,
                        // TODO: match selection
                        selections: {
                            type: 'object',
                            properties: {
                                b: {},
                            },
                            additionalProperties: false,
                        }
                    },
                    additionalProperties: false,
                }
            }
        };

        runTest(simpleSelection, simpleSelectionSchema);
    });

    test('Nested selections recursivelly', () => {
        const simpleSelection = `
            mutation A {
                b {
                    c {
                        d
                    }
                }
            }
        `;

        const simpleSelectionSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                A: {
                    type: 'object',
                    properties: {
                        variables: false,
                        selections: {
                            type: 'object',
                            additionalProperties: false,
                            required: [],
                            properties: {
                                b: {
                                    type: 'object',
                                    required: [],
                                    additionalProperties: false,
                                    properties: {
                                        selections: {
                                            type: 'object',
                                            required: [],
                                            additionalProperties: false,
                                            properties: {
                                                c: {
                                                    type: 'object',
                                                    required: [],
                                                    additionalProperties: false,
                                                    properties: {
                                                        selections: {
                                                            type: 'object',
                                                            required: [],
                                                            additionalProperties: false,
                                                            properties: {
                                                                d: {},
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        }
                    },
                    additionalProperties: false,
                }
            }
        };

        runTest(simpleSelection, simpleSelectionSchema)
    });

    test('Multiple Nested selections recursivelly', () => {
        const simpleSelection = `
            mutation A {
                b {
                    c {
                        d
                    }
                }
                x {
                    y {
                        z
                        q
                    }
                }
            }
        `;

        const simpleSelectionSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                A: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        variables: false,
                        // TODO: match selection
                        selections: {
                            type: 'object',
                            additionalProperties: false,
                            required: [],
                            properties: {
                                b: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: [],
                                    properties: {
                                        selections: {
                                            type: 'object',
                                            additionalProperties: false,
                                            required: [],
                                            properties: {
                                                c: {
                                                    type: 'object',
                                                    additionalProperties: false,
                                                    required: [],
                                                    properties: {
                                                        selections: {
                                                            type: 'object',
                                                            additionalProperties: false,
                                                            required: [],
                                                            properties: {
                                                                d: {}
                                                            }
                                                        }
                                                    },
                                                }
                                            },
                                        },
                                    },
                                },
                                x: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: [],
                                    properties: {
                                        selections: {
                                            type: 'object',
                                            additionalProperties: false,
                                            required: [],
                                            properties: {
                                                y: {
                                                    type: 'object',
                                                    additionalProperties: false,
                                                    required: [],
                                                    properties: {
                                                        selections: {
                                                            type: 'object',
                                                            additionalProperties: false,
                                                            required: [],
                                                            properties: {
                                                                z: {},
                                                                q: {}
                                                            }
                                                        },
                                                    }
                                                }
                                            }
                                        }
                                    },
                                },
                            },
                        }
                    },
                }
            }
        };

        runTest(simpleSelection, simpleSelectionSchema)
    });

    test('uses variable references in arguments', () => {

        const primitivesVariables = `
        mutation removeRecipe($a: String, $b: Int, $c: Float, $d: Boolean, $e: ID){
            miau(a: $a, b: $b, c: $c, d: $d, e: $e)
        }
        `;

        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                removeRecipe: {
                    type: 'object',
                    properties: {
                        variables: {
                            type: 'object',
                            properties: {
                                $a: { type: 'string' },
                                $b: { type: 'number' },
                                $c: { type: 'number' },
                                $d: { type: 'boolean' },
                                $e: { type: 'string' }
                            },
                            additionalProperties: false,
                            required: []
                        },
                        selections: {
                            type: 'object',
                            properties: {
                                miau: {
                                    type: "object",
                                    properties: {
                                        arguments: {
                                            type: "object",
                                            properties: {
                                                a: { "$ref": "#/definitions/removeRecipe/properties/variables/properties/$a" },
                                                b: { "$ref": '#/definitions/removeRecipe/properties/variables/properties/$b' },
                                                c: { "$ref": '#/definitions/removeRecipe/properties/variables/properties/$c' },
                                                d: { "$ref": '#/definitions/removeRecipe/properties/variables/properties/$d' },
                                                e: { "$ref": '#/definitions/removeRecipe/properties/variables/properties/$e' }
                                            },
                                            additionalProperties: false
                                        }
                                    }

                                },
                            },
                            additionalProperties: false,
                        }
                    }
                }
            }
        };

        runTest(primitivesVariables, primitivesVariablesSchema)
    });
});
