// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import {
  FileStorage,
  UserDefinedTableMetaData,
  Type,
} from "@pepperi-addons/papi-sdk";

export interface ReferenceData {
  Filter: [];
  UserDefinedTable: UserDefinedTableMetaData[];
  CustomizationFile: FileStorage[];
  ActivityTypeDefinition: Type[];
  Profile: [];
  Catalog: [];
  GenericList: [];
}
