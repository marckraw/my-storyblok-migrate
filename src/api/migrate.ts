import Logger from "../utils/logger.js";
import {
    getAllComponentsGroups,
    createComponentsGroup,
    getAllComponents,
    removeComponent,
    removeComponentGroup,
} from "./components.js";
import { updateComponent, createComponent } from "./mutateComponents.js";
import {
    discoverManyByPackageName,
    OneComponent,
    LOOKUP_TYPE,
    SCOPE,
    compare,
    discover,
    discoverMany,
} from "../utils/discover.js";
import { getFileContentWithRequire } from "../utils/main.js";
import { createStory, getAllStories, removeStory } from "./stories.js";
import { createPlugin, getPlugin, updatePlugin } from "./plugins.js";
import { readFile } from "../utils/files.js";

const _uniqueValuesFrom = (array: any[]) => [...new Set(array)];

const _checkAndPrepareGroups = async (groupsToCheck: any) => {
    const componentsGroups = await getAllComponentsGroups();
    const groupExist = (groupName: any) =>
        componentsGroups.component_groups.find(
            (group: any) => group.name === groupName
        );

    groupsToCheck.forEach(async (groupName: string) => {
        if (!groupExist(groupName)) {
            await createComponentsGroup(groupName);
        }
    });
};

const _resolveGroups = async (
    component: any,
    existedGroups: any,
    remoteComponentsGroups: any
) => {
    if (!component.component_group_name) {
        return { ...component, component_group_uuid: null };
    }
    const componentsGroup = existedGroups.find(
        (group: any) => component.component_group_name === group
    );
    if (componentsGroup) {
        const component_group_uuid =
            remoteComponentsGroups.component_groups.find(
                (remoteComponentsGroup: any) =>
                    remoteComponentsGroup.name === componentsGroup
            ).uuid;

        return { ...component, component_group_uuid };
    }
};

interface SyncComponents {
    specifiedComponents: OneComponent[];
    presets: boolean;
}

export const syncComponents = async ({
    specifiedComponents,
    presets,
}: SyncComponents) => {
    Logger.log("sync2Components: ");

    const specifiedComponentsContent = await Promise.all(
        specifiedComponents.map((component) => {
            return getFileContentWithRequire({ file: component.path });
        })
    );

    const groupsToCheck = _uniqueValuesFrom(
        specifiedComponentsContent
            .filter((component) => component.component_group_name)
            .map((component) => component.component_group_name)
    );

    await _checkAndPrepareGroups(groupsToCheck);

    // after checkAndPrepareGroups remoteComponents will have synced groups with local groups
    // updates of the groups had to happen before creation of them, cause creation/updates of components
    // happens async, so if one component will have the same group, as other one
    // it will be race of condition kinda issue - we will never now, if the group for current processed component
    // already exist or is being created by other request
    const remoteComponents = await getAllComponents();

    const componentsToUpdate = [];
    const componentsToCreate = [];

    for (const component of specifiedComponentsContent) {
        const shouldBeUpdated = remoteComponents.components.find(
            (remoteComponent: any) => component.name === remoteComponent.name
        );
        if (shouldBeUpdated) {
            componentsToUpdate.push({ id: shouldBeUpdated.id, ...component });
        } else {
            componentsToCreate.push(component);
        }
    }

    const componentsGroups = await getAllComponentsGroups();

    componentsToUpdate.length > 0 &&
        Promise.all(
            componentsToUpdate.map((component) =>
                _resolveGroups(component, groupsToCheck, componentsGroups)
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
                _resolveGroups(component, groupsToCheck, componentsGroups)
            )
        ).then((res) => {
            Logger.log("Components to create after check: ");
            res.map((component) => {
                Logger.warning(`   ${component.name}`);
                createComponent(component, presets);
            });
        });
};

interface SyncAllComponents {
    presets: boolean;
}

interface SyncProvidedComponents {
    presets: boolean;
    components: string[];
    packageName: boolean;
}

interface SyncProvidedPlugins {
    plugins: string[];
}

