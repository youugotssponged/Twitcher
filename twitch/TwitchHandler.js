import * as fs from 'fs';
import request from 'request';

let sendAnnouncement = false;

function GetAuthKey(clientID, clientSecret) {
    const sendRequest = (resolve, reject) => {
        request.post(
            `https://id.twitch.tv/oauth2/token?client_id=${clientID}&client_secret=${clientSecret}&grant_type=client_credentials`,
            (err, _, body) => {
                if (err) return console.error(err)
                try{ resolve(JSON.parse(body).access_token); }
                catch(e){ reject(e); }
            }
        );
    };
    return new Promise((resolve, reject) => sendRequest(resolve, reject));
}


async function GetChannelData(channelName, clientID, authkey) {
    return new Promise((resolve, reject) => {
        request.get(
            `https://api.twitch.tv/helix/search/channels?query=${channelName}`,
            {
                headers: {
                    'client-id': clientID,
                    'Authorization': `Bearer ${authkey}`
                }
            },
            (err, _, body) => {
                if (err) return console.error(err);

                try {
                    const channelData = JSON.parse(body).data;
                    var doesExist = false;

                    for (let i = 0; i < channelData.length; i++) {
                        if ((channelData[i].broadcaster_login).toLowerCase() == channelName.toLowerCase()) {
                            doesExist = true;
                            resolve(JSON.parse(body).data[i]);
                        }
                    }

                    if (!doesExist) resolve(false);
                }
                catch (e) { reject(e); }
            }
        )
    });
}

async function GetStreamData(channelName, clientID, authkey) {
    return new Promise((resolve, reject) => {
        request.get(
            `https://api.twitch.tv/helix/streams?user_login=${channelName}`,
            {
                headers: {
                    'client-id': clientID,
                    'Authorization': `Bearer ${authkey}`
                }
            },
            (err, _, body) => {
                if (err) return console.error(err);
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(e); }
            }
        )
    });
}


export default async function CheckStreamerStatus(PostToSocialMediasCallback, prevStreamStatus, config, lastOnlineTime) {
    const messages = config.messages;
    const authToken = await GetAuthKey(config.twitch_clientID, config.twitch_secret);
    const channelData = await GetChannelData(config.ChannelName, config.twitch_clientID, authToken);

    if (!channelData) {
        console.error(`Channel "${config.ChannelName}" not found on Twitch.`);
        return;
    }

    const streamData = await GetStreamData(config.ChannelName, config.twitch_clientID, authToken);
    const streamTitle = (streamData.data[0] && streamData.data[0].title) || '';
    const streamUrl = `https://www.twitch.tv/${config.ChannelName}`;

    if (streamData.data.length === 0) {
        console.log(`${config.ChannelName} is currently offline.`);

        if (prevStreamStatus === "online") {
            const currentTime = new Date().getTime();
            const timeSinceLastOnline = currentTime - lastOnlineTime;
            const minutesToWaitBeforeEndOfStreamMessage = config.minutesToWaitBeforeEndOfStreamMessage * 60 * 1000;

            fs.writeFileSync("./info/lastOnlineTime.txt", `${new Date().getTime()}`);
            console.log("Writing current time to lastOnlineTime.txt");

            if (config.enableEndOfStreamMessage && timeSinceLastOnline <= minutesToWaitBeforeEndOfStreamMessage) {
                const randomEndMessage = config.endOfStreamMessages[Math.floor(Math.random() * config.endOfStreamMessages.length)];
                const endMessage = randomEndMessage.replace("{streamTitle}", streamTitle);
                PostToSocialMediasCallback(endMessage, config);
            }
            fs.writeFileSync("./info/streamStatus.txt", "offline");
            console.log("Writing 'offline' to streamStatus.txt");
        }
        return;
    } else {
        console.log(`${config.ChannelName} is live!`);
        if (prevStreamStatus === "offline") {
            fs.writeFileSync("./info/streamStatus.txt", "online");
            console.log("Writing 'online' to streamStatus.txt");
        }
    }

    // Check if it has been more than the configured hours since the last post
    if (!sendAnnouncement) {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const message = randomMessage.replace("{streamTitle}", streamTitle).replace("{streamUrl}", streamUrl);
        await PostToSocialMediasCallback(message, config);
    }
}