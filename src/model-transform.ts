import * as tsuml from 'typescript-uml';
import {Map} from "typescript";


export const TYPE_CLASS = "uml:Class"; // TODO left only for stereotype 0
// export const TYPE_INTERFACE = "uml:Interface"; // TODO add for stereotype 2
// export const TYPE_PACKAGE = "uml:Package"; // TODO add support
export const TYPE_GENERALIZATION = "uml:Generalization";
export const TYPE_OPERATION = "uml:Operation";
export const TYPE_PROPERTY = "uml:Property";
export const TYPE_PARAMETER = "uml:Parameter";
export const TYPE_ASSOCIATION = "uml:Association";
export const TYPE_EXT_DATA_TYPE = "uml:DataType";


enum ClassVisibility {
    PUBLIC = "public", // 0
    PROTECTED = "protected", // 1
    PRIVATE = "private", // 2
}

export enum ParamDirection {
    IN = "in",
    IN_OUT = "inout",
    RETURN = "return",
}

const TSVisibilityMap = {
    0 : ClassVisibility.PUBLIC,
    1 : ClassVisibility.PROTECTED,
    2 : ClassVisibility.PRIVATE,
}

export class XmiNode extends tsuml.Node {
    __id: string;
    __generalization?: XmiGeneralization;
    __type: string;
}

export class XmiGeneralization extends tsuml.Generalization {
    __id: string;
    __from_id: string;
    __to_id: string;
    __type: string = TYPE_GENERALIZATION;
    __from_node: XmiNode;
    __to_node: XmiNode | XmiExtDataType;
}

export class XmiType extends tsuml.Type {
    name: string;
    __referencedNode: XmiNode | XmiExtDataType;
}

export class XmiParameter extends tsuml.Parameter {
    type: XmiType;

    __id: string;
    __direction: ParamDirection;
    __type: string = TYPE_PARAMETER;
}

export class XmiMethod extends tsuml.FunctionProperty {
    __id: string;
    __type: string = TYPE_OPERATION;
    __visibility: ClassVisibility;
    __static: boolean;
    __optional: boolean;
    __is_abstract: boolean = false;
    __parameters: XmiParameter[];
}

export class XmiAssociation extends tsuml.Association {
    __id: string;
    __type: string = TYPE_ASSOCIATION;
    __visibility: ClassVisibility;
    __is_navigable: boolean = false;
    __from_id: string;
    __to_id: string;
    __from_node: XmiNode;
    __to_node: XmiNode | XmiExtDataType;
}

export class XmiProperty extends tsuml.Property {
    type: XmiType

    // TODO add support of "readonly" feature
    __id: string;
    __type: string = TYPE_PROPERTY;
    __visibility: ClassVisibility;
    __static: boolean;
    __optional: boolean;
    __association: XmiAssociation | null = null; // only when referencing not external data
    // __aggregation:  only when referencing not external data
}

export class XmiExtDataType {
    identifier: string;

    __id: string;
    __name: string;
    __type: string = TYPE_EXT_DATA_TYPE;

    constructor(id, name) {
        this.__id = id;
        this.__name = name;
        this.identifier = name;
    }
}


const randomHex = () => `0x${Math.floor(Math.random() * 0xfffff).toString(16).padEnd(5, "0")}`;

const getNewIdForNode = (xmiNodesMap: Map<any>): string => {
    const newVal = randomHex();
    let i = 0;

    while (xmiNodesMap.has(`${newVal}_${i}`)) {
        i++;
    }

    return `${newVal}_${i}`;
}

const getNewNodeCustomId = (extDataTypesMap: Map<any>, prefix: string) => {
    let i = 0;

    while (extDataTypesMap.has(`${prefix}_${i}`)) {
        i++;
    }

    return`${prefix}_${i}`;
}

// TODO consider the case when "type" arg can interfere with associations or something else
const findXmiNode = (xmiNodesMap: Map<any>, identifier: string, type = null): XmiNode => {
    // @ts-ignore
    for (const xmiNode of xmiNodesMap.values()) {
        if (type) {
            if (xmiNode.__type === type && xmiNode.identifier === identifier) {
                return xmiNode;
            }
        } else {
            if (xmiNode.identifier === identifier) {
                return xmiNode;
            }
        }
    }
    
    return null;
} 

