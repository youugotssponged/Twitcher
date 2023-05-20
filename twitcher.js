import * as fs from 'fs';
import chalk from 'chalk';
import CheckStreamerStatus from "./twitch/TwitchHandler.js";
import PostToMastodon from "./socials/Mastodon.js";

let config = {};
let stdin = {};
let lastIntervalChecked;

function KeyboardCallback(key) {
    // show time since last interval
    if (key === 't' || key === 'T') {
        // show time since last interval
        const diff = Math.abs(new Date(lastIntervalChecked) - Date.now());
        if ((diff / 1000) < 60) {
            const seconds = Math.floor((diff / 1000));
            console.log(chalk.yellow(`[INFO] It has been ${seconds} seconds since the last interval check`));
        } else {
            const minutes = Math.floor((diff / 1000) / 60);
            console.log(chalk.yellow(`[INFO] It has been ${minutes} minute(s) since the last interval check`));
        }
    }

    // Kill process
    if (key === 'q' || key === 'Q') {
        console.log(chalk.red("Exiting..."));
        process.exit();
    }
}

function PreFlightChecks() {
    let isSuccessful = true;
    try {
        let filesExist = true;
        console.log(chalk.blue("Running Pre-flight checks..."));

        console.log(chalk.blue("Loading config.json"));
        config = JSON.parse(fs.readFileSync('./config.json'));
        console.log(chalk.green("config.json loaded!"));

        if (!fs.existsSync("./info")) {
            console.log(chalk.cyanBright("Creating /info directory"));
            fs.mkdirSync("./info");
            console.log(chalk.green("Successfully created /info directory"));
        }

        if (!fs.existsSync("./info/lastPostTime.txt")) {
            console.log(chalk.cyanBright("Creating lastPostTime.txt in /info"));
            fs.closeSync(fs.openSync("./info/lastPostTime.txt", 'w'));
            console.log(chalk.green("Successfully created lastPostTime.txt"));
            filesExist = false;
        }

        if (!fs.existsSync("./info/streamStatus.txt")) {
            console.log(chalk.cyanBright("Creating streamStatus.txt in /info"));
            fs.closeSync(fs.openSync("./info/streamStatus.txt", 'w'));
            console.log(chalk.green("Successfully created streamStatus.txt"));
            filesExist = false;
        }

        if (!fs.existsSync("./info/lastOnlineTime.txt")) {
            console.log(chalk.cyanBright("Creating lastOnlineTime.txt in /info"));
            fs.closeSync(fs.openSync("./info/lastOnlineTime.txt", 'w'));
            console.log(chalk.green("Successfully created lastOnlineTime.txt"));
            filesExist = false;
        }

        // Set up stdin calls
        let commandHooksSuccessful = true;
        try {
            console.log(chalk.blue("Setting up stdin hooks..."));
            stdin = process.stdin;
            stdin.setRawMode(true);
            stdin.setEncoding('utf8');
            stdin.on('data', KeyboardCallback);
            console.log(chalk.green("stdin hooks have been successfully set up!"));
        } catch (error) {
            commandHooksSuccessful = false;
            console.log(chalk.redBright(`An error has occured during pre-flight checks, error was ${error}`));
        }
        if (filesExist && commandHooksSuccessful)
            console.log(chalk.green("Pre-flight checks successful!"));
        else
            console.log(chalk.green("Pre-flight check complete, info files have now generated"));

        return isSuccessful;
    }
    catch (error) {
        console.log(chalk.redBright(`An error has occured during pre-flight checks, error was ${error}`));
        isSuccessful = false;
        return isSuccessful;
    }
}

(async function () {

    if (!PreFlightChecks()) return;

    console.log(chalk.yellow(`\nNow running twitcher service for channel: ${config.ChannelName}`));
    console.log(chalk.yellow("\n[HINT] - REMEMBER - T to check time since last interval check"));
    console.log(chalk.yellow("[HINT] - REMEMBER - Q to kill process\n"));

    let lastPostTime = 0;
    let lastOnlineTime = 0;
    let prevStreamStatus = "offline";
    let checkInterval = config.checkIntervalInMinutes * 60 * 1000;

    lastPostTime = Number(fs.readFileSync("./info/lastPostTime.txt", "utf-8"));
    prevStreamStatus = fs.readFileSync("./info/streamStatus.txt", "utf-8");
    lastOnlineTime = Number(fs.readFileSync("./info/lastOnlineTime.txt", "utf-8"));

    if (isNaN(lastPostTime)) lastPostTime = 0;
    if (isNaN(lastOnlineTime)) lastOnlineTime = 0;
    if (prevStreamStatus === null || prevStreamStatus === undefined || prevStreamStatus === "")
        prevStreamStatus = "offline";

    async function PostToSocialMediasCallback(message, config) {
        PostToMastodon(message, config, lastOnlineTime);
        // Post to other platforms
    }

    lastIntervalChecked = Date.now();
    await CheckStreamerStatus(PostToSocialMediasCallback, prevStreamStatus, config);

    setInterval(async () => {
        lastIntervalChecked = Date.now();
        await CheckStreamerStatus(PostToSocialMediasCallback, prevStreamStatus, config);
    }, checkInterval);
}());
