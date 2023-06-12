import type { CLIOptions } from "../../utils/interfaces.js";

import {
    getAllDatasources,
    getDatasource,
} from "../../api/datasources/index.js";
import { managementApi } from "../../api/managementApi.js";
import { getAllPlugins, getPlugin } from "../../api/plugins/plugins.js";
import { getComponentPresets } from "../../api/presets/componentPresets.js";
import { getAllPresets, getPreset } from "../../api/presets/presets.js";
import { getAllRoles, getRole } from "../../api/roles/roles.js";
import { backupStories } from "../../api/stories/backup.js";
import storyblokConfig from "../../config/config.js";
import { createAndSaveToFile } from "../../utils/files.js";
import Logger from "../../utils/logger.js";
import {
    extractFields,
    getPackageJson,
    isItFactory,
    unpackOne,
} from "../../utils/main.js";
import { apiConfig } from "../api-config.js";

const BACKUP_COMMANDS = {
    components: "components",
    stories: "stories",
    componentGroups: "component-groups",
    datasources: "datasources",
    presets: "presets",
    componentPresets: "component-presets",
    roles: "roles",
    plugins: "plugins",
};

export const backup = async (props: CLIOptions) => {
    const { input, flags } = props;

    const command = input[1];

    const rules = {
        all: ["all"],
        empty: [],
    };
    const isIt = isItFactory<keyof typeof rules>(flags, rules, [
        "filename",
        "syncDirection",
        "from",
        "to",
        "presets",
        "packageName",
        "yes",
    ]);

    switch (command) {
        case BACKUP_COMMANDS.components:
            Logger.warning(`back up components... with command: ${command}`);
            if (flags["all"]) {
                managementApi.components
                    .getAllComponents(apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-components",
                            datestamp: true,
                            res,
                            folder: "components",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        console.error("error happened... :(");
                    });
            }
            if (isIt("empty")) {
                const componentToBackup = unpackOne(input);

                managementApi.components
                    .getComponent(componentToBackup, apiConfig)
                    .then(async (res: any) => {
                        if (res) {
                            await createAndSaveToFile({
                                ext: "json",
                                prefix: "component-",
                                filename: componentToBackup,
                                datestamp: true,
                                res,
                                folder: "components",
                            });
                        }
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }

            break;
        case BACKUP_COMMANDS.stories:
            Logger.warning(`back up stories... with command: ${command}`);
            if (flags["all"]) {
                backupStories(
                    {
                        filename: "all-stories-backup",
                        suffix: ".stories",
                        spaceId: storyblokConfig.spaceId,
                    },
                    apiConfig
                );
            }

            break;
        case BACKUP_COMMANDS.componentGroups:
            if (flags["all"]) {
                managementApi.components
                    .getAllComponentsGroups(apiConfig)
                    .then(async (res) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-component_groups",
                            datestamp: true,
                            res,
                            folder: "component-groups",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            if (isIt("empty")) {
                const componentGroupToBackup = unpackOne(input);

                managementApi.components
                    .getComponentsGroup(componentGroupToBackup, apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "component_group-",
                            datestamp: true,
                            filename: componentGroupToBackup,
                            res,
                            folder: "component-groups",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            break;
        case BACKUP_COMMANDS.datasources:
            if (flags["all"]) {
                getAllDatasources(apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-datasources",
                            datestamp: true,
                            res,
                            folder: "datasources",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            if (isIt("empty")) {
                const datasourceToBackup = unpackOne(input);

                getDatasource({ datasourceName: datasourceToBackup }, apiConfig)
                    .then(async (res: any) => {
                        if (res) {
                            await createAndSaveToFile({
                                ext: "json",
                                prefix: "datasources-",
                                filename: datasourceToBackup,
                                datestamp: true,
                                res,
                                folder: "datasources",
                            });
                        }
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            break;
        case BACKUP_COMMANDS.roles:
            if (flags["all"]) {
                getAllRoles(apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-roles",
                            datestamp: true,
                            res,
                            folder: "roles",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            if (isIt("empty")) {
                const roleToBackup = unpackOne(input);

                getRole(roleToBackup, apiConfig)
                    .then(async (res: any) => {
                        if (res) {
                            await createAndSaveToFile({
                                ext: "json",
                                prefix: "role-",
                                filename: roleToBackup,
                                datestamp: true,
                                res,
                                folder: "roles",
                            });
                        }
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            break;
        case BACKUP_COMMANDS.presets:
            if (flags["all"]) {
                getAllPresets(apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-presets-",
                            datestamp: true,
                            res,
                            folder: "presets",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            if (isIt("empty")) {
                const presetToBackup = unpackOne(input);

                getPreset(presetToBackup, apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "preset-",
                            filename: presetToBackup,
                            datestamp: true,
                            res,
                            folder: "presets",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            }
            break;
        case BACKUP_COMMANDS.componentPresets:
            if (isIt("empty")) {
                const componentPresetToBackup = unpackOne(input);

                getComponentPresets(componentPresetToBackup, apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            filename: `${componentPresetToBackup}.presets.sb.json`,
                            res,
                            folder: storyblokConfig.presetsBackupDirectory,
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
            } else if (flags["all"]) {
                const allRemoteComponents =
                    await managementApi.components.getAllComponents(apiConfig);
                let metadata = {};

                if (flags["metadata"]) {
                    const pkgJson = getPackageJson();
                    metadata = {
                        metadata: extractFields(
                            pkgJson,
                            storyblokConfig.metadataSelection
                        ),
                    };
                }

                allRemoteComponents.forEach(async (component: any) => {
                    getComponentPresets(component.name, apiConfig)
                        .then(async (res: any) => {
                            if (res) {
                                await createAndSaveToFile({
                                    ext: "json",
                                    filename: `${component.name}.presets.sb.json`,
                                    res: { allPresets: res, ...metadata },
                                    folder: storyblokConfig.presetsBackupDirectory,
                                });
                            }
                        })
                        .catch((err: any) => {
                            console.log(err);
                            Logger.error("error happened... :(");
                        });
                });
            }
            break;
        case BACKUP_COMMANDS.plugins:
            if (isIt("empty")) {
                const pluginToBackup = unpackOne(input);

                getPlugin(pluginToBackup, apiConfig)
                    .then(async (res: any) => {
                        if (res) {
                            await createAndSaveToFile({
                                ext: "json",
                                prefix: "plugin-",
                                filename: pluginToBackup,
                                datestamp: true,
                                res,
                                folder: "plugins",
                            });
                        }
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });

                Logger.log("Backing up provided plugins...");
            }

            if (flags["all"]) {
                getAllPlugins(apiConfig)
                    .then(async (res: any) => {
                        await createAndSaveToFile({
                            ext: "json",
                            prefix: "all-plugins-",
                            datestamp: true,
                            res,
                            folder: "plugins",
                        });
                    })
                    .catch((err: any) => {
                        console.log(err);
                        Logger.error("error happened... :(");
                    });
                return;
            }
            break;
        default:
            console.log(`no command like that: ${command}`);
    }
};
