const fs = require('fs');
const path = require('path');

const gradleFilePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradleFilePath)) {
  console.log('Android platform not found. Skipping Android patch.');
  process.exit(0);
}

let gradleContent = fs.readFileSync(gradleFilePath, 'utf-8');

// 1. Inject Groovy Functions
const groovyFunctions = `
import groovy.json.JsonSlurper

// Automatically parses the App ID (com.[author].[name]) from package.json
def getDynamicAppId() {
    def packageJsonFile = file("../../package.json")
    if (packageJsonFile.exists()) {
        def packageJson = new JsonSlurper().parseText(packageJsonFile.text)
        def ownerStr = (packageJson.author ?: packageJson.owner ?: "company").toString().toLowerCase().replaceAll("[^a-z0-9]", "")
        def nameStr = (packageJson.name ?: "app").toString().toLowerCase().replaceAll("-", "_").replaceAll("[^a-z0-9_]", "")
        return "com.\${ownerStr}.\${nameStr}"
    }
    return "com.example.app"
}

// Automatically pulls the "version" string from package.json
def getAppVersion() {
    def packageJsonFile = file("../../package.json")
    if (packageJsonFile.exists()) {
        def packageJson = new JsonSlurper().parseText(packageJsonFile.text)
        return (packageJson.version ?: "1.0").toString()
    }
    return "1.0"
}
`;

if (!gradleContent.includes('getDynamicAppId')) {
  gradleContent = gradleContent.replace(
    /apply plugin: 'com\.android\.application'/,
    `apply plugin: 'com.android.application'\n${groovyFunctions}`
  );
}

// 2. Inject Dynamic Variables
if (!gradleContent.includes('def dynamicAppId = getDynamicAppId()')) {
  gradleContent = gradleContent.replace(
    /android\s*\{/,
    `android {\n    def dynamicAppId = getDynamicAppId()`
  );
}

// Replace namespace
gradleContent = gradleContent.replace(
  /namespace\s+['"][^'"]+['"]/,
  `namespace dynamicAppId`
);

// Replace applicationId
gradleContent = gradleContent.replace(
  /applicationId\s+['"][^'"]+['"]/,
  `applicationId dynamicAppId`
);

// Replace versionName
gradleContent = gradleContent.replace(
  /versionName\s+['"][^'"]+['"]/,
  `versionName getAppVersion()`
);

// 3. Inject APK Filename Hook
const filenameHook = `
    applicationVariants.all { variant ->
        variant.outputs.all {
            def stringsFile = file("src/main/res/values/strings.xml")
            def appName = "app"
            if (stringsFile.exists()) {
                def stringsXml = new XmlParser().parse(stringsFile)
                def nameNode = stringsXml.string.find { it.@name == 'app_name' }
                if (nameNode) {
                    appName = nameNode.text().replaceAll(" ", "-")
                }
            }
            outputFileName = "\${appName}-\${variant.name}-\${variant.versionName}.apk"
        }
    }
`;

if (!gradleContent.includes('applicationVariants.all { variant ->')) {
  // Find the last closing brace of the android block
  const androidBlockMatch = gradleContent.match(/android\s*\{/);
  if (androidBlockMatch) {
    let braceCount = 0;
    let androidEndIndex = -1;
    let inAndroidBlock = false;
    
    for (let i = androidBlockMatch.index; i < gradleContent.length; i++) {
      if (gradleContent[i] === '{') {
        braceCount++;
        inAndroidBlock = true;
      } else if (gradleContent[i] === '}') {
        braceCount--;
        if (inAndroidBlock && braceCount === 0) {
          androidEndIndex = i;
          break;
        }
      }
    }

    if (androidEndIndex !== -1) {
      gradleContent = gradleContent.slice(0, androidEndIndex) + filenameHook + gradleContent.slice(androidEndIndex);
    }
  }
}

fs.writeFileSync(gradleFilePath, gradleContent, 'utf-8');
console.log('Successfully patched android/app/build.gradle with dynamic configuration hooks.');
