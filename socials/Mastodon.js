import * as fs from 'fs';
import chalk from 'chalk';
import mastodon from "mastodon-api";

function IsMastodonConfigValid(config) {
    if(config.mastodonAccessToken === undefined ||  config.mastodonInstance === undefined 
        || config.mastodonAccessToken === null ||  config.mastodonInstance === null
        || config.mastodonAccessToken === '' ||  config.mastodonInstance === '') {
        console.warn(chalk.yellow("Skipping Mastodon, set both mastodon instance and access token if you wish to post to mastodon (Check config.json)"));
        return false;
    }
    return true;
}

export default async function PostToMastodon(status, config, lastPostTime) {
    if(!IsMastodonConfigValid(config)) return;

    const currentTime = new Date().getTime();
    const minMillisecondsBetweenPosts = config.minHoursBetweenPosts * 60 * 60 * 1000;

    if (currentTime - lastPostTime >= minMillisecondsBetweenPosts) {
        const M = new mastodon({ access_token: config.mastodonAccessToken, api_url: config.mastodonInstance + "/api/v1/" });
        M.post("statuses", { status: status }, (err, _) => {
            if (err) console.error(err);
            else {
                console.log(chalk.green("Post to Mastodon successful!"));
                lastPostTime = currentTime;
                fs.writeFileSync("./info/lastPostTime.txt", `${lastPostTime}`, (err) => {
                    if (err) console.error(chalk.red("Error writing lastPostTime to file:"), err);
                });
            }
        });
    }
    else 
        console.log(chalk.yellow(`Mastodon post skipped, last post was less than ${config.minHoursBetweenPosts} hours ago.`));
}

