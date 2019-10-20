import { parse } from 'graphql/language/parser';
import { JSONSchema6 } from 'json-schema';
import { fromOperationASTNode, GraphQLJSONSchema6, fromObjectTypeDefinition } from '../lib/fromGraqphQLAST';

const printJSON = (v: any) => console.log(JSON.stringify(v, null, 2));

import * as ajv from 'ajv';
import { OperationDefinitionNode, ObjectTypeDefinitionNode } from 'graphql';

function runTestOperationTest(sdl: string, expectedSchema: JSONSchema6) {
    const ast = <OperationDefinitionNode>parse(sdl).definitions[0];
    const result = fromOperationASTNode(ast);
    expect(result).toMatchObject(expectedSchema);
    const validator = new ajv();
    validator.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
    expect(validator.validateSchema(result)).toBe(true);
}

function runObjectTest(sdl: string, expectedSchema: JSONSchema6) {
    const ast = <ObjectTypeDefinitionNode>parse(sdl).definitions[0];
    const result = fromObjectTypeDefinition(ast);
    expect(result).toMatchObject(expectedSchema);
    const validator = new ajv();
    validator.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
    expect(validator.validateSchema(result)).toBe(true);
}

describe('fromOperationASTNode', () => {
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
            properties: {
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

        runTestOperationTest(primitivesVariables, primitivesVariablesSchema)
    });

    test('parses the primitive variables with required variables', () => {

        const primitivesVariables = `
        mutation removeRecipe($a: String!, $b: Int!, $c: Float!, $d: Boolean!, $e: ID!){
            miau
        }
        `;

        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            properties: {
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

        runTestOperationTest(primitivesVariables, primitivesVariablesSchema)
    });

    test('Parses selections without definitions', () => {
        const simpleSelection = `
            mutation A {
                b
            }
        `;

        const simpleSelectionSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            properties: {
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

        runTestOperationTest(simpleSelection, simpleSelectionSchema);
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
            properties: {
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

        runTestOperationTest(simpleSelection, simpleSelectionSchema)
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
            properties: {
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

        runTestOperationTest(simpleSelection, simpleSelectionSchema)
    });

    test('uses variable references in arguments', () => {

        const primitivesVariables = `
        mutation removeRecipe($a: String, $b: Int, $c: Float, $d: Boolean, $e: ID){
            miau(a: $a, b: $b, c: $c, d: $d, e: $e)
        }
        `;

        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            properties: {
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
                                                a: { "$ref": "#/properties/removeRecipe/properties/variables/properties/$a" },
                                                b: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$b' },
                                                c: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$c' },
                                                d: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$d' },
                                                e: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$e' }
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

        runTestOperationTest(primitivesVariables, primitivesVariablesSchema)
    });

    test('sets default values for variables', () => {
        const primitivesVariables = `
        mutation removeRecipe($a: String = "iama", $b: Int = 1, $c: Float = 1.2, $d: Boolean = true, $e: ID = "iamid"){
            miau(a: $a, b: $b, c: $c, d: $d, e: $e)
        }
        `;

        const primitivesVariablesSchema: GraphQLJSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            properties: {
                removeRecipe: {
                    type: 'object',
                    properties: {
                        variables: {
                            type: 'object',
                            properties: {
                                $a: { type: 'string', default: 'iama' },
                                $b: { type: 'number', default: '1' },
                                $c: { type: 'number', default: '1.2' },
                                $d: { type: 'boolean', default: true },
                                $e: { type: 'string', default: 'iamid' }
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
                                                a: { "$ref": "#/properties/removeRecipe/properties/variables/properties/$a" },
                                                b: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$b' },
                                                c: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$c' },
                                                d: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$d' },
                                                e: { "$ref": '#/properties/removeRecipe/properties/variables/properties/$e' }
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

        runTestOperationTest(primitivesVariables, primitivesVariablesSchema)
    });
});

describe('fromObjectTypeDefinition', () => {
    test('basic scalar types', () => {
        const sdl = `
        type H {
            a: String
            b: Int
            c: Float
            d: Boolean
            e: ID
        }`;

        const expectedSchema: JSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                H: {
                    type: 'object',
                    properties: {
                        a: { type: 'string' },
                        b: { type: 'number' },
                        c: { type: 'number' },
                        d: { type: 'boolean' },
                        e: { type: 'string' },
                    }
                }
            }
        }

        runObjectTest(sdl, expectedSchema);
    });
    test('list of scalars', () => {
        const sdl = `
        type H {
            a: [String]
            b: [Int]
            c: [Float]
            d: [Boolean]
            e: [ID]
        }`;

        const expectedSchema: JSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                H: {
                    type: 'object',
                    properties: {
                        a: { type: 'array', items: { type: 'string' } },
                        b: { type: 'array', items: { type: 'number' } },
                        c: { type: 'array', items: { type: 'number' } },
                        d: { type: 'array', items: { type: 'boolean' } },
                        e: { type: 'array', items: { type: 'string' } },
                    }
                }
            }
        }

        runObjectTest(sdl, expectedSchema)
    });

    test('required fields', () => {
        const sdl = `
        type H {
            a: String!
            b: Int!
            c: Float!
            d: Boolean!
            e: ID!
        }`;

        const expectedSchema: JSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                H: {
                    type: 'object',
                    properties: {
                        a: { type: 'string' },
                        b: { type: 'number' },
                        c: { type: 'number' },
                        d: { type: 'boolean' },
                        e: { type: 'string' },
                    },
                    required: ['a', 'b', 'c', 'd', 'e'],
                }
            }
        }

        runObjectTest(sdl, expectedSchema)
    });

    test('handles references', () => {
        const sdl = `
        type H {
            t: T
        }
        `;

        const expectedSchema: JSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                H: {
                    type: 'object',
                    properties: {
                        t: { $ref: '#/definitions/T' }
                    },
                    required: [],
                },
            }
        };

        runObjectTest(sdl, expectedSchema);
    });

    test('handles list of object refs', () => {
        const sdl = `
        type H {
            t: [T]
        }
        `;

        const expectedSchema: JSONSchema6 = {
            $schema: 'http://json-schema.org/draft-06/schema#',
            definitions: {
                H: {
                    type: 'object',
                    properties: {
                        t: { type: 'array', items: { $ref: '#/definitions/T' } },
                    },
                    required: [],
                },
            },
        };

        runObjectTest(sdl, expectedSchema);
    });
});
