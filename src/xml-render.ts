import xml from "xml";
import {Map} from "typescript";
import {
    TYPE_ASSOCIATION,
    TYPE_CLASS,
    TYPE_EXT_DATA_TYPE, XmiAssociation,
    XmiExtDataType,
    XmiMethod,
    XmiNode,
    XmiParameter,
    XmiProperty
} from "./model-transform";

const getDataTypesData = (xmiNodesMap: Map<any>) => {
    const dataTypesData = [];

    // @ts-ignore
    for (const xmiNode: XmiExtDataType of xmiNodesMap.values()) {
        if (xmiNode.__type === TYPE_EXT_DATA_TYPE) {
            const dtObj = {
                'uml:DataType': {
                    _attr: {
                        'xmi:id': xmiNode.__id,
                        'xmi:type': xmiNode.__type,
                        'name': xmiNode.__name,
                    }
                }
            };

            dataTypesData.push(dtObj);
        }
    }

    return dataTypesData;
}

const getClassAdditionalNodes = (xmiNode: XmiNode) => {
    const dataNodes = [];

    if (xmiNode.__generalization) {
        const genNode = {
            'generalization': {
                _attr: {
                    'xmi:id': xmiNode.__generalization.__id,
                    'xmi:type': xmiNode.__generalization.__type,
                    'general': xmiNode.__generalization.__to_id,
                },
            },
        };

        dataNodes.push(genNode);
    }

    return dataNodes;
}

const getClassAttributes = (xmiNode: XmiNode) => {
    const attribs = [];

    // @ts-ignore
    xmiNode.variables.forEach((_, xmiProp: XmiProperty) => {
        const tagAttribs = {
            'xmi:id': xmiProp.__id,
            'xmi:type': xmiProp.__type,
            'name': xmiProp.identifier,
            'visibility': xmiProp.__visibility,
            'aggregation': "none",
        }

        if (xmiProp.__association) {
            tagAttribs['association'] = xmiProp.__association.__id;
        }

        const attrib = {
            'ownedAttribute': [
                { _attr: tagAttribs },
            ]
        };

        if (xmiProp.type) {
            const attrTypeObj = {
                type: {
                    _attr: {
                        'xmi:type': "uml:Class",
                        'xmi:idref': xmiProp.type.__referencedNode.__id,
                    },
                },
            };

            // @ts-ignore
            attrib.ownedAttribute.push(attrTypeObj);
        }

        attribs.push(attrib);
    })

    return attribs;
}

const getClassOperations = (xmiNode: XmiNode) => {
    const classOps = [];

    // @ts-ignore
    xmiNode.methods.forEach((_, xmiMethod: XmiMethod) => {
        const opParamsData = [];

        xmiMethod.__parameters.forEach((param: XmiParameter) => {
           const opParamData = {
               'ownedParameter': [
                   {
                       _attr: {
                           'xmi:id': param.__id,
                           'name': param.identifier,
                           'direction': param.__direction,
                       },
                   },
               ],
           };

            if (param.type) {
                const paramTypeObj = {
                    type: {
                        _attr: {
                            'xmi:type': "uml:Class",
                            'xmi:idref': param.type.__referencedNode.__id,
                        },
                    },
                };

                // @ts-ignore
                opParamData.ownedParameter.push(paramTypeObj);
            }

            opParamsData.push(opParamData);
        });

       const methodObj = {
           'ownedOperation': [
               {
                   _attr: {
                       'xmi:id': xmiMethod.__id,
                       'xmi:type': xmiMethod.__type,
                       'name': xmiMethod.identifier,
                       'visibility': xmiMethod.__visibility,
                       'isAbstract': xmiMethod.__is_abstract ? "true" : "false",
                   },
               },
               ...opParamsData,
           ],
       };

       classOps.push(methodObj);
    });

    return classOps;
}

const getClassesData = (xmiNodesMap: Map<XmiNode>) => {
    const dataTypesData = [];

    // @ts-ignore
    for (const xmiNode of xmiNodesMap.values()) {
        if (xmiNode.__type === TYPE_CLASS) { // TODO add interfaces support
            const additionalNodes = getClassAdditionalNodes(xmiNode);
            const attributes = getClassAttributes(xmiNode);
            const operations = getClassOperations(xmiNode);

            const classObj = {
                'packagedElement': [
                    {
                        _attr: {
                            'xmi:id': xmiNode.__id,
                            'xmi:type': xmiNode.__type,
                            'name': xmiNode.identifier,
                            'visibility': "public", // TODO consider to add support for class/package visibility
                        },
                    },
                    ...additionalNodes,
                    ...attributes,
                    ...operations,
                ],
            };

            dataTypesData.push(classObj);
        }
    }

    return dataTypesData;
}

const getAssociationData = (xmiNodesMap: Map<any>) => {
    const assocData = [];

    // @ts-ignore
    for (const xmiAssoc: XmiAssociation of xmiNodesMap.values()) {
        if (xmiAssoc.__type === TYPE_ASSOCIATION) {
            const assocObj = {
                'packagedElement': [
                    {
                        _attr: {
                            'xmi:id': xmiAssoc.__id,
                            'xmi:type': xmiAssoc.__type,
                            'visibility': xmiAssoc.__visibility,
                        },
                    },
                    {
                        'memberEnd': {
                            _attr: {
                                'xmi:idref': xmiAssoc.__from_id,
                            },
                        },
                    },
                    {
                        'ownedEnd': {
                            _attr: {
                                'xmi:id': `REVERSE_${xmiAssoc.__from_id}`,
                                'xmi:type': "uml:Property",
                                'association': xmiAssoc.__id,
                                'visibility': xmiAssoc.__visibility,
                                'type': xmiAssoc.__to_id,
                                'aggregation': "none", // TODO integrate
                                'isNavigable': "false",
                            },
                        },
                    },
                    {
                        'memberEnd': {
                            _attr: {
                                'xmi:idref': `REVERSE_${xmiAssoc.__from_id}`,
                            },
                        },
                    },
                ],
            };

            assocData.push(assocObj);
        }
    }

    return assocData;
}

export const transformModelToXMLObj = (xmiNodesMap: Map<any>) => {
    const classesData = getClassesData(xmiNodesMap);
    const associationData = getAssociationData(xmiNodesMap);
    const dataTypesData = getDataTypesData(xmiNodesMap);

    return [{
        'xmi:XMI': [
            {
                _attr: {
                    'xmi:version': "2.1",
                    'xmlns:uml': "http://schema.omg.org/spec/UML/2.1",
                    'xmlns:xmi': "http://schema.omg.org/spec/XMI/2.1",
                },
            },
            {'xmi:Documentation': {_attr: {exporter: "DenKornCustom", exporterVersion: "1.0"}}},
            {
                'uml:Package': [
                    {_attr: {'xmi:type': "uml:Package", 'xmi:id': "0x1f5e5_22", 'name': "app"}},
                    ...classesData,
                    ...associationData,
                ],
            },
            ...dataTypesData,
        ]
    }];
}

export const renderModel = (xmiNodesMap: Map<any>) => {
    const xmlObjectModel = transformModelToXMLObj(xmiNodesMap);
    // @ts-ignore
    return xml(xmlObjectModel, { indent: '\t', declaration: true });
}