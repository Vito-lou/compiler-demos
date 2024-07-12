import { flowData } from './flowData.js'


function buildAST(flowData) {
    const ast = {
        type: 'Program',
        body: []
    };

    const nodeMap = new Map(flowData.nodes.map(node => [node.id, node]));
    const edgeMap = new Map(flowData.edges.map(edge => [edge.source, edge]));

    function traverse(nodeId, parentNode = null) {
        const node = nodeMap.get(nodeId);
        const edge = edgeMap.get(nodeId);

        switch (node.type) {
            case 'start-node':
                if (edge) traverse(edge.target);
                break;
            case 'set-variable-node':
                const assignmentExpression = {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: parseExpression(node.properties.key),
                    right: parseExpression(node.properties.value)
                };
                const expressionStatement = {
                    type: 'ExpressionStatement',
                    expression: assignmentExpression
                };
                if (parentNode && parentNode.type === 'BlockStatement') {
                    parentNode.body.push(expressionStatement);
                } else {
                    ast.body.push(expressionStatement);
                }
                if (edge) traverse(edge.target);
                break;
            case 'if-node':
                const ifStatement = {
                    type: 'IfStatement',
                    test: parseExpression(node.properties.expression),
                    consequent: { type: 'BlockStatement', body: [] },
                    alternate: { type: 'BlockStatement', body: [] }
                };
                ast.body.push(ifStatement);

                const trueEdge = flowData.edges.find(e => e.source === node.id && e.conditionValue === true);
                const falseEdge = flowData.edges.find(e => e.source === node.id && e.conditionValue === false);

                if (trueEdge) traverse(trueEdge.target, ifStatement.consequent);
                if (falseEdge) traverse(falseEdge.target, ifStatement.alternate);
                break;
            case 'http-node':
                const httpCallExpression = {
                    type: 'AwaitExpression',
                    argument: {
                        type: 'CallExpression',
                        callee: {
                            type: 'MemberExpression',
                            object: { type: 'Identifier', name: 'axios' },
                            property: { type: 'Identifier', name: node.properties.method }
                        },
                        arguments: [
                            { type: 'Literal', value: node.properties.url },
                            {
                                type: 'ObjectExpression',
                                properties: node.properties.params.map(param => ({
                                    type: 'Property',
                                    key: { type: 'Identifier', name: param.key },
                                    value: parseExpression(param.value),
                                    kind: 'init'
                                }))
                            }
                        ]
                    }
                };
                const httpAssignment = {
                    type: 'VariableDeclaration',
                    declarations: [{
                        type: 'VariableDeclarator',
                        id: { type: 'Identifier', name: node.properties.saveResponseAsVariableName },
                        init: {
                            type: 'MemberExpression',
                            object: httpCallExpression,
                            property: { type: 'Identifier', name: 'data' }
                        }
                    }],
                    kind: 'const'
                };
                ast.body.push(httpAssignment);
                if (edge) traverse(edge.target);
                break;
            case 'loop-node':
                const loopBody = {
                    type: 'BlockStatement',
                    body: []
                };
                const forOfStatement = {
                    type: 'ForOfStatement',
                    left: {
                        type: 'VariableDeclaration',
                        declarations: [{
                            type: 'VariableDeclarator',
                            id: { type: 'Identifier', name: node.properties.currentItem },
                            init: null
                        }],
                        kind: 'let'
                    },
                    right: parseExpression(node.properties.loopArray),
                    body: loopBody
                };
                ast.body.push(forOfStatement);

                // Traverse child nodes of the loop
                if (node.children) {
                    node.children.forEach(childId => traverse(childId, loopBody));
                }

                if (edge) traverse(edge.target);
                break;
            case 'end-node':
                if (!ast.body.some(node => node.type === 'ReturnStatement')) {
                    const returnStatement = {
                        type: 'ReturnStatement',
                        argument: parseExpression(node.properties.output)
                    };
                    ast.body.push(returnStatement);
                }
                break;
        }
    }

    function parseExpression(expr) {
        if (typeof expr === 'string') {
            if (expr.startsWith('$')) {
                const parts = expr.slice(1).split('/');
                if (parts.length > 1) {
                    return {
                        type: 'MemberExpression',
                        object: { type: 'Identifier', name: parts[0] },
                        property: { type: 'Identifier', name: parts[1] }
                    };
                }
                return { type: 'Identifier', name: expr.slice(1) };
            }
            if (expr.includes('+')) {
                const [left, right] = expr.split('+').map(e => e.trim());
                return {
                    type: 'BinaryExpression',
                    operator: '+',
                    left: parseExpression(left),
                    right: parseExpression(right)
                };
            }
            if (expr.includes('===')) {
                const [left, right] = expr.split('===').map(e => e.trim());
                return {
                    type: 'BinaryExpression',
                    operator: '===',
                    left: parseExpression(left),
                    right: parseExpression(right)
                };
            }
        }
        // 如果是数字，返回数字字面量
        if (!isNaN(expr)) {
            return { type: 'Literal', value: Number(expr) };
        }
        return { type: 'Literal', value: expr };
    }
    function findStartNodeId() {
        return flowData.nodes.find(node => node.type === 'start-node').id
    }
    const startId = findStartNodeId()
    traverse(startId);

    return ast;
}

function generateCode(ast) {
    let code = '';

    function generate(node) {
        switch (node.type) {
            case 'Program':
                code += 'async function flow() {\n';
                node.body.forEach(stmt => generate(stmt));
                code += '}\n';
                break;
            case 'VariableDeclaration':
                code += `${node.kind} ${generate(node.declarations[0])};\n`;
                break;
            case 'VariableDeclarator':
                return `${node.id.name} = ${generate(node.init)}`;
            case 'AssignmentExpression':
                return `${generate(node.left)} ${node.operator} ${generate(node.right)}`;
            case 'BinaryExpression':
                return `${generate(node.left)} ${node.operator} ${generate(node.right)}`;
            case 'MemberExpression':
                return `${generate(node.object)}.${generate(node.property)}`;
            case 'CallExpression':
                return `${generate(node.callee)}(${node.arguments.map(generate).join(', ')})`;
            case 'AwaitExpression':
                return `await ${generate(node.argument)}`;
            case 'ObjectExpression':
                return `{ ${node.properties.map(generate).join(', ')} }`;
            case 'Property':
                return `${node.key.name}: ${generate(node.value)}`;
            case 'Identifier':
                return node.name;
            case 'Literal':
                return JSON.stringify(node.value);
            case 'IfStatement':
                code += `if (${generate(node.test)}) {\n`;
                generate(node.consequent);
                code += '} else {\n';
                generate(node.alternate);
                code += '}\n';
                break;
            case 'BlockStatement':
                node.body.forEach(stmt => generate(stmt));
                break;
            case 'ExpressionStatement':
                code += `${generate(node.expression)};\n`;
                break;
            case 'ForOfStatement':
                if (node.left.type === 'VariableDeclaration') {
                    code += `for (${node.left.kind} ${generate(node.left.declarations[0].id)} of ${generate(node.right)}) {\n`;
                } else {
                    code += `for (${generate(node.left)} of ${generate(node.right)}) {\n`;
                }
                generate(node.body);
                code += '}\n';
                break;
            case 'ReturnStatement':
                code += `return ${generate(node.argument)};\n`;
                break;
        }
    }

    generate(ast);
    return code;
}
const ast = buildAST(flowData);
const code = generateCode(ast);
console.log('ast', JSON.stringify(ast))
console.log('code', code)