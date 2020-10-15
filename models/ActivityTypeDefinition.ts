import { Owner } from "./owner";
import { AddonOwner } from "./addonOwner";
import {
  ATDSettings,
  ApiFieldObject,
  DataView,
} from "@pepperi-addons/papi-sdk";
import { Reference } from "./reference";

export interface ActivityTypeDefinition {
  InternaID: string;
  ExternalID: string;
  DistributorUUID: string;
  Description: string;
  CreationDate: string;
  ModificationDate: string;
  Hidden: boolean;
  Owner: Owner;
  Addons: AddonOwner[];
  Settings: ATDSettings;
  Fields: ApiFieldObject[];
  LinesFields: ApiFieldObject[];
  DataViews: DataView[];
  Workflow: any;
  References: Reference[];
}
