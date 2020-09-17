import MyService from './my.service';
import { Client, Request } from '@pepperi-addons/debug-server';
import { ATDSettings, DataView, ApiFieldObject, UserDefinedTableMetaData } from '@pepperi-addons/papi-sdk';
import fetch from 'node-fetch';
import jwt_decode from 'jwt-decode';
// #region export_atd

export async function export_atd(client: Client, request: Request) {
    const service = new MyService(client);
    const references: Reference[] = [];
    const params = request.query;

    const type = params.type;
    const subtypeid = params.subtype;
    //let decodeAccessCode = getDecodedAccessToken(client.OAuthAccessToken);
    const decoded = jwt_decode(client.OAuthAccessToken);
    const distUUID = decoded['pepperi.distributoruuid'];
    //const type = `transactions`;
    //const subtypeid = `141056`;

    //const type = `activities`;
    //const subtypeid = `141057`;
    const data_views = await service.papiClient.metaData.dataViews.find({ where: `Context.Object.Resource='${type}'` });

    //const data_views = await service.papiClient.get('/meta_data/data_views');
    await getDataViewReferences(references, data_views);

    const workflow = await service.papiClient.get(`/meta_data/${type}/types/${subtypeid}/workflow_legacy`);
    await getWorkflowReferences(service, references, workflow);

    const settings = await service.papiClient.metaData.type(type).types.subtype(subtypeid).settings.get();

    if (type === `transactions`) {
        const settings = await service.papiClient.metaData.type(type).types.subtype(subtypeid).settings.get();
        await getSettingsReferences(service, references, settings);
    }

    const fields = await service.papiClient.get(`/meta_data/${type}/types/${subtypeid}/fields?include_own=false`);
    //await service.papiClient.metaData.type(type).types.subtype(subtypeid).fields.get();

    let linesFields;
    if (type === `transactions`) {
        //linesFields = await service.papiClient.metaData.type(`transaction_lines`).types.subtype(subtypeid).fields.get();
        linesFields = await service.papiClient.get(
            `/meta_data/transaction_lines/types/${subtypeid}/fields?include_own=false`,
        );
    }

    await getFieldsReferences(service, references, fields);

    const atdMetaData = await service.papiClient.metaData.type(type).types.subtype(subtypeid).get();

    const atd: ActivityTypeDefinition = {
        InternaID: String(atdMetaData.TypeID),
        DistributorUUID: distUUID,
        CreationDate: atdMetaData.CreationDate,
        ModificationDate: atdMetaData.ModificationDate,
        Hidden: atdMetaData.Hidden,
        Description: atdMetaData.Description,
        ExternalID: atdMetaData.ExternalID,
        Owner: atdMetaData.Owner,
        Addons: [],
        Settings: settings,
        Fields: fields,
        LinesFields: [],
        Workflow: workflow,
        DataViews: data_views,
        References: references,
    };

    if (linesFields != null) {
        atd.LinesFields = linesFields;
    }

    const presignedUrl = await service.papiClient.post(`/file_storage/temporary_upload_url`);
    await fillAddonReferences(service, atd, type, subtypeid);
    await callExportOfAddons(service, atd);
    await fetch(presignedUrl.UploadUrl, {
        method: `PUT`,
        body: JSON.stringify(atd),
    });

    return presignedUrl.PublicUrl;
}

export interface Owner {
    UUID: string;
}

export interface AddonOwner {
    ID: string;
    UUID: string;
}

export interface Reference {
    Type: ReferenceType;
    ID: string;
    Name: string;
    UUID?: string;
    Path?: string;
    Content?: string;
}

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

export interface Pair {
    origin: Reference;
    destinition: Reference;
}

export interface ReferencesMap {
    Pairs: Pair[];
}

