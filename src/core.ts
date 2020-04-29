import Command from '@oclif/command'
import storyblokConfig, { IStoryblokConfig } from './config/config';
import { findComponents, findComponentsWithExt, findDatasources } from './utils/discover'

export default abstract class extends Command {
    getStoryblokConfig(): IStoryblokConfig {
        return storyblokConfig
    }

    findComponents(componentDirectory: string) {
        return findComponents(componentDirectory)
    }

    findComponentsWithExt(ext: string) {
        return findComponentsWithExt(ext)
    }

    findDatasources() {
        return findDatasources()
    }
}