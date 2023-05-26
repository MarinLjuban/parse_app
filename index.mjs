// IMPORTING NECESSARY MODULES AND PACKAGES
import fs from "fs";
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
  IFCSPACE,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELAGGREGATES,
} from "web-ifc";
import namespace from "@rdfjs/namespace";
import cf from "clownface";
import rdf from "rdf-ext";
import _ from "lodash";
import { rdf as rdff } from "@tpluscode/rdf-ns-builders";
import { TurtleSerializer, JsonLdSerializer } from "@rdfjs-elements/formats-pretty";
import getStream from "get-stream";
import { Readable } from "readable-stream";

// DEFINING NAMESPACES
const ns = {
  ifc: namespace("https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#"),
  dis: namespace("https://otl.buildingsmart.org/test-project/"),
  otl: namespace("https://otl.buildingsmart.org/IFC4_ADD2_TC1/def/"),
  nen2660term: namespace("https://w3id.org/nen2660/term#"),
};

const prefixes = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  ifc: "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2/OWL#",
  owl: "http://www.w3.org/2002/07/owl#",
  otl: "https://otl.buildingsmart.org/IFC4_ADD2_TC1/def/",
  nen2660term: "https://w3id.org/nen2660/term#",
  dis: "https://otl.buildingsmart.org/test-project/",
};

const ttlSerializer = new TurtleSerializer({ prefixes });
const jsonldSerializer = new JsonLdSerializer({ prefixes });

// CREATING A CLOWNFACE DATASET
const disGraph = cf({ dataset: rdf.dataset() });

// INITIALIZING IFC API
const ifcapi = new IfcAPI();

// FUNCTION TO LOAD IFC FILE
async function loadFile(filename) {
  // READ IFC FILE SYNCHRONOUSLY
  const ifcData = fs.readFileSync(filename);

  // INITIALIZE IFC API
  await ifcapi.Init();

  // OPEN THE MODEL AND RETURN MODEL ID
  const modelID = ifcapi.OpenModel(ifcData);
  return modelID;
}

// FUNCTION TO CREATE TYPE NODES IN THE GRAPH
async function createTypeNode(GUID, ifcEntity, enumeration) {
  const subjectNode = ns.dis(`${GUID}`, "en");
  const objectNode = ns.otl[`${ifcEntity}-${enumeration}`];

  // ADD TYPE NODE TO THE GRAPH
  disGraph.namedNode(subjectNode).addOut(disGraph.namedNode(rdff.type), disGraph.namedNode(objectNode));
}

// FUNCTION TO CREATE CLASS NODES IN THE GRAPH
async function createClassNode(GUID, ifcEntity) {
  const subjectNode = ns.dis(`${GUID}`, "en");
  const objectNode = ns.otl[`${ifcEntity}`];

  // ADD CLASS NODE TO THE GRAPH
  disGraph.namedNode(subjectNode).addOut(disGraph.namedNode(rdff.type), disGraph.namedNode(objectNode));
}

// FUNCTION TO CREATE CONTAINS NODES IN THE GRAPH
async function createContainsNode(StructureGUID, ElementGUID) {
  const subjectNode = ns.dis(`${StructureGUID}`);
  const objectNode = ns.dis[`${ElementGUID}`];
  const contains = ns.nen2660term.contains;

  // ADD CONTAINS NODE TO THE GRAPH
  disGraph.namedNode(subjectNode).addOut(disGraph.namedNode(contains), disGraph.namedNode(objectNode));
}
// FUNCTION TO CREATE HASPART NODES IN THE GRAPH
async function createhasPartNode(StructureGUID, ElementGUID) {
  const subjectNode = ns.dis(`${StructureGUID}`);
  const objectNode = ns.dis[`${ElementGUID}`];
  const hasPart = ns.nen2660term.hasPart;

  // ADD CONTAINS NODE TO THE GRAPH
  disGraph.namedNode(subjectNode).addOut(disGraph.namedNode(hasPart), disGraph.namedNode(objectNode));
}

// FUNCTION TO EXTRACT ENUMERATIONS FROM THE MODEL
async function extractEnumerations(modelID) {
  const relDefinesByTypeEntities = ifcapi.GetLineIDsWithType(modelID, IFCRELDEFINESBYTYPE);

  // LOOP THROUGH RELATIONSHIPS DEFINED BY TYPE
  for (let i = 0; i < relDefinesByTypeEntities.size(); i++) {
    const relDefinesByTypeEntitiesExpressID = relDefinesByTypeEntities.get(i);
    const relDefinesByTypeEntityProps = await ifcapi.properties.getItemProperties(modelID, relDefinesByTypeEntitiesExpressID);
    const relTypeExpressId = relDefinesByTypeEntityProps.RelatingType.value;
    const relatingType = await ifcapi.properties.getItemProperties(modelID, relTypeExpressId);

    // LOOP THROUGH RELATED OBJECTS
    for (const relatedObject of relDefinesByTypeEntityProps.RelatedObjects) {
      const entityExpressId = relatedObject.value;
      const entity = await ifcapi.properties.getItemProperties(modelID, entityExpressId);

      // CREATE TYPE NODE
      createTypeNode(entity.GlobalId.value, entity.constructor.name.slice(3), entity.PredefinedType.value);
    }
  }
}

