import type {
    CheckAndPrepareGroups,
    RemoveSpecificComponents,
    ResolveGroups,
} from "./components.types";
import type {
    SyncAllComponents,
    SyncComponents,
    SyncProvidedComponents,
} from "./migrate.types";
import type { RequestBaseConfig } from "./utils/request";

import {
    compare,
    discover,
    discoverMany,
    discoverManyByPackageName,
    LOOKUP_TYPE,
    SCOPE,
} from "../../utils/discover";
import Logger from "../../utils/logger";
import { getFileContentWithRequire, isObjectEmpty } from "../../utils/main";
import { createComponent, updateComponent } from "../mutateComponents";

import {
    createComponentsGroup,
    getAllComponents,
    getAllComponentsGroups,
    removeComponent,
    removeComponentGroup,
} from "./components";
import { _uniqueValuesFrom } from "./utils/helper-functions";


const _checkAndPrepareGroups: CheckAndPrepareGroups = async (
    groupsToCheck,
    config
) => {
    const componentsGroups = await getAllComponentsGroups(config);
    console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
    console.log(componentsGroups);
    console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
    const groupExist = (groupName: any) =>
        componentsGroups.find((group: any) => group.name === groupName);

    groupsToCheck.forEach(async (groupName: string) => {
        if (!groupExist(groupName)) {
            await createComponentsGroup(groupName, config);
        }
    });
};

export const removeAllComponents = async (config: RequestBaseConfig) => {
    const components = await getAllComponents(config);
    const component_groups = await getAllComponentsGroups(config);

    return Promise.all([
        ...components.map(async (component: any) => {
            await removeComponent(component, config);
        }),
        ...component_groups.map(async (componentGroup: any) => {
            await removeComponentGroup(componentGroup, config);
        }),
    ]);

    return [];
};

export const removeSpecifiedComponents: RemoveSpecificComponents = async (
    components,
    config
) => {
    const remoteComponents = await getAllComponents(config);
    const componentsToRemove: any = [];

    components.map((component: any) => {
        const shouldBeRemoved = remoteComponents.find(
            (remoteComponent: any) => component === remoteComponent.name
        );
        shouldBeRemoved && componentsToRemove.push(shouldBeRemoved);
    });

    return (
        componentsToRemove.length > 0 &&
        Promise.all(
            componentsToRemove.map((component: any) => {
                removeComponent(component, config);
            })
        )
    );
};

const _resolveGroups: ResolveGroups = async (
    component,
    existedGroups,
    remoteComponentsGroups
) => {
    if (!component.component_group_name) {
        return { ...component, component_group_uuid: null };
    }
    const componentsGroup = existedGroups.find(
        (group: any) => component.component_group_name === group
    );
    if (componentsGroup) {
        const component_group_uuid = remoteComponentsGroups.find(
            (remoteComponentsGroup: any) =>
                remoteComponentsGroup.name === componentsGroup
        ).uuid;

        return { ...component, component_group_uuid };
    }
};

