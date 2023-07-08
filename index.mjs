// IMPORTING NECESSARY MODULES AND PACKAGES
import fs from "fs";
import {
  IfcAPI,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELAGGREGATES,
  IFCELEMENT,
  IFCDOOR,
  IFCSPACE,
  IFCPROJECT,
  IFCUNITASSIGNMENT,
} from "web-ifc";
import namespace from "@rdfjs/namespace";
import cf from "clownface";
import rdf from "rdf-ext";
import _ from "lodash";
import { rdf as rdff, rdfs, xsd } from "@tpluscode/rdf-ns-builders";
import {
  TurtleSerializer,
  JsonLdSerializer,
} from "@rdfjs-elements/formats-pretty";
import getStream from "get-stream";
import { Readable } from "readable-stream";
import { get } from "http";

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
  const subjectNode = ns.dis(`${GUID}`);
  const objectNode = ns.otl[`${ifcEntity}-${enumeration}`];

  // ADD TYPE NODE TO THE GRAPH
  disGraph
    .namedNode(subjectNode)
    .addOut(disGraph.namedNode(rdff.type), disGraph.namedNode(objectNode));
}

async function createUserDefinedTypeNode(GUID, ifcEntity, enumeration) {
  const subjectNode = ns.dis(`${GUID}`);
  const objectNode = ns.dis[`${ifcEntity}-${enumeration}`];

  // ADD TYPE NODE TO THE GRAPH
  disGraph
    .namedNode(subjectNode)
    .addOut(disGraph.namedNode(rdff.type), disGraph.namedNode(objectNode));
}

// FUNCTION TO CREATE CLASS NODES IN THE GRAPH
async function createsubClassOfNode(ifcEntity, enumeration) {
  const subjectNode = ns.dis(`${ifcEntity}-USERDEFINED-${enumeration}`);
  const objectNode = ns.otl[`${ifcEntity}`];

  // ADD CLASS NODE TO THE GRAPH
  disGraph
    .namedNode(disGraph.namedNode(subjectNode))
    .addOut(
      disGraph.namedNode(rdfs.subClassOf),
      disGraph.namedNode(objectNode)
    );
}
// FUNCTION TO SET THE SUBCLASS
async function createClassNode(GUID, ifcEntity) {
  const subjectNode = ns.dis(`${GUID}`);
  const objectNode = ns.otl[`${ifcEntity}`];

  // ADD CLASS NODE TO THE GRAPH
  disGraph
    .namedNode(subjectNode)
    .addOut(disGraph.namedNode(rdff.type), disGraph.namedNode(objectNode));
}

// FUNCTION TO CREATE CONTAINS NODES IN THE GRAPH
async function createContainsNode(StructureGUID, ElementGUID) {
  const subjectNode = ns.dis(`${StructureGUID}`);
  const objectNode = ns.dis[`${ElementGUID}`];
  const contains = ns.nen2660term.contains;

  // ADD CONTAINS NODE TO THE GRAPH
  disGraph
    .namedNode(subjectNode)
    .addOut(disGraph.namedNode(contains), disGraph.namedNode(objectNode));
}
// FUNCTION TO CREATE HASPART NODES IN THE GRAPH
async function createhasPartNode(StructureGUID, ElementGUID) {
  const subjectNode = ns.dis(`${StructureGUID}`);
  const objectNode = ns.dis[`${ElementGUID}`];
  const hasPart = ns.nen2660term.hasPart;

  // ADD CONTAINS NODE TO THE GRAPH
  disGraph
    .namedNode(subjectNode)
    .addOut(disGraph.namedNode(hasPart), disGraph.namedNode(objectNode));
}

//FUNCTION TO CREATE ATTRIBUTE NODES IN THE GRAPH
async function createSimpleAttribute(GUID, AttName, AttValue, dataType) {
  const instance = ns.dis(`${GUID}`);
  const attributeInstanceNode = ns.dis(`${GUID}-${AttName}`);
  const attOTLNode = ns.otl[`has${AttName}`];
  const attributeValue = disGraph.literal(`${AttValue}`, dataType);

  // ADD TYPE NODE TO THE GRAPH
  disGraph
    .namedNode(instance)
    .addOut(attOTLNode, attributeValue);
}

