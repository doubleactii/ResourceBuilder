const fs = require('fs').promises;
const path = require('path');
// For colorful logs
const chalk = require('chalk');

const version = "VERSION_REPLACE_ME";

function generateUniqueRandomString(pLength = 8) {
    const randomID = `${Math.floor(Date.now() / (Math.random() * 100))}`;
    return randomID.slice(0, pLength); // Truncate randomID to desired length
}

// Helpers to easily log things
const log = console.log;
const info = chalk.hex('#ffa552');
const error = chalk.hex('#c42847');
const alert = chalk.hex('#EFF2C0');

// An array of all directories created via this builder
const resourceTypeDirectories = ['interface', 'icon', 'map', 'sound', 'macros']

// Get command line arguments
const args = process.argv.slice(2);

// Parse flags and their values from command line arguments
const flags = {};
let currentFlag = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    // This is a flag
    const flag = arg.replace(/^--/, '');
    currentFlag = flag;
    flags[flag] = true; // Default value if no value is provided
  } else if (currentFlag !== null) {
    // This is a value for the current flag
    flags[currentFlag] = arg;
    currentFlag = null;
  }
}

/**
 * The amount of resources this builder has processed.
 * @private
 * @type {number}
 */
let resourcesProcessed = 0;
/**
 * The max amount of resources this builder has found.
 * @private
 * @type {number}
 */
let maxResourcesToProcess = 0;
/**
 * An array of resource paths that needs to be checked.
 * @private
 * @type {Array}
 */
const resourcesToProcess = [];
/**
 * The resource JSON that is built
 * @private
 * @type {Object}
 */
const resourceJSON = {
    'interface': [],
    'sound': [],
    'macro': [],
    'map': [],
    'icon': []
};
/**
 * An array full of valid extensions to be found in directories.
 * @private
 * @type {Array}
 */
const validExtensions = ['vyint', 'vyi', 'vym', 'vymac', 'mp3', 'aac', 'wav', 'm4a', 'ogg', 'flac'];

/**
 * The path to your resource directory.
 * @private
 * @type {string}
 */
const resourceInDirectory = flags.in;
const resourceOutDirectory = flags.out;
const resourceJSONPath = `${flags.out}/resource.json`;

async function processFile(pFile) {
    let preventCountingResource = false;
    // Extract the extension so we know where to put the file in our resource json
    const extension = path.extname(pFile).slice(1);
    // Extract the filename without pathname using regex
    const fileNameWithoutPath = pFile.replace(/^.*[\\\/]/, '');
    // Create a randomized name that will serve as the identifier for this resource
    const resourceIdentifier = `${generateUniqueRandomString(8)}.${extension}`;
    // Temp reference to resourceJSON array to use
    let resourceArray;
    // The directory is the resource folder to generate the file in
    let resourceTypeDirectory;

    switch (extension) {
        // Interface
        case 'vyint':
            resourceArray = resourceJSON.interface;
            resourceTypeDirectory = 'interface';
            break;
        // Icon
        case 'vyi':
            resourceArray = resourceJSON.icon;
            resourceTypeDirectory = 'icon';
            break;
        // Map
        case 'vym':
            resourceArray = resourceJSON.map;
            resourceTypeDirectory = 'map';
            break;
        // Macro
        case 'vymac':
            resourceArray = resourceJSON.macro;
            resourceTypeDirectory = 'macro';
            break;
        // Sound
        case 'mp3':
        case 'wav':
        case 'm4a':
        case 'ogg':
        case 'aac':
        case 'flac':
            if (flags.ignoreSound) {
                // In the event sounds aren't to be processed then we subtract from the amount of needed resources to process.
                --maxResourcesToProcess;
                // We prevent counting this resource from being counted.
                preventCountingResource = true;
                if (flags.verbose) {
                    log(`${error('[Ignored File]')} ${pFile} ${alert(`because`)} the ${alert('[ignoreSound]')} flag is enabled`);
                }
                // Combine styled and normal strings
            } else {
                resourceArray = resourceJSON.sound;
                resourceTypeDirectory = 'sound';
            }
            break;       
    }
    // We check if resourceArray has been set, as in some cases it may not be set due to a flag being enabled.
    if (resourceArray) {
        resourceArray.push({ resourceIdentifier: resourceIdentifier, fileName: fileNameWithoutPath });
        await copyFileToDirectory(pFile, `${resourceOutDirectory}/resources/${resourceTypeDirectory}`, `${resourceIdentifier}`);
    }

    // This resource has been built into the resource json, we can increment the resource counter to indicate this resource has been tracked.
    if (!preventCountingResource) {
        resourcesProcessed++;
        const fileNameWithoutExtension = pFile.match(/(.+?)(?=\.[^.]+$|$)/)[0];
        if (flags.verbose) {
            log(`${info('[Processed File]')} ${fileNameWithoutExtension}${info(`.${extension}`)}`);
        }
    }
    // Check if the resources has reached the max, and its at the last resource folder (sounds)
    // Checks also if there is a directory named sound, if not, then we skip and just create the resource json
    if (resourcesProcessed >= maxResourcesToProcess) {
        deleteResourceJSON(); // Delete a file from a certain directory if it exists
    }
}

