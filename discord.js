const WebSocket = require('ws');

const BOT_TOKEN = '';
let ws;

function connectToGateway() {
    ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');

    ws.on('open', () => {
        console.log('Connected to Discord Gateway');
        identify();
    });

    ws.on('message', (data) => {
        const message = JSON.parse(data);
        handleMessage(message);
    });
}

function identify() {
    ws.send(JSON.stringify({
        op: 2,
        d: {
            token: BOT_TOKEN,
            intents: 513,
            properties: {
                $os: 'linux',
                $browser: 'discord-bot',
                $device: 'discord-bot'
            }
        }
    }));
}

function handleMessage(message) {
    switch (message.op) {
        case 10: 
            startHeartbeat(message.d.heartbeat_interval);
            break;
        case 11: 
            console.log('Received heartbeat ACK from Discord Gateway');
            break;
        case 0:
            if (message.t === 'MESSAGE_CREATE') {
                const content = message.d.content;
                if (content.startsWith('>i')) {
                    const itemName = content.substring(2).trim();
                    fetchItemData(itemName, message.d.channel_id);
                }
            }
            break;
        default:
            console.log('Received unexpected message:', message);
    }
}

function sendMessage(channelId, embed) {
    fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${BOT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ embeds: [embed] })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Failed to send message:', response.status, response.statusText);
        }
    })
    .catch(error => {
        console.error('Failed to send message:', error);
    });
}

function startHeartbeat(interval) {
    setInterval(() => {
        ws.send(JSON.stringify({ op: 1, d: null }));
    }, interval);
}

function createRichEmbed(ItemName, ItemId, ItemCreator, ItemPrice, Image, ItemUrl, OwnerCountUrl) {
    return {
        title: ItemName,
        url: ItemUrl,
        color: 0xFFD700,
        fields: [
            {
                name: "Asset ID",
                value: ItemId || "Not available",
                inline: true 
            },
            {
                name: "Creator",
                value: `[${ItemCreator || "Not available"}](https://www.roblox.com/users/1/profile)`,
                inline: true 
            },
            {
                name: "Price",
                value: ItemPrice || "Not available",
                inline: true
            },
            {
                name: "Owner Count",
                value: OwnerCountUrl ? `[Click](${OwnerCountUrl})` : "Not available",
                inline: true
            },
        ],
        image: {
            url: Image
        },
        timestamp: new Date(),
        footer: {
            text: "Scraped from RBLXTRADE"
        }
    };
}

const fetchItemData = async (itemName, channelId) => {
    try {
        const url = `https://catalog.roblox.com/v1/search/items/details?Keyword=${encodeURIComponent(itemName)}&includeNotForSale=true`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data for item: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        const item = data.data.find(item => item.name === itemName && item.creatorName === "Roblox");
        if (!item) {
            throw new Error('Item not found or not created by Roblox');
        }

        const ItemId = item.id;
        const ItemName = item.name;
        const ItemCreator = item.creatorName;
        const ItemPrice = item.lowestPrice || "N/A";

        const imageUrl = `https://thumbnails.roblox.com/v1/assets?assetIds=${ItemId}&returnPolicy=PlaceHolder&size=250x250&format=Png&isCircular=false`;
        const response2 = await fetch(imageUrl);
        if (!response2.ok) {
            throw new Error(`Failed to fetch image for item: ${response2.status} ${response2.statusText}`);
        }
        const data2 = await response2.json();
        const Image = data2.data[0]?.imageUrl;

        if (!Image) {
            throw new Error('Image not available for the item');
        }

        const ItemNameEncoded = itemName.replace(/ /g, "-");
        const ItemUrl = `https://www.roblox.com/catalog/${ItemId}/${ItemNameEncoded}`;
        const OwnerCountUrl = `https://rblx.trade/Roblox-Item/${ItemId}/${ItemNameEncoded}`;

        const embed = createRichEmbed(ItemName, ItemId, ItemCreator, ItemPrice, Image, ItemUrl, OwnerCountUrl);
        sendMessage(channelId, embed);

    } catch (error) {
        console.error('Error fetching and sending item data:', error.message);
    }
}

connectToGateway();