export const syncComponents: SyncComponents = async (
    specifiedComponents,
    presets,
    config
) => {
    Logger.log("sync2Components: ");

    const specifiedComponentsContent = await Promise.all(
        specifiedComponents.map((component) => {
            return getFileContentWithRequire({ file: component.p });
        })
    );

    const groupsToCheck = _uniqueValuesFrom(
        specifiedComponentsContent
            .filter((component) => component.component_group_name)
            .map((component) => component.component_group_name)
    );

    await _checkAndPrepareGroups(groupsToCheck, config);

    // after checkAndPrepareGroups remoteComponents will have synced groups with local groups
    // updates of the groups had to happen before creation of them, cause creation/updates of components
    // happens async, so if one component will have the same group, as other one
    // it will be race of condition kinda issue - we will never now, if the group for current processed component
    // already exist or is being created by other request
    const remoteComponents = await getAllComponents(config);

    const componentsToUpdate = [];
    const componentsToCreate = [];

    for (const component of specifiedComponentsContent) {
        if (!isObjectEmpty(component)) {
            const shouldBeUpdated = remoteComponents.find(
                (remoteComponent: any) =>
                    component.name === remoteComponent.name
            );
            if (shouldBeUpdated) {
                componentsToUpdate.push({
                    id: shouldBeUpdated.id,
                    ...component,
                });
            } else {
                componentsToCreate.push(component);
            }
        }
    }

    const componentsGroups = await getAllComponentsGroups(config);

    componentsToUpdate.length > 0 &&
        Promise.all(
            componentsToUpdate.map((component) =>
                _resolveGroups(
                    component,
                    groupsToCheck,
                    componentsGroups,
                    config
                )
            )
        ).then((res) => {
            Logger.log("Components to update after check: ");
            res.map((component) => {
                Logger.warning(`   ${component.name}`);
                updateComponent(component, presets);
            });
        });

    componentsToCreate.length > 0 &&
        Promise.all(
            componentsToCreate.map((component) =>
                _resolveGroups(
                    component,
                    groupsToCheck,
                    componentsGroups,
                    config
                )
            )
        ).then((res) => {
            Logger.log("Components to create after check: ");
            res.map((component) => {
                Logger.warning(`   ${component.name}`);
                createComponent(component, presets);
            });
        });
};

export const syncAllComponents: SyncAllComponents = async (presets, config) => {
    // #1: discover all external .sb.js files
    const allLocalSbComponentsSchemaFiles = await discover({
        scope: SCOPE.local,
        type: LOOKUP_TYPE.fileName,
    });

    // #2: discover all local .sb.js files
    const allExternalSbComponentsSchemaFiles = await discover({
        scope: SCOPE.external,
        type: LOOKUP_TYPE.fileName,
    });

    // // #3: compare results, prefare local ones (so we have to create final external paths array and local array of things to sync from where)
    const { local, external } = compare({
        local: allLocalSbComponentsSchemaFiles,
        external: allExternalSbComponentsSchemaFiles,
    });

    // #4: sync - do all stuff already done (groups resolving, and so on)
    syncComponents([...local, ...external], presets, config);
};

export const syncProvidedComponents: SyncProvidedComponents = async (
    presets,
    components,
    packageName,
    config
) => {
    if (!packageName) {
        // #1: discover all external .sb.js files
        const allLocalSbComponentsSchemaFiles = await discoverMany({
            scope: SCOPE.local,
            type: LOOKUP_TYPE.fileName,
            fileNames: components,
        });
        // #2: discover all local .sb.js files
        const allExternalSbComponentsSchemaFiles = await discoverMany({
            scope: SCOPE.external,
            type: LOOKUP_TYPE.fileName,
            fileNames: components,
        });
        // #3: compare results, prefer local ones (so we have to create final external paths array and local array of things to sync from where)
        const { local, external } = compare({
            local: allLocalSbComponentsSchemaFiles,
            external: allExternalSbComponentsSchemaFiles,
        });

        // #4: sync - do all stuff already done (groups resolving, and so on)
        syncComponents([...local, ...external], presets, config);
    } else {
        // implement discovering and syncrhonizing with packageName
        // #1: discover all external .sb.js files
        const allLocalSbComponentsSchemaFiles = discoverManyByPackageName({
            scope: SCOPE.local,
            packageNames: components,
        });
        // #2: discover all local .sb.js files
        const allExternalSbComponentsSchemaFiles = discoverManyByPackageName({
            scope: SCOPE.external,
            packageNames: components,
        });
        // #3: compare results, prefer local ones (so we have to create final external paths array and local array of things to sync from where)
        const { local, external } = compare({
            local: allLocalSbComponentsSchemaFiles,
            external: allExternalSbComponentsSchemaFiles,
        });
        // #4: sync - do all stuff already done (groups resolving, and so on)
        syncComponents([...local, ...external], presets, config);
    }
};