import MyService from './my.service';
import { Client, Request } from '@pepperi-addons/debug-server';
import { DataView, ApiFieldObject, UserDefinedTableMetaData, ATDMetaData } from '@pepperi-addons/papi-sdk';
import fetch from 'node-fetch';
import jwt_decode from 'jwt-decode';
import { ActivityTypeDefinition } from '../models/activityTypeDefinition';
import { References } from '../models/referencesMap';
import { Reference } from '../models/reference';
import { AddonOwner } from '../models/addonOwner';
import { ReferenceType } from '../models/referenceType';
import { ObjectType } from '../models/objectType.enum';
import { WorkflowActionsWithRerefences } from '../models/workflowActionsWithRerefences.enum';
import { ATDSettings } from '@pepperi-addons/papi-sdk';

// #region export_atd

export async function export_type_definition(client: Client, request: Request) {
    const service = new MyService(client);
    const params = request.query;

    const type = params.type;
    const subtypeid = params.subtype;
    const url = await doExport(type, subtypeid, service);
    return url;
}

async function doExport(type: string, subtypeid: string, service: MyService): Promise<any> {
    const references: Reference[] = [];
    let atd = {} as ActivityTypeDefinition;
    let atdMetaData: ATDMetaData;
    let fields: ApiFieldObject[];
    let linesFields: ApiFieldObject[];
    let dataViews: DataView[];
    let settings: ATDSettings;
    let workflow;

    const getDataPromises: Promise<any>[] = [];

    getDataPromises.push(service.papiClient.metaData.type(type).types.subtype(subtypeid).get());
    getDataPromises.push(
        service.papiClient.metaData.dataViews.find({
            where: `Context.Object.Resource='${type}' and Context.Object.InternalID=${subtypeid}`,
        }),
    );
    getDataPromises.push(service.papiClient.get(`/meta_data/${type}/types/${subtypeid}/workflow_legacy`));
    getDataPromises.push(
        service.papiClient.metaData.type(type).types.subtype(subtypeid).fields.get({ include_owned: false }),
    );

    if (type === `transactions`) {
        getDataPromises.push(service.papiClient.metaData.type(type).types.subtype(subtypeid).settings.get());
        getDataPromises.push(
            service.papiClient.metaData
                .type(`transaction_lines`)
                .types.subtype(subtypeid)
                .fields.get({ include_owned: false }),
        );
    }

    await Promise.all(getDataPromises).then(async (result1) => {
        console.log(`result1: ${result1}`);
        atdMetaData = result1[0] as ATDMetaData;
        dataViews = result1[1] as DataView[];
        workflow = result1[2];
        fields = result1[3] as ApiFieldObject[];

        const getReferencesPromises: Promise<void>[] = [];
        getReferencesPromises.push(getDataViewReferences(references, dataViews));
        getReferencesPromises.push(getWorkflowReferences(service, references, workflow));
        getReferencesPromises.push(getFieldsReferences(service, references, fields));

        if (type === `transactions`) {
            settings = result1[4] as ATDSettings;
            linesFields = result1[5] as ApiFieldObject[];
            getReferencesPromises.push(getSettingsReferences(service, references, settings));
            getReferencesPromises.push(getFieldsReferences(service, references, linesFields));
        }
        await Promise.all(getReferencesPromises).then(async (result2) => {
            console.log(`result2: ${result2}`);
            atd = {
                UUID: '', //atdMetaData.UUID,
                InternaID: String(atdMetaData.TypeID),
                CreationDateTime: atdMetaData.CreationDate,
                ModificationDateTime: atdMetaData.ModificationDate,
                Hidden: atdMetaData.Hidden,
                Description: atdMetaData.Description,
                ExternalID: atdMetaData.ExternalID,
                Addons: [],
                Settings: settings,
                Fields: fields,
                LineFields: [],
                Workflow: workflow,
                References: references,
                DataViews: dataViews,
            };

            if (linesFields != null) {
                atd.LineFields = linesFields;
            }
            const handleAddonPromises: Promise<void>[] = [];
            handleAddonPromises.push(fillAddonReferencesAsync(service, atd, type, subtypeid));
            handleAddonPromises.push(callExportOfAddons(service, atd));

            await Promise.all(handleAddonPromises);
        });
    });

    const presignedUrl = await service.papiClient.post(`/file_storage/tmp`);

    await fetch(presignedUrl.UploadURL, {
        method: `PUT`,
        body: JSON.stringify(atd),
    });

    return { URL: presignedUrl.DownloadURL };
}