// FUNCTION TO EXTRACT ENUMERATIONS FROM THE MODEL
async function extractEnumerations(modelID) {
  const IfcElementEntities = ifcapi.GetLineIDsWithType(
    modelID,
    IFCELEMENT,
    true
  );

  // LOOP THROUGH RELATIONSHIPS DEFINED BY TYPE
  for (let i = 0; i < IfcElementEntities.size(); i++) {
    const IfcElementExpressID = IfcElementEntities.get(i);
    const IfcElementProps = await ifcapi.properties.getItemProperties(
      modelID,
      IfcElementExpressID
    );

    if (
      IfcElementProps.PredefinedType &&
      IfcElementProps.PredefinedType.value !== "USERDEFINED" &&
      IfcElementProps.PredefinedType.value !== "NOTDEFINED"
    ) {
      createTypeNode(
        IfcElementProps.GlobalId.value,
        IfcElementProps.constructor.name.slice(3),
        IfcElementProps.PredefinedType.value
      );
    } else if (
      IfcElementProps.PredefinedType &&
      IfcElementProps.PredefinedType.value === "USERDEFINED"
    ) {
      createUserDefinedTypeNode(
        IfcElementProps.GlobalId.value,
        `${IfcElementProps.constructor.name.slice(3)}-USERDEFINED`,
        IfcElementProps.ObjectType.value
      );

      createsubClassOfNode(
        IfcElementProps.constructor.name.slice(3),
        IfcElementProps.ObjectType.value
      );
      // createTypeNode(IfcElementProps.GlobalId.value, IfcElementProps.constructor.name.slice(3), null);
    } else {
      createClassNode(
        IfcElementProps.GlobalId.value,
        IfcElementProps.constructor.name.slice(3)
      );
    }
  }
}

// FUNCTION TO EXTRACT SPACES FROM THE MODEL
async function extractContainedElements(modelID) {
  const ifcContainedEntities = ifcapi.GetLineIDsWithType(
    modelID,
    IFCRELCONTAINEDINSPATIALSTRUCTURE
  );

  // LOOP THROUGH CONTAINED ENTITIES
  for (let i = 0; i < ifcContainedEntities.size(); i++) {
    const ifcContainedEntitiesExpressID = ifcContainedEntities.get(i);
    const ifcContainedEntityProps = await ifcapi.properties.getItemProperties(
      modelID,
      ifcContainedEntitiesExpressID
    );
    const ifcRelatingStructureExpressID =
      ifcContainedEntityProps.RelatingStructure.value;
    const ifcRelatingEntityProps = await ifcapi.properties.getItemProperties(
      modelID,
      ifcRelatingStructureExpressID
    );

    // LOOP THROUGH RELATED ELEMENTS
    for (let i of ifcContainedEntityProps.RelatedElements) {
      const ifcRelatedElementsExpressID = i.value;
      const ifcRelatedElementProps = await ifcapi.properties.getItemProperties(
        modelID,
        ifcRelatedElementsExpressID
      );
      if (ifcRelatingEntityProps.PredefinedType != undefined) {
        for (let i of ifcContainedEntityProps.RelatedElements) {
          const ifcRelatedElementsExpressID = i.value;
          const ifcRelatedElementProps =
            await ifcapi.properties.getItemProperties(
              modelID,
              ifcRelatedElementsExpressID
            );
          createContainsNode(
            ifcRelatingEntityProps.GlobalId.value,
            ifcRelatedElementProps.GlobalId.value
          );
        }
      } else {
        for (let i of ifcContainedEntityProps.RelatedElements) {
          const ifcRelatedElementsExpressID = i.value;
          const ifcRelatedElementProps =
            await ifcapi.properties.getItemProperties(
              modelID,
              ifcRelatedElementsExpressID
            );
          createContainsNode(
            ifcRelatingEntityProps.GlobalId.value,
            ifcRelatedElementProps.GlobalId.value
          );
          createClassNode(
            ifcRelatingEntityProps.GlobalId.value,
            ifcRelatingEntityProps.constructor.name.slice(3)
          );
        }
      }
    }
  }
}