async function fillAddonReferences(service: MyService, atd: ActivityTypeDefinition, type: string, subtypeid: string) {
    const addons = await service.papiClient.get(`/meta_data/${type}/types/${subtypeid}/addons`);
    addons.forEach((element) => {
        const addon: AddonOwner = {
            ID: element.InternalID,
            UUID: element.AddonUUID,
        };
        atd.Addons.push(addon);
    });
    if (type === `transactions`) {
        const addons = await service.papiClient.get(`/meta_data/transaction_lines/types/${subtypeid}/addons`);
        addons.forEach((element) => {
            const addon: AddonOwner = {
                ID: element.InternalID,
                UUID: element.AddonUUID,
            };
            atd.Addons.push(addon);
        });
    }
    // atd.Fields.forEach((field) => {
    //     FillAddonOwnerOfField(addons, field, atd);
    // });
    // atd.LinesFields?.forEach((field) => {
    //     FillAddonOwnerOfField(addons, field, atd);
    // });
    // atd.References.forEach((element) => {
    //     if (element.Type == 'UserDefinedTable') {
    //         const addonIndex = addons.findIndex((x) => x.TableID == element.ID);
    //         if (addonIndex > 0) {
    //             insertOwnerAddonIfNotExist(addonIndex, element.ID, addons, atd);
    //         }
    //     }
    // });
    atd.Addons = addons;
}

async function callExportOfAddons(service: MyService, atd: ActivityTypeDefinition) {
    atd.Addons.forEach((addon) => {
        service.papiClient.addons.installedAddons.addonUUID(addon.UUID).install;
    });
}

function FillAddonOwnerOfField(addons: any, field: ApiFieldObject, atd: ActivityTypeDefinition) {
    const addonIndex = addons.findIndex((x) => x.TableID == field.FieldID);
    insertOwnerAddonIfNotExist(addonIndex, field.FieldID, addons, atd);
}

function insertOwnerAddonIfNotExist(addonIndex: any, id: string, addons: any, atd: ActivityTypeDefinition) {
    if (addonIndex > 0) {
        const addonOwner: AddonOwner = {
            ID: id,
            UUID: addons[addonIndex].AddonUUID,
        };
        const isExist = atd.Addons.findIndex((x) => x.ID == id);
        if (isExist === -1) {
            atd.Addons.push(addonOwner);
        }
    }
}

async function getSettingsReferences(service: MyService, references: Reference[], settings: ATDSettings) {
    const accontsMetaData = await service.papiClient.metaData.type(`accounts`).types.get();
    const catalogs = await service.papiClient.get('/catalogs');

    if (settings.OriginAccountsData.IDs?.length > 0) {
        settings.OriginAccountsData.IDs.forEach((element) => {
            const accountIndex = accontsMetaData.findIndex((x) => String(x.TypeID) == element);
            const reference: Reference = {
                ID: String(accontsMetaData[accountIndex].TypeID),
                Name: accontsMetaData[accountIndex].ExternalID,
                Type: ReferenceType.ActivityTypeDefinition,
            };
            const isExist = references.findIndex((x) => x.ID == reference.ID);
            if (isExist === -1) {
                references.push(reference);
            }
        });
    }
    if (settings.DestinationAccountsData.IDs?.length > 0) {
        settings.DestinationAccountsData.IDs.forEach((element) => {
            const accountIndex = accontsMetaData.findIndex((x) => String(x.TypeID) == element);
            const reference: Reference = {
                ID: String(accontsMetaData[accountIndex].TypeID),
                Name: accontsMetaData[accountIndex].ExternalID,
                Type: ReferenceType.ActivityTypeDefinition,
            };
            const isExist = references.findIndex((x) => x.ID == reference.ID);
            if (isExist === -1) {
                references.push(reference);
            }
        });
    }

    if (settings.CatalogIDs?.length > 0) {
        settings.CatalogIDs.forEach((CatalogID) => {
            catalogs.forEach((catalog) => {
                if (catalog.InternalID === CatalogID) {
                    const reference: Reference = {
                        ID: catalog.InternalID,
                        Name: catalog.ExternalID,
                        Type: ReferenceType.Catalog,
                        UUID: catalog.UUID,
                    };
                    const index = references.findIndex((x) => x.ID == reference.ID);
                    if (index === -1) references.push(reference);
                }
            });
        });
    }

    if (settings.TransactionItemsScopeFilterID != null && settings.TransactionItemsScopeFilterID != `0`) {
        const filter = await service.papiClient.get(`/meta_data/filters/${settings.TransactionItemsScopeFilterID}`);
        const reference: Reference = {
            ID: filter.InternalID,
            Name: filter.Name,
            Type: ReferenceType.Filter,
            UUID: filter.UUID,
            Content: JSON.stringify(filter.Data),
        };
        const isExist = references.findIndex((x) => x.ID == reference.ID);
        if (isExist === -1) {
            references.push(reference);
        }
    }
}