async function fillAddonReferencesAsync(
    service: MyService,
    atd: ActivityTypeDefinition,
    type: string,
    subtypeid: string,
) {
    //const addons = await service.papiClient.metaData.type(type).types.subtype(subtypeid).addons();
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
    atd.Addons = addons;
}

async function callExportOfAddons(service: MyService, atd: ActivityTypeDefinition) {
    atd.Addons.forEach((addon) => {
        service.papiClient.addons.installedAddons.addonUUID(addon.UUID).install(); // Should be export
    });
}

function fillAddonOwnerOfField(addons: any, field: ApiFieldObject, atd: ActivityTypeDefinition) {
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
                Type: ReferenceType.TypeDefinition,
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
                Type: ReferenceType.TypeDefinition,
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
            Name: 'Transaction Item Scope',
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
    fields.forEach(async (field) => {
        if (field.TypeSpecificFields != null) {
            if (field.TypeSpecificFields.ReferenceToResourceType != null) {
                const referenceId = field.TypeSpecificFields.ReferenceToResourceType.ID;
                if (referenceId in ObjectType.values()) {
                    const res = await service.papiClient.metaData.type(ObjectType.toString(referenceId)).types.get();
                    const index = res.findIndex((x) => x.ExternalID == field.TypeSpecificFields.ReferenceTo.ExternalID);
                    const reference: Reference = {
                        ID: String(res[index].TypeID),
                        Name: res[index].ExternalID,
                        Type: ReferenceType.TypeDefinition,
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
                    ID: String(udt.InternalID),
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
            ID: String(element.Context?.Profile.InternalID),
            Name: String(element.Context?.Profile.Name),
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
            Type: ReferenceType[element.Type],
            UUID: element.UUID,
            Path: element.Path,
            Content: element.Content,
        };
        const index = references.findIndex((x) => x.ID == reference.ID);
        if (index === -1) {
            if (reference.Type === ReferenceType.FileStorage) {
                service.papiClient.fileStorage
                    .get(Number(reference.ID))
                    .then((res) => (reference.Path = JSON.parse(JSON.stringify(res)).URL));
            }
            references.push(reference);
        }
    });
}

//#endregion

//#region import_atd

export async function import_type_definition(client: Client, request: Request) {
    const params = request.query;
    const type = params.type;
    const subtypeid = params.subtype;
    const body = request.body;
    const map: References = body.References;
    const url: string = body.URL;
    const service = new MyService(client);
    request.method = 'POST';
    const distUUID = getDistributorUUID(client);

    const backupAtd = await doExport(type, subtypeid, service);

    const succeeded = await doImport(type, subtypeid, url, map, service);

    if (succeeded) {
        return `success`;
    } else {
        await doImport(type, subtypeid, backupAtd.URL, null, service);
        return `failed`;
    }
}

function getDistributorUUID(client: Client) {
    const decoded = jwt_decode(client.OAuthAccessToken);
    const distUUID = decoded['pepperi.distributoruuid'];
    return distUUID;
}

async function callImportOfAddons(service: MyService, atd: ActivityTypeDefinition) {
    atd.Addons.forEach((addon) => {
        service.papiClient.addons.installedAddons.addonUUID(addon.UUID).install(); // Should be import
    });
}

async function doImport(
    type: string,
    subtypeid: string,
    url: string,
    map: References | null,
    service: MyService,
): Promise<boolean> {
    let atd = <ActivityTypeDefinition>{};
    let succeeded = false;
    await fetch(url, {
        method: `GET`,
    })
        .then((response) => response.json())
        .then((data) => (atd = data));

    const fixReferencesPromises: Promise<boolean>[] = []; /// array of promises.

    if (map !== null && map != undefined) {
        // const fixReferencesPromises: [Promise<boolean>, Promise<boolean>, Promise<boolean>] = []
        fixReferencesPromises.push(fixProfilesOfDataViews(Number(subtypeid), atd.DataViews, map));
        fixReferencesPromises.push(fixReferencesOfFields(service, atd.Fields, map));
        fixReferencesPromises.push(fixWorkflowReferences(atd.Workflow, map));

        if (type === `transactions`) {
            fixReferencesPromises.push(fixSettingsReferences(service, atd.Settings, map));
        }
    }

    await Promise.all(fixReferencesPromises).then(async (fixReferencesResults) => {
        console.log(`result1: ${fixReferencesResults}`);
        succeeded = fixReferencesResults.every((elem) => elem === true);
        const upsertDataPromises: [Promise<boolean>, Promise<boolean>, Promise<boolean>] = [
            upsertDataViews(service, atd.DataViews),
            upsertFields(service, atd.Fields, type, subtypeid),
            upsertWorkflow(service, atd.Workflow, type, subtypeid),
        ];
        if (type === `transactions`) {
            upsertDataPromises.push(upsertFields(service, atd.LineFields, `transaction_lines`, subtypeid));
            upsertDataPromises.push(upsertSettings(service, type, subtypeid, atd.Settings));
        }
        await Promise.all(upsertDataPromises).then((upsertDataResults) => {
            console.log(`result2: ${upsertDataResults}`);
            succeeded = upsertDataResults.every((elem) => elem === true);
        });
    });
    return succeeded;
}

async function upsertSettings(
    service: MyService,
    type: string,
    subtype: string,
    settings: ATDSettings,
): Promise<boolean> {
    try {
        await service.papiClient.metaData.type(type).types.subtype(subtype).settings.update(settings);
        console.log(`post settings succeeded`);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

async function upsertWorkflow(service: MyService, workflow: any, type: string, subtype: string): Promise<boolean> {
    try {
        await service.papiClient.post(`/meta_data/${type}/types/${subtype}/workflow_legacy`, workflow);
        console.log(`post workflow succeeded`);
        return true;
    } catch (err) {
        console.error(
            `post Workflow : failed`,
            `type: ${type}`,
            `subtype: ${subtype}`,
            `body: ${JSON.stringify(workflow)}`,
        );
        console.error(err);
        return false;
    }
}

async function upsertDataViews(service: MyService, dataViews: DataView[]): Promise<boolean> {
    try {
        //fs.writeFile(,'test', JSON.stringify({ hack: dataViews }));
        //fs.writeFileSync('test.Json', JSON.stringify({ hack: dataViews }));
        console.debug(`posting data views: ${JSON.stringify({ hack: dataViews })}`);
        dataViews.forEach((dataView) => delete dataView.InternalID);
        await service.papiClient.post('/meta_data/data_views_batch', { hack: dataViews });
        console.log(`post data views batch succeeded`);
        return true;
    } catch (err) {
        //console.log(`post data_view: ${dataview.InternalID} failed`, `body:${JSON.stringify(dataview)}`);
        console.error(`posting data views failed. Error: ${err}`);
        return false;
    }
    // dataViews.forEach(async (dataview) => {
    //     try {
    //         await service.papiClient.post('/meta_data/data_views', dataview);
    //         console.log(`post data_view: ${dataview.InternalID} succeeded`);
    //     } catch (err) {
    //         console.log(`post data_view: ${dataview.InternalID} failed`, `body:${JSON.stringify(dataview)}`);
    //         console.error(`Error: ${err}`);
    //     }
    // });
}

async function upsertFields(
    service: MyService,
    fields: ApiFieldObject[],
    type: string,
    subtype: string,
): Promise<boolean> {
    try {
        fields = fields.filter((item) => item.FieldID.startsWith('TSA'));
        fields.forEach((f) => delete f.InternalID);
        let currentFields = await service.papiClient.metaData
            .type(type)
            .types.subtype(subtype)
            .fields.get({ include_owned: false });
        currentFields = currentFields.filter((item) => item.FieldID.startsWith('TSA'));
        const filedsNamesToUpsert = fields.map((f) => f.FieldID);
        const fieldsToDelete = currentFields.filter((x) => filedsNamesToUpsert.indexOf(x.FieldID) === -1);
        fieldsToDelete.forEach((ftd) => (ftd.Hidden = true));
        if (fieldsToDelete.length > 0) {
            await service.papiClient.post(`/meta_data/bulk/${type}/types/${subtype}/fields`, fieldsToDelete);
        }
        if (fields.length > 0) {
            await service.papiClient.post(`/meta_data/bulk/${type}/types/${subtype}/fields`, fields);
        }
        console.log(`post fields batch succeeded`);
        return true;
    } catch (err) {
        console.error(`Error: ${err}`);
        return false;
    }
    // fields.forEach(async (field) => {
    //     try {
    //         if (field.FieldID.startsWith(`TSA`)) {
    //             await service.papiClient.metaData.type(type).types.subtype(subtype).fields.upsert(field);
    //             console.log(`post field: ${field.FieldID} succeeded`);
    //         }
    //     } catch (err) {
    //         console.log(
    //             `post field: ${field.FieldID} failed`,
    //             `type: ${type}`,
    //             `subtype: ${subtype}`,
    //             `body: ${JSON.stringify(field)}`,
    //         );
    //         console.error(`Error: ${err}`);
    //     }
    // });
}

async function fixSettingsReferences(service: MyService, settings: ATDSettings, map: References): Promise<boolean> {
    try {
        const originAccountIds = <string[]>[];

        settings.OriginAccountsData.IDs?.forEach((id) => {
            const pairIndex = map.Mapping.findIndex((x) => x.Origin.ID === String(id));
            if (pairIndex > -1) {
                originAccountIds.push(map.Mapping[pairIndex].Destination.ID);
            }
        });
        settings.OriginAccountsData.IDs = originAccountIds;

        const destinitionAccountIds = <string[]>[];

        settings.DestinationAccountsData.IDs?.forEach((id) => {
            const pairIndex = map.Mapping.findIndex((x) => x.Origin.ID === String(id));
            if (pairIndex > -1) {
                destinitionAccountIds.push(map.Mapping[pairIndex].Destination.ID);
            }
        });
        settings.DestinationAccountsData.IDs = originAccountIds;

        const catalogsIds = <number[]>[];
        settings.CatalogIDs?.forEach((catalogID) => {
            const pairIndex = map.Mapping.findIndex((x) => String(x.Origin.ID) === String(catalogID));
            if (pairIndex > -1) {
                catalogsIds.push(Number(map.Mapping[pairIndex].Destination.ID));
            }
        });
        settings.CatalogIDs = catalogsIds;

        const indexItemsScopeFilterID = map.Mapping.findIndex(
            (x) => x.Origin.ID === settings.TransactionItemsScopeFilterID,
        );
        if (indexItemsScopeFilterID > -1) {
            if (
                map.Mapping[indexItemsScopeFilterID] !== null &&
                map.Mapping[indexItemsScopeFilterID].Destination !== null &&
                map.Mapping[indexItemsScopeFilterID].Destination.ID !== null
            ) {
                settings.TransactionItemsScopeFilterID = map.Mapping[indexItemsScopeFilterID].Destination.ID;
            }
        }
        return true;
    } catch (err) {
        return false;
    }
}

async function fixReferencesOfFields(service: MyService, fields: ApiFieldObject[], map: References): Promise<boolean> {
    try {
        fields.forEach(async (field) => {
            if (field.TypeSpecificFields != null) {
                if (field.TypeSpecificFields != null) {
                    if (field.TypeSpecificFields.ReferenceToResourceType != null) {
                        const referenceUUID = field.TypeSpecificFields.ReferenceToResourceType.UUID;
                        if (referenceUUID != null) {
                            const pairIndex = map.Mapping.findIndex((x) => x.Origin.UUID === String(referenceUUID));
                            field.TypeSpecificFields.ReferenceTo.ExternalID = map.Mapping[pairIndex].Destination.Name;
                            field.TypeSpecificFields.ReferenceTo.UUID = map.Mapping[pairIndex].Destination.UUID;
                        }
                    }
                }
                if (field.UserDefinedTableSource != null) {
                    const pairIndex = map.Mapping.findIndex(
                        (x) => x.Origin.ID === field.UserDefinedTableSource.TableID,
                    );
                    // if (map.Pairs[pairIndex].destinition === null) {
                    //     const upsertUdt: UserDefinedTableMetaData = await service.papiClient.metaData.userDefinedTables.upsert(
                    //         JSON.parse(String(map.Pairs[pairIndex].origin.Content)),
                    //     );
                    //     field.UserDefinedTableSource.TableID = upsertUdt.TableID;
                    //     field.UserDefinedTableSource.MainKey.TableID = upsertUdt.MainKeyType.Name;
                    //     field.UserDefinedTableSource.SecondaryKey.TableID = upsertUdt.SecondaryKeyType.Name;
                    // }
                    //field.UserDefinedTableSource.TableID = map.Pairs[pairIndex].destinition.
                }
            }
        });
        return true;
    } catch (err) {
        return false;
    }
}

async function fixWorkflowReferences(workflow: any, map: References): Promise<boolean> {
    try {
        const referencesKeys: Array<string> = [
            'DESTINATION_ATD_ID',
            'FILE_ID',
            'HTML_FILE_ID',
            'ACCOUNT_LIST_ID',
            'ACTIVITY_LIST_ID',
            'SECRET_KEY',
            'WEBHOOK_URL',
        ];
        console.log(`workflow: ${JSON.stringify(workflow)}`);
        getReferecesObjects(workflow.WorkflowObject.WorkflowTransitions, workflow, referencesKeys, map);
        getReferecesObjects(workflow.WorkflowObject.WorkflowPrograms, workflow, referencesKeys, map);

        return true;
    } catch (err) {
        return false;
    }
}

function getReferecesObjects(transitions: any, workflow: any, referencesKeys: string[], map: References) {
    transitions.forEach((transition) => {
        console.log(`transition: ${transition.TransitionID}`);
        transition.Actions.forEach((action) => {
            const workflowActionsWithRerefences = WorkflowActionsWithRerefences.values();
            if (workflowActionsWithRerefences.indexOf(WorkflowActionsWithRerefences.toString(action.ActionType)) > -1) {
                Object.keys(action.KeyValue).forEach((element) => {
                    if (referencesKeys.indexOf(element) > -1) {
                        if (element) {
                            //action.KeyValue.forEach((keyvalue) => {
                            switch (element) {
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
                                case 'WEBHOOK_URL':
                                    replaceWebhookUrl(action, map, 'WEBHOOK_URL');
                                    break;
                                case 'SECRET_KEY':
                                    replaceSecretKey(action, map, 'SECRET_KEY');
                                    break;
                            }
                            //});
                        }
                    }
                });
            }
        });
    });
}

async function fixProfilesOfDataViews(subtypeid: number, dataViews: DataView[], map: References): Promise<boolean> {
    try {
        dataViews.forEach((dataview) => {
            if (dataview.Context?.Object?.InternalID) {
                dataview.Context.Object.InternalID = Number(subtypeid);
            }
            delete dataview.InternalID;
            const profileID = dataview.Context?.Profile.InternalID;
            const pairIndex = map.Mapping.findIndex((x) => x.Origin.ID === String(profileID));
            if (dataview?.Context?.Profile?.InternalID) {
                dataview.Context.Profile.InternalID = Number(map.Mapping[pairIndex].Destination.ID);
            }
        });
        return true;
    } catch (err) {
        return false;
    }
}

function findIDAndReplaceKeyValueWorkflow(map: References, action: any, key: string) {
    const pairIndex = map.Mapping.findIndex((x) => x.Origin.ID === String(action.KeyValue[key]));
    action.KeyValue[key] = map.Mapping[pairIndex].Destination.ID;
}

function replaceListUUID(action: any, map: References, key: string) {
    let genericListUUIDOfActivity = action.KeyValue[key];
    if (genericListUUIDOfActivity.startsWith('GL_')) {
        genericListUUIDOfActivity = genericListUUIDOfActivity.substring(3, genericListUUIDOfActivity.length);
        const pairIndex = map.Mapping.findIndex((x) => x.Origin.UUID === String(genericListUUIDOfActivity));
        if (pairIndex > -1) {
            action.KeyValue[key] = map.Mapping[pairIndex].Destination.UUID;
        }
    }
}

function replaceWebhookUrl(action: any, map: References, key: string) {
    const pairIndex = map.Mapping.findIndex((x) => x.Origin.UUID === String(action.ActionID));
    if (pairIndex > -1) {
        action.KeyValue[key] = map.Mapping[pairIndex].Destination.Content.WEBHOOK_URL;
    }
}

function replaceSecretKey(action: any, map: References, key: string) {
    const pairIndex = map.Mapping.findIndex((x) => x.Origin.UUID === String(action.ActionID));
    if (pairIndex > -1) {
        action.KeyValue[key] = map.Mapping[pairIndex].Destination.Content.SECRET_KEY;
    }
}
//#endregion