export const transformModel = (projectModel: tsuml.CodeModel) => {
    let xmiNodes = new Map();
    let extDataTypesMap = new Map();

    const addExtDataType = (dtName: string) => {
        const edt = new XmiExtDataType(getNewNodeCustomId(extDataTypesMap, 'datatype'), dtName);
        extDataTypesMap.set(edt.__id, edt);
        xmiNodes.set(edt.__id, edt);
        return edt;
    }

    // initial adding to nodeMap
    projectModel.nodes.forEach((_, xmiNode: XmiNode) => {
        if (![0, 2].includes(xmiNode.stereotype)) {
            throw new Error('Unexpected stereotype')
        }

        xmiNode.__id = getNewIdForNode(xmiNodes);
        xmiNode.__type = TYPE_CLASS; // TODO extend support of abstract classes and interfaces
        xmiNodes.set(xmiNode.__id, xmiNode);
    });

    projectModel.generalizations.forEach((g: XmiGeneralization) => {
        const fromNode = findXmiNode(xmiNodes, g.fromName, TYPE_CLASS);

        if (!fromNode) {
            throw new Error(`From node not found: ${g.fromName}`);
        }

        fromNode.__generalization = g;

        let toNode = findXmiNode(xmiNodes, g.toName);

        if (!toNode) {
            // @ts-ignore
            toNode = addExtDataType(g.toName);
        }

        g.__id = getNewIdForNode(xmiNodes);
        g.__from_id = fromNode.__id;
        g.__to_id = toNode.__id;
        g.__from_node = fromNode;
        g.__to_node = toNode;
        g.__type = TYPE_GENERALIZATION;
        xmiNodes.set(g.__id, g);
    });

    projectModel.nodes.forEach((_, xmiNode: XmiNode) => {
        if (xmiNode.__type !== TYPE_CLASS) {
            return; // processing only classes
        }

        // iterate over class attributes
        // @ts-ignore
        xmiNode.variables.forEach((_, xmiProp: XmiProperty) => {
            xmiProp.__id = getNewIdForNode(xmiNodes);
            xmiProp.__type = TYPE_PROPERTY;
            xmiProp.__static = xmiProp.static;
            xmiProp.__optional = xmiProp.optional;

            if (!TSVisibilityMap[xmiProp.accessibility]) {
                throw new Error("Visibility modifier not found");
            }

            xmiProp.__visibility = TSVisibilityMap[xmiProp.accessibility];
            xmiNodes.set(xmiProp.__id, xmiProp);

            // finding value in pool of nodes. Referencing to existing node or creating new ext data type
            let typeReferencedNode = findXmiNode(xmiNodes, xmiProp.type.name, TYPE_CLASS); // TODO only classes??

            if (typeReferencedNode) {
                const associationObj: tsuml.Association = projectModel.associations.toArray()
                    .filter((association: tsuml.Association) => {
                        return association.fromName === xmiNode.identifier
                            && association.toName === typeReferencedNode.identifier;
                    })[0];

                if (!associationObj) {
                    throw new Error("Association was not found in source associations pool");
                }

                if (!associationObj["__id"]) {
                    // @ts-ignore
                    const association: XmiAssociation = associationObj;
                    association.__id = `ASSOC_${xmiProp.__id}`;
                    association.__type = TYPE_ASSOCIATION;
                    association.__visibility = xmiProp.__visibility;
                    association.__from_id = xmiNode.__id;
                    association.__from_node = xmiNode;
                    association.__to_id = typeReferencedNode.__id;
                    association.__to_node = typeReferencedNode;
                    association.__is_navigable = false;

                    xmiNodes.set(association.__id, association);
                    xmiProp.__association = association;
                }
            } else {
                typeReferencedNode = findXmiNode(xmiNodes, xmiProp.type.name, TYPE_EXT_DATA_TYPE);

                if (!typeReferencedNode) {
                    // @ts-ignore
                    typeReferencedNode = addExtDataType(xmiProp.type.name);
                }
            }

            xmiProp.type.__referencedNode = typeReferencedNode;
        });

        // iterate over class methods
        // @ts-ignore
        xmiNode.methods.forEach((_, xmiMethod: XmiMethod) => {
            xmiMethod.__id = getNewIdForNode(xmiNodes);
            xmiMethod.__type = TYPE_OPERATION;
            xmiMethod.__static = xmiMethod.static;
            xmiMethod.__optional = xmiMethod.optional;
            xmiMethod.__is_abstract = false; // TODO implement support
            xmiMethod.__parameters = [];

            if (!TSVisibilityMap[xmiMethod.accessibility]) {
                throw new Error("Visibility modifier not found");
            }

            xmiMethod.__visibility = TSVisibilityMap[xmiMethod.accessibility];
            xmiNodes.set(xmiMethod.__id, xmiMethod);

            // @ts-ignore
            xmiMethod.parameters.forEach((xmiMethodParam: XmiParameter) => {
                xmiMethodParam.__id = getNewNodeCustomId(xmiNodes, 'op_param');
                xmiMethodParam.__direction = ParamDirection.IN;
                xmiMethodParam.__type = TYPE_PARAMETER;

                xmiNodes.set(xmiMethodParam.__id, xmiMethodParam);
                xmiMethod.__parameters.push(xmiMethodParam);
            })

            if (xmiMethod.returnType) {
                const xmiReturnParam = new XmiParameter('return');
                xmiReturnParam.__id = getNewNodeCustomId(xmiNodes, 'op_param');
                xmiReturnParam.__direction = ParamDirection.RETURN;
                xmiReturnParam.__type = TYPE_PARAMETER;

                xmiNodes.set(xmiReturnParam.__id, xmiReturnParam);
                xmiMethod.__parameters.push(xmiReturnParam);
            }

            xmiMethod.__parameters.forEach((xmiParam: XmiParameter) => {
                if (!xmiParam.type) { // type might be not defined
                    return;
                }

                let typeReferencedNode = findXmiNode(xmiNodes, xmiParam.type.name, TYPE_CLASS);

                if (!typeReferencedNode) {
                    typeReferencedNode = findXmiNode(xmiNodes, xmiParam.type.name, TYPE_EXT_DATA_TYPE);

                    if (!typeReferencedNode) {
                        // @ts-ignore
                        typeReferencedNode = addExtDataType(xmiParam.type.name);
                    }
                }

                xmiParam.type.__referencedNode = typeReferencedNode;
            });
        });
    });

    return xmiNodes;
}