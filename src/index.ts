import * as tsuml from 'typescript-uml';
import fs from 'fs';

import {transformModel} from "./model-transform";
import {renderModel} from "./xml-render";


let tsconfig = undefined;

const projectRootPath = "TODO set app patch here";
const exclude = [];

const projectModel = tsuml.TypeScriptUml.parseProject(projectRootPath, { exclude, tsconfig });

const transformedModel = transformModel(projectModel)

// const xmlModel = transformModelToXMLObj(transformedModel);

const xmiRenderedText = renderModel(transformedModel);

fs.writeFileSync('./app-uml-diagram.xmi', xmiRenderedText);
