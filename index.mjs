import fs from "fs";
import { Console } from "console";
import {
  ms,
  IfcAPI,
  Handle,
  IFC2X3,
  IFC4,
  IFCBUILDINGSTOREY,
  IFCSLAB,
  IFCCOLUMN,
  IFCBUILDINGELEMENT,
  IFCRELDEFINESBYTYPE,
  IFCPROPERTYSINGLEVALUE,
  IFCSIUNIT,
  EMPTY,
  IFCPROPERTYSET,
  IFCOWNERHISTORY,
  IFCRELDEFINESBYPROPERTIES,
  IFCBUILDINGELEMENTTYPE,
  IFCPRODUCT,
} from "web-ifc";
import namespace from "@rdfjs/namespace";
import SparqlClient from "sparql-http-client";
import cf from "clownface";
import rdf from "rdf-ext";
import toFile from "rdf-utils-fs/toFile.js";
import _ from "lodash";
import { skos, owl, rdfs } from '@tpluscode/rdf-ns-builders'
import { rdf as rdff } from '@tpluscode/rdf-ns-builders'

const ns = {
  ifc: namespace('https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#'),
  ns1: namespace('https://otl.buildingsmart.org/test-project/'),
  otl: namespace('https://otl.buildingsmart.org/IFC4_ADD2_TC1/def/')
}

const ns1Graph = cf({ dataset: rdf.dataset() });

function createNode(GUID, ifcEntity, enumeration) {
  const subjectNode = ns.ns1(`${GUID}`, 'en');
  const objectNode = ns.otl[`${ifcEntity}-${enumeration}`]; 
  ns1Graph
    .namedNode(subjectNode)
    .addOut(ns1Graph.namedNode(rdff.type),ns1Graph.namedNode(objectNode))
}

const ifcapi = new IfcAPI();

async function LoadFile(filename) {
  // load model data as a string
  const ifcData = fs.readFileSync(filename);

  await ifcapi.Init();

  let modelID = ifcapi.OpenModel(ifcData);

  console.log(`Loaded model ${filename} to modelID ${modelID}`);

  let entities = ifcapi.GetIfcEntityList(modelID);
  // console.log(entities);

  let line = ifcapi.GetAllLines(modelID);
  // console.log(line[1]);

  let numLines = 0;

  // //Data types

  // // enum IfcTokenType : char
  // // {
  // // 	UNKNOWN = 0,
  // // 	STRING = 1
  // //  LABEL = 2
  // // 	ENUM = 3
  // // 	REAL = 4
  // // 	REF = 5
  // // 	EMPTY = 6
  // // 	SET_BEGIN
  // // 	SET_END
  // // 	LINE_END
  // // };

  //IfcProduct edition
  let relDefinesByTypeEntities = ifcapi.GetLineIDsWithType(
    modelID,
    IFCRELDEFINESBYTYPE
  );
  for (let i = 0; i < relDefinesByTypeEntities.size(); i++) {
    numLines++;
    let relDefinesByTypeEntitiesExpressID = relDefinesByTypeEntities.get(i);
    const relDefinesByTypeEntityProps =
      await ifcapi.properties.getItemProperties(
        modelID,
        relDefinesByTypeEntitiesExpressID
      );
    const relTypeExpressId = relDefinesByTypeEntityProps.RelatingType.value;
    const relatingType = await ifcapi.properties.getItemProperties(
      modelID,
      relTypeExpressId
    );
    for (let i of relDefinesByTypeEntityProps.RelatedObjects) {
      const entityExpressId = i.value;
      const entity = await ifcapi.properties.getItemProperties(
        modelID,
        entityExpressId
      );
      createNode(entity.GlobalId.value, entity.constructor.name.slice(3), entity.PredefinedType.value);
      // console.log(entity);
    }
  }
}


async function logGraph() {
  const graphLog = await LoadFile("../SampleModel_Mech_IFC.ifc");
  for (const quad of ns1Graph.dataset) {
    console.log(
      `${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`
    );
  }
}


async function runProgram() {
  await LoadFile("../SampleModel_Mech_IFC.ifc");
  await logGraph();
  await toFile(ns1Graph.dataset.toStream(), "parsing-test.ttl");
  await toFile(ns1Graph.dataset.toStream(), "parsing-test.jsonld");
}

runProgram();

//CREATE THE NAMESPACES