async function getFieldsReferences(service: MyService, references: Reference[], fields: ApiFieldObject[]) {
    await fields.forEach(async (field) => {
        if (field.TypeSpecificFields != null) {
            if (field.TypeSpecificFields.ReferenceToResourceType != null) {
                const referenceId = field.TypeSpecificFields.ReferenceToResourceType.ID;
                if (Object.values(Type).includes(referenceId)) {
                    const res = await service.papiClient.metaData.type(Type[referenceId]).types.get();

                    const index = res.findIndex((x) => x.ExternalID == field.TypeSpecificFields.ReferenceTo.ExternalID);
                    const reference: Reference = {
                        ID: String(res[index].TypeID),
                        Name: res[index].ExternalID,
                        Type: ReferenceType.ActivityTypeDefinition,
                        UUID: field.TypeSpecificFields.ReferenceTo.UUID,
                    };
                    const isExist = references.findIndex((x) => x.ID == reference.ID);
                    if (isExist === -1) {
                        references.push(reference);
                    }
                }
            }
            if (field.UserDefinedTableSource != null) {
                const tableID = field.UserDefinedTableSource.TableID;

                const udts: UserDefinedTableMetaData[] = await service.papiClient.metaData.userDefinedTables.get(
                    tableID,
                );
                const udt: UserDefinedTableMetaData = JSON.parse(JSON.stringify(udts));
                const reference: Reference = {
                    ID: udt.TableID,
                    Name: udt.TableID,
                    Type: ReferenceType.UserDefinedTable,
                    Content: JSON.stringify(udt),
                };
                const isExist = references.findIndex((x) => x.ID == reference.ID);
                if (isExist === -1) {
                    references.push(reference);
                }
            }
        }
    });
}

async function getDataViewReferences(references: Reference[], data_views: DataView[]) {
    data_views.forEach((element) => {
        const reference: Reference = {
            ID: String(element.Context.Profile.InternalID),
            Name: String(element.Context.Profile.Name),
            Type: ReferenceType.Profile,
        };
        const index = references.findIndex((x) => x.ID == reference.ID);
        if (index === -1) references.push(reference);
    });
}

async function getWorkflowReferences(service: MyService, references: Reference[], workflow: any) {
    const workflowReferences = workflow.WorkflowReferences;

    await workflowReferences.forEach((element) => {
        const reference: Reference = {
            ID: element.ID,
            Name: element.Name,
            Type: (<any>ReferenceType)[element.Type],
            UUID: element.UUID,
            Path: element.Path,
        };
        const index = references.findIndex((x) => x.ID == reference.ID);
        if (index === -1) {
            if (reference.Type === ReferenceType.CustomizationFile) {
                service.papiClient.fileStorage
                    .get(Number(reference.ID))
                    .then((res) => (reference.Path = JSON.parse(JSON.stringify(res)).URL));
            }
            references.push(reference);
        }
    });
}

enum Type {
    activities = 99,
    transactions = 2,
    accounts = 35,
}

//#endregion

//#region import_atd

export async function import_atd(client: Client, request: Request) {
    const params = request.query;
    const type = params.type;
    const subtypeid = params.subtype;
    const body = request.body;
    const map: ReferencesMap = body.ReferencesMap;

    const url: string = body.ExportAtdResultURL;
    let atd = <ActivityTypeDefinition>{};

    const atdStrng = await fetch(url, {
        method: `GET`,
    })
        .then((response) => response.json())
        .then((data) => (atd = data));
    request.method = 'POST';

    const service = new MyService(client);

    await fixProfilesOfDataViews(atd.DataViews, map);
    upsertDataViews(service, atd.DataViews);

    await fixReferencesOfFields(service, atd.Fields, map);
    upsertFields(service, atd.Fields, type, subtypeid);

    if (type === `transactions`) {
        upsertFields(service, atd.LinesFields, `transaction_lines`, subtypeid);
    }

    await fixWorkflowReferences(atd.Workflow, map);
    upsertWorkflow(service, atd.Workflow, type, subtypeid);
    if (type === `transactions`) {
        await fixSettingsReferences(service, atd.Settings, map);
        upsertSettings(service, type, subtypeid, atd.Settings);
    }
}