export const syncProvidedComponents = ({
    components,
    presets,
    packageName,
}: SyncProvidedComponents) => {
    if (!packageName) {
        // #1: discover all external .sb.js files
        const allLocalSbComponentsSchemaFiles = discoverMany({
            scope: SCOPE.local,
            type: LOOKUP_TYPE.fileName,
            fileNames: components,
        });
        // #2: discover all local .sb.js files
        const allExternalSbComponentsSchemaFiles = discoverMany({
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
        syncComponents({
            presets,
            specifiedComponents: [...local, ...external],
        });
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
        syncComponents({
            presets,
            specifiedComponents: [...local, ...external],
        });
    }
};

export const syncAllComponents = ({ presets }: SyncAllComponents) => {
    // #1: discover all external .sb.js files
    const allLocalSbComponentsSchemaFiles = discover({
        scope: SCOPE.local,
        type: LOOKUP_TYPE.fileName,
    });
    // #2: discover all local .sb.js files
    const allExternalSbComponentsSchemaFiles = discover({
        scope: SCOPE.external,
        type: LOOKUP_TYPE.fileName,
    });
    // #3: compare results, prefare local ones (so we have to create final external paths array and local array of things to sync from where)
    const { local, external } = compare({
        local: allLocalSbComponentsSchemaFiles,
        external: allExternalSbComponentsSchemaFiles,
    });

    // #4: sync - do all stuff already done (groups resolving, and so on)
    syncComponents({
        presets,
        specifiedComponents: [...local, ...external],
    });
};

export const removeAllComponents = async () => {
    const { components, component_groups } = await getAllComponents();

    return Promise.all([
        ...components.map(async (component: any) => {
            await removeComponent({ component });
        }),
        ...component_groups.map(async (componentGroup: any) => {
            await removeComponentGroup({ componentGroup });
        }),
    ]);
};

export const removeSpecifiedComponents = async ({
    components,
}: {
    components: any;
}) => {
    const remoteComponents = await getAllComponents();
    const componentsToRemove: any = [];

    components.map((component: any) => {
        const shouldBeRemoved = remoteComponents.components.find(
            (remoteComponent: any) => component === remoteComponent.name
        );
        shouldBeRemoved && componentsToRemove.push(shouldBeRemoved);
    });

    return (
        componentsToRemove.length > 0 &&
        Promise.all(
            componentsToRemove.map((component: any) => {
                removeComponent({ component });
            })
        )
    );
};

export const syncContent = async ({
    // @ts-ignore
    from,
    // @ts-ignore
    to,
}: {
    from: number;
    to: number;
}) => {
    const stories = await getAllStories({ spaceId: from });

    const rootLevelStories = stories.filter(({ story }) => !story.parent_id);

    // here we create root level in source space
    await Promise.all(
        rootLevelStories.map(async (story: any) => {
            await createStory({ spaceId: to, content: story.story });
        })
    );

    const nestedLevelStories = stories.filter(({ story }) => story.parent_id);
    const nestedLevelMap = new Map();
    nestedLevelStories.map(({ story }) => {
        const finalSlugLength = story.full_slug.split("/").length;
        nestedLevelMap.set(finalSlugLength, [
            ...(nestedLevelMap.get(finalSlugLength) || []),
            { story },
        ]);
    });

    const nestedLevelArray = Array.from(nestedLevelMap);

    const storiesFromTarget = await getAllStories({ spaceId: to });

    // console.log(finalOrder)

    // [
    //     [
    //         2,
    //         [ [Object], [Object] ]
    //     ],
    //     [
    //         3,
    //         [ [Object] ]
    //     ]
    // ]

    // const result = finalOrder.map(async ([_key, stories]) => {
    //     const promised = await Promise.all(
    //         stories.map((story: any) => {
    //             console.log("///////////////////")
    //             console.log(story)
    //             console.log("///////////////////")
    //             return createStory({ spaceId: to, content: story.story });
    //         })
    //     );
    //     console.log("_____________ done _____________" + _key)
    //     console.log(promised)
    //     console.log("_____________")
    // })

    return {
        // ...rootLevelStoriesOutput,
        // ...result
    };
};

export const removeAllStories = async ({ spaceId }: { spaceId: number }) => {
    Logger.warning(
        `Trying to remove all stories from space with spaceId: ${spaceId}`
    );
    const stories = await getAllStories({ spaceId });
    const allResponses = Promise.all(
        stories.map(
            async (story: any) =>
                await removeStory({ spaceId, storyId: story.story.id })
        )
    );

    return allResponses;
};

export const syncProvidedPlugins = async ({ plugins }: SyncProvidedPlugins) => {
    const body = await readFile("dist/export.js");
    if (plugins.length === 1) {
        const pluginName = plugins[0];
        const plugin = await getPlugin(pluginName);
        if (plugin) {
            console.log("Plugin exist.");
            console.log("Start updating plugin....");
            return await updatePlugin({ plugin: plugin.field_type, body });
        } else {
            console.log("Start creating plugin...");
            const { field_type } = await createPlugin(pluginName as string);
            console.log("Start updating plugin...");
            return await updatePlugin({ plugin: field_type, body });
        }
    }
};