// FUNCTION TO EXTRACT SPACES FROM THE MODEL
async function extractContainedElements(modelID) {
  const ifcContainedEntities = ifcapi.GetLineIDsWithType(modelID, IFCRELCONTAINEDINSPATIALSTRUCTURE);

  // LOOP THROUGH CONTAINED ENTITIES
  for (let i = 0; i < ifcContainedEntities.size(); i++) {
    const ifcContainedEntitiesExpressID = ifcContainedEntities.get(i);
    const ifcContainedEntityProps = await ifcapi.properties.getItemProperties(modelID, ifcContainedEntitiesExpressID);
    const ifcRelatingStructureExpressID = ifcContainedEntityProps.RelatingStructure.value;
    const ifcRelatingEntityProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatingStructureExpressID);

    // LOOP THROUGH RELATED ELEMENTS
    for (let i of ifcContainedEntityProps.RelatedElements) {
      const ifcRelatedElementsExpressID = i.value;
      const ifcRelatedElementProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatedElementsExpressID);

      if (ifcRelatingEntityProps.PredefinedType != undefined) {
        for (let i of ifcContainedEntityProps.RelatedElements) {
          const ifcRelatedElementsExpressID = i.value;
          const ifcRelatedElementProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatedElementsExpressID);
          createContainsNode(ifcRelatingEntityProps.GlobalId.value, ifcRelatedElementProps.GlobalId.value);
        }
      } else {
        for (let i of ifcContainedEntityProps.RelatedElements) {
          const ifcRelatedElementsExpressID = i.value;
          const ifcRelatedElementProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatedElementsExpressID);
          createContainsNode(ifcRelatingEntityProps.GlobalId.value, ifcRelatedElementProps.GlobalId.value);
          createClassNode(ifcRelatingEntityProps.GlobalId.value, ifcRelatingEntityProps.constructor.name.slice(3));
        }
      }
    }
  }
}

// FUNCTION TO EXTRACT SPATIAL AGGREGATION
async function extractSpatialAggregation(modelID) {
  const ifcContainedEntities = ifcapi.GetLineIDsWithType(modelID, IFCRELAGGREGATES);

  // LOOP THROUGH CONTAINED ENTITIES
  for (let i = 0; i < ifcContainedEntities.size(); i++) {
    const ifcContainedEntitiesExpressID = ifcContainedEntities.get(i);
    const ifcContainedEntityProps = await ifcapi.properties.getItemProperties(modelID, ifcContainedEntitiesExpressID);
    const ifcRelatingStructureExpressID = ifcContainedEntityProps.RelatingObject.value;
    const ifcRelatingEntityProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatingStructureExpressID);

    if (ifcRelatingEntityProps.constructor.name != "IfcBuildingStorey") {
      for (let i of ifcContainedEntityProps.RelatedObjects) {
        const ifcRelatedElementsExpressID = i.value;
        const ifcRelatedElementProps = await ifcapi.properties.getItemProperties(modelID, ifcRelatedElementsExpressID);
        createhasPartNode(ifcRelatingEntityProps.GlobalId.value, ifcRelatedElementProps.GlobalId.value);
        createClassNode(ifcRelatingEntityProps.GlobalId.value, ifcRelatingEntityProps.constructor.name.slice(3));
      }
    }
  }
}

// FUNCTION TO LOG GRAPH TO CONSOLE
async function logGraph(ifcFile) {
  await loadFile(ifcFile);
  for (const quad of disGraph.dataset) {
    console.log(`${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`);
  }
}

// FUNCTION TO WRITE DATA TO FILE IN SPECIFIED FORMAT
async function writeDataToFile(data, filename, serializer) {
  const stream = await serializer.import(Readable.from(data));
  const output = await getStream(stream);

  fs.writeFileSync(filename, output);
}

// MAIN PROGRAM TO RUN ALL THE FUNCTIONS
async function runProgram(ifcFile, ttlFile, jsonldFile) {
  const modelID = await loadFile(ifcFile);
  await extractEnumerations(modelID);
  await extractContainedElements(modelID);
  await extractSpatialAggregation(modelID);
  const data = disGraph.dataset;
  await writeDataToFile(data, ttlFile, ttlSerializer);
  await writeDataToFile(data, jsonldFile, jsonldSerializer);
}

// RUNNING THE PROGRAM WITH SAMPLE FILES
runProgram("Arch.ifc", "arch.ttl", "arch.jsonld");