// FUNCTION TO EXTRACT SPATIAL AGGREGATION
async function extractSpatialAggregation(modelID) {
  const ifcContainedEntities = ifcapi.GetLineIDsWithType(
    modelID,
    IFCRELAGGREGATES
  );

  // LOOP THROUGH CONTAINED ENTITIES
  for (let i = 0; i < ifcContainedEntities.size(); i++) {
    const ifcContainedEntitiesExpressID = ifcContainedEntities.get(i);
    const ifcContainedEntityProps = await ifcapi.properties.getItemProperties(
      modelID,
      ifcContainedEntitiesExpressID
    );
    const ifcRelatingStructureExpressID =
      ifcContainedEntityProps.RelatingObject.value;
    const ifcRelatingEntityProps = await ifcapi.properties.getItemProperties(
      modelID,
      ifcRelatingStructureExpressID
    );

    for (let i of ifcContainedEntityProps.RelatedObjects) {
      const ifcRelatedElementsExpressID = i.value;
      var ifcRelatedElementProps = await ifcapi.properties.getItemProperties(
        modelID,
        ifcRelatedElementsExpressID
      );
      createhasPartNode(
        ifcRelatingEntityProps.GlobalId.value,
        ifcRelatedElementProps.GlobalId.value
      );

      if (ifcRelatedElementProps.PredefinedType?.value != undefined) {
        // console.log(ifcRelatedElementProps.PredefinedType?.value);
        createTypeNode(
          ifcRelatedElementProps.GlobalId.value,
          ifcRelatedElementProps.constructor.name.slice(3),
          ifcRelatedElementProps.PredefinedType.value
        );
      } else {
        createClassNode(
          ifcRelatedElementProps.GlobalId.value,
          ifcRelatedElementProps.constructor.name.slice(3)
        );
      }
    }
  }
}

async function getProjectUnits(modelID) {
  const unitDict = {};
  const allUnitsExpressID = ifcapi.GetLineIDsWithType(
    modelID,
    IFCUNITASSIGNMENT,
    true
  );
  for (let i = 0; i < allUnitsExpressID.size(); i++) {
    const allUnits = allUnitsExpressID.get(i);
    const unitsProps = ifcapi.GetLine(modelID, allUnits);
    for (let i = 0; i < Object.keys(unitsProps.Units).length; i++) {
      const UnitID = unitsProps.Units[i].value;
      const unit = ifcapi.GetLine(modelID, UnitID);
      if (unit.constructor.name === "IfcSIUnit") {
        if (unit.Prefix !== null) {
          const key = unit.UnitType.value;
          const val = unit.Prefix.value + unit.Name.value;
          unitDict[key] = val;
        } else {
          const key = unit.UnitType.value;
          const val = unit.Name.value;
          unitDict[key] = val;
        }
      }
    }
  }
  return unitDict;
}

async function extractAttributes(modelID) {
  const IfcElementEntities = ifcapi.GetLineIDsWithType(
    modelID,
    IFCELEMENT,
    true
  );
  for (let i = 0; i < IfcElementEntities.size(); i++) {
    const IfcElementExpressID = IfcElementEntities.get(i);
    const IfcElementProps = await ifcapi.properties.getItemProperties(
      modelID,
      IfcElementExpressID
    );
    console.log(IfcElementProps);
    for (let i in IfcElementProps) {
      if (i == "GlobalId") {
        createSimpleAttribute(
          IfcElementProps.GlobalId.value,
          i,
          IfcElementProps.GlobalId.value,
          xsd.string
        );
    //   // } else if (i == "NominalLength") {
    //   //   createAttNode(
    //   //     IfcElementProps.GlobalId.value,
    //   //     i,
    //   //     IfcElementProps.NominalLength.value
    //   //   );
      }
    }
  }
}

async function createProjectNode(modelID) {
  const ifcProjects = ifcapi.GetLineIDsWithType(modelID, IFCPROJECT, true);

  for (let i = 0; i < ifcProjects.size(); i++) {
    const ifcProjectExpressID = ifcProjects.get(i);
    const ifcProjectProps = await ifcapi.properties.getItemProperties(
      modelID,
      ifcProjectExpressID
    );
    // console.log(ifcProjectProps);
    // LOOP THROUGH CONTAINED ENTITIES
    createClassNode(
      ifcProjectProps.GlobalId.value,
      ifcProjectProps.constructor.name.slice(3)
    );
  }
}

// FUNCTION TO LOG GRAPH TO CONSOLE
async function logGraph(ifcFile) {
  await loadFile(ifcFile);
  for (const quad of disGraph.dataset) {
    console.log(
      `${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`
    );
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
  const projectUnits = await getProjectUnits(modelID);
  console.log(projectUnits);
  await extractAttributes(modelID);
  await extractEnumerations(modelID);
  await extractContainedElements(modelID);
  await extractSpatialAggregation(modelID);
  await createProjectNode(modelID);
  const data = disGraph.dataset;
  await writeDataToFile(data, ttlFile, ttlSerializer);
  await writeDataToFile(data, jsonldFile, jsonldSerializer);
}

// RUNNING THE PROGRAM WITH SAMPLE FILES
runProgram("Arch2.ifc", "Arch6.ttl", "Arch5.jsonld");
