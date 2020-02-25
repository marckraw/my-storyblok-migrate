const path = require(`path`)
require("dotenv").config()

let customConfig = {}
try {
  customConfig = require(path.resolve(process.cwd(), `storyblok.config`))
} catch (error) {
  // default config will be used
  if (error.code !== `MODULE_NOT_FOUND`) throw error
}

const defaultConfig = {
  reactComponentsDirectory: 'src/components',
  npmScopeForComponents: '@storyblok-components',
  boilerplateUrl: 'git@github.com:marckraw/gatsby-storyblok-boilerplate.git',
  sbmigWorkingDirectory: "sbmig",
  componentDirectory: "sbmig/storyblok",
  datasourcesDirectory: "storyblok", 
  componentsDirectories: ["src", "storyblok"],
  schemaFileExt: "sb.js",
  storyblokApiUrl: "https://api.storyblok.com/v1",
  oauthToken: process.env.STORYBLOK_OAUTH_TOKEN,
  spaceId: process.env.STORYBLOK_SPACE_ID,
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN
}

module.exports = { ...defaultConfig, ...customConfig }
