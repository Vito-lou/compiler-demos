export const flowData = {
    "nodes": [
        {
            "id": "1",
            "type": "start-node"
        },
        {
            "id": "2",
            "type": "set-variable-node",
            "properties": {
                "key": "$name",
                "value": "jack"
            }
        },
        {
            "id": "3",
            "type": "if-node",
            "properties": {
                "expression": "$name === jack"
            }
        },
        {
            "id": "4",
            "type": "set-variable-node",
            "properties": {
                "key": "res",
                "value": "$name"
            }
        },
        {
            "id": "5",
            "type": "http-node",
            "properties": {
                "url": "http://10.44.219.48/api/orders/get",
                "params": [
                    {
                        "key": "name",
                        "value": "$res"
                    }
                ],
                "method": "get",
                "saveResponseAsVariableName": "orders"
            }
        },
        {
            "id": "6",
            "type": "loop-node",
            "properties": {
                "loopArray": "$orders",
                "currentItem": "currentItem"
            },
            "children": [
                "7"
            ]
        },
        {
            "id": "7",
            "type": "set-variable-node",
            "properties": {
                "key": "$currentItem/price",
                "value": "$currentItem/price + 100"
            }
        },
        {
            "id": "8",
            "type": "end-node",
            "properties": {
                "output": "$orders"
            }
        },
        {
            "id": "9",
            "type": "end-node",
            "properties": {
                "output": "nothing"
            }
        }
    ],
    "edges": [
        {
            "source": "1",
            "target": "2"
        },
        {
            "source": "2",
            "target": "3"
        },
        {
            "source": "3",
            "target": "4",
            "conditionValue": true
        },
        {
            "source": "4",
            "target": "5"
        },
        {
            "source": "5",
            "target": "6"
        },
        {
            "source": "6",
            "target": "8"
        },
        {
            "source": "3",
            "target": "9",
            "conditionValue": false
        }
    ]
}