async function fixProfilesOfDataViews(dataViews: DataView[], map: ReferencesMap) {
    dataViews.forEach((dataview) => {
        const profileID = dataview.Context.Profile.InternalID;
        const pairIndex = map.Pairs.findIndex((x) => x.origin.ID === String(profileID));
        dataview.Context.Profile = map.Pairs[pairIndex].destinition;
    });
}

async function upsertDataViews(service: MyService, dataViews: DataView[]) {
    dataViews.forEach(async (dataview) => {
        try {
            await service.papiClient.post('/meta_data/data_views', dataview);
            console.log(`post data_view: ${dataview.InternalID} succeeded`);
        } catch (err) {
            console.log(`post data_view: ${dataview.InternalID} failed`, `body:${JSON.stringify(dataview)}`);
            console.error(`Error: ${err}`);
        }
    });
}

async function fixReferencesOfFields(service: MyService, fields: ApiFieldObject[], map: ReferencesMap) {
    fields.forEach(async (field) => {
        if (field.TypeSpecificFields != null) {
            if (field.TypeSpecificFields != null) {
                if (field.TypeSpecificFields.ReferenceToResourceType != null) {
                    const referenceUUID = field.TypeSpecificFields.ReferenceToResourceType.UUID;
                    if (referenceUUID != null) {
                        const pairIndex = map.Pairs.findIndex((x) => x.origin.UUID === String(referenceUUID));
                        field.TypeSpecificFields.ReferenceTo.ExternalID = map.Pairs[pairIndex].destinition.Name;
                        field.TypeSpecificFields.ReferenceTo.UUID = map.Pairs[pairIndex].destinition.UUID;
                    }
                }
            }
            if (field.UserDefinedTableSource != null) {
                const pairIndex = map.Pairs.findIndex((x) => x.origin.ID === field.UserDefinedTableSource.TableID);
                if (map.Pairs[pairIndex].destinition === null) {
                    const upsertUdt: UserDefinedTableMetaData = await service.papiClient.metaData.userDefinedTables.upsert(
                        JSON.parse(String(map.Pairs[pairIndex].origin.Content)),
                    );
                    field.UserDefinedTableSource.TableID = upsertUdt.TableID;
                    field.UserDefinedTableSource.MainKey.TableID = upsertUdt.MainKeyType.Name;
                    field.UserDefinedTableSource.SecondaryKey.TableID = upsertUdt.SecondaryKeyType.Name;
                }
            }
        }
    });
}

async function upsertFields(service: MyService, fields: ApiFieldObject[], type: string, subtype: string) {
    fields.forEach(async (field) => {
        try {
            if (field.FieldID.startsWith(`TSA`)) {
                await service.papiClient.metaData.type(type).types.subtype(subtype).fields.upsert(field);
                console.log(`post field: ${field.FieldID} succeeded`);
            }
        } catch (err) {
            console.log(
                `post field: ${field.FieldID} failed`,
                `type: ${type}`,
                `subtype: ${subtype}`,
                `body: ${JSON.stringify(field)}`,
            );
            console.error(`Error: ${err}`);
        }
    });
}

async function fixWorkflowReferences(workflow: any, map: ReferencesMap) {
    const referencesKeys: Array<string> = [
        'DESTINATION_ATD_ID',
        'FILE_ID',
        'HTML_FILE_ID',
        'ACCOUNT_LIST_ID',
        'ACTIVITY_LIST_ID',
    ];
    workflow.WorkflowObject.WorkflowTransitions.forEach((transition) => {
        transition.Actions.forEach((action) => {
            if (action.ActionType in WorkflowActionsWithRerefences) {
                if (referencesKeys.indexOf(action.KeyValue) > -1) {
                    action.KeyValue.forEach((keyvalue) => {
                        switch (keyvalue) {
                            case 'DESTINATION_ATD_ID':
                                findIDAndReplaceKeyValueWorkflow(map, action, 'DESTINATION_ATD_ID');
                                break;
                            case 'FILE_ID':
                                findIDAndReplaceKeyValueWorkflow(map, action, 'FILE_ID');
                                break;
                            case 'HTML_FILE_ID':
                                findIDAndReplaceKeyValueWorkflow(map, action, 'HTML_FILE_ID');
                                break;
                            case 'ACCOUNT_LIST_ID':
                                replaceListUUID(action, map, 'ACCOUNT_LIST_ID');
                                break;
                            case 'ACTIVITY_LIST_ID':
                                replaceListUUID(action, map, 'ACTIVITY_LIST_ID');
                                break;
                        }
                    });
                }
            }
        });
    });
}

async function upsertWorkflow(service: MyService, workflow: any, type: string, subtype: string) {
    try {
        await service.papiClient.post(`/meta_data/${type}/types/${subtype}/workflow_legacy`, workflow);
        console.log(`post workflow succeeded`);
    } catch (err) {
        console.log(
            `post Workflow : failed`,
            `type: ${type}`,
            `subtype: ${subtype}`,
            `body: ${JSON.stringify(workflow)}`,
        );
        console.error(err);
    }
}

function findIDAndReplaceKeyValueWorkflow(map: ReferencesMap, action: any, key: string) {
    const pairIndex = map.Pairs.findIndex((x) => x.origin.ID === String(action.KeyValue[key]));
    action.KeyValue[key] = map.Pairs[pairIndex].destinition.ID;
}

function replaceListUUID(action: any, map: ReferencesMap, key: string) {
    let genericListUUIDOfActivity = action.KeyValue[key];
    if (genericListUUIDOfActivity.startsWith('GL_')) {
        genericListUUIDOfActivity = genericListUUIDOfActivity.substring(3, genericListUUIDOfActivity.length);
        const pairIndex = map.Pairs.findIndex((x) => x.origin.UUID === String(genericListUUIDOfActivity));
        action.KeyValue[key] = map.Pairs[pairIndex].destinition.UUID;
    }
}

async function fixSettingsReferences(service: MyService, settings: ATDSettings, map: ReferencesMap) {
    const originAccountIds = <string[]>[];

    settings.OriginAccountsData.IDs?.forEach((id) => {
        const pairIndex = map.Pairs.findIndex((x) => x.origin.ID === String(id));
        if (pairIndex > -1) {
            originAccountIds.push(map.Pairs[pairIndex].destinition.ID);
        }
    });
    settings.OriginAccountsData.IDs = originAccountIds;

    const destinitionAccountIds = <string[]>[];

    settings.DestinationAccountsData.IDs.forEach((id) => {
        const pairIndex = map.Pairs.findIndex((x) => x.origin.ID === String(id));
        if (pairIndex > -1) {
            destinitionAccountIds.push(map.Pairs[pairIndex].destinition.ID);
        }
    });
    settings.DestinationAccountsData.IDs = originAccountIds;

    const catalogsIds = <number[]>[];
    settings.CatalogIDs.forEach((catalogID) => {
        const pairIndex = map.Pairs.findIndex((x) => String(x.origin.ID) === String(catalogID));
        if (pairIndex > -1) {
            catalogsIds.push(Number(map.Pairs[pairIndex].destinition.ID));
        }
    });
    settings.CatalogIDs = catalogsIds;

    const indexItemsScopeFilterID = map.Pairs.findIndex((x) => x.origin.ID === settings.TransactionItemsScopeFilterID);
    if (indexItemsScopeFilterID > -1) {
        if (map.Pairs[indexItemsScopeFilterID].destinition.ID === null) {
            const filter: any = {
                Name: map.Pairs[indexItemsScopeFilterID].origin.Name,
            };
            filter.Data = JSON.stringify(map.Pairs[indexItemsScopeFilterID].origin.Content);
            await service.papiClient.post(`/meta_data/filter`, filter);
        }
    }
}

async function upsertSettings(service: MyService, type: string, subtype: string, settings: ATDSettings) {
    try {
        await service.papiClient.metaData.type(type).types.subtype(subtype).settings.update(settings);
        console.log(`post settings succeeded`);
    } catch (err) {
        console.error(err);
    }
}

enum WorkflowActionsWithRerefences {
    DistributeActivity = 12,
    NavigateTo = 17,
    StopConditionCustomForm = 18,
    CustomClientForm = 20,
    ExportFile = 23,
    CopyOrder = 36,
    DistributeActivityWithRef = 38,
}
enum ReferenceType {
    None = 0,
    Profile = 1,
    GenericList = 2,
    CustomizationFile = 3,
    ActivityTypeDefinition = 4,
    Catalog = 5,
    Filter = 6,
    UserDefinedTable = 7,
}

//#endregion