/**
 * Recursively processes the resource directory categorizing its contents into directories and files.
 * @param {string} pDirectoryPath - The path of the directory to be processed.
 * @returns {Promise<void>} A Promise that resolves when the entire processing is complete.
 */
async function processDirectory(pDirectoryPath) {
    try {
        const contents = await fs.readdir(pDirectoryPath);

        for (const item of contents) {
            const itemPath = path.join(pDirectoryPath, item);
            const stats = await fs.stat(itemPath);
            const extension = path.extname(itemPath).slice(1);

            if (stats.isDirectory()) {
                // Process subdirectories recursively
                await processDirectory(itemPath);
            } else {
                // Iterate over valid extensions to check if this file matches that pattern
                validExtensions.every((pExtension) => {
                    if (extension.includes(pExtension)) {
                        maxResourcesToProcess++;
                        resourcesToProcess.push(itemPath);
                        return false;
                    }
                    return true;
                });
            }
        }
    } catch (pError) {
        log(`${error('[Error]')} processing directory: ${pError}`);
    }
}

// Entry point
const build = async () => {
    if (!resourceInDirectory) {
        log(`${error('[Empty]')} no in directory found! You can specify a input directory via the --in flag`);
        return;
    }
    
    if (!resourceOutDirectory) {
        log(`${error('[Empty]')} no out directory found! You can specify a input directory via the --out flag`);
        return;
    }
    await clearResourceTypeDirectories(`${resourceOutDirectory}/resources`, resourceTypeDirectories);
    await processDirectory(resourceInDirectory);
    // If there were resources found, then process them
    if (resourcesToProcess.length) {
        resourcesToProcess.forEach((pResourcePath) => {
            processFile(pResourcePath);
        });
    } else {
        log(`${error('[Empty]')} no resources found!`);
        await createResourceJSON(JSON.stringify(resourceJSON));
    }
}

/**
 * Copies a file to a destination directory.
 * @param {string} pSourceFilePath - The path to the source file.
 * @param {string} pDestinationDirectory - The path to the destination directory.
 * @param {string} pNewName - The new name of the copied file.
 * @returns {Promise<void>} A Promise that resolves when the file is copied successfully.
 */
async function copyFileToDirectory(pSourceFilePath, pDestinationDirectory, pNewName) {
    try {
        // Check if the destination directory exists, if not, create it
        await fs.mkdir(pDestinationDirectory, { recursive: true });

        // Extract the file name from the source file path
        const fileName = path.basename(pSourceFilePath);

        // Construct the destination file path
        const destinationFilePath = path.join(pDestinationDirectory, pNewName);

        // Copy the file
        await fs.copyFile(pSourceFilePath, destinationFilePath);
    } catch (pError) {
        log(`${error(`[Error]`)} copying ${pSourceFilePath}: ${pError}`);
    }
}

/**
 * Clears specified directories within a base directory.
 * @param {string} pBaseDirectory - The path to the base directory.
 * @param {Array<string>} pDirectoriesToRemove - An array of directory names to be removed.
 * @returns {Promise<void>} A Promise that resolves when all directories have been removed.
 */
async function clearResourceTypeDirectories(pBaseDirectory, pDirectoriesToRemove) {
    try {
        // Iterate over each directory to remove
        for (const directory of pDirectoriesToRemove) {
            const directoryPath = path.join(pBaseDirectory, directory);
            // Check if the directory exists
            const directoryExists = await fs.stat(directoryPath).then(stat => stat.isDirectory()).catch(() => false);
            // If the directory exists, remove it
            if (directoryExists) {
                await fs.rm(directoryPath, { recursive: true });
            }
        }
    } catch (pError) {
        log(`${error(`[Error]`)} clearing directories: ${pError}`);
    }
}

/**
 * Creates a new resource JSON file with the provided data.
 * @param {string} pFileData - The data to be written to the new JSON file.
 * @returns {Promise<void>} A Promise that resolves when the file creation is complete.
 */
async function createResourceJSON(pFileData) {
    const filePath = path.join(__dirname, `${resourceJSONPath}`);
    try {
        await fs.writeFile(filePath, pFileData);
        log(`${alert(`ResourceJSON`)} created in ${alert(`${resourceJSONPath}`)}`);
    } catch (pError) {
        log(`${error(`[Error]`)} creating ResourceJSON ${pError}`);
    }
}
/**
 * Deletes the resource JSON file if it exists, then creates a new resource JSON with the provided data.
 * @param {string} pFileData - The data to be written to the new JSON file.
 * @returns {Promise<void>} A Promise that resolves when the operations are complete.
 */
async function deleteResourceJSON() {
    const filePath = path.join(__dirname, `${resourceJSONPath}`);

    try {
        await fs.access(filePath);
        // File exists, so delete it
        await fs.unlink(filePath);
    } catch (pError) {
        // If any other error other than FILE MISSING
        if (pError.code !== 'ENOENT') {
            log(`${error(`[Error]`)} Error deleting file ${filePath}: ${pError}`);
        }
    }

    // Create a file in a specific directory
    await createResourceJSON(JSON.stringify(resourceJSON));
}

// Start
build